// TaskService.js - Find the Right Person (Task Marketplace)
// Users post tasks with full reward escrowed. Others apply. Poster picks one.
// Worker delivers proof. Poster confirms and releases funds (15-day auto-release).
// Disputes: refund request or payment refusal -> evidence -> community vote (node holders) -> admin ruling.

import { GameError, Codes } from './errors.js';
import { coin, SCALE } from './money.js';

const AUTO_RELEASE_DAYS = 15;
const AUTO_RELEASE_SEC = AUTO_RELEASE_DAYS * 24 * 3600;

class TaskService {
  constructor(store, cfg, insurance) {
    this.store = store;
    this.cfg = cfg;
    this.insurance = insurance;
    this.COIN = SCALE;
  }

  // ---- Create task (escrow full reward) ----
  async createJob(uid, data) {
    const { title, description, location, deadline, reward } = data;
    const missing = [];
    if (!title) missing.push('Title');
    if (!description) missing.push('Description');
    if (!reward) missing.push('Reward');
    if (missing.length > 0) {
      throw new GameError(Codes.BAD_INPUT, 'Missing required fields: ' + missing.join(', '));
    }
    const rewardNum = Number(reward);
    if (!Number.isFinite(rewardNum) || rewardNum <= 0 || !Number.isInteger(rewardNum)) {
      throw new GameError(Codes.BAD_INPUT, 'Reward must be a positive integer');
    }
    const rewardCoin = BigInt(rewardNum) * this.COIN;
    const now = Math.floor(Date.now() / 1000);
    const jobId = await this.store.nextId('task', 'TK');

    return await this.store.transaction(async () => {
      const acc = await this.store.getAccount(uid);
      if (acc.available < rewardCoin) {
        throw new GameError(Codes.INSUFFICIENT_BALANCE, 'Insufficient balance to escrow reward');
      }
      await this.store.applyAccount(uid, { avail: -rewardCoin, frozen: rewardCoin });
      await this.store.addFlow(uid, 'TASK_ESCROW', rewardCoin, { jobId });

      const job = {
        jobId, uid,
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 5000),
        location: location ? String(location).slice(0, 200) : '',
        image: image ? String(image).slice(0, 500000) : '',
        deadline: deadline ? Number(deadline) : 0,
        reward: rewardCoin,
        status: 'open',
        createdAt: now,
      };
      await this.store.insertTaskJob(job);
      return job;
    }, 'task-create');
  }

  // ---- List jobs ----
  async listJobs(limit = 50, offset = 0, status = null) {
    return await this.store.listTaskJobs(limit, offset, status);
  }

  // ---- My jobs (posted or assigned) ----
  async myJobs(uid, limit = 50) {
    return await this.store.listTaskJobsByUid(uid, limit);
  }

  // ---- Get job detail ----
  async getJob(jobId) {
    const j = await this.store.getTaskJob(jobId);
    if (!j) throw new GameError(Codes.NOT_FOUND, 'Task not found');
    return j;
  }

  // ---- Apply for job ----
  async apply(uid, jobId, message) {
    const job = await this.getJob(jobId);
    if (job.status !== 'open') {
      throw new GameError(Codes.BAD_INPUT, 'Task is not accepting applications');
    }
    if (job.uid === uid) {
      throw new GameError(Codes.BAD_INPUT, 'You cannot apply to your own task');
    }
    const applicationId = await this.store.nextId('tapply', 'TA');
    const app = {
      applicationId, jobId, uid,
      message: message ? String(message).slice(0, 1000) : '',
      status: 'pending',
      createdAt: Math.floor(Date.now() / 1000),
    };
    await this.store.insertTaskApplication(app);
    return app;
  }

  // ---- List applications ----
  async listApplications(jobId) {
    return await this.store.listTaskApplications(jobId);
  }

  // ---- Accept application (poster only) ----
  async acceptApplication(uid, jobId, applicationId) {
    const job = await this.getJob(jobId);
    if (job.uid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the task poster can accept applications');
    }
    if (job.status !== 'open') {
      throw new GameError(Codes.BAD_INPUT, 'Task is not in open status');
    }
    const app = await this.store.getTaskApplication(applicationId);
    if (!app || app.jobId !== jobId) {
      throw new GameError(Codes.NOT_FOUND, 'Application not found');
    }
    if (app.status !== 'pending') {
      throw new GameError(Codes.BAD_INPUT, 'Application already processed');
    }
    const now = Math.floor(Date.now() / 1000);
    await this.store.updateTaskApplication(applicationId, { status: 'accepted' });
    // Reject all other pending applications
    const allApps = await this.store.listTaskApplications(jobId);
    for (const a of allApps) {
      if (a.applicationId !== applicationId && a.status === 'pending') {
        await this.store.updateTaskApplication(a.applicationId, { status: 'rejected' });
      }
    }
    await this.store.updateTaskJob(jobId, {
      status: 'assigned',
      assignedUid: app.uid,
      assignedAt: now,
    });
    return { jobId, assignedUid: app.uid, status: 'assigned' };
  }

  // ---- Post message (public chat on job) ----
  async postMessage(uid, jobId, content) {
    if (!content || !content.trim()) {
      throw new GameError(Codes.BAD_INPUT, 'Message cannot be empty');
    }
    const job = await this.getJob(jobId);
    const messageId = await this.store.nextId('tmsg', 'TM');
    const msg = {
      messageId, jobId, uid,
      content: String(content).slice(0, 1000),
      createdAt: Math.floor(Date.now() / 1000),
    };
    await this.store.insertTaskMessage(msg);
    return msg;
  }

  // ---- List messages ----
  async listMessages(jobId, limit = 100) {
    return await this.store.listTaskMessages(jobId, limit);
  }

  // ---- Submit delivery (worker only) ----
  async submitDelivery(uid, jobId, content, proof) {
    const job = await this.getJob(jobId);
    if (job.assignedUid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the assigned worker can submit delivery');
    }
    if (job.status !== 'assigned' && job.status !== 'in_progress') {
      throw new GameError(Codes.BAD_INPUT, 'Task is not in a state that accepts delivery');
    }
    if (!content && !proof) {
      throw new GameError(Codes.BAD_INPUT, 'Delivery content or proof is required');
    }
    const now = Math.floor(Date.now() / 1000);
    const deliveryId = await this.store.nextId('tdeliv', 'TD');
    const delivery = {
      deliveryId, jobId, uid,
      content: content ? String(content).slice(0, 5000) : '',
      proof: proof ? String(proof) : '',
      createdAt: now,
    };
    await this.store.insertTaskDelivery(delivery);
    await this.store.updateTaskJob(jobId, {
      status: 'delivered',
      deliveredAt: now,
      autoReleaseAt: now + AUTO_RELEASE_SEC,
    });
    return delivery;
  }

  // ---- List deliveries ----
  async listDeliveries(jobId) {
    return await this.store.listTaskDeliveries(jobId);
  }

  // ---- Confirm and release payment (poster only) ----
  async confirmDelivery(uid, jobId, rating, reviewContent) {
    const job = await this.getJob(jobId);
    if (job.uid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the task poster can confirm delivery');
    }
    if (job.status !== 'delivered') {
      throw new GameError(Codes.BAD_INPUT, 'Task is not in delivered status');
    }
    const now = Math.floor(Date.now() / 1000);

    return await this.store.transaction(async () => {
      const j = await this.store.getTaskJobForUpdate(jobId);
      if (j.status !== 'delivered') {
        throw new GameError(Codes.BAD_INPUT, 'Task status changed, please refresh');
      }
      // Release frozen reward to worker
      await this.store.applyAccount(j.uid, { frozen: -j.reward });
      await this.store.applyAccount(j.assignedUid, { avail: j.reward });
      await this.store.addFlow(j.assignedUid, 'TASK_PAYMENT', j.reward, { jobId });

      await this.store.updateTaskJob(jobId, { status: 'completed', completedAt: now, autoReleaseAt: null });

      // Save review if provided
      if (rating) {
        const reviewId = await this.store.nextId('treview', 'TR');
        await this.store.insertTaskReview({
          reviewId, jobId,
          reviewerUid: uid,
          revieweeUid: j.assignedUid,
          rating: Math.min(5, Math.max(1, Number(rating))),
          content: reviewContent ? String(reviewContent).slice(0, 500) : '',
          createdAt: now,
        });
      }
      return { jobId, status: 'completed', released: j.reward };
    }, 'task-confirm');
  }

  // ---- Request refund (poster, before delivery) ----
  async requestRefund(uid, jobId, reason) {
    const job = await this.getJob(jobId);
    if (job.uid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the task poster can request refund');
    }
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new GameError(Codes.BAD_INPUT, 'Task already completed or cancelled');
    }
    if (!reason) {
      throw new GameError(Codes.BAD_INPUT, 'Refund reason is required');
    }

    // If no worker assigned yet, refund immediately
    if (job.status === 'open') {
      return await this._cancelAndRefund(jobId, 'cancelled by poster before assignment');
    }

    // Otherwise create dispute
    const disputeId = await this.store.nextId('tdispute', 'TDP');
    await this.store.insertTaskDispute({
      disputeId, jobId, type: 'refund',
      initiatorUid: uid,
      reason: String(reason).slice(0, 2000),
      proof: '',
      status: 'open',
      createdAt: Math.floor(Date.now() / 1000),
    });
    await this.store.updateTaskJob(jobId, { status: 'disputed' });
    return { disputeId, jobId, status: 'disputed', type: 'refund' };
  }

  // ---- Worker agrees to refund ----
  async agreeRefund(uid, jobId) {
    const job = await this.getJob(jobId);
    if (job.assignedUid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the assigned worker can agree to refund');
    }
    const dispute = await this.store.getTaskDisputeByJob(jobId);
    if (!dispute || dispute.type !== 'refund') {
      throw new GameError(Codes.BAD_INPUT, 'No active refund dispute');
    }
    await this.store.updateTaskDispute(dispute.disputeId, { status: 'resolved', adminDecision: 'worker_agreed', resolvedAt: Math.floor(Date.now() / 1000) });
    return await this._cancelAndRefund(jobId, 'worker agreed to refund');
  }

  // ---- Worker disagrees with refund, submits proof -> voting ----
  async disputeRefund(uid, jobId, reason, proof) {
    const job = await this.getJob(jobId);
    if (job.assignedUid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the assigned worker can dispute');
    }
    const dispute = await this.store.getTaskDisputeByJob(jobId);
    if (!dispute || dispute.type !== 'refund') {
      throw new GameError(Codes.BAD_INPUT, 'No active refund dispute');
    }
    await this.store.updateTaskDispute(dispute.disputeId, {
      status: 'voting',
      reason: dispute.reason + ' | Worker response: ' + String(reason || '').slice(0, 1000),
      proof: proof ? String(proof) : dispute.proof,
    });
    return { disputeId: dispute.disputeId, status: 'voting' };
  }

  // ---- Poster refuses payment after delivery -> dispute ----
  async refusePayment(uid, jobId, reason, proof) {
    const job = await this.getJob(jobId);
    if (job.uid !== uid) {
      throw new GameError(Codes.FORBIDDEN, 'Only the task poster can refuse payment');
    }
    if (job.status !== 'delivered') {
      throw new GameError(Codes.BAD_INPUT, 'Can only refuse payment in delivered status');
    }
    if (!reason) {
      throw new GameError(Codes.BAD_INPUT, 'Refusal reason is required');
    }
    const disputeId = await this.store.nextId('tdispute', 'TDP');
    await this.store.insertTaskDispute({
      disputeId, jobId, type: 'payment',
      initiatorUid: uid,
      reason: String(reason).slice(0, 2000),
      proof: proof ? String(proof) : '',
      status: 'voting',
      createdAt: Math.floor(Date.now() / 1000),
    });
    await this.store.updateTaskJob(jobId, { status: 'disputed', autoReleaseAt: null });
    return { disputeId, jobId, status: 'disputed', type: 'payment' };
  }

  // ---- Vote on dispute (node holders only, one vote per dispute) ----
  async vote(uid, disputeId, support) {
    const hasNodes = await this.insurance.hasActiveNodes(uid);
    if (!hasNodes) {
      throw new GameError(Codes.BAD_INPUT, 'Only users with insurance nodes can vote');
    }
    const dispute = await this.store.getTaskDispute(disputeId);
    if (!dispute) throw new GameError(Codes.NOT_FOUND, 'Dispute not found');
    if (dispute.status !== 'voting') {
      throw new GameError(Codes.BAD_INPUT, 'Dispute is not in voting phase');
    }
    const existing = await this.store.getTaskVote(uid, disputeId);
    if (existing) {
      throw new GameError(Codes.BAD_INPUT, 'You have already voted on this dispute');
    }
    const voteId = await this.store.nextId('tvote', 'TV');
    await this.store.insertTaskVote({
      voteId, disputeId, uid,
      support: support === true || support === 'true',
      createdAt: Math.floor(Date.now() / 1000),
    });
    if (support === true || support === 'true') {
      await this.store.updateTaskDispute(disputeId, { supportVotes: dispute.supportVotes + 1 });
    } else {
      await this.store.updateTaskDispute(disputeId, { opposeVotes: dispute.opposeVotes + 1 });
    }
    return { disputeId, support: support === true || support === 'true' };
  }

  // ---- Admin ruling ----
  async adminRule(uid, disputeId, decision) {
    // decision: 'refund' (money back to poster) or 'pay' (money to worker)
    const dispute = await this.store.getTaskDispute(disputeId);
    if (!dispute) throw new GameError(Codes.NOT_FOUND, 'Dispute not found');
    if (dispute.status === 'resolved') {
      throw new GameError(Codes.BAD_INPUT, 'Dispute already resolved');
    }
    const now = Math.floor(Date.now() / 1000);
    await this.store.updateTaskDispute(disputeId, {
      status: 'resolved',
      adminDecision: decision,
      adminUid: uid,
      resolvedAt: now,
    });

    const job = await this.getJob(dispute.jobId);
    if (decision === 'refund') {
      return await this._cancelAndRefund(dispute.jobId, 'admin ruled refund');
    } else if (decision === 'pay') {
      return await this.store.transaction(async () => {
        const j = await this.store.getTaskJobForUpdate(dispute.jobId);
        await this.store.applyAccount(j.uid, { frozen: -j.reward });
        await this.store.applyAccount(j.assignedUid, { avail: j.reward });
        await this.store.addFlow(j.assignedUid, 'TASK_PAYMENT', j.reward, { jobId: j.jobId, disputeId });
        await this.store.updateTaskJob(j.jobId, { status: 'completed', completedAt: now, autoReleaseAt: null });
        return { jobId: j.jobId, status: 'completed', released: j.reward, ruling: 'pay' };
      }, 'task-admin-pay');
    }
    throw new GameError(Codes.BAD_INPUT, 'Invalid decision');
  }

  // ---- Auto-release (called by scheduler for delivered jobs past 15 days) ----
  async autoRelease(jobId) {
    const job = await this.getJob(jobId);
    if (job.status !== 'delivered' || !job.autoReleaseAt) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now < job.autoReleaseAt) return null;

    return await this.store.transaction(async () => {
      const j = await this.store.getTaskJobForUpdate(jobId);
      if (j.status !== 'delivered' || !j.autoReleaseAt || now < j.autoReleaseAt) return null;
      await this.store.applyAccount(j.uid, { frozen: -j.reward });
      await this.store.applyAccount(j.assignedUid, { avail: j.reward });
      await this.store.addFlow(j.assignedUid, 'TASK_AUTO_RELEASE', j.reward, { jobId });
      await this.store.updateTaskJob(jobId, { status: 'completed', completedAt: now, autoReleaseAt: null });
      return { jobId, status: 'completed', released: j.reward, auto: true };
    }, 'task-auto-release');
  }

  // ---- Internal: cancel and refund ----
  async _cancelAndRefund(jobId, reason) {
    return await this.store.transaction(async () => {
      const j = await this.store.getTaskJobForUpdate(jobId);
      if (j.status === 'completed' || j.status === 'cancelled') {
        return { jobId, status: j.status, refunded: 0n };
      }
      await this.store.applyAccount(j.uid, { frozen: -j.reward, avail: j.reward });
      await this.store.addFlow(j.uid, 'TASK_REFUND', j.reward, { jobId, reason });
      await this.store.updateTaskJob(jobId, { status: 'cancelled', completedAt: Math.floor(Date.now() / 1000), autoReleaseAt: null });
      return { jobId, status: 'cancelled', refunded: j.reward };
    }, 'task-cancel-refund');
  }

  // ---- List reviews ----
  async listReviews(jobId) {
    return await this.store.listTaskReviews(jobId);
  }
}

export { TaskService };
