// =============================================================
// SocialService.js —— BBS 广场：人人可发 ≤100 字纯文字
// =============================================================
import { GameError, Codes } from './errors.js';

export const POST_MAX_CHARS = 100;

export class SocialService {
  constructor(store) { this.store = store; }

  async post(uid, text) {
    const content = String(text ?? '').trim();
    const len = [...content].length; // 按 Unicode 码点计字（表情/中文各算 1）
    if (len < 1) throw new GameError(Codes.BAD_INPUT, '内容不能为空');
    if (len > POST_MAX_CHARS) throw new GameError(Codes.BAD_INPUT, `最多 ${POST_MAX_CHARS} 字，当前 ${len} 字`);
    await this.store.getUser(uid);
    const postId = await this.store.nextId('post', 'P');
    await this.store.addPost({ postId, uid, content, at: Date.now() });
    return { postId, len };
  }

  async list(limit = 50) {
    const posts = await this.store.listPosts(limit);
    for (const p of posts) {
      if (!p.wallet) {
        try { p.wallet = (await this.store.getUser(p.uid)).wallet; } catch { p.wallet = p.uid; }
      }
    }
    return posts;
  }
}
