// CharityService.js - Difficulty Charity Relief Application System
// Users apply for relief, others donate and vote. When target reached, funds distributed:
// Recipient 20%, Lottery (1st 30%, 2nd 2x10%, 3rd 10x2%), Platform 10%
// Voting: users with insurance nodes can vote support/oppose on any project (once, immutable)
// Donors can comment on projects they donated to (with donation amount badge)

import { GameError, Codes } from './errors.js';
import { coin, SCALE } from './money.js';

class CharityService {
  constructor(store, cfg, insurance) {
    this.store = store;
    this.cfg = cfg;
    this.insurance = insurance;
    this.COIN = SCALE;
  }

  // ---- Create relief application ----
  async createProject(uid, data) {
    const { name, gender, photo, country, city, helpType, reason, targetAmount, proof } = data;
    if (!name || !photo || !country || !helpType || !reason || !targetAmount) {
      throw new GameError(Codes.BAD_INPUT, 'Name, photo, country, help type, reason, and target amount are required');
    }
    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      throw new GameError(Codes.BAD_INPUT, 'Target amount must be positive');
    }
    // Target donation = requested amount * 5
    const goalAmount = BigInt(Math.floor(target * 5)) * this.COIN;
    const now = Math.floor(Date.now() / 1000);
    const projectId = await this.store.nextId('charity', 'CH');

    const project = {
      projectId,
      uid,
      name: String(name).slice(0, 100),
      gender: gender || 'unknown',
      photo: String(photo),
      country: String(country).slice(0, 100),
      city: city ? String(city).slice(0, 100) : '',
      helpType: String(helpType).slice(0, 200),
      reason: String(reason).slice(0, 2000),
      targetAmount: BigInt(Math.floor(target)) * this.COIN, // requested amount
      goalAmount, // target * 5
      raised: 0n,
      proof: proof ? String(proof).slice(0, 2000) : '',
      status: 'active', // active, success, failed, dissolved
      supportVotes: 0,
      opposeVotes: 0,
      commentCount: 0,
      donorCount: 0,
      createdAt: now,
      settledAt: null,
    };

    await this.store.insertCharityProject(project);
    return project;
  }

  // ---- List projects (sorted by raised > support > comments) ----
  async listProjects(limit = 50, offset = 0) {
    const projects = await this.store.listCharityProjects(limit, offset);
    return projects;
  }

  // ---- Get project detail ----
  async getProject(projectId) {
    const p = await this.store.getCharityProject(projectId);
    if (!p) throw new GameError(Codes.NOT_FOUND, 'Project not found');
    return p;
  }

  // ---- Donate ----
  async donate(uid, projectId, amountCoin) {
    if (!Number.isInteger(amountCoin) || amountCoin < 1) {
      throw new GameError(Codes.BAD_INPUT, 'Donation must be a positive integer');
    }
    const amount = BigInt(amountCoin) * this.COIN;
    const project = await this.getProject(projectId);
    if (project.status !== 'active') {
      throw new GameError(Codes.BAD_INPUT, 'Project is not accepting donations');
    }

    return await this.store.transaction(async () => {
      const p = await this.store.getCharityProjectForUpdate(projectId);
      if (p.status !== 'active') {
        throw new GameError(Codes.BAD_INPUT, 'Project is not accepting donations');
      }
      const remaining = p.goalAmount - p.raised;
      const actualDonation = amount > remaining ? remaining : amount;

      const acc = await this.store.getAccount(uid);
      if (acc.available < actualDonation) {
        throw new GameError(Codes.INSUFFICIENT_BALANCE, 'Insufficient balance');
      }

      await this.store.applyAccount(uid, { avail: -actualDonation, frozen: actualDonation });
      await this.store.addCharityDonation({
        donationId: await this.store.nextId('cdonation', 'CD'),
        projectId,
        uid,
        amount: actualDonation,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'frozen', // frozen, refunded, won, settled
      });
      await this.store.addFlow(uid, 'CHARITY_DONATE', actualDonation, { projectId });

      const newRaised = p.raised + actualDonation;
      const updateData = { raised: newRaised };
      if (newRaised >= p.goalAmount) {
        updateData.status = 'success';
        updateData.settledAt = Math.floor(Date.now() / 1000);
      }
      await this.store.updateCharityProject(projectId, updateData);

      // If goal reached, settle immediately
      if (newRaised >= p.goalAmount) {
        await this._settleProject(projectId);
      }

      return { projectId, donated: actualDonation, raised: newRaised, goal: p.goalAmount, success: newRaised >= p.goalAmount };
    }, 'charity-donate');
  }

  // ---- Settle project (distribute funds) ----
  async _settleProject(projectId) {
    const p = await this.store.getCharityProject(projectId);
    const total = p.raised;
    if (total <= 0n) return;

    // Distribution: recipient 20%, lottery 60% (30+20+10), platform 10%
    const recipientShare = total * 20n / 100n;
    const lotteryPool = total * 60n / 100n;
    const platformShare = total * 10n / 100n;
    const dust = total - recipientShare - lotteryPool - platformShare;

    // 1. Pay recipient
    await this.store.applyAccount(p.uid, { frozen: 0, avail: recipientShare });
    await this.store.addFlow(p.uid, 'CHARITY_RECEIVE', recipientShare, { projectId });

    // 2. Platform fee
    await this.store.applyLedger({ plat: platformShare + dust });

    // 3. Lottery: each 1 coin donated = 1 ticket
    const donations = await this.store.listCharityDonations(projectId);
    const tickets = [];
    for (const d of donations) {
      const ticketCount = Number(d.amount / this.COIN);
      for (let i = 0; i < ticketCount; i++) {
        tickets.push(d.uid);
      }
    }

    // Shuffle tickets
    for (let i = tickets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
    }

    // Prize distribution
    const prizes = [
      { level: 1, count: 1, percent: 30 },
      { level: 2, count: 2, percent: 10 },
      { level: 3, count: 10, percent: 2 },
    ];

    let ticketIdx = 0;
    const winners = [];
    for (const prize of prizes) {
      const prizeAmount = lotteryPool * BigInt(prize.percent) / 100n;
      const perWinner = prizeAmount / BigInt(prize.count);
      for (let i = 0; i < prize.count && ticketIdx < tickets.length; i++) {
        const winnerUid = tickets[ticketIdx++];
        await this.store.applyAccount(winnerUid, { frozen: -perWinner, avail: perWinner });
        await this.store.addFlow(winnerUid, 'CHARITY_WIN', perWinner, { projectId, level: prize.level });
        winners.push({ uid: winnerUid, level: prize.level, amount: perWinner });
      }
    }

    // Unfreeze remaining donations (non-winners get their donation back as settled)
    const settledUids = new Set(winners.map(w => w.uid));
    settledUids.add(p.uid);
    for (const d of donations) {
      if (!settledUids.has(d.uid)) {
        await this.store.applyAccount(d.uid, { frozen: -d.amount });
        await this.store.updateCharityDonation(d.donationId, { status: 'settled' });
      } else {
        await this.store.updateCharityDonation(d.donationId, { status: 'won' });
      }
    }

    await this.store.updateCharityProject(projectId, { status: 'success', settledAt: Math.floor(Date.now() / 1000) });
    return { recipientShare, lotteryPool, platformShare, winners };
  }

  // ---- Vote (support/oppose) ----
  async vote(uid, projectId, support) {
    // Check if user has insurance nodes
    const hasNodes = await this.insurance.hasActiveNodes(uid);
    if (!hasNodes) {
      throw new GameError(Codes.BAD_INPUT, 'Only users with insurance nodes can vote');
    }
    const existing = await this.store.getCharityVote(uid, projectId);
    if (existing) {
      throw new GameError(Codes.BAD_INPUT, 'You have already voted on this project');
    }
    await this.store.addCharityVote({
      voteId: await this.store.nextId('cvote', 'CV'),
      uid,
      projectId,
      support: support === true || support === 'true',
      createdAt: Math.floor(Date.now() / 1000),
    });
    if (support === true || support === 'true') {
      await this.store.updateCharityProject(projectId, { supportVotes: 1 }); // increment
    } else {
      await this.store.updateCharityProject(projectId, { opposeVotes: 1 });
    }
    return { projectId, support: support === true || support === 'true' };
  }

  // ---- Comment ----
  async comment(uid, projectId, content) {
    if (!content || !content.trim()) {
      throw new GameError(Codes.BAD_INPUT, 'Comment cannot be empty');
    }
    // Check if user can comment: donors on this project OR users with nodes
    const hasNodes = await this.insurance.hasActiveNodes(uid);
    const hasDonated = await this.store.hasCharityDonation(uid, projectId);
    if (!hasNodes && !hasDonated) {
      throw new GameError(Codes.BAD_INPUT, 'Only donors of this project or users with insurance nodes can comment');
    }
    let donorAmount = 0n;
    if (hasDonated) {
      donorAmount = await this.store.getCharityDonationTotal(uid, projectId);
    }
    const comment = {
      commentId: await this.store.nextId('ccomment', 'CC'),
      uid,
      projectId,
      content: String(content).slice(0, 1024),
      donorAmount,
      createdAt: Math.floor(Date.now() / 1000),
    };
    await this.store.addCharityComment(comment);
    await this.store.updateCharityProject(projectId, { commentCount: 1 }); // increment
    return comment;
  }

  // ---- Get comments ----
  async getComments(projectId, limit = 50) {
    return await this.store.listCharityComments(projectId, limit);
  }

  // ---- Admin dissolve project (refund all) ----
  async dissolve(projectId, reason) {
    const p = await this.getProject(projectId);
    if (p.status !== 'active') {
      throw new GameError(Codes.BAD_INPUT, 'Only active projects can be dissolved');
    }
    return await this.store.transaction(async () => {
      const donations = await this.store.listCharityDonations(projectId);
      for (const d of donations) {
        if (d.status === 'frozen') {
          await this.store.applyAccount(d.uid, { frozen: -d.amount, avail: d.amount });
          await this.store.addFlow(d.uid, 'CHARITY_REFUND', d.amount, { projectId, reason: reason || 'dissolved' });
          await this.store.updateCharityDonation(d.donationId, { status: 'refunded' });
        }
      }
      await this.store.updateCharityProject(projectId, { status: 'dissolved', settledAt: Math.floor(Date.now() / 1000) });
      return { projectId, status: 'dissolved', refunded: donations.length };
    }, 'charity-dissolve');
  }
}

export { CharityService };
