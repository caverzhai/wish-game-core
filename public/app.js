// =============================================================
// app.js —— 前端：四语 i18n / 钱包连接登录 / 对局 / 保险 / 邀请 / BBS / 钱包
// 链上模式由 GET /chain/config 决定：启用且检测到钱包则走「转账即下注」，否则站内余额模式
// =============================================================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortAddr = (a = '') => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const codeLen = (s) => [...String(s)].length;

// ---------------- i18n ----------------
const I18N = {
  'zh-CN': {
    appTitle: '3分钟愿望实现', loginTip: '连接钱包即可开始，邀请链接自动绑定推荐关系', connectWallet: '连接钱包', demoEnter: '未装钱包？以演示身份进入', logout: '退出',
    tabPlay: '对局', tabHistory: '历史', tabIns: '保险', tabInvite: '邀请', tabBbs: '广场', tabWallet: '钱包',
    remainSec: '剩余秒数', lockAt: '150秒封盘', betCount: '参与笔数', redPool: '红愿池', greenPool: '绿愿池',
    oddWin: '选号总和为单 → 红胜', evenWin: '选号总和为双 → 绿胜', pickLabel: '选择一个数字（0-9）',
    amountLabel: '许愿金（1-99 枚，正整数）', confirmWish: '确认许愿', recent100: '近100场（开奖后全员投入与选号全公开）',
    insTitle: '愿望保险', insSwitch: '保险开关', premium: '保费余额', lossAccum: '净亏累计', depositPremium: '存入保费',
    insRule: '开关开且保费≥20枚才生效；生效赢家收益再扣10%入保池；净亏每满100枚生成一个赔付节点并扣20枚保费，节点分100期返还。',
    myNodes: '我的赔付节点', invTitle: '邀请返佣', copy: '复制', qualifiedInvitees: '达标好友', curRate: '当前返佣率', invTotal: '累计返佣',
    invRule: '名下有「生成过赔付节点」的直邀好友数决定档位，按下注流水返佣：1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人以上0.5%。',
    bbsTitle: '广场（100字以内纯文字）', bbsPlaceholder: '说点什么吧（最多100字）', bbsSend: '发布', bbsEmpty: '还没有留言，来说第一句',
    walletTitle: '我的钱包', avail: '可用', frozen: '冻结', withdraw: '提现（单笔2-500，费1枚）', faucet: '测试领币100枚（站内模式）', flows: '收支流水',
    chainOn: '链上模式：仅认可平台指定代币，许愿时直接从钱包转账', chainOff: '站内余额模式（未配置链上代币）', chainPending: '链上交易已提交，正在等待确认…',
    stateActive: '进行中', stateLocked: '已封盘', stateSettled: '已开奖', stateCancelled: '流局(无人)已退款', winRed: '红胜', winGreen: '绿胜',
    nodeProgress: '进度', nodePeriod: '已释放期数', pickNum: '选号', stake: '投入', detail: '明细', close: '收起',
    needPick: '请先选择 0-9 的数字', needAmount: '请输入 1-99 的正整数（枚）', copyOk: '已复制', noWallet: '未检测到钱包插件',
    flow_BET_FROZEN: '许愿冻结', flow_WIN_CREDIT: '中奖到账', flow_INS_WIN_CUT: '保险赢家扣10%', flow_CANCEL_REFUND: '流局退款',
    flow_REFERRAL: '邀请返佣', flow_PREMIUM_IN: '存入保费', flow_NODE_PAYOUT: '节点赔付', flow_NODE_FORFEIT: '断保当期充公',
    flow_WITHDRAW_FREEZE: '提现冻结', flow_WITHDRAW_DONE: '提现到账', flow_WITHDRAW_FAIL: '提现退回', flow_FAUCET: '测试领币',
    flow_CHAIN_DEPOSIT: '链上转入', flow_ISSUE: '系统入账',
  },
  'zh-TW': {
    appTitle: '3分鐘願望實現', loginTip: '連接錢包即可開始，邀請連結自動綁定推薦關係', connectWallet: '連接錢包', demoEnter: '未裝錢包？以演示身份進入', logout: '退出',
    tabPlay: '對局', tabHistory: '歷史', tabIns: '保險', tabInvite: '邀請', tabBbs: '廣場', tabWallet: '錢包',
    remainSec: '剩餘秒數', lockAt: '150秒封盤', betCount: '參與筆數', redPool: '紅願池', greenPool: '綠願池',
    oddWin: '選號總和為單 → 紅勝', evenWin: '選號總和為雙 → 綠勝', pickLabel: '選擇一個數字（0-9）',
    amountLabel: '許願金（1-99 枚，正整數）', confirmWish: '確認許願', recent100: '近100場（開獎後全員投入與選號全公開）',
    insTitle: '願望保險', insSwitch: '保險開關', premium: '保費餘額', lossAccum: '淨虧累計', depositPremium: '存入保費',
    insRule: '開關開且保費≥20枚才生效；生效贏家收益再扣10%入保池；淨虧每滿100枚生成一個賠付節點並扣20枚保費，節點分100期返還。',
    myNodes: '我的賠付節點', invTitle: '邀請返傭', copy: '複製', qualifiedInvitees: '達標好友', curRate: '當前返傭率', invTotal: '累計返傭',
    invRule: '名下有「生成過賠付節點」的直邀好友數決定檔位，按下注流水返傭：1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人以上0.5%。',
    bbsTitle: '廣場（100字以內純文字）', bbsPlaceholder: '說點什麼吧（最多100字）', bbsSend: '發佈', bbsEmpty: '還沒有留言，來說第一句',
    walletTitle: '我的錢包', avail: '可用', frozen: '凍結', withdraw: '提現（單筆2-500，費1枚）', faucet: '測試領幣100枚（站內模式）', flows: '收支流水',
    chainOn: '鏈上模式：僅認可平台指定代幣，許願時直接從錢包轉賬', chainOff: '站內餘額模式（未配置鏈上代幣）', chainPending: '鏈上交易已提交，正在等待確認…',
    stateActive: '進行中', stateLocked: '已封盤', stateSettled: '已開獎', stateCancelled: '流局(無人)已退款', winRed: '紅勝', winGreen: '綠勝',
    nodeProgress: '進度', nodePeriod: '已釋放期數', pickNum: '選號', stake: '投入', detail: '明細', close: '收起',
    needPick: '請先選擇 0-9 的數字', needAmount: '請輸入 1-99 的正整數（枚）', copyOk: '已複製', noWallet: '未檢測到錢包插件',
    flow_BET_FROZEN: '許願凍結', flow_WIN_CREDIT: '中獎到賬', flow_INS_WIN_CUT: '保險贏家扣10%', flow_CANCEL_REFUND: '流局退款',
    flow_REFERRAL: '邀請返傭', flow_PREMIUM_IN: '存入保費', flow_NODE_PAYOUT: '節點賠付', flow_NODE_FORFEIT: '斷保當期充公',
    flow_WITHDRAW_FREEZE: '提現凍結', flow_WITHDRAW_DONE: '提現到賬', flow_WITHDRAW_FAIL: '提現退回', flow_FAUCET: '測試領幣',
    flow_CHAIN_DEPOSIT: '鏈上轉入', flow_ISSUE: '系統入賬',
  },
  en: {
    appTitle: 'Wish in 3 Minutes', loginTip: 'Connect a wallet to start; invite links bind referrers automatically', connectWallet: 'Connect Wallet', demoEnter: 'No wallet? Enter as demo', logout: 'Sign out',
    tabPlay: 'Play', tabHistory: 'History', tabIns: 'Insurance', tabInvite: 'Invite', tabBbs: 'Board', tabWallet: 'Wallet',
    remainSec: 'seconds left', lockAt: 'locks at 150s', betCount: 'Entries', redPool: 'Red Pool', greenPool: 'Green Pool',
    oddWin: 'Sum is odd → Red wins', evenWin: 'Sum is even → Green wins', pickLabel: 'Pick a number (0-9)',
    amountLabel: 'Wish amount (1-99 枚, integer)', confirmWish: 'Confirm Wish', recent100: 'Last 100 rounds (all stakes & picks public after settle)',
    insTitle: 'Wish Insurance', insSwitch: 'Insurance', premium: 'Premium balance', lossAccum: 'Net loss accrued', depositPremium: 'Deposit premium',
    insRule: 'Active only when switch on and premium ≥ 20 枚. Insured winners contribute 10% to the pool; every 100 枚 net loss opens a payout node costing 20 枚, returned over 100 periods.',
    myNodes: 'My payout nodes', invTitle: 'Referral', copy: 'Copy', qualifiedInvitees: 'Qualified invites', curRate: 'Current rate', invTotal: 'Total reward',
    invRule: 'Tier by direct invites who ever generated a node, paid on betting volume: 1→0.1% / 5→0.2% / 10→0.3% / 20→0.4% / 50+→0.5%.',
    bbsTitle: 'Board (plain text, up to 100 chars)', bbsPlaceholder: 'Say something (max 100 chars)', bbsSend: 'Post', bbsEmpty: 'No posts yet. Be the first.',
    walletTitle: 'My Wallet', avail: 'Available', frozen: 'Frozen', withdraw: 'Withdraw (2-500, fee 1 枚)', faucet: 'Test faucet +100 (off-chain mode)', flows: 'Transactions',
    chainOn: 'On-chain mode: only the platform token is accepted; the wallet transfers on each wish', chainOff: 'Off-chain balance mode (no token configured)', chainPending: 'Transaction submitted, waiting for confirmation…',
    stateActive: 'Live', stateLocked: 'Locked', stateSettled: 'Settled', stateCancelled: 'Void (empty), refunded', winRed: 'Red', winGreen: 'Green',
    nodeProgress: 'Progress', nodePeriod: 'Periods paid', pickNum: 'Pick', stake: 'Stake', detail: 'Detail', close: 'Close',
    needPick: 'Please pick a number 0-9 first', needAmount: 'Enter an integer 1-99 (枚)', copyOk: 'Copied', noWallet: 'No wallet extension detected',
    flow_BET_FROZEN: 'Bet frozen', flow_WIN_CREDIT: 'Win credited', flow_INS_WIN_CUT: 'Insured winner 10%', flow_CANCEL_REFUND: 'Void refund',
    flow_REFERRAL: 'Referral reward', flow_PREMIUM_IN: 'Premium deposit', flow_NODE_PAYOUT: 'Node payout', flow_NODE_FORFEIT: 'Lapsed to pool',
    flow_WITHDRAW_FREEZE: 'Withdraw frozen', flow_WITHDRAW_DONE: 'Withdraw done', flow_WITHDRAW_FAIL: 'Withdraw returned', flow_FAUCET: 'Test faucet',
    flow_CHAIN_DEPOSIT: 'On-chain deposit', flow_ISSUE: 'System credit',
  },
  ja: {
    appTitle: '3分間ウィッシュ', loginTip: 'ウォレット接続で開始。招待リンクで紹介者を自動登録', connectWallet: 'ウォレット接続', demoEnter: 'ウォレットなし？デモで入る', logout: 'ログアウト',
    tabPlay: 'プレイ', tabHistory: '履歴', tabIns: '保険', tabInvite: '招待', tabBbs: '広場', tabWallet: 'ウォレット',
    remainSec: '残り秒数', lockAt: '150秒で締切', betCount: 'エントリー数', redPool: '赤の願い池', greenPool: '緑の願い池',
    oddWin: '合計が奇数 → 赤の勝ち', evenWin: '合計が偶数 → 緑の勝ち', pickLabel: '数字を選ぶ（0-9）',
    amountLabel: '願い金（1-99 枚、整数）', confirmWish: '願いを確定', recent100: '過去100戦（確定後に全投入・数字を公開）',
    insTitle: '願い保険', insSwitch: '保険スイッチ', premium: '保険料残高', lossAccum: '純損失累計', depositPremium: '保険料を入れる',
    insRule: 'スイッチONかつ保険料≥20枚で有効。適用勝者は利益の10%を保険池へ。純損失100枚ごとに返還ノード生成（保険料20枚差引）、100期で返還。',
    myNodes: '私の返還ノード', invTitle: '招待報酬', copy: 'コピー', qualifiedInvitees: '条件達成フレンド', curRate: '現在の率', invTotal: '累計報酬',
    invRule: 'ノードを生成した直招待人数で率が決定（投入額ベース）: 1人0.1% / 5人0.2% / 10人0.3% / 20人0.4% / 50人以上0.5%。',
    bbsTitle: '広場（100文字以内のテキスト）', bbsPlaceholder: 'ひとこと（最大100文字）', bbsSend: '投稿', bbsEmpty: 'まだ投稿はありません',
    walletTitle: 'マイウォレット', avail: '利用可能', frozen: '凍結中', withdraw: '出金（2-500、手数料1枚）', faucet: 'テスト受取+100（オフチェーン）', flows: '取引履歴',
    chainOn: 'オンチェーン：指定トークンのみ受理、願うたびウォレットから送金', chainOff: 'オフチェーン残高モード（トークン未設定）', chainPending: '送信済み、承認待ちです…',
    stateActive: '進行中', stateLocked: '締切済', stateSettled: '確定', stateCancelled: '不成立（無人）返金', winRed: '赤勝ち', winGreen: '緑勝ち',
    nodeProgress: '進捗', nodePeriod: '返還済期', pickNum: '数字', stake: '投入', detail: '詳細', close: '閉じる',
    needPick: '先に0-9の数字を選んでください', needAmount: '1-99の整数（枚）を入力', copyOk: 'コピーしました', noWallet: 'ウォレット拡張が未検出',
    flow_BET_FROZEN: '投入凍結', flow_WIN_CREDIT: '当選入金', flow_INS_WIN_CUT: '保険勝者10%', flow_CANCEL_REFUND: '不成立返金',
    flow_REFERRAL: '招待報酬', flow_PREMIUM_IN: '保険料投入', flow_NODE_PAYOUT: 'ノード返還', flow_NODE_FORFEIT: '失効分を保険池へ',
    flow_WITHDRAW_FREEZE: '出金凍結', flow_WITHDRAW_DONE: '出金完了', flow_WITHDRAW_FAIL: '出金差戻し', flow_FAUCET: 'テスト受取',
    flow_CHAIN_DEPOSIT: 'オンチェーン入金', flow_ISSUE: 'システム入金',
  },
};

const state = { uid: null, wallet: null, lang: localStorage.getItem('lang') || 'zh-CN', side: 'red', pick: null, chainCfg: null, me: null, round: null, recent: [], bbsTimer: 0 };

function t(k) { return (I18N[state.lang] && I18N[state.lang][k]) || I18N['zh-CN'][k] || k; }
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('bbsInput').placeholder = t('bbsPlaceholder');
}
async function api(url, body) {
  const opt = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
  const r = await fetch(url, opt); const j = await r.json();
  if (!r.ok) throw new Error(j.message || j.error || 'error');
  return j;
}

// ---------------- 登录 / 钱包 ----------------
function randomDemoAddr() {
  let h = ''; while (h.length < 40) h += Math.random().toString(16).slice(2);
  return '0x' + h.slice(0, 40);
}
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
async function demoEnter() {
  $('loginErr').textContent = '';
  try { await doLogin(randomDemoAddr()); } catch (e) { $('loginErr').textContent = e.message; }
}
function enterMain() {
  $('loginMask').classList.add('hide'); $('main').classList.remove('hide');
  $('who').textContent = `${state.uid} · ${shortAddr(state.wallet)}`;
  $('who').classList.remove('hide'); $('logoutBtn').classList.remove('hide');
  buildNumGrid(); renderInviteLink(); refresh(); setInterval(refresh, 1500); setInterval(tickCountdown, 1000);
  setInterval(loadBbs, 5000); loadBbs();
}
function logout() { localStorage.clear(); location.reload(); }

// ---------------- 对局 ----------------
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
  if (!state.round) return;
  const remain = Math.max(0, state.round.settleAt - Math.floor(Date.now() / 1000));
  $('countdown').textContent = remain;
  $('countdown').className = 'countdown' + (remain <= 30 ? ' urgent' : '');
}
function renderRound() {
  const r = state.round; if (!r) return;
  $('roundNo').textContent = r.roundId;
  $('roundState').textContent = t('state' + ({ active: 'Active', locked: 'Locked', settled: 'Settled', cancelled: 'Cancelled' }[r.state] || 'Active'));
  $('betCount').textContent = r.betCount ?? 0;
  tickCountdown();
  // 历史圆点（最新在左；只画有胜负的局）
  const dots = state.recent.filter((x) => x.state === 'settled').slice(0, 100).map((x) => {
    const win = x.result && x.result.winSide;
    return `<span class="dot ${win}" title="${x.roundId} ${win === 'red' ? t('winRed') : t('winGreen')}"></span>`;
  }).join('');
  $('histDots').innerHTML = dots || '<span class="muted">—</span>';
}
function erc20TransferData(to, amountCoin, decimals) {
  const sel = 'a9059cbb'; // transfer(address,uint256)
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
      try {
        txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: state.wallet, to: state.chainCfg.tokenContract, data }] });
      } catch (e) { $('playMsg').textContent = e.message || String(e); return; }
      $('playMsg').textContent = t('chainPending');
      for (let i = 0; i < 12; i++) {
        await sleep(4000);
        try { await api('/bet/onchain', { uid, side, amount, pick, txHash }); $('playMsg').textContent = '✓'; $('amountInput').value = ''; return refresh(); }
        catch (e) { if (!/确认|查到|尚未|confirm|waiting|承認|確認/.test(e.message)) { $('playMsg').textContent = e.message; return; } }
      }
      $('playMsg').textContent = 'tx: ' + shortAddr(txHash);
    } else {
      await api('/bet', { uid, side, amount, pick });
      $('amountInput').value = ''; await refresh();
    }
  } catch (e) { $('playMsg').textContent = e.message; }
}

// ---------------- 历史 ----------------
async function renderHistory() {
  const list = $('historyList');
  list.innerHTML = state.recent.map((r) => {
    const win = r.result && r.result.winSide;
    const head = `<div class="hist-row" data-id="${r.roundId}">
      <span class="dot ${win || 'void'}"></span>
      <b>${r.roundId}</b><span>${r.state === 'settled' ? (win === 'red' ? t('winRed') : t('winGreen')) : t('state' + (r.state === 'cancelled' ? 'Cancelled' : 'Active'))}</span>
      <span class="muted">${r.state === 'settled' ? `${fmt(Number(r.result.total) / 1e6)} 枚 · Σ=${r.sumPick}` : ''}</span>
      <button class="btn-mini" data-detail="${r.roundId}">${t('detail')}</button>
      <div class="hist-detail hide" id="hd-${r.roundId}"></div></div>`;
    return head;
  }).join('') || '<p class="muted">—</p>';
  list.querySelectorAll('[data-detail]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.detail, box = $('hd-' + id);
    if (!box.classList.contains('hide')) { box.classList.add('hide'); b.textContent = t('detail'); return; }
    const d = await api('/round/' + id);
    box.innerHTML = (d.bets || []).map((x) => `<div class="bet-line"><span class="tag ${x.side}">${x.side === 'red' ? t('winRed') : t('winGreen')}</span> ${x.uid} · ${t('stake')} ${fmt(Number(x.amount) / 1e6)} · ${t('pickNum')} ${x.pick}</div>`).join('');
    box.classList.remove('hide'); b.textContent = t('close');
  });
}

// ---------------- 保险 / 邀请 / 钱包 / BBS ----------------
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
    return `<div class="node-row"><b>${n.nodeId}</b><span>${t('nodePeriod')} ${n.periodN}/100</span>
      <div class="bar"><i style="width:${pct}%"></i></div><span>${t('nodeProgress')} ${pct}%</span></div>`;
  }).join('') : '<p class="muted">—</p>';
  $('flowList').innerHTML = me.flows.map((f) => `<div class="flow-line"><span>${t('flow_' + f.bizType) || f.bizType}</span><b>${fmt(f.amount)} 枚</b><small>${new Date(f.at).toLocaleString()}</small></div>`).join('') || '<p class="muted">—</p>';
  const tip = $('chainModeTip');
  if (state.chainCfg && state.chainCfg.enabled) { tip.classList.remove('hide'); tip.textContent = t('chainOn'); }
  else { tip.classList.remove('hide'); tip.textContent = t('chainOff'); }
}
function renderInviteLink() {
  const base = location.origin + location.pathname;
  $('inviteLink').value = `${base}?ref=${state.uid}`;
}
async function loadBbs() {
  if (!$('tab-bbs').classList.contains('active')) return;
  const posts = await api('/bbs/list');
  $('bbsList').innerHTML = posts.length ? posts.map((p) => `<div class="bbs-item"><div class="bbs-head"><b>${shortAddr(p.wallet || p.uid)}</b><small>${new Date(p.at).toLocaleString()}</small></div><div class="bbs-text"></div></div>`)
    .map((h, i) => h.replace('<div class="bbs-text"></div>', `<div class="bbs-text">${escapeHtml(posts[i].content)}</div>`)).join('') : `<p class="muted">${t('bbsEmpty')}</p>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
async function postBbs() {
  const content = $('bbsInput').value.trim();
  if (codeLen(content) < 1) return;
  if (codeLen(content) > 100) { return; }
  await api('/bbs/post', { uid: state.uid, content });
  $('bbsInput').value = ''; $('bbsChar').textContent = '0/100'; await loadBbs();
}

// ---------------- 动作 ----------------
async function switchIns() { const me = state.me; await api('/insurance/switch', { uid: state.uid, on: !me.user.insSwitch }); refresh(); }
async function depositPremium() { const v = Number($('premiumInput').value); if (!v) return; await api('/insurance/deposit', { uid: state.uid, amount: v }); $('premiumInput').value = ''; refresh(); }
async function withdraw() {
  const v = Number($('wdInput').value); if (!v) return;
  try { const r = await api('/withdraw', { uid: state.uid, amount: v }); alert(r.paid === false ? (r.payoutError || 'pending') : 'OK'); $('wdInput').value = ''; refresh(); }
  catch (e) { alert(e.message); }
}
async function faucet() { try { await api('/faucet', { uid: state.uid, amount: 100 }); refresh(); } catch (e) { alert(e.message); } }

async function refresh() {
  if (!state.uid) return;
  try {
    const [r, recent, me] = await Promise.all([api('/round/current'), api('/recent'), api('/user/' + state.uid)]);
    state.round = r; state.recent = recent; state.me = me;
    renderRound(); renderMe();
    if ($('tab-history').classList.contains('active')) renderHistory();
  } catch (e) { /* 轮询容错：下一轮自愈 */ }
}

// ---------------- 初始化与事件 ----------------
function init() {
  $('langSel').value = state.lang; applyI18n();
  $('langSel').onchange = (e) => { state.lang = e.target.value; localStorage.setItem('lang', state.lang); applyI18n(); refresh(); };
  $('connectBtn').onclick = connectWallet; $('demoBtn').onclick = demoEnter; $('logoutBtn').onclick = logout;
  $('sideRed').onclick = () => selectSide('red'); $('sideGreen').onclick = () => selectSide('green');
  $('betBtn').onclick = submitWish;
  document.querySelectorAll('.tab').forEach((tb) => tb.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    tb.classList.add('active'); $('tab-' + tb.dataset.tab).classList.add('active');
    if (tb.dataset.tab === 'history') renderHistory();
    if (tb.dataset.tab === 'bbs') loadBbs();
  });
  $('insSwitchBtn').onclick = switchIns; $('premiumBtn').onclick = depositPremium;
  $('wdBtn').onclick = withdraw; $('faucetBtn').onclick = faucet;
  $('copyInvBtn').onclick = () => { navigator.clipboard?.writeText($('inviteLink').value); alert(t('copyOk')); };
  $('bbsSend').onclick = postBbs;
  $('bbsInput').oninput = () => { $('bbsChar').textContent = codeLen($('bbsInput').value) + '/100'; };
  selectSide('red');
  // 恢复会话
  const uid = localStorage.getItem('uid'), wallet = localStorage.getItem('wallet');
  if (uid && wallet) { state.uid = uid; state.wallet = wallet; api('/chain/config').then((c) => { state.chainCfg = c; enterMain(); }); }
}
init();
