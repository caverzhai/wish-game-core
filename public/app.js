// =============================================================
// app.js —— English / 繁體 / 日本語；底部Dock：首页(许愿+历史)/广场/保险/我的
// 支付：站内余额优先，不足差额调外部钱包；BBS 含管理员删帖/封号/屏蔽词治理
// =============================================================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortAddr = (a = '') => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const codeLen = (s) => [...String(s)].length;
const utcHM = (sec) => new Date(sec * 1000).toISOString().slice(11, 16) + ' UTC';
const pad2 = (n) => String(n).padStart(2, '0');

const I18N = {
  en: {
    appTitle: 'Three-Minute Wish Pool', loginTip: 'Connect a wallet to start. Invite links bind referrers automatically.', connectWallet: 'Connect Wallet', demoEnter: 'No wallet? Enter as demo', logout: 'Sign out',
    dockHome: 'Home', dockBbs: 'Board', dockIns: 'Insurance', dockMe: 'Me',
    remainSec: 'seconds left', lockAt: 'closed at 150s', betCount: 'Wishes', redPool: 'Red Pool', greenPool: 'Green Pool',
    oddWin: 'Odd sum → Red', evenWin: 'Even sum → Green', pickLabel: 'Pick a number (0-9)',
    amountLabel: 'Wish amount (1-99 枚, integer)', confirmWish: 'Confirm Wish', waitingStart: 'Waiting for the first wish…', historyTitle: 'Past rounds',
    insTitle: 'Wish Insurance', insSwitch: 'Insurance', premium: 'Premium', lossAccum: 'Net loss', depositPremium: 'Deposit premium',
    insRule: 'Active only when switched on and premium ≥ 20 枚. Insured winners contribute 10% to the pool; every 100 枚 net loss opens a payout node (costs 20 枚), returned over 100 periods.',
    myNodes: 'My payout nodes', poolTotal: 'Insurance pool', poolNext: 'Next release total', poolNextAt: 'Next release at', nextReleaseIn: 'Next in', poolActiveNodes: 'Active nodes',
    poolSufficient: 'Sufficient', poolShort: 'Shortfall', poolCover: 'Coverage',
    meWallet: 'Wallet', meInvite: 'Invite', copy: 'Copy', qualifiedInvitees: 'Qualified', curRate: 'Rate', invTotal: 'Total',
    invTierTip: 'Tier is set by how many direct friends ever generated a payout node; commission on their wish volume:', invColPeople: 'Qualified friends', invColRate: 'Rate', invPeopleUnit: '',
    bbsTitle: 'Board (plain text, up to 100 chars)', bbsPlaceholder: 'Say something (max 100 chars)', bbsSend: 'Post', bbsEmpty: 'No posts yet. Be the first.',
    adminModeration: 'Moderation', addBlockedWord: 'Block word', wordPh: 'Add a blocked word', deletePost: 'Delete', banUser: 'Ban', unbanUser: 'Unban', bannedTag: 'BANNED', noBlocked: 'No blocked words',
    avail: 'Available', frozen: 'Held', withdraw: 'Withdraw (2-500, fee 1)', withdrawing: 'Processing…', flows: 'Transactions',
    wdOk: 'Withdrawal sent. Arrived:', wdPending: 'Submitted, pending platform processing.',
    premiumWithdraw: 'Premium → balance (insurance OFF)', premiumOutPh: 'Blank = withdraw all', premiumNeed: 'Enter a positive integer amount',
   
    chainOn: 'On-chain: balance first, the shortfall is paid from your wallet.', chainOff: 'Off-chain balance mode (no token configured).', chainPending: 'Submitted, waiting for confirmation…', pendingLock: 'Previous transaction is still confirming on-chain. Wait a few seconds — do NOT submit again; it is credited automatically.', walletChanged: 'Active wallet differs from the logged-in account. Log out and reconnect the same wallet.',
    pendingTitle: 'Pending on-chain payments', pendingVerify: 'Verify & credit now', chainWillCredit: 'Paid on-chain. It is credited automatically once confirmed; you can also tap Verify under Me.', chainCreditedRedo: 'Your on-chain payment has been credited to balance, please place the wish again.',
    manualCredit: 'Credit by hash', manualTxPh: 'Paste 0x… tx hash to credit', manualOk: 'Credited to balance', manualAlready: 'This tx was already credited', manualBadHash: 'Invalid tx hash',
    stateActive: 'Live', stateLocked: 'Closed', stateSettled: 'Settled', stateCancelled: 'Void (empty), refunded', winRed: 'Red', winGreen: 'Green',
    nodeProgress: 'Progress', nodePeriod: 'Periods', pickNum: 'Pick', stake: 'Amount', detail: 'Detail', close: 'Close',
    needPick: 'Please pick a number 0-9 first', needAmount: 'Enter an integer 1-99 (枚)', copyOk: 'Copied', noWallet: 'No wallet extension detected',
    walletShort: 'Wallet balance short by', noWalletGap: 'No wallet detected. Open this site inside the TokenPocket DApp browser, or install & unlock a wallet extension.', offchainShort: 'Balance not enough (short',
    chainNotConfigured: 'This site has no on-chain token configured, so wallet payment is unavailable. Please use the deployed online site.', wrongChain: 'Please switch the wallet network to BNB Smart Chain (chainId 56).',
    selfCheck: 'Wallet environment check', scSite: 'Site chain config', scNoSite: 'NOT configured (use online site)', scWallet: 'Wallet detected', scNoWallet: 'NONE — open inside TokenPocket DApp browser, or install a wallet extension', scNet: 'Current network', scAccount: 'Authorized account', scNoAccount: 'none (connect/unlock wallet)', scWhich: 'Wallet type',
    reply: 'Reply', sendReply: 'Send', replyPh: 'Write a reply (max 100 chars)', replies: 'replies', confirmDelPost: 'Delete this post and its replies?',
    flow_BET_FROZEN: 'Wish placed', flow_WIN_CREDIT: 'Win credited', flow_INS_WIN_CUT: 'Insured 10% to pool', flow_CANCEL_REFUND: 'Void refund',
    flow_REFERRAL: 'Referral reward', flow_PREMIUM_IN: 'Premium deposit', flow_NODE_PREMIUM_OUT: 'Node premium', flow_NODE_PAYOUT: 'Node payout', flow_NODE_FORFEIT: 'Lapsed to pool',
    flow_WITHDRAW_FEE: 'Withdraw fee', flow_WITHDRAW_PENDING: 'Withdraw in transit', flow_WITHDRAW_PAID: 'Withdraw paid', flow_WITHDRAW_REFUND: 'Withdraw refunded',
    flow_FAUCET: 'Test claim', flow_CHAIN_DEPOSIT: 'On-chain deposit', flow_ISSUE: 'System credit',
  },
  'zh-TW': {
    appTitle: '三分鐘願望池', loginTip: '連接錢包即可開始，邀請連結自動綁定推薦關係', connectWallet: '連接錢包', demoEnter: '未裝錢包？以演示身份進入', logout: '退出',
    dockHome: '首頁', dockBbs: '廣場', dockIns: '保險', dockMe: '我的',
    remainSec: '剩餘秒數', lockAt: '150秒停止許願', betCount: '許願筆數', redPool: '紅願池', greenPool: '綠願池',
    oddWin: '選號總和為單 → 紅勝', evenWin: '選號總和為雙 → 綠勝', pickLabel: '選擇一個數字（0-9）',
    amountLabel: '許願金（1-99 枚，正整數）', confirmWish: '確認許願', waitingStart: '等待第一個願望進場…', historyTitle: '往期記錄',
    insTitle: '願望保險', insSwitch: '保險開關', premium: '保費餘額', lossAccum: '淨虧累計', depositPremium: '存入保費',
    insRule: '開關開且保費≥20枚才生效；生效贏家收益再扣10%入保池；淨虧每滿100枚生成一個賠付節點並扣20枚保費，節點分100期返還。',
    myNodes: '我的賠付節點', poolTotal: '保險池總資金', poolNext: '下次應釋放總額', poolNextAt: '下次釋放時刻', nextReleaseIn: '距下次釋放', poolActiveNodes: '待釋放節點',
    poolSufficient: '資金充足', poolShort: '資金缺口', poolCover: '覆蓋率',
    meWallet: '錢包', meInvite: '邀請返傭', copy: '複製', qualifiedInvitees: '達標好友', curRate: '返傭率', invTotal: '累計返傭',
    invTierTip: '名下有「生成過賠付節點」的直邀好友數決定檔位，按好友許願流水返傭：', invColPeople: '達標好友', invColRate: '返傭率', invPeopleUnit: '人',
    bbsTitle: '廣場（100字以內純文字）', bbsPlaceholder: '說點什麼吧（最多100字）', bbsSend: '發佈', bbsEmpty: '還沒有留言，來說第一句',
    adminModeration: '管理員治理', addBlockedWord: '加入屏蔽詞', wordPh: '輸入要屏蔽的詞', deletePost: '刪帖', banUser: '封號', unbanUser: '解封', bannedTag: '已封號', noBlocked: '暫無屏蔽詞',
    avail: '可用', frozen: '凍結', withdraw: '提現（單筆2-500，費1枚）', withdrawing: '處理中…', flows: '收支流水',
    wdOk: '提現已發送，到帳：', wdPending: '已提交，待平台處理。',
    premiumWithdraw: '保費提回餘額（需先關閉保險）', premiumOutPh: '留空＝全部提回', premiumNeed: '請輸入正整數金額',
   
    chainOn: '鏈上模式：優先用站內餘額，不足部分由錢包補足', chainOff: '站內餘額模式（未配置鏈上代幣）', chainPending: '鏈上交易已提交，正在等待確認…', pendingLock: '上一筆正在鏈上確認，請稍候幾秒、切勿重複許願，確認後會自動到帳。', walletChanged: '目前錢包帳戶與登入帳號不一致，請退出後重新連接同一個錢包。',
    pendingTitle: '待核驗的鏈上支付', pendingVerify: '重新核驗並入帳', chainWillCredit: '鏈上已支付，確認後會自動補入餘額，也可到「我的」手動核驗。', chainCreditedRedo: '鏈上支付已補入餘額，請重新許願。',
    manualCredit: '貼哈希補入帳', manualTxPh: '貼上 0x… 交易哈希補錄入帳', manualOk: '已補入餘額', manualAlready: '此交易先前已入帳', manualBadHash: '交易哈希格式不正確',
    stateActive: '進行中', stateLocked: '已停止許願', stateSettled: '已開獎', stateCancelled: '無人對局已退款', winRed: '紅勝', winGreen: '綠勝',
    nodeProgress: '進度', nodePeriod: '已釋放期數', pickNum: '選號', stake: '投入', detail: '明細', close: '收起',
    needPick: '請先選擇 0-9 的數字', needAmount: '請輸入 1-99 的正整數（枚）', copyOk: '已複製', noWallet: '未檢測到錢包插件',
    walletShort: '錢包餘額不足，還差', noWalletGap: '未檢測到錢包：請在 TokenPocket 錢包的 DApp 瀏覽器內打開本站，或在瀏覽器安裝並解鎖錢包外掛', offchainShort: '站內餘額不足（差',
    chainNotConfigured: '本站未配置鏈上代幣，無法從錢包扣款，請使用已部署的線上站點', wrongChain: '請把錢包網路切換到 BNB Smart Chain（chainId 56）',
    selfCheck: '錢包環境自檢', scSite: '站點鏈配置', scNoSite: '未配置（請用線上站點）', scWallet: '是否檢測到錢包', scNoWallet: '無——請在 TokenPocket 的 DApp 瀏覽器內打開，或安裝錢包外掛', scNet: '目前網路', scAccount: '已授權帳戶', scNoAccount: '無（請連接/解鎖錢包）', scWhich: '錢包類型',
    reply: '回覆', sendReply: '送出', replyPh: '寫下回覆（最多100字）', replies: '則回覆', confirmDelPost: '確定刪除該帖及其全部回覆？',
    flow_BET_FROZEN: '許願投入', flow_WIN_CREDIT: '中獎到帳', flow_INS_WIN_CUT: '保險贏家扣10%', flow_CANCEL_REFUND: '對局退款',
    flow_REFERRAL: '邀請返傭', flow_PREMIUM_IN: '存入保費', flow_NODE_PREMIUM_OUT: '節點扣保費', flow_NODE_PAYOUT: '節點賠付', flow_NODE_FORFEIT: '斷保當期充公',
    flow_WITHDRAW_FEE: '提現手續費', flow_WITHDRAW_PENDING: '提現在途', flow_WITHDRAW_PAID: '提現到帳', flow_WITHDRAW_REFUND: '提現退回',
    flow_FAUCET: '測試領幣', flow_CHAIN_DEPOSIT: '鏈上轉入', flow_ISSUE: '系統入帳',
  },
  ja: {
    appTitle: '3分間願い池', loginTip: 'ウォレット接続で開始。招待リンクで紹介者を自動登録します', connectWallet: 'ウォレット接続', demoEnter: 'ウォレットなし？デモで入る', logout: 'ログアウト',
    dockHome: 'ホーム', dockBbs: '広場', dockIns: '保険', dockMe: 'マイ',
    remainSec: '残り秒数', lockAt: '150秒で締切', betCount: '願い数', redPool: '赤の願い池', greenPool: '緑の願い池',
    oddWin: '合計が奇数 → 赤の勝ち', evenWin: '合計が偶数 → 緑の勝ち', pickLabel: '数字を選ぶ（0-9）',
    amountLabel: '願い金（1-99 枚、整数）', confirmWish: '願いを確定', waitingStart: '最初の願いを待っています…', historyTitle: '過去の記録',
    insTitle: '願い保険', insSwitch: '保険スイッチ', premium: '保険料残高', lossAccum: '純損失累計', depositPremium: '保険料を入れる',
    insRule: 'スイッチONかつ保険料≥20枚で有効。適用勝者は利益の10%を保険池へ。純損失100枚ごとに返還ノード生成（保険料20枚差引）、100期で返還。',
    myNodes: '私の返還ノード', poolTotal: '保険池の総額', poolNext: '次回解放予定額', poolNextAt: '次回解放時刻', nextReleaseIn: '次回まで', poolActiveNodes: '解放待ちノード',
    poolSufficient: '資金十分', poolShort: '不足額', poolCover: '充足率',
    meWallet: 'ウォレット', meInvite: '招待報酬', copy: 'コピー', qualifiedInvitees: '条件達成', curRate: 'レート', invTotal: '累計報酬',
    invTierTip: '返還ノードを生成した直招待人数で档位が決定、招待した人の投入額に応じて報酬：', invColPeople: '達成フレンド', invColRate: '報酬率', invPeopleUnit: '人',
    bbsTitle: '広場（100文字以内のテキスト）', bbsPlaceholder: 'ひとこと（最大100文字）', bbsSend: '投稿', bbsEmpty: 'まだ投稿はありません',
    adminModeration: 'モデレーション', addBlockedWord: 'NGワード追加', wordPh: 'NGワードを入力', deletePost: '削除', banUser: 'BAN', unbanUser: '解除', bannedTag: 'BAN済', noBlocked: 'NGワードなし',
    avail: '利用可能', frozen: '保留中', withdraw: '出金（2-500、手数料1枚）', withdrawing: '処理中…', flows: '取引履歴',
    wdOk: '送金しました。着金：', wdPending: '送信済み。プラットフォーム処理待ち。',
    premiumWithdraw: '保険料を残高へ戻す（保険OFF時）', premiumOutPh: '空欄＝全額戻す', premiumNeed: '正の整数を入力してください',
   
    chainOn: 'オンチェーン：残高を優先し、不足分だけウォレットから支払い', chainOff: 'オフチェーン残高モード（トークン未設定）', chainPending: '送信済み、承認待ちです…', pendingLock: '直前の取引がオンチェーン承認待ちです。数秒お待ちください（重複提交はしないでください）。承認後に自動で反映されます。', walletChanged: '現在のウォレットがログイン中アカウントと異なります。ログアウトして同じウォレットを再接続してください。',
    pendingTitle: '未確認のオンチェーン支払い', pendingVerify: '再確認して入金', chainWillCredit: 'オンチェーンで支払い済み。承認後に自動入金されます。マイで手動確認も可能です。', chainCreditedRedo: 'オンチェーン支払いを残高に入金しました。もう一度願いを入力してください。',
    manualCredit: 'ハッシュで入金', manualTxPh: '0x… トランザクションハッシュを貼って入金', manualOk: '残高に入金しました', manualAlready: 'この取引は入金済みです', manualBadHash: 'トランザクションハッシュ形式が不正です',
    stateActive: '進行中', stateLocked: '締切済み', stateSettled: '確定', stateCancelled: '不成立（無人）返金', winRed: '赤勝ち', winGreen: '緑勝ち',
    nodeProgress: '進捗', nodePeriod: '解放済期', pickNum: '数字', stake: '投入', detail: '詳細', close: '閉じる',
    needPick: '先に0-9の数字を選んでください', needAmount: '1-99の整数（枚）を入力', copyOk: 'コピーしました', noWallet: 'ウォレット拡張が未検出',
    walletShort: 'ウォレット残高不足（あと', noWalletGap: 'ウォレット未検出。TokenPocket のDAppブラウザで開くか、ウォレット拡張をインストール・解除してください', offchainShort: '残高不足（不足',
    chainNotConfigured: 'このサイトにはオンチェーン銘柄が未設定で、ウォレット支払いできません。デプロイ済みサイトをご利用ください', wrongChain: 'ウォレットのネットワークを BNB Smart Chain（chainId 56）に切り替えてください',
    selfCheck: 'ウォレット環境チェック', scSite: 'サイトのチェーン設定', scNoSite: '未設定（オンライン版を使用）', scWallet: 'ウォレット検出', scNoWallet: 'なし — TokenPocket のDAppブラウザで開くか、ウォレット拡張を入れてください', scNet: '現在のネットワーク', scAccount: '許可アカウント', scNoAccount: 'なし（ウォレット接続/解除を）', scWhich: 'ウォレット種別',
    reply: '返信', sendReply: '送信', replyPh: '返信を書く（最大100文字）', replies: '件', confirmDelPost: 'この投稿と返信を削除しますか？',
    flow_BET_FROZEN: '願い投入', flow_WIN_CREDIT: '当選入金', flow_INS_WIN_CUT: '保険勝者10%', flow_CANCEL_REFUND: '不成立返金',
    flow_REFERRAL: '招待報酬', flow_PREMIUM_IN: '保険料投入', flow_NODE_PREMIUM_OUT: 'ノード保険料', flow_NODE_PAYOUT: 'ノード返還', flow_NODE_FORFEIT: '失効分を保険池へ',
    flow_WITHDRAW_FEE: '出金手数料', flow_WITHDRAW_PENDING: '出金保留', flow_WITHDRAW_PAID: '出金完了', flow_WITHDRAW_REFUND: '出金差戻し',
    flow_FAUCET: 'テスト受取', flow_CHAIN_DEPOSIT: 'オンチェーン入金', flow_ISSUE: 'システム入金',
  },
};

const state = { uid: null, wallet: null, isAdmin: false, lang: localStorage.getItem('lang') || 'en', side: 'red', pick: null, chainCfg: null, me: null, round: null, recent: [], pool: null, words: [] };
if (state.lang === 'zh-CN') state.lang = 'en';

function t(k) { return (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k; }
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('bbsInput').placeholder = t('bbsPlaceholder');
  $('wordInput').placeholder = t('wordPh');
  $('manualTxInput').placeholder = t('manualTxPh');
  $('premiumOutInput').placeholder = t('premiumOutPh');
}
async function api(url, body) {
  const opt = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
  const r = await fetch(url, opt); const j = await r.json();
  if (!r.ok) { const err = new Error(j.message || j.error || 'error'); err.code = j.code; throw err; }
  return j;
}

// ---------------- 登录 ----------------
function randomDemoAddr() { let h = ''; while (h.length < 40) h += Math.random().toString(16).slice(2); return '0x' + h.slice(0, 40); }
async function doLogin(addr) {
  const ref = new URLSearchParams(location.search).get('ref');
  const u = await api('/login', { wallet: addr, inviterUid: ref || undefined });
  state.uid = u.uid; state.wallet = u.wallet; state.isAdmin = !!u.isAdmin;
  localStorage.setItem('uid', u.uid); localStorage.setItem('wallet', u.wallet);
  state.chainCfg = await api('/chain/config');
  enterMain();
}
async function connectWallet() {
  $('loginErr').textContent = '';
  try {
    if (!window.ethereum) { $('loginErr').textContent = t('noWallet'); return; }
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accs || !accs.length) return;
    window.ethereum.on?.('accountsChanged', (a) => { if (a[0]) { localStorage.clear(); location.reload(); } });
    await doLogin(accs[0]);
  } catch (e) { $('loginErr').textContent = e.message || String(e); }
}
async function demoEnter() { $('loginErr').textContent = ''; try { await doLogin(randomDemoAddr()); } catch (e) { $('loginErr').textContent = e.message; } }
function enterMain() {
  $('loginMask').classList.add('hide'); $('main').classList.remove('hide'); $('dock').classList.remove('hide');
  $('who').textContent = `${state.uid} · ${shortAddr(state.wallet)}`;
  $('who').classList.remove('hide'); $('logoutBtn').classList.remove('hide');
  buildNumGrid(); renderInviteLink(); renderPending(); switchDock('home');
  refresh(); setInterval(refresh, 1500); setInterval(tickCountdown, 1000);
  setInterval(() => loadBbs(true), 10000);
  creditPending(); setInterval(creditPending, 12000); // 自动补录掉单
}
function logout() { localStorage.clear(); location.reload(); }

// ---------------- Dock ----------------
function switchDock(name) {
  document.querySelectorAll('.dock-item').forEach((x) => x.classList.toggle('active', x.dataset.dock === name));
  document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
  $('tab-' + name).classList.add('active');
  if (name === 'home') renderHistory();
  if (name === 'bbs') loadBbs();
  if (name === 'insurance') updatePoolCountdown();
  if (name === 'me' && state.uid) { renderPending(); creditPending(); api('/withdraw/reap', { uid: state.uid }).then(refresh).catch(() => {}); }
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
  if (!state.round) { $('countdown').textContent = '···'; }
  else {
    const remain = Math.max(0, state.round.settleAt - Math.floor(Date.now() / 1000));
    $('countdown').textContent = remain;
    $('countdown').className = 'countdown' + (remain <= 30 ? ' urgent' : '');
  }
  updatePoolCountdown();
}
function renderRound() {
  const r = state.round;
  if (!r) {
    $('roundNo').textContent = '—'; $('roundState').textContent = t('waitingStart');
    $('betCount').textContent = 0; $('countdown').textContent = '···'; $('countdown').className = 'countdown';
  } else {
    $('roundNo').textContent = r.roundId;
    $('roundState').textContent = t('state' + ({ active: 'Active', locked: 'Locked', settled: 'Settled', cancelled: 'Cancelled' }[r.state] || 'Active'));
    $('betCount').textContent = r.betCount ?? 0;
    tickCountdown();
  }
  const dots = state.recent.filter((x) => x.state === 'settled').slice(0, 100).map((x) => `<span class="dot ${x.result && x.result.winSide}" title="${x.roundId}"></span>`).join('');
  $('histDots').innerHTML = dots || '<span class="muted">—</span>';
}
// 链上核验「暂时性错误」白名单：节点超时/无响应/尚未索引/等待确认 → 持续重试
const CHAIN_RETRY = /尚未|確認|确认|稍後|稍后|無響應|无响应|未找到|查到|等待|中$|waiting|confirm|pending|timeout|no response|receipt|not found|indexed/i;
// inner6 = 站内 6 位定点最小单位；链上代币多为 18 位，需乘 10^(decimals-6)
function erc20TransferData(to, inner6, decimals) {
  const addr = to.toLowerCase().replace('0x', '').padStart(64, '0');
  const v = BigInt(inner6) * (10n ** BigInt((decimals || 18) - 6));
  return '0x' + 'a9059cbb' + addr + v.toString(16).padStart(64, '0');
}
async function walletTokenWei() {
  const cfg = state.chainCfg;
  const data = '0x70a08231' + state.wallet.toLowerCase().replace('0x', '').padStart(64, '0');
  const hex = await window.ethereum.request({ method: 'eth_call', params: [{ to: cfg.tokenContract, data }, 'latest'] });
  return BigInt(hex || '0x0');
}
// 发起钱包扣款前的统一就绪检查：站点已配链、检测到钱包、已授权账户、网络切到目标链(BSC=56)
async function ensureWalletReady() {
  if (!(state.chainCfg && state.chainCfg.enabled)) throw new Error(t('chainNotConfigured'));
  const eth = window.ethereum;
  if (!eth) throw new Error(t('noWalletGap'));
  let accs;
  try { accs = await eth.request({ method: 'eth_requestAccounts' }); }
  catch (e) { throw new Error(e.message || String(e)); }
  if (!accs || !accs.length) throw new Error(t('noWalletGap'));
  // 同一台手机切换过钱包账户时，当前授权地址必须就是登录账号，否则会用错账户转账/串号
  const curAddr = String(accs[0] || '').toLowerCase();
  if (state.wallet && curAddr && curAddr !== String(state.wallet).toLowerCase()) throw new Error(t('walletChanged'));
  const want = '0x' + Number(state.chainCfg.chainId).toString(16);
  let cur = '';
  try { cur = (await eth.request({ method: 'eth_chainId' }) || '').toLowerCase(); } catch { /* 取不到则跳过，交给发送时校验 */ }
  if (cur && cur !== want) {
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] }); }
    catch (e) { throw new Error(t('wrongChain') + ' chainId=' + state.chainCfg.chainId); }
  }
  return eth;
}
// 钱包环境自检：站点配链 / 是否检测到钱包 / 当前网络 / 已授权账户 / 钱包类型，一眼定位卡点
async function walletSelfCheck() {
  const lines = [];
  const cfg = state.chainCfg;
  const siteOk = !!(cfg && cfg.enabled);
  lines.push(`${siteOk ? '✓' : '✗'} ${t('scSite')}: ${siteOk ? 'chainId ' + cfg.chainId : t('scNoSite')}`);
  const eth = window.ethereum;
  lines.push(`${eth ? '✓' : '✗'} ${t('scWallet')}: ${eth ? 'OK' : t('scNoWallet')}`);
  if (eth) {
    try {
      const c = await eth.request({ method: 'eth_chainId' });
      const want = siteOk ? '0x' + Number(cfg.chainId).toString(16) : null;
      const okNet = !want || String(c).toLowerCase() === want;
      lines.push(`${okNet ? '✓' : '!'} ${t('scNet')}: chainId ${parseInt(c, 16)}${want && !okNet ? '  →  ' + t('wrongChain') : ''}`);
    } catch (e) { lines.push(`! ${t('scNet')}: ${e.message || e}`); }
    try {
      const a = await eth.request({ method: 'eth_accounts' });
      lines.push(`${a && a.length ? '✓' : '!'} ${t('scAccount')}: ${a && a.length ? a[0] : t('scNoAccount')}`);
    } catch (e) { lines.push(`! ${t('scAccount')}: ${e.message || e}`); }
    const which = eth.isTokenPocket ? 'TokenPocket' : eth.isMetaMask ? 'MetaMask' : eth.isCoinbaseWallet ? 'Coinbase' : (eth.isTrust ? 'Trust' : 'injected');
    lines.push(`${t('scWhich')}: ${which}`);
  }
  alert(lines.join('\n'));
}
async function submitWish() {
  const amount = Number($('amountInput').value);
  $('playMsg').className = 'msg'; $('playMsg').textContent = '';
  if (state.pick === null) { $('playMsg').textContent = t('needPick'); return; }
  if (!Number.isInteger(amount) || amount < 1 || amount > 99) { $('playMsg').textContent = t('needAmount'); return; }
  if (livePending().length) { $('playMsg').textContent = t('pendingLock'); return; } // 上一笔链上未确认，禁止重复许愿
  const side = state.side, pick = state.pick, uid = state.uid, btn = $('betBtn');
  const S6 = 1_000_000;
  try {
    btn.disabled = true;
    // 第一优先：纯站内下注，由后端实时余额判定——够就直接成功，绝不碰外部钱包（避免前端快照过期误扣）
    try {
      await api('/bet', { uid, side, amount, pick });
      $('amountInput').value = ''; await refresh(); return;
    } catch (e) {
      if (e.code !== 'INSUFFICIENT_BALANCE') { $('playMsg').textContent = e.message || String(e); return; }
    }
    // 后端确认余额不足：拉最新账户，精确计算链上补差
    const fresh = await api('/user/' + uid);
    const availInner = Math.round(Number(fresh.account.available) * S6);
    const totalInner = amount * S6;
    const chainInner = totalInner - Math.min(availInner, totalInner); // 只补真实差额
    await ensureWalletReady();
    const dec = state.chainCfg.decimals, diff = dec - 6;
    if (diff < 0) { $('playMsg').textContent = 'Token decimals < 6, unsupported'; return; }
    const needWei = BigInt(chainInner) * (10n ** BigInt(diff));
    const wbal = await walletTokenWei();
    if (wbal < needWei) {
      const shortInner = Number(needWei - wbal) / (10 ** diff);
      $('playMsg').textContent = t('walletShort') + ' ' + fmt(shortInner / S6) + ' 枚'; return;
    }
    const data = erc20TransferData(state.chainCfg.platformAddress, chainInner, dec);
    let txHash;
    try { txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: state.wallet, to: state.chainCfg.tokenContract, data }] }); }
    catch (e) { $('playMsg').textContent = e.message || String(e); return; }
    $('playMsg').textContent = t('chainPending');
    addPending({ txHash, ts: Date.now(), totalAmount: amount, side, pick, chainInner });
    let lastErr = '';
    for (let i = 0; i < 15; i++) {
      await sleep(4000);
      try {
        await api('/bet/onchain', { uid, side, pick, totalAmount: amount, chainInner, txHash });
        removePending(txHash);
        $('playMsg').textContent = '✓'; $('amountInput').value = ''; return refresh();
      } catch (e) {
        lastErr = e.message || String(e);
        if (!CHAIN_RETRY.test(lastErr)) break;
      }
    }
    await creditPending();
    const stillPending = loadPending().some((x) => x.txHash === txHash);
    $('playMsg').textContent = stillPending
      ? (lastErr ? lastErr + ' · ' : '') + t('chainWillCredit') + ' (' + shortAddr(txHash) + ')'
      : t('chainCreditedRedo');
  } catch (e) { $('playMsg').textContent = e.message; }
  finally { btn.disabled = false; }
}

// ---------------- 历史（首页） ----------------
// 已展开的对局编号集合 + 明细缓存：定时刷新重绘后仍保持展开，不会“一点就收”
const expandedRounds = new Set();
const roundDetailCache = new Map();
async function fillHistDetail(id, box) {
  let d = roundDetailCache.get(id);
  if (!d) { d = await api('/round/' + id); roundDetailCache.set(id, d); }
  box.innerHTML = (d.bets || []).map((x) => `<div class="bet-line"><span class="tag ${x.side}">${x.side === 'red' ? t('winRed') : t('winGreen')}</span> ${x.uid} · ${t('stake')} ${fmt(Number(x.amount) / 1e6)} · ${t('pickNum')} ${x.pick}</div>`).join('') || '<p class="muted">—</p>';
}
async function renderHistory() {
  const list = $('historyList');
  list.innerHTML = state.recent.map((r) => {
    const win = r.result && r.result.winSide;
    const open = expandedRounds.has(r.roundId);
    return `<div class="hist-row"><span class="dot ${win || 'void'}"></span><b>${r.roundId}</b>
      <span>${r.state === 'settled' ? (win === 'red' ? t('winRed') : t('winGreen')) : t('state' + (r.state === 'cancelled' ? 'Cancelled' : 'Active'))}</span>
      <span class="muted">${r.state === 'settled' ? `${fmt(Number(r.result.total) / 1e6)} 枚 · Σ=${r.sumPick}` : ''}</span>
      <button class="btn-mini" data-detail="${r.roundId}">${open ? t('close') : t('detail')}</button>
      <div class="hist-detail ${open ? '' : 'hide'}" id="hd-${r.roundId}"></div></div>`;
  }).join('') || '<p class="muted">—</p>';
  list.querySelectorAll('[data-detail]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.detail, box = $('hd-' + id);
    if (expandedRounds.has(id)) { expandedRounds.delete(id); renderHistory(); return; }
    expandedRounds.add(id);
    b.textContent = t('close'); box.classList.remove('hide');
    await fillHistDetail(id, box);
  });
  // 重绘后恢复已展开对局的明细内容
  for (const id of expandedRounds) { const box = $('hd-' + id); if (box) fillHistDetail(id, box); }
}

// ---------------- 保险池公示 + 释放倒计时 ----------------
function updatePoolCountdown() {
  const el = $('poolCountdown');
  if (!el || !state.pool) return;
  const s = Math.max(0, state.pool.nextBatchAt - Math.floor(Date.now() / 1000));
  el.textContent = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}
function renderPoolPublic() {
  const p = state.pool; if (!p) return;
  const total = Number(p.poolBalance), next = Number(p.nextDueTotal);
  const cover = next > 0 ? Math.round((total / next) * 100) : 100;
  const ok = p.sufficient, gap = Number(p.gap);
  const barW = next > 0 ? Math.min(100, Math.round((total / next) * 100)) : 100;
  $('poolPublicCard').innerHTML = `
    <div class="pp-grid">
      <div class="pp-box big"><span>${t('poolTotal')}</span><b>${fmt(total)} 枚</b></div>
      <div class="pp-box"><span>${t('poolNext')}</span><b>${fmt(next)} 枚</b></div>
      <div class="pp-box"><span>${t('poolNextAt')}</span><b>${utcHM(p.nextBatchAt)}</b><small class="pp-cd">${t('nextReleaseIn')} <i id="poolCountdown">--:--:--</i></small></div>
      <div class="pp-box"><span>${t('poolActiveNodes')}</span><b>${p.nextPayNodeCount}/${p.activeNodeCount}</b></div>
    </div>
    <div class="pp-bar"><i class="${ok ? 'ok' : 'bad'}" style="width:${barW}%"></i></div>
    <div class="pp-foot ${ok ? 'ok' : 'bad'}">${t('poolCover')} ${next > 0 ? cover : '—'}% · ${ok ? t('poolSufficient') : t('poolShort') + ' ' + fmt(Math.abs(gap)) + ' 枚'}</div>`;
  $('poolPublicMini').innerHTML = `<span>${t('poolTotal')} <b>${fmt(total)}</b> 枚</span><span>${t('poolNext')} <b>${fmt(next)}</b> 枚</span><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'} ${ok ? t('poolSufficient') : t('poolShort')}</span>`;
  updatePoolCountdown();
}

// 邀请返佣档位表（醒目分行，当前档位高亮）
function renderInvTiers(curPerMille) {
  const box = $('invTiers'); if (!box) return;
  const unit = t('invPeopleUnit');
  const tiers = [[1, '1'], [2, '5'], [3, '10'], [4, '20'], [5, '50+']]; // [perMille, 人数档]
  const rows = tiers.map(([pm, label]) =>
    `<div class="it-row ${Number(curPerMille) === pm ? 'active' : ''}"><span>${label}${unit}</span><b>${(pm / 10).toFixed(1)}%</b></div>`).join('');
  box.innerHTML = `<div class="inv-tip">${t('invTierTip')}</div>
    <div class="it-grid"><div class="it-head"><span>${t('invColPeople')}</span><span>${t('invColRate')}</span></div>${rows}</div>`;
}

// ---------------- 我的 ----------------
function renderMe() {
  const me = state.me; if (!me) return;
  const a = me.account;
  $('availBal').textContent = fmt(a.available) + ' 枚'; $('frozenBal').textContent = fmt(a.frozen) + ' 枚';
  $('premiumBal').textContent = fmt(a.premium) + ' 枚'; $('premiumBal2').textContent = fmt(a.premium) + ' 枚';
  $('lossAccum').textContent = fmt(a.lossAccum) + ' 枚';
  $('insSwitchState').textContent = me.user.insSwitch ? 'ON' : 'OFF';
  $('insSwitchBtn').textContent = me.user.insSwitch ? 'OFF' : 'ON';
  const invRate = (me.invite.perMille / 10).toFixed(1) + '%';
  $('invCount').textContent = me.invite.nodeInviteeCount;
  $('invRate').textContent = invRate;
  $('invTotal').textContent = fmt(me.invite.rewardTotal) + ' 枚';
  const invTitle = $('meInviteTitle'); if (invTitle) invTitle.textContent = `${t('meInvite')}（${invRate}）`;
  renderInvTiers(me.invite.perMille);
  $('nodeList').innerHTML = me.nodes.length ? me.nodes.map((n) => {
    const pct = Math.round((n.periodN / 100) * 100);
    return `<div class="node-row"><b>${n.nodeId}</b><span>${t('nodePeriod')} ${n.periodN}/100</span><div class="bar"><i style="width:${pct}%"></i></div><span>${t('nodeProgress')} ${pct}%</span></div>`;
  }).join('') : '<p class="muted">—</p>';
  $('flowList').innerHTML = me.flows.map((f) => `<div class="flow-line"><span>${t('flow_' + f.bizType) || f.bizType}</span><b>${fmt(f.amount)} 枚</b><small>${new Date(f.at).toLocaleString()}</small></div>`).join('') || '<p class="muted">—</p>';
  const tip = $('chainModeTip');
  tip.classList.remove('hide');
  if (state.chainCfg && state.chainCfg.enabled && state.chainCfg.canPayout === false) {
    tip.style.color = '#ff6b6b';
    tip.textContent = '⚠ 平台代付私鑰未正確配置（PAYOUT_PRIVATE_KEY 是佔位符或格式錯誤），提現無法打出，請管理員到環境变量填入平台錢包真實私鑰後重新部署';
  } else {
    tip.style.color = '';
    tip.textContent = (state.chainCfg && state.chainCfg.enabled) ? t('chainOn') : t('chainOff');
  }
  syncAdmin(me.isAdmin);
}
function renderInviteLink() { $('inviteLink').value = `${location.origin}${location.pathname}?ref=${state.uid}`; }
function syncAdmin(isAdmin) {
  if (isAdmin === undefined) isAdmin = state.isAdmin;
  state.isAdmin = !!isAdmin;
  $('adminPanel').classList.toggle('hide', !state.isAdmin);
  if (state.isAdmin) loadAdminWords();
}

// ---------------- 广场（发帖 / 回复 / 管理员治理） ----------------
async function loadBbs(auto = false) {
  if (!$('tab-bbs').classList.contains('active')) return;
  // 自动轮询时保护正在进行的输入：有展开的回复框、焦点在输入框、或主输入框有草稿，就跳过本次重绘
  if (auto && (document.querySelector('.reply-box:not(.hide)') || document.querySelector('#tab-bbs textarea:focus') || $('bbsInput').value)) return;
  const posts = await api('/bbs/list');
  $('bbsList').innerHTML = posts.length ? posts.map((p) => `
    <div class="bbs-item">
      <div class="bbs-head"><b>${shortAddr(p.wallet || p.uid)}${p.banned ? ` <span class="banned-tag">${t('bannedTag')}</span>` : ''}</b><small>${new Date(p.lastActiveAt).toLocaleString()}</small></div>
      <div class="bbs-text">${escapeHtml(p.content)}</div>
      <div class="replies">${(p.replies || []).map((r) => `<div class="reply-line"><b>${shortAddr(r.wallet || r.uid)}</b><span>${escapeHtml(r.content)}</span><small>${new Date(r.at).toLocaleString()}</small></div>`).join('')}</div>
      <div class="reply-box hide" id="rb-${p.postId}">
        <textarea rows="2" maxlength="200" placeholder="${t('replyPh')}"></textarea>
        <button class="btn-mini" data-replysend="${p.postId}">${t('sendReply')}</button>
      </div>
      <div class="bbs-actions">
        <button class="btn-mini" data-replyto="${p.postId}">${t('reply')}${p.replyCount ? ` (${p.replyCount})` : ''}</button>
        ${state.isAdmin ? `<button class="btn-mini btn-danger" data-delpost="${p.postId}">${t('deletePost')}</button>
          <button class="btn-mini btn-danger" data-ban="${p.uid}" data-isbanned="${p.banned ? 1 : 0}">${p.banned ? t('unbanUser') : t('banUser')}</button>` : ''}
      </div>
    </div>`).join('') : `<p class="muted">${t('bbsEmpty')}</p>`;

  $('bbsList').querySelectorAll('[data-replyto]').forEach((b) => b.onclick = () => {
    const box = $('rb-' + b.dataset.replyto);
    box.classList.toggle('hide');
    if (!box.classList.contains('hide')) box.querySelector('textarea').focus();
  });
  $('bbsList').querySelectorAll('[data-replysend]').forEach((b) => b.onclick = async () => {
    const postId = b.dataset.replysend, box = $('rb-' + postId), ta = box.querySelector('textarea'), content = ta.value.trim();
    if (codeLen(content) < 1 || codeLen(content) > 100) { ta.focus(); return; }
    b.disabled = true;
    try {
      await api('/bbs/reply', { uid: state.uid, postId, content });
      await loadBbs(); // 成功后整体重绘，新回复直接出现在该帖下方
    } catch (e) { alert(e.message); b.disabled = false; }
  });
  $('bbsList').querySelectorAll('[data-delpost]').forEach((b) => b.onclick = async () => {
    if (!window.confirm(t('confirmDelPost'))) return;
    try { await api('/admin/post/delete', { uid: state.uid, postId: b.dataset.delpost }); await loadBbs(); }
    catch (e) { alert(e.message); }
  });
  $('bbsList').querySelectorAll('[data-ban]').forEach((b) => b.onclick = async () => {
    const target = b.dataset.ban, wasBanned = b.dataset.isbanned === '1';
    try { await api(wasBanned ? '/admin/user/unban' : '/admin/user/ban', { uid: state.uid, targetUid: target, banned: !wasBanned }); await loadBbs(); }
    catch (e) { alert(e.message); }
  });
}
async function loadAdminWords() {
  try {
    state.words = await api('/admin/words');
    $('wordTags').innerHTML = state.words.length
      ? state.words.map((w) => `<span class="word-tag">${escapeHtml(w)}<button data-wordrm="${escapeHtml(w)}">×</button></span>`).join('')
      : `<span class="muted">${t('noBlocked')}</span>`;
    $('wordTags').querySelectorAll('[data-wordrm]').forEach((b) => b.onclick = async () => {
      await api('/admin/word/remove', { uid: state.uid, word: b.dataset.wordrm }); loadAdminWords();
    });
  } catch (e) { /* 非管理员或网络抖动，忽略 */ }
}
async function adminAddWord() {
  const w = $('wordInput').value.trim();
  if (!w) return;
  try { await api('/admin/word/add', { uid: state.uid, word: w }); $('wordInput').value = ''; loadAdminWords(); }
  catch (e) { alert(e.message); }
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

// 保费存入：先纯站内（后端实时余额判定），仅当后端明确余额不足才用外部钱包补差
async function depositPremium() {
  const amount = Number($('premiumInput').value);
  const msg = $('premiumMsg'); msg.className = 'msg'; msg.textContent = '';
  if (!Number.isInteger(amount) || amount <= 0) { msg.textContent = t('premiumNeed'); return; }
  if (livePending().length) { msg.textContent = t('pendingLock'); return; } // 上一笔链上未确认，禁止重复存保费
  const btn = $('premiumBtn'), S6 = 1_000_000;
  try {
    btn.disabled = true;
    try {
      await api('/insurance/deposit', { uid: state.uid, amount });
      $('premiumInput').value = ''; await refresh(); return;
    } catch (e) {
      if (e.code !== 'INSUFFICIENT_BALANCE') { msg.textContent = e.message || String(e); return; }
    }
    const fresh = await api('/user/' + state.uid);
    const availInner = Math.round(Number(fresh.account.available) * S6);
    const totalInner = amount * S6;
    const chainInner = totalInner - Math.min(availInner, totalInner);
    await ensureWalletReady();
    const dec = state.chainCfg.decimals, diff = dec - 6;
    if (diff < 0) { msg.textContent = 'Token decimals < 6, unsupported'; return; }
    const needWei = BigInt(chainInner) * (10n ** BigInt(diff));
    const wbal = await walletTokenWei();
    if (wbal < needWei) { const s = Number(needWei - wbal) / (10 ** diff); msg.textContent = t('walletShort') + ' ' + fmt(s / S6) + ' 枚'; return; }
    const data = erc20TransferData(state.chainCfg.platformAddress, chainInner, dec);
    let txHash;
    try { txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: state.wallet, to: state.chainCfg.tokenContract, data }] }); }
    catch (e) { msg.textContent = e.message || String(e); return; }
    msg.textContent = t('chainPending');
    addPending({ txHash, ts: Date.now(), totalAmount: amount, chainInner, kind: 'premium' });
    let lastErr = '';
    for (let i = 0; i < 15; i++) {
      await sleep(4000);
      try {
        await api('/insurance/deposit/onchain', { uid: state.uid, totalAmount: amount, chainInner, txHash });
        removePending(txHash); msg.textContent = '✓'; $('premiumInput').value = ''; return refresh();
      } catch (e) { lastErr = e.message || String(e); if (!CHAIN_RETRY.test(lastErr)) break; }
    }
    await creditPending();
    const still = loadPending().some((x) => x.txHash === txHash);
    msg.textContent = still ? (lastErr ? lastErr + ' · ' : '') + t('chainWillCredit') + ' (' + shortAddr(txHash) + ')' : t('chainCreditedRedo');
  } catch (e) { msg.textContent = e.message; }
  finally { btn.disabled = false; }
}

// 保险关闭时，把保费提回可用余额（输入框留空=全部提回）
async function withdrawPremium() {
  const raw = $('premiumOutInput').value.trim();
  const body = { uid: state.uid };
  if (raw !== '') { const n = Number(raw); if (!Number.isInteger(n) || n <= 0) { alert(t('premiumNeed')); return; } body.amount = n; }
  try { await api('/insurance/premium/withdraw', body); $('premiumOutInput').value = ''; await refresh(); }
  catch (e) { alert(e.message); }
}

async function withdraw() {
  const v = Number($('wdInput').value);
  if (!v) return;
  const btn = $('wdBtn'); btn.disabled = true; btn.textContent = t('withdrawing');
  try {
    const r = await api('/withdraw', { uid: state.uid, amount: v });
    if (r.paid === true) alert(`${t('wdOk')} ${fmt(r.arrive)} 枚\n${r.txHash || r.txhash || ''}`);
    else if (r.paid === false) alert(((r.broadcast ? '⚠ ' : '') + (r.payoutError || 'pending') + (r.txHash ? `\n${r.txHash}` : '')));
    else alert(t('wdPending'));
    $('wdInput').value = ''; refresh();
  } catch (e) { alert(e.message); }
  finally { btn.disabled = false; btn.textContent = t('withdraw'); }
}


// —— 链上掉单补录：钱包已支付就一定能凭交易哈希入账，绝不丢钱 ——
function loadPending() { try { return JSON.parse(localStorage.getItem('pendingTxs') || '[]'); } catch { return []; } }
// 是否存在「10 分钟内尚未确认到账」的链上在途单：在途期间禁止再次发起下注/存保费，防止确认慢时重复提交出第二注
function livePending() {
  const TEN = 10 * 60 * 1000, now = Date.now();
  return loadPending().filter((x) => now - (x.ts || 0) < TEN);
}
function savePending(list) { localStorage.setItem('pendingTxs', JSON.stringify(list)); renderPending(); }
function addPending(item) { const l = loadPending(); if (!l.some((x) => x.txHash === item.txHash)) l.unshift(item); savePending(l); }
function removePending(hash) { savePending(loadPending().filter((x) => x.txHash !== hash)); }
function renderPending() {
  const box = $('pendingBox'); if (!box) return;
  const list = loadPending();
  box.classList.toggle('hide', list.length === 0);
  $('pendingCount').textContent = list.length ? `(${list.length})` : '';
  $('pendingList').innerHTML = list.map((x) => `<div class="pending-line"><span>${shortAddr(x.txHash)}</span><small>${new Date(x.ts).toLocaleString()}</small></div>`).join('');
}
let crediting = false;
async function creditPending() {
  const list = loadPending(); if (!list.length || !state.uid || crediting) return;
  crediting = true;
  try {
    for (const item of [...list]) {
      try {
        await api('/wallet/credit', { uid: state.uid, txHash: item.txHash });
        removePending(item.txHash); await refresh();
      } catch (e) { /* 链上尚未确认 / 节点超时：保留，下轮自动再补 */ }
    }
  } finally { crediting = false; }
}

async function refresh() {
  if (!state.uid) return;
  creditPending(); // 每轮自动补录已上链确认的在途单，确认后立即清 pending、解除在途锁
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
  $('selfCheckBtn').onclick = walletSelfCheck;
  document.querySelectorAll('.dock-item').forEach((d) => d.onclick = () => switchDock(d.dataset.dock));
  $('insSwitchBtn').onclick = switchIns; $('premiumBtn').onclick = depositPremium;
  $('premiumOutBtn').onclick = withdrawPremium;
  $('wdBtn').onclick = withdraw;
  $('pendingVerifyBtn').onclick = async () => { $('pendingVerifyBtn').disabled = true; try { await creditPending(); } finally { $('pendingVerifyBtn').disabled = false; renderPending(); } };
  $('manualTxBtn').onclick = async () => {
    const txHash = $('manualTxInput').value.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) { alert(t('manualBadHash')); return; }
    const btn = $('manualTxBtn'); btn.disabled = true;
    try {
      const r = await api('/wallet/credit', { uid: state.uid, txHash });
      alert((r.already ? t('manualAlready') : `${t('manualOk')} +${fmt(r.credited)}`) + ' 枚');
      $('manualTxInput').value = ''; await refresh();
    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
  };
  $('wordAddBtn').onclick = adminAddWord;
  $('copyInvBtn').onclick = () => { navigator.clipboard?.writeText($('inviteLink').value); alert(t('copyOk')); };
  $('bbsSend').onclick = postBbs;
  $('bbsInput').oninput = () => { $('bbsChar').textContent = codeLen($('bbsInput').value) + '/100'; };
  selectSide('red');
  const savedWallet = localStorage.getItem('wallet');
  if (savedWallet) {
    api('/login', { wallet: savedWallet }).then(async (u) => {
      state.uid = u.uid; state.wallet = u.wallet; state.isAdmin = !!u.isAdmin;
      localStorage.setItem('uid', u.uid); localStorage.setItem('wallet', u.wallet);
      state.chainCfg = await api('/chain/config');
      enterMain();
    }).catch(() => { localStorage.removeItem('uid'); localStorage.removeItem('wallet'); });
  }
}
const FE_BUILD = '2.1.0';
{ const el = document.getElementById('feBuild'); if (el) el.textContent = 'Ver.' + FE_BUILD; }
init();
