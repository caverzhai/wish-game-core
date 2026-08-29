// =============================================================
// GameService.js —— 对局主服务：注册 / 下注 / 封盘 / 结算 / 历史
// 所有方法显式传入 atSec（秒），便于用虚拟时钟测试与回放
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin, SCALE } from './money.js';
import { planSettlement } from './engine-settle.js';

export class GameService {
  constructor(store, cfg, insuranceService) {
    this.store = store;
    this.cfg = cfg;
    this.insurance = insuranceService;
  }

  /** 关联钱包即注册；首登带邀请人则永久绑定，不可改、不可自邀 */
  register(wallet, inviterUid = null, atSec = 0) {
    if (inviterUid) {
      this.store.getUser(inviterUid); // 邀请人必须存在，否则抛错
    }
    const u = this.store.createUser({ wallet, inviterUid, createdAt: atSec });
    return u;
  }

  _findOpenRound() {
    for (const r of [...this.store.rounds.values()].reverse()) {
      if (r.state === 'active' || r.state === 'locked') return r;
    }
    return null;
  }

  /**
   * 下注。amountCoin 为整数枚（1-99）；pick 0-9；side red/green；可多笔、可双边
   */
  bet(uid, side, amountCoin, pick, atSec) {
    const cfg = this.cfg, s = this.store;
    if (side !== 'red' && side !== 'green') throw new GameError(Codes.BAD_INPUT, '只能选红或绿');
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, '许愿金必须是正整数（枚）');
    const amount = coin(amountCoin);
    if (amount < cfg.betMin || amount > cfg.betMax) throw new GameError(Codes.BAD_INPUT, '单笔许愿金为 1-99 枚');
    if (!Number.isInteger(pick) || pick < cfg.pickMin || pick > cfg.pickMax) throw new GameError(Codes.BAD_INPUT, '请选择 0-9 的整数');
    this.store.getUser(uid);

    return s.transaction(() => {
      let round = this._findOpenRound();
      if (!round) {
        // H：无人不开局，第一笔下注才启动倒计时
        const start = atSec;
        round = {
          roundId: s.nextId('round', 'R'),
          startAt: start,
          lockAt: start + cfg.lockAfterSec,
          settleAt: start + cfg.settleAfterSec,
          state: 'active',
          redTotal: 0n, greenTotal: 0n, sumPick: 0,
          result: null,
        };
        s.rounds.set(round.roundId, round);
      }
      if (atSec >= round.lockAt) {
        round.state = 'locked';
        throw new GameError(Codes.ROUND_LOCKED, '已封盘，本局不可再许愿');
      }
      const a = s.account(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
      a.available -= amount;
      a.frozen += amount; // 下注资金转入在途冻结
      const bet = {
        betId: s.nextId('bet', 'BT'), roundId: round.roundId, uid, side, amount, pick, atSec,
        winCredit: 0n, insCut: 0n, settled: false,
      };
      s.bets.push(bet);
      round.redTotal += side === 'red' ? amount : 0n;
      round.greenTotal += side === 'green' ? amount : 0n;
      round.sumPick += pick;
      s.addFlow(uid, 'BET_FROZEN', amount, { roundId: round.roundId, side });
      return { roundId: round.roundId, betId: bet.betId, lockAt: round.lockAt, settleAt: round.settleAt };
    }, 'bet');
  }

  /** 结算到点未结的局（180s）；幂等 */
  settle(atSec) {
    const s = this.store, cfg = this.cfg;
    const round = this._findOpenRound();
    if (!round) throw new GameError(Codes.NOT_FOUND, '没有进行中的局');
    if (atSec < round.settleAt) throw new GameError(Codes.ROUND_NOT_SETTLABLE, '未到开奖时间');

    const bets = s.bets.filter((b) => b.roundId === round.roundId);
    // 结算上下文：保险是否生效、邀请人、邀请人档位人数
    const insActiveByUid = new Map();
    const inviters = new Set();
    for (const b of bets) {
      const u = s.getUser(b.uid);
      insActiveByUid.set(b.uid, { insActive: this.insurance.isActive(b.uid), inviterUid: u.inviterUid });
      if (u.inviterUid) inviters.add(u.inviterUid);
    }
    const nodeCntByInviter = new Map();
    for (const iv of inviters) nodeCntByInviter.set(iv, this.insurance.countDistinctNodeInvitees(iv));

    const plan = planSettlement(bets, { insActiveByUid, nodeInviteeCountByUid: nodeCntByInviter }, cfg);

    return s.transaction(() => {
      if (plan.status === 'cancelled') {
        // 流局：冻结原路退回，不抽水、不扣费、不计亏损、不计返佣
        for (const [uid, refund] of plan.refunds) {
          const a = s.account(uid);
          a.frozen -= refund;
          a.available += refund;
          s.addFlow(uid, 'CANCEL_REFUND', refund, { roundId: round.roundId });
        }
        round.state = 'cancelled';
        round.result = { status: 'cancelled' };
        return { roundId: round.roundId, state: 'cancelled' };
      }

      const t = plan.totals;
      // 抽水拆分 + 分奖尾差
      s.ledger.insurancePool += t.feeIns + t.dust;
      s.ledger.platform += t.feePlat;

      for (const row of plan.users) {
        const a = s.account(row.uid);
        a.frozen -= row.totalStake;            // 解冻本局全部在途
        a.available += row.winCredit;          // 胜方派奖（保险生效者已扣 10%）
        s.ledger.insurancePool += row.insCut;  // 保险赢家 10% 入保池
        if (row.winCredit > 0n) s.addFlow(row.uid, 'WIN_CREDIT', row.winCredit, { roundId: round.roundId });
        if (row.insCut > 0n) s.addFlow(row.uid, 'INS_WIN_CUT', row.insCut, { roundId: round.roundId });
        // 负方投入：仅对保险生效者累计亏损并尝试生成节点（Q5）
        const meta = insActiveByUid.get(row.uid);
        if (meta.insActive && row.loseStake > 0n) {
          this.insurance.accrueLossInternal(row.uid, row.loseStake, atSec);
        }
      }

      // 邀请返佣：从平台那份列支
      let referralTotal = 0n;
      for (const r of plan.referral) {
        if (r.reward <= 0n) continue;
        const ia = s.account(r.inviterUid);
        s.ledger.platform -= r.reward;
        ia.available += r.reward;
        s.referralLogs.push({ roundId: round.roundId, ...r, atSec });
        s.addFlow(r.inviterUid, 'REFERRAL', r.reward, { roundId: round.roundId, fromUid: r.fromUid });
        referralTotal += r.reward;
      }

      Object.assign(round, { redTotal: t.redTotal, greenTotal: t.greenTotal, sumPick: t.sumPick, state: 'settled' });
      round.result = {
        status: 'settled', winSide: t.winSide, total: t.total, fee: t.fee,
        feeIns: t.feeIns, feePlat: t.feePlat, pot: t.pot, dust: t.dust, referralTotal,
      };
      for (const b of bets) b.settled = true;
      return { roundId: round.roundId, state: 'settled', ...round.result };
    }, 'settle');
  }

  currentRound() {
    const r = this._findOpenRound();
    if (!r) return null;
    const betCount = this.store.bets.filter((b) => b.roundId === r.roundId).length;
    return { ...r, betCount }; // 仅回传匿名笔数，不回传他人金额/选号
  }

  /** 开奖后明细（近 100 场可查，逐笔公开） */
  roundDetail(roundId) {
    const r = this.store.rounds.get(roundId);
    if (!r) throw new GameError(Codes.NOT_FOUND, '局不存在');
    if (r.state === 'active' || r.state === 'locked') {
      return { ...r, bets: undefined, note: '未开奖，暂不公开明细' };
    }
    const bets = this.store.bets.filter((b) => b.roundId === roundId)
      .map((b) => ({ uid: b.uid, side: b.side, amount: b.amount, pick: b.pick, winCredit: b.winCredit, insCut: b.insCut }));
    return { ...r, bets };
  }

  recentRounds(limit = 100) {
    return [...this.store.rounds.values()].slice(-limit).reverse();
  }
}
