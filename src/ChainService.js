// =============================================================
// ChainService.js - on-chain adapter (only accepts the admin-configured token contract)
// All config from env vars (private key only on backend, never sent to frontend):
//   CHAIN_ID / RPC_URL / TOKEN_CONTRACT (the only accepted token)
//   PLATFORM_WALLET_ADDRESS (platform receiving wallet) / PAYOUT_PRIVATE_KEY (withdrawal payout key)
//   TOKEN_DECIMALS (default 18) / CONFIRM_BLOCKS (default 1)
// If unconfigured: enabled=false, site falls back to in-site balance mode, runs normally.
// In-site amount is 6-decimal fixed (units), on-chain tokens mostly 18 decimals, 1 unit = 1 whole token (internal diff 10^(dec-6)).
// =============================================================
import { GameError, Codes } from './errors.js';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
const SEND_TIMEOUT_MS = 15000;  // max wait for broadcasting tx (incl. estimateGas)
const WAIT_TIMEOUT_MS = 25000;  // max wait for receipt after broadcast

/** Hard timeout for on-chain promises, avoids HTTP hanging when RPC unresponsive (frontend 'Failed to fetch') */
function withTimeout(p, ms, msg) {
  let timer;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(timer)),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(msg)), ms); }),
  ]);
}
/** On-chain failure: flag whether already broadcast (broadcast=money may have left, cannot auto-refund) */
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
    // Payout key must be 0x+64 hex; placeholder (e.g. 0xPAYOUT_PRIVATE_KEY) treated as unconfigured, avoids crash at signing
    this.pkValid = /^0x[0-9a-fA-F]{64}$/.test(this.pk);
    this.decimals = Number(env.TOKEN_DECIMALS || 18);
    this.needConfirm = Number(env.CONFIRM_BLOCKS ?? 1);
    this._providerInstance = null; // cached ethers Provider (must not share name with _provider() method, else shadows it)
  }

  get enabled() { return !!(this.rpc && this.token && this.platform); }
  get canPayout() { return this.enabled && this.pkValid; } // auto-payout allowed only if private key format valid
  /** Public config for frontend (never includes private key/RPC) */
  publicConfig() {
    return { enabled: this.enabled, canPayout: this.canPayout, payoutReady: this.canPayout, chainId: this.chainId, tokenContract: this.token, platformAddress: this.platform, decimals: this.decimals };
  }

  async _ethers() {
    try { return await import('ethers'); }
    catch { throw new GameError(Codes.BAD_INPUT, 'On-chain dependency ethers not installed (npm i ethers)'); }
  }
  async _provider() {
    if (!this.enabled) throw new GameError(Codes.BAD_INPUT, 'Chain params not configured (RPC_URL / TOKEN_CONTRACT / PLATFORM_WALLET_ADDRESS)');
    if (!this._providerInstance) {
      const { JsonRpcProvider } = await this._ethers();
      // staticNetwork: trust fixed chain, skip ethers per-request network probing; requestTimeout: hard timeout per request
      this._providerInstance = new JsonRpcProvider(this.rpc, undefined, { staticNetwork: true, requestTimeout: SEND_TIMEOUT_MS, pollingInterval: 3000 });
    }
    return this._providerInstance;
  }

  _diff() { const d = this.decimals - 6; if (d < 0) throw new GameError(Codes.BAD_INPUT, 'Token decimals cannot be less than in-site 6'); return BigInt(d); }
  /** In-site 6-decimal amount -> on-chain min unit */
  toChain(inner) { return BigInt(inner) * (10n ** this._diff()); }
  /** On-chain min unit -> in-site 6-decimal amount (integer truncation) */
  toInner(chain) { return BigInt(chain) / (10n ** this._diff()); }

  /**
   * Verify a token transfer 'user -> platform wallet'.
   *  - with expectInner: strict amount match (direct on-chain bet, must equal top-up delta);
   *  - without expectInner: no amount match, return actual on-chain amount (for /wallet/credit missing-order recovery).
   * Returns hit.inner = actual received in-site 6-decimal amount. Dedup handled by persistence layer chain_txs, no in-memory dedup here,
   * so after a failed bet the same tx can still be credited, guaranteeing 'money sent is never lost'.
   */
  async verifyIncoming({ txHash, fromAddress, expectInner = null }) {
    const key = String(txHash || '').toLowerCase();
    if (!key.startsWith('0x')) throw new GameError(Codes.BAD_INPUT, 'Invalid transaction hash format');
    const p = await this._provider();
    const [receipt, tx] = await withTimeout(
      Promise.all([p.getTransactionReceipt(txHash), p.getTransaction(txHash)]),
      SEND_TIMEOUT_MS, 'On-chain node unresponsive, please try again later',
    );
    if (!receipt) throw new GameError(Codes.BAD_INPUT, 'Transaction not yet found on-chain, please try again later');
    if (receipt.status !== 1) throw new GameError(Codes.BAD_INPUT, 'On-chain transaction failed');
    if (!tx.to || tx.to.toLowerCase() !== this.token.toLowerCase()) throw new GameError(Codes.BAD_INPUT, 'Transaction target is not the platform-specified token contract');
    if (fromAddress && receipt.from.toLowerCase() !== String(fromAddress).toLowerCase()) throw new GameError(Codes.BAD_INPUT, 'Transaction sender address does not match current connected wallet');

    const expectChain = expectInner == null ? null : this.toChain(BigInt(expectInner));
    let hit = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.token.toLowerCase()) continue;
      if (!log.topics[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = BigInt(log.data);
      if (to.toLowerCase() === this.platform.toLowerCase()) {
        if (expectChain != null && value !== expectChain) throw new GameError(Codes.BAD_INPUT, `Transfer amount mismatch: expected  ${expectChain}, actual  ${value}`);
        hit = { from, to, value, inner: this.toInner(value), blockNumber: receipt.blockNumber };
      }
    }
    if (!hit) throw new GameError(Codes.BAD_INPUT, 'No token Transfer record to platform wallet found, please try again later');

    const head = await withTimeout(p.getBlockNumber(), SEND_TIMEOUT_MS, 'On-chain node unresponsive, please try again later');
    if (head - receipt.blockNumber < this.needConfirm) throw new GameError(Codes.BAD_INPUT, `Still confirming（${head - receipt.blockNumber}/${this.needConfirm}  blocks), please wait`);
    return hit;
  }

  /**
   * Payout withdrawal with platform private key (ERC20 transfer to user address), returns txHash.
   * Two phases with separate hard timeouts:
   *  - pre-broadcast failure (RPC down / insufficient gas / insufficient tokens): money not sent, error broadcast=false, caller can safely refund;
   *  - got tx.hash but receipt timeout: money may have left, error broadcast=true, caller keeps pending, no refund, reconcile by hash.
   */
  async payout(toAddress, innerAmount, onBroadcast) {
    if (!this.enabled) throw chainError(new Error('Site chain params not configured, cannot payout'), false);
    // Invalid key (common: placeholder 0xPAYOUT_PRIVATE_KEY filled as value): error before broadcast, caller refunds, no stuck order
    if (!this.pkValid) throw chainError(new Error('Payout private key not configured: PAYOUT_PRIVATE_KEY must be the real 0x+64 hex private key of the platform wallet; current value is a placeholder or malformed. Set the real key in platform env vars and redeploy.'), false);
    const ethers = await this._ethers();
    const p = await this._provider();
    let wallet, contract, value;
    try {
      wallet = new ethers.Wallet(this.pk, p);
      contract = new ethers.Contract(this.token, ERC20_ABI, wallet);
      value = this.toChain(BigInt(innerAmount));
    } catch (e) { throw chainError(e, false); } // signer construction failed = money not sent, pre-broadcast error, must refund

    let tx;
    try {
      tx = await withTimeout(contract.transfer(toAddress, value), SEND_TIMEOUT_MS, 'Payout tx cannot broadcast: node unresponsive or platform wallet lacks BNB(gas)/tokens');
      // Once broadcast succeeds, immediately give hash to caller for logging (even without receipt), avoids self-heal logic mistaking it as unbroadcast and double-refunding
      if (onBroadcast) { try { await onBroadcast(tx.hash); } catch { /* logging failure does not block main flow */ } }
    } catch (e) { throw chainError(e, false); }

    // Broadcast success = sent: transfer already pre-executed via estimateGas before broadcast, post-broadcast failure is extremely rare on BSC.
    // Receipt only used for non-blocking backend reconciliation, no longer blocks user request, never mislabels arrived money as 'pending'.
    tx.wait(this.needConfirm).then(() => {}).catch(() => {});
    return { txHash: tx.hash, blockNumber: null };
  }
}
