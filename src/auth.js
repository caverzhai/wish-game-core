// =============================================================
// auth.js - Wallet signature authentication (EIP-4361 style) + JWT
// No external dependencies: uses node:crypto for HMAC-SHA256 JWT and ethers for signature verification
// =============================================================
import crypto from 'node:crypto';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_SEC = 7 * 24 * 60 * 60; // 7 days
const NONCE_TTL_SEC = 300; // 5 minutes

// In-memory nonce store: { nonce: { wallet, createdAt } }
// For production with multiple instances, move to Redis/DB
const nonces = new Map();

// Clean expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of nonces) {
    if (now - data.createdAt > NONCE_TTL_SEC * 1000) nonces.delete(nonce);
  }
}, 60000).unref();

export function generateNonce(wallet) {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.set(nonce, { wallet: wallet.toLowerCase(), createdAt: Date.now() });
  return nonce;
}

export function consumeNonce(nonce, wallet) {
  const data = nonces.get(nonce);
  if (!data) return false;
  if (data.wallet !== wallet.toLowerCase()) return false;
  if (Date.now() - data.createdAt > NONCE_TTL_SEC * 1000) {
    nonces.delete(nonce);
    return false;
  }
  nonces.delete(nonce);
  return true;
}

// Build EIP-4361 style message for signing
export function buildSignMessage(wallet, nonce, domain = 'wishtree.app') {
  const issuedAt = new Date().toISOString();
  return `${domain} wants you to sign in with your Ethereum account:
${wallet}

Sign in to Wish Pool. This signature proves you own this wallet address.

URI: https://${domain}
Version: 1
Chain ID: 56
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

// Verify signature returns the recovered address or null
export function verifySignature(message, signature) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase();
  } catch {
    return null;
  }
}

// --- Minimal JWT implementation (HS256) ---
function base64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

export function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + JWT_EXPIRES_SEC };
  const h = base64urlEncode(JSON.stringify(header));
  const p = base64urlEncode(JSON.stringify(fullPayload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest();
  return `${h}.${p}.${base64urlEncode(sig)}`;
}

export function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest();
    const actual = base64urlDecode(sig);
    if (!crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(base64urlDecode(p).toString());
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Extract token from Authorization header or query string
export function extractToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  // WebSocket upgrade may pass token via query
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('token') || null;
}
