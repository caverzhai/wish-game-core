// =============================================================
// SocialService.js - BBS board: post / reply (plain text, <=1024 bytes per post, UTF-8)
// Sort: each thread by max(latest post time, latest reply time), newest first
// Moderation: banned accounts cannot post; content matching blocked words (normalized) rejected
// =============================================================
import { GameError, Codes } from './errors.js';
import { promises as fsp } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const POST_MAX_BYTES = 1024; // per-post limit: 1024 bytes (UTF-8, Chinese chars 3 bytes each)
export const ANNOUNCE_MAX_BYTES = 8192; // system announcement limit: 8192 bytes
const __dirname = dirname(fileURLToPath(import.meta.url));
const ANNOUNCE_FILE = join(__dirname, '..', 'data', 'announcement.json');
/** Normalize: lowercase + strip whitespace/punctuation/symbols, prevents bypassing blocked words with spaces/symbols */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\s\p{P}\p{S}]/gu, '');

export class SocialService {
  constructor(store) { this.store = store; }

  async _assertSpeaker(uid) {
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, 'Account banned, cannot post');
    return u;
  }

  async _check(text) {
    const content = String(text ?? '').trim();
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes < 1) throw new GameError(Codes.BAD_INPUT, 'Content cannot be empty');
    if (bytes > POST_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `Max  ${POST_MAX_BYTES}  bytes, current  ${bytes}  bytes`);
    const words = await this.store.listBlockedWords();
    if (words.length) {
      const n = norm(content);
      for (const w of words) { const nw = norm(w); if (nw && n.includes(nw)) throw new GameError(Codes.BAD_INPUT, 'Content contains blocked words, please edit and retry'); }
    }
    return content;
  }

  async post(uid, text) {
    const content = await this._check(text);
    await this._assertSpeaker(uid);
    const postId = await this.store.nextId('post', 'P');
    await this.store.addPost({ postId, uid, content, at: Date.now() });
    return { postId };
  }

  async reply(uid, postId, text) {
    const content = await this._check(text);
    await this._assertSpeaker(uid);
    const post = await this.store.getPost(postId);
    if (!post) throw new GameError(Codes.NOT_FOUND, 'Original post not found or deleted');
    const replyId = await this.store.nextId('reply', 'RP');
    await this.store.addReply({ replyId, postId, uid, content, at: Date.now() });
    return { replyId, postId };
  }

  /** Admin delete post (with its replies) */
  async deletePost(uid, postId) {
    const ok = await this.store.deletePost(postId);
    if (!ok) throw new GameError(Codes.NOT_FOUND, 'Post not found or deleted');
    return { postId, deleted: true };
  }

  // ---------------- System announcement (admin-published, long text not limited by BBS 1024 bytes) ----------------
  async getAnnouncement() {
    try {
      const raw = await fsp.readFile(ANNOUNCE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch { return null; }
  }
  async setAnnouncement(uid, content) {
    const text = String(content ?? '').trim();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes < 1) throw new GameError(Codes.BAD_INPUT, 'Announcement content cannot be empty');
    if (bytes > ANNOUNCE_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `Announcement max ${ANNOUNCE_MAX_BYTES} bytes, current ${bytes} bytes`);
    const u = await this.store.getUser(uid);
    const ann = { content: text, at: Date.now(), uid, wallet: u.wallet || uid };
    await fsp.mkdir(dirname(ANNOUNCE_FILE), { recursive: true });
    await fsp.writeFile(ANNOUNCE_FILE, JSON.stringify(ann, null, 2), 'utf8');
    return ann;
  }

  /** Thread list: embedded replies (time asc), threads by last active time desc */
  async list(limit = 100000) {
    const posts = await this.store.listPosts(limit);
    const repliesAll = await this.store.listRepliesAll();
    const byPost = new Map();
    for (const r of repliesAll) {
      if (!byPost.has(r.postId)) byPost.set(r.postId, []);
      byPost.get(r.postId).push(r);
    }
    const fillWallet = async (x) => {
      if (!x.wallet) { try { x.wallet = (await this.store.getUser(x.uid)).wallet; } catch { x.wallet = x.uid; } }
    };
    const enriched = [];
    for (const p of posts) {
      const replies = byPost.get(p.postId) || [];
      for (const r of replies) await fillWallet(r);
      let banned = false;
      try { banned = !!(await this.store.getUser(p.uid)).banned; } catch { /* */ }
      await fillWallet(p);
      const lastReplyAt = replies.length ? replies[replies.length - 1].at : 0;
      enriched.push({ ...p, banned, replies, replyCount: replies.length, lastActiveAt: Math.max(p.at, lastReplyAt) });
    }
    enriched.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return enriched;
  }
}
