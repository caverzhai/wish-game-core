// =============================================================
// SocialService.js —— BBS 广场：发帖 / 回复（均 ≤100 字纯文字）
// 排序：每个主题按「最新发帖时间」与「最新回复时间」取较大者，越新越靠前
// 治理：被封禁账号禁止发言；内容命中屏蔽词（归一化后）拒绝
// =============================================================
import { GameError, Codes } from './errors.js';

export const POST_MAX_CHARS = 100;
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
    const len = [...content].length;
    if (len < 1) throw new GameError(Codes.BAD_INPUT, '内容不能为空');
    if (len > POST_MAX_CHARS) throw new GameError(Codes.BAD_INPUT, `最多 ${POST_MAX_CHARS} 字，当前 ${len} 字`);
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
