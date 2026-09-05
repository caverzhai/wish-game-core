// Lottery Service - lucky draw pools (persistent storage)
const SCALE = 1000000;

export const LOTTERY_PRODUCTS = [
  { id: 'L100', name: '100枚幸运池', totalAmount: 100, image: '/lottery-100.jpg', numDigits: 2,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 50 }, { level: 2, name: '二等奖', count: 2, amount: 10 }, { level: 3, name: '三等奖', count: 25, amount: 1 }],
    desc: '投入1枚即可参与，最高可得50枚。号码00-99，售完即开。' },
  { id: 'L200', name: '200枚幸运池', totalAmount: 200, image: '/lottery-200.jpg', numDigits: 3,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 100 }, { level: 2, name: '二等奖', count: 2, amount: 20 }, { level: 3, name: '三等奖', count: 25, amount: 2 }],
    desc: '投入1枚即可参与，最高可得100枚。号码000-199，售完即开。' },
  { id: 'L500', name: '500枚幸运池', totalAmount: 500, image: '/lottery-500.jpg', numDigits: 3,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 200 }, { level: 2, name: '二等奖', count: 3, amount: 50 }, { level: 3, name: '三等奖', count: 10, amount: 10 }, { level: 4, name: '四等奖', count: 25, amount: 1 }],
    desc: '投入1枚即可参与，最高可得200枚。号码000-499，售完即开。' },
  { id: 'L1000', name: '1000枚幸运池', totalAmount: 1000, image: '/lottery-1000.jpg', numDigits: 3,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 500 }, { level: 2, name: '二等奖', count: 2, amount: 100 }, { level: 3, name: '三等奖', count: 25, amount: 10 }],
    desc: '投入1枚即可参与，最高可得500枚。号码000-999，售完即开。' },
  { id: 'L2000', name: '2000枚幸运池', totalAmount: 2000, image: '/lottery-2000.jpg', numDigits: 4,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 1000 }, { level: 2, name: '二等奖', count: 2, amount: 200 }, { level: 3, name: '三等奖', count: 5, amount: 50 }, { level: 4, name: '四等奖', count: 25, amount: 10 }],
    desc: '投入1枚即可参与，最高可得1000枚。号码0000-1999，售完即开。' },
  { id: 'L5000', name: '5000枚幸运池', totalAmount: 5000, image: '/lottery-5000.jpg', numDigits: 4,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 2000 }, { level: 2, name: '二等奖', count: 3, amount: 500 }, { level: 3, name: '三等奖', count: 5, amount: 100 }, { level: 4, name: '四等奖', count: 75, amount: 10 }],
    desc: '投入1枚即可参与，最高可得2000枚。号码0000-4999，售完即开。' },
  { id: 'L10000', name: '10000枚幸运池', totalAmount: 10000, image: '/lottery-10000.jpg', numDigits: 5,
    prizes: [{ level: 1, name: '一等奖', count: 1, amount: 5000 }, { level: 2, name: '二等奖', count: 2, amount: 1000 }, { level: 3, name: '三等奖', count: 10, amount: 100 }, { level: 4, name: '四等奖', count: 150, amount: 10 }],
    desc: '投入1枚即可参与，最高可得5000枚。号码00000-09999，售完即开。' },
];

export class LotteryService {
  constructor(store) {
    this.store = store;
  }

  async _ensureRound(productId) {
    let round = await this.store.lotteryGetActiveRound(productId);
    if (!round) {
      const count = await this.store.lotteryCountFinished(productId);
      const roundId = `${productId}_R${String(count + 1).padStart(4, '0')}`;
      round = await this.store.lotteryCreateRound(productId, roundId);
    }
    return round;
  }

  async getProducts() {
    const result = [];
    for (const p of LOTTERY_PRODUCTS) {
      const round = await this._ensureRound(p.id);
      const participantCount = new Set((await this.store.lotteryListEntries(round.roundId)).map(e => e.uid)).size;
      result.push({
        ...p,
        currentRound: {
          roundId: round.roundId,
          status: round.status,
          totalSold: round.totalSold,
          totalAmount: p.totalAmount,
          progress: Math.round((round.totalSold / p.totalAmount) * 100),
          participantCount,
        },
      });
    }
    return result;
  }

  async getCurrentRound(productId) {
    const product = LOTTERY_PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');
    const round = await this._ensureRound(productId);
    const participantCount = new Set((await this.store.lotteryListEntries(round.roundId)).map(e => e.uid)).size;
    return {
      ...round,
      product,
      summary: {
        roundId: round.roundId,
        status: round.status,
        totalSold: round.totalSold,
        totalAmount: product.totalAmount,
        progress: Math.round((round.totalSold / product.totalAmount) * 100),
        participantCount,
      },
    };
  }

  async getMyNumbers(productId, uid) {
    const round = await this.store.lotteryGetActiveRound(productId);
    if (!round) return [];
    const product = LOTTERY_PRODUCTS.find(p => p.id === productId);
    const entries = await this.store.lotteryListMyNumbers(round.roundId, uid);
    return entries.map(e => ({
      startNum: String(e.startNum).padStart(product.numDigits, '0'),
      endNum: String(e.endNum).padStart(product.numDigits, '0'),
      amount: e.amount,
    }));
  }

  async getHistory(productId, limit = 10) {
    return await this.store.lotteryListHistory(productId, limit);
  }

  async getComments(productId, limit = 50) {
    return await this.store.lotteryListComments(productId, limit);
  }

  async addComment(productId, uid, content) {
    return await this.store.lotteryAddComment(productId, uid, content);
  }

  async buy(uid, productId, amount) {
    const product = LOTTERY_PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Amount must be positive integer');

    const round = await this._ensureRound(productId);
    if (round.status !== 'selling') throw new Error('Round not available');

    const remaining = product.totalAmount - round.totalSold;
    if (amount > remaining) throw new Error(`Only ${remaining} slots remaining`);

    const user = await this.store.getUser(uid);
    if (!user) throw new Error('User not found');

    const account = await this.store.getAccount(uid);
    const cost = BigInt(amount) * BigInt(SCALE);
    if (account.available < cost) {
      return { needWallet: true, amount, cost: Number(cost) / SCALE };
    }

    await this.store.applyAccount(uid, { avail: -cost });
    await this.store.applyLedger({ plat: cost });
    await this.store.addFlow(uid, 'LOTTERY_BUY', cost, { roundId: round.roundId, productId });

    const startNum = round.totalSold;
    const endNum = round.totalSold + amount - 1;
    await this.store.lotteryAddEntry(round.roundId, uid, startNum, endNum, amount);
    const newTotal = round.totalSold + amount;
    await this.store.lotteryUpdateRound(round.roundId, { totalSold: newTotal });

    if (newTotal >= product.totalAmount) {
      await this._drawAndSettle(round.roundId, product);
    }

    const updated = await this.store.lotteryGetActiveRound(productId);
    return {
      success: true,
      startNum: String(startNum).padStart(product.numDigits, '0'),
      endNum: String(endNum).padStart(product.numDigits, '0'),
      amount,
      round: updated ? {
        roundId: updated.roundId,
        status: updated.status,
        totalSold: updated.totalSold,
        totalAmount: product.totalAmount,
        progress: Math.round((updated.totalSold / product.totalAmount) * 100),
      } : null,
    };
  }

  async _drawAndSettle(roundId, product) {
    await this.store.lotteryUpdateRound(roundId, { status: 'drawing' });

    const entries = await this.store.lotteryListEntries(roundId);
    const numberOwners = [];
    for (const entry of entries) {
      for (let n = entry.startNum; n <= entry.endNum; n++) {
        numberOwners.push({ number: n, uid: entry.uid });
      }
    }

    const shuffled = [...numberOwners].sort(() => Math.random() - 0.5);
    const winners = [];
    let idx = 0;
    const usedNumbers = new Set();

    for (const prize of product.prizes) {
      for (let i = 0; i < prize.count && idx < shuffled.length; i++) {
        while (idx < shuffled.length && usedNumbers.has(shuffled[idx].number)) idx++;
        if (idx >= shuffled.length) break;
        const pick = shuffled[idx];
        usedNumbers.add(pick.number);
        winners.push({
          number: String(pick.number).padStart(product.numDigits, '0'),
          uid: pick.uid,
          level: prize.level,
          levelName: prize.name,
          amount: prize.amount,
        });
        idx++;
      }
    }

    await this.store.lotteryUpdateRound(roundId, { status: 'finished', finishedAt: Math.floor(Date.now() / 1000), winners });

    for (const w of winners) {
      const prize = BigInt(w.amount) * BigInt(SCALE);
      await this.store.applyAccount(w.uid, { avail: prize });
      await this.store.applyLedger({ plat: -prize });
      await this.store.addFlow(w.uid, 'LOTTERY_WIN', prize, { roundId, productId: product.id });
    }

    // Auto-create next round
    const count = await this.store.lotteryCountFinished(product.id);
    const nextRoundId = `${product.id}_R${String(count + 1).padStart(4, '0')}`;
    await this.store.lotteryCreateRound(product.id, nextRoundId);
  }
}
