// =============================================================
// VoiceRoomService.js - voice rooms (chat rooms + meeting rooms)
// Chat room: everyone can send text/voice clips (<=30s)/images (<=200K), open 1 unit, 0.0001 unit/min
// Meeting room: host+1 guest real-time call (WebRTC), others text/image, open 5 units, 0.01 unit/min
// Prepaid: room balance deducted per minute, auto-close at 0; empty room kept 5 min then balance refunded to host
// Message cache: 300 per room, oldest overwritten when full (with media file deletion); blocked word filter
// Amount: inner6 BigInt
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameError, Codes } from './errors.js';
import { coin, toInner, SCALE } from './money.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.resolve(__dirname, '../tmp-voice');
const MSG_CACHE = 300;
const EMPTY_GRACE_MS = 5 * 60 * 1000; // empty room kept 5 min
const TEXT_MAX_BYTES = 1024;

export const ROOM_CFG = {
  chat:    { minOpen: coin(1),  perMinute: toInner('0.0001'), label: 'Chat Room' },
  meeting: { minOpen: coin(5),  perMinute: toInner('0.01'),   label: 'Meeting Room' },
};

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\s\p{P}\p{S}]/gu, '');
const shortName = (w) => String(w || '').slice(0, 6) + '...' + String(w || '').slice(-4);

export class VoiceRoomService {
  constructor(store) {
    this.store = store;
    this.rooms = new Map();
    this._seq = 0;
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  _newId() { this._seq++; return 'R' + Date.now().toString(36) + this._seq.toString(36); }

  // ---------- Create room ----------
  async createRoom(uid, type, name, rechargeInner, description) {
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, 'Account banned, cannot create room');
    const cfg = ROOM_CFG[type];
    if (!cfg) throw new GameError(Codes.BAD_INPUT, 'Invalid room type');
    const title = String(name ?? '').trim().slice(0, 30) || cfg.label;
    const desc = String(description ?? '').trim().slice(0, 200);
    const recharge = BigInt(rechargeInner ?? 0);
    if (recharge < cfg.minOpen) throw new GameError(Codes.BAD_INPUT, `Minimum room open recharge ${Number(cfg.minOpen) / Number(SCALE)} units`);
    const acc = await this.store.getAccount(uid);
    if (acc.available < recharge) throw new GameError(Codes.BAD_INPUT, 'Insufficient balance, please recharge first');
    const roomId = this._newId();
    await this.store.applyAccount(uid, { avail: -recharge });
    await this.store.applyLedger({ plat: recharge }); // prepaid goes to platform, maintains ledger balance
    await this.store.addFlow(uid, 'ROOM_PAY', -recharge, { roomId, type }).catch(() => {});
    const room = {
      roomId, type, name: title, hostUid: uid,
      balance: recharge, perMinute: cfg.perMinute,
      createdAt: Date.now(), lastActiveAt: Date.now(), emptySince: null,
      members: new Map(), messages: [], destroyed: false,
      guestUid: null, description: desc,
    };
    room.members.set(uid, { uid, name: shortName(u.wallet), role: 'host', micOn: true });
    this.rooms.set(roomId, room);
    await this.store.addFlow(uid, 'ROOM_OPEN', recharge, { roomId, type }).catch(() => {});
    return this._public(room);
  }

  // ---------- Room list ----------
  async listRooms() {
    const all = [...this.rooms.values()].filter((r) => !r.destroyed);
    // Chat rooms sorted by member count descending; meetings keep creation order
    const chats = all.filter((r) => r.type === 'chat').sort((a, b) => b.members.size - a.members.size);
    const meetings = all.filter((r) => r.type === 'meeting');
    return [...chats, ...meetings].map((r) => ({
      roomId: r.roomId, type: r.type, name: r.name, hostUid: r.hostUid,
      memberCount: r.members.size, balance: r.balance, perMinute: r.perMinute,
      rateMultiplier: this._chatMultiplier(r),
      remainSec: this._remainSec(r), emptySince: r.emptySince,
    }));
  }

  // Chat room dynamic rate: doubles every 10 members (1-10=1x, 11-20=2x, 21-30=4x...)
  _chatMultiplier(r) {
    if (r.type !== 'chat') return 1;
    return 2 ** Math.floor(Math.max(0, r.members.size - 1) / 10);
  }
  _chatRate(r) {
    return r.perMinute * BigInt(this._chatMultiplier(r));
  }

  _get(roomId) {
    const r = this.rooms.get(roomId);
    if (!r || r.destroyed) throw new GameError(Codes.NOT_FOUND, 'Room not found or closed');
    return r;
  }

  getRoomDetail(roomId) {
    const r = this._get(roomId);
    return { room: this._public(r), members: this._members(r), messages: r.messages.slice(-100) };
  }

  // ---------- Join/leave ----------
  async join(roomId, uid) {
    const r = this._get(roomId);
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, 'Account banned');
    if (!r.members.has(uid)) {
      r.members.set(uid, { uid, name: shortName(u.wallet), role: 'listener', micOn: false });
    }
    r.emptySince = null;
    r.lastActiveAt = Date.now();
    return { room: this._public(r), members: this._members(r) };
  }

  async leave(roomId, uid) {
    const r = this.rooms.get(roomId);
    if (!r || r.destroyed) return { left: true };
    if (r.members.has(uid)) {
      r.members.delete(uid);
      if (r.guestUid === uid) r.guestUid = null;
    }
    if (r.members.size === 0 && !r.emptySince) r.emptySince = Date.now();
    return { left: true, memberCount: r.members.size };
  }

  // ---------- Recharge (anyone in room can recharge) ----------
  async recharge(roomId, uid, amountInner) {
    const r = this._get(roomId);
    const amount = BigInt(amountInner);
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, 'Recharge amount must be greater than 0');
    const acc = await this.store.getAccount(uid);
    if (acc.available < amount) throw new GameError(Codes.BAD_INPUT, 'Insufficient balance');
    await this.store.applyAccount(uid, { avail: -amount });
    await this.store.applyLedger({ plat: amount }); // adding time is also prepaid, goes to platform
    r.balance += amount;
    r.lastActiveAt = Date.now();
    await this.store.addFlow(uid, 'ROOM_PAY', -amount, { roomId, type: r.type, op: 'recharge' }).catch(() => {});
    return { balance: r.balance, remainSec: this._remainSec(r) };
  }

  // ---------- Send message ----------
  async sendMessage(roomId, uid, msg) {
    const r = this._get(roomId);
    const m = r.members.get(uid);
    if (!m) throw new GameError(Codes.FORBIDDEN, 'Please join the room first');
    if (r.type === 'meeting' && msg.type === 'voice' && m.role === 'listener') {
      throw new GameError(Codes.FORBIDDEN, 'Only host and guest can send voice in meeting room');
    }
    let content = '';
    if (msg.type === 'text') {
      content = String(msg.content ?? '').trim();
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes < 1) throw new GameError(Codes.BAD_INPUT, 'Content cannot be empty');
      if (bytes > TEXT_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `Max  ${TEXT_MAX_BYTES}  bytes`);
      const words = await this.store.listBlockedWords();
      const n = norm(content);
      for (const w of words) { const nw = norm(w); if (nw && n.includes(nw)) throw new GameError(Codes.BAD_INPUT, 'Content contains blocked words'); }
    }
    const msgId = 'M' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const item = {
      msgId, uid, name: m.name, role: m.role, type: msg.type,
      content, file: msg.file || '', duration: Number(msg.duration || 0), at: Date.now(),
    };
    r.messages.push(item);
    if (r.messages.length > MSG_CACHE) {
      const old = r.messages.shift();
      if (old.file) this._deleteMedia(old.file);
    }
    r.lastActiveAt = Date.now();
    return item;
  }

  // ---------- Meeting room guest management (host only) ----------
  async setGuest(roomId, hostUid, guestUid, on) {
    const r = this._get(roomId);
    if (r.type !== 'meeting') throw new GameError(Codes.BAD_INPUT, 'Only meeting rooms can set guests');
    if (r.hostUid !== hostUid) throw new GameError(Codes.FORBIDDEN, 'Only host can operate');
    if (on) {
      if (r.guestUid && r.guestUid !== guestUid) throw new GameError(Codes.BAD_INPUT, 'Already has a guest, ask current guest to leave mic first');
      r.guestUid = guestUid;
      const m = r.members.get(guestUid);
      if (m) { m.role = 'guest'; m.micOn = true; }
    } else if (r.guestUid === guestUid) {
      r.guestUid = null;
      const m = r.members.get(guestUid);
      if (m) { m.role = 'listener'; m.micOn = false; }
    }
    return { guestUid: r.guestUid, members: this._members(r) };
  }

  // ---------- Join/leave mic ----------
  async setMic(roomId, uid, on) {
    const r = this._get(roomId);
    const m = r.members.get(uid);
    if (!m) throw new GameError(Codes.FORBIDDEN, 'Please join the room first');
    if (r.type === 'meeting' && m.role === 'listener') throw new GameError(Codes.FORBIDDEN, 'Please ask host to join mic first');
    m.micOn = !!on;
    return { micOn: m.micOn, members: this._members(r) };
  }

  // ---------- Host dissolves room (refund balance) ----------
  async dissolve(roomId, uid) {
    const r = this._get(roomId);
    if (r.hostUid !== uid) throw new GameError(Codes.FORBIDDEN, 'Only host can dissolve room');
    await this._destroy(r, 'dissolve'); // no refund regardless of dissolve method
    return { dissolved: true };
  }

  // ---------- Host edits room description (200 chars) ----------
  editDescription(roomId, uid, description) {
    const r = this._get(roomId);
    if (r.hostUid !== uid) throw new GameError(Codes.FORBIDDEN, 'Only host can edit description');
    r.description = String(description ?? '').trim().slice(0, 200);
    return { description: r.description };
  }

  // ---------- Per-minute billing / empty room destruction ----------
  async tick() {
    const now = Date.now();
    const destroyed = [];
    for (const r of [...this.rooms.values()]) {
      if (r.destroyed) continue;
      // Chat rooms: stay open as long as balance > 0, even when empty (no auto-destroy on empty)
      if (r.type === 'chat') {
        const rate = this._chatRate(r);
        if (r.balance > rate) {
          r.balance -= rate;
        } else {
          r.balance = 0n;
          await this._destroy(r, 'balance');
          destroyed.push(r.roomId);
        }
        continue;
      }
      // Meeting rooms: empty 5 min grace -> destroy; balance 0 -> destroy
      if (r.emptySince && now - r.emptySince >= EMPTY_GRACE_MS) {
        await this._destroy(r, 'empty');
        destroyed.push(r.roomId);
        continue;
      }
      if (r.members.size > 0 && !r.emptySince) {
        if (r.balance > r.perMinute) {
          r.balance -= r.perMinute; // prepaid already recorded as platform revenue at room creation, only deduct virtual balance here
        } else {
          r.balance = 0n;
          await this._destroy(r, 'balance');
          destroyed.push(r.roomId);
        }
      }
    }
    return destroyed;
  }

  async _destroy(r, reason) {
    r.destroyed = true;
    // no refund regardless of dissolve method: room balance goes to platform
    for (const m of r.messages) if (m.file) this._deleteMedia(m.file);
    this.rooms.delete(r.roomId);
  }

  // ---------- Media files ----------
  saveMedia(buf, ext) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const file = id + '.' + String(ext || 'webm').replace(/[^a-z0-9]/gi, '');
    fs.writeFileSync(path.join(MEDIA_DIR, file), buf);
    return file;
  }
  getMediaPath(file) {
    const safe = String(file).replace(/[^a-zA-Z0-9.\-]/g, '');
    return path.join(MEDIA_DIR, safe);
  }
  _deleteMedia(file) {
    try { fs.unlinkSync(this.getMediaPath(file)); } catch { /* already deleted or not found */ }
  }

  // ---------- Utilities ----------
  totalRoomBalance() {
    let s = 0n;
    for (const r of this.rooms.values()) if (!r.destroyed) s += r.balance;
    return s;
  }
  _remainSec(r) {
    const rate = this._chatRate(r);
    if (rate <= 0n || r.balance <= 0n) return 0;
    return Math.floor(Number(r.balance * 60n / rate));
  }
  _members(r) {
    return [...r.members.values()].map((m) => ({ uid: m.uid, name: m.name, role: m.role, micOn: m.micOn }));
  }
  _public(r) {
    return {
      roomId: r.roomId, type: r.type, name: r.name, hostUid: r.hostUid,
      balance: r.balance, perMinute: r.perMinute, remainSec: this._remainSec(r),
      memberCount: r.members.size, guestUid: r.guestUid, createdAt: r.createdAt, emptySince: r.emptySince,
      description: r.description || '',
    };
  }
}
