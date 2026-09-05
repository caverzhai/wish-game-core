// Lottery Service - lucky draw pools (ES module)
const SCALE = 1000000;

export const LOTTERY_PRODUCTS = [
  {
    id: 'L100',
    name: '100枚幸运池',
    totalAmount: 100,
    image: '/lottery-100.jpg',
    numDigits: 2,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 50 },
      { level: 2, name: '二等奖', count: 2, amount: 10 },
      { level: 3, name: '三等奖', count: 25, amount: 1 },
    ],
  },
  {
    id: 'L200',
    name: '200枚幸运池',
    totalAmount: 200,
    image: '/lottery-200.jpg',
    numDigits: 3,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 100 },
      { level: 2, name: '二等奖', count: 2, amount: 20 },
      { level: 3, name: '三等奖', count: 25, amount: 2 },
    ],
  },
  {
    id: 'L500',
    name: '500枚幸运池',
    totalAmount: 500,
    image: '/lottery-500.jpg',
    numDigits: 3,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 200 },
      { level: 2, name: '二等奖', count: 3, amount: 50 },
      { level: 3, name: '三等奖', count: 10, amount: 10 },
      { level: 4, name: '四等奖', count: 25, amount: 1 },
    ],
  },
  {
    id: 'L1000',
    name: '1000枚幸运池',
    totalAmount: 1000,
    image: '/lottery-1000.jpg',
    numDigits: 3,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 500 },
      { level: 2, name: '二等奖', count: 2, amount: 100 },
      { level: 3, name: '三等奖', count: 25, amount: 10 },
    ],
  },
  {
    id: 'L2000',
    name: '2000枚幸运池',
    totalAmount: 2000,
    image: '/lottery-2000.jpg',
    numDigits: 4,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 1000 },
      { level: 2, name: '二等奖', count: 2, amount: 200 },
      { level: 3, name: '三等奖', count: 5, amount: 50 },
      { level: 4, name: '四等奖', count: 25, amount: 10 },
    ],
  },
  {
    id: 'L5000',
    name: '5000枚幸运池',
    totalAmount: 5000,
    image: '/lottery-5000.jpg',
    numDigits: 4,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 2000 },
      { level: 2, name: '二等奖', count: 3, amount: 500 },
      { level: 3, name: '三等奖', count: 5, amount: 100 },
      { level: 4, name: '四等奖', count: 75, amount: 10 },
    ],
  },
  {
    id: 'L10000',
    name: '10000枚幸运池',
    totalAmount: 10000,
    image: '/lottery-10000.jpg',
    numDigits: 5,
    prizes: [
      { level: 1, name: '一等奖', count: 1, amount: 5000 },
      { level: 2, name: '二等奖', count: 2, amount: 1000 },
      { level: 3, name: '三等奖', count: 10, amount: 100 },
      { level: 4, name: '四等奖', count: 150, amount: 10 },
    ],
  },
];

export class LotteryService {
  constructor(store) {
    this.store = store;
    this.rounds = new Map();
    this.comments = new Map();
    this.history = new Map();
    this._initRounds();
  }

  _initRounds() {
    for (const p of LOTTERY_PRODUCTS) {
      if (!p.comingSoon) {
        this.rounds.set(p.id, this._createRound(p.id));
      }
      this.history.set(p.id, []);
      this.comments.set(p.id, []);
    }
  }

  _createRound(productId) {
    const roundNum = (this.history.get(productId)?.length || 0) + 1;
    return {
      roundId: `${productId}_R${String(roundNum).padStart(4, '0')}`,
      productId,
      status: 'selling',
      totalSold: 0,
      entries: [],
      winners: [],
      createdAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
    };
  }

  getProducts() {
    return LOTTERY_PRODUCTS.map(p => ({
      ...p,
      currentRound: this._roundSummary(this.rounds.get(p.id)),
    }));
  }

  _roundSummary(round) {
    if (!round) return null;
    const product = LOTTERY_PRODUCTS.find(p => p.id === round.productId);
    return {
      roundId: round.roundId,
      status: round.status,
      totalSold: round.totalSold,
      totalAmount: product.totalAmount,
      progress: Math.round((round.totalSold / product.totalAmount) * 100),
      participantCount: new Set(round.entries.map(e => e.uid)).size,
    };
  }

  getCurrentRound(productId) {
    const round = this.rounds.get(productId);
    if (!round) return null;
    const product = LOTTERY_PRODUCTS.find(p => p.id === productId);
    return {
      ...round,
      product,
      summary: this._roundSummary(round),
    };
  }

  getHistory(productId, limit = 10) {
    return (this.history.get(productId) || []).slice(-limit).reverse();
  }

  getComments(productId, limit = 50) {
    return (this.comments.get(productId) || []).slice(-limit).reverse();
  }

  addComment(productId, uid, content) {
    if (!this.comments.has(productId)) this.comments.set(productId, []);
    const comment = {
      id: Date.now() + Math.random(),
      uid,
      content,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.comments.get(productId).push(comment);
    return comment;
  }

  async buy(uid, productId, amount) {
    const product = LOTTERY_PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Amount must be positive integer');

    const round = this.rounds.get(productId);
    if (!round || round.status !== 'selling') throw new Error('Round not available');

    const remaining = product.totalAmount - round.totalSold;
    if (amount > remaining) throw new Error(`Only ${remaining} slots remaining`);

    const user = await this.store.getUser(uid);
    if (!user) throw new Error('User not found');

    const cost = BigInt(amount) * BigInt(SCALE);
    if (user.balance < cost) {
      return { needWallet: true, amount, cost: Number(cost) / SCALE };
    }

    await this.store.adjustBalance(uid, -cost, 'lottery_buy', round.roundId);

    const startNum = round.totalSold;
    const endNum = round.totalSold + amount - 1;
    round.entries.push({
      uid,
      startNum,
      endNum,
      amount,
      timestamp: Math.floor(Date.now() / 1000),
    });
    round.totalSold += amount;

    if (round.totalSold >= product.totalAmount) {
      await this._drawAndSettle(round, product);
    }

    return {
      success: true,
      startNum: String(startNum).padStart(product.numDigits, '0'),
      endNum: String(endNum).padStart(product.numDigits, '0'),
      amount,
      round: this._roundSummary(round),
    };
  }

  async _drawAndSettle(round, product) {
    round.status = 'drawing';

    const numberOwners = [];
    for (const entry of round.entries) {
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

    round.winners = winners;
    round.status = 'finished';
    round.finishedAt = Math.floor(Date.now() / 1000);

    for (const w of winners) {
      await this.store.adjustBalance(w.uid, BigInt(w.amount) * BigInt(SCALE), 'lottery_win', round.roundId);
    }

    this.history.get(product.id).push({
      roundId: round.roundId,
      productId: product.id,
      totalSold: round.totalSold,
      winners: round.winners,
      finishedAt: round.finishedAt,
    });

    this.rounds.set(product.id, this._createRound(product.id));
  }
}
