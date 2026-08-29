// 应用装配：仓储 + 配置 + 各领域服务（生产环境把 MemoryStore 换成 MySQL 仓储即可）
import { MemoryStore } from './store.js';
import { DEFAULT_CONFIG } from './config.js';
import { InsuranceService } from './InsuranceService.js';
import { GameService } from './GameService.js';
import { WalletService } from './WalletService.js';

export function createApp(cfg = DEFAULT_CONFIG) {
  const store = new MemoryStore();
  const insurance = new InsuranceService(store, cfg);
  const game = new GameService(store, cfg, insurance);
  const wallet = new WalletService(store, cfg);
  return { store, cfg, insurance, game, wallet };
}
