// =============================================================
// GameService.js —— 对局主服务：注册 / 许愿 / 停止许愿 / 结算 / 历史（全 async）
// 开局规则：一局结束后不自动续开，直到出现第一笔许愿，才以该时刻为起点开新局（180s）
// atSec 显式传入（秒），便于虚拟时钟测试与回放
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin } from './money.js';
import { planSettlement } from './engine-settle.js';

const nowSec = () => Math.floor(Date.now() / 1000);

export class GameService {
  constructor(store, cfg, insuranceService) {
    this.store = store;
    this.cfg = cfg;
    this.insurance = insuranceService;
  }

  async register(wallet, inviterUid = null, atSec = 0) {
    if (inviterUid) await this.store.getUser(inviterUid); // 邀请人必须存在
    return await this.store.createUser({ wallet, inviterUid, createdAt: atSec });
  }

  async bet(uid, side, amountCoin, pick, atSec = nowSec()) {
    const cfg = this.cfg, s = this.store;
    if (side !== 'red' && side !== 'green') throw new GameError(Codes.BAD_INPUT, '只能选红愿池或绿愿池');
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, '许愿金必须是正整数（枚）');
    const amount = coin(amountCoin);
    if (amount < cfg.betMin || amount > cfg.betMax) throw new GameError(Codes.BAD_INPUT, '单笔许愿金为 1-99 枚');
    if (!Number.isInteger(pick) || pick < cfg.pickMin || pick > cfg.pickMax) throw new GameError(Codes.BAD_INPUT, '请选择 0-9 的整数');
    await s.getUser(uid);

    return await s.transaction(async () => {
      let round = await s.findOpenRound();
      if (!round) {
        // 首笔许愿才开局：以本笔时刻为 start，满 180s
        const start = atSec;
        round = {
          roundId: await s.nextId('round', 'R'),
          startAt: start, lockAt: start + cfg.lockAfterSec, settleAt: start + cfg.settleAfterSec,
          state: 'active', redTotal: 0n, greenTotal: 0n, sumPick: 0, result: null,
        };
        await s.insertRound(round);
      }
      if (atSec >= round.lockAt) {
        await s.updateRound(round.roundId, { state: 'locked' });
        throw new GameError(Codes.ROUND_LOCKED, '本局已停止许愿，请等下一局');
      }
      const a = await s.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
      await s.applyAccount(uid, { avail: -amount, frozen: amount });
      await s.insertBet({
        betId: await s.nextId('bet', 'BT'), roundId: round.roundId, uid, side, amount, pick, atSec,
        winCredit: 0n, insCut: 0n, settled: false,
      });
      await s.updateRound(round.roundId, {
        redTotal: round.redTotal + (side === 'red' ? amount : 0n),
        greenTotal: round.greenTotal + (side === 'green' ? amount : 0n),
        sumPick: round.sumPick + pick,
      });
      await s.addFlow(uid, 'BET_FROZEN', amount, { roundId: round.roundId, side });
      return { roundId: round.roundId, lockAt: round.lockAt, settleAt: round.settleAt };
    }, 'bet');
  }

  async settle(atSec) {
    const s = this.store, cfg = this.cfg;
    const round = await s.findOpenRound();
    if (!round) throw new GameError(Codes.NOT_FOUND, '没有进行中的局');
    if (atSec < round.settleAt) throw new GameError(Codes.ROUND_NOT_SETTLABLE, '未到开奖时间');
    const bets = await s.listBetsByRound(round.roundId);

    const insActiveByUid = new Map();
    const inviters = new Set();
    for (const b of bets) {
      const u = await s.getUser(b.uid);
      insActiveByUid.set(b.uid, { insActive: await this.insurance.isActive(b.uid), inviterUid: u.inviterUid });
      if (u.inviterUid) inviters.add(u.inviterUid);
    }
    const nodeCntByInviter = new Map();
    for (const iv of inviters) nodeCntByInviter.set(iv, await this.insurance.countDistinctNodeInvitees(iv));
    const plan = planSettlement(bets, { insActiveByUid, nodeInviteeCountByUid: nodeCntByInviter }, cfg);

    return await s.transaction(async () => {
      if (plan.status === 'cancelled') {
        for (const [uid, refund] of plan.refunds) {
          await s.applyAccount(uid, { avail: refund, frozen: -refund });
          await s.addFlow(uid, 'CANCEL_REFUND', refund, { roundId: round.roundId });
        }
        await s.updateRound(round.roundId, { state: 'cancelled', result: { status: 'cancelled' } });
        return { roundId: round.roundId, state: 'cancelled' };
      }

      const t = plan.totals;
      await s.applyLedger({ ins: t.feeIns + t.dust, plat: t.feePlat }); // 抽水拆分 + 分奖尾差

      for (const row of plan.users) {
        await s.applyAccount(row.uid, { frozen: -row.totalStake, avail: row.winCredit });
        if (row.insCut > 0n) {
          await s.applyLedger({ ins: row.insCut });
          await s.addFlow(row.uid, 'INS_WIN_CUT', row.insCut, { roundId: round.roundId });
        }
        if (row.winCredit > 0n) await s.addFlow(row.uid, 'WIN_CREDIT', row.winCredit, { roundId: round.roundId });
        const meta = insActiveByUid.get(row.uid);
        if (meta.insActive && row.loseStake > 0n) {
          await this.insurance.accrueLossInternal(row.uid, row.loseStake, atSec);
        }
      }

      let referralTotal = 0n;
      for (const r of plan.referral) {
        if (r.reward <= 0n) continue;
        await s.applyLedger({ plat: -r.reward });
        await s.applyAccount(r.inviterUid, { avail: r.reward });
        await s.addReferralLog({ roundId: round.roundId, ...r, atSec });
        await s.addFlow(r.inviterUid, 'REFERRAL', r.reward, { roundId: round.roundId, fromUid: r.fromUid });
        referralTotal += r.reward;
      }

      await s.updateRound(round.roundId, {
        redTotal: t.redTotal, greenTotal: t.greenTotal, sumPick: t.sumPick, state: 'settled',
        result: { status: 'settled', winSide: t.winSide, total: t.total, fee: t.fee, feeIns: t.feeIns, feePlat: t.feePlat, pot: t.pot, dust: t.dust, referralTotal },
      });
      await s.markBetsSettled(round.roundId);
      return { roundId: round.roundId, state: 'settled', ...t, referralTotal };
    }, 'settle');
  }

  /** 当前局；没有进行中的局时返回 null（等待第一笔许愿才开新局） */
  async currentRound() {
    const r = await this.store.findOpenRound();
    if (!r) return null;
    r.betCount = await this.store.countBetsOfRound(r.roundId);
    if (r.state === 'active' || r.state === 'locked') {
      // 过程只公开匿名笔数，不公开任何人的投入与选号
      return { roundId: r.roundId, startAt: r.startAt, lockAt: r.lockAt, settleAt: r.settleAt, state: r.state, betCount: r.betCount, redTotal: null, greenTotal: null, sumPick: null, result: null };
    }
    return r;
  }
  async roundDetail(roundId) {
    const r = await this.store.getRound(roundId);
    if (!r) throw new GameError(Codes.NOT_FOUND, '局不存在');
    if (r.state === 'active' || r.state === 'locked') return { ...r, note: '未开奖，暂不公开明细' };
    const bets = await this.store.listBetsByRound(roundId);
    return { ...r, bets: bets.map((b) => ({ uid: b.uid, side: b.side, amount: b.amount, pick: b.pick })) };
  }
  async recentRounds(limit = 100) { return await this.store.listRecentRounds(limit); }
}
