// =============================================================
// WalletService.js —— 发放(充值入账/领币) / 提现 / 链上结果回写（async）
// 提现：2-500 枚/笔，固定 1 枚手续费归平台
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin } from './money.js';

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
        toWallet: toWallet ?? u.wallet, state: 'pending', txhash: null,
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
      if (wd.state !== 'pending') throw new GameError(Codes.BAD_INPUT, '提现单状态不允许确认');
      await s.applyLedger({ pending: -wd.arrive, withdrawn: wd.arrive });
      await s.updateWithdraw(withdrawId, { state: 'paid', txhash: txhash ?? null });
      await s.addFlow(wd.uid, 'WITHDRAW_PAID', wd.arrive, { withdrawId, txhash });
      return await s.findWithdraw(withdrawId);
    }, 'confirmWithdraw');
  }

  /** 自愈：把本用户「未广播成功（无哈希）」的遗留在途单全部退回可用余额 */
  async reapUnbroadcast(uid) {
    const stale = await this.store.listStalePending(uid);
    const out = [];
    for (const wd of stale) out.push(await this.failWithdraw(wd.withdrawId));
    return out;
  }

  async failWithdraw(withdrawId) {
    const s = this.store;
    return await s.transaction(async () => {
      const wd = await s.findWithdraw(withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, '提现单不存在');
      if (wd.state !== 'pending') throw new GameError(Codes.BAD_INPUT, '提现单状态不允许失败回退');
      await s.applyLedger({ pending: -wd.arrive, plat: -wd.fee });
      await s.applyAccount(wd.uid, { avail: wd.amount });
      await s.updateWithdraw(withdrawId, { state: 'failed' });
      await s.addFlow(wd.uid, 'WITHDRAW_REFUND', wd.amount, { withdrawId });
      return await s.findWithdraw(withdrawId);
    }, 'failWithdraw');
  }
}
