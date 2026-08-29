// 应用装配：有 Railway MySQL 环境变量则持久化，否则用内存仓储（本地/演示）
import { MemoryStore } from './store.js';
import { MysqlStore } from './store-mysql.js';
import { DEFAULT_CONFIG } from './config.js';
import { InsuranceService } from './InsuranceService.js';
import { GameService } from './GameService.js';
import { WalletService } from './WalletService.js';

export function useMysql(env = process.env) {
  return !!(env.MYSQLHOST || env.DATABASE_URL || env.MYSQL_URL || env.MYSQL_PUBLIC_URL);
}

export async function createApp(cfg = DEFAULT_CONFIG, env = process.env) {
  const store = useMysql(env) ? new MysqlStore(env) : new MemoryStore();
  await store.init();
  const insurance = new InsuranceService(store, cfg);
  const game = new GameService(store, cfg, insurance);
  const wallet = new WalletService(store, cfg);
  return { store, cfg, insurance, game, wallet, storeKind: store.kind };
}
