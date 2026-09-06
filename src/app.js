// App assembly: MySQL persistence if Railway env vars present, otherwise in-memory store (local/demo)
import { MemoryStore } from './store.js';
import { MysqlStore } from './store-mysql.js';
import { DEFAULT_CONFIG } from './config.js';
import { InsuranceService } from './InsuranceService.js';
import { GameService } from './GameService.js';
import { WalletService } from './WalletService.js';
import { SocialService } from './SocialService.js';
import { ChainService } from './ChainService.js';
import { VoiceRoomService } from './VoiceRoomService.js';
import { NpcService } from './NpcService.js';
import { LotteryService } from './LotteryService.js';
import { CharityService } from './CharityService.js';

const MYSQL_KEYS = ['DATABASE_URL', 'MYSQL_URL', 'MYSQL_PUBLIC_URL', 'MYSQL_PRIVATE_URL', 'MYSQLHOST', 'MYSQL_HOST', 'MYSQLDATABASE', 'MYSQL_DATABASE'];
export function useMysql(env = process.env) {
  return MYSQL_KEYS.some((k) => env[k]);
}

export async function createApp(cfg = DEFAULT_CONFIG, env = process.env) {
  const store = useMysql(env) ? new MysqlStore(env) : new MemoryStore();
  await store.init();
  const insurance = new InsuranceService(store, cfg);
  const game = new GameService(store, cfg, insurance);
  const wallet = new WalletService(store, cfg);
  const social = new SocialService(store);
  const chain = new ChainService(env); // On-chain adapter (disabled if unconfigured, falls back to in-site balance)
  const voice = new VoiceRoomService(store);
  const npc = new NpcService({ store, game, social, voice });
  const lottery = new LotteryService(store);
  const charity = new CharityService(store, cfg, insurance);
  // Fix historical voice room unrecorded platform revenue (pre-v2.2.5 room creation deducted user balance but not platform, causing ledger imbalance)
  try {
    const inside = await store.totalInside();
    const source = await store.totalSource();
    if (inside < source) {
      const diff = source - inside;
      await store.applyLedger({ plat: diff }); // Must use applyLedger to persist on MySQL
      await store.addFlow('PLATFORM', 'ROOM_INCOME_FIX', diff, { note: 'fix historical room prepay' }).catch(() => {});
      console.log(`[ledger-fix] backfill voice room platform revenue diff=${diff} inside=${inside} source=${source}`);
    }
  } catch (e) { console.error('[ledger-fix] error', e.message); }
  return { store, cfg, insurance, game, wallet, social, chain, voice, npc, lottery, charity, storeKind: store.kind };
}
