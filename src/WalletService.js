// =============================================================
// WalletService.js —— 发放(充值入账/领币) / 提现 / 链上结果回写（async）
// 提现：2-500 枚/笔，固定 1 枚手续费归平台
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin } from './money.js';

// A pending withdraw without txhash is treated stale ONLY after this many ms (> payout worst case 15s+25s)
export const STALE_WITHDRAW_MS = 120000;

export class WalletService {
  constructor(store, cfg) { this.store = store; this.cfg = cfg; }

  async issue(uid, amountCoin, note = 'ISSUE') {
    if (!Number.isInteger(amountCoin) || amountCoin <= 0) throw new GameError(Codes.BAD_INPUT, '发放数量必须为正整数（枚）');
    const amount = coin(amountCoin);
    return await this.store.transaction(async () => {
      await this.store.getUser(uid);
      const a = await this.store.applyAccount(uid, { avail: amount });
      await this.store.applyLedger({ issued: amount });
      await this.store.addFlow(uid, note, amount);
      return a.available;
    }, 'issue');
  }

  /** 按站内最小单位（6位定点 BigInt）入账，允许非整数枚（链上补差用，精确清零） */
  async issueInner(uid, inner, note = 'CHAIN_DEPOSIT') {
    const amount = BigInt(inner);
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, '入账金额必须为正');
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
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, '提现数量必须为整数（枚）');
    const amount = coin(amountCoin);
    if (amount < cfg.withdrawMin || amount > cfg.withdrawMax) throw new GameError(Codes.WITHDRAW_RANGE, '每笔提现 2-500 枚');
    return await s.transaction(async () => {
      const u = await s.getUser(uid);
      const a = await s.getAccount(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
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
      if (!wd) throw new GameError(Codes.NOT_FOUND, '提现单不存在');
      if (wd.state !== 'pending') return wd; // 已确认或其它终态：幂等返回，绝不重复记账、不抛错
      await s.applyLedger({ pending: -wd.arrive, withdrawn: wd.arrive });
      await s.updateWithdraw(withdrawId, { state: 'paid', txhash: txhash ?? null });
      await s.addFlow(wd.uid, 'WITHDRAW_PAID', wd.arrive, { withdrawId, txhash });
      return await s.findWithdraw(withdrawId);
    }, 'confirmWithdraw');
  }

  /** 自愈：把本用户「未广播成功（无哈希）」的遗留在途单全部退回可用余额 */
  async reapUnbroadcast(uid) {
    const stale = await this.store.listStalePending(uid, STALE_WITHDRAW_MS);
    const out = [];
    for (const wd of stale) {
      try { out.push(await this.failWithdraw(wd.withdrawId)); }
      catch { /* 单笔自愈异常不阻断其它单，更不阻断本次提现 */ }
    }
    return out;
  }

  /** 对账：把「已广播(有哈希)但仍 pending」的单补确认为 paid（钱已打出，回执延迟不应一直挂在途） */
  async reconcileBroadcasted(uid) {
    const out = [];
    for (const wd of await this.store.listBroadcastedPending(uid)) {
      try { out.push(await this.confirmWithdraw(wd.withdrawId, wd.txhash)); }
      catch { /* 单笔异常不阻断 */ }
    }
    return out;
  }

  async failWithdraw(withdrawId) {
    const s = this.store;
    return await s.transaction(async () => {
      const wd = await s.findWithdraw(withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, '提现单不存在');
      // 幂等且永不因状态抛错打断用户：只有 pending 才执行退款；failed/paid/其它终态一律直接返回
      if (wd.state !== 'pending') return wd;
      await s.applyLedger({ pending: -wd.arrive, plat: -wd.fee });
      await s.applyAccount(wd.uid, { avail: wd.amount });
      await s.updateWithdraw(withdrawId, { state: 'failed' });
      await s.addFlow(wd.uid, 'WITHDRAW_REFUND', wd.amount, { withdrawId });
      return await s.findWithdraw(withdrawId);
    }, 'failWithdraw');
  }
}
