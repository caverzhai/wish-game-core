// =============================================================
// app.js —— 前端：English / 繁體 / 日本語；钱包连接；首页(许愿+历史)/广场/保险/我的 底部Dock
// =============================================================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortAddr = (a = '') => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const codeLen = (s) => [...String(s)].length;
const utcHM = (sec) => new Date(sec * 1000).toISOString().slice(11, 16) + ' UTC';

const I18N = {
  en: {
    appTitle: 'Three-Minute Wish Pool', loginTip: 'Connect a wallet to start. Invite links bind referrers automatically.', connectWallet: 'Connect Wallet', demoEnter: 'No wallet? Enter as demo', logout: 'Sign out',
    dockHome: 'Home', dockBbs: 'Board', dockIns: 'Insurance', dockMe: 'Me',
    remainSec: 'seconds left', lockAt: 'closed at 150s', betCount: 'Wishes', redPool: 'Red Pool', greenPool: 'Green Pool',
    oddWin: 'Odd sum → Red', evenWin: 'Even sum → Green', pickLabel: 'Pick a number (0-9)',
    amountLabel: 'Wish amount (1-99 枚, integer)', confirmWish: 'Confirm Wish', waitingStart: 'Waiting for the first wish…', historyTitle: 'Past rounds',
    insTitle: 'Wish Insurance', insSwitch: 'Insurance', premium: 'Premium', lossAccum: 'Net loss', depositPremium: 'Deposit premium',
    insRule: 'Active only when switched on and premium ≥ 20 枚. Insured winners contribute 10% to the pool; every 100 枚 net loss opens a payout node (costs 20 枚), returned over 100 periods.',
    myNodes: 'My payout nodes', poolTotal: 'Insurance pool', poolNext: 'Next release total', poolNextAt: 'Next release at', poolActiveNodes: 'Active nodes',
    poolSufficient: 'Sufficient', poolShort: 'Shortfall', poolCover: 'Coverage',
    meWallet: 'Wallet', meInvite: 'Invite', copy: 'Copy', qualifiedInvitees: 'Qualified', curRate: 'Rate', invTotal: 'Total',
    invRule: 'Tier by direct invites who ever generated a node, on wish volume: 1→0.1% / 5→0.2% / 10→0.3% / 20→0.4% / 50+→0.5%.',
    bbsTitle: 'Board (plain text, up to 100 chars)', bbsPlaceholder: 'Say something (max 100 chars)', bbsSend: 'Post', bbsEmpty: 'No posts yet. Be the first.',
    avail: 'Available', frozen: 'Held', withdraw: 'Withdraw (2-500, fee 1)', faucet: 'Claim 100 test 枚', flows: 'Transactions',
    chainOn: 'On-chain: only the platform token is accepted; the wallet transfers on each wish.', chainOff: 'Off-chain balance mode (no token configured).', chainPending: 'Submitted, waiting for confirmation…',
    stateActive: 'Live', stateLocked: 'Closed', stateSettled: 'Settled', stateCancelled: 'Void (empty), refunded', winRed: 'Red', winGreen: 'Green',
    nodeProgress: 'Progress', nodePeriod: 'Periods', pickNum: 'Pick', stake: 'Amount', detail: 'Detail', close: 'Close',
    needPick: 'Please pick a number 0-9 first', needAmount: 'Enter an integer 1-99 (枚)', copyOk: 'Copied', noWallet: 'No wallet extension detected',
    flow_BET_FROZEN: 'Wish placed', flow_WIN_CREDIT: 'Win credited', flow_INS_WIN_CUT: 'Insured 10% to pool', flow_CANCEL_REFUND: 'Void refund',
    flow_REFERRAL: 'Referral reward', flow_PREMIUM_IN: 'Premium deposit', flow_NODE_PREMIUM_OUT: 'Node premium', flow_NODE_PAYOUT: 'Node payout', flow_NODE_FORFEIT: 'Lapsed to pool',
    flow_WITHDRAW_FREEZE: 'Withdraw held', flow_WITHDRAW_DONE: 'Withdraw done', flow_WITHDRAW_FAIL: 'Withdraw returned', flow_FAUCET: 'Test claim',
    flow_CHAIN_DEPOSIT: 'On-chain deposit', flow_ISSUE: 'System credit',
  },
  'zh-TW': {
    appTitle: '三分鐘願望池', loginTip: '連接錢包即可開始，邀請連結自動綁定推薦關係', connectWallet: '連接錢包', demoEnter: '未裝錢包？以演示身份進入', logout: '退出',
    dockHome: '首頁', dockBbs: '廣場', dockIns: '保險', dockMe: '我的',
    remainSec: '剩餘秒數', lockAt: '150秒停止許願', betCount: '許願筆數', redPool: '紅願池', greenPool: '綠願池',
    oddWin: '選號總和為單 → 紅勝', evenWin: '選號總和為雙 → 綠勝', pickLabel: '選擇一個數字（0-9）',
    amountLabel: '許願金（1-99 枚，正整數）', confirmWish: '確認許願', waitingStart: '等待第一個願望進場…', historyTitle: '往期記錄',
    insTitle: '願望保險', insSwitch: '保險開關', premium: '保費餘額', lossAccum: '淨虧累計', depositPremium: '存入保費',
    insRule: '開關開且保費≥20枚才生效；生效贏家收益再扣10%入保池；淨虧每滿100枚生成一個賠付節點並扣20枚保費，節點分100期返還。',
    myNodes: '我的賠付節點', poolTotal: '保險池總資金', poolNext: '下次應釋放總額', poolNextAt: '下次釋放時間', poolActiveNodes: '待釋放節點',
    poolSufficient: '資金充足', poolShort: '資金缺口', poolCover: '覆蓋率',
    meWallet: '錢包', meInvite: '邀請返傭', copy: '複製', qualifiedInvitees: '達標好友', curRate: '返傭率', invTotal: '累計返傭',
    invRule: '名下有「生成過賠付節點」的直邀好友數決定檔位，按下注流水返傭：1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人以上0.5%。',
    bbsTitle: '廣場（100字以內純文字）', bbsPlaceholder: '說點什麼吧（最多100字）', bbsSend: '發佈', bbsEmpty: '還沒有留言，來說第一句',
    avail: '可用', frozen: '凍結', withdraw: '提現（單筆2-500，費1枚）', faucet: '測試領幣100枚', flows: '收支流水',
    chainOn: '鏈上模式：僅認可平台指定代幣，許願時直接從錢包轉帳', chainOff: '站內餘額模式（未配置鏈上代幣）', chainPending: '鏈上交易已提交，正在等待確認…',
    stateActive: '進行中', stateLocked: '已停止許願', stateSettled: '已開獎', stateCancelled: '無人對局已退款', winRed: '紅勝', winGreen: '綠勝',
    nodeProgress: '進度', nodePeriod: '已釋放期數', pickNum: '選號', stake: '投入', detail: '明細', close: '收起',
    needPick: '請先選擇 0-9 的數字', needAmount: '請輸入 1-99 的正整數（枚）', copyOk: '已複製', noWallet: '未檢測到錢包插件',
    flow_BET_FROZEN: '許願投入', flow_WIN_CREDIT: '中獎到帳', flow_INS_WIN_CUT: '保險贏家扣10%', flow_CANCEL_REFUND: '對局退款',
    flow_REFERRAL: '邀請返傭', flow_PREMIUM_IN: '存入保費', flow_NODE_PREMIUM_OUT: '節點扣保費', flow_NODE_PAYOUT: '節點賠付', flow_NODE_FORFEIT: '斷保當期充公',
    flow_WITHDRAW_FREEZE: '提現凍結', flow_WITHDRAW_DONE: '提現到帳', flow_WITHDRAW_FAIL: '提現退回', flow_FAUCET: '測試領幣',
    flow_CHAIN_DEPOSIT: '鏈上轉入', flow_ISSUE: '系統入帳',
  },
  ja: {
    appTitle: '3分間願い池', loginTip: 'ウォレット接続で開始。招待リンクで紹介者を自動登録します', connectWallet: 'ウォレット接続', demoEnter: 'ウォレットなし？デモで入る', logout: 'ログアウト',
    dockHome: 'ホーム', dockBbs: '広場', dockIns: '保険', dockMe: 'マイ',
    remainSec: '残り秒数', lockAt: '150秒で締切', betCount: '願い数', redPool: '赤の願い池', greenPool: '緑の願い池',
    oddWin: '合計が奇数 → 赤の勝ち', evenWin: '合計が偶数 → 緑の勝ち', pickLabel: '数字を選ぶ（0-9）',
    amountLabel: '願い金（1-99 枚、整数）', confirmWish: '願いを確定', waitingStart: '最初の願いを待っています…', historyTitle: '過去の記録',
    insTitle: '願い保険', insSwitch: '保険スイッチ', premium: '保険料残高', lossAccum: '純損失累計', depositPremium: '保険料を入れる',
    insRule: 'スイッチONかつ保険料≥20枚で有効。適用勝者は利益の10%を保険池へ。純損失100枚ごとに返還ノード生成（保険料20枚差引）、100期で返還。',
    myNodes: '私の返還ノード', poolTotal: '保険池の総額', poolNext: '次回解放予定額', poolNextAt: '次回解放時刻', poolActiveNodes: '解放待ちノード',
    poolSufficient: '資金十分', poolShort: '不足額', poolCover: '充足率',
    meWallet: 'ウォレット', meInvite: '招待報酬', copy: 'コピー', qualifiedInvitees: '条件達成', curRate: 'レート', invTotal: '累計報酬',
    invRule: 'ノードを生成した直招待人数で率が決定（投入額ベース）: 1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人以上0.5%。',
    bbsTitle: '広場（100文字以内のテキスト）', bbsPlaceholder: 'ひとこと（最大100文字）', bbsSend: '投稿', bbsEmpty: 'まだ投稿はありません',
    avail: '利用可能', frozen: '保留中', withdraw: '出金（2-500、手数料1枚）', faucet: 'テスト100枚受取', flows: '取引履歴',
    chainOn: 'オンチェーン：指定トークンのみ受理、願うたびウォレットから送金', chainOff: 'オフチェーン残高モード（トークン未設定）', chainPending: '送信済み、承認待ちです…',
    stateActive: '進行中', stateLocked: '締切済み', stateSettled: '確定', stateCancelled: '不成立（無人）返金', winRed: '赤勝ち', winGreen: '緑勝ち',
    nodeProgress: '進捗', nodePeriod: '解放済期', pickNum: '数字', stake: '投入', detail: '詳細', close: '閉じる',
    needPick: '先に0-9の数字を選んでください', needAmount: '1-99の整数（枚）を入力', copyOk: 'コピーしました', noWallet: 'ウォレット拡張が未検出',
    flow_BET_FROZEN: '願い投入', flow_WIN_CREDIT: '当選入金', flow_INS_WIN_CUT: '保険勝者10%', flow_CANCEL_REFUND: '不成立返金',
    flow_REFERRAL: '招待報酬', flow_PREMIUM_IN: '保険料投入', flow_NODE_PREMIUM_OUT: 'ノード保険料', flow_NODE_PAYOUT: 'ノード返還', flow_NODE_FORFEIT: '失効分を保険池へ',
    flow_WITHDRAW_FREEZE: '出金保留', flow_WITHDRAW_DONE: '出金完了', flow_WITHDRAW_FAIL: '出金差戻し', flow_FAUCET: 'テスト受取',
    flow_CHAIN_DEPOSIT: 'オンチェーン入金', flow_ISSUE: 'システム入金',
  },
};

const state = { uid: null, wallet: null, lang: localStorage.getItem('lang') || 'en', side: 'red', pick: null, chainCfg: null, me: null, round: null, recent: [], pool: null };
if (state.lang === 'zh-CN') state.lang = 'en'; // 简体已下线，旧缓存回退英文

function t(k) { return (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k; }
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('bbsInput').placeholder = t('bbsPlaceholder');
}
async function api(url, body) {
  const opt = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
  const r = await fetch(url, opt); const j = await r.json();
  if (!r.ok) throw new Error(j.message || j.error || 'error');
  return j;
}

// ---------------- 登录 ----------------
function randomDemoAddr() { let h = ''; while (h.length < 40) h += Math.random().toString(16).slice(2); return '0x' + h.slice(0, 40); }
async function doLogin(addr) {
  const ref = new URLSearchParams(location.search).get('ref');
  const u = await api('/login', { wallet: addr, inviterUid: ref || undefined });
  state.uid = u.uid; state.wallet = u.wallet;
  localStorage.setItem('uid', u.uid); localStorage.setItem('wallet', u.wallet);
  state.chainCfg = await api('/chain/config');
  enterMain();
}
async function connectWallet() {
  $('loginErr').textContent = '';
  try {
    if (!window.ethereum) { $('loginErr').textContent = t('noWallet'); return; }
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accs || !accs[0]) return;
    window.ethereum.on?.('accountsChanged', (a) => { if (a[0]) { localStorage.clear(); location.reload(); } });
    await doLogin(accs[0]);
  } catch (e) { $('loginErr').textContent = e.message || String(e); }
}
async function demoEnter() { $('loginErr').textContent = ''; try { await doLogin(randomDemoAddr()); } catch (e) { $('loginErr').textContent = e.message; } }
function enterMain() {
  $('loginMask').classList.add('hide'); $('main').classList.remove('hide'); $('dock').classList.remove('hide');
  $('who').textContent = `${state.uid} · ${shortAddr(state.wallet)}`;
  $('who').classList.remove('hide'); $('logoutBtn').classList.remove('hide');
  buildNumGrid(); renderInviteLink(); switchDock('home');
  refresh(); setInterval(refresh, 1500); setInterval(tickCountdown, 1000);
  setInterval(loadBbs, 5000);
}
function logout() { localStorage.clear(); location.reload(); }

// ---------------- Dock ----------------
function switchDock(name) {
  document.querySelectorAll('.dock-item').forEach((x) => x.classList.toggle('active', x.dataset.dock === name));
  document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
  $('tab-' + name).classList.add('active');
  if (name === 'home') renderHistory();
  if (name === 'bbs') loadBbs();
}

// ---------------- 许愿 ----------------
function buildNumGrid() {
  const g = $('numGrid'); g.innerHTML = '';
  for (let n = 0; n <= 9; n++) {
    const b = document.createElement('button');
    b.className = 'num-btn'; b.textContent = n; b.dataset.n = n;
    b.onclick = () => { state.pick = n; document.querySelectorAll('.num-btn').forEach((x) => x.classList.toggle('sel', Number(x.dataset.n) === n)); };
    g.appendChild(b);
  }
}
function selectSide(side) {
  state.side = side;
  $('sideRed').classList.toggle('sel', side === 'red'); $('sideGreen').classList.toggle('sel', side === 'green');
}
function tickCountdown() {
  if (!state.round) { $('countdown').textContent = '···'; return; }
  const remain = Math.max(0, state.round.settleAt - Math.floor(Date.now() / 1000));
  $('countdown').textContent = remain;
  $('countdown').className = 'countdown' + (remain <= 30 ? ' urgent' : '');
}
function renderRound() {
  const r = state.round;
  if (!r) { // 无局：等待第一笔许愿
    $('roundNo').textContent = '—'; $('roundState').textContent = t('waitingStart');
    $('betCount').textContent = 0; $('countdown').textContent = '···'; $('countdown').className = 'countdown';
  } else {
    $('roundNo').textContent = r.roundId;
    $('roundState').textContent = t('state' + ({ active: 'Active', locked: 'Locked', settled: 'Settled', cancelled: 'Cancelled' }[r.state] || 'Active'));
    $('betCount').textContent = r.betCount ?? 0;
    tickCountdown();
  }
  const dots = state.recent.filter((x) => x.state === 'settled').slice(0, 100).map((x) => {
    const win = x.result && x.result.winSide;
    return `<span class="dot ${win}" title="${x.roundId}"></span>`;
  }).join('');
  $('histDots').innerHTML = dots || '<span class="muted">—</span>';
}
function erc20TransferData(to, amountCoin, decimals) {
  const sel = 'a9059cbb';
  const addr = to.toLowerCase().replace('0x', '').padStart(64, '0');
  const v = BigInt(amountCoin) * (10n ** BigInt(decimals || 18));
  return '0x' + sel + addr + v.toString(16).padStart(64, '0');
}
async function submitWish() {
  const amount = Number($('amountInput').value);
  $('playMsg').className = 'msg'; $('playMsg').textContent = '';
  if (state.pick === null) { $('playMsg').textContent = t('needPick'); return; }
  if (!Number.isInteger(amount) || amount < 1 || amount > 99) { $('playMsg').textContent = t('needAmount'); return; }
  const side = state.side, pick = state.pick, uid = state.uid;
  try {
    if (state.chainCfg && state.chainCfg.enabled && window.ethereum) {
      const data = erc20TransferData(state.chainCfg.platformAddress, amount, state.chainCfg.decimals);
      let txHash;
      try { txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: state.wallet, to: state.chainCfg.tokenContract, data }] }); }
      catch (e) { $('playMsg').textContent = e.message || String(e); return; }
      $('playMsg').textContent = t('chainPending');
      for (let i = 0; i < 12; i++) {
        await sleep(4000);
        try { await api('/bet/onchain', { uid, side, amount, pick, txHash }); $('playMsg').textContent = '✓'; $('amountInput').value = ''; return refresh(); }
        catch (e) { if (!/确认|查到|尚未|停止|confirm|waiting|承認|確認/.test(e.message)) { $('playMsg').textContent = e.message; return; } }
      }
      $('playMsg').textContent = 'tx: ' + shortAddr(txHash);
    } else {
      await api('/bet', { uid, side, amount, pick });
      $('amountInput').value = ''; await refresh();
    }
  } catch (e) { $('playMsg').textContent = e.message; }
}

// ---------------- 历史（首页） ----------------
async function renderHistory() {
  const list = $('historyList');
  list.innerHTML = state.recent.map((r) => {
    const win = r.result && r.result.winSide;
    return `<div class="hist-row" data-id="${r.roundId}">
      <span class="dot ${win || 'void'}"></span><b>${r.roundId}</b>
      <span>${r.state === 'settled' ? (win === 'red' ? t('winRed') : t('winGreen')) : t('state' + (r.state === 'cancelled' ? 'Cancelled' : 'Active'))}</span>
      <span class="muted">${r.state === 'settled' ? `${fmt(Number(r.result.total) / 1e6)} 枚 · Σ=${r.sumPick}` : ''}</span>
      <button class="btn-mini" data-detail="${r.roundId}">${t('detail')}</button>
      <div class="hist-detail hide" id="hd-${r.roundId}"></div></div>`;
  }).join('') || '<p class="muted">—</p>';
  list.querySelectorAll('[data-detail]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.detail, box = $('hd-' + id);
    if (!box.classList.contains('hide')) { box.classList.add('hide'); b.textContent = t('detail'); return; }
    const d = await api('/round/' + id);
    box.innerHTML = (d.bets || []).map((x) => `<div class="bet-line"><span class="tag ${x.side}">${x.side === 'red' ? t('winRed') : t('winGreen')}</span> ${x.uid} · ${t('stake')} ${fmt(Number(x.amount) / 1e6)} · ${t('pickNum')} ${x.pick}</div>`).join('');
    box.classList.remove('hide'); b.textContent = t('close');
  });
}

// ---------------- 保险池公示（动态） ----------------
function renderPoolPublic() {
  const p = state.pool; if (!p) return;
  const total = Number(p.poolBalance), next = Number(p.nextDueTotal);
  const cover = next > 0 ? Math.round((total / next) * 100) : 100;
  const gap = Number(p.gap);
  const ok = p.sufficient;
  const barW = next > 0 ? Math.min(100, Math.round((total / next) * 100)) : 100;
  $('poolPublicCard').innerHTML = `
    <div class="pp-grid">
      <div class="pp-box big"><span>${t('poolTotal')}</span><b>${fmt(total)} 枚</b></div>
      <div class="pp-box"><span>${t('poolNext')}</span><b>${fmt(next)} 枚</b></div>
      <div class="pp-box"><span>${t('poolNextAt')}</span><b>${utcHM(p.nextBatchAt)}</b></div>
      <div class="pp-box"><span>${t('poolActiveNodes')}</span><b>${p.nextPayNodeCount}/${p.activeNodeCount}</b></div>
    </div>
    <div class="pp-bar"><i class="${ok ? 'ok' : 'bad'}" style="width:${barW}%"></i></div>
    <div class="pp-foot ${ok ? 'ok' : 'bad'}">${t('poolCover')} ${next > 0 ? cover : '—'}% · ${ok ? t('poolSufficient') : t('poolShort')} ${ok ? '' : fmt(Math.abs(gap)) + ' 枚'}</div>`;
  $('poolPublicMini').innerHTML = `<span>${t('poolTotal')} <b>${fmt(total)}</b> 枚</span><span>${t('poolNext')} <b>${fmt(next)}</b> 枚</span><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'} ${ok ? t('poolSufficient') : t('poolShort')}</span>`;
}

// ---------------- 我的（钱包+邀请） ----------------
function renderMe() {
  const me = state.me; if (!me) return;
  const a = me.account;
  $('availBal').textContent = fmt(a.available) + ' 枚'; $('frozenBal').textContent = fmt(a.frozen) + ' 枚';
  $('premiumBal').textContent = fmt(a.premium) + ' 枚'; $('premiumBal2').textContent = fmt(a.premium) + ' 枚';
  $('lossAccum').textContent = fmt(a.lossAccum) + ' 枚';
  $('insSwitchState').textContent = me.user.insSwitch ? 'ON' : 'OFF';
  $('insSwitchBtn').textContent = me.user.insSwitch ? 'OFF' : 'ON';
  $('invCount').textContent = me.invite.nodeInviteeCount;
  $('invRate').textContent = (me.invite.perMille / 10).toFixed(1) + '%';
  $('invTotal').textContent = fmt(me.invite.rewardTotal) + ' 枚';
  $('nodeList').innerHTML = me.nodes.length ? me.nodes.map((n) => {
    const pct = Math.round((n.periodN / 100) * 100);
    return `<div class="node-row"><b>${n.nodeId}</b><span>${t('nodePeriod')} ${n.periodN}/100</span><div class="bar"><i style="width:${pct}%"></i></div><span>${t('nodeProgress')} ${pct}%</span></div>`;
  }).join('') : '<p class="muted">—</p>';
  $('flowList').innerHTML = me.flows.map((f) => `<div class="flow-line"><span>${t('flow_' + f.bizType) || f.bizType}</span><b>${fmt(f.amount)} 枚</b><small>${new Date(f.at).toLocaleString()}</small></div>`).join('') || '<p class="muted">—</p>';
  const tip = $('chainModeTip');
  tip.classList.remove('hide'); tip.textContent = (state.chainCfg && state.chainCfg.enabled) ? t('chainOn') : t('chainOff');
}
function renderInviteLink() { $('inviteLink').value = `${location.origin}${location.pathname}?ref=${state.uid}`; }

// ---------------- 广场 ----------------
async function loadBbs() {
  if (!$('tab-bbs').classList.contains('active')) return;
  const posts = await api('/bbs/list');
  $('bbsList').innerHTML = posts.length ? posts.map((p) => `<div class="bbs-item"><div class="bbs-head"><b>${shortAddr(p.wallet || p.uid)}</b><small>${new Date(p.at).toLocaleString()}</small></div><div class="bbs-text">${escapeHtml(p.content)}</div></div>`).join('') : `<p class="muted">${t('bbsEmpty')}</p>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
async function postBbs() {
  const content = $('bbsInput').value.trim();
  if (codeLen(content) < 1 || codeLen(content) > 100) return;
  await api('/bbs/post', { uid: state.uid, content });
  $('bbsInput').value = ''; $('bbsChar').textContent = '0/100'; await loadBbs();
}

// ---------------- 动作 ----------------
async function switchIns() { const me = state.me; await api('/insurance/switch', { uid: state.uid, on: !me.user.insSwitch }); refresh(); }
async function depositPremium() { const v = Number($('premiumInput').value); if (!v) return; await api('/insurance/deposit', { uid: state.uid, amount: v }); $('premiumInput').value = ''; refresh(); }
async function withdraw() { const v = Number($('wdInput').value); if (!v) return; try { const r = await api('/withdraw', { uid: state.uid, amount: v }); alert(r.paid === false ? (r.payoutError || 'pending') : 'OK'); $('wdInput').value = ''; refresh(); } catch (e) { alert(e.message); } }
async function faucet() { try { await api('/faucet', { uid: state.uid, amount: 100 }); refresh(); } catch (e) { alert(e.message); } }

async function refresh() {
  if (!state.uid) return;
  try {
    const [r, recent, me, pool] = await Promise.all([api('/round/current'), api('/recent'), api('/user/' + state.uid), api('/insurance/pool')]);
    state.round = r; state.recent = recent; state.me = me; state.pool = pool;
    renderRound(); renderMe(); renderPoolPublic();
    if ($('tab-home').classList.contains('active')) renderHistory();
  } catch (e) { /* 下一轮自愈 */ }
}

// ---------------- 初始化 ----------------
function init() {
  $('langSel').value = state.lang; applyI18n();
  $('langSel').onchange = (e) => { state.lang = e.target.value; localStorage.setItem('lang', state.lang); applyI18n(); refresh(); };
  $('connectBtn').onclick = connectWallet; $('demoBtn').onclick = demoEnter; $('logoutBtn').onclick = logout;
  $('sideRed').onclick = () => selectSide('red'); $('sideGreen').onclick = () => selectSide('green');
  $('betBtn').onclick = submitWish;
  document.querySelectorAll('.dock-item').forEach((d) => d.onclick = () => switchDock(d.dataset.dock));
  $('insSwitchBtn').onclick = switchIns; $('premiumBtn').onclick = depositPremium;
  $('wdBtn').onclick = withdraw; $('faucetBtn').onclick = faucet;
  $('copyInvBtn').onclick = () => { navigator.clipboard?.writeText($('inviteLink').value); alert(t('copyOk')); };
  $('bbsSend').onclick = postBbs;
  $('bbsInput').oninput = () => { $('bbsChar').textContent = codeLen($('bbsInput').value) + '/100'; };
  selectSide('red');
  const uid = localStorage.getItem('uid'), wallet = localStorage.getItem('wallet');
  if (uid && wallet) { state.uid = uid; state.wallet = wallet; api('/chain/config').then((c) => { state.chainCfg = c; enterMain(); }); }
}
init();
