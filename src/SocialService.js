// =============================================================
// SocialService.js —— BBS 广场：发帖 / 回复（均 ≤100 字纯文字）
// 排序：每个主题按「最新发帖时间」与「最新回复时间」取较大者，越新越靠前
// =============================================================
import { GameError, Codes } from './errors.js';

export const POST_MAX_CHARS = 100;

export class SocialService {
  constructor(store) { this.store = store; }

  _check(text) {
    const content = String(text ?? '').trim();
    const len = [...content].length;
    if (len < 1) throw new GameError(Codes.BAD_INPUT, '内容不能为空');
    if (len > POST_MAX_CHARS) throw new GameError(Codes.BAD_INPUT, `最多 ${POST_MAX_CHARS} 字，当前 ${len} 字`);
    return content;
  }

  async post(uid, text) {
    const content = this._check(text);
    await this.store.getUser(uid);
    const postId = await this.store.nextId('post', 'P');
    await this.store.addPost({ postId, uid, content, at: Date.now() });
    return { postId };
  }

  async reply(uid, postId, text) {
    const content = this._check(text);
    await this.store.getUser(uid);
    const post = await this.store.getPost(postId);
    if (!post) throw new GameError(Codes.NOT_FOUND, '原帖不存在或已删除');
    const replyId = await this.store.nextId('reply', 'RP');
    await this.store.addReply({ replyId, postId, uid, content, at: Date.now() });
    return { replyId, postId };
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
      await fillWallet(p);
      const lastReplyAt = replies.length ? replies[replies.length - 1].at : 0;
      enriched.push({ ...p, replies, replyCount: replies.length, lastActiveAt: Math.max(p.at, lastReplyAt) });
    }
    enriched.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return enriched;
  }
}
