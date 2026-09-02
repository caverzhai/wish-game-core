// =============================================================
// WalletService.js - issuance (deposit credit) / withdrawal / on-chain result writeback (async)
// Withdrawal: 2-500 units/tx, fixed 1 unit fee to platform
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin } from './money.js';

// A pending withdraw without txhash is treated stale ONLY after this many ms (> payout worst case 15s+25s)
export const STALE_WITHDRAW_MS = 120000;

export class WalletService {
  constructor(store, cfg) { this.store = store; this.cfg = cfg; }

  async issue(uid, amountCoin, note = 'ISSUE') {
    if (!Number.isInteger(amountCoin) || amountCoin <= 0) throw new GameError(Codes.BAD_INPUT, 'Issuance amount must be a positive integer (units)');
    const amount = coin(amountCoin);
    return await this.store.transaction(async () => {
      await this.store.getUser(uid);
      const a = await this.store.applyAccount(uid, { avail: amount });
      await this.store.applyLedger({ issued: amount });
      await this.store.addFlow(uid, note, amount);
      return a.available;
    }, 'issue');
  }

  /** Credit by in-site min unit (6-decimal BigInt), allows non-integer units (for on-chain delta, precise zeroing) */
  async issueInner(uid, inner, note = 'CHAIN_DEPOSIT') {
    const amount = BigInt(inner);
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, 'Credit amount must be positive');
    return await this.store.transaction(async () => {
      await this.store.getUser(uid);
      const a = await this.store.applyAccount(uid, { avail: amount });
      await this.store.applyLedger({ issued: amount });
      await this.store.addFlow(uid, note, amount);
      return a.available;
    }, 'issueInner');
  }

  async withdraw(uid, amountCoin, toWallet) {
    const cfg = this.cfg, s = this.store;
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, 'Withdrawal amount must be an integer (units)');
    const amount = coin(amountCoin);
    if (amount < cfg.withdrawMin || amount > cfg.withdrawMax) throw new GameError(Codes.WITHDRAW_RANGE, 'Withdrawal 2-500 units per tx');
    return await s.transaction(async () => {
      const u = await s.getUser(uid);
      const a = await s.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, 'Insufficient available balance');
      const fee = cfg.withdrawFee, arrive = amount - fee;
      await s.applyAccount(uid, { avail: -amount });
      await s.applyLedger({ plat: fee, pending: arrive });
      const wd = {
        withdrawId: await s.nextId('withdraw', 'W'), uid, amount, fee, arrive,
        toWallet: toWallet ?? u.wallet, state: 'pending', txhash: null, at: Date.now(),
      };
      await s.insertWithdraw(wd);
      await s.addFlow(uid, 'WITHDRAW_FEE', fee, { withdrawId: wd.withdrawId });
      await s.addFlow(uid, 'WITHDRAW_PENDING', arrive, { withdrawId: wd.withdrawId });
      return wd;
    }, 'withdraw');
  }

  async confirmWithdraw(withdrawId, txhash) {
    const s = this.store;
    return await s.transaction(async () => {
      const wd = await s.findWithdraw(withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, 'Withdrawal order not found');
      if (wd.state !== 'pending') return wd; // confirmed or other terminal state: idempotent return, never double-post, no error
      await s.applyLedger({ pending: -wd.arrive, withdrawn: wd.arrive });
      await s.updateWithdraw(withdrawId, { state: 'paid', txhash: txhash ?? null });
      await s.addFlow(wd.uid, 'WITHDRAW_PAID', wd.arrive, { withdrawId, txhash });
      return await s.findWithdraw(withdrawId);
    }, 'confirmWithdraw');
  }

  /** Self-heal: refund all stuck pending orders of this user that failed to broadcast (no hash) back to available balance */
  async reapUnbroadcast(uid) {
    const stale = await this.store.listStalePending(uid, STALE_WITHDRAW_MS);
    const out = [];
    for (const wd of stale) {
      try { out.push(await this.failWithdraw(wd.withdrawId)); }
      catch { /* single self-heal error does not block other orders, nor this withdrawal */ }
    }
    return out;
  }

  /** Reconcile: mark broadcast (has hash) but still pending orders as paid (money was sent, receipt delay should not keep it pending forever) */
  async reconcileBroadcasted(uid) {
    const out = [];
    for (const wd of await this.store.listBroadcastedPending(uid)) {
      try { out.push(await this.confirmWithdraw(wd.withdrawId, wd.txhash)); }
      catch { /* single error does not block */ }
    }
    return out;
  }

  async failWithdraw(withdrawId) {
    const s = this.store;
    return await s.transaction(async () => {
      const wd = await s.findWithdraw(withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, 'Withdrawal order not found');
      // idempotent and never interrupt user with state errors: only pending orders get refunded; failed/paid/other terminal states return directly
      if (wd.state !== 'pending') return wd;
      await s.applyLedger({ pending: -wd.arrive, plat: -wd.fee });
      await s.applyAccount(wd.uid, { avail: wd.amount });
      await s.updateWithdraw(withdrawId, { state: 'failed' });
      await s.addFlow(wd.uid, 'WITHDRAW_REFUND', wd.amount, { withdrawId });
      return await s.findWithdraw(withdrawId);
    }, 'failWithdraw');
  }
}
