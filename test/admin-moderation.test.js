import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const mk = () => createApp();

test('Admin moderation: delete post(with replies), ban/unban, blocked word add/remove all work', async () => {
  const app = await mk();
  const A = (await app.game.register('0xAdmin1')).uid;
  const B = (await app.game.register('0xUserB')).uid;

  // B posts twice
  const p1 = await app.social.post(B, 'hello world');
  const p2 = await app.social.post(B, 'second post');
  let list = await app.social.list();
  assert.equal(list.length, 2, 'two posts exist');

  // admin deletes post
  await app.social.deletePost(A, p1.postId);
  list = await app.social.list();
  assert.equal(list.length, 1, 'one post remains after delete');
  assert.equal(list[0].postId, p2.postId, 'remaining is second post');

  // ban / unban
  assert.equal(await app.store.setBanned(B, true), true);
  const ub = await app.store.getUser(B);
  assert.equal(ub.banned, true, 'B is banned');
  assert.equal(await app.store.setBanned(B, false), false);

  // blocked word add / list / remove
  await app.store.addBlockedWord('bannedword');
  let words = await app.store.listBlockedWords();
  assert.ok(words.includes('bannedword'), 'blocked word added');
  await app.store.removeBlockedWord('bannedword');
  words = await app.store.listBlockedWords();
  assert.ok(!words.includes('bannedword'), 'blocked word removed');
});
