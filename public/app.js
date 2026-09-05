// =============================================================
// app.js - English / Traditional Chinese / Japanese; bottom dock: Home(wish+history)/Board/Insurance/Me
// Payment: in-site balance first, external wallet covers shortfall; BBS with admin delete/ban/blocked-word moderation
// =============================================================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortAddr = (a = '') => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const codeLen = (s) => [...String(s)].length;
const byteLen = (s) => new TextEncoder().encode(String(s ?? '')).length; // UTF-8 byte count
const BBS_MAX_BYTES = 1024; // BBS per-post limit 1024 bytes

function showToast(msg, ms = 1800) {
  let el = document.getElementById('globalToast');
  if (!el) { el = document.createElement('div'); el.id = 'globalToast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

const utcHM = (sec) => new Date(sec * 1000).toISOString().slice(11, 16) + ' UTC';
const pad2 = (n) => String(n).padStart(2, '0');

const I18N = {
  en: {
    coinUnit: 'coins', platformTitle: 'Global Self-Service Charity Donation Platform', platformDesc: 'The Amsterdam team is committed to providing direct donations to people in need worldwide. Through blockchain, we offer transparent, fair, traceable free donation matching. Those in need receive lossless support, while donors gain recognition and rewards. Donation features are under rapid development.', appTitle: 'Three-Minute Wish Pool', loginTip: 'Connect a wallet to start. Invite links bind referrers automatically.', connectWallet: 'Connect Wallet', demoEnter: 'No wallet? Enter as demo', logout: 'Sign out',
    dockHome: 'Home', dockLottery: 'Lucky', dockBbs: 'Board', dockIns: 'Insurance', dockMe: 'Me', disclaimerTitle: 'Serious Statement', disclaimerAgree: 'I have read and agree', lotteryTitle: 'Lucky Draw Pools', lotteryMainTitle: 'Good People Get Good Rewards', lotterySubtitle: 'One coin can win up to 5000 coins', lotteryRulesTitle: 'How to Play', lotteryRule1: 'Choose a lucky pool and enter an integer amount (min 1 coin). Numbers are assigned sequentially on a first-come basis.', lotteryRule2: 'When all numbers are sold, the system automatically draws winners randomly. Fully fair and transparent, everyone can view the winning numbers.', lotteryRule3: 'Prize money is automatically credited to your balance and can be withdrawn immediately - no holding, no application, no review.', lotteryRule4: 'Every number has equal odds. The more you buy, the greater your chance. A new round starts automatically after each draw.', lotteryRule5: 'Platform charges 5% fee for operations and charitable donations. Good people get good rewards. Good luck!', announcement: 'Announcement', publishAnnouncement: 'Publish',
    remainSec: 'seconds left', lockAt: 'closed at 170s', betCount: 'Wishes', redPool: 'Red Pool', greenPool: 'Green Pool',
    oddWin: 'Odd sum → Red', evenWin: 'Even sum → Green', pickLabel: 'Pick a number (0-9)',
    amountLabel: 'Wish amount (1-99 枚, integer)', confirmWish: 'Confirm Wish', waitingStart: 'Waiting for the first wish…', historyTitle: 'Past rounds',
    insTitle: 'Wish Insurance', insSwitch: 'Insurance', premium: 'Premium', lossAccum: 'Net loss', depositPremium: 'Deposit premium',
    insRule: 'Active only when switched on and premium ≥ 20 枚. Insured winners contribute 10% to the pool; every 100 枚 net loss opens a payout node (costs 20 枚), returned over 100 periods.',
  winCongrats: '🎉 Wish placed successfully! Wishing you great fortune every day!',
  insLightOn: 'Insurance active', insLightOff: 'Insurance inactive (switch ON and keep ≥20 枚 premium)',
  insStatusLabel: 'Insurance status',
  insOnBar: 'Insurance active', insOffBar: 'Insurance off',
    howtoTitle: 'How to Play', howtoStep1: 'Pick Red or Green pool, enter 1-99 units, choose a number 0-9', howtoStep2: 'Sum of all picks: odd = Red wins, even = Green wins. Winners split pool after 2.5% fee', howtoStep3: 'No insurance: keep all winnings after fee. With insurance (premium >=20 + switch on): pay 10% of winnings, but losses accumulate - every 100 units lost creates a payout node returned over 100 periods',
    insGuideTitle: 'Insurance Guide', insGuide1: 'Activate: turn on the switch AND keep premium balance >= 20 units', insGuide2: 'When you win: 10% of your winnings goes to the insurance pool', insGuide3: 'When you lose: net loss accumulates. Every 100 units lost creates one payout node (20 units premium deducted), returned over 100 periods', insGuide4: 'Payout every 6 hours (UTC 3/9/15/21). Any new node within 168 hours revives all your nodes; otherwise current period is forfeited', insGuide5: 'Withdraw premium back to balance only when insurance switch is off',
    whitelistTitle: 'Invite Whitelist', addWhitelist: 'Add', wlTip: 'You are on the official whitelist. You earn commission on ALL generations of downlines, at your set rate. If a downline is also whitelisted, you earn only the rate difference.', wlScope: 'Scope', wlAllDepth: 'All generations', normalInvTip: 'Standard users earn 0.1% on direct referrals only. Contact admin to apply for whitelist (multi-level commission).', normalDirect: 'Direct referrals only', applyWhitelistTip: 'If you have a strong team and understand our platform vision, post in the Board so the official team can find you.',
    myNodes: 'My payout nodes', poolTotal: 'Insurance pool', poolNext: 'Next release total', poolNextAt: 'Next release at', nextReleaseIn: 'Next in', poolActiveNodes: 'Active nodes',
    poolSufficient: 'Sufficient', poolShort: 'Shortfall', poolCover: 'Coverage',
    meWallet: 'Wallet', meInvite: 'Invite', copy: 'Copy', scanQr: 'Scan QR to join', qualifiedInvitees: 'Qualified', curRate: 'Rate', invTotal: 'Total',
    directInvitees: 'Direct invites', downlineTotal: 'Total downline',
    invTierTip: 'Tier is set by how many direct friends ever generated a payout node; commission on their wish volume:', invColPeople: 'Qualified friends', invColRate: 'Rate', invPeopleUnit: '',
    bbsTitle: 'Board (plain text, up to 1024 bytes)', bbsPlaceholder: 'Say something (max 1024 bytes)', bbsSend: 'Post', bbsEmpty: 'No posts yet. Be the first.',
    adminModeration: 'Moderation', addBlockedWord: 'Block word', wordPh: 'Add a blocked word', deletePost: 'Delete', banUser: 'Ban', unbanUser: 'Unban', bannedTag: 'BANNED', noBlocked: 'No blocked words', npcAdded: 'NPC added successfully', npcAddFail: 'Failed to add NPC', npcNamePh: 'Name (optional)', npcWalletPh: '0x wallet (optional)', npcAddBtn: 'Add',
    avail: 'Available', frozen: 'Held', withdraw: 'Withdraw (2-500, fee 1)', withdrawing: 'Processing…', flows: 'Transactions',
    wdOk: 'Withdrawal sent.', wdCheckReceive: 'Please check your wallet for the funds.', wdPending: 'Submitted, pending platform processing.',
    premiumWithdraw: 'Premium → balance (insurance OFF)', premiumOutPh: 'Blank = withdraw all', premiumNeed: 'Enter a positive integer amount',
   
    chainOn: 'On-chain: balance first, the shortfall is paid from your wallet.', chainOff: 'Off-chain balance mode (no token configured).', chainPending: 'Submitted, waiting for confirmation…', pendingLock: 'Previous transaction is still confirming on-chain. Wait a few seconds — do NOT submit again; it is credited automatically.', walletChanged: 'Active wallet differs from the logged-in account. Log out and reconnect the same wallet.',
    pendingTitle: 'Pending on-chain payments', pendingVerify: 'Verify & credit now', chainWillCredit: 'Paid on-chain. It is credited automatically once confirmed; you can also tap Verify under Me.', chainCreditedRedo: 'Your on-chain payment has been credited to balance, please place the wish again.',
    manualCredit: 'Credit by hash', manualTxPh: 'Paste 0x… tx hash to credit', manualOk: 'Credited to balance', manualAlready: 'This tx was already credited', manualBadHash: 'Invalid tx hash',
    stateActive: 'Live', stateLocked: 'Closed', stateSettled: 'Settled', stateCancelled: 'Void (empty), refunded', winRed: 'Red wins', winGreen: 'Green wins',
    nodeProgress: 'Progress', nodePeriod: 'Periods', pickNum: 'Pick', stake: 'Amount', detail: 'Detail', close: 'Close',
    needPick: 'Please pick a number 0-9 first', needAmount: 'Enter an integer 1-99 (枚)', copyOk: 'Copied', noWallet: 'No wallet extension detected',
    walletShort: 'Wallet balance short by', noWalletGap: 'No wallet detected. Open this site inside the TokenPocket DApp browser, or install & unlock a wallet extension.', offchainShort: 'Balance not enough (short',
    chainNotConfigured: 'This site has no on-chain token configured, so wallet payment is unavailable. Please use the deployed online site.', wrongChain: 'Please switch the wallet network to BNB Smart Chain (chainId 56).',
    selfCheck: 'Wallet environment check', scSite: 'Site chain config', scNoSite: 'NOT configured (use online site)', scWallet: 'Wallet detected', scNoWallet: 'NONE — open inside TokenPocket DApp browser, or install a wallet extension', scNet: 'Current network', scAccount: 'Authorized account', scNoAccount: 'none (connect/unlock wallet)', scWhich: 'Wallet type',
    reply: 'Reply', sendReply: 'Send', replyPh: 'Write a reply (max 1024 bytes)', replies: 'replies', confirmDelPost: 'Delete this post and its replies?',
    flow_BET_FROZEN: 'Wish placed', flow_WIN_CREDIT: 'Win credited', flow_INS_WIN_CUT: 'Insured 10% to pool', flow_CANCEL_REFUND: 'Void refund',
    flow_REFERRAL: 'Referral reward', flow_PREMIUM_IN: 'Premium deposit', flow_NODE_PREMIUM_OUT: 'Node premium', flow_NODE_PAYOUT: 'Node payout', flow_NODE_FORFEIT: 'Lapsed to pool',
    flow_WITHDRAW_FEE: 'Withdraw fee', flow_WITHDRAW_PENDING: 'Withdraw', flow_WITHDRAW_PAID: 'Withdraw paid', flow_WITHDRAW_REFUND: 'Withdraw refunded',
    flow_FAUCET: 'Test claim', flow_CHAIN_DEPOSIT: 'On-chain deposit', flow_ISSUE: 'System credit',
  },
  'zh-TW': {
    coinUnit: '枚', platformTitle: '全球自助慈善捐助平台', platformDesc: '阿姆斯特丹團隊致力為全球有需要的人士提供直接捐助，以區塊鏈模式，公開、公正、可追溯的自由捐贈撮合服務，除了讓需要的人得到無損資助外，讓愛心人士也能得到肯定和收益。捐助服務功能正在加緊開發，近期將正式與大家見面。', appTitle: '三分鐘願望池', loginTip: '連接錢包即可開始，邀請連結自動綁定推薦關係', connectWallet: '連接錢包', demoEnter: '未裝錢包？以演示身份進入', logout: '退出',
    dockHome: '首頁', dockLottery: '慈善', dockBbs: '廣場', dockIns: '保險', dockMe: '我的', disclaimerTitle: '嚴重聲明', disclaimerAgree: '我已閱讀並同意', lotteryTitle: '幸運抽獎池', lotteryMainTitle: '好人有好報', lotterySubtitle: '一枚最多得5000枚', lotteryRulesTitle: '玩法說明', lotteryRule1: '選擇一個幸運池，投入整數枚數（最少1枚），系統按先來後到分配連續號碼。', lotteryRule2: '號碼售完後，系統自動隨機開獎，完全公平公正，所有人均可查看中獎號碼。', lotteryRule3: '獎金自動發放到您的餘額，可立即提現，不押不申請不審核。', lotteryRule4: '每個號碼中獎概率相同，買得越多中獎機會越大。一期結束自動開啟下一期。', lotteryRule5: '平台收取5%手續費，用於平台運營與慈善捐助。好人有好報，祝您好運！', announcement: '系統公告', publishAnnouncement: '發布公告',
    remainSec: '剩餘秒數', lockAt: '150秒停止許願', betCount: '許願筆數', redPool: '紅願池', greenPool: '綠願池',
    oddWin: '選號總和為單 → 紅勝', evenWin: '選號總和為雙 → 綠勝', pickLabel: '選擇一個數字（0-9）',
    amountLabel: '許願金（1-99 枚，正整數）', confirmWish: '確認許願', waitingStart: '等待第一個願望進場…', historyTitle: '往期記錄',
    insTitle: '願望保險', insSwitch: '保險開關', premium: '保費餘額', lossAccum: '淨虧累計', depositPremium: '存入保費',
    insRule: '開關開且保費≥20枚才生效；生效贏家收益再扣10%入保池；淨虧每滿100枚生成一個賠付節點並扣20枚保費，節點分100期返還。',
  winCongrats: '🎉 恭喜許願成功，祝您天天發大財！',
  insLightOn: '保險生效中', insLightOff: '保險未生效（開關開且保費≥20枚才生效）',
  insStatusLabel: '保險狀態',
  insOnBar: '保險生效中', insOffBar: '保險關閉中',
    howtoTitle: '玩法介紹', howtoStep1: '選擇紅願池或綠願池，輸入1-99枚，選擇0-9的數字', howtoStep2: '所有人選號相加：單數→紅勝，雙數→綠勝。勝方扣除2.5%手續費後按投入比例分配', howtoStep3: '不保險：贏了扣除手續費後全拿。買保險（保費≥20枚且開關開）：贏了再扣10%入保池，但輸了累計淨虧，每滿100枚生成一個賠付節點分100期返還',
    insGuideTitle: '保險玩法說明', insGuide1: '生效條件：開關打開且保費餘額≥20枚', insGuide2: '贏了：收益的10%進入保險池', insGuide3: '輸了：淨虧累計，每滿100枚生成一個賠付節點（扣20枚保費），分100期返還', insGuide4: '每6小時賠付一次（UTC 3/9/15/21點）。168小時內有新節點則全部續命，否則當期充公', insGuide5: '保險開關關閉時，可將保費提回餘額',
    whitelistTitle: '邀請白名單', addWhitelist: '添加', wlTip: '您在官方白名單中。可享所有下代的傭金，按設定比例。若下線也是白名單，只賺級差。', wlScope: '範圍', wlAllDepth: '所有代數', normalInvTip: '普通用戶僅享直推0.1%。聯繫管理員申請白名單（多級傭金）。', normalDirect: '僅直推', applyWhitelistTip: '如果你有優質團隊並且理解本平台理念，可以到廣場發貼，讓官方找到你。',
    myNodes: '我的賠付節點', poolTotal: '保險池總資金', poolNext: '下次應釋放總額', poolNextAt: '下次釋放時刻', nextReleaseIn: '距下次釋放', poolActiveNodes: '待釋放節點',
    poolSufficient: '資金充足', poolShort: '資金缺口', poolCover: '覆蓋率',
    meWallet: '錢包', meInvite: '邀請返傭', copy: '複製', scanQr: '掃碼加入', qualifiedInvitees: '達標好友', curRate: '返傭率', invTotal: '累計返傭',
    directInvitees: '直推人數', downlineTotal: '下線總人數',
    invTierTip: '名下有「生成過賠付節點」的直邀好友數決定檔位，按好友許願流水返傭：', invColPeople: '達標好友', invColRate: '返傭率', invPeopleUnit: '人',
    bbsTitle: '廣場（1024位元組以內純文字）', bbsPlaceholder: '說點什麼吧（最多1024位元組）', bbsSend: '發佈', bbsEmpty: '還沒有留言，來說第一句',
    adminModeration: '管理員治理', npcAdded: 'NPC添加成功', npcAddFail: 'NPC添加失敗', npcNamePh: '名稱（選填）', npcWalletPh: '0x錢包地址（選填）', npcAddBtn: '添加', addBlockedWord: '加入屏蔽詞', wordPh: '輸入要屏蔽的詞', deletePost: '刪帖', banUser: '封號', unbanUser: '解封', bannedTag: '已封號', noBlocked: '暫無屏蔽詞',
    avail: '可用', frozen: '凍結', withdraw: '提現（單筆2-500，費1枚）', withdrawing: '處理中…', flows: '收支流水',
    wdOk: '提現已發送', wdCheckReceive: '請注意查收。', wdPending: '已提交，待平台處理。',
    premiumWithdraw: '保費提回餘額（需先關閉保險）', premiumOutPh: '留空＝全部提回', premiumNeed: '請輸入正整數金額',
   
    chainOn: '鏈上模式：優先用站內餘額，不足部分由錢包補足', chainOff: '站內餘額模式（未配置鏈上代幣）', chainPending: '鏈上交易已提交，正在等待確認…', pendingLock: '上一筆正在鏈上確認，請稍候幾秒、切勿重複許願，確認後會自動到帳。', walletChanged: '目前錢包帳戶與登入帳號不一致，請退出後重新連接同一個錢包。',
    pendingTitle: '待核驗的鏈上支付', pendingVerify: '重新核驗並入帳', chainWillCredit: '鏈上已支付，確認後會自動補入餘額，也可到「我的」手動核驗。', chainCreditedRedo: '鏈上支付已補入餘額，請重新許願。',
    manualCredit: '貼哈希補入帳', manualTxPh: '貼上 0x… 交易哈希補錄入帳', manualOk: '已補入餘額', manualAlready: '此交易先前已入帳', manualBadHash: '交易哈希格式不正確',
    stateActive: '進行中', stateLocked: '已停止許願', stateSettled: '已開獎', stateCancelled: '無人對局已退回', winRed: '紅勝', winGreen: '綠勝',
    nodeProgress: '進度', nodePeriod: '已釋放期數', pickNum: '選號', stake: '投入', detail: '明細', close: '收起',
    needPick: '請先選擇 0-9 的數字', needAmount: '請輸入 1-99 的正整數（枚）', copyOk: '已複製', noWallet: '未檢測到錢包插件',
    walletShort: '錢包餘額不足，還差', noWalletGap: '未檢測到錢包：請在 TokenPocket 錢包的 DApp 瀏覽器內打開本站，或在瀏覽器安裝並解鎖錢包外掛', offchainShort: '站內餘額不足（差',
    chainNotConfigured: '本站未配置鏈上代幣，無法從錢包扣款，請使用已部署的線上站點', wrongChain: '請把錢包網路切換到 BNB Smart Chain（chainId 56）',
    selfCheck: '錢包環境自檢', scSite: '站點鏈配置', scNoSite: '未配置（請用線上站點）', scWallet: '是否檢測到錢包', scNoWallet: '無——請在 TokenPocket 的 DApp 瀏覽器內打開，或安裝錢包外掛', scNet: '目前網路', scAccount: '已授權帳戶', scNoAccount: '無（請連接/解鎖錢包）', scWhich: '錢包類型',
    reply: '回覆', sendReply: '送出', replyPh: '寫下回覆（最多1024位元組）', replies: '則回覆', confirmDelPost: '確定刪除該帖及其全部回覆？',
    flow_BET_FROZEN: '許願投入', flow_WIN_CREDIT: '中獎到帳', flow_INS_WIN_CUT: '保險贏家扣10%', flow_CANCEL_REFUND: '對局退款',
    flow_REFERRAL: '邀請返傭', flow_PREMIUM_IN: '存入保費', flow_NODE_PREMIUM_OUT: '節點扣保費', flow_NODE_PAYOUT: '節點賠付', flow_NODE_FORFEIT: '斷保當期充公',
    flow_WITHDRAW_FEE: '提現手續費', flow_WITHDRAW_PENDING: '提現', flow_WITHDRAW_PAID: '提現到帳', flow_WITHDRAW_REFUND: '提現退回',
    flow_FAUCET: '測試領幣', flow_CHAIN_DEPOSIT: '鏈上轉入', flow_ISSUE: '系統入帳',
  },
  ja: {
    coinUnit: '枚', platformTitle: 'グローバルセルフサービス慈善寄付プラットフォーム', platformDesc: 'アムステルダムチームは世界中の困っている人々に直接寄付を提供することを約束します。ブロックチェーンを通じて透明で公平、追跡可能な無料寄付マッチングを提供します。困っている人は損失のない支援を受け、寄付者は認識と報酬を得ます。寄付機能は現在急速に開発中です。', appTitle: '3分間願い池', loginTip: 'ウォレット接続で開始。招待リンクで紹介者を自動登録します', connectWallet: 'ウォレット接続', demoEnter: 'ウォレットなし？デモで入る', logout: 'ログアウト',
    dockHome: 'ホーム', dockLottery: '慈善', dockBbs: '広場', dockIns: '保険', dockMe: 'マイ', disclaimerTitle: '重大声明', disclaimerAgree: '読んで同意します', lotteryTitle: 'ラッキー抽選プール', lotteryMainTitle: '良い人には良い報いが', lotterySubtitle: '1枚で最大5000枚獲得', lotteryRulesTitle: '遊び方', lotteryRule1: 'ラッキープールを選び、整数枚（最小1枚）を投入。番号は先着順に連続で割り当てられます。', lotteryRule2: '番号が完売すると、システムが自動的にランダム抽選。完全に公平で透明、誰でも当選番号を確認できます。', lotteryRule3: '賞金は自動的に残高に入金され、すぐに出金可能。保留・申請・審査なし。', lotteryRule4: 'すべての番号の当選確率は同じ。購入するほど当選チャンスが増えます。抽選後は自動的に次のラウンドが開始。', lotteryRule5: 'プラットフォームは運営と慈善寄付のため5%の手数料を徴収。良い人には良い報いが。幸運を！', announcement: 'お知らせ', publishAnnouncement: '公開する',
    remainSec: '残り秒数', lockAt: '150秒で締切', betCount: '願い数', redPool: '赤の願い池', greenPool: '緑の願い池',
    oddWin: '合計が奇数 → 赤の勝ち', evenWin: '合計が偶数 → 緑の勝ち', pickLabel: '数字を選ぶ（0-9）',
    amountLabel: '願い金（1-99 枚、整数）', confirmWish: '願いを確定', waitingStart: '最初の願いを待っています…', historyTitle: '過去の記録',
    insTitle: '願い保険', insSwitch: '保険スイッチ', premium: '保険料残高', lossAccum: '純損失累計', depositPremium: '保険料を入れる',
    insRule: 'スイッチONかつ保険料≥20枚で有効。適用勝者は利益の10%を保険池へ。純損失100枚ごとに返還ノード生成（保険料20枚差引）、100期で返還。',
  winCongrats: '🎉 願いの投稿に成功しました！毎日たくさんの幸運が訪れますように！',
  insLightOn: '保険有効中', insLightOff: '保険無効（スイッチONかつ保険料20枚以上で有効）',
  insStatusLabel: '保険状態',
  insOnBar: '保険有効中', insOffBar: '保険OFF',
    howtoTitle: '遊び方', howtoStep1: '赤か緑のプールを選び、1-99枚を入力、0-9の数字を選ぶ', howtoStep2: '全員の数字の合計：奇数→赤の勝ち、偶数→緑の勝ち。勝者は2.5%手数料後に分配', howtoStep3: '保険なし：手数料後の勝利金を全額受け取る。保険あり（保険料≥20枚＋スイッチオン）：勝利金の10%を保険プールへ、負けたら損失が累積し100枚ごとに返済ノードが生成され100期で返還',
    insGuideTitle: '保険ガイド', insGuide1: '有効化：スイッチオン＋保険料残高≥20枚', insGuide2: '勝った場合：勝利金の10%が保険プールへ', insGuide3: '負けた場合：純損失が累積。100枚ごとに返済ノード（保険料20枚控除）、100期で返還', insGuide4: '6時間ごとに返済（UTC 3/9/15/21）。168時間以内に新ノードがあれば全て継続、なければ当期は没収', insGuide5: '保険スイッチオフ時のみ保険料を残高へ戻せる',
    whitelistTitle: '招待ホワイトリスト', addWhitelist: '追加', wlTip: 'あなたは公式ホワイトリストに登録されています。設定レートで全世代の紹介手数料を獲得。下流もホワイトリストの場合は差額のみ。', wlScope: '範囲', wlAllDepth: '全世代', normalInvTip: '通常ユーザーは直接紹介のみ0.1%。ホワイトリスト申請は管理者へ。', normalDirect: '直接紹介のみ', applyWhitelistTip: '優秀なチームをお持ちでプラットフォーム理念をご理解の方は、掲示板に投稿して公式チームに見つけてもらいましょう。',
    myNodes: '私の返還ノード', poolTotal: '保険池の総額', poolNext: '次回解放予定額', poolNextAt: '次回解放時刻', nextReleaseIn: '次回まで', poolActiveNodes: '解放待ちノード',
    poolSufficient: '資金十分', poolShort: '不足額', poolCover: '充足率',
    meWallet: 'ウォレット', meInvite: '招待報酬', copy: 'コピー', scanQr: 'QRコードをスキャン', qualifiedInvitees: '条件達成', curRate: 'レート', invTotal: '累計報酬',
    directInvitees: '直接招待数', downlineTotal: '下流れ合計人数',
    invTierTip: '返還ノードを生成した直招待人数で档位が決定、招待した人の投入額に応じて報酬：', invColPeople: '達成フレンド', invColRate: '報酬率', invPeopleUnit: '人',
    bbsTitle: '広場（1024バイト以内のテキスト）', bbsPlaceholder: 'ひとこと（最大1024バイト）', bbsSend: '投稿', bbsEmpty: 'まだ投稿はありません',
    adminModeration: 'モデレーション', npcAdded: 'NPC追加成功', npcAddFail: 'NPC追加失敗', npcNamePh: '名前（任意）', npcWalletPh: '0xウォレット（任意）', npcAddBtn: '追加', addBlockedWord: 'NGワード追加', wordPh: 'NGワードを入力', deletePost: '削除', banUser: 'BAN', unbanUser: '解除', bannedTag: 'BAN済', noBlocked: 'NGワードなし',
    avail: '利用可能', frozen: '保留中', withdraw: '出金（2-500、手数料1枚）', withdrawing: '処理中…', flows: '取引履歴',
    wdOk: '送金しました。', wdCheckReceive: 'ウォレットへの着金をご確認ください。', wdPending: '送信済み。プラットフォーム処理待ち。',
    premiumWithdraw: '保険料を残高へ戻す（保険OFF時）', premiumOutPh: '空欄＝全額戻す', premiumNeed: '正の整数を入力してください',
   
    chainOn: 'オンチェーン：残高を優先し、不足分だけウォレットから支払い', chainOff: 'オフチェーン残高モード（トークン未設定）', chainPending: '送信済み、承認待ちです…', pendingLock: '直前の取引がオンチェーン承認待ちです。数秒お待ちください（重複提交はしないでください）。承認後に自動で反映されます。', walletChanged: '現在のウォレットがログイン中アカウントと異なります。ログアウトして同じウォレットを再接続してください。',
    pendingTitle: '未確認のオンチェーン支払い', pendingVerify: '再確認して入金', chainWillCredit: 'オンチェーンで支払い済み。承認後に自動入金されます。マイで手動確認も可能です。', chainCreditedRedo: 'オンチェーン支払いを残高に入金しました。もう一度願いを入力してください。',
    manualCredit: 'ハッシュで入金', manualTxPh: '0x… トランザクションハッシュを貼って入金', manualOk: '残高に入金しました', manualAlready: 'この取引は入金済みです', manualBadHash: 'トランザクションハッシュ形式が不正です',
    stateActive: '進行中', stateLocked: '締切済み', stateSettled: '確定', stateCancelled: '不成立（無人）返金', winRed: '赤の勝ち', winGreen: '緑の勝ち',
    nodeProgress: '進捗', nodePeriod: '解放済期', pickNum: '数字', stake: '投入', detail: '詳細', close: '閉じる',
    needPick: '先に0-9の数字を選んでください', needAmount: '1-99の整数（枚）を入力', copyOk: 'コピーしました', noWallet: 'ウォレット拡張が未検出',
    walletShort: 'ウォレット残高不足（あと', noWalletGap: 'ウォレット未検出。TokenPocket のDAppブラウザで開くか、ウォレット拡張をインストール・解除してください', offchainShort: '残高不足（不足',
    chainNotConfigured: 'このサイトにはオンチェーン銘柄が未設定で、ウォレット支払いできません。デプロイ済みサイトをご利用ください', wrongChain: 'ウォレットのネットワークを BNB Smart Chain（chainId 56）に切り替えてください',
    selfCheck: 'ウォレット環境チェック', scSite: 'サイトのチェーン設定', scNoSite: '未設定（オンライン版を使用）', scWallet: 'ウォレット検出', scNoWallet: 'なし — TokenPocket のDAppブラウザで開くか、ウォレット拡張を入れてください', scNet: '現在のネットワーク', scAccount: '許可アカウント', scNoAccount: 'なし（ウォレット接続/解除を）', scWhich: 'ウォレット種別',
    reply: '返信', sendReply: '送信', replyPh: '返信を書く（最大1024バイト）', replies: '件', confirmDelPost: 'この投稿と返信を削除しますか？',
    flow_BET_FROZEN: '願い投入', flow_WIN_CREDIT: '当選入金', flow_INS_WIN_CUT: '保険勝者10%', flow_CANCEL_REFUND: '不成立返金',
    flow_REFERRAL: '招待報酬', flow_PREMIUM_IN: '保険料投入', flow_NODE_PREMIUM_OUT: 'ノード保険料', flow_NODE_PAYOUT: 'ノード返還', flow_NODE_FORFEIT: '失効分を保険池へ',
    flow_WITHDRAW_FEE: '出金手数料', flow_WITHDRAW_PENDING: '出金', flow_WITHDRAW_PAID: '出金完了', flow_WITHDRAW_REFUND: '出金差戻し',
    flow_FAUCET: 'テスト受取', flow_CHAIN_DEPOSIT: 'オンチェーン入金', flow_ISSUE: 'システム入金',
  },
  ar: {
    coinUnit: 'عملات', platformTitle: 'منصة التبرع الخيري العالمية ذاتية الخدمة', platformDesc: 'يلتزم فريق أمستردام بتقديم تبرعات مباشرة للمعوزين حول العالم. من خلال البلوكشين، نقدم مطابقة تبرعات مجانية شفافة وعادلة وقابلة للتتبع. يحصل المعوزون على دعم بلا خسارة، بينما يحصل المتبرعون على التقدير والمكافآت. ميزات التبرع قيد التطوير السريع.', appTitle: 'بركة الأمنيات لمدة ثلاث دقائق', loginTip: 'اتصل بالمحفظة للبدء. روابط الدعوة تربط المُحيل تلقائياً.', connectWallet: 'اتصال بالمحفظة', demoEnter: 'لا توجد محفظة؟ ادخل كزائر', logout: 'خروج',
    dockHome: 'الرئيسية', dockBbs: 'المنتدى', dockIns: 'التأمين', dockMe: 'حسابي', disclaimerTitle: 'بيان جاد', disclaimerAgree: 'لقد قرأت وأوافق', announcement: 'إعلان', publishAnnouncement: 'نشر',
    remainSec: 'ثانية متبقية', lockAt: 'يُغلق عند 150 ثانية', betCount: 'الأمنيات', redPool: 'بركة الأحمر', greenPool: 'بركة الأخضر',
    oddWin: 'مجموع الأرقام فردي → يفوز الأحمر', evenWin: 'مجموع الأرقام زوجي → يفوز الأخضر', pickLabel: 'اختر رقماً (0-9)',
    amountLabel: 'مبلغ الأمنية (1-99 عملة، عدد صحيح)', confirmWish: 'تأكيد الأمنية', waitingStart: 'في انتظار أول أمنية…', historyTitle: 'الجولات السابقة',
    insTitle: 'تأمين الأمنية', insSwitch: 'التأمين', premium: 'رسم التأمين', lossAccum: 'صافي الخسارة', depositPremium: 'إيداع رسم التأمين',
    insRule: 'يسري فقط عند التشغيل ورسم تأمين ≥20 عملة. الفائزون المؤمّنون يدفعون 10% إلى البركة؛ كل 100 عملة خسارة صافية تفتح عقد تعويض (يكلف 20 عملة)، يُرد على 100 فترة.',
    winCongrats: '🎉 تم تقديم الأمنية بنجاح! نتمنى لك الثروة كل يوم!',
    insLightOn: 'التأمين ساري', insLightOff: 'التأمين غير ساري (شغّله واحتفظ بـ≥20 عملة رسم تأمين)',
    insStatusLabel: 'حالة التأمين',
    insOnBar: 'التأمين ساري', insOffBar: 'التأمين متوقف',
    howtoTitle: 'كيفية اللعب', howtoStep1: 'اختر تجمع الأحمر أو الأخضر، أدخل 1-99 وحدة، اختر رقماً 0-9', howtoStep2: 'مجموع جميع الأرقام: فردي = يفوز الأحمر، زوجي = يفوز الأخضر. يشارك الفائزون بعد خصم 2.5%', howtoStep3: 'بدون تأمين: تحصل على كل أرباحك بعد الرسوم. مع التأمين (قسط ≥20 + التشغيل): تدفع 10% من الأرباح، لكن الخسائر تتراكم - كل 100 وحدة خسارة تنشئ عقد سداد يُعاد على 100 فترة',
    insGuideTitle: 'دليل التأمين', insGuide1: 'التفعيل: شغل المفتاح واحتفظ برصيد قسط ≥20 وحدة', insGuide2: 'عند الفوز: 10% من أرباحك تذهب إلى تجمع التأمين', insGuide3: 'عند الخسارة: تتراكم الخسارة الصافية. كل 100 وحدة خسارة تنشئ عقد سداد (يُخصم 20 وحدة قسط)، يُعاد على 100 فترة', insGuide4: 'السداد كل 6 ساعات (UTC 3/9/15/21). أي عقد جديد خلال 168 ساعة ينشط جميع عقودك؛ وإلا تُصادر الفترة الحالية', insGuide5: 'يمكن إرجاع القسط إلى الرصيد فقط عند إيقاف تشغيل التأمين',
    whitelistTitle: 'القائمة البيضاء للدعوة', addWhitelist: 'إضافة', wlTip: 'أنت في القائمة البيضاء الرسمية. تكسب عمولة على جميع الأجيال بالمعدل المحدد. إذا كان المُدعى أيضاً في القائمة البيضاء، تكسب الفرق فقط.', wlScope: 'النطاق', wlAllDepth: 'جميع الأجيال', normalInvTip: 'المستخدمون العاديون يكسبون 0.1% على الإحالات المباشرة فقط. تواصل مع الإدارة للتقدم للقائمة البيضاء.', normalDirect: 'إحالات مباشرة فقط', applyWhitelistTip: 'إذا كان لديك فريق قوي وتفهم رؤية المنصة، انشر في اللوحة حتى يجدك الفريق الرسمي.',
    myNodes: 'عقود التعويض الخاصة بي', poolTotal: 'إجمالي بركة التأمين', poolNext: 'إجمالي الإصدار القادم', poolNextAt: 'وقت الإصدار القادم', nextReleaseIn: 'القادم بعد', poolActiveNodes: 'العقود النشطة',
    poolSufficient: 'كافٍ', poolShort: 'عجز', poolCover: 'نسبة التغطية',
    meWallet: 'المحفظة', meInvite: 'الدعوة', copy: 'نسخ', scanQr: 'امسح QR للانضمام', qualifiedInvitees: 'المؤهلون', curRate: 'النسبة', invTotal: 'الإجمالي',
    invTierTip: 'تُحدد الشريدة بعدد الأصدقاء المباشرين الذين ولد لهم عقد تعويض؛ العمولة على حجم أمنياتهم:', invColPeople: 'أصدقاء مؤهلون', invColRate: 'النسبة', invPeopleUnit: '',
    bbsTitle: 'المنتدى (نص عادي، حتى 1024 بايت)', bbsPlaceholder: 'قل شيئاً (حد أقصى 1024 بايت)', bbsSend: 'نشر', bbsEmpty: 'لا توجد مشاركات بعد. كن الأول.',
    adminModeration: 'الإشراف', addBlockedWord: 'حظر كلمة', wordPh: 'أدخل كلمة للحظر', deletePost: 'حذف', banUser: 'حظر', unbanUser: 'رفع الحظر', bannedTag: 'محظور', noBlocked: 'لا توجد كلمات محظورة', npcAdded: 'تمت إضافة NPC بنجاح', npcAddFail: 'فشل إضافة NPC', npcNamePh: 'الاسم (اختياري)', npcWalletPh: '0x المحفظة (اختياري)', npcAddBtn: 'إضافة',
    avail: 'متاح', frozen: 'محتجز', withdraw: 'سحب (2-500، رسوم 1)', withdrawing: 'جارٍ المعالجة…', flows: 'المعاملات',
    wdOk: 'تم إرسال السحب.', wdCheckReceive: 'يرجى التحقق من محفظتك للحصول على الأموال.', wdPending: 'تم الإرسال، بانتظار معالجة المنصة.',
    premiumWithdraw: 'رسم التأمين → الرصيد (التأمين متوقف)', premiumOutPh: 'اتركه فارغاً = سحب الكل', premiumNeed: 'أدخل مبلغاً صحيحاً موجباً',
    chainOn: 'على السلسلة: الرصيد أولاً، والجزء الناقص يُدفع من محفظتك.', chainOff: 'وضع الرصيد خارج السلسلة (لم يتم تكوين رمز مميز).', chainPending: 'تم الإرسال، بانتظار التأكيد…', pendingLock: 'المعاملة السابقة لا تزال قيد التأكيد على السلسلة. انتظر ثوانٍ — لا تُرسل مرة أخرى؛ سيُضاف تلقائياً.', walletChanged: 'المحفظة النشطة تختلف عن الحساب المسجل. اخرج وأعد الاتصال بنفس المحفظة.',
    pendingTitle: 'مدفوعات السلسلة قيد الانتظار', pendingVerify: 'تحقق وأضف الآن', chainWillCredit: 'تم الدفع على السلسلة. يُضاف تلقائياً بعد التأكيد؛ يمكنك أيضاً الضغط على تحقق ضمن حسابي.', chainCreditedRedo: 'تمت إضافة الدفع على السلسلة إلى الرصيد، يرجى إعادة تقديم الأمنية.',
    manualCredit: 'إضافة بالهاش', manualTxPh: 'الصق هاش 0x… للإضافة', manualOk: 'أُضيف إلى الرصيد', manualAlready: 'تمت إضافة هذه المعاملة سابقاً', manualBadHash: 'هاش معاملة غير صالح',
    stateActive: 'مباشر', stateLocked: 'مغلق', stateSettled: 'مُحسم', stateCancelled: 'باطل (فارغ)، تم الاسترداد', winRed: 'الفوز بالأحمر', winGreen: 'الفوز بالأخضر',
    nodeProgress: 'التقدم', nodePeriod: 'الفترات', pickNum: 'الرقم', stake: 'المبلغ', detail: 'التفاصيل', close: 'إغلاق',
    needPick: 'يرجى اختيار رقم 0-9 أولاً', needAmount: 'أدخل عدداً صحيحاً 1-99 (عملة)', copyOk: 'تم النسخ', noWallet: 'لم يتم اكتشاف إضافة محفظة',
    walletShort: 'رصيد المحفظة ناقص بمقدار', noWalletGap: 'لم يتم اكتشاف محفظة. افتح هذا الموقع داخل متصفح DApp في TokenPocket، أو ثبّت وافتح إضافة محفظة.', offchainShort: 'الرصيد غير كافٍ (ناقص',
    chainNotConfigured: 'لم يتم تكوين رمز مميز على السلسلة لهذا الموقع، لذا لا يتوفر الدفع من المحفظة. يرجى استخدام الموقع المُنشر.', wrongChain: 'يرجى تبديل شبكة المحفظة إلى BNB Smart Chain (chainId 56).',
    selfCheck: 'فحص بيئة المحفظة', scSite: 'تكوين السلسلة بالموقع', scNoSite: 'غير مُكوّن (استخدم الموقع المُنشر)', scWallet: 'تم اكتشاف محفظة', scNoWallet: 'لا توجد — افتح داخل متصفح DApp في TokenPocket، أو ثبّت إضافة محفظة', scNet: 'الشبكة الحالية', scAccount: 'الحساب المصرّح به', scNoAccount: 'لا يوجد (اتصل/افتح المحفظة)', scWhich: 'نوع المحفظة',
    reply: 'رد', sendReply: 'إرسال', replyPh: 'اكتب رداً (حد أقصى 1024 بايت)', replies: 'ردود', confirmDelPost: 'حذف هذا المشارك وردوده؟',
    flow_BET_FROZEN: 'تم تقديم الأمنية', flow_WIN_CREDIT: 'رصيد الفوز', flow_INS_WIN_CUT: 'خصم 10% للمؤمّن', flow_CANCEL_REFUND: 'استرداد باطل',
    flow_REFERRAL: 'مكافأة الدعوة', flow_PREMIUM_IN: 'إيداع تأمين', flow_NODE_PREMIUM_OUT: 'تأمين العقد', flow_NODE_PAYOUT: 'تعويض العقد', flow_NODE_FORFEIT: 'انتهى إلى البركة',
    flow_WITHDRAW_FEE: 'رسوم السحب', flow_WITHDRAW_PENDING: 'سحب', flow_WITHDRAW_PAID: 'تم السحب', flow_WITHDRAW_REFUND: 'تم استرداد السحب',
    flow_FAUCET: 'مطالبة تجريبية', flow_CHAIN_DEPOSIT: 'إيداع على السلسلة', flow_ISSUE: 'رصيد نظامي',
  },
  id: {
    coinUnit: 'koin', platformTitle: 'Platform Donasi Amal Mandiri Global', platformDesc: 'Tim Amsterdam berkomitmen memberikan donasi langsung kepada orang yang membutuhkan di seluruh dunia. Melalui blockchain, kami menawarkan pencocokan donasi gratis yang transparan, adil, dan dapat dilacak. Mereka yang membutuhkan menerima dukungan tanpa kerugian, sementara donor mendapatkan pengakuan dan imbalan. Fitur donasi sedang dalam pengembangan cepat.', appTitle: 'Kumpulan Keinginan 3 Menit', loginTip: 'Hubungkan dompet untuk memulai. Tautan undangan mengikat perujuk secara otomatis.', connectWallet: 'Hubungkan Dompet', demoEnter: 'Tidak ada dompet? Masuk sebagai demo', logout: 'Keluar',
    dockHome: 'Beranda', dockBbs: 'Forum', dockIns: 'Asuransi', dockMe: 'Saya', disclaimerTitle: 'Pernyataan Serius', disclaimerAgree: 'Saya telah membaca dan setuju', announcement: 'Pengumuman', publishAnnouncement: 'Terbitkan',
    remainSec: 'detik tersisa', lockAt: 'tutup pada 150 detik', betCount: 'Keinginan', redPool: 'Kolam Merah', greenPool: 'Kolam Hijau',
    oddWin: 'Jumlah angka ganjil → Merah menang', evenWin: 'Jumlah angka genap → Hijau menang', pickLabel: 'Pilih angka (0-9)',
    amountLabel: 'Jumlah keinginan (1-99 koin, bilangan bulat)', confirmWish: 'Konfirmasi Keinginan', waitingStart: 'Menunggu keinginan pertama…', historyTitle: 'Riwayat ronde',
    insTitle: 'Asuransi Keinginan', insSwitch: 'Asuransi', premium: 'Premi', lossAccum: 'Kerugian bersih', depositPremium: 'Setor premi',
    insRule: 'Berlaku hanya saat aktif dan premi ≥20 koin. Pemenang yang diasuransikan menyumbang 10% ke kolam; setiap 100 koin kerugian bersih membuka node kompensasi (biaya 20 koin), dikembalikan selama 100 periode.',
    winCongrats: '🎉 Keinginan berhasil dikirim! Semoga rezeki melimpah setiap hari!',
    insLightOn: 'Asuransi aktif', insLightOff: 'Asuransi nonaktif (aktifkan dan simpan ≥20 koin premi)',
    insStatusLabel: 'Status asuransi',
    insOnBar: 'Asuransi aktif', insOffBar: 'Asuransi nonaktif',
    howtoTitle: 'Cara Bermain', howtoStep1: 'Pilih kolam Merah atau Hijau, masukkan 1-99 unit, pilih angka 0-9', howtoStep2: 'Jumlah semua angka: ganjil = Merah menang, genap = Hijau menang. Pemenang bagi hasil setelah potongan 2.5%', howtoStep3: 'Tanpa asuransi: terima semua kemenangan setelah potongan. Dengan asuransi (premi >=20 + sakelar on): bayar 10% kemenangan, tapi kerugian terakumulasi - setiap 100 unit rugi membuat node pengembalian selama 100 periode',
    insGuideTitle: 'Panduan Asuransi', insGuide1: 'Aktifkan: nyalakan sakelar DAN jaga saldo premi >=20 unit', insGuide2: 'Saat menang: 10% kemenangan masuk ke kolam asuransi', insGuide3: 'Saat kalah: kerugian bersih terakumulasi. Setiap 100 unit rugi membuat satu node pengembalian (potong premi 20 unit), dikembalikan selama 100 periode', insGuide4: 'Pengembalian setiap 6 jam (UTC 3/9/15/21). Node baru dalam 168 jam menghidupkan semua node Anda; jika tidak, periode ini hangus', insGuide5: 'Tarik premi kembali ke saldo hanya saat sakelar asuransi mati',
    whitelistTitle: 'Daftar Putih Undangan', addWhitelist: 'Tambah', wlTip: 'Anda ada di daftar putih resmi. Dapat komisi semua generasi dengan tarif yang ditetapkan. Jika downline juga daftar putih, hanya selisih tarif.', wlScope: 'Cakupan', wlAllDepth: 'Semua generasi', normalInvTip: 'Pengguna biasa hanya 0.1% referensi langsung. Hubungi admin untuk mendaftar daftar putih.', normalDirect: 'Referensi langsung saja', applyWhitelistTip: 'Jika Anda memiliki tim kuat dan memahami visi platform, posting di Papan agar tim resmi menemukan Anda.',
    myNodes: 'Node kompensasi saya', poolTotal: 'Total kolam asuransi', poolNext: 'Total rilis berikutnya', poolNextAt: 'Waktu rilis berikutnya', nextReleaseIn: 'Berikutnya dalam', poolActiveNodes: 'Node aktif',
    poolSufficient: 'Cukup', poolShort: 'Kekurangan', poolCover: 'Cakupan',
    meWallet: 'Dompet', meInvite: 'Undangan', copy: 'Salin', scanQr: 'Pindai QR untuk bergabung', qualifiedInvitees: 'Memenuhi syarat', curRate: 'Rate', invTotal: 'Total',
    invTierTip: 'Tier ditentukan oleh jumlah teman langsung yang pernah menghasilkan node kompensasi; komisi atas volume keinginan mereka:', invColPeople: 'Teman memenuhi syarat', invColRate: 'Rate', invPeopleUnit: 'orang',
    bbsTitle: 'Forum (teks biasa, hingga 1024 byte)', bbsPlaceholder: 'Katakan sesuatu (maks 1024 byte)', bbsSend: 'Kirim', bbsEmpty: 'Belum ada kiriman. Jadilah yang pertama.',
    adminModeration: 'Moderasi', addBlockedWord: 'Blokir kata', wordPh: 'Masukkan kata yang diblokir', deletePost: 'Hapus', banUser: 'Blokir', unbanUser: 'Buka blokir', bannedTag: 'DIBLOKIR', noBlocked: 'Tidak ada kata diblokir', npcAdded: 'NPC berhasil ditambahkan', npcAddFail: 'Gagal menambahkan NPC', npcNamePh: 'Nama (opsional)', npcWalletPh: '0x dompet (opsional)', npcAddBtn: 'Tambah',
    avail: 'Tersedia', frozen: 'Ditahan', withdraw: 'Tarik (2-500, biaya 1)', withdrawing: 'Memproses…', flows: 'Transaksi',
    wdOk: 'Penarikan dikirim.', wdCheckReceive: 'Silakan cek dompet Anda untuk dana.', wdPending: 'Terkirim, menunggu pemrosesan platform.',
    premiumWithdraw: 'Premi → saldo (asuransi NONAKTIF)', premiumOutPh: 'Kosong = tarik semua', premiumNeed: 'Masukkan jumlah bilangan bulat positif',
    chainOn: 'On-chain: utamakan saldo, kekurangan dibayar dari dompet Anda.', chainOff: 'Mode saldo off-chain (token belum dikonfigurasi).', chainPending: 'Terkirim, menunggu konfirmasi…', pendingLock: 'Transaksi sebelumnya masih dikonfirmasi di on-chain. Tunggu beberapa detik — JANGAN kirim lagi; akan dikreditkan otomatis.', walletChanged: 'Dompet aktif berbeda dengan akun yang masuk. Keluar dan sambungkan kembali dompet yang sama.',
    pendingTitle: 'Pembayaran on-chain tertunda', pendingVerify: 'Verifikasi & kredit sekarang', chainWillCredit: 'Dibayar on-chain. Dikreditkan otomatis setelah dikonfirmasi; Anda juga bisa ketuk Verifikasi di Saya.', chainCreditedRedo: 'Pembayaran on-chain telah dikreditkan ke saldo, silakan ajukan keinginan lagi.',
    manualCredit: 'Kredit via hash', manualTxPh: 'Tempel hash 0x… untuk dikreditkan', manualOk: 'Dikreditkan ke saldo', manualAlready: 'Transaksi ini sudah dikreditkan', manualBadHash: 'Hash transaksi tidak valid',
    stateActive: 'Berlangsung', stateLocked: 'Tertutup', stateSettled: 'Selesai', stateCancelled: 'Batal (kosong), dikembalikan', winRed: 'Merah Menang', winGreen: 'Hijau Menang',
    nodeProgress: 'Kemajuan', nodePeriod: 'Periode', pickNum: 'Angka', stake: 'Jumlah', detail: 'Detail', close: 'Tutup',
    needPick: 'Silakan pilih angka 0-9 terlebih dahulu', needAmount: 'Masukkan bilangan bulat 1-99 (koin)', copyOk: 'Disalin', noWallet: 'Tidak ada ekstensi dompet terdeteksi',
    walletShort: 'Saldo dompet kurang', noWalletGap: 'Tidak ada dompet terdeteksi. Buka situs ini di dalam browser DApp TokenPocket, atau pasang & buka ekstensi dompet.', offchainShort: 'Saldo tidak cukup (kurang',
    chainNotConfigured: 'Situs ini belum mengonfigurasi token on-chain, jadi pembayaran dompet tidak tersedia. Silakan gunakan situs yang sudah dideploy.', wrongChain: 'Silakan alihkan jaringan dompet ke BNB Smart Chain (chainId 56).',
    selfCheck: 'Cek lingkungan dompet', scSite: 'Konfigurasi rantai situs', scNoSite: 'BELUM dikonfigurasi (gunakan situs online)', scWallet: 'Dompet terdeteksi', scNoWallet: 'TIDAK ADA — buka di dalam browser DApp TokenPocket, atau pasang ekstensi dompet', scNet: 'Jaringan saat ini', scAccount: 'Akun diotorisasi', scNoAccount: 'tidak ada (hubungkan/buka dompet)', scWhich: 'Jenis dompet',
    reply: 'Balas', sendReply: 'Kirim', replyPh: 'Tulis balasan (maks 1024 byte)', replies: 'balasan', confirmDelPost: 'Hapus kiriman dan balasannya?',
    flow_BET_FROZEN: 'Keinginan diajukan', flow_WIN_CREDIT: 'Kemenangan dikredit', flow_INS_WIN_CUT: 'Potongan 10% asuransi', flow_CANCEL_REFUND: 'Pengembalian batal',
    flow_REFERRAL: 'Hadiah undangan', flow_PREMIUM_IN: 'Setoran premi', flow_NODE_PREMIUM_OUT: 'Premi node', flow_NODE_PAYOUT: 'Pembayaran node', flow_NODE_FORFEIT: 'Hangus ke kolam',
    flow_WITHDRAW_FEE: 'Biaya tarik', flow_WITHDRAW_PENDING: 'Tarik', flow_WITHDRAW_PAID: 'Tarik selesai', flow_WITHDRAW_REFUND: 'Tarik dikembalikan',
    flow_FAUCET: 'Klaim tes', flow_CHAIN_DEPOSIT: 'Setoran on-chain', flow_ISSUE: 'Kredit sistem',
  },
  ko: {
    coinUnit: '코인', platformTitle: '글로벌 셀프서비스 자선 기부 플랫폼', platformDesc: '암스테르담 팀은 전 세계 도움이 필요한 사람들에게 직접 기부를 제공하기 위해 노력하고 있습니다. 블록체인을 통해 투명하고 공정하며 추적 가능한 무료 기부 매칭을 제공합니다. 도움이 필요한 사람들은 손실 없는 지원을 받고, 기부자는 인정과 보상을 받습니다. 기부 기능은 현재 빠르게 개발 중입니다.', appTitle: '3분 소원 풀', loginTip: '지갑을 연결하면 시작됩니다. 초대 링크로 추천인이 자동 연결됩니다.', connectWallet: '지갑 연결', demoEnter: '지갑 없음? 데모로 입장', logout: '로그아웃',
    dockHome: '홈', dockBbs: '게시판', dockIns: '보험', dockMe: '나의', disclaimerTitle: '엄중 고지', disclaimerAgree: '읽었으며 동의합니다', announcement: '공지', publishAnnouncement: '발행',
    remainSec: '초 남음', lockAt: '150초에 마감', betCount: '소원', redPool: '레드 풀', greenPool: '그린 풀',
    oddWin: '숫자 합이 홀수 → 레드 승', evenWin: '숫자 합이 짝수 → 그린 승', pickLabel: '숫자 선택 (0-9)',
    amountLabel: '소원 금액 (1-99 코인, 정수)', confirmWish: '소원 확정', waitingStart: '첫 소원을 기다리는 중…', historyTitle: '지난 라운드',
    insTitle: '소원 보험', insSwitch: '보험', premium: '보험료', lossAccum: '순손실', depositPremium: '보험료 입금',
    insRule: '스위치 ON이고 보험료 ≥20 코인일 때만 적용. 보험 가입 당첨자는 수익의 10%를 풀에 납부; 순손실 100코인마다 보상 노드 생성(보험료 20코인 차감), 100기간에 걸쳐 반환.',
    winCongrats: '🎉 소원이 성공적으로 접수되었습니다! 매일 큰 재물운이 있기를!',
    insLightOn: '보험 적용 중', insLightOff: '보험 미적용 (스위치 ON, 보험료 ≥20 코인 유지)',
    insStatusLabel: '보험 상태',
    insOnBar: '보험 적용 중', insOffBar: '보험 꺼짐',
    howtoTitle: '게임 방법', howtoStep1: '레드 또는 그린 풀을 선택하고 1-99단위를 입력한 뒤 0-9 숫자를 고르세요', howtoStep2: '모든 선택 숫자의 합: 홀수 = 레드 승, 짝수 = 그린 승. 승자는 2.5% 수수료 후 비율대로 분배', howtoStep3: '보험 없음: 수수료 후 당첨금 전액 수령. 보험 있음 (보험료 >=20 + 스위치 on): 당첨금의 10%를 보험풀에 납부, 대신 손실이 누적되어 100단위마다 지급 노드가 생성되어 100기간에 걸쳐 반환',
    insGuideTitle: '보험 가이드', insGuide1: '활성화: 스위치를 켜고 보험료 잔액 >=20단위 유지', insGuide2: '당첨 시: 당첨금의 10%가 보험풀로 들어감', insGuide3: '낙첨 시: 순손실이 누적됨. 100단위마다 지급 노드 생성(보험료 20단위 차감), 100기간에 걸쳐 반환', insGuide4: '6시간마다 지급 (UTC 3/9/15/21). 168시간 이내 새 노드가 있으면 모든 노드가 유지됨; 없으면 해당 기간은 몰수', insGuide5: '보험 스위치가 꺼져 있을 때만 보험료를 잔액으로 돌릴 수 있음',
    whitelistTitle: '초대 화이트리스트', addWhitelist: '추가', wlTip: '공식 화이트리스트에 있습니다. 설정된 비율로 모든 세대의 커미션을 받습니다. 하위 라인도 화이트리스트면 차액만 받습니다.', wlScope: '범위', wlAllDepth: '모든 세대', normalInvTip: '일반 사용자는 직접 초대만 0.1%. 화이트리스트 신청은 관리자에게 문의.', normalDirect: '직접 초대만', applyWhitelistTip: '우수한 팀이 있고 플랫폼 비전을 이해하신다면, 게시판에 글을 올려 공식 팀이 찾을 수 있도록 하세요.',
    myNodes: '나의 보상 노드', poolTotal: '보험 풀 총액', poolNext: '다음 지급 총액', poolNextAt: '다음 지급 시각', nextReleaseIn: '다음까지', poolActiveNodes: '활성 노드',
    poolSufficient: '충분', poolShort: '부족', poolCover: '커버율',
    meWallet: '지갑', meInvite: '초대', copy: '복사', scanQr: 'QR 코드 스캔', qualifiedInvitees: '조건 달성', curRate: '비율', invTotal: '누적',
    invTierTip: '보상 노드를 생성한 직접 초대 친구 수로 등급이 결정되며, 친구의 소원 금액에 따라 수수료 지급:', invColPeople: '달성 친구', invColRate: '수수료율', invPeopleUnit: '명',
    bbsTitle: '게시판 (순수 텍스트, 최대 1024바이트)', bbsPlaceholder: '하고 싶은 말 (최대 1024바이트)', bbsSend: '게시', bbsEmpty: '아직 게시글이 없습니다. 첫 글을 남겨보세요.',
    adminModeration: '관리', addBlockedWord: '단어 차단', wordPh: '차단할 단어 입력', deletePost: '삭제', banUser: '차단', unbanUser: '차단 해제', bannedTag: '차단됨', noBlocked: '차단된 단어 없음', npcAdded: 'NPC 추가 성공', npcAddFail: 'NPC 추가 실패', npcNamePh: '이름 (선택)', npcWalletPh: '0x 지갑 (선택)', npcAddBtn: '추가',
    avail: '사용 가능', frozen: '보류', withdraw: '출금 (2-500, 수수료 1)', withdrawing: '처리 중…', flows: '거래 내역',
    wdOk: '출금이 전송되었습니다.', wdCheckReceive: '지갑에서 입금을 확인해 주세요.', wdPending: '접수되었습니다. 플랫폼 처리 대기 중.',
    premiumWithdraw: '보험료 → 잔액 (보험 OFF 시)', premiumOutPh: '비우면 전액 출금', premiumNeed: '양의 정수 금액을 입력하세요',
    chainOn: '온체인: 잔액 우선, 부족분은 지갑에서 지불.', chainOff: '오프체인 잔액 모드 (토큰 미설정).', chainPending: '전송됨, 확인 대기 중…', pendingLock: '직전 거래가 아직 온체인 확인 중입니다. 몇 초 기다리세요 — 다시 제출하지 마세요. 자동 입금됩니다.', walletChanged: '활성 지갑이 로그인 계정과 다릅니다. 로그아웃 후 같은 지갑을 다시 연결하세요.',
    pendingTitle: '대기 중인 온체인 결제', pendingVerify: '지금 확인 및 입금', chainWillCredit: '온체인에서 결제되었습니다. 확인 후 자동 입금되며, 나의 메뉴에서 직접 확인할 수도 있습니다.', chainCreditedRedo: '온체인 결제가 잔액에 입금되었습니다. 다시 소원을 접수해 주세요.',
    manualCredit: '해시로 입금', manualTxPh: '0x… 트랜잭션 해시를 붙여 입금', manualOk: '잔액에 입금됨', manualAlready: '이 거래는 이미 입금됨', manualBadHash: '잘못된 트랜잭션 해시',
    stateActive: '진행 중', stateLocked: '마감', stateSettled: '정산 완료', stateCancelled: '무효 (빈 라운드), 환불됨', winRed: '레드 승', winGreen: '그린 승',
    nodeProgress: '진행률', nodePeriod: '지급 기간', pickNum: '선택 번호', stake: '금액', detail: '상세', close: '닫기',
    needPick: '먼저 0-9 숫자를 선택하세요', needAmount: '1-99 정수 (코인)를 입력하세요', copyOk: '복사됨', noWallet: '지갑 확장 프로그램이 감지되지 않음',
    walletShort: '지갑 잔액 부족', noWalletGap: '지갑이 감지되지 않습니다. TokenPocket DApp 브라우저에서 열거나, 지갑 확장 프로그램을 설치·잠금 해제하세요.', offchainShort: '잔액이 부족합니다 (부족',
    chainNotConfigured: '이 사이트는 온체인 토큰이 설정되지 않아 지갑 결제를 사용할 수 없습니다. 배포된 온라인 사이트를 이용하세요.', wrongChain: '지갑 네트워크를 BNB Smart Chain (chainId 56)으로 전환하세요.',
    selfCheck: '지갑 환경 점검', scSite: '사이트 체인 설정', scNoSite: '미설정 (온라인 사이트 이용)', scWallet: '지갑 감지됨', scNoWallet: '없음 — TokenPocket DApp 브라우저에서 열거나 지갑 확장 프로그램을 설치하세요', scNet: '현재 네트워크', scAccount: '인증된 계정', scNoAccount: '없음 (지갑 연결/잠금 해제)', scWhich: '지갑 종류',
    reply: '답글', sendReply: '전송', replyPh: '답글 작성 (최대 1024바이트)', replies: '개의 답글', confirmDelPost: '이 게시글과 답글을 삭제할까요?',
    flow_BET_FROZEN: '소원 접수', flow_WIN_CREDIT: '당첨 입금', flow_INS_WIN_CUT: '보험 당첨 10% 차감', flow_CANCEL_REFUND: '무효 환불',
    flow_REFERRAL: '초대 보상', flow_PREMIUM_IN: '보험료 입금', flow_NODE_PREMIUM_OUT: '노드 보험료', flow_NODE_PAYOUT: '노드 보상', flow_NODE_FORFEIT: '소멸 → 풀',
    flow_WITHDRAW_FEE: '출금 수수료', flow_WITHDRAW_PENDING: '출금', flow_WITHDRAW_PAID: '출금 완료', flow_WITHDRAW_REFUND: '출금 환불',
    flow_FAUCET: '테스트 수령', flow_CHAIN_DEPOSIT: '온체인 입금', flow_ISSUE: '시스템 입금',
  },
  ru: {
    coinUnit: 'монет', platformTitle: 'Глобальная платформа самообслуживания для благотворительных пожертвований', platformDesc: 'Амстердамская команда стремится предоставлять прямые пожертвования нуждающимся по всему миру. С помощью блокчейна мы предлагаем прозрачное, справедливое и отслеживаемое бесплатное сопоставление пожертвований. Нуждающиеся получают безубыточную поддержку, а доноры — признание и награды. Функции пожертвований находятся в стадии активной разработки.', appTitle: 'Колода желаний на 3 минуты', loginTip: 'Подключите кошелёк, чтобы начать. Пригласительные ссылки автоматически привязывают реферера.', connectWallet: 'Подключить кошелёк', demoEnter: 'Нет кошелька? Войти как демо', logout: 'Выход',
    dockHome: 'Главная', dockBbs: 'Форум', dockIns: 'Страховка', dockMe: 'Профиль', disclaimerTitle: 'Серьёзное заявление', disclaimerAgree: 'Я прочитал и согласен', announcement: 'Объявление', publishAnnouncement: 'Опубликовать',
    remainSec: 'секунд осталось', lockAt: 'закрывается на 150-й секунде', betCount: 'Желаний', redPool: 'Красный пул', greenPool: 'Зелёный пул',
    oddWin: 'Сумма чисел нечётная → победа красных', evenWin: 'Сумма чисел чётная → победа зелёных', pickLabel: 'Выберите число (0-9)',
    amountLabel: 'Сумма желания (1-99 монет, целое)', confirmWish: 'Подтвердить желание', waitingStart: 'Ожидание первого желания…', historyTitle: 'Прошлые раунды',
    insTitle: 'Страховка желаний', insSwitch: 'Страховка', premium: 'Страховая премия', lossAccum: 'Чистый убыток', depositPremium: 'Внести премию',
    insRule: 'Действует только при включении и премии ≥20 монет. Застрахованные победители отдают 10% в пул; каждые 100 монет чистого убытка открывают узел выплат (стоит 20 монет), возвращается за 100 периодов.',
    winCongrats: '🎉 Желание успешно отправлено! Желаю богатства каждый день!',
    insLightOn: 'Страховка активна', insLightOff: 'Страховка неактивна (включите и храните ≥20 монет премии)',
    insStatusLabel: 'Статус страховки',
    insOnBar: 'Страховка активна', insOffBar: 'Страховка выключена',
    howtoTitle: 'Как играть', howtoStep1: 'Выберите красный или зелёный пул, введите 1-99 единиц, выберите число 0-9', howtoStep2: 'Сумма всех чисел: нечётная = победа красных, чётная = победа зелёных. Победители делят пул после комиссии 2.5%', howtoStep3: 'Без страховки: получаете весь выигрыш после комиссии. Со страховкой (премия >=20 + включатель): платите 10% выигрыша, но потери накапливаются - каждые 100 единиц потерь создают узел выплат, возвращаемый за 100 периодов',
    insGuideTitle: 'Руководство по страховке', insGuide1: 'Активация: включите переключатель И поддерживайте баланс премии >=20 единиц', insGuide2: 'При выигрыше: 10% вашего выигрыша идёт в страховой пул', insGuide3: 'При проигрыше: чистый убыток накапливается. Каждые 100 единиц убытка создают узел выплат (вычитается 20 единиц премии), возвращаемый за 100 периодов', insGuide4: 'Выплаты каждые 6 часов (UTC 3/9/15/21). Любой новый узел в течение 168 часов продлевает все ваши узлы; иначе текущий период конфискуется', insGuide5: 'Вернуть премию на баланс можно только при выключенной страховке',
    whitelistTitle: 'Белый список приглашений', addWhitelist: 'Добавить', wlTip: 'Вы в официальном белом списке. Получаете комиссию со всех поколений по установленной ставке. Если нижестоящий тоже в белом списке — только разницу ставок.', wlScope: 'Охват', wlAllDepth: 'Все поколения', normalInvTip: 'Обычные пользователи получают 0.1% только с прямых приглашений. Свяжитесь с админом для заявки в белый список.', normalDirect: 'Только прямые', applyWhitelistTip: 'Если у вас сильная команда и вы понимаете видение платформы, опубликуйте пост на доске, чтобы официальная команда нашла вас.',
    myNodes: 'Мои узлы выплат', poolTotal: 'Общая сумма страхового пула', poolNext: 'Общая сумма следующего выпуска', poolNextAt: 'Время следующего выпуска', nextReleaseIn: 'Следующий через', poolActiveNodes: 'Активные узлы',
    poolSufficient: 'Достаточно', poolShort: 'Недостаток', poolCover: 'Покрытие',
    meWallet: 'Кошелёк', meInvite: 'Приглашения', copy: 'Копировать', scanQr: 'Сканировать QR', qualifiedInvitees: 'Квалифицированные', curRate: 'Ставка', invTotal: 'Всего',
    invTierTip: 'Уровень определяется числом прямых друзей, создавших узел выплат; комиссия с объёма их желаний:', invColPeople: 'Квалифицированные друзья', invColRate: 'Ставка', invPeopleUnit: '',
    bbsTitle: 'Форум (простой текст, до 1024 байт)', bbsPlaceholder: 'Напишите что-нибудь (макс. 1024 байт)', bbsSend: 'Опубликовать', bbsEmpty: 'Пока нет сообщений. Будьте первым.',
    adminModeration: 'Модерация', addBlockedWord: 'Заблокировать слово', wordPh: 'Введите слово для блокировки', deletePost: 'Удалить', banUser: 'Забанить', unbanUser: 'Разбанить', bannedTag: 'ЗАБАНЕН', noBlocked: 'Нет заблокированных слов', npcAdded: 'NPC успешно добавлен', npcAddFail: 'Ошибка добавления NPC', npcNamePh: 'Имя (необязательно)', npcWalletPh: '0x кошелек (необязательно)', npcAddBtn: 'Добавить',
    avail: 'Доступно', frozen: 'Заморожено', withdraw: 'Вывод (2-500, комиссия 1)', withdrawing: 'Обработка…', flows: 'Транзакции',
    wdOk: 'Вывод отправлен.', wdCheckReceive: 'Проверьте кошелёк — средства должны поступить.', wdPending: 'Отправлено, ожидает обработки платформой.',
    premiumWithdraw: 'Премия → баланс (страховка ВЫКЛ)', premiumOutPh: 'Пусто = вывести всё', premiumNeed: 'Введите положительное целое число',
    chainOn: 'В сети: сначала баланс, недостаток оплачивается из кошелька.', chainOff: 'Режим внутрисетевого баланса (токен не настроен).', chainPending: 'Отправлено, ожидание подтверждения…', pendingLock: 'Предыдущая транзакция ещё подтверждается в сети. Подождите несколько секунд — НЕ отправляйте снова; зачислится автоматически.', walletChanged: 'Активный кошелёк отличается от вошедшего аккаунта. Выйдите и подключите тот же кошелёк заново.',
    pendingTitle: 'Ожидающие сетевые платежи', pendingVerify: 'Проверить и зачислить сейчас', chainWillCredit: 'Оплачено в сети. Зачислится автоматически после подтверждения; можно также нажать «Проверить» в профиле.', chainCreditedRedo: 'Сетевой платёж зачислен на баланс, отправьте желание заново.',
    manualCredit: 'Зачислить по хешу', manualTxPh: 'Вставьте хеш 0x… для зачисления', manualOk: 'Зачислено на баланс', manualAlready: 'Эта транзакция уже зачислена', manualBadHash: 'Неверный хеш транзакции',
    stateActive: 'Идёт', stateLocked: 'Закрыт', stateSettled: 'Разыгран', stateCancelled: 'Отменён (пустой), возвращено', winRed: 'Красный выиграл', winGreen: 'Зелёный выиграл',
    nodeProgress: 'Прогресс', nodePeriod: 'Периодов', pickNum: 'Число', stake: 'Сумма', detail: 'Детали', close: 'Закрыть',
    needPick: 'Сначала выберите число 0-9', needAmount: 'Введите целое 1-99 (монет)', copyOk: 'Скопировано', noWallet: 'Расширение кошелька не обнаружено',
    walletShort: 'Недостаточно средств в кошельке', noWalletGap: 'Кошелёк не обнаружен. Откройте сайт в DApp-браузере TokenPocket или установите и разблокируйте расширение кошелька.', offchainShort: 'Баланса недостаточно (не хватает',
    chainNotConfigured: 'На этом сайте не настроен сетевой токен, оплата из кошелька недоступна. Используйте развёрнутый онлайн-сайт.', wrongChain: 'Переключите сеть кошелька на BNB Smart Chain (chainId 56).',
    selfCheck: 'Проверка окружения кошелька', scSite: 'Конфигурация сети сайта', scNoSite: 'НЕ настроена (используйте онлайн-сайт)', scWallet: 'Кошелёк обнаружен', scNoWallet: 'НЕТ — откройте в DApp-браузере TokenPocket или установите расширение кошелька', scNet: 'Текущая сеть', scAccount: 'Авторизованный аккаунт', scNoAccount: 'нет (подключите/разблокируйте кошелёк)', scWhich: 'Тип кошелька',
    reply: 'Ответить', sendReply: 'Отправить', replyPh: 'Напишите ответ (макс. 1024 байт)', replies: 'ответов', confirmDelPost: 'Удалить это сообщение и все ответы?',
    flow_BET_FROZEN: 'Желание отправлено', flow_WIN_CREDIT: 'Выигрыш зачислен', flow_INS_WIN_CUT: '10% застрахованного в пул', flow_CANCEL_REFUND: 'Возврат при отмене',
    flow_REFERRAL: 'Реферальное вознаграждение', flow_PREMIUM_IN: 'Внесение премии', flow_NODE_PREMIUM_OUT: 'Премия узла', flow_NODE_PAYOUT: 'Выплата узла', flow_NODE_FORFEIT: 'Сгорело в пул',
    flow_WITHDRAW_FEE: 'Комиссия вывода', flow_WITHDRAW_PENDING: 'Вывод', flow_WITHDRAW_PAID: 'Вывод выполнен', flow_WITHDRAW_REFUND: 'Вывод возвращён',
    flow_FAUCET: 'Тестовый бонус', flow_CHAIN_DEPOSIT: 'Сетевое пополнение', flow_ISSUE: 'Системное зачисление',
  },
  hi: {
    coinUnit: 'सिक्के', platformTitle: 'वैश्विक स्वयं सेवा चैरिटी दान मंच', platformDesc: 'एम्स्टर्डम टीम दुनिया भर में जरूरतमंद लोगों को सीधा दान प्रदान करने के लिए प्रतिबद्ध है। ब्लॉकचेन के माध्यम से, हम पारदर्शी, निष्पक्ष, ट्रेस करने योग्य मुफ्त दान मिलान प्रदान करते हैं। जरूरतमंद लोगों को बिना नुकसान के सहायता मिलती है, जबकि दाताओं को मान्यता और पुरस्कार मिलते हैं। दान सुविधाएं तेजी से विकास के अधीन हैं।', appTitle: '3 मिनट विश पूल', loginTip: 'शुरू करने के लिए वॉलेट कनेक्ट करें. आमंत्रण लिंक स्वचालित रूप से रेफ़रर को बाँधते हैं.', connectWallet: 'वॉलेट कनेक्ट करें', demoEnter: 'वॉलेट नहीं है? डेमो के रूप में प्रवेश करें', logout: 'लॉग आउट',
    dockHome: 'होम', dockBbs: 'बोर्ड', dockIns: 'बीमा', dockMe: 'मेरा', disclaimerTitle: 'गंभीर विवरण', disclaimerAgree: 'मैंने पढ़ लिया और सहमत हूं', announcement: 'घोषणा', publishAnnouncement: 'प्रकाशित करें',
    remainSec: 'सेकंड शेष', lockAt: '150 सेकंड पर बंद', betCount: 'विशें', redPool: 'लाल पूल', greenPool: 'हरा पूल',
    oddWin: 'अंकों का योग विषम → लाल जीतता है', evenWin: 'अंकों का योग सम → हरा जीतता है', pickLabel: 'अंक चुनें (0-9)',
    amountLabel: 'विश राशि (1-99 सिक्के, पूर्णांक)', confirmWish: 'विश की पुष्टि करें', waitingStart: 'पहले विश की प्रतीक्षा में…', historyTitle: 'पिछले राउंड',
    insTitle: 'विश बीमा', insSwitch: 'बीमा', premium: 'प्रीमियम', lossAccum: 'शुद्ध नुकसान', depositPremium: 'प्रीमियम जमा करें',
    insRule: 'केवल चालू और प्रीमियम ≥20 सिक्के पर लागू. बीमायुक्त विजेता पूल में 10% देते हैं; हर 100 सिक्के शुद्ध नुकसान पर भुगतान नोड खुलता है (20 सिक्के का खर्च), 100 अवधियों में वापस.',
    winCongrats: '🎉 विश सफलतापूर्वक सबमिट हुआ! आपको हर दिन बड़ी संपत्ति मिले!',
    insLightOn: 'बीमा सक्रिय', insLightOff: 'बीमा निष्क्रिय (चालू करें और ≥20 सिक्के प्रीमियम रखें)',
    insStatusLabel: 'बीमा स्थिति',
    insOnBar: 'बीमा सक्रिय', insOffBar: 'बीमा बंद',
    howtoTitle: 'कैसे खेलें', howtoStep1: 'लाल या हरा पूल चुनें, 1-99 यूनिट दर्ज करें, 0-9 कोई संख्या चुनें', howtoStep2: 'सभी संख्याओं का योग: विषम = लाल जीतता है, सम = हरा जीतता है। विजेता 2.5% शुल्क के बाद बांटते हैं', howtoStep3: 'बिना बीमा: शुल्क के बाद पूरा जीतमूल्य प्राप्त करें। बीमा के साथ (प्रीमियम >=20 + स्विच on): जीतमूल्य का 10% बीमा पूल में, लेकिन हानि जमा होती है - हर 100 यूनिट हानि एक भुगतान नोड बनाती है जो 100 अवधियों में वापस होती है',
    insGuideTitle: 'बीमा गाइड', insGuide1: 'सक्रिय करें: स्विच चालू करें और प्रीमियम शेष >=20 यूनिट रखें', insGuide2: 'जीतने पर: आपके जीतमूल्य का 10% बीमा पूल में जाता है', insGuide3: 'हारने पर: शुद्ध हानि जमा होती है। हर 100 यूनिट हानि एक भुगतान नोड बनाती है (20 यूनिट प्रीमियम कटौती), 100 अवधियों में वापस', insGuide4: 'हर 6 घंटे में भुगतान (UTC 3/9/15/21)। 168 घंटे के भीतर कोई नया नोड आपके सभी नोड्स को जारी रखता है; अन्यथा वर्तमान अवधि जब्त हो जाती है', insGuide5: 'बीमा स्विच बंद होने पर ही प्रीमियम को शेष में वापस कर सकते हैं',
    whitelistTitle: 'निमंत्रण सफेद सूची', addWhitelist: 'जोड़ें', wlTip: 'आप आधिकारिक सफेद सूची में हैं। निर्धारित दर पर सभी पीढ़ियों से कमीशन। यदि डाउनलाइन भी सफेद सूची में है तो केवल अंतर।', wlScope: 'दायरा', wlAllDepth: 'सभी पीढ़ियाँ', normalInvTip: 'सामान्य उपयोगकर्ता केवल सीधे निमंत्रण पर 0.1%। सफेद सूची के लिए एडमिन से संपर्क करें।', normalDirect: 'केवल सीधे', applyWhitelistTip: 'यदि आपके पास मजबूत टीम है और आप प्लेटफ़ॉर्म के दृष्टिकोण को समझते हैं, तो बोर्ड पर पोस्ट करें ताकि ऑफिशियल टीम आपको खोज सके।',
    myNodes: 'मेरे भुगतान नोड', poolTotal: 'बीमा पूल कुल', poolNext: 'अगली रिलीज़ कुल', poolNextAt: 'अगली रिलीज़ का समय', nextReleaseIn: 'अगली में', poolActiveNodes: 'सक्रिय नोड',
    poolSufficient: 'पर्याप्त', poolShort: 'कमी', poolCover: 'कवरेज',
    meWallet: 'वॉलेट', meInvite: 'निमंत्रण', copy: 'कॉपी', scanQr: 'जुड़ने के लिए QR स्कैन करें', qualifiedInvitees: 'योग्य', curRate: 'दर', invTotal: 'कुल',
    invTierTip: 'स्तर भुगतान नोड बनाने वाले सीधे दोस्तों की संख्या से तय होता है; उनके विश मात्रा पर कमीशन:', invColPeople: 'योग्य दोस्त', invColRate: 'दर', invPeopleUnit: '',
    bbsTitle: 'बोर्ड (सादा पाठ, 1024 बाइट तक)', bbsPlaceholder: 'कुछ लिखें (अधिकतम 1024 बाइट)', bbsSend: 'पोस्ट', bbsEmpty: 'अभी कोई पोस्ट नहीं. पहले बनें.',
    adminModeration: 'मॉडरेशन', addBlockedWord: 'शब्द ब्लॉक करें', wordPh: 'ब्लॉक करने के लिए शब्द दर्ज करें', deletePost: 'हटाएँ', banUser: 'बैन', unbanUser: 'अनबैन', bannedTag: 'बैन्ड', noBlocked: 'कोई ब्लॉक शब्द नहीं', npcAdded: 'NPC सफलतापूर्वक जोड़ा गया', npcAddFail: 'NPC जोड़ने में विफल', npcNamePh: 'नाम (वैकल्पिक)', npcWalletPh: '0x वॉलेट (वैकल्पिक)', npcAddBtn: 'जोड़ें',
    avail: 'उपलब्ध', frozen: 'रोका गया', withdraw: 'निकासी (2-500, शुल्क 1)', withdrawing: 'प्रोसेसिंग…', flows: 'लेनदेन',
    wdOk: 'निकासी भेजी गई.', wdCheckReceive: 'कृपया धन के लिए अपना वॉलेट देखें.', wdPending: 'सबमिट हुआ, प्लेटफ़ॉर्म प्रोसेसिंग की प्रतीक्षा में.',
    premiumWithdraw: 'प्रीमियम → बैलेंस (बीमा बंद)', premiumOutPh: 'खाली = सब निकालें', premiumNeed: 'धनात्मक पूर्णांक राशि दर्ज करें',
    chainOn: 'ऑन-चेन: पहले बैलेंस, कमी वॉलेट से भुगतान.', chainOff: 'ऑफ-चेन बैलेंस मोड (टोकन कॉन्फ़िगर नहीं).', chainPending: 'भेजा गया, पुष्टि की प्रतीक्षा में…', pendingLock: 'पिछला ट्रांज़ैक्शन अभी ऑन-चेन पुष्टि हो रहा है. कुछ सेकंड प्रतीक्षा करें — फिर से सबमिट न करें; स्वचालित जमा होगा.', walletChanged: 'सक्रिय वॉलेट लॉगिन खाते से भिन्न है. लॉग आउट करें और उसी वॉलेट को फिर कनेक्ट करें.',
    pendingTitle: 'लंबित ऑन-चेन भुगतान', pendingVerify: 'अभी सत्यापित करें और जमा करें', chainWillCredit: 'ऑन-चेन भुगतान हो गया. पुष्टि के बाद स्वचालित जमा होगा; आप मेरा में सत्यापन भी टैप कर सकते हैं.', chainCreditedRedo: 'ऑन-चेन भुगतान बैलेंस में जमा हो गया, कृपया फिर से विश सबमिट करें.',
    manualCredit: 'हैश से जमा', manualTxPh: 'जमा के लिए 0x… हैश पेस्ट करें', manualOk: 'बैलेंस में जमा हुआ', manualAlready: 'यह ट्रांज़ैक्शन पहले ही जमा हो चुका है', manualBadHash: 'अमान्य ट्रांज़ैक्शन हैश',
    stateActive: 'चालू', stateLocked: 'बंद', stateSettled: 'निपटा', stateCancelled: 'रद्द (खाली), वापस', winRed: 'लाल जीता', winGreen: 'हरा जीता',
    nodeProgress: 'प्रगति', nodePeriod: 'अवधि', pickNum: 'अंक', stake: 'राशि', detail: 'विवरण', close: 'बंद करें',
    needPick: 'कृपया पहले 0-9 का अंक चुनें', needAmount: '1-99 का पूर्णांक (सिक्के) दर्ज करें', copyOk: 'कॉपी हुआ', noWallet: 'कोई वॉलेट एक्सटेंशन नहीं मिला',
    walletShort: 'वॉलेट बैलेंस कम है', noWalletGap: 'कोई वॉलेट नहीं मिला. इस साइट को TokenPocket DApp ब्राउज़र में खोलें, या वॉलेट एक्सटेंशन इंस्टॉल और अनलॉक करें.', offchainShort: 'बैलेंस पर्याप्त नहीं (कम',
    chainNotConfigured: 'इस साइट पर कोई ऑन-चेन टोकन कॉन्फ़िगर नहीं है, इसलिए वॉलेट भुगतान अनुपलब्ध. कृपया डिप्लॉय्ड ऑनलाइन साइट का उपयोग करें.', wrongChain: 'कृपया वॉलेट नेटवर्क को BNB Smart Chain (chainId 56) पर स्विच करें.',
    selfCheck: 'वॉलेट वातावरण जाँच', scSite: 'साइट चेन कॉन्फ़िग', scNoSite: 'कॉन्फ़िगर नहीं (ऑनलाइन साइट का उपयोग करें)', scWallet: 'वॉलेट मिला', scNoWallet: 'नहीं — TokenPocket DApp ब्राउज़र में खोलें, या वॉलेट एक्सटेंशन इंस्टॉल करें', scNet: 'वर्तमान नेटवर्क', scAccount: 'अधिकृत खाता', scNoAccount: 'कोई नहीं (वॉलेट कनेक्ट/अनलॉक करें)', scWhich: 'वॉलेट प्रकार',
    reply: 'उत्तर', sendReply: 'भेजें', replyPh: 'उत्तर लिखें (अधिकतम 1024 बाइट)', replies: 'उत्तर', confirmDelPost: 'इस पोस्ट और उसके उत्तरों को हटाएँ?',
    flow_BET_FROZEN: 'विश सबमिट', flow_WIN_CREDIT: 'जीत जमा', flow_INS_WIN_CUT: 'बीमायुक्त 10% पूल में', flow_CANCEL_REFUND: 'रद्द वापसी',
    flow_REFERRAL: 'रेफ़रल इनाम', flow_PREMIUM_IN: 'प्रीमियम जमा', flow_NODE_PREMIUM_OUT: 'नोड प्रीमियम', flow_NODE_PAYOUT: 'नोड भुगतान', flow_NODE_FORFEIT: 'पूल में समाप्त',
    flow_WITHDRAW_FEE: 'निकासी शुल्क', flow_WITHDRAW_PENDING: 'निकासी', flow_WITHDRAW_PAID: 'निकासी हुई', flow_WITHDRAW_REFUND: 'निकासी वापस',
    flow_FAUCET: 'टेस्ट क्लेम', flow_CHAIN_DEPOSIT: 'ऑन-चेन जमा', flow_ISSUE: 'सिस्टम जमा',
  },
  ur: {
    coinUnit: 'سکے', platformTitle: 'عالمی خود خدمت خیراتی عطیہ پلیٹ فارم', platformDesc: 'ایمسٹرڈیم ٹیم دنیا بھر میں ضرورت مندوں کو براہ راست عطیہ فراہم کرنے کے لیے پرعزم ہے۔ بلاکچین کے ذریعے، ہم شفاف، منصفانہ، قابلِ تتبع مفت عطیہ میچنگ فراہم کرتے ہیں۔ ضرورت مندوں کو بغیر نقصان کے مدد ملتی ہے، جبکہ عطیہ دہندگان کو تسلیم اور انعامات ملتے ہیں۔ عطیہ کی خصوصیات تیزی سے ترقی کے مراحل میں ہیں۔', appTitle: 'تین منٹ کی خواہش پول', loginTip: 'شروع کرنے کے لیے والیٹ منسلک کریں. دعوتی لنکس خود بخود ریفرر کو جوڑ دیتے ہیں.', connectWallet: 'والیٹ منسلک کریں', demoEnter: 'والیٹ نہیں؟ ڈیمو کے طور پر داخل ہوں', logout: 'لاگ آؤٹ',
    dockHome: 'ہوم', dockBbs: 'بورڈ', dockIns: 'انشورنس', dockMe: 'میرا', disclaimerTitle: 'سنگین بیان', disclaimerAgree: 'میں نے پڑھ لیا اور اتفاق کرتا ہوں', announcement: 'اعلان', publishAnnouncement: 'شائع کریں',
    remainSec: 'سیکنڈ باقی', lockAt: '150 سیکنڈ پر بند', betCount: 'خواہشیں', redPool: 'سرخ پول', greenPool: 'سبز پول',
    oddWin: 'اعداد کا مجموعہ طاق → سرخ جیتتا ہے', evenWin: 'اعداد کا مجموعہ زوج → سبز جیتتا ہے', pickLabel: 'عدد منتخب کریں (0-9)',
    amountLabel: 'خواہش کی رقم (1-99 سکے، عدد صحیح)', confirmWish: 'خواہش کی تصدیق کریں', waitingStart: 'پہلی خواہش کا انتظار…', historyTitle: 'پچھلے راؤنڈ',
    insTitle: 'خواہش انشورنس', insSwitch: 'انشورنس', premium: 'پریمیم', lossAccum: 'خالص نقصان', depositPremium: 'پریمیم جمع کروائیں',
    insRule: 'صرف آن اور پریمیم ≥20 سکے پر نافذ. بیمہ شدہ جیتنے والے پول میں 10% دیتے ہیں; ہر 100 سکے خالص نقصان پر ادائیگی نوڈ کھلتا ہے (لاگت 20 سکے)، 100 ادوار میں واپس.',
    winCongrats: '🎉 خواہش کامیابی سے جمع ہو گئی! آپ کو ہر روز بڑی دولت نصیب ہو!',
    insLightOn: 'انشورنس فعال', insLightOff: 'انشورنس غیر فعال (آن کریں اور ≥20 سکے پریمیم رکھیں)',
    insStatusLabel: 'انشورنس کی حالت',
    insOnBar: 'انشورنس فعال ہے', insOffBar: 'انشورنس بند ہے',
    howtoTitle: 'کیسے کھیلیں', howtoStep1: 'سرا یا سبز پول منتخب کریں، 1-99 یونٹ درج کریں، 0-9 کوئی نمبر منتخب کریں', howtoStep2: 'تمام نمبروں کا مجموعہ: طاق = سرا جیتتا ہے، جوڑ = سبز جیتتا ہے۔ فاتح 2.5% فیس کے بعد بانٹتے ہیں', howtoStep3: 'بغیر بیمہ: فیس کے بعد پوری جیت وصول کریں۔ بیمہ کے ساتھ (پریمیم >=20 + سوئچ آن): جیت کا 10% بیمہ پول میں، لیکن نقصان جمع ہوتا ہے - ہر 100 یونٹ نقصان ایک ادائیگی نوڈ بناتا ہے جو 100 ادوار میں واپس ہوتا ہے',
    insGuideTitle: 'بیمہ گائیڈ', insGuide1: 'فعال کریں: سوئچ آن کریں اور پریمیم بیلنس >=20 یونٹ رکھیں', insGuide2: 'جیتنے پر: آپ کی جیت کا 10% بیمہ پول میں جاتا ہے', insGuide3: 'ہارنے پر: خالص نقصان جمع ہوتا ہے۔ ہر 100 یونٹ نقصان ایک ادائیگی نوڈ بناتا ہے (20 یونٹ پریمیم کٹوتی)، 100 ادوار میں واپس', insGuide4: 'ہر 6 گھنٹے میں ادائیگی (UTC 3/9/15/21)۔ 168 گھنٹے کے اندر کوئی نیا نوڈ آپ کے تمام نوڈز کو جاری رکھتا ہے؛ بصورت دیگر موجودہ ادوار ضبط ہو جاتی ہے', insGuide5: 'بیمہ سوئچ بند ہونے پر ہی پریمیم کو بیلنس میں واپس کر سکتے ہیں',
    whitelistTitle: 'دعوتہ وائٹ لسٹ', addWhitelist: 'شامل کریں', wlTip: 'آپ سرکاری وائٹ لسٹ میں ہیں۔ مقررہ شرح پر تمام نسلوں سے کمیشن۔ اگر ڈاؤن لائن بھی وائٹ لسٹ میں ہے تو صرف فرق۔', wlScope: 'دائرہ', wlAllDepth: 'تمام نسلیں', normalInvTip: 'عام صارفین کو صرف براہ راست دعوت پر 0.1%۔ وائٹ لسٹ کے لیے ایڈمن سے رابطہ کریں۔', normalDirect: 'صرف براہ راست', applyWhitelistTip: 'اگر آپ کے پاس مضبوط ٹیم ہے اور آپ پلیٹ فارم کے ویژن کو سمجھتے ہیں، تو بورڈ پر پوسٹ کریں تاکہ آفیشل ٹیم آپ کو ڈھونڈ سکے۔',
    myNodes: 'میرے ادائیگی نوڈ', poolTotal: 'انشورنس پول کل', poolNext: 'اگلی ریلیز کل', poolNextAt: 'اگلی ریلیز کا وقت', nextReleaseIn: 'اگلی میں', poolActiveNodes: 'فعال نوڈ',
    poolSufficient: 'کافی', poolShort: 'کمی', poolCover: 'کوریج',
    meWallet: 'والیٹ', meInvite: 'دعوت', copy: 'کاپی', scanQr: 'شامل ہونے کے لیے QR اسکین کریں', qualifiedInvitees: 'اہل', curRate: 'شرح', invTotal: 'کل',
    invTierTip: 'درجہ براہ راست دوستوں کی تعداد سے طے ہوتا ہے جنہوں نے ادائیگی نوڈ بنایا; ان کی خواہش کی رقم پر کمیشن:', invColPeople: 'اہل دوست', invColRate: 'شرح', invPeopleUnit: '',
    bbsTitle: 'بورڈ (سادہ متن، 1024 بائٹ تک)', bbsPlaceholder: 'کچھ لکھیں (زیادہ سے زیادہ 1024 بائٹ)', bbsSend: 'پوسٹ', bbsEmpty: 'ابھی کوئی پوسٹ نہیں. پہلے بنیں.',
    adminModeration: 'ماڈریشن', npcAdded: 'NPC کامیابی سے شامل ہو گیا', npcAddFail: 'NPC شامل کرنے میں ناکامی', npcNamePh: 'نام (اختیاری)', npcWalletPh: '0x والیٹ (اختیاری)', npcAddBtn: 'شامل کریں', addBlockedWord: 'لفظ بلاک کریں', wordPh: 'بلاک کرنے کے لیے لفظ درج کریں', deletePost: 'حذف کریں', banUser: 'بین', unbanUser: 'ان بین', bannedTag: 'بین شدہ', noBlocked: 'کوئی بلاک شدہ لفظ نہیں',
    avail: 'دستیاب', frozen: 'روکا گیا', withdraw: 'نکاسی (2-500، فیس 1)', withdrawing: 'پروسیسنگ…', flows: 'لین دین',
    wdOk: 'نکاسی بھیج دی گئی.', wdCheckReceive: 'رقم کے لیے اپنا والیٹ چیک کریں.', wdPending: 'جمع ہو گیا، پلیٹ فارم پروسیسنگ کا انتظار.',
    premiumWithdraw: 'پریمیم → بیلنس (انشورنس آف)', premiumOutPh: 'خالی = سب نکالیں', premiumNeed: 'مثبت عدد صحیح رقم درج کریں',
    chainOn: 'آن چین: پہلے بیلنس، کمی والیٹ سے ادا.', chainOff: 'آف چین بیلنس موڈ (ٹوکن کنفیگر نہیں).', chainPending: 'بھیجا گیا، تصدیق کا انتظار…', pendingLock: 'پچھلا ٹرانزیکشن ابھی آن چین پر تصدیق ہو رہا ہے. چند سیکنڈ انتظار کریں — دوبارہ جمع نہ کریں; خود بخود جمع ہو جائے گا.', walletChanged: 'فعال والیٹ لاگ اکاؤنٹ سے مختلف ہے. لاگ آؤٹ کر کے اسی والیٹ کو دوبارہ منسلک کریں.',
    pendingTitle: 'زیر التزام آن چین ادائیگیاں', pendingVerify: 'ابھی تصدیق کریں اور جمع کروائیں', chainWillCredit: 'آن چین ادائیگی ہو گئی. تصدیق کے بعد خود بخود جمع ہو جائے گی; آپ میرا میں تصدیق بھی ٹیپ کر سکتے ہیں.', chainCreditedRedo: 'آن چین ادائیگی بیلنس میں جمع ہو گئی، براہ کرم دوبارہ خواہش جمع کروائیں.',
    manualCredit: 'ہیش سے جمع', manualTxPh: 'جمع کرنے کے لیے 0x… ہیش پیسٹ کریں', manualOk: 'بیلنس میں جمع ہو گیا', manualAlready: 'یہ ٹرانزیکشن پہلے ہی جمع ہو چکی ہے', manualBadHash: 'غلط ٹرانزیکشن ہیش',
    stateActive: 'جاری', stateLocked: 'بند', stateSettled: 'فیصلہ شدہ', stateCancelled: 'منسوخ (خالی)، واپس', winRed: 'سرخ جیتا', winGreen: 'سبز جیتا',
    nodeProgress: 'پیش رفت', nodePeriod: 'ادوار', pickNum: 'عدد', stake: 'رقم', detail: 'تفصیل', close: 'بند کریں',
    needPick: 'براہ کرم پہلے 0-9 کا عدد منتخب کریں', needAmount: '1-99 کا عدد صحیح (سکے) درج کریں', copyOk: 'کاپی ہو گیا', noWallet: 'کوئی والیٹ ایکسٹینشن نہیں ملا',
    walletShort: 'والیٹ بیلنس کم ہے', noWalletGap: 'کوئی والیٹ نہیں ملا. اس سائٹ کو TokenPocket DApp براؤزر میں کھولیں، یا والیٹ ایکسٹینشن انسٹال اور انلاک کریں.', offchainShort: 'بیلنس کافی نہیں (کم',
    chainNotConfigured: 'اس سائٹ پر کوئی آن چین ٹوکن کنفیگر نہیں، اس لیے والیٹ ادائیگی دستیاب نہیں. براہ کرم ڈپلائی شدہ آن لائن سائٹ استعمال کریں.', wrongChain: 'براہ کرم والیٹ نیٹ ورک کو BNB Smart Chain (chainId 56) پر سوئچ کریں.',
    selfCheck: 'والیٹ ماحول کی جانچ', scSite: 'سائٹ چین کنفیگریشن', scNoSite: 'کنفیگر نہیں (آن لائن سائٹ استعمال کریں)', scWallet: 'والیٹ ملا', scNoWallet: 'نہیں — TokenPocket DApp براؤزر میں کھولیں، یا والیٹ ایکسٹینشن انسٹال کریں', scNet: 'موجودہ نیٹ ورک', scAccount: 'مجاز اکاؤنٹ', scNoAccount: 'کوئی نہیں (والیٹ منسلک/انلاک کریں)', scWhich: 'والیٹ کی قسم',
    reply: 'جواب', sendReply: 'بھیجیں', replyPh: 'جواب لکھیں (زیادہ سے زیادہ 1024 بائٹ)', replies: 'جوابات', confirmDelPost: 'اس پوسٹ اور اس کے جوابات کو حذف کریں؟',
    flow_BET_FROZEN: 'خواہش جمع', flow_WIN_CREDIT: 'جیت جمع', flow_INS_WIN_CUT: 'بیمہ شدہ 10% پول میں', flow_CANCEL_REFUND: 'منسوخ واپسی',
    flow_REFERRAL: 'ریفرل انعام', flow_PREMIUM_IN: 'پریمیم جمع', flow_NODE_PREMIUM_OUT: 'نوڈ پریمیم', flow_NODE_PAYOUT: 'نوڈ ادائیگی', flow_NODE_FORFEIT: 'پول میں ختم',
    flow_WITHDRAW_FEE: 'نکاسی فیس', flow_WITHDRAW_PENDING: 'نکاسی', flow_WITHDRAW_PAID: 'نکاسی ہوئی', flow_WITHDRAW_REFUND: 'نکاسی واپس',
    flow_FAUCET: 'ٹیسٹ کلیم', flow_CHAIN_DEPOSIT: 'آن چین جمع', flow_ISSUE: 'سسٹم جمع',
  },
};

const state = { uid: null, wallet: null, isAdmin: false, lang: localStorage.getItem('lang') || 'en', side: 'red', pick: null, chainCfg: null, me: null, round: null, recent: [], pool: null, words: [] };
if (state.lang === 'zh-CN') state.lang = 'en';

function t(k) { return (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k; }
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = (state.lang === 'ar' || state.lang === 'ur') ? 'rtl' : 'ltr';
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
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
// 读取钱包插件「当前激活账户」地址（eth_accounts 只读、不弹窗；无插件/未授权返回 null）
async function activeWalletAddr() {
  const eth = window.ethereum; if (!eth) return null;
  try { const a = await eth.request({ method: 'eth_accounts' }); return (a && a[0]) ? a[0] : null; } catch { return null; }
}
// 全局只绑定一次：钱包账户/网络变化时自动跟着切换，杜绝“换了钱包还显示第一个账号”
let walletEventsBound = false;
function bindWalletEvents() {
  const eth = window.ethereum; if (!eth || walletEventsBound) return;
  walletEventsBound = true;
  eth.on?.('accountsChanged', (accs) => {
    const next = (accs && accs[0]) || null;
    localStorage.removeItem('pendingTxs'); // 旧账户的在途单不属于新账户，先清掉避免误锁
    if (next) doLogin(next).catch((e) => { const el = $('loginErr'); if (el) el.textContent = e.message || String(e); });
    else { localStorage.clear(); location.reload(); } // 断开连接 → 回登录页
  });
  eth.on?.('chainChanged', () => location.reload());
}
// 动钱/身份操作前：把登录身份强制对齐到当前激活钱包；账户变了就用新账户重登。返回是否发生切换
async function alignWallet() {
  bindWalletEvents();
  const active = await activeWalletAddr();
  if (!active) return false; // 无钱包插件/未授权：保持现状（演示账号等）
  if (state.wallet && active.toLowerCase() === String(state.wallet).toLowerCase()) return false;
  localStorage.removeItem('pendingTxs');
  await doLogin(active);
  return true;
}
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
    bindWalletEvents();
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accs || !accs.length) return;
    await doLogin(accs[0]);
  } catch (e) { $('loginErr').textContent = e.message || String(e); }
}
async function demoEnter() { $('loginErr').textContent = ''; try { await doLogin(randomDemoAddr()); } catch (e) { $('loginErr').textContent = e.message; } }
let mainTimersStarted = false;
function enterMain() {
  $('loginMask').classList.add('hide'); $('main').classList.remove('hide'); $('dock').classList.remove('hide');
  $('who').textContent = state.uid; // 顶栏只显示 U+数字，不显示钱包地址
  $('who').classList.remove('hide');
  buildNumGrid(); renderInviteLink(); renderPending();
  if (!mainTimersStarted) { // 切账户重登只刷新界面，不重复叠加定时器
    mainTimersStarted = true; switchDock('home');
    refresh(); setInterval(refresh, 1500); setInterval(tickCountdown, 1000);
    setInterval(() => loadBbs(true), 10000);
    creditPending(); setInterval(creditPending, 12000); // 自动补录掉单
  }
  checkDisclaimer();
}

// ---------------- Disclaimer ----------------
const DISCLAIMER_VERSION = 3;
const DISCLAIMER_CONTENT = {
  en: 'Section 1 - Nature of Platform. This platform is designed and operated exclusively for pure entertainment and social interaction purposes. It is not a financial institution, investment platform, gambling service, or any form of regulated financial service. All activities within this platform, including but not limited to wish pools, voice rooms, chat rooms, and social features, are intended solely for recreational enjoyment. Users acknowledge that participation is entirely voluntary and at their own discretion, and that the platform does not guarantee any specific outcome or result. Section 2 - Restricted Regions. If you are accessing this platform from any of the following regions, you must exit this application immediately and cease all use: Iran, Somalia, Saudi Arabia, Afghanistan, Tajikistan, Kuwait, Mainland China, Thailand, North Korea, Oman, Mauritania, Uzbekistan, Lebanon, Brunei, Yemen, Jordan, Kyrgyzstan, Syria, Qatar, and Turkmenistan, as well as any other jurisdiction where the use of this platform may be restricted or prohibited by applicable law. Continued access from these regions constitutes a material violation of this statement and may result in immediate and permanent account termination without refund. Section 3 - User Conduct and Voice Room Rules. All users are required to comply with the laws and regulations of their respective jurisdictions at all times while using this platform. In voice rooms, chat rooms, and all communication features, the following behaviors are strictly prohibited: (a) any content that violates the laws of any relevant country or region; (b) personal attacks, harassment, insults, threats, defamation, or any form of abusive or discriminatory behavior toward other users; (c) dissemination of illegal, harmful, obscene, or inappropriate content. Any violation of these rules will result in permanent account suspension without prior notice, and the platform reserves the right to report serious violations to relevant law enforcement authorities. Section 4 - Prohibition of Illegal Use. Users shall not use this platform for any purpose that is illegal under their local law, including but not limited to money laundering, fraud, illegal fundraising, terrorist financing, or any other activities that violate applicable laws and regulations. The platform is not liable for any illegal use by users, and users shall bear full legal responsibility for their own actions and consequences. Section 5 - Acknowledgment and Consent. By continuing to use this platform, you irrevocably confirm that you have fully read, understood, and agreed to all terms and conditions of this statement. You acknowledge and warrant that you are not accessing from any restricted region listed above, and that you will comply with all applicable laws, regulations, and platform rules during your use. Section 6 - Legal Protection. All copyrights, trademarks, and related intellectual property content of this website are protected under the laws of the Netherlands. Any unauthorized reproduction, distribution, modification, or commercial use is strictly prohibited and may result in legal action.',
  'zh-TW': '第一條：平台性質。本平台係以純娛樂及社交互動為唯一目的而設計及營運。本平台非金融機構、投資平台、博弈服務或任何形式之受監管金融服務。平台內所有活動，包括但不限於許願池、語音房、聊天室及社交功能，均僅供休閒娛樂之用。使用者確認參與完全出於自願及自行判斷，平台不保證任何特定結果。第二條：受限地區。若您來自以下任何地區，請立即退出本軟件並停止一切使用：伊朗、索馬利亞、沙烏地阿拉伯、阿富汗、塔吉克、科威特、中國（大陸地區）、泰國、北韓、阿曼、茅利塔尼亞、烏茲別克、黎巴嫩、汶萊、葉門、約旦、吉爾吉斯、敘利亞、卡達、土庫曼，以及其他適用法律可能限制或禁止使用本地區。自上述地區繼續存取即構成對本聲明之重大違反，可能導致立即永久停權且不退費。第三條：使用者行為與語音房規則。所有使用者於使用本平台期間，應隨時遵守其所屬司法管轄區之法律法規。於語音房、聊天室及所有通訊功能中，嚴格禁止以下行為：(a)違反任何相關國家或地區法律之內容；(b)對其他使用者進行人身攻擊、騷擾、辱罵、威脅、誹謗或任何形式之虐待或歧視行為；(c)散佈非法、有害、淫穢或不當內容。違反上述規則將導致未經事先通知之永久停權，平台保留向相關執法機關舉報嚴重違規之權利。第四條：禁止非法使用。使用者不得將本平台用於任何當地法律所禁止之用途，包括但不限於洗錢、詐騙、非法集資、恐怖主義融資或其他違反適用法律法規之行為。平台不對使用者之任何非法使用承擔責任，使用者應對自身行為及後果承擔全部法律責任。第五條：確認與同意。繼續使用本平台，即表示您不可撤銷地確認已充分閱讀、理解並同意本聲明之全部條款。您確認並保證您非來自上述任何受限地區，且於使用期間將遵守所有適用法律、法規及平台規則。第六條：法律保護。本網站所有著作權、商標及相關智慧財產內容受荷蘭法律保護。未經授權之複製、散佈、修改或商業使用均嚴格禁止，並可能導致法律訴追。',
  ja: '第1条：プラットフォームの性質。本プラットフォームは、純粋なエンターテイメントおよびソーシャルインタラクションを唯一の目的として設計および運営されています。金融機関、投資プラットフォーム、ギャンブルサービス、またはいかなる形態の規制対象金融サービスでもありません。願いプール、ボイスルーム、チャットルーム、ソーシャル機能を含むがこれらに限定されないプラットフォーム内のすべての活動は、娯楽のみを目的としています。ユーザーは、参加が完全に自発的かつ自己の判断によるものであり、プラットフォームが特定の結果を保証するものではないことを確認します。第2条：制限地域。以下のいずれかの地域からアクセスしている場合は、直ちに本アプリケーションを終了し、すべての使用を中止してください：イラン、ソマリア、サウジアラビア、アフガニスタン、タジキスタン、クウェート、中国（中国本土）、タイ、北朝鮮、オマーン、モーリタニア、ウズベキスタン、レバノン、ブルネイ、イエメン、ヨルダン、キルギス、シリア、カタール、トルクメニスタン、および適用法により本プラットフォームの使用が制限または禁止されているその他の地域。これらの地域からの継続的なアクセスは本声明の重大な違反となり、返金なしに即時かつ永久にアカウントが停止される場合があります。第3条：ユーザー行動とボイスルームルール。すべてのユーザーは、本プラットフォームの使用中、常に各自の管轄区域の法令を遵守する必要があります。ボイスルーム、チャットルーム、およびすべてのコミュニケーション機能において、以下の行為は厳禁です：(a)関連する国または地域の法律に違反するコンテンツ；(b)他のユーザーに対する個人攻撃、嫌がらせ、侮辱、脅迫、名誉毀損、またはいかなる形態の虐待もしくは差別的行為；(c)違法、有害、わいせつ、または不適切なコンテンツの配布。これらの規則に違反した場合、事前通知なしにアカウントが永久に停止され、プラットフォームは重大な違反を関連法執行機関に報告する権利を留保します。第4条：違法使用の禁止。ユーザーは、マネーロンダリング、詐欺、違法な資金調達、テロリストへの資金提供、または適用法令に違反するその他の活動を含むがこれらに限定されない、現地法で違法とされる目的で本プラットフォームを使用してはなりません。プラットフォームはユーザーによる違法使用について責任を負わず、ユーザーは自身の行為と結果について全法的責任を負うものとします。第5条：確認と同意。本プラットフォームの使用を継続することにより、あなたは本声明のすべての条件を十分に読み、理解し、同意したことを取り消し不能に確認するものとします。あなたは、上記の制限地域のいずれからもアクセスしていないこと、および使用中すべての適用法、規則、プラットフォーム規則を遵守することを確認し保証します。第6条：法的保護。本ウェブサイトのすべての著作権、商標、および関連する知的財産コンテンツは、オランダ法の下で保護されています。無断での複製、配布、改変、または商業的使用は厳禁であり、法的措置の対象となる場合があります。',
  ar: 'البند 1. طبيعة المنصة. تم تصميم وتشغيل هذه المنصة حصرياً لأغراض الترفيه الخالص والتفاعل الاجتماعي. وهي ليست مؤسسة مالية، ولا منصة استثمارية، ولا خدمة قمار، ولا أي شكل من أشكال الخدمات المالية الخاضعة للرقابة. جميع الأنشطة داخل المنصة، بما في ذلك على سبيل المثال لا الحصر تجمعات الأمنيات، وغرف الصوت، وغرف الدردشة، والميزات الاجتماعية، مخصصة حصراً للترفيه. يقر المستخدمون بأن المشاركة طوعية تماماً وبحسب تقديرهم الخاص، وأن المنصة لا تضمن أي نتيجة أو مخرجات محددة. البند 2. المناطق المقيدة. إذا كنت تصل إلى هذه المنصة من أي من المناطق التالية، فيجب عليك الخروج فوراً من هذا التطبيق وإيقاف جميع الاستخدامات: إيران، الصومال، السعودية، أفغانستان، طاجيكستان، الكويت، الصين (البر الرئيسي)، تايلاند، كوريا الشمالية، عُمان، موريتانيا، أوزبكستان، لبنان، بروناي، اليمن، الأردن، قيرغيزستان، سوريا، قطر، تركمانستان، بالإضافة إلى أي ولاية قضائية أخرى قد يُقيد أو يُحظر فيها استخدام هذه المنصة بموجب القانون المعمول به. الوصول المستمر من هذه المناطق يشكل خرقاً مادياً لهذا البيان وقد يؤدي إلى إغلاق الحساب فوراً وبشكل دائم دون استرداد الأموال. البند 3. سلوك المستخدم وقواعد غرف الصوت. يُطلب من جميع المستخدمين الالتزام بقوانين وأنظمة ولاياتهم القضائية المعنية في جميع الأوقات أثناء استخدام هذه المنصة. في غرف الصوت وغرف الدردشة وجميع ميزات الاتصال، تُحظر بشدة السلوكيات التالية: (أ) أي محتوى يخالف قوانين أي دولة أو منطقة ذات صلة؛ (ب) الهجمات الشخصية، أو المضايقة، أو الإهانات، أو التهديدات، أو التشهير، أو أي شكل من أشكال السلوك المسيء أو التمييزي تجاه المستخدمين الآخرين؛ (ج) نشر محتوى غير قانوني أو ضار أو فاحش أو غير لائق. أي انتهاك لهذه القواعد سيؤدي إلى تعليق دائم للحساب دون إشعار مسبق، وتحتفظ المنصة بالحق في الإبلاغ عن الانتهاكات الجسيمة إلى سلطات إنفاذ القانون المعنية. البند 4. حظر الاستخدام غير القانوني. لا يجوز للمستخدمين استخدام هذه المنصة لأي غرض غير قانوني بموجب قانونهم المحلي، بما في ذلك على سبيل المثال لا الحصر غسيل الأموال، والاحتيال، وجمع الأموال بشكل غير قانوني، وتمويل الإرهاب، أو أي أنشطة أخرى تخالف القوانين والأنظمة المعمول بها. المنصة غير مسؤولة عن أي استخدام غير قانوني من قبل المستخدمين، ويتحمل المستخدمون المسؤولية القانونية الكاملة عن أفعالهم وعواقبها. البند 5. الإقرار والموافقة. بمجرد استمرارك في استخدام هذه المنصة، فإنك تؤكد بشكل لا رجعة فيه أنك قد قرأت وفهمت ووافقت على جميع شروط وأحكام هذا البيان بالكامل. أنت تقر وتضمن أنك لا تصل من أي منطقة مقيدة مذكورة أعلاه، وأنك ستلتزم بجميع القوانين والأنظمة وقواعد المنصة المعمول بها أثناء الاستخدام. البند 6. الحماية القانونية. جميع حقوق النشر والعلامات التجارية والمحتويات الفكرية ذات الصلة في هذا الموقع محمية بموجب قانون هولندا. أي استنساخ أو توزيع أو تعديل أو استخدام تجاري دون إذن يُحظر بشدة وقد يؤدي إلى إجراءات قانونية.',
  id: 'Bagian 1. Sifat Platform. Platform ini dirancang dan dioperasikan secara eksklusif untuk tujuan hiburan murni dan interaksi sosial. Platform ini bukan lembaga keuangan, platform investasi, layanan perjudian, atau bentuk layanan keuangan yang diatur. Semua aktivitas di dalam platform ini, termasuk namun tidak terbatas pada kolam keinginan, ruang suara, ruang obrolan, dan fitur sosial, ditujukan semata-mata untuk hiburan. Pengguna mengakui bahwa partisipasi sepenuhnya bersifat sukarela dan atas kebijakan mereka sendiri, serta platform tidak menjamin hasil atau keluaran tertentu. Bagian 2. Wilayah Terbatas. Jika Anda mengakses platform ini dari salah satu wilayah berikut, Anda harus segera keluar dari aplikasi ini dan menghentikan semua penggunaan: Iran, Somalia, Arab Saudi, Afghanistan, Tajikistan, Kuwait, Tiongkok (Daratan), Thailand, Korea Utara, Oman, Mauritania, Uzbekistan, Lebanon, Brunei, Yaman, Yordania, Kirgistan, Suriah, Qatar, Turkmenistan, serta yurisdiksi lain apa pun di mana penggunaan platform ini mungkin dibatasi atau dilarang oleh hukum yang berlaku. Akses berkelanjutan dari wilayah ini merupakan pelanggaran material terhadap pernyataan ini dan dapat mengakibatkan penghentian akun segera dan permanen tanpa pengembalian dana. Bagian 3. Perilaku Pengguna dan Aturan Ruang Suara. Semua pengguna wajib mematuhi hukum dan peraturan yurisdiksi mereka masing-masing setiap saat saat menggunakan platform ini. Di ruang suara, ruang obrolan, dan semua fitur komunikasi, perilaku berikut dilarang keras: (a) konten apa pun yang melanggar hukum negara atau wilayah terkait; (b) serangan pribadi, pelecehan, penghinaan, ancaman, pencemaran nama baik, atau segala bentuk perilaku kasar atau diskriminatif terhadap pengguna lain; (c) penyebaran konten ilegal, berbahaya, cabul, atau tidak pantas. Pelanggaran aturan ini akan mengakibatkan penangguhan akun permanen tanpa pemberitahuan sebelumnya, dan platform berhak melaporkan pelanggaran serius kepada otoritas penegak hukum terkait. Bagian 4. Larangan Penggunaan Ilegal. Pengguna tidak boleh menggunakan platform ini untuk tujuan apa pun yang ilegal menurut hukum setempat mereka, termasuk namun tidak terbatas pada pencucian uang, penipuan, penggalangan dana ilegal, pendanaan terorisme, atau aktivitas lain yang melanggar hukum dan peraturan yang berlaku. Platform tidak bertanggung jawab atas penggunaan ilegal apa pun oleh pengguna, dan pengguna menanggung tanggung jawab hukum penuh atas tindakan dan konsekuensi mereka sendiri. Bagian 5. Pengakuan dan Persetujuan. Dengan terus menggunakan platform ini, Anda secara tidak dapat ditarik kembali mengonfirmasi bahwa Anda telah membaca, memahami, dan menyetujui semua syarat dan ketentuan pernyataan ini. Anda mengakui dan menjamin bahwa Anda tidak mengakses dari wilayah terbatas mana pun yang tercantum di atas, dan bahwa Anda akan mematuhi semua hukum, peraturan, dan aturan platform yang berlaku selama penggunaan. Bagian 6. Perlindungan Hukum. Semua hak cipta, merek dagang, dan konten kekayaan intelektual terkait dari situs web ini dilindungi oleh hukum Belanda. Reproduksi, distribusi, modifikasi, atau penggunaan komersial apa pun tanpa izin dilarang keras dan dapat mengakibatkan tindakan hukum.',
  ko: '제1조: 플랫폼의 성격. 본 플랫폼은 순수한 오락 및 사회적 교류를 유일한 목적으로 설계 및 운영됩니다. 금융기관, 투자 플랫폼, 도박 서비스 또는 어떠한 형태의 규제 대상 금융 서비스도 아닙니다. 소원 풀, 보이스룸, 채팅룸, 소셜 기능을 포함하되 이에 국한되지 않는 플랫폼 내 모든 활동은 오락 목적으로만 제공됩니다. 사용자는 참여가 전적으로 자발적이고 자신의 판단에 따른 것이며, 플랫폼이 특정 결과를 보장하지 않는다는 점을 확인합니다. 제2조: 제한 지역. 다음 지역 중 어느 곳에서든 접속하는 경우 즉시 본 애플리케이션을 종료하고 모든 사용을 중단하십시오: 이란, 소말리아, 사우디아라비아, 아프가니스탄, 타지키스탄, 쿠웨이트, 중국(중국 본토), 태국, 북한, 오만, 모리타니아, 우즈베키스탄, 레바논, 브루나이, 예멘, 요르단, 키르기스스탄, 시리아, 카타르, 투르크메니스탄, 및 적용 법률에 따라 본 플랫폼 사용이 제한 또는 금지될 수 있는 기타 지역. 이러한 지역에서의 계속적인 접속은 본 고지의 중대한 위반이며, 환불 없이 즉시 영구적으로 계정이 정지될 수 있습니다. 제3조: 사용자 행동 및 보이스룸 규칙. 모든 사용자는 본 플랫폼 사용 중 항상 관할 구역의 법률 및 규정을 준수해야 합니다. 보이스룸, 채팅룸 및 모든 커뮤니케이션 기능에서 다음 행위는 엄격히 금지됩니다: (가) 관련 국가 또는 지역의 법률을 위반하는 콘텐츠; (나) 다른 사용자에 대한 인신공격, 괴롭힘, 모욕, 위협, 명예훼손 또는 어떠한 형태의 학대나 차별적 행위; (다) 불법, 유해, 음란 또는 부적절한 콘텐츠의 유포. 이러한 규칙을 위반할 경우 사전 통지 없이 계정이 영구 정지되며, 플랫폼은 중대한 위반을 관련 사법 당국에 신고할 권리를 보유합니다. 제4조: 불법 사용 금지. 사용자는 자금 세탁, 사기, 불법 자금 조달, 테러 자금 조달 또는 적용 법률 및 규정을 위반하는 기타 활동을 포함하되 이에 국한되지 않는, 현지 법률에서 불법으로 규정하는 목적으로 본 플랫폼을 사용해서는 안 됩니다. 플랫폼은 사용자의 불법 사용에 대해 책임을 지지 않으며, 사용자는 자신의 행위와 결과에 대해 전적인 법적 책임을 집니다. 제5조: 확인 및 동의. 본 플랫폼 사용을 계속함으로써, 귀하는 본 고지의 모든 약관을 충분히 읽고 이해했으며 동의했음을 취소 불가능하게 확인합니다. 귀하는 위에 열거된 제한 지역 어디에서도 접속하지 않았으며, 사용 중 모든 적용 법률, 규정 및 플랫폼 규칙을 준수할 것을 확인하고 보증합니다. 제6조: 법적 보호. 본 웹사이트의 모든 저작권, 상표 및 관련 지적 재산 콘텐츠는 네덜란드 법률에 의해 보호됩니다. 무단 복제, 배포, 수정 또는 상업적 사용은 엄격히 금지되며 법적 조치의 대상이 될 수 있습니다.',
  ru: 'Раздел 1. Характер платформы. Настоящая платформа разработана и эксплуатируется исключительно в целях чистого развлечения и социального взаимодействия. Она не является финансовым учреждением, инвестиционной платформой, азартной игрой или какой-либо формой регулируемой финансовой услуги. Все действия на платформе, включая, но не ограничиваясь пулами желаний, голосовыми комнатами, чатами и социальными функциями, предназначены исключительно для развлечения. Пользователи подтверждают, что участие является полностью добровольным и осуществляется по их собственному усмотрению, и что платформа не гарантирует каких-либо конкретных результатов. Раздел 2. Ограниченные регионы. Если вы получаете доступ к платформе из любого из следующих регионов, вы должны немедленно выйти из приложения и прекратить использование: Иран, Сомали, Саудовская Аравия, Афганистан, Таджикистан, Кувейт, Китай (материковая часть), Таиланд, Северная Корея, Оман, Мавритания, Узбекистан, Ливан, Бруней, Йемен, Иордания, Киргизия, Сирия, Катар, Туркменистан, а также любые другие юрисдикции, где использование платформы может быть ограничено или запрещено применимым законодательством. Продолжение доступа из этих регионов является существенным нарушением настоящего заявления и может привести к немедленной и постоянной блокировке аккаунта без возврата средств. Раздел 3. Поведение пользователей и правила голосовых комнат. Все пользователи обязаны постоянно соблюдать законы и нормативные акты своих соответствующих юрисдикций при использовании платформы. В голосовых комнатах, чатах и всех функциях связи строго запрещены следующие действия: (a) любой контент, нарушающий законы любой соответствующей страны или региона; (b) личные нападки, преследование, оскорбления, угрозы, клевета или любая форма оскорбительного или дискриминационного поведения по отношению к другим пользователям; (c) распространение незаконного, вредного, непристойного или неуместного контента. Любое нарушение этих правил приведёт к постоянной блокировке аккаунта без предварительного уведомления, и платформа оставляет за собой право сообщать о серьёзных нарушениях в соответствующие правоохранительные органы. Раздел 4. Запрет на незаконное использование. Пользователи не должны использовать платформу в любых целях, запрещённых их местным законодательством, включая, но не ограничиваясь отмыванием денег, мошенничеством, незаконным сбором средств, финансированием терроризма или любыми другими действиями, нарушающими применимые законы и нормативные акты. Платформа не несёт ответственности за любое незаконное использование со стороны пользователей, и пользователи несут полную юридическую ответственность за свои собственные действия и их последствия. Раздел 5. Подтверждение и согласие. Продолжая использовать платформу, вы безоговорочно подтверждаете, что полностью прочитали, поняли и согласились со всеми условиями настоящего заявления. Вы подтверждаете и гарантируете, что не получаете доступ ни из одного из перечисленных выше ограниченных регионов, и что будете соблюдать все применимые законы, нормативные акты и правила платформы во время использования. Раздел 6. Правовая защита. Все авторские права, товарные знаки и связанные с ними объекты интеллектуальной собственности данного веб-сайта защищены законодательством Нидерландов. Любое несанкционированное воспроизведение, распространение, изменение или коммерческое использование строго запрещено и может повлечь за собой судебные иски.',
  hi: 'धारा 1. प्लेटफ़ॉर्म की प्रकृति। यह प्लेटफ़ॉर्म विशेष रूप से शुद्ध मनोरंजन और सामाजिक संपर्क के उद्देश्य से डिज़ाइन और संचालित किया गया है। यह कोई वित्तीय संस्था, निवेश प्लेटफ़ॉर्म, जुए की सेवा, या किसी भी प्रकार की विनियमित वित्तीय सेवा नहीं है। इस प्लेटफ़ॉर्म के भीतर सभी गतिविधियाँ, जिनमें विश पूल, वॉइस रूम, चैट रूम और सोशल फ़ीचर शामिल हैं लेकिन इन्हीं तक सीमित नहीं, केवल मनोरंजन के लिए हैं। उपयोगकर्ता स्वीकार करते हैं कि भागीदारी पूरी तरह से स्वैच्छिक और अपने स्वयं के विवेक पर है, और प्लेटफ़ॉर्म किसी विशिष्ट परिणाम की गारंटी नहीं देता है। धारा 2. प्रतिबंधित क्षेत्र। यदि आप निम्नलिखित में से किसी भी क्षेत्र से इस प्लेटफ़ॉर्म तक पहुँच बना रहे हैं, तो आपको तुरंत इस एप्लिकेशन को बंद कर देना चाहिए और सभी उपयोग बंद कर देना चाहिए: ईरान, सोमालिया, सऊदी अरब, अफगानिस्तान, ताजिकिस्तान, कुवैत, चीन (मुख्यभूमि), थाईलैंड, उत्तर कोरिया, ओमान, मॉरिटानिया, उज्बेकिस्तान, लेबनान, ब्रुनेई, यमन, जॉर्डन, किर्गिस्तान, सीरिया, कतर, तुर्कमेनिस्तान, तथा किसी भी अन्य न्यायिक क्षेत्र जहाँ लागू कानून द्वारा इस प्लेटफ़ॉर्म का उपयोग प्रतिबंधित या निषिद्ध हो सकता है। इन क्षेत्रों से निरंतर पहुँच इस विवरण का महत्वपूर्ण उल्लंघन है और बिना धन वापसी के तुरंत और स्थायी रूप से खाता बंद हो सकता है। धारा 3. उपयोगकर्ता आचरण और वॉइस रूम नियम। सभी उपयोगकर्ताओं को इस प्लेटफ़ॉर्म का उपयोग करते समय हर समय अपने संबंधित न्यायिक क्षेत्र के कानूनों और विनियमों का पालन करना आवश्यक है। वॉइस रूम, चैट रूम और सभी संचार फ़ीचर में, निम्नलिखित व्यवहार सख्त वर्जित हैं: (क) किसी संबंधित देश या क्षेत्र के कानून का उल्लंघन करने वाली सामग्री; (ख) अन्य उपयोगकर्ताओं के प्रति व्यक्तिगत आक्रमण, उत्पीड़न, अपमान, धमकी, मानहानि, या किसी भी प्रकार का अपमानजनक या भेदभावपूर्ण व्यवहार; (ग) अवैध, हानिकारक, अश्लील या अनुचित सामग्री का प्रसार। इन नियमों का कोई भी उल्लंघन बिना पूर्व सूचना के स्थायी खाता निलंबन का कारण बनेगा, और प्लेटफ़ॉर्म गंभीर उल्लंघनों को संबंधित कानून प्रवर्तन अधिकारियों को रिपोर्ट करने का अधिकार सुरक्षित रखता है। धारा 4. अवैध उपयोग का प्रतिषेध। उपयोगकर्ता इस प्लेटफ़ॉर्म का उपयोग अपने स्थानीय कानून के तहत किसी भी अवैध उद्देश्य के लिए नहीं कर सकते, जिसमें धन शोधन, धोखाधड़ी, अवैध फंड जुटाना, आतंकवाद को वित्त पोषण, या लागू कानूनों और विनियमों का उल्लंघन करने वाली अन्य गतिविधियाँ शामिल हैं लेकिन इन्हीं तक सीमित नहीं। प्लेटफ़ॉर्म उपयोगकर्ताओं द्वारा किसी भी अवैध उपयोग के लिए उत्तरदायी नहीं है, और उपयोगकर्ता अपने स्वयं के कार्यों और परिणामों के लिए पूर्ण कानूनी ज़िम्मेदारी उठाएंगे। धारा 5. स्वीकृति और सहमति। इस प्लेटफ़ॉर्म का उपयोग जारी रखकर, आप अपरिवर्तनीय रूप से पुष्टि करते हैं कि आपने इस विवरण की सभी शर्तों को पूरी तरह से पढ़ लिया है, समझ लिया है और उनसे सहमत हैं। आप स्वीकार और गारंटी देते हैं कि आप ऊपर सूचीबद्ध किसी भी प्रतिबंधित क्षेत्र से पहुँच नहीं बना रहे हैं, और उपयोग के दौरान आप सभी लागू कानूनों, विनियमों और प्लेटफ़ॉर्म नियमों का पालन करेंगे। धारा 6. कानूनी सुरक्षा। इस वेबसाइट के सभी कॉपीराइट, ट्रेडमार्क और संबंधित बौद्धिक संपदा सामग्री नीदरलैंड के कानून द्वारा सुरक्षित है। बिना अनुमति के कोई भी प्रतिलिपि, वितरण, संशोधन या वाणिज्यिक उपयोग सख्त वर्जित है और कानूनी कार्रवाई का कारण बन सकता है।',
  ur: 'دفعہ 1. پلیٹ فارم کی نوعیت۔ یہ پلیٹ فارم خالص تفریح اور سماجی تعامل کے واحد مقصد کے لیے ڈیزائن اور چلایا گیا ہے۔ یہ کوئی مالی ادارہ، سرمایہ کاری کا پلیٹ فارم، جوا کی خدمت، یا کسی بھی قسم کی منظم مالی خدمت نہیں ہے۔ اس پلیٹ فارم کے اندر تمام سرگرمیاں، بشمول خواہشوں کے تالاب، وائس رومز، چیٹ رومز، اور سوشل فیچرز، صرف تفریح کے لیے ہیں۔ صارفین تسلیم کرتے ہیں کہ شرکت مکمل طور پر رضاکارانہ اور اپنی صلاحیت پر ہے، اور پلیٹ فارم کسی مخصوص نتیجے کی ضمانت نہیں دیتا۔ دفعہ 2. محدود علاقے۔ اگر آپ درج ذیل میں سے کسی بھی علاقے سے اس پلیٹ فارم تک رسائی حاصل کر رہے ہیں، تو آپ کو فوراً اس ایپلیکیشن سے باہر نکل جانا چاہیے اور تمام استعمال بند کر دینا چاہیے: ایران، صومالیہ، سعودی عرب، افغانستان، تاجکستان، کویت، چین (مین لینڈ)، تھائی لینڈ، شمالی کوریا، عمان، موریتانیا، ازبکستان، لبنان، برونائی، یمن، اردن، کرغزستان، شام، قطر، ترکمانستان، نیز کوئی دوسرا دائرہ اختیار جہاں لاگو قانون کے تحت اس پلیٹ فارم کا استعمال محدود یا ممنوع ہو۔ ان علاقوں سے مسلسل رسائی اس بیان کی مادی خلاف ورزی ہے اور بغیر رقم واپسی کے فوری اور مستقل اکاؤنٹ بند ہو سکتی ہے۔ دفعہ 3. صارف کا رویہ اور وائس روم کے اصول۔ تمام صارفین کو اس پلیٹ فارم کے استعمال کے دوران ہر وقت اپنے متعلقہ دائرہ اختیار کے قوانین اور ضوابط کی تعمیل کرنی ضروری ہے۔ وائس رومز، چیٹ رومز، اور تمام مواصلاتی فیچرز میں، درج ذیل رویے سختی سے ممنوع ہیں: (ک) کسی متعلقہ ملک یا علاقے کے قانون کی خلاف ورزی کرنے والا مواد؛ (خ) دوسرے صارفین کے خلاف ذاتی حملے، ہراسانی، توہین، دھمکیاں، بدنامی، یا کسی بھی قسم کا بدتمیز یا امتیازی رویہ؛ (گ) غیر قانونی، نقصان دہ، فحش یا نامناسب مواد کی تقسیم۔ ان اصولوں کی کوئی بھی خلاف ورزی بغیر پیشگی اطلاع کے مستقل اکاؤنٹ معطلی کا باعث بنے گی، اور پلیٹ فارم سنگین خلاف ورزیوں کو متعلقہ قانون نافذ کرنے والے اداروں کو رپورٹ کرنے کا حق محفوظ رکھتا ہے۔ دفعہ 4. غیر قانونی استعمال کی ممانعت۔ صارفین اس پلیٹ فارم کو اپنے مقامی قانون کے تحت کسی بھی غیر قانونی مقصد کے لیے استعمال نہیں کر سکتے، بشمول منی لانڈرنگ، دھوکہ دہی، غیر قانونی فنڈ اکٹھا کرنا، دہشت گردی کی مالی معاونت، یا لاگو قوانین اور ضوابط کی خلاف ورزی کرنے والی دیگر سرگرمیاں لیکن ان ہی تک محدود نہیں۔ پلیٹ فارم صارفین کی کسی بھی غیر قانونی استعمال کے لیے ذمہ دار نہیں ہے، اور صارفین اپنے اعمال اور نتائج کی پوری قانونی ذمہ داری اٹھائیں گے۔ دفعہ 5. اعتراف اور رضامندی۔ اس پلیٹ فارم کا استعمال جاری رکھ کر، آپ ناقابل واپسی طور پر تصدیق کرتے ہیں کہ آپ نے اس بیان کی تمام شرائط کو پوری طرح پڑھ لیا ہے، سمجھ لیا ہے اور ان سے اتفاق کرتے ہیں۔ آپ تسلیم اور ضمانت دیتے ہیں کہ آپ اوپر درج کسی بھی محدود علاقے سے رسائی نہیں کر رہے ہیں، اور استعمال کے دوران آپ تمام لاگو قوانین، ضوابط اور پلیٹ فارم کے اصولوں کی تعمیل کریں گے۔ دفعہ 6. قانونی تحفظ۔ اس ویب سائٹ کے تمام کاپی رائٹ، ٹریڈ مارک اور متعلقہ دانشورانہ املاک کا مواد ہالینڈ کے قانون کے تحت محفوظ ہے۔ بغیر اجازت کسی بھی نقل، تقسیم، ترمیم یا تجارتی استعمال سختی سے ممنوع ہے اور قانونی کارروائی کا باعث بن سکتی ہے۔',
};
function checkDisclaimer() {
  if (!state.uid) return;
  if (localStorage.getItem('disclaimerAgreed') !== String(DISCLAIMER_VERSION)) {
    $('disclaimerContent').textContent = DISCLAIMER_CONTENT[state.lang] || DISCLAIMER_CONTENT.en;
    $('disclaimerMask').classList.remove('hide');
  }
}
function confirmDisclaimer() {
  localStorage.setItem('disclaimerAgreed', String(DISCLAIMER_VERSION));
  $('disclaimerMask').classList.add('hide');
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
  if (name === 'lottery' && typeof Lottery !== 'undefined') Lottery.loadProducts();
  if (name === 'me' && state.uid) { renderPending(); creditPending(); api('/withdraw/reap', { uid: state.uid }).then(refresh).catch(() => {}); }
}

// ---------------- Swipe to switch dock ----------------
const DOCK_ORDER = ['home', 'lottery', 'bbs', 'insurance', 'me'];
function bindSwipe() {
  let sx = 0, sy = 0, active = false;
  const NO_SWIPE = 'input, textarea, button, select, .room-msgs, .num-grid, .pool, .room-input-bar, .room-members, .bbs-list, .history-list';
  function swipeStart(x, y, target) {
    if (target.closest(NO_SWIPE)) { active = false; return; }
    active = true; sx = x; sy = y;
  }
  function swipeEnd(x, y) {
    if (!active) return;
    active = false;
    const dx = x - sx, dy = y - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const cur = document.querySelector('.dock-item.active')?.dataset.dock || 'home';
    const idx = DOCK_ORDER.indexOf(cur);
    const next = dx < 0 ? (idx + 1) % DOCK_ORDER.length : (idx - 1 + DOCK_ORDER.length) % DOCK_ORDER.length;
    switchDock(DOCK_ORDER[next]);
  }
  // Touch events (mobile/TP wallet WebView)
  document.addEventListener('touchstart', (e) => swipeStart(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener('touchend', (e) => swipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY), { passive: true });
  // Mouse events (desktop only, pointerType=mouse, avoids duplicate with touch)
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') swipeStart(e.clientX, e.clientY, e.target); }, { passive: true });
  document.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') swipeEnd(e.clientX, e.clientY); }, { passive: true });
}

// ---------------- Wish ----------------
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
  if (!state.round) { $('countdown').textContent = '···'; $('countdown').className = 'countdown'; const rc = $('roundCard'); if (rc) rc.style.setProperty('--border-color', '#22c55e'); }
  else {
    const remain = Math.max(0, state.round.settleAt - Math.floor(Date.now() / 1000));
    $('countdown').textContent = remain;
    // Pool flashing phases: 30s=2s blink, 20s=1s blink, 10s=original 3x/sec alternate
    const poolsEl = document.querySelector('.pools');
    if (poolsEl) {
      poolsEl.classList.remove('phase-30', 'phase-20', 'final-10');
      if (remain <= 10 && remain > 0) {
        poolsEl.classList.add('final-10');
      } else if (remain <= 20 && remain > 10) {
        poolsEl.classList.add('phase-20');
      } else if (remain <= 30 && remain > 20) {
        poolsEl.classList.add('phase-30');
      }
    }
    if (remain <= 10 && remain > 0) {
      $('countdown').className = 'countdown final';
    } else {
      $('countdown').className = remain <= 30 ? 'countdown urgent' : 'countdown';
    }
    // Countdown beep: deng deng every second in last 10 seconds
    if (remain <= 10 && remain > 0) {
      if (window._lastBeepSec !== remain) {
        window._lastBeepSec = remain;
        playCountdownBeep();
      }
    } else {
      window._lastBeepSec = null;
    }
    // Round-card border marquee: green -> red, speed up as time passes
    const rc = $('roundCard');
    if (rc) {
      const total = 180;
      const progress = Math.min(1, Math.max(0, (total - remain) / total));
      // Color: laser green (#22c55e) -> red (#ef4444)
      const r = Math.round(34 + (239 - 34) * progress);
      const g = Math.round(197 + (68 - 197) * progress);
      const b = Math.round(94 + (68 - 94) * progress);
      rc.style.setProperty('--border-color', `rgb(${r},${g},${b})`);
      // Animation duration: 4s at start, 0.5s at end (faster as time passes)
      const dur = 4 - 3.5 * progress;
      rc.style.setProperty('animation-duration', `${dur.toFixed(2)}s`);
    }
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
  // History dots: 3 rows max, show most recent rounds, chronological order (oldest first), active round 'ing' at the end
  // Take most recent 30 rounds first, then reverse to chronological order
  const recentSettled = state.recent.filter((x) => x.state === 'settled' || x.state === 'cancelled').slice(0, 30);
  const settled = recentSettled.slice().reverse(); // reverse to chronological order (oldest first)
  const rows = [];
  let currentRow = [];
  let currentDay = null;
  for (const x of settled) {
    const ukDay = new Date((x.settleAt || x.createdAt || 0) * 1000).toISOString().slice(0, 10);
    if (currentDay !== null && ukDay !== currentDay && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentDay = ukDay;
    currentRow.push(x);
    if (currentRow.length >= 10) {
      rows.push(currentRow);
      currentRow = [];
    }
    if (rows.length >= 3) break;
  }
  if (currentRow.length > 0 && rows.length < 3) rows.push(currentRow);
  // Last row: fixed 4-8 dots per round (determined once at round start)
  if (rows.length > 0) {
    // Determine last row count once per round, keep stable during the round
    const curRoundId = state.round ? state.round.roundId : null;
    if (state.lastRowRoundId !== curRoundId) {
      state.lastRowRoundId = curRoundId;
      state.lastRowCount = 4 + Math.floor(Math.random() * 5); // 4-8, fixed for this round
    }
    const lastRowMax = state.lastRowCount || 6;
    let lastRow = rows[rows.length - 1];
    // Trim last row to lastRowMax (from the end, keep newest)
    if (lastRow.length > lastRowMax) {
      lastRow = lastRow.slice(lastRow.length - lastRowMax);
      rows[rows.length - 1] = lastRow;
    }
    // Insert active round as 'ing' at the end of the last row (always, replace last if needed)
    if (state.round && state.round.state === 'active') {
      const ingItem = { roundId: state.round.roundId, active: true };
      if (lastRow.length < lastRowMax) {
        lastRow.push(ingItem);
      } else {
        // Replace last item with ing
        lastRow[lastRow.length - 1] = ingItem;
      }
    }
  }
  const dotsHtml = rows.slice(0, 3).map((row) => {
    return '<div class="dot-row">' + row.map((x) => {
      if (x.active) {
        return '<span class="hist-dot ing" title="Active"><span class="dot-num">ing</span></span>';
      }
      const shortId = String(x.roundId).replace(/\D/g, '').slice(-2);
      const dotClass = x.state === 'cancelled' ? 'void' : (x.result && x.result.winSide) || '';
      return '<span class="hist-dot ' + dotClass + '" title="' + x.roundId + ' (' + (x.state || '') + ')' + '"><span class="dot-num">' + shortId + '</span></span>';
    }).join('') + '</div>';
  }).join('');
  // Hero banner
  const hero = $('heroBanner');
  if (hero) hero.innerHTML = '<div class="hero-title">' + t('platformTitle') + '</div><div class="hero-desc">' + t('platformDesc') + '</div>';
  $('histDots').innerHTML = dotsHtml || '<span class="muted">—</span>';
}
// On-chain verification transient error whitelist: node timeout/no response/not indexed/waiting confirm -> keep retrying
const CHAIN_RETRY = /尚未|確認|确认|稍後|稍后|無響應|无响应|未找到|查到|等待|中$|waiting|confirm|pending|timeout|no response|receipt|not found|indexed/i;
// inner6 = in-site 6-decimal min unit; on-chain tokens mostly 18 decimals, multiply by 10^(decimals-6)
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
// Unified ready check before wallet deduction: site chain configured, wallet detected, account authorized, network on target chain (BSC=56)
async function ensureWalletReady() {
  if (!(state.chainCfg && state.chainCfg.enabled)) throw new Error(t('chainNotConfigured'));
  const eth = window.ethereum;
  if (!eth) throw new Error(t('noWalletGap'));
  let accs;
  try { accs = await eth.request({ method: 'eth_requestAccounts' }); }
  catch (e) { throw new Error(e.message || String(e)); }
  if (!accs || !accs.length) throw new Error(t('noWalletGap'));
  // When switching wallet accounts on same phone, current authorized address must match login account, else wrong account transfer/mixup
  const curAddr = String(accs[0] || '').toLowerCase();
  if (state.wallet && curAddr && curAddr !== String(state.wallet).toLowerCase()) throw new Error(t('walletChanged'));
  const want = '0x' + Number(state.chainCfg.chainId).toString(16);
  let cur = '';
  try { cur = (await eth.request({ method: 'eth_chainId' }) || '').toLowerCase(); } catch { /* cannot get, skip, validate at send time */ }
  if (cur && cur !== want) {
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] }); }
    catch (e) { throw new Error(t('wrongChain') + ' chainId=' + state.chainCfg.chainId); }
  }
  return eth;
}
// Wallet env self-check: site chain / wallet detected / current network / authorized account / wallet type, quick diagnostics
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
  if (livePending().length) { $('playMsg').textContent = t('pendingLock'); return; } // previous on-chain tx unconfirmed, no duplicate bets
  const side = state.side, pick = state.pick, btn = $('betBtn');
  const S6 = 1_000_000;
  try {
    btn.disabled = true;
    await alignWallet(); const uid = state.uid; // force align current active wallet before money movement, prevents A-account-bet/B-wallet-pay mixup
    // Priority 1: pure in-site bet, backend real-time balance decides - sufficient = instant success, never touch external wallet (avoids stale snapshot overcharge)
    try {
      await api('/bet', { uid, side, amount, pick });
      $('amountInput').value = ''; await refresh(); wishOkToast(); return;
    } catch (e) {
      if (e.code !== 'INSUFFICIENT_BALANCE') { $('playMsg').textContent = e.message || String(e); return; }
    }
    // Backend confirms insufficient: fetch latest account, precisely calculate on-chain top-up
    const fresh = await api('/user/' + uid);
    const availInner = Math.round(Number(fresh.account.available) * S6);
    const totalInner = amount * S6;
    const chainInner = totalInner - Math.min(availInner, totalInner); // only top up actual shortfall
    await ensureWalletReady();
    const dec = state.chainCfg.decimals, diff = dec - 6;
    if (diff < 0) { $('playMsg').textContent = 'Token decimals < 6, unsupported'; return; }
    const needWei = BigInt(chainInner) * (10n ** BigInt(diff));
    const wbal = await walletTokenWei();
    if (wbal < needWei) {
      const shortInner = Number(needWei - wbal) / (10 ** diff);
      $('playMsg').textContent = t('walletShort') + ' ' + fmt(shortInner / S6) + t('coinUnit'); return;
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
        $('playMsg').textContent = '✓'; $('amountInput').value = ''; wishOkToast(); return refresh();
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

// ---------------- History (home) ----------------
// Expanded round ID set + detail cache: stays expanded after periodic refresh redraw, no click-to-collapse bug
const expandedRounds = new Set();
const roundDetailCache = new Map();
async function fillHistDetail(id, box) {
  let d = roundDetailCache.get(id);
  if (!d) { d = await api('/round/' + id); roundDetailCache.set(id, d); }
  box.innerHTML = (d.bets || []).map((x) => `<div class="bet-line"><span class="tag ${x.side}">${x.side === 'red' ? t('redPool') : t('greenPool')}</span> ${x.uid} · ${t('stake')} ${fmt(x.amount)} · ${t('pickNum')} ${x.pick}</div>`).join('') || '<p class="muted">—</p>';
}
async function renderHistory() {
  const list = $('historyList');
  list.innerHTML = state.recent.map((r) => {
    const win = r.result && r.result.winSide;
    const open = expandedRounds.has(r.roundId);
    return `<div class="hist-row"><span class="dot ${win || 'void'}"></span><b>${r.roundId}</b>
      <span>${r.state === 'settled' ? (win === 'red' ? t('winRed') : t('winGreen')) : t('state' + (r.state === 'cancelled' ? 'Cancelled' : 'Active'))}</span>
      <span class="muted">${r.state === 'settled' ? `${fmt(r.result.total)} ${t('coinUnit')} · Σ=${r.sumPick} · ${new Date((r.settleAt || 0) * 1000).toLocaleString()}` : ''}</span>
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
  // Restore expanded round details after redraw
  for (const id of expandedRounds) { const box = $('hd-' + id); if (box) fillHistDetail(id, box); }
}

// ---------------- Insurance pool display + release countdown ----------------
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
      <div class="pp-box big"><span>${t('poolTotal')}</span><b>${fmt(total)} ${t('coinUnit')}</b></div>
      <div class="pp-box"><span>${t('poolNext')}</span><b>${fmt(next)} ${t('coinUnit')}</b></div>
      <div class="pp-box"><span>${t('poolNextAt')}</span><b>${utcHM(p.nextBatchAt)}</b><small class="pp-cd">${t('nextReleaseIn')} <i id="poolCountdown">--:--:--</i></small></div>
      <div class="pp-box"><span>${t('poolActiveNodes')}</span><b>${p.nextPayNodeCount}/${p.activeNodeCount}</b></div>
    </div>
    <div class="pp-bar"><i class="${ok ? 'ok' : 'bad'}" style="width:${barW}%"></i></div>
    <div class="pp-foot ${ok ? 'ok' : 'bad'}">${t('poolCover')} ${next > 0 ? cover : '—'}% · ${ok ? t('poolSufficient') : t('poolShort') + ' ' + fmt(Math.abs(gap)) + t('coinUnit')}</div>`;
  $('poolPublicMini').innerHTML = `<span>${t('poolTotal')} <b>${fmt(total)}</b> ${t('coinUnit')}</span><span>${t('poolNext')} <b>${fmt(next)}</b> ${t('coinUnit')}</span><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'} ${ok ? t('poolSufficient') : t('poolShort')}</span>`;
  updatePoolCountdown();
}

// Invite commission tier table (clear rows, current tier highlighted)
function renderInvTiers(invite) {
  const box = $('invTiers'); if (!box) return;
  if (!invite) { box.innerHTML = ''; return; }
  const isWL = !!invite.isWhitelisted;
  const rate = (Number(invite.perMille) / 10).toFixed(1) + '%';
  if (isWL) {
    const dc = invite.directCount != null ? invite.directCount : '-';
    const dt = invite.downlineTotal != null ? invite.downlineTotal : '-';
    box.innerHTML = `<div class="inv-tip"><span class="wl-tag">${t('whitelistTitle')}</span> ${t('wlScope')} <b>${rate}</b> ${t('wlAllDepth')}</div>
      <div class="it-grid"><div class="it-row active"><span>${t('normalDirect')}</span><b>${rate}</b></div></div>
      <div class="inv-stats"><span>${t('directInvitees')}: <b>${dc}</b></span><span>${t('downlineTotal')}: <b>${dt}</b></span></div>`;
  } else {
    const dc = invite.directCount != null ? invite.directCount : '-';
    box.innerHTML = `<div class="inv-tip">${t('normalInvTip')} <b>0.1%</b> ${t('normalDirect')}</div>
      <div class="it-grid"><div class="it-row active"><span>${t('normalDirect')}</span><b>0.1%</b></div></div>
      <div class="inv-stats"><span>${t('directInvitees')}: <b>${dc}</b></span></div>
      <p class="muted apply-tip">${t('applyWhitelistTip')}</p>`;
  }
}

// ---------------- Me ----------------
function renderMe() {
  const me = state.me; if (!me) return;
  const a = me.account;
  $('availBal').textContent = fmt(a.available) + t('coinUnit'); $('frozenBal').textContent = fmt(a.frozen) + t('coinUnit');
  $('premiumBal').textContent = fmt(a.premium) + t('coinUnit'); $('premiumBal2').textContent = fmt(a.premium) + t('coinUnit');
  $('lossAccum').textContent = fmt(a.lossAccum) + t('coinUnit');
  $('insSwitchState').textContent = me.user.insSwitch ? 'ON' : 'OFF';
  $('insSwitchBtn').textContent = me.user.insSwitch ? 'OFF' : 'ON';
  // Insurance status bar: switch on AND premium>=20 units -> green active, else gray off
  const insActive = !!me.user.insSwitch && Number(a.premium) >= 20;
  const insBar = $('insStatusBar');
  if (insBar) { insBar.classList.toggle('on', insActive); insBar.classList.toggle('off', !insActive); insBar.textContent = insActive ? t('insOnBar') : t('insOffBar'); }
  const invRate = (me.invite.perMille / 10).toFixed(1) + '%';
  $('invCount').textContent = me.invite.rewardedInvitees || 0;
  $('invRate').textContent = invRate;
  $('invTotal').textContent = fmt(me.invite.rewardTotal) + t('coinUnit');
  const invTitle = $('meInviteTitle'); if (invTitle) invTitle.textContent = `${t('meInvite')}（${invRate}）`;
  renderInvTiers(me.invite);
  $('nodeList').innerHTML = me.nodes.length ? me.nodes.map((n) => {
    const pct = Math.round((n.periodN / 100) * 100);
    return `<div class="node-row"><b>${n.nodeId}</b><span>${t('nodePeriod')} ${n.periodN}/100</span><div class="bar"><i style="width:${pct}%"></i></div><span>${t('nodeProgress')} ${pct}%</span></div>`;
  }).join('') : '<p class="muted">—</p>';
  $('flowList').innerHTML = me.flows.map((f) => `<div class="flow-line"><span>${t('flow_' + f.bizType) || f.bizType}</span><b>${fmt(f.amount)} ${t('coinUnit')}</b><small>${new Date(f.at).toLocaleString()}</small></div>`).join('') || '<p class="muted">—</p>';
  const tip = $('chainModeTip');
  tip.classList.remove('hide');
  if (state.chainCfg && state.chainCfg.enabled && state.chainCfg.canPayout === false) {
    tip.style.color = '#ff6b6b';
    tip.textContent = '⚠ Platform payout private key not configured correctly (PAYOUT_PRIVATE_KEY is placeholder or malformed). Withdrawals cannot be sent. Admin must set the real platform wallet private key in environment variables and redeploy.';
  } else {
    tip.style.color = '';
    tip.textContent = (state.chainCfg && state.chainCfg.enabled) ? t('chainOn') : t('chainOff');
  }
  syncAdmin(me.isAdmin);
}
function renderInviteLink() {
  const link = `${location.origin}${location.pathname}?ref=${state.uid}`;
  $('inviteLink').value = link;
  const box = $('qrcode');
  if (box && typeof qrcode === 'function') {
    try { const qr = qrcode(0, 'M'); qr.addData(link); qr.make(); box.innerHTML = qr.createImgTag(4); }
    catch (e) { box.innerHTML = ''; }
  }
}
function syncAdmin(isAdmin) {
  if (isAdmin === undefined) isAdmin = state.isAdmin;
  state.isAdmin = !!isAdmin;
  $('adminPanel').classList.toggle('hide', !state.isAdmin);
  $('adminAnnounceBox').classList.toggle('hide', !state.isAdmin);
  if (state.isAdmin) { loadAdminWords(); loadWhitelist(); bindNpcAdd(); }
}

// ---------------- System announcement ----------------
async function loadAnnouncement() {
  try {
    const ann = await api('/announcement');
    if (ann && ann.content) {
      $('announcementContent').textContent = ann.content;
      $('announcementTime').textContent = new Date(ann.at).toLocaleString();
      $('announcementBox').classList.remove('hide');
    } else {
      $('announcementBox').classList.add('hide');
    }
  } catch { $('announcementBox').classList.add('hide'); }
}

// ---------------- Board (post / reply / admin moderation) ----------------
async function loadBbs(auto = false) {
  if (!$('tab-bbs').classList.contains('active')) return;
  // Protect active input during auto-poll: skip redraw if reply box expanded, focus in input, or main input has draft
  if (auto && (document.querySelector('.reply-box:not(.hide)') || document.querySelector('#tab-bbs textarea:focus') || $('bbsInput').value)) return;
  loadAnnouncement();
  const posts = await api('/bbs/list');
  $('bbsList').innerHTML = posts.length ? posts.map((p) => `
    <div class="bbs-item">
      <div class="bbs-head"><b>${shortAddr(p.wallet || p.uid)}${p.banned ? ` <span class="banned-tag">${t('bannedTag')}</span>` : ''}</b><small>${new Date(p.lastActiveAt).toLocaleString()}</small></div>
      <div class="bbs-text">${escapeHtml(p.content)}</div>
      <div class="replies">${(p.replies || []).map((r) => `<div class="reply-line"><b>${shortAddr(r.wallet || r.uid)}</b><span>${escapeHtml(r.content)}</span><small>${new Date(r.at).toLocaleString()}</small></div>`).join('')}</div>
      <div class="reply-box hide" id="rb-${p.postId}">
        <textarea rows="2" maxlength="1024" placeholder="${t('replyPh')}"></textarea>
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
    if (byteLen(content) < 1 || byteLen(content) > BBS_MAX_BYTES) { ta.focus(); return; }
    b.disabled = true;
    try {
      await api('/bbs/reply', { uid: state.uid, postId, content });
      await loadBbs(); // redraw all after success, new reply appears under the post
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
    state.words = await api('/admin/words?uid=' + encodeURIComponent(state.uid));
    $('wordTags').innerHTML = state.words.length
      ? state.words.map((w) => `<span class="word-tag">${escapeHtml(w)}<button data-wordrm="${escapeHtml(w)}">×</button></span>`).join('')
      : `<span class="muted">${t('noBlocked')}</span>`;
    $('wordTags').querySelectorAll('[data-wordrm]').forEach((b) => b.onclick = async () => {
      await api('/admin/word/remove', { uid: state.uid, word: b.dataset.wordrm }); loadAdminWords();
    });
  } catch (e) { /* not admin or network glitch, ignore */ }
}
async function adminAddWord() {
  const w = $('wordInput').value.trim();
  if (!w) return;
  try { await api('/admin/word/add', { uid: state.uid, word: w }); $('wordInput').value = ''; loadAdminWords(); }
  catch (e) { alert(e.message); }
}
// ---------------- Whitelist admin management ----------------
async function loadWhitelist() {
  try {
    const r = await api('/admin/whitelist?uid=' + encodeURIComponent(state.uid));
    const list = r.list || [];
    const box = $('wlList');
    if (!box) return;
    if (!list.length) { box.innerHTML = '<span class="muted">—</span>'; return; }
    box.innerHTML = list.map((w) => {
      const rate = (Number(w.perMille) / 10).toFixed(1) + '%';
      return '<div class="wl-row" data-wallet="' + escapeHtml(w.wallet) + '">' +
        '<span class="wl-addr">' + shortAddr(w.wallet) + '</span>' +
        '<span class="wl-rate">' + rate + '</span>' +
        '<button class="btn-mini wl-edit" data-wallet="' + escapeHtml(w.wallet) + '" data-rate="' + w.perMille + '">Edit</button>' +
        '<button class="btn-mini wl-del" data-wallet="' + escapeHtml(w.wallet) + '">×</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('.wl-edit').forEach((b) => b.onclick = () => {
      const cur = b.dataset.rate;
      const input = prompt('Set per-mille rate (e.g. 3 = 0.3%, 5 = 0.5%):', cur);
      if (input === null) return;
      const v = parseInt(input, 10);
      if (isNaN(v) || v < 0 || v > 100) { alert('Invalid rate (0-100)'); return; }
      api('/admin/whitelist/add', { uid: state.uid, wallet: b.dataset.wallet, perMille: v }).then(loadWhitelist).catch((e) => alert(e.message));
    });
    box.querySelectorAll('.wl-del').forEach((b) => b.onclick = () => {
      if (!confirm('Remove this wallet from whitelist?')) return;
      api('/admin/whitelist/remove', { uid: state.uid, wallet: b.dataset.wallet }).then(loadWhitelist).catch((e) => alert(e.message));
    });
  } catch (e) { /* not admin, ignore */ }
}
function bindWhitelist() {
  const btn = $('wlAddBtn');
  if (!btn) return;
  btn.onclick = async () => {
    const wallet = $('wlWalletInput').value.trim();
    const rate = parseInt($('wlRateInput').value, 10);
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) { alert('Invalid wallet address'); return; }
    if (isNaN(rate) || rate < 0 || rate > 100) { alert('Invalid per-mille rate (0-100)'); return; }
    try {
      await api('/admin/whitelist/add', { uid: state.uid, wallet, perMille: rate });
      $('wlWalletInput').value = ''; $('wlRateInput').value = '';
      showToast('Whitelist updated');
      loadWhitelist();
    } catch (e) { alert(e.message); }
  };
  loadWhitelist();
}
// ---------------- NPC admin management ----------------
async function loadNpcs() {
  try {
    const r = await api('/admin/npcs?uid=' + encodeURIComponent(state.uid));
    const list = r.list || [];
    const box = $('npcList');
    if (!box) return;
    if (!list.length) { box.innerHTML = '<span class="muted">No NPCs yet</span>'; return; }
    const langNames = { en:'EN', 'zh-TW':'繁中', ja:'日本語', ar:'العربية', id:'ID', ko:'한국어', ru:'RU', hi:'हिन्दी', ur:'اردو' };
    const now = Math.floor(Date.now()/1000);
    box.innerHTML = list.map((n) => {
      const bal = (typeof n.balance === 'number') ? n.balance.toFixed(2) : '?';
      const betStatus = n.lastBetAt > 0 ? ('bet@' + new Date(n.lastBetAt*1000).toLocaleTimeString()) : 'no bet yet';
      const nextBet = n.nextBetAt > now ? ('next:' + Math.floor((n.nextBetAt-now)/60) + 'm') : 'due now';
      return '<div class="wl-row" data-npcid="' + escapeHtml(n.npcId) + '" style="flex-wrap:wrap;gap:4px">' +
        '<span class="wl-addr" style="flex:1;min-width:80px;font-family:monospace">' + escapeHtml('...' + String(n.wallet).slice(-8)) + '</span>' +
        '<span class="wl-rate">' + (langNames[n.language] || n.language || 'EN') + '</span>' +
        '<span style="font-size:11px;color:#22c55e">bal:' + bal + '</span>' +
        '<span style="font-size:11px;color:#666">' + betStatus + ' | ' + nextBet + '</span>' +
        '<button class="btn-mini npc-del" data-npcid="' + escapeHtml(n.npcId) + '">×</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('.npc-del').forEach((b) => b.onclick = () => {
      if (!confirm('Remove this NPC?')) return;
      api('/admin/npc/remove', { uid: state.uid, npcId: b.dataset.npcid }).then(loadNpcs).catch((e) => alert(e.message));
    });
  } catch (e) { /* not admin, ignore */ }
}
function bindNpcAdd() {
  const btn = $('npcAddBtn');
  if (!btn) return;
  btn.onclick = async () => {
    const name = $('npcNameInput').value.trim();
    const wallet = $('npcWalletInput') ? $('npcWalletInput').value.trim() : '';
    const language = $('npcLangSelect') ? $('npcLangSelect').value : '';
    btn.disabled = true;
    try {
      const r = await api('/admin/npc/add', { uid: state.uid, name: name || null, wallet: wallet || null, language: language || null });
      $('npcNameInput').value = '';
      if ($('npcWalletInput')) $('npcWalletInput').value = '';
      showToast(t('npcAdded') + ': ...' + String(r.npc?.wallet || '').slice(-8));
      await loadNpcs();
    } catch (e) { alert(t('npcAddFail') + ': ' + e.message); }
    finally { btn.disabled = false; }
  };
  loadNpcs();
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
async function postBbs() {
  const content = $('bbsInput').value.trim();
  if (byteLen(content) < 1 || byteLen(content) > BBS_MAX_BYTES) return;
  await api('/bbs/post', { uid: state.uid, content });
  $('bbsInput').value = ''; $('bbsChar').textContent = '0/' + BBS_MAX_BYTES; await loadBbs();
}

// ---------------- Actions ----------------
async function switchIns() { await alignWallet(); const me = state.me; await api('/insurance/switch', { uid: state.uid, on: !me.user.insSwitch }); refresh(); }

// Premium deposit: pure in-site first (backend real-time balance), external wallet top-up only when backend explicitly says insufficient
async function depositPremium() {
  const amount = Number($('premiumInput').value);
  const msg = $('premiumMsg'); msg.className = 'msg'; msg.textContent = '';
  if (!Number.isInteger(amount) || amount <= 0) { msg.textContent = t('premiumNeed'); return; }
  if (livePending().length) { msg.textContent = t('pendingLock'); return; } // previous on-chain tx unconfirmed, no duplicate premium deposit
  const btn = $('premiumBtn'), S6 = 1_000_000;
  try {
    btn.disabled = true;
    await alignWallet(); // align current active wallet before money movement
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
    if (wbal < needWei) { const s = Number(needWei - wbal) / (10 ** diff); msg.textContent = t('walletShort') + ' ' + fmt(s / S6) + t('coinUnit'); return; }
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

// Insurance off: withdraw premium back to available (empty input = withdraw all)
async function withdrawPremium() {
  const raw = $('premiumOutInput').value.trim();
  await alignWallet();
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
    await alignWallet(); // align current active wallet before money movement, prevents wrong account deduction
    const r = await api('/withdraw', { uid: state.uid, amount: v });
    if (r.paid === true) alert(t('wdOk') + '\n' + t('wdCheckReceive') + (r.txHash ? '\n' + r.txHash : ''));
    else if (r.paid === false) alert(((r.broadcast ? '⚠ ' : '') + (r.payoutError || 'pending') + (r.txHash ? `\n${r.txHash}` : '')));
    else alert(t('wdPending'));
    $('wdInput').value = ''; refresh();
  } catch (e) { alert(e.message); }
  finally { btn.disabled = false; btn.textContent = t('withdraw'); }
}


// On-chain missing-order recovery: wallet paid = always creditable by tx hash, money never lost
function loadPending() { try { return JSON.parse(localStorage.getItem('pendingTxs') || '[]'); } catch { return []; } }
// Check for on-chain pending tx within 10 min: while pending, no new bet/premium deposit, prevents duplicate submission when confirmation is slow
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
      } catch (e) { /* on-chain unconfirmed / node timeout: keep, auto-retry next round */ }
    }
  } finally { crediting = false; }
}

// Bet success toast: show once after wish confirmed (in-site instant / on-chain top-up confirmed)
// Deep male voice with 3-layer synthesis, no echo (stable across browsers)
function speakRich(text, opts = {}) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const basePitch = opts.pitch || 0.5;
    const baseRate = opts.rate || 0.85;
    const baseVolume = opts.volume || 0.7;
    // Get all voices and find a male voice
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => /male|david|mark|daniel|alex|fred|george|thomas|guy|barry/i.test(v.name)) 
      || voices.find(v => v.lang === 'en-US' && /male/i.test(v.name))
      || voices.find(v => v.lang === 'en-US');
    // 3 layers: main + low + mid, all simultaneous, no echo
    const layers = [
      { pitch: basePitch, volume: baseVolume, rate: baseRate },
      { pitch: Math.max(0, basePitch - 0.2), volume: baseVolume * 0.5, rate: baseRate },
      { pitch: basePitch + 0.15, volume: baseVolume * 0.35, rate: baseRate },
    ];
    for (const layer of layers) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.pitch = layer.pitch;
      u.rate = layer.rate;
      u.volume = layer.volume;
      if (maleVoice) u.voice = maleVoice;
      window.speechSynthesis.speak(u);
    }
  } catch (e) {}
}
// Single clear male voice for result announcement (no harmony, no repeat, one pass)
function speakResult(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => /male|david|mark|daniel|alex|fred|george|thomas|guy|barry/i.test(v.name)) 
      || voices.find(v => v.lang === 'en-US' && /male/i.test(v.name))
      || voices.find(v => v.lang === 'en-US');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 0.5;
    u.rate = 0.85;
    u.volume = 0.5;
    if (maleVoice) u.voice = maleVoice;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
// Preload voices
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  window.speechSynthesis.getVoices();
}
// Countdown beep sound using Web Audio API (deng deng like race start)
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function playDeng(freq, duration, volume) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  } catch (e) {}
}
function playCountdownBeep() {
  playDeng(880, 0.15, 0.15); // short deng, half volume
}
function playFinalBeep() {
  playDeng(440, 0.8, 0.2); // long final beep, half volume
  setTimeout(() => playDeng(660, 0.6, 0.15), 100);
}
// Coin drop sound effect using Web Audio API -哗哗啦啦 coins pouring
function playCoinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const duration = 1.8;
    // 1. White noise for the '哗哗' rushing sound
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    // Bandpass filter to make it sound like metal coins clinking
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.8;
    // Highpass to remove low rumble
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1500;
    // Volume envelope: fade in, sustain, fade out
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.25, now + 0.15);
    noiseGain.gain.setValueAtTime(0.25, now + 1.0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
    // 2. Random high-pitched 'ding' sounds for individual coin clinks
    const coinPitches = [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
    for (let i = 0; i < 40; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = coinPitches[Math.floor(Math.random() * coinPitches.length)] + (Math.random() - 0.5) * 200;
      const startTime = now + 0.1 + Math.random() * 1.2;
      const vol = 0.05 + Math.random() * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08 + Math.random() * 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }
    // Cleanup
    setTimeout(() => ctx.close(), 2500);
  } catch (e) { /* audio not available */ }
}
function wishOkToast() {
  playCoinSound();
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'wish-success-overlay';
  // Text
  const text = document.createElement('div');
  text.className = 'wish-success-text';
  text.textContent = '许愿成功，心想事成';
  overlay.appendChild(text);
  // Pool at bottom
  const pool = document.createElement('div');
  pool.className = 'wish-pool';
  overlay.appendChild(pool);
  // Splash effect
  for (let i = 0; i < 3; i++) {
    const splash = document.createElement('div');
    splash.className = 'wish-splash';
    splash.style.left = (45 + Math.random() * 10) + '%';
    splash.style.animationDelay = (0.5 + i * 0.3) + 's';
    overlay.appendChild(splash);
  }
  // Coins falling
  const coinCount = 25;
  for (let i = 0; i < coinCount; i++) {
    const coin = document.createElement('div');
    coin.className = 'wish-coin';
    coin.style.left = (15 + Math.random() * 70) + '%';
    coin.style.animationDuration = (1.2 + Math.random() * 0.8) + 's';
    coin.style.animationDelay = (Math.random() * 0.8) + 's';
    coin.style.width = coin.style.height = (18 + Math.random() * 12) + 'px';
    overlay.appendChild(coin);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2600);
}
async function refresh() {
  if (!state.uid) return;
  creditPending(); // Auto-recover confirmed on-chain pending orders each round, clear pending and unlock immediately after confirmation
  try {
    const [r, recent, me, pool] = await Promise.all([api('/round/current'), api('/recent'), api('/user/' + state.uid), api('/insurance/pool')]);
    // Detect round settlement: announce winner in English
    const prevRound = state.round;
    if (prevRound && prevRound.state === 'active' && r && r.state !== 'active' && r.result && r.result.winSide) {
      playFinalBeep();
    }
    state.round = r; state.recent = recent; state.me = me; state.pool = pool;
    renderRound(); renderMe(); renderPoolPublic();
    if ($('tab-home').classList.contains('active')) renderHistory();
  } catch (e) { /* self-heal next round */ }
}

// ---------------- Init ----------------
function init() {
  $('langSel').value = state.lang; applyI18n();
  $('langSel').onchange = (e) => { state.lang = e.target.value; localStorage.setItem('lang', state.lang); applyI18n(); refresh(); };
  $('connectBtn').onclick = connectWallet; $('demoBtn').onclick = demoEnter;
  $('sideRed').onclick = () => selectSide('red'); $('sideGreen').onclick = () => selectSide('green');
  $('betBtn').onclick = submitWish;
  $('selfCheckBtn').onclick = walletSelfCheck;
  document.querySelectorAll('.dock-item').forEach((d) => d.onclick = () => switchDock(d.dataset.dock));
  bindSwipe();
  $('disclaimerConfirm').onclick = confirmDisclaimer;
  // System announcement publish (admin)
  $('announceInput').addEventListener('input', () => { $('announceChar').textContent = byteLen($('announceInput').value) + '/8192'; });
  $('announceSend').onclick = async () => {
    const content = $('announceInput').value.trim();
    if (byteLen(content) < 1 || byteLen(content) > 8192) { alert('Announcement 1-8192 bytes'); return; }
    try { await api('/announcement', { uid: state.uid, content }); $('announceInput').value = ''; $('announceChar').textContent = '0/8192'; await loadAnnouncement(); alert('Announcement published'); }
    catch (e) { alert(e.message); }
  };
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
      alert((r.already ? t('manualAlready') : `${t('manualOk')} +${fmt(r.credited)}`) + t('coinUnit'));
      $('manualTxInput').value = ''; await refresh();
    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
  };
  $('wordAddBtn').onclick = adminAddWord;
  bindWhitelist(); bindNpcAdd();
  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb && cb(); } catch (e) { alert(text); }
    finally { document.body.removeChild(ta); }
  }
  $('copyInvBtn').onclick = () => {
    const text = $('inviteLink').value;
    const btn = $('copyInvBtn');
    const orig = btn.textContent;
    const done = () => { showToast(t('copyOk')); btn.textContent = t('copyOk'); setTimeout(() => { btn.textContent = orig; }, 1500); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };
  $('bbsSend').onclick = postBbs;
  $('bbsInput').oninput = () => { $('bbsChar').textContent = byteLen($('bbsInput').value) + '/' + BBS_MAX_BYTES; };
  selectSide('red');
  bindWalletEvents();
  (async () => {
    // With wallet plugin: use current active account (switched wallet still logs in correctly); no plugin falls back to local cache (demo)
    const active = await activeWalletAddr().catch(() => null);
    const addr = active || localStorage.getItem('wallet');
    if (!addr) return;
    try { await doLogin(addr); }
    catch { localStorage.removeItem('uid'); localStorage.removeItem('wallet'); }
  })();
}
const FE_BUILD = '2.11.5';
{ const el = document.getElementById('feBuild'); if (el) el.textContent = 'Ver.' + FE_BUILD; }
init();
if (typeof Lottery !== 'undefined') Lottery.init();
