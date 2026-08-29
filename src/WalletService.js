// =============================================================
// WalletService.js —— 发放(充值入账) / 提现 / 链上提币结果回写
// 提现：用户主动发起，单笔 2-500 枚，固定 1 枚手续费归平台（不进保险池）
// =============================================================
import { GameError, Codes } from './errors.js';
import { coin } from './money.js';

export class WalletService {
  constructor(store, cfg) {
    this.store = store;
    this.cfg = cfg;
  }

  /** 管理员发放 / 链上充值入账（空气币来源与项目方无关，此处只做入账与总账登记） */
  issue(uid, amountCoin, note = 'ISSUE') {
    if (!Number.isInteger(amountCoin) || amountCoin <= 0) throw new GameError(Codes.BAD_INPUT, '发放数量必须为正整数（枚）');
    const amount = coin(amountCoin);
    return this.store.transaction(() => {
      const a = this.store.account(uid);
      a.available += amount;
      this.store.ledger.issued += amount;
      this.store.addFlow(uid, note, amount);
      return a.available;
    }, 'issue');
  }

  /** 提现申请：扣减可用，手续费归平台，实到进入在途，等待链上适配层转出 */
  withdraw(uid, amountCoin, toWallet) {
    const cfg = this.cfg, s = this.store;
    if (!Number.isInteger(amountCoin)) throw new GameError(Codes.BAD_INPUT, '提现数量必须为整数（枚）');
    const amount = coin(amountCoin);
    if (amount < cfg.withdrawMin || amount > cfg.withdrawMax) {
      throw new GameError(Codes.WITHDRAW_RANGE, '每笔提现 2-500 枚');
    }
    return s.transaction(() => {
      const a = s.account(uid);
      if (a.available < amount) throw new GameError(Codes.INSUFFICIENT_BALANCE, '可用余额不足');
      const fee = cfg.withdrawFee;
      const arrive = amount - fee;
      a.available -= amount;
      s.ledger.platform += fee;            // 1 枚手续费归平台
      s.ledger.pendingWithdraw += arrive;  // 实到在途，尚未出系统
      const wd = {
        withdrawId: s.nextId('withdraw', 'W'), uid, amount, fee, arrive,
        toWallet: toWallet ?? this.store.getUser(uid).wallet,
        state: 'pending', txhash: null,
      };
      s.withdraws.push(wd);
      s.addFlow(uid, 'WITHDRAW_FEE', fee, { withdrawId: wd.withdrawId });
      s.addFlow(uid, 'WITHDRAW_PENDING', arrive, { withdrawId: wd.withdrawId });
      return wd;
    }, 'withdraw');
  }

  /** 链上适配层：提币已上链成功 -> 在途出系统 */
  confirmWithdraw(withdrawId, txhash) {
    const s = this.store;
    return s.transaction(() => {
      const wd = s.withdraws.find((w) => w.withdrawId === withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, '提现单不存在');
      if (wd.state !== 'pending') throw new GameError(Codes.BAD_INPUT, '提现单状态不允许确认');
      s.ledger.pendingWithdraw -= wd.arrive;
      s.ledger.withdrawn += wd.arrive;
      wd.state = 'paid';
      wd.txhash = txhash ?? null;
      s.addFlow(wd.uid, 'WITHDRAW_PAID', wd.arrive, { withdrawId, txhash: wd.txhash });
      return wd;
    }, 'confirmWithdraw');
  }

  /** 链上转出失败 -> 本金与手续费全额退回可用余额 */
  failWithdraw(withdrawId) {
    const s = this.store;
    return s.transaction(() => {
      const wd = s.withdraws.find((w) => w.withdrawId === withdrawId);
      if (!wd) throw new GameError(Codes.NOT_FOUND, '提现单不存在');
      if (wd.state !== 'pending') throw new GameError(Codes.BAD_INPUT, '提现单状态不允许失败回退');
      s.ledger.pendingWithdraw -= wd.arrive;
      s.ledger.platform -= wd.fee;
      s.account(wd.uid).available += wd.amount;
      wd.state = 'failed';
      s.addFlow(wd.uid, 'WITHDRAW_REFUND', wd.amount, { withdrawId });
      return wd;
    }, 'failWithdraw');
  }
}
