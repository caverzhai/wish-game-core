// =============================================================
// ChainService.js —— 链上适配层（只认后台配置的唯一代币合约）
// 配置全部来自环境变量（私钥仅存在于后端，绝不下发前端）：
//   CHAIN_ID / RPC_URL / TOKEN_CONTRACT（唯一认可的币）
//   PLATFORM_WALLET_ADDRESS（平台收款钱包）/ PAYOUT_PRIVATE_KEY（提现代付私钥）
//   TOKEN_DECIMALS(默认18) / CONFIRM_BLOCKS(默认1)
// 未配置时 enabled=false，全站自动回退「站内余额」模式，不影响运行。
// 站内金额为 6 位定点（枚），链上代币多为 18 位，1 枚 = 1 个整币（内部相差 10^(dec-6)）。
// =============================================================
import { GameError, Codes } from './errors.js';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export class ChainService {
  constructor(env = process.env) {
    this.chainId = env.CHAIN_ID ? Number(env.CHAIN_ID) : null;
    this.rpc = env.RPC_URL || '';
    this.token = (env.TOKEN_CONTRACT || '').trim();
    this.platform = (env.PLATFORM_WALLET_ADDRESS || env.PLATFORM_ADDRESS || '').trim();
    this.pk = env.PAYOUT_PRIVATE_KEY || '';
    this.decimals = Number(env.TOKEN_DECIMALS || 18);
    this.needConfirm = Number(env.CONFIRM_BLOCKS ?? 1);
    this._provider = null;
    this._usedTx = new Set(); // 单实例内交易哈希防重；生产应在 DB 对 tx_hash 加唯一索引
  }

  get enabled() { return !!(this.rpc && this.token && this.platform); }
  get canPayout() { return this.enabled && !!this.pk; }
  /** 可下发给前端的公开配置（绝不含私钥） */
  publicConfig() {
    return { enabled: this.enabled, canPayout: this.canPayout, chainId: this.chainId, tokenContract: this.token, platformAddress: this.platform, decimals: this.decimals };
  }

  async _ethers() {
    try { return await import('ethers'); }
    catch { throw new GameError(Codes.BAD_INPUT, '链上依赖 ethers 未安装（npm i ethers）'); }
  }
  async _provider() {
    if (!this.enabled) throw new GameError(Codes.BAD_INPUT, '尚未配置链参数（RPC_URL / TOKEN_CONTRACT / PLATFORM_WALLET_ADDRESS）');
    if (!this._provider) {
      const { JsonRpcProvider } = await this._ethers();
      this._provider = new JsonRpcProvider(this.rpc);
    }
    return this._provider;
  }

  _diff() { const d = this.decimals - 6; if (d < 0) throw new GameError(Codes.BAD_INPUT, '代币精度不能小于站内 6 位'); return BigInt(d); }
  /** 站内 6 位金额 -> 链上最小单位 */
  toChain(inner) { return BigInt(inner) * (10n ** this._diff()); }
  /** 链上最小单位 -> 站内 6 位金额（整除截尾） */
  toInner(chain) { return BigInt(chain) / (10n ** this._diff()); }

  /** 核验一笔「用户 -> 平台钱包」的代币转账，用于链上直接下注 */
  async verifyIncoming({ txHash, fromAddress, expectInner }) {
    const key = String(txHash || '').toLowerCase();
    if (!key.startsWith('0x')) throw new GameError(Codes.BAD_INPUT, '交易哈希格式不正确');
    if (this._usedTx.has(key)) throw new GameError(Codes.BAD_INPUT, '该链上交易已使用，请勿重复提交');
    const p = await this._provider();
    const [receipt, tx] = await Promise.all([p.getTransactionReceipt(txHash), p.getTransaction(txHash)]);
    if (!receipt) throw new GameError(Codes.BAD_INPUT, '链上尚未查到该交易，请稍候再试');
    if (receipt.status !== 1) throw new GameError(Codes.BAD_INPUT, '该链上交易未成功');
    if (!tx.to || tx.to.toLowerCase() !== this.token.toLowerCase()) throw new GameError(Codes.BAD_INPUT, '交易目标不是平台指定的代币合约');
    if (fromAddress && receipt.from.toLowerCase() !== String(fromAddress).toLowerCase()) throw new GameError(Codes.BAD_INPUT, '交易发起地址与当前连接钱包不一致');

    const expectChain = this.toChain(BigInt(expectInner));
    let hit = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.token.toLowerCase()) continue;
      if (!log.topics[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = BigInt(log.data);
      if (to.toLowerCase() === this.platform.toLowerCase()) {
        if (value !== expectChain) throw new GameError(Codes.BAD_INPUT, `转账金额不符：应转 ${expectChain}，实转 ${value}`);
        hit = { from, to, value, blockNumber: receipt.blockNumber };
      }
    }
    if (!hit) throw new GameError(Codes.BAD_INPUT, '未找到转入平台钱包的代币 Transfer 记录');

    const head = await p.getBlockNumber();
    if (head - receipt.blockNumber < this.needConfirm) throw new GameError(Codes.BAD_INPUT, `仍在确认中（${head - receipt.blockNumber}/${this.needConfirm} 块），请稍后`);
    this._usedTx.add(key);
    return hit;
  }

  /** 用平台私钥代付提现（ERC20 transfer 到用户地址），返回 txHash */
  async payout(toAddress, innerAmount) {
    if (!this.canPayout) throw new GameError(Codes.BAD_INPUT, '未配置 PAYOUT_PRIVATE_KEY，无法自动代付');
    const ethers = await this._ethers();
    const p = await this._provider();
    const wallet = new ethers.Wallet(this.pk, p);
    const contract = new ethers.Contract(this.token, ERC20_ABI, wallet);
    const value = this.toChain(BigInt(innerAmount));
    const tx = await contract.transfer(toAddress, value);
    const rc = await tx.wait();
    return { txHash: tx.hash, blockNumber: rc.blockNumber };
  }
}
