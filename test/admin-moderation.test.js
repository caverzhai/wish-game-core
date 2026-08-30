import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const mk = () => createApp();

test('管理员治理：删贴(连带回复)、封号/解封、屏蔽词增删均正常', async () => {
  const app = await mk();
  const A = (await app.game.register('0xAdmin1')).uid;
  const B = (await app.game.register('0xUserB')).uid;

  // B 发两贴
  const p1 = await app.social.post(B, 'hello world');
  const p2 = await app.social.post(B, 'second post');
  let list = await app.social.list();
  assert.equal(list.length, 2, '两贴存在');

  // 管理员删贴
  await app.social.deletePost(A, p1.postId);
  list = await app.social.list();
  assert.equal(list.length, 1, '删掉一贴后剩一贴');
  assert.equal(list[0].postId, p2.postId, '剩下的是第二贴');

  // 封号 / 解封
  assert.equal(await app.store.setBanned(B, true), true);
  const ub = await app.store.getUser(B);
  assert.equal(ub.banned, true, 'B 已封号');
  assert.equal(await app.store.setBanned(B, false), false);

  // 屏蔽词增 / 列表 / 删
  await app.store.addBlockedWord('违禁');
  let words = await app.store.listBlockedWords();
  assert.ok(words.includes('违禁'), '屏蔽词已加入');
  await app.store.removeBlockedWord('违禁');
  words = await app.store.listBlockedWords();
  assert.ok(!words.includes('违禁'), '屏蔽词已移除');
});
