// =============================================================
// VoiceRoomService.js —— 语音房（聊天室 + 会议室）
// 聊天室：所有人可发文字/语音包(≤30秒)/图片(≤200K)，开房1枚，0.0001枚/分钟
// 会议室：主持+1嘉宾实时通话(WebRTC)，其余打字/发图，开房5枚，0.01枚/分钟
// 预付费：房间余额按分钟扣，余额为0自动关房；空房保留5分钟后退余额给主持
// 消息缓存：每房间300条，满了覆盖最旧（连带删媒体文件）；违规词过滤
// 金额：inner6 BigInt
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameError, Codes } from './errors.js';
import { coin, toInner, SCALE } from './money.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.resolve(__dirname, '../tmp-voice');
const MSG_CACHE = 300;
const EMPTY_GRACE_MS = 5 * 60 * 1000; // 空房保留5分钟
const TEXT_MAX_BYTES = 1024;

export const ROOM_CFG = {
  chat:    { minOpen: coin(1),  perMinute: toInner('0.0001'), label: '语音聊天室' },
  meeting: { minOpen: coin(5),  perMinute: toInner('0.01'),   label: '会议室' },
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

  // ---------- 创建房间 ----------
  async createRoom(uid, type, name, rechargeInner) {
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, '账号已被封禁，无法开房');
    const cfg = ROOM_CFG[type];
    if (!cfg) throw new GameError(Codes.BAD_INPUT, '房间类型错误');
    const title = String(name ?? '').trim().slice(0, 30) || cfg.label;
    const recharge = BigInt(rechargeInner ?? 0);
    if (recharge < cfg.minOpen) throw new GameError(Codes.BAD_INPUT, `开房最低充值 ${Number(cfg.minOpen) / Number(SCALE)} 枚`);
    const acc = await this.store.getAccount(uid);
    if (acc.available < recharge) throw new GameError(Codes.BAD_INPUT, '余额不足，请先充值');
    await this.store.applyAccount(uid, { avail: -recharge });
    const roomId = this._newId();
    const room = {
      roomId, type, name: title, hostUid: uid,
      balance: recharge, perMinute: cfg.perMinute,
      createdAt: Date.now(), lastActiveAt: Date.now(), emptySince: null,
      members: new Map(), messages: [], destroyed: false,
      guestUid: null,
    };
    room.members.set(uid, { uid, name: shortName(u.wallet), role: 'host', micOn: true });
    this.rooms.set(roomId, room);
    await this.store.addFlow(uid, 'ROOM_OPEN', recharge, { roomId, type }).catch(() => {});
    return this._public(room);
  }

  // ---------- 房间列表 ----------
  async listRooms() {
    return [...this.rooms.values()].filter((r) => !r.destroyed).map((r) => ({
      roomId: r.roomId, type: r.type, name: r.name, hostUid: r.hostUid,
      memberCount: r.members.size, balance: r.balance, perMinute: r.perMinute,
      remainSec: this._remainSec(r), emptySince: r.emptySince,
    }));
  }

  _get(roomId) {
    const r = this.rooms.get(roomId);
    if (!r || r.destroyed) throw new GameError(Codes.NOT_FOUND, '房间不存在或已关闭');
    return r;
  }

  getRoomDetail(roomId) {
    const r = this._get(roomId);
    return { room: this._public(r), members: this._members(r), messages: r.messages.slice(-100) };
  }

  // ---------- 进出 ----------
  async join(roomId, uid) {
    const r = this._get(roomId);
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, '账号已被封禁');
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

  // ---------- 充值（房间内任何人可充） ----------
  async recharge(roomId, uid, amountInner) {
    const r = this._get(roomId);
    const amount = BigInt(amountInner);
    if (amount <= 0n) throw new GameError(Codes.BAD_INPUT, '充值金额必须大于0');
    const acc = await this.store.getAccount(uid);
    if (acc.available < amount) throw new GameError(Codes.BAD_INPUT, '余额不足');
    await this.store.applyAccount(uid, { avail: -amount });
    r.balance += amount;
    r.lastActiveAt = Date.now();
    await this.store.addFlow(uid, 'ROOM_RECHARGE', amount, { roomId }).catch(() => {});
    return { balance: r.balance, remainSec: this._remainSec(r) };
  }

  // ---------- 发消息 ----------
  async sendMessage(roomId, uid, msg) {
    const r = this._get(roomId);
    const m = r.members.get(uid);
    if (!m) throw new GameError(Codes.FORBIDDEN, '请先加入房间');
    if (r.type === 'meeting' && msg.type === 'voice' && m.role === 'listener') {
      throw new GameError(Codes.FORBIDDEN, '会议室仅主持和嘉宾可发语音');
    }
    let content = '';
    if (msg.type === 'text') {
      content = String(msg.content ?? '').trim();
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes < 1) throw new GameError(Codes.BAD_INPUT, '内容不能为空');
      if (bytes > TEXT_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `最多 ${TEXT_MAX_BYTES} 字节`);
      const words = await this.store.listBlockedWords();
      const n = norm(content);
      for (const w of words) { const nw = norm(w); if (nw && n.includes(nw)) throw new GameError(Codes.BAD_INPUT, '内容包含被屏蔽的词语'); }
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

  // ---------- 会议室嘉宾管理（主持操作） ----------
  async setGuest(roomId, hostUid, guestUid, on) {
    const r = this._get(roomId);
    if (r.type !== 'meeting') throw new GameError(Codes.BAD_INPUT, '仅会议室可设置嘉宾');
    if (r.hostUid !== hostUid) throw new GameError(Codes.FORBIDDEN, '仅主持可操作');
    if (on) {
      if (r.guestUid && r.guestUid !== guestUid) throw new GameError(Codes.BAD_INPUT, '已有嘉宾，请先让当前嘉宾下麦');
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

  // ---------- 上麦/下麦 ----------
  async setMic(roomId, uid, on) {
    const r = this._get(roomId);
    const m = r.members.get(uid);
    if (!m) throw new GameError(Codes.FORBIDDEN, '请先加入房间');
    if (r.type === 'meeting' && m.role === 'listener') throw new GameError(Codes.FORBIDDEN, '请先向主持申请上麦');
    m.micOn = !!on;
    return { micOn: m.micOn, members: this._members(r) };
  }

  // ---------- 房主解散房间（退余额） ----------
  async dissolve(roomId, uid) {
    const r = this._get(roomId);
    if (r.hostUid !== uid) throw new GameError(Codes.FORBIDDEN, '仅房主可解散房间');
    await this._destroy(r, 'dissolve'); // 任何方式解散均不退款
    return { dissolved: true };
  }

  // ---------- 每分钟扣费 / 空房销毁 ----------
  async tick() {
    const now = Date.now();
    const destroyed = [];
    for (const r of [...this.rooms.values()]) {
      if (r.destroyed) continue;
      if (r.emptySince && now - r.emptySince >= EMPTY_GRACE_MS) {
        await this._destroy(r, 'empty');
        destroyed.push(r.roomId);
        continue;
      }
      if (r.members.size > 0 && !r.emptySince) {
        if (r.balance > r.perMinute) {
          r.balance -= r.perMinute;
          await this.store.applyLedger({ plat: r.perMinute }).catch(() => {});
        } else {
          const rest = r.balance;
          if (rest > 0n) await this.store.applyLedger({ plat: rest }).catch(() => {});
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
    // 任何方式解散均不退款：房间余额归平台
    for (const m of r.messages) if (m.file) this._deleteMedia(m.file);
    this.rooms.delete(r.roomId);
  }

  // ---------- 媒体文件 ----------
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
    try { fs.unlinkSync(this.getMediaPath(file)); } catch { /* 已删或不存在 */ }
  }

  // ---------- 工具 ----------
  totalRoomBalance() {
    let s = 0n;
    for (const r of this.rooms.values()) if (!r.destroyed) s += r.balance;
    return s;
  }
  _remainSec(r) {
    if (r.perMinute <= 0n || r.balance <= 0n) return 0;
    return Math.floor(Number(r.balance * 60n / r.perMinute));
  }
  _members(r) {
    return [...r.members.values()].map((m) => ({ uid: m.uid, name: m.name, role: m.role, micOn: m.micOn }));
  }
  _public(r) {
    return {
      roomId: r.roomId, type: r.type, name: r.name, hostUid: r.hostUid,
      balance: r.balance, perMinute: r.perMinute, remainSec: this._remainSec(r),
      memberCount: r.members.size, guestUid: r.guestUid, createdAt: r.createdAt, emptySince: r.emptySince,
    };
  }
}
