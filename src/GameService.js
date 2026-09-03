// =============================================================
// GameService.js - round main service: register / bet / lock / settle / history (all async)
// Round start rule: no auto-restart after settlement, new round starts only on first bet at that moment (180s)
// atSec passed explicitly (seconds), for virtual clock testing and replay
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
    if (inviterUid) await this.store.getUser(inviterUid); // inviter must exist
    return await this.store.createUser({ wallet, inviterUid, createdAt: atSec });
  }

  async bet(uid, side, amountCoin, pick, atSec = nowSec()) {
    const cfg = this.cfg, s = this.store;
    if (side !== 'red' && side !== 'green') throw new GameError(Codes.BAD_INPUT, 'Must choose red or green wish pool');
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, 'Bet amount must be a positive integer (units)');
    const amount = coin(amountCoin);
    if (amount < cfg.betMin || amount > cfg.betMax) throw new GameError(Codes.BAD_INPUT, 'Single bet 1-99 units');
    if (!Number.isInteger(pick) || pick < cfg.pickMin || pick > cfg.pickMax) throw new GameError(Codes.BAD_INPUT, 'Please pick an integer 0-9');
    await s.getUser(uid);

    return await s.transaction(async () => {
      let round = await s.findOpenRound();
      if (!round) {
        // First bet starts round: start = this moment, settle at 180s
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
        throw new GameError(Codes.ROUND_LOCKED, 'Betting locked for this round, please wait for next round');
      }
      const a = await s.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, 'Insufficient available balance');
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
    if (!round) throw new GameError(Codes.NOT_FOUND, 'No active round');
    if (atSec < round.settleAt) throw new GameError(Codes.ROUND_NOT_SETTLABLE, 'Not yet settlement time');
    const bets = await s.listBetsByRound(round.roundId);

    const insActiveByUid = new Map();
    const inviterByUid = new Map();
    const whitelistByUid = new Map();
    const visited = new Set();
    // Load full invite chain for every bettor: inviterByUid + whitelistByUid (multi-level commission)
    const loadChain = async (uid) => {
      if (visited.has(uid)) return;
      visited.add(uid);
      const u = await s.getUser(uid);
      inviterByUid.set(uid, u.inviterUid);
      const rate = await s.getWhitelistRate(u.wallet);
      if (rate !== null) whitelistByUid.set(uid, BigInt(rate));
      if (u.inviterUid) await loadChain(u.inviterUid);
    };
    for (const b of bets) {
      insActiveByUid.set(b.uid, { insActive: await this.insurance.isActive(b.uid) });
      await loadChain(b.uid);
    }
    const plan = planSettlement(bets, { insActiveByUid, inviterByUid, whitelistByUid }, cfg);

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
      await s.applyLedger({ ins: t.feeIns + t.dust, plat: t.feePlat }); // fee split + payout remainder

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

  /** Current round; null when no active round (waits for first bet to start) */
  async currentRound() {
    const r = await this.store.findOpenRound();
    if (!r) return null;
    r.betCount = await this.store.countBetsOfRound(r.roundId);
    if (r.state === 'active' || r.state === 'locked') {
      // During round only anonymous bet count is public, no individual stakes or picks
      return { roundId: r.roundId, startAt: r.startAt, lockAt: r.lockAt, settleAt: r.settleAt, state: r.state, betCount: r.betCount, redTotal: null, greenTotal: null, sumPick: null, result: null };
    }
    return r;
  }
  async roundDetail(roundId) {
    const r = await this.store.getRound(roundId);
    if (!r) throw new GameError(Codes.NOT_FOUND, 'Round not found');
    if (r.state === 'active' || r.state === 'locked') return { ...r, note: 'Not settled, details not public yet' };
    const bets = await this.store.listBetsByRound(roundId);
    return { ...r, bets: bets.map((b) => ({ uid: b.uid, side: b.side, amount: b.amount, pick: b.pick })) };
  }
  async recentRounds(limit = 100) { return await this.store.listRecentRounds(limit); }
}
