// =============================================================
// NpcService.js - Automated NPC bots for social engagement only
// NPCs post in BBS square and chat rooms, NEVER place bets
// All content in English
// =============================================================
const nowSec = () => Math.floor(Date.now() / 1000);

// English content pool: gameplay tips, platform principles, tutorials
const NPC_CONTENT = [
  // Gameplay tips
  "How to play: Choose Red Pool or Green Pool, deposit 1-99 coins, pick a number 0-9. If the sum of all numbers is odd, Red wins; if even, Green wins. 2.5% fee deducted, winners split by stake ratio.",
  "Insurance guide: Deposit at least 20 coins and turn on insurance. If you win, 10% of your profit goes to the insurance pool. If you lose and accumulate 100 coins in losses, a payout node is created and returned over 100 periods.",
  "Referral rewards: Share your invite link. Friends who register via your link become your downline. Regular users earn 0.1% on direct referrals. Whitelist team leaders can earn higher rates with multi-level commissions.",
  "Withdrawal info: Winnings go directly to your balance. Withdraw anytime, 2-500 coins per withdrawal, fixed 1 coin fee. No waiting, no review, no hold.",
  "Transparency: After each round ends, every player's bet amount and number choice are revealed publicly. Fair, open, and verifiable for everyone.",
  "History check: The homepage shows the last 100 rounds of Red/Green results. Study patterns and make your own strategy.",
  "Insurance payout: Every 6 hours at UTC 03:00, 09:00, 15:00, 21:00. If you generated a new node within 168 hours, all your active nodes release normally. Otherwise, the current period goes back to the pool for everyone.",
  "Strategy tip: Numbers 0-9 are all blind picks. Every player influences the final result. Both Red and Green pools are open, choose wisely.",
  // Platform principles
  "Our principle: Fairness first. Every bet is recorded on-chain, every result is publicly verifiable. No house edge beyond the stated 2.5% fee.",
  "Platform philosophy: We believe in transparent entertainment. Everyone can see the rules, everyone can verify the results, everyone gets paid instantly.",
  "Community driven: This platform is built for the community. Chat rooms, forums, and referral systems are all designed to let users connect and grow together.",
  "No hidden fees: What you see is what you get. 2.5% platform fee on every round, 1 coin withdrawal fee. That's it. No surprises.",
  "Open source mindset: Our logic is transparent. The insurance pool balance, next payout amount, and round history are all visible to everyone in real time.",
  // Tutorials
  "New here? Step 1: Connect your wallet. Step 2: Choose Red or Green. Step 3: Enter 1-99 coins and pick 0-9. Step 4: Wait 180 seconds. That's all it takes!",
  "Insurance tutorial: Go to the Insurance tab, deposit at least 20 coins, toggle the switch ON. Now your wins contribute 10% to the pool, and your losses are protected with payout nodes.",
  "How to invite: Go to My tab, copy your invite link or scan the QR code. Share it anywhere. Anyone who joins via your link is permanently your referral.",
  "Chat room guide: 1 coin opens a chat room where everyone can type and send voice messages (up to 30s). Meeting rooms cost 5 coins, max 2 speakers, others type.",
  "Room recharge: Anyone in a room can add time. Click 'Add Time' to extend the room. Chat rooms stay open as long as there's balance.",
  "Whitelist program: If you have a strong team and understand our platform, post in the square. The official team may reach out to offer higher commission rates and multi-level rewards.",
  // Engagement
  "Anyone else playing tonight? Share your strategy below!",
  "Just had a great round. The transparency here is refreshing compared to other platforms.",
  "Tip: Turn on insurance if you plan to play multiple rounds. It smooths out the variance significantly.",
  "The chat rooms are a great place to learn from experienced players. Join one and ask questions!",
  "Remember: this is entertainment first. Play responsibly and have fun.",
];

export class NpcService {
  constructor(app) {
    this.app = app;
    this.store = app.store;
    this.game = app.game;
    this.social = app.social;
    this.voice = app.voice;
  }

  async addNpc(name) {
    const wallet = 'NPC_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const user = await this.game.register(wallet, null, nowSec());
    const npc = {
      npcId: await this.store.nextId('npc', 'NPC'),
      uid: user.uid,
      wallet,
      name: name || ('NPC-' + user.uid.slice(-4)),
      enabled: true,
      createdAt: nowSec(),
      lastPostAt: 0,
      lastChatAt: 0,
      nextPostAt: this._rollNextTime(),
      nextChatAt: this._rollNextTime(),
    };
    await this.store.insertNpc(npc);
    return npc;
  }

  async removeNpc(npcId) {
    return await this.store.removeNpc(npcId);
  }

  async listNpcs() {
    return await this.store.listNpcs();
  }

  _rollNextTime() {
    // Random time within next 20-60 minutes
    return nowSec() + Math.floor(Math.random() * 2400) + 1200;
  }

  _rollRetryTime() {
    return nowSec() + Math.floor(Math.random() * 120) + 60;
  }

  _pickContent() {
    return NPC_CONTENT[Math.floor(Math.random() * NPC_CONTENT.length)];
  }

  async tick(nowSecVal) {
    const npcs = await this.store.listNpcs();
    const actions = { posts: [], chats: [] };
    for (const npc of npcs) {
      if (!npc.enabled) continue;

      // Random BBS post
      if (nowSecVal >= npc.nextPostAt) {
        let ok = false;
        try {
          const content = this._pickContent();
          await this.social.post(npc.uid, content);
          actions.posts.push({ npc: npc.name });
          ok = true;
        } catch (e) {
          // Banned or other error, skip
        }
        try {
          await this.store.updateNpc(npc.npcId, {
            lastPostAt: ok ? nowSecVal : npc.lastPostAt,
            nextPostAt: ok ? this._rollNextTime() : this._rollRetryTime(),
          });
        } catch (e) { console.error('[npc:updatePost]', e.message); }
      }

      // Random chat room message
      if (nowSecVal >= npc.nextChatAt) {
        let ok = false;
        try {
          const rooms = this.voice.listRooms ? this.voice.listRooms() : [];
          // Pick from top rooms (by member count)
          const sorted = rooms
            .filter(r => r.type === 'chat')
            .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
            .slice(0, 10);
          if (sorted.length > 0) {
            const room = sorted[Math.floor(Math.random() * sorted.length)];
            // NPC joins, sends message, then leaves (so it doesn't affect member count / billing)
            try { await this.voice.join(room.roomId, npc.uid); } catch { /* already in or room full */ }
            const content = this._pickContent();
            try {
              await this.voice.sendMessage(room.roomId, npc.uid, { type: 'text', content });
              actions.chats.push({ npc: npc.name, room: room.name });
              ok = true;
            } catch { /* send failed */ }
            try { await this.voice.leave(room.roomId, npc.uid); } catch { /* */ }
          }
        } catch (e) {
          // Voice service not ready or no rooms
        }
        try {
          await this.store.updateNpc(npc.npcId, {
            lastChatAt: ok ? nowSecVal : npc.lastChatAt,
            nextChatAt: ok ? this._rollNextTime() : this._rollRetryTime(),
          });
        } catch (e) { console.error('[npc:updateChat]', e.message); }
      }
    }
    return actions;
  }
}
