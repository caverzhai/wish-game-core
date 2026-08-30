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
const SEND_TIMEOUT_MS = 15000;  // 广播交易（含 estimateGas）最长等待
const WAIT_TIMEOUT_MS = 25000;  // 已广播后等回执最长等待

/** 给链上 Promise 加硬超时，避免 RPC 无响应时 HTTP 请求被无限挂起（前端 Failed to fetch） */
function withTimeout(p, ms, msg) {
  let timer;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(timer)),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(msg)), ms); }),
  ]);
}
/** 链上失败：标记是否已广播（已广播=钱可能已出，不能自动退余额） */
function chainError(e, broadcast, txHash = null) {
  const err = new GameError(Codes.CHAIN_ERROR ?? 'CHAIN_ERROR', e?.shortMessage || e?.message || String(e));
  err.broadcast = broadcast;
  err.txHash = txHash;
  return err;
}

export class ChainService {
  constructor(env = process.env) {
    this.chainId = env.CHAIN_ID ? Number(env.CHAIN_ID) : null;
    this.rpc = env.RPC_URL || '';
    this.token = (env.TOKEN_CONTRACT || '').trim();
    this.platform = (env.PLATFORM_WALLET_ADDRESS || env.PLATFORM_ADDRESS || '').trim();
    this.pk = (env.PAYOUT_PRIVATE_KEY || '').trim();
    // 代付私钥必须是 0x+64位十六进制；占位符（如 0xPAYOUT_PRIVATE_KEY）视为未配置，避免签名期才崩
    this.pkValid = /^0x[0-9a-fA-F]{64}$/.test(this.pk);
    this.decimals = Number(env.TOKEN_DECIMALS || 18);
    this.needConfirm = Number(env.CONFIRM_BLOCKS ?? 1);
    this._providerInstance = null; // 缓存的 ethers Provider（不可与方法 _provider() 同名，否则遮蔽方法）
  }

  get enabled() { return !!(this.rpc && this.token && this.platform); }
  get canPayout() { return this.enabled && this.pkValid; } // 私钥格式合法才允许自动代付
  /** 可下发给前端的公开配置（绝不含私钥/RPC） */
  publicConfig() {
    return { enabled: this.enabled, canPayout: this.canPayout, payoutReady: this.canPayout, chainId: this.chainId, tokenContract: this.token, platformAddress: this.platform, decimals: this.decimals };
  }

  async _ethers() {
    try { return await import('ethers'); }
    catch { throw new GameError(Codes.BAD_INPUT, '链上依赖 ethers 未安装（npm i ethers）'); }
  }
  async _provider() {
    if (!this.enabled) throw new GameError(Codes.BAD_INPUT, '尚未配置链参数（RPC_URL / TOKEN_CONTRACT / PLATFORM_WALLET_ADDRESS）');
    if (!this._providerInstance) {
      const { JsonRpcProvider } = await this._ethers();
      // staticNetwork：信任固定链，跳过 ethers 每次的网络探测；requestTimeout：单次请求硬超时，防止挂死
      this._providerInstance = new JsonRpcProvider(this.rpc, undefined, { staticNetwork: true, requestTimeout: SEND_TIMEOUT_MS, pollingInterval: 3000 });
    }
    return this._providerInstance;
  }

  _diff() { const d = this.decimals - 6; if (d < 0) throw new GameError(Codes.BAD_INPUT, '代币精度不能小于站内 6 位'); return BigInt(d); }
  /** 站内 6 位金额 -> 链上最小单位 */
  toChain(inner) { return BigInt(inner) * (10n ** this._diff()); }
  /** 链上最小单位 -> 站内 6 位金额（整除截尾） */
  toInner(chain) { return BigInt(chain) / (10n ** this._diff()); }

  /**
   * 核验一笔「用户 -> 平台钱包」的代币转账。
   *  - 传 expectInner：严格比对金额（链上直接下注，要求恰好等于补差）；
   *  - 不传 expectInner：不比对金额，按链上实收金额返回（掉单补录 /wallet/credit 用）。
   * 返回 hit.inner = 实收的站内 6 位金额。去重由持久层 chain_txs 负责，本方法不做内存去重，
   * 这样下注失败后同一笔交易仍可用于补录入账，保证「钱已转出就不会丢」。
   */
  async verifyIncoming({ txHash, fromAddress, expectInner = null }) {
    const key = String(txHash || '').toLowerCase();
    if (!key.startsWith('0x')) throw new GameError(Codes.BAD_INPUT, '交易哈希格式不正确');
    const p = await this._provider();
    const [receipt, tx] = await withTimeout(
      Promise.all([p.getTransactionReceipt(txHash), p.getTransaction(txHash)]),
      SEND_TIMEOUT_MS, '链上节点无响应，请稍后再试',
    );
    if (!receipt) throw new GameError(Codes.BAD_INPUT, '链上尚未查到该交易，请稍候再试');
    if (receipt.status !== 1) throw new GameError(Codes.BAD_INPUT, '该链上交易未成功');
    if (!tx.to || tx.to.toLowerCase() !== this.token.toLowerCase()) throw new GameError(Codes.BAD_INPUT, '交易目标不是平台指定的代币合约');
    if (fromAddress && receipt.from.toLowerCase() !== String(fromAddress).toLowerCase()) throw new GameError(Codes.BAD_INPUT, '交易发起地址与当前连接钱包不一致');

    const expectChain = expectInner == null ? null : this.toChain(BigInt(expectInner));
    let hit = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.token.toLowerCase()) continue;
      if (!log.topics[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = BigInt(log.data);
      if (to.toLowerCase() === this.platform.toLowerCase()) {
        if (expectChain != null && value !== expectChain) throw new GameError(Codes.BAD_INPUT, `转账金额不符：应转 ${expectChain}，实转 ${value}`);
        hit = { from, to, value, inner: this.toInner(value), blockNumber: receipt.blockNumber };
      }
    }
    if (!hit) throw new GameError(Codes.BAD_INPUT, '未找到转入平台钱包的代币 Transfer 记录，请稍后再试');

    const head = await withTimeout(p.getBlockNumber(), SEND_TIMEOUT_MS, '链上节点无响应，请稍后再试');
    if (head - receipt.blockNumber < this.needConfirm) throw new GameError(Codes.BAD_INPUT, `仍在确认中（${head - receipt.blockNumber}/${this.needConfirm} 块），请稍后`);
    return hit;
  }

  /**
   * 用平台私钥代付提现（ERC20 transfer 到用户地址），返回 txHash。
   * 分两阶段并各自硬超时：
   *  - 广播前失败（RPC 不通 / gas 不足 / 代币不足）：钱没出，错误 broadcast=false，上层可安全退余额；
   *  - 已拿到 tx.hash 但等回执超时：钱可能已出，错误 broadcast=true，上层保留在途、不退款，靠 hash 对账。
   */
  async payout(toAddress, innerAmount, onBroadcast) {
    if (!this.enabled) throw chainError(new Error('站点未配置链参数，无法代付'), false);
    // 私钥非法（常见：把占位符 0xPAYOUT_PRIVATE_KEY 当成值填进去）：广播前直接报错，上层会原路退款，不卡单
    if (!this.pkValid) throw chainError(new Error('代付私钥未正确配置：PAYOUT_PRIVATE_KEY 必须是平台收款钱包 0x 开头共 64 位的真实私钥，当前值是占位符或格式错误，请在平台环境变量里改成真实私钥后重新部署'), false);
    const ethers = await this._ethers();
    const p = await this._provider();
    let wallet, contract, value;
    try {
      wallet = new ethers.Wallet(this.pk, p);
      contract = new ethers.Contract(this.token, ERC20_ABI, wallet);
      value = this.toChain(BigInt(innerAmount));
    } catch (e) { throw chainError(e, false); } // 签名对象构造失败=钱没出，广播前错误，必退款

    let tx;
    try {
      tx = await withTimeout(contract.transfer(toAddress, value), SEND_TIMEOUT_MS, '代付交易无法广播：节点无响应或平台钱包 BNB(gas)/代币不足');
      // 一旦广播成功，立即把哈希交给上层留痕（哪怕回执未回），避免被自愈逻辑误当未广播单重复退款
      if (onBroadcast) { try { await onBroadcast(tx.hash); } catch { /* 留痕失败不阻断主流程 */ } }
    } catch (e) { throw chainError(e, false); }

    try {
      const rc = await withTimeout(tx.wait(this.needConfirm), WAIT_TIMEOUT_MS, '交易已广播但回执超时，请到区块浏览器按哈希核对，勿重复提现');
      return { txHash: tx.hash, blockNumber: rc.blockNumber };
    } catch (e) { throw chainError(e, true, tx.hash); }
  }
}
