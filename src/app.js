// 应用装配：有 Railway MySQL 环境变量则持久化，否则用内存仓储（本地/演示）
import { MemoryStore } from './store.js';
import { MysqlStore } from './store-mysql.js';
import { DEFAULT_CONFIG } from './config.js';
import { InsuranceService } from './InsuranceService.js';
import { GameService } from './GameService.js';
import { WalletService } from './WalletService.js';
import { SocialService } from './SocialService.js';
import { ChainService } from './ChainService.js';
import { VoiceRoomService } from './VoiceRoomService.js';

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
  const chain = new ChainService(env); // 链上适配层（未配置则关闭，回退站内余额）
  const voice = new VoiceRoomService(store);
  // 修复历史语音房未记账的平台收入（v2.2.5之前开房扣用户余额但未记platform，导致总帐不平）
  try {
    const inside = await store.totalInside();
    const source = await store.totalSource();
    if (inside < source) {
      const diff = source - inside;
      await store.applyLedger({ plat: diff }); // 必须用applyLedger才能在MySQL上持久化
      await store.addFlow('PLATFORM', 'ROOM_INCOME_FIX', diff, { note: 'fix historical room prepay' }).catch(() => {});
      console.log(`[ledger-fix] 补记语音房平台收入 diff=${diff} inside=${inside} source=${source}`);
    }
  } catch (e) { console.error('[ledger-fix] error', e.message); }
  return { store, cfg, insurance, game, wallet, social, chain, voice, storeKind: store.kind };
}
