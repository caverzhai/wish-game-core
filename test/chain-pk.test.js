// =============================================================
// chain-pk.test.js —— 代付私钥格式校验（占位符不得被当成可用私钥）
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainService } from '../src/ChainService.js';

const base = {
  CHAIN_ID: '56', RPC_URL: 'https://rpc.example', TOKEN_CONTRACT: '0x' + 'a'.repeat(40),
  PLATFORM_WALLET_ADDRESS: '0x' + 'b'.repeat(40),
};

test('占位符 0xPAYOUT_PRIVATE_KEY 视为未正确配置：canPayout=false', () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0xPAYOUT_PRIVATE_KEY' });
  assert.equal(c.enabled, true);
  assert.equal(c.pkValid, false);
  assert.equal(c.canPayout, false, '占位符不得允许代付');
});

test('合法 0x+64位私钥才允许代付', () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0x' + '1'.repeat(64) });
  assert.equal(c.pkValid, true);
  assert.equal(c.canPayout, true);
});

test('私钥非法时 payout 抛广播前错误(broadcast=false)，上层据此原路退款、不卡单', async () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0xPAYOUT_PRIVATE_KEY' });
  let e = null;
  try { await c.payout('0x' + 'c'.repeat(40), 1_000_000n); } catch (err) { e = err; }
  assert.ok(e, '必须抛错');
  assert.equal(e.broadcast, false, '钱没出=广播前错误，必须可安全退款');
  assert.match(e.message, /私鑰|私钥/);
});
