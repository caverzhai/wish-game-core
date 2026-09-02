// =============================================================
// chain-pk.test.js - payout private key format validation (placeholder must not be treated as usable key)
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainService } from '../src/ChainService.js';

const base = {
  CHAIN_ID: '56', RPC_URL: 'https://rpc.example', TOKEN_CONTRACT: '0x' + 'a'.repeat(40),
  PLATFORM_WALLET_ADDRESS: '0x' + 'b'.repeat(40),
};

test('Placeholder 0xPAYOUT_PRIVATE_KEY treated as unconfigured: canPayout=false', () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0xPAYOUT_PRIVATE_KEY' });
  assert.equal(c.enabled, true);
  assert.equal(c.pkValid, false);
  assert.equal(c.canPayout, false, 'placeholder must not allow payout');
});

test('Valid 0x+64 hex key allows payout', () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0x' + '1'.repeat(64) });
  assert.equal(c.pkValid, true);
  assert.equal(c.canPayout, true);
});

test('Invalid key payout throws pre-broadcast error (broadcast=false), caller refunds accordingly, no stuck order', async () => {
  const c = new ChainService({ ...base, PAYOUT_PRIVATE_KEY: '0xPAYOUT_PRIVATE_KEY' });
  let e = null;
  try { await c.payout('0x' + 'c'.repeat(40), 1_000_000n); } catch (err) { e = err; }
  assert.ok(e, 'must throw');
  assert.equal(e.broadcast, false, 'money not sent = pre-broadcast error, must be safely refundable');
  assert.match(e.message, /private key/i);
});
