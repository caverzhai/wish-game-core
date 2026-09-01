// =============================================================
// SocialService.js —— BBS 广场：发帖 / 回复（纯文字，单条 ≤1024 字节，按 UTF-8 计）
// 排序：每个主题按「最新发帖时间」与「最新回复时间」取较大者，越新越靠前
// 治理：被封禁账号禁止发言；内容命中屏蔽词（归一化后）拒绝
// =============================================================
import { GameError, Codes } from './errors.js';
import { promises as fsp } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const POST_MAX_BYTES = 1024; // 单条内容上限：1024 字节（UTF-8，中文每字 3 字节）
export const ANNOUNCE_MAX_BYTES = 8192; // 系统公告上限：8192 字节
const __dirname = dirname(fileURLToPath(import.meta.url));
const ANNOUNCE_FILE = join(__dirname, '..', 'data', 'announcement.json');
/** 归一化：小写 + 去空白/标点/符号，防止用空格、符号插入绕开屏蔽词 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\s\p{P}\p{S}]/gu, '');

export class SocialService {
  constructor(store) { this.store = store; }

  async _assertSpeaker(uid) {
    const u = await this.store.getUser(uid);
    if (u.banned) throw new GameError(Codes.BANNED, '账号已被封禁，无法发言');
    return u;
  }

  async _check(text) {
    const content = String(text ?? '').trim();
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes < 1) throw new GameError(Codes.BAD_INPUT, '内容不能为空');
    if (bytes > POST_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `最多 ${POST_MAX_BYTES} 字节，当前 ${bytes} 字节`);
    const words = await this.store.listBlockedWords();
    if (words.length) {
      const n = norm(content);
      for (const w of words) { const nw = norm(w); if (nw && n.includes(nw)) throw new GameError(Codes.BAD_INPUT, '内容包含被屏蔽的词语，请修改后再发'); }
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
    if (!post) throw new GameError(Codes.NOT_FOUND, '原帖不存在或已删除');
    const replyId = await this.store.nextId('reply', 'RP');
    await this.store.addReply({ replyId, postId, uid, content, at: Date.now() });
    return { replyId, postId };
  }

  /** 管理员删帖（连带其回复） */
  async deletePost(uid, postId) {
    const ok = await this.store.deletePost(postId);
    if (!ok) throw new GameError(Codes.NOT_FOUND, '帖子不存在或已删除');
    return { postId, deleted: true };
  }

  // ---------------- 系统公告（管理员发布，长文不受 BBS 1024 字节限制） ----------------
  async getAnnouncement() {
    try {
      const raw = await fsp.readFile(ANNOUNCE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch { return null; }
  }
  async setAnnouncement(uid, content) {
    const text = String(content ?? '').trim();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes < 1) throw new GameError(Codes.BAD_INPUT, '公告内容不能为空');
    if (bytes > ANNOUNCE_MAX_BYTES) throw new GameError(Codes.BAD_INPUT, `公告最多 ${ANNOUNCE_MAX_BYTES} 字节，当前 ${bytes} 字节`);
    const u = await this.store.getUser(uid);
    const ann = { content: text, at: Date.now(), uid, wallet: u.wallet || uid };
    await fsp.mkdir(dirname(ANNOUNCE_FILE), { recursive: true });
    await fsp.writeFile(ANNOUNCE_FILE, JSON.stringify(ann, null, 2), 'utf8');
    return ann;
  }

  /** 主题列表：内嵌回复（时间升序），主题按最后活跃时间降序 */
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
