import io
f = io.open('src/server.js', 'r', encoding='utf-8-sig')
content = f.read()
f.close()
old = "const PORT = process.env.PORT || 8080;"
new = """// Startup repair: force-cancel stuck rounds and fix ledger imbalance (caused by rolled-back NPC version)
(async () => {
  try {
    const nowS = now();
    const [stuck] = await store.pool.query("SELECT round_id FROM rounds WHERE state IN ('active','locked') AND settle_at < ?", [nowS - 60]);
    for (const row of stuck) {
      await store.pool.query("UPDATE rounds SET state='cancelled', result_json=? WHERE round_id=?", [JSON.stringify({ status: 'cancelled', reason: 'startup_repair' }), row.round_id]);
      console.log('[startup-repair] cancelled stuck round', row.round_id);
    }
    const inside = await store.totalInside();
    const l = await store.getLedger();
    const source = l.issued - l.withdrawn;
    const delta = inside - source;
    if (delta !== 0n) {
      await store.pool.query('UPDATE ledger SET issued=issued+? WHERE id=1', [delta.toString()]);
      console.log('[startup-repair] ledger fixed, delta=', delta.toString());
    }
  } catch (e) { console.error('[startup-repair]', e.message); }
})();

const PORT = process.env.PORT || 8080;"""
content = content.replace(old, new)
f = io.open('src/server.js', 'w', encoding='utf-8')
f.write(content)
f.close()
print('Done')
