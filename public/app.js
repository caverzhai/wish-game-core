// =============================================================
// app.js —— English / 繁體 / 日本語；底部Dock：首页(许愿+历史)/广场/保险/我的
// 支付：站内余额优先，不足差额调外部钱包；BBS 含管理员删帖/封号/屏蔽词治理
// =============================================================
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortAddr = (a = '') => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const codeLen = (s) => [...String(s)].length;
const byteLen = (s) => new TextEncoder().encode(String(s ?? '')).length; // UTF-8 字节数
const BBS_MAX_BYTES = 1024; // BBS 单条上限 1024 字节
const utcHM = (sec) => new Date(sec * 1000).toISOString().slice(11, 16) + ' UTC';
const pad2 = (n) => String(n).padStart(2, '0');

const I18N = {
  en: {
    appTitle: 'Three-Minute Wish Pool', loginTip: 'Connect a wallet to start. Invite links bind referrers automatically.', connectWallet: 'Connect Wallet', demoEnter: 'No wallet? Enter as demo', logout: 'Sign out',
    dockHome: 'Home', dockBbs: 'Board', dockIns: 'Insurance', dockMe: 'Me', disclaimerTitle: 'Disclaimer', disclaimerAgree: 'I have read and agree',
    remainSec: 'seconds left', lockAt: 'closed at 150s', betCount: 'Wishes', redPool: 'Red Pool', greenPool: 'Green Pool',
    oddWin: 'Odd sum → Red', evenWin: 'Even sum → Green', pickLabel: 'Pick a number (0-9)',
    amountLabel: 'Wish amount (1-99 枚, integer)', confirmWish: 'Confirm Wish', waitingStart: 'Waiting for the first wish…', historyTitle: 'Past rounds',
    insTitle: 'Wish Insurance', insSwitch: 'Insurance', premium: 'Premium', lossAccum: 'Net loss', depositPremium: 'Deposit premium',
    insRule: 'Active only when switched on and premium ≥ 20 枚. Insured winners contribute 10% to the pool; every 100 枚 net loss opens a payout node (costs 20 枚), returned over 100 periods.',
  winCongrats: '🎉 Wish placed successfully! Wishing you great fortune every day!',
  insLightOn: 'Insurance active', insLightOff: 'Insurance inactive (switch ON and keep ≥20 枚 premium)',
  insStatusLabel: 'Insurance status',
  insOnBar: 'Insurance active', insOffBar: 'Insurance off',
    myNodes: 'My payout nodes', poolTotal: 'Insurance pool', poolNext: 'Next release total', poolNextAt: 'Next release at', nextReleaseIn: 'Next in', poolActiveNodes: 'Active nodes',
    poolSufficient: 'Sufficient', poolShort: 'Shortfall', poolCover: 'Coverage',
    meWallet: 'Wallet', meInvite: 'Invite', copy: 'Copy', qualifiedInvitees: 'Qualified', curRate: 'Rate', invTotal: 'Total',
    invTierTip: 'Tier is set by how many direct friends ever generated a payout node; commission on their wish volume:', invColPeople: 'Qualified friends', invColRate: 'Rate', invPeopleUnit: '',
    bbsTitle: 'Board (plain text, up to 1024 bytes)', bbsPlaceholder: 'Say something (max 1024 bytes)', bbsSend: 'Post', bbsEmpty: 'No posts yet. Be the first.',
    adminModeration: 'Moderation', addBlockedWord: 'Block word', wordPh: 'Add a blocked word', deletePost: 'Delete', banUser: 'Ban', unbanUser: 'Unban', bannedTag: 'BANNED', noBlocked: 'No blocked words',
    avail: 'Available', frozen: 'Held', withdraw: 'Withdraw (2-500, fee 1)', withdrawing: 'Processing…', flows: 'Transactions',
    wdOk: 'Withdrawal sent.', wdCheckReceive: 'Please check your wallet for the funds.', wdPending: 'Submitted, pending platform processing.',
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
    reply: 'Reply', sendReply: 'Send', replyPh: 'Write a reply (max 1024 bytes)', replies: 'replies', confirmDelPost: 'Delete this post and its replies?',
    flow_BET_FROZEN: 'Wish placed', flow_WIN_CREDIT: 'Win credited', flow_INS_WIN_CUT: 'Insured 10% to pool', flow_CANCEL_REFUND: 'Void refund',
    flow_REFERRAL: 'Referral reward', flow_PREMIUM_IN: 'Premium deposit', flow_NODE_PREMIUM_OUT: 'Node premium', flow_NODE_PAYOUT: 'Node payout', flow_NODE_FORFEIT: 'Lapsed to pool',
    flow_WITHDRAW_FEE: 'Withdraw fee', flow_WITHDRAW_PENDING: 'Withdraw', flow_WITHDRAW_PAID: 'Withdraw paid', flow_WITHDRAW_REFUND: 'Withdraw refunded',
    flow_FAUCET: 'Test claim', flow_CHAIN_DEPOSIT: 'On-chain deposit', flow_ISSUE: 'System credit',
  },
  'zh-TW': {
    appTitle: '三分鐘願望池', loginTip: '連接錢包即可開始，邀請連結自動綁定推薦關係', connectWallet: '連接錢包', demoEnter: '未裝錢包？以演示身份進入', logout: '退出',
    dockHome: '首頁', dockBbs: '廣場', dockIns: '保險', dockMe: '我的', disclaimerTitle: '免責聲明', disclaimerAgree: '我已閱讀並同意',
    remainSec: '剩餘秒數', lockAt: '150秒停止許願', betCount: '許願筆數', redPool: '紅願池', greenPool: '綠願池',
    oddWin: '選號總和為單 → 紅勝', evenWin: '選號總和為雙 → 綠勝', pickLabel: '選擇一個數字（0-9）',
    amountLabel: '許願金（1-99 枚，正整數）', confirmWish: '確認許願', waitingStart: '等待第一個願望進場…', historyTitle: '往期記錄',
    insTitle: '願望保險', insSwitch: '保險開關', premium: '保費餘額', lossAccum: '淨虧累計', depositPremium: '存入保費',
    insRule: '開關開且保費≥20枚才生效；生效贏家收益再扣10%入保池；淨虧每滿100枚生成一個賠付節點並扣20枚保費，節點分100期返還。',
  winCongrats: '🎉 恭喜許願成功，祝您天天發大財！',
  insLightOn: '保險生效中', insLightOff: '保險未生效（開關開且保費≥20枚才生效）',
  insStatusLabel: '保險狀態',
  insOnBar: '保險生效中', insOffBar: '保險關閉中',
    myNodes: '我的賠付節點', poolTotal: '保險池總資金', poolNext: '下次應釋放總額', poolNextAt: '下次釋放時刻', nextReleaseIn: '距下次釋放', poolActiveNodes: '待釋放節點',
    poolSufficient: '資金充足', poolShort: '資金缺口', poolCover: '覆蓋率',
    meWallet: '錢包', meInvite: '邀請返傭', copy: '複製', qualifiedInvitees: '達標好友', curRate: '返傭率', invTotal: '累計返傭',
    invTierTip: '名下有「生成過賠付節點」的直邀好友數決定檔位，按好友許願流水返傭：', invColPeople: '達標好友', invColRate: '返傭率', invPeopleUnit: '人',
    bbsTitle: '廣場（1024位元組以內純文字）', bbsPlaceholder: '說點什麼吧（最多1024位元組）', bbsSend: '發佈', bbsEmpty: '還沒有留言，來說第一句',
    adminModeration: '管理員治理', addBlockedWord: '加入屏蔽詞', wordPh: '輸入要屏蔽的詞', deletePost: '刪帖', banUser: '封號', unbanUser: '解封', bannedTag: '已封號', noBlocked: '暫無屏蔽詞',
    avail: '可用', frozen: '凍結', withdraw: '提現（單筆2-500，費1枚）', withdrawing: '處理中…', flows: '收支流水',
    wdOk: '提現已發送', wdCheckReceive: '請注意查收。', wdPending: '已提交，待平台處理。',
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
    reply: '回覆', sendReply: '送出', replyPh: '寫下回覆（最多1024位元組）', replies: '則回覆', confirmDelPost: '確定刪除該帖及其全部回覆？',
    flow_BET_FROZEN: '許願投入', flow_WIN_CREDIT: '中獎到帳', flow_INS_WIN_CUT: '保險贏家扣10%', flow_CANCEL_REFUND: '對局退款',
    flow_REFERRAL: '邀請返傭', flow_PREMIUM_IN: '存入保費', flow_NODE_PREMIUM_OUT: '節點扣保費', flow_NODE_PAYOUT: '節點賠付', flow_NODE_FORFEIT: '斷保當期充公',
    flow_WITHDRAW_FEE: '提現手續費', flow_WITHDRAW_PENDING: '提現', flow_WITHDRAW_PAID: '提現到帳', flow_WITHDRAW_REFUND: '提現退回',
    flow_FAUCET: '測試領幣', flow_CHAIN_DEPOSIT: '鏈上轉入', flow_ISSUE: '系統入帳',
  },
  ja: {
    appTitle: '3分間願い池', loginTip: 'ウォレット接続で開始。招待リンクで紹介者を自動登録します', connectWallet: 'ウォレット接続', demoEnter: 'ウォレットなし？デモで入る', logout: 'ログアウト',
    dockHome: 'ホーム', dockBbs: '広場', dockIns: '保険', dockMe: 'マイ', disclaimerTitle: '免責事項', disclaimerAgree: '読んで同意します',
    remainSec: '残り秒数', lockAt: '150秒で締切', betCount: '願い数', redPool: '赤の願い池', greenPool: '緑の願い池',
    oddWin: '合計が奇数 → 赤の勝ち', evenWin: '合計が偶数 → 緑の勝ち', pickLabel: '数字を選ぶ（0-9）',
    amountLabel: '願い金（1-99 枚、整数）', confirmWish: '願いを確定', waitingStart: '最初の願いを待っています…', historyTitle: '過去の記録',
    insTitle: '願い保険', insSwitch: '保険スイッチ', premium: '保険料残高', lossAccum: '純損失累計', depositPremium: '保険料を入れる',
    insRule: 'スイッチONかつ保険料≥20枚で有効。適用勝者は利益の10%を保険池へ。純損失100枚ごとに返還ノード生成（保険料20枚差引）、100期で返還。',
  winCongrats: '🎉 願いの投稿に成功しました！毎日たくさんの幸運が訪れますように！',
  insLightOn: '保険有効中', insLightOff: '保険無効（スイッチONかつ保険料20枚以上で有効）',
  insStatusLabel: '保険状態',
  insOnBar: '保険有効中', insOffBar: '保険OFF',
    myNodes: '私の返還ノード', poolTotal: '保険池の総額', poolNext: '次回解放予定額', poolNextAt: '次回解放時刻', nextReleaseIn: '次回まで', poolActiveNodes: '解放待ちノード',
    poolSufficient: '資金十分', poolShort: '不足額', poolCover: '充足率',
    meWallet: 'ウォレット', meInvite: '招待報酬', copy: 'コピー', qualifiedInvitees: '条件達成', curRate: 'レート', invTotal: '累計報酬',
    invTierTip: '返還ノードを生成した直招待人数で档位が決定、招待した人の投入額に応じて報酬：', invColPeople: '達成フレンド', invColRate: '報酬率', invPeopleUnit: '人',
    bbsTitle: '広場（1024バイト以内のテキスト）', bbsPlaceholder: 'ひとこと（最大1024バイト）', bbsSend: '投稿', bbsEmpty: 'まだ投稿はありません',
    adminModeration: 'モデレーション', addBlockedWord: 'NGワード追加', wordPh: 'NGワードを入力', deletePost: '削除', banUser: 'BAN', unbanUser: '解除', bannedTag: 'BAN済', noBlocked: 'NGワードなし',
    avail: '利用可能', frozen: '保留中', withdraw: '出金（2-500、手数料1枚）', withdrawing: '処理中…', flows: '取引履歴',
    wdOk: '送金しました。', wdCheckReceive: 'ウォレットへの着金をご確認ください。', wdPending: '送信済み。プラットフォーム処理待ち。',
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
    reply: '返信', sendReply: '送信', replyPh: '返信を書く（最大1024バイト）', replies: '件', confirmDelPost: 'この投稿と返信を削除しますか？',
    flow_BET_FROZEN: '願い投入', flow_WIN_CREDIT: '当選入金', flow_INS_WIN_CUT: '保険勝者10%', flow_CANCEL_REFUND: '不成立返金',
    flow_REFERRAL: '招待報酬', flow_PREMIUM_IN: '保険料投入', flow_NODE_PREMIUM_OUT: 'ノード保険料', flow_NODE_PAYOUT: 'ノード返還', flow_NODE_FORFEIT: '失効分を保険池へ',
    flow_WITHDRAW_FEE: '出金手数料', flow_WITHDRAW_PENDING: '出金', flow_WITHDRAW_PAID: '出金完了', flow_WITHDRAW_REFUND: '出金差戻し',
    flow_FAUCET: 'テスト受取', flow_CHAIN_DEPOSIT: 'オンチェーン入金', flow_ISSUE: 'システム入金',
  },
  ar: {
    appTitle: 'بركة الأمنيات لمدة ثلاث دقائق', loginTip: 'اتصل بالمحفظة للبدء. روابط الدعوة تربط المُحيل تلقائياً.', connectWallet: 'اتصال بالمحفظة', demoEnter: 'لا توجد محفظة؟ ادخل كزائر', logout: 'خروج',
    dockHome: 'الرئيسية', dockBbs: 'المنتدى', dockIns: 'التأمين', dockMe: 'حسابي', disclaimerTitle: 'إخلاء مسؤولية', disclaimerAgree: 'لقد قرأت وأوافق',
    remainSec: 'ثانية متبقية', lockAt: 'يُغلق عند 150 ثانية', betCount: 'الأمنيات', redPool: 'بركة الأحمر', greenPool: 'بركة الأخضر',
    oddWin: 'مجموع الأرقام فردي → يفوز الأحمر', evenWin: 'مجموع الأرقام زوجي → يفوز الأخضر', pickLabel: 'اختر رقماً (0-9)',
    amountLabel: 'مبلغ الأمنية (1-99 عملة، عدد صحيح)', confirmWish: 'تأكيد الأمنية', waitingStart: 'في انتظار أول أمنية…', historyTitle: 'الجولات السابقة',
    insTitle: 'تأمين الأمنية', insSwitch: 'التأمين', premium: 'رسم التأمين', lossAccum: 'صافي الخسارة', depositPremium: 'إيداع رسم التأمين',
    insRule: 'يسري فقط عند التشغيل ورسم تأمين ≥20 عملة. الفائزون المؤمّنون يدفعون 10% إلى البركة؛ كل 100 عملة خسارة صافية تفتح عقد تعويض (يكلف 20 عملة)، يُرد على 100 فترة.',
    winCongrats: '🎉 تم تقديم الأمنية بنجاح! نتمنى لك الثروة كل يوم!',
    insLightOn: 'التأمين ساري', insLightOff: 'التأمين غير ساري (شغّله واحتفظ بـ≥20 عملة رسم تأمين)',
    insStatusLabel: 'حالة التأمين',
    insOnBar: 'التأمين ساري', insOffBar: 'التأمين متوقف',
    myNodes: 'عقود التعويض الخاصة بي', poolTotal: 'إجمالي بركة التأمين', poolNext: 'إجمالي الإصدار القادم', poolNextAt: 'وقت الإصدار القادم', nextReleaseIn: 'القادم بعد', poolActiveNodes: 'العقود النشطة',
    poolSufficient: 'كافٍ', poolShort: 'عجز', poolCover: 'نسبة التغطية',
    meWallet: 'المحفظة', meInvite: 'الدعوة', copy: 'نسخ', qualifiedInvitees: 'المؤهلون', curRate: 'النسبة', invTotal: 'الإجمالي',
    invTierTip: 'تُحدد الشريدة بعدد الأصدقاء المباشرين الذين ولد لهم عقد تعويض؛ العمولة على حجم أمنياتهم:', invColPeople: 'أصدقاء مؤهلون', invColRate: 'النسبة', invPeopleUnit: '',
    bbsTitle: 'المنتدى (نص عادي، حتى 1024 بايت)', bbsPlaceholder: 'قل شيئاً (حد أقصى 1024 بايت)', bbsSend: 'نشر', bbsEmpty: 'لا توجد مشاركات بعد. كن الأول.',
    adminModeration: 'الإشراف', addBlockedWord: 'حظر كلمة', wordPh: 'أدخل كلمة للحظر', deletePost: 'حذف', banUser: 'حظر', unbanUser: 'رفع الحظر', bannedTag: 'محظور', noBlocked: 'لا توجد كلمات محظورة',
    avail: 'متاح', frozen: 'محتجز', withdraw: 'سحب (2-500، رسوم 1)', withdrawing: 'جارٍ المعالجة…', flows: 'المعاملات',
    wdOk: 'تم إرسال السحب.', wdCheckReceive: 'يرجى التحقق من محفظتك للحصول على الأموال.', wdPending: 'تم الإرسال، بانتظار معالجة المنصة.',
    premiumWithdraw: 'رسم التأمين → الرصيد (التأمين متوقف)', premiumOutPh: 'اتركه فارغاً = سحب الكل', premiumNeed: 'أدخل مبلغاً صحيحاً موجباً',
    chainOn: 'على السلسلة: الرصيد أولاً، والجزء الناقص يُدفع من محفظتك.', chainOff: 'وضع الرصيد خارج السلسلة (لم يتم تكوين رمز مميز).', chainPending: 'تم الإرسال، بانتظار التأكيد…', pendingLock: 'المعاملة السابقة لا تزال قيد التأكيد على السلسلة. انتظر ثوانٍ — لا تُرسل مرة أخرى؛ سيُضاف تلقائياً.', walletChanged: 'المحفظة النشطة تختلف عن الحساب المسجل. اخرج وأعد الاتصال بنفس المحفظة.',
    pendingTitle: 'مدفوعات السلسلة قيد الانتظار', pendingVerify: 'تحقق وأضف الآن', chainWillCredit: 'تم الدفع على السلسلة. يُضاف تلقائياً بعد التأكيد؛ يمكنك أيضاً الضغط على تحقق ضمن حسابي.', chainCreditedRedo: 'تمت إضافة الدفع على السلسلة إلى الرصيد، يرجى إعادة تقديم الأمنية.',
    manualCredit: 'إضافة بالهاش', manualTxPh: 'الصق هاش 0x… للإضافة', manualOk: 'أُضيف إلى الرصيد', manualAlready: 'تمت إضافة هذه المعاملة سابقاً', manualBadHash: 'هاش معاملة غير صالح',
    stateActive: 'مباشر', stateLocked: 'مغلق', stateSettled: 'مُحسم', stateCancelled: 'باطل (فارغ)، تم الاسترداد', winRed: 'أحمر', winGreen: 'أخضر',
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
    appTitle: 'Kumpulan Keinginan 3 Menit', loginTip: 'Hubungkan dompet untuk memulai. Tautan undangan mengikat perujuk secara otomatis.', connectWallet: 'Hubungkan Dompet', demoEnter: 'Tidak ada dompet? Masuk sebagai demo', logout: 'Keluar',
    dockHome: 'Beranda', dockBbs: 'Forum', dockIns: 'Asuransi', dockMe: 'Saya', disclaimerTitle: 'Disclaimer', disclaimerAgree: 'Saya telah membaca dan setuju',
    remainSec: 'detik tersisa', lockAt: 'tutup pada 150 detik', betCount: 'Keinginan', redPool: 'Kolam Merah', greenPool: 'Kolam Hijau',
    oddWin: 'Jumlah angka ganjil → Merah menang', evenWin: 'Jumlah angka genap → Hijau menang', pickLabel: 'Pilih angka (0-9)',
    amountLabel: 'Jumlah keinginan (1-99 koin, bilangan bulat)', confirmWish: 'Konfirmasi Keinginan', waitingStart: 'Menunggu keinginan pertama…', historyTitle: 'Riwayat ronde',
    insTitle: 'Asuransi Keinginan', insSwitch: 'Asuransi', premium: 'Premi', lossAccum: 'Kerugian bersih', depositPremium: 'Setor premi',
    insRule: 'Berlaku hanya saat aktif dan premi ≥20 koin. Pemenang yang diasuransikan menyumbang 10% ke kolam; setiap 100 koin kerugian bersih membuka node kompensasi (biaya 20 koin), dikembalikan selama 100 periode.',
    winCongrats: '🎉 Keinginan berhasil dikirim! Semoga rezeki melimpah setiap hari!',
    insLightOn: 'Asuransi aktif', insLightOff: 'Asuransi nonaktif (aktifkan dan simpan ≥20 koin premi)',
    insStatusLabel: 'Status asuransi',
    insOnBar: 'Asuransi aktif', insOffBar: 'Asuransi nonaktif',
    myNodes: 'Node kompensasi saya', poolTotal: 'Total kolam asuransi', poolNext: 'Total rilis berikutnya', poolNextAt: 'Waktu rilis berikutnya', nextReleaseIn: 'Berikutnya dalam', poolActiveNodes: 'Node aktif',
    poolSufficient: 'Cukup', poolShort: 'Kekurangan', poolCover: 'Cakupan',
    meWallet: 'Dompet', meInvite: 'Undangan', copy: 'Salin', qualifiedInvitees: 'Memenuhi syarat', curRate: 'Rate', invTotal: 'Total',
    invTierTip: 'Tier ditentukan oleh jumlah teman langsung yang pernah menghasilkan node kompensasi; komisi atas volume keinginan mereka:', invColPeople: 'Teman memenuhi syarat', invColRate: 'Rate', invPeopleUnit: 'orang',
    bbsTitle: 'Forum (teks biasa, hingga 1024 byte)', bbsPlaceholder: 'Katakan sesuatu (maks 1024 byte)', bbsSend: 'Kirim', bbsEmpty: 'Belum ada kiriman. Jadilah yang pertama.',
    adminModeration: 'Moderasi', addBlockedWord: 'Blokir kata', wordPh: 'Masukkan kata yang diblokir', deletePost: 'Hapus', banUser: 'Blokir', unbanUser: 'Buka blokir', bannedTag: 'DIBLOKIR', noBlocked: 'Tidak ada kata diblokir',
    avail: 'Tersedia', frozen: 'Ditahan', withdraw: 'Tarik (2-500, biaya 1)', withdrawing: 'Memproses…', flows: 'Transaksi',
    wdOk: 'Penarikan dikirim.', wdCheckReceive: 'Silakan cek dompet Anda untuk dana.', wdPending: 'Terkirim, menunggu pemrosesan platform.',
    premiumWithdraw: 'Premi → saldo (asuransi NONAKTIF)', premiumOutPh: 'Kosong = tarik semua', premiumNeed: 'Masukkan jumlah bilangan bulat positif',
    chainOn: 'On-chain: utamakan saldo, kekurangan dibayar dari dompet Anda.', chainOff: 'Mode saldo off-chain (token belum dikonfigurasi).', chainPending: 'Terkirim, menunggu konfirmasi…', pendingLock: 'Transaksi sebelumnya masih dikonfirmasi di on-chain. Tunggu beberapa detik — JANGAN kirim lagi; akan dikreditkan otomatis.', walletChanged: 'Dompet aktif berbeda dengan akun yang masuk. Keluar dan sambungkan kembali dompet yang sama.',
    pendingTitle: 'Pembayaran on-chain tertunda', pendingVerify: 'Verifikasi & kredit sekarang', chainWillCredit: 'Dibayar on-chain. Dikreditkan otomatis setelah dikonfirmasi; Anda juga bisa ketuk Verifikasi di Saya.', chainCreditedRedo: 'Pembayaran on-chain telah dikreditkan ke saldo, silakan ajukan keinginan lagi.',
    manualCredit: 'Kredit via hash', manualTxPh: 'Tempel hash 0x… untuk dikreditkan', manualOk: 'Dikreditkan ke saldo', manualAlready: 'Transaksi ini sudah dikreditkan', manualBadHash: 'Hash transaksi tidak valid',
    stateActive: 'Berlangsung', stateLocked: 'Tertutup', stateSettled: 'Selesai', stateCancelled: 'Batal (kosong), dikembalikan', winRed: 'Merah', winGreen: 'Hijau',
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
    appTitle: '3분 소원 풀', loginTip: '지갑을 연결하면 시작됩니다. 초대 링크로 추천인이 자동 연결됩니다.', connectWallet: '지갑 연결', demoEnter: '지갑 없음? 데모로 입장', logout: '로그아웃',
    dockHome: '홈', dockBbs: '게시판', dockIns: '보험', dockMe: '나의', disclaimerTitle: '면책 조항', disclaimerAgree: '읽었으며 동의합니다',
    remainSec: '초 남음', lockAt: '150초에 마감', betCount: '소원', redPool: '레드 풀', greenPool: '그린 풀',
    oddWin: '숫자 합이 홀수 → 레드 승', evenWin: '숫자 합이 짝수 → 그린 승', pickLabel: '숫자 선택 (0-9)',
    amountLabel: '소원 금액 (1-99 코인, 정수)', confirmWish: '소원 확정', waitingStart: '첫 소원을 기다리는 중…', historyTitle: '지난 라운드',
    insTitle: '소원 보험', insSwitch: '보험', premium: '보험료', lossAccum: '순손실', depositPremium: '보험료 입금',
    insRule: '스위치 ON이고 보험료 ≥20 코인일 때만 적용. 보험 가입 당첨자는 수익의 10%를 풀에 납부; 순손실 100코인마다 보상 노드 생성(보험료 20코인 차감), 100기간에 걸쳐 반환.',
    winCongrats: '🎉 소원이 성공적으로 접수되었습니다! 매일 큰 재물운이 있기를!',
    insLightOn: '보험 적용 중', insLightOff: '보험 미적용 (스위치 ON, 보험료 ≥20 코인 유지)',
    insStatusLabel: '보험 상태',
    insOnBar: '보험 적용 중', insOffBar: '보험 꺼짐',
    myNodes: '나의 보상 노드', poolTotal: '보험 풀 총액', poolNext: '다음 지급 총액', poolNextAt: '다음 지급 시각', nextReleaseIn: '다음까지', poolActiveNodes: '활성 노드',
    poolSufficient: '충분', poolShort: '부족', poolCover: '커버율',
    meWallet: '지갑', meInvite: '초대', copy: '복사', qualifiedInvitees: '조건 달성', curRate: '비율', invTotal: '누적',
    invTierTip: '보상 노드를 생성한 직접 초대 친구 수로 등급이 결정되며, 친구의 소원 금액에 따라 수수료 지급:', invColPeople: '달성 친구', invColRate: '수수료율', invPeopleUnit: '명',
    bbsTitle: '게시판 (순수 텍스트, 최대 1024바이트)', bbsPlaceholder: '하고 싶은 말 (최대 1024바이트)', bbsSend: '게시', bbsEmpty: '아직 게시글이 없습니다. 첫 글을 남겨보세요.',
    adminModeration: '관리', addBlockedWord: '단어 차단', wordPh: '차단할 단어 입력', deletePost: '삭제', banUser: '차단', unbanUser: '차단 해제', bannedTag: '차단됨', noBlocked: '차단된 단어 없음',
    avail: '사용 가능', frozen: '보류', withdraw: '출금 (2-500, 수수료 1)', withdrawing: '처리 중…', flows: '거래 내역',
    wdOk: '출금이 전송되었습니다.', wdCheckReceive: '지갑에서 입금을 확인해 주세요.', wdPending: '접수되었습니다. 플랫폼 처리 대기 중.',
    premiumWithdraw: '보험료 → 잔액 (보험 OFF 시)', premiumOutPh: '비우면 전액 출금', premiumNeed: '양의 정수 금액을 입력하세요',
    chainOn: '온체인: 잔액 우선, 부족분은 지갑에서 지불.', chainOff: '오프체인 잔액 모드 (토큰 미설정).', chainPending: '전송됨, 확인 대기 중…', pendingLock: '직전 거래가 아직 온체인 확인 중입니다. 몇 초 기다리세요 — 다시 제출하지 마세요. 자동 입금됩니다.', walletChanged: '활성 지갑이 로그인 계정과 다릅니다. 로그아웃 후 같은 지갑을 다시 연결하세요.',
    pendingTitle: '대기 중인 온체인 결제', pendingVerify: '지금 확인 및 입금', chainWillCredit: '온체인에서 결제되었습니다. 확인 후 자동 입금되며, 나의 메뉴에서 직접 확인할 수도 있습니다.', chainCreditedRedo: '온체인 결제가 잔액에 입금되었습니다. 다시 소원을 접수해 주세요.',
    manualCredit: '해시로 입금', manualTxPh: '0x… 트랜잭션 해시를 붙여 입금', manualOk: '잔액에 입금됨', manualAlready: '이 거래는 이미 입금됨', manualBadHash: '잘못된 트랜잭션 해시',
    stateActive: '진행 중', stateLocked: '마감', stateSettled: '정산 완료', stateCancelled: '무효 (빈 라운드), 환불됨', winRed: '레드', winGreen: '그린',
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
    appTitle: 'Колода желаний на 3 минуты', loginTip: 'Подключите кошелёк, чтобы начать. Пригласительные ссылки автоматически привязывают реферера.', connectWallet: 'Подключить кошелёк', demoEnter: 'Нет кошелька? Войти как демо', logout: 'Выход',
    dockHome: 'Главная', dockBbs: 'Форум', dockIns: 'Страховка', dockMe: 'Профиль', disclaimerTitle: 'Отказ от ответственности', disclaimerAgree: 'Я прочитал и согласен',
    remainSec: 'секунд осталось', lockAt: 'закрывается на 150-й секунде', betCount: 'Желаний', redPool: 'Красный пул', greenPool: 'Зелёный пул',
    oddWin: 'Сумма чисел нечётная → победа красных', evenWin: 'Сумма чисел чётная → победа зелёных', pickLabel: 'Выберите число (0-9)',
    amountLabel: 'Сумма желания (1-99 монет, целое)', confirmWish: 'Подтвердить желание', waitingStart: 'Ожидание первого желания…', historyTitle: 'Прошлые раунды',
    insTitle: 'Страховка желаний', insSwitch: 'Страховка', premium: 'Страховая премия', lossAccum: 'Чистый убыток', depositPremium: 'Внести премию',
    insRule: 'Действует только при включении и премии ≥20 монет. Застрахованные победители отдают 10% в пул; каждые 100 монет чистого убытка открывают узел выплат (стоит 20 монет), возвращается за 100 периодов.',
    winCongrats: '🎉 Желание успешно отправлено! Желаю богатства каждый день!',
    insLightOn: 'Страховка активна', insLightOff: 'Страховка неактивна (включите и храните ≥20 монет премии)',
    insStatusLabel: 'Статус страховки',
    insOnBar: 'Страховка активна', insOffBar: 'Страховка выключена',
    myNodes: 'Мои узлы выплат', poolTotal: 'Общая сумма страхового пула', poolNext: 'Общая сумма следующего выпуска', poolNextAt: 'Время следующего выпуска', nextReleaseIn: 'Следующий через', poolActiveNodes: 'Активные узлы',
    poolSufficient: 'Достаточно', poolShort: 'Недостаток', poolCover: 'Покрытие',
    meWallet: 'Кошелёк', meInvite: 'Приглашения', copy: 'Копировать', qualifiedInvitees: 'Квалифицированные', curRate: 'Ставка', invTotal: 'Всего',
    invTierTip: 'Уровень определяется числом прямых друзей, создавших узел выплат; комиссия с объёма их желаний:', invColPeople: 'Квалифицированные друзья', invColRate: 'Ставка', invPeopleUnit: '',
    bbsTitle: 'Форум (простой текст, до 1024 байт)', bbsPlaceholder: 'Напишите что-нибудь (макс. 1024 байт)', bbsSend: 'Опубликовать', bbsEmpty: 'Пока нет сообщений. Будьте первым.',
    adminModeration: 'Модерация', addBlockedWord: 'Заблокировать слово', wordPh: 'Введите слово для блокировки', deletePost: 'Удалить', banUser: 'Забанить', unbanUser: 'Разбанить', bannedTag: 'ЗАБАНЕН', noBlocked: 'Нет заблокированных слов',
    avail: 'Доступно', frozen: 'Заморожено', withdraw: 'Вывод (2-500, комиссия 1)', withdrawing: 'Обработка…', flows: 'Транзакции',
    wdOk: 'Вывод отправлен.', wdCheckReceive: 'Проверьте кошелёк — средства должны поступить.', wdPending: 'Отправлено, ожидает обработки платформой.',
    premiumWithdraw: 'Премия → баланс (страховка ВЫКЛ)', premiumOutPh: 'Пусто = вывести всё', premiumNeed: 'Введите положительное целое число',
    chainOn: 'В сети: сначала баланс, недостаток оплачивается из кошелька.', chainOff: 'Режим внутрисетевого баланса (токен не настроен).', chainPending: 'Отправлено, ожидание подтверждения…', pendingLock: 'Предыдущая транзакция ещё подтверждается в сети. Подождите несколько секунд — НЕ отправляйте снова; зачислится автоматически.', walletChanged: 'Активный кошелёк отличается от вошедшего аккаунта. Выйдите и подключите тот же кошелёк заново.',
    pendingTitle: 'Ожидающие сетевые платежи', pendingVerify: 'Проверить и зачислить сейчас', chainWillCredit: 'Оплачено в сети. Зачислится автоматически после подтверждения; можно также нажать «Проверить» в профиле.', chainCreditedRedo: 'Сетевой платёж зачислен на баланс, отправьте желание заново.',
    manualCredit: 'Зачислить по хешу', manualTxPh: 'Вставьте хеш 0x… для зачисления', manualOk: 'Зачислено на баланс', manualAlready: 'Эта транзакция уже зачислена', manualBadHash: 'Неверный хеш транзакции',
    stateActive: 'Идёт', stateLocked: 'Закрыт', stateSettled: 'Разыгран', stateCancelled: 'Отменён (пустой), возвращено', winRed: 'Красные', winGreen: 'Зелёные',
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
    appTitle: '3 मिनट विश पूल', loginTip: 'शुरू करने के लिए वॉलेट कनेक्ट करें. आमंत्रण लिंक स्वचालित रूप से रेफ़रर को बाँधते हैं.', connectWallet: 'वॉलेट कनेक्ट करें', demoEnter: 'वॉलेट नहीं है? डेमो के रूप में प्रवेश करें', logout: 'लॉग आउट',
    dockHome: 'होम', dockBbs: 'बोर्ड', dockIns: 'बीमा', dockMe: 'मेरा', disclaimerTitle: 'अस्वीकरण', disclaimerAgree: 'मैंने पढ़ लिया और सहमत हूं',
    remainSec: 'सेकंड शेष', lockAt: '150 सेकंड पर बंद', betCount: 'विशें', redPool: 'लाल पूल', greenPool: 'हरा पूल',
    oddWin: 'अंकों का योग विषम → लाल जीतता है', evenWin: 'अंकों का योग सम → हरा जीतता है', pickLabel: 'अंक चुनें (0-9)',
    amountLabel: 'विश राशि (1-99 सिक्के, पूर्णांक)', confirmWish: 'विश की पुष्टि करें', waitingStart: 'पहले विश की प्रतीक्षा में…', historyTitle: 'पिछले राउंड',
    insTitle: 'विश बीमा', insSwitch: 'बीमा', premium: 'प्रीमियम', lossAccum: 'शुद्ध नुकसान', depositPremium: 'प्रीमियम जमा करें',
    insRule: 'केवल चालू और प्रीमियम ≥20 सिक्के पर लागू. बीमायुक्त विजेता पूल में 10% देते हैं; हर 100 सिक्के शुद्ध नुकसान पर भुगतान नोड खुलता है (20 सिक्के का खर्च), 100 अवधियों में वापस.',
    winCongrats: '🎉 विश सफलतापूर्वक सबमिट हुआ! आपको हर दिन बड़ी संपत्ति मिले!',
    insLightOn: 'बीमा सक्रिय', insLightOff: 'बीमा निष्क्रिय (चालू करें और ≥20 सिक्के प्रीमियम रखें)',
    insStatusLabel: 'बीमा स्थिति',
    insOnBar: 'बीमा सक्रिय', insOffBar: 'बीमा बंद',
    myNodes: 'मेरे भुगतान नोड', poolTotal: 'बीमा पूल कुल', poolNext: 'अगली रिलीज़ कुल', poolNextAt: 'अगली रिलीज़ का समय', nextReleaseIn: 'अगली में', poolActiveNodes: 'सक्रिय नोड',
    poolSufficient: 'पर्याप्त', poolShort: 'कमी', poolCover: 'कवरेज',
    meWallet: 'वॉलेट', meInvite: 'निमंत्रण', copy: 'कॉपी', qualifiedInvitees: 'योग्य', curRate: 'दर', invTotal: 'कुल',
    invTierTip: 'स्तर भुगतान नोड बनाने वाले सीधे दोस्तों की संख्या से तय होता है; उनके विश मात्रा पर कमीशन:', invColPeople: 'योग्य दोस्त', invColRate: 'दर', invPeopleUnit: '',
    bbsTitle: 'बोर्ड (सादा पाठ, 1024 बाइट तक)', bbsPlaceholder: 'कुछ लिखें (अधिकतम 1024 बाइट)', bbsSend: 'पोस्ट', bbsEmpty: 'अभी कोई पोस्ट नहीं. पहले बनें.',
    adminModeration: 'मॉडरेशन', addBlockedWord: 'शब्द ब्लॉक करें', wordPh: 'ब्लॉक करने के लिए शब्द दर्ज करें', deletePost: 'हटाएँ', banUser: 'बैन', unbanUser: 'अनबैन', bannedTag: 'बैन्ड', noBlocked: 'कोई ब्लॉक शब्द नहीं',
    avail: 'उपलब्ध', frozen: 'रोका गया', withdraw: 'निकासी (2-500, शुल्क 1)', withdrawing: 'प्रोसेसिंग…', flows: 'लेनदेन',
    wdOk: 'निकासी भेजी गई.', wdCheckReceive: 'कृपया धन के लिए अपना वॉलेट देखें.', wdPending: 'सबमिट हुआ, प्लेटफ़ॉर्म प्रोसेसिंग की प्रतीक्षा में.',
    premiumWithdraw: 'प्रीमियम → बैलेंस (बीमा बंद)', premiumOutPh: 'खाली = सब निकालें', premiumNeed: 'धनात्मक पूर्णांक राशि दर्ज करें',
    chainOn: 'ऑन-चेन: पहले बैलेंस, कमी वॉलेट से भुगतान.', chainOff: 'ऑफ-चेन बैलेंस मोड (टोकन कॉन्फ़िगर नहीं).', chainPending: 'भेजा गया, पुष्टि की प्रतीक्षा में…', pendingLock: 'पिछला ट्रांज़ैक्शन अभी ऑन-चेन पुष्टि हो रहा है. कुछ सेकंड प्रतीक्षा करें — फिर से सबमिट न करें; स्वचालित जमा होगा.', walletChanged: 'सक्रिय वॉलेट लॉगिन खाते से भिन्न है. लॉग आउट करें और उसी वॉलेट को फिर कनेक्ट करें.',
    pendingTitle: 'लंबित ऑन-चेन भुगतान', pendingVerify: 'अभी सत्यापित करें और जमा करें', chainWillCredit: 'ऑन-चेन भुगतान हो गया. पुष्टि के बाद स्वचालित जमा होगा; आप मेरा में सत्यापन भी टैप कर सकते हैं.', chainCreditedRedo: 'ऑन-चेन भुगतान बैलेंस में जमा हो गया, कृपया फिर से विश सबमिट करें.',
    manualCredit: 'हैश से जमा', manualTxPh: 'जमा के लिए 0x… हैश पेस्ट करें', manualOk: 'बैलेंस में जमा हुआ', manualAlready: 'यह ट्रांज़ैक्शन पहले ही जमा हो चुका है', manualBadHash: 'अमान्य ट्रांज़ैक्शन हैश',
    stateActive: 'चालू', stateLocked: 'बंद', stateSettled: 'निपटा', stateCancelled: 'रद्द (खाली), वापस', winRed: 'लाल', winGreen: 'हरा',
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
    appTitle: 'تین منٹ کی خواہش پول', loginTip: 'شروع کرنے کے لیے والیٹ منسلک کریں. دعوتی لنکس خود بخود ریفرر کو جوڑ دیتے ہیں.', connectWallet: 'والیٹ منسلک کریں', demoEnter: 'والیٹ نہیں؟ ڈیمو کے طور پر داخل ہوں', logout: 'لاگ آؤٹ',
    dockHome: 'ہوم', dockBbs: 'بورڈ', dockIns: 'انشورنس', dockMe: 'میرا', disclaimerTitle: 'عدم ضمانت', disclaimerAgree: 'میں نے پڑھ لیا اور اتفاق کرتا ہوں',
    remainSec: 'سیکنڈ باقی', lockAt: '150 سیکنڈ پر بند', betCount: 'خواہشیں', redPool: 'سرخ پول', greenPool: 'سبز پول',
    oddWin: 'اعداد کا مجموعہ طاق → سرخ جیتتا ہے', evenWin: 'اعداد کا مجموعہ زوج → سبز جیتتا ہے', pickLabel: 'عدد منتخب کریں (0-9)',
    amountLabel: 'خواہش کی رقم (1-99 سکے، عدد صحیح)', confirmWish: 'خواہش کی تصدیق کریں', waitingStart: 'پہلی خواہش کا انتظار…', historyTitle: 'پچھلے راؤنڈ',
    insTitle: 'خواہش انشورنس', insSwitch: 'انشورنس', premium: 'پریمیم', lossAccum: 'خالص نقصان', depositPremium: 'پریمیم جمع کروائیں',
    insRule: 'صرف آن اور پریمیم ≥20 سکے پر نافذ. بیمہ شدہ جیتنے والے پول میں 10% دیتے ہیں; ہر 100 سکے خالص نقصان پر ادائیگی نوڈ کھلتا ہے (لاگت 20 سکے)، 100 ادوار میں واپس.',
    winCongrats: '🎉 خواہش کامیابی سے جمع ہو گئی! آپ کو ہر روز بڑی دولت نصیب ہو!',
    insLightOn: 'انشورنس فعال', insLightOff: 'انشورنس غیر فعال (آن کریں اور ≥20 سکے پریمیم رکھیں)',
    insStatusLabel: 'انشورنس کی حالت',
    insOnBar: 'انشورنس فعال ہے', insOffBar: 'انشورنس بند ہے',
    myNodes: 'میرے ادائیگی نوڈ', poolTotal: 'انشورنس پول کل', poolNext: 'اگلی ریلیز کل', poolNextAt: 'اگلی ریلیز کا وقت', nextReleaseIn: 'اگلی میں', poolActiveNodes: 'فعال نوڈ',
    poolSufficient: 'کافی', poolShort: 'کمی', poolCover: 'کوریج',
    meWallet: 'والیٹ', meInvite: 'دعوت', copy: 'کاپی', qualifiedInvitees: 'اہل', curRate: 'شرح', invTotal: 'کل',
    invTierTip: 'درجہ براہ راست دوستوں کی تعداد سے طے ہوتا ہے جنہوں نے ادائیگی نوڈ بنایا; ان کی خواہش کی رقم پر کمیشن:', invColPeople: 'اہل دوست', invColRate: 'شرح', invPeopleUnit: '',
    bbsTitle: 'بورڈ (سادہ متن، 1024 بائٹ تک)', bbsPlaceholder: 'کچھ لکھیں (زیادہ سے زیادہ 1024 بائٹ)', bbsSend: 'پوسٹ', bbsEmpty: 'ابھی کوئی پوسٹ نہیں. پہلے بنیں.',
    adminModeration: 'ماڈریشن', addBlockedWord: 'لفظ بلاک کریں', wordPh: 'بلاک کرنے کے لیے لفظ درج کریں', deletePost: 'حذف کریں', banUser: 'بین', unbanUser: 'ان بین', bannedTag: 'بین شدہ', noBlocked: 'کوئی بلاک شدہ لفظ نہیں',
    avail: 'دستیاب', frozen: 'روکا گیا', withdraw: 'نکاسی (2-500، فیس 1)', withdrawing: 'پروسیسنگ…', flows: 'لین دین',
    wdOk: 'نکاسی بھیج دی گئی.', wdCheckReceive: 'رقم کے لیے اپنا والیٹ چیک کریں.', wdPending: 'جمع ہو گیا، پلیٹ فارم پروسیسنگ کا انتظار.',
    premiumWithdraw: 'پریمیم → بیلنس (انشورنس آف)', premiumOutPh: 'خالی = سب نکالیں', premiumNeed: 'مثبت عدد صحیح رقم درج کریں',
    chainOn: 'آن چین: پہلے بیلنس، کمی والیٹ سے ادا.', chainOff: 'آف چین بیلنس موڈ (ٹوکن کنفیگر نہیں).', chainPending: 'بھیجا گیا، تصدیق کا انتظار…', pendingLock: 'پچھلا ٹرانزیکشن ابھی آن چین پر تصدیق ہو رہا ہے. چند سیکنڈ انتظار کریں — دوبارہ جمع نہ کریں; خود بخود جمع ہو جائے گا.', walletChanged: 'فعال والیٹ لاگ اکاؤنٹ سے مختلف ہے. لاگ آؤٹ کر کے اسی والیٹ کو دوبارہ منسلک کریں.',
    pendingTitle: 'زیر التزام آن چین ادائیگیاں', pendingVerify: 'ابھی تصدیق کریں اور جمع کروائیں', chainWillCredit: 'آن چین ادائیگی ہو گئی. تصدیق کے بعد خود بخود جمع ہو جائے گی; آپ میرا میں تصدیق بھی ٹیپ کر سکتے ہیں.', chainCreditedRedo: 'آن چین ادائیگی بیلنس میں جمع ہو گئی، براہ کرم دوبارہ خواہش جمع کروائیں.',
    manualCredit: 'ہیش سے جمع', manualTxPh: 'جمع کرنے کے لیے 0x… ہیش پیسٹ کریں', manualOk: 'بیلنس میں جمع ہو گیا', manualAlready: 'یہ ٹرانزیکشن پہلے ہی جمع ہو چکی ہے', manualBadHash: 'غلط ٹرانزیکشن ہیش',
    stateActive: 'جاری', stateLocked: 'بند', stateSettled: 'فیصلہ شدہ', stateCancelled: 'منسوخ (خالی)، واپس', winRed: 'سرخ', winGreen: 'سبز',
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

// ---------------- 免责声明 ----------------
const DISCLAIMER_VERSION = 1;
function checkDisclaimer() {
  if (!state.uid) return;
  if (localStorage.getItem('disclaimerAgreed') !== String(DISCLAIMER_VERSION)) {
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
  if (name === 'me' && state.uid) { renderPending(); creditPending(); api('/withdraw/reap', { uid: state.uid }).then(refresh).catch(() => {}); }
}

// ---------------- 左右划动切换 dock ----------------
const DOCK_ORDER = ['home', 'bbs', 'insurance', 'me'];
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
  // 触摸事件（手机/TP钱包等WebView）
  document.addEventListener('touchstart', (e) => swipeStart(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener('touchend', (e) => swipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY), { passive: true });
  // 鼠标事件（仅桌面，pointerType=mouse，避免和touch重复）
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') swipeStart(e.clientX, e.clientY, e.target); }, { passive: true });
  document.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') swipeEnd(e.clientX, e.clientY); }, { passive: true });
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
  const side = state.side, pick = state.pick, btn = $('betBtn');
  const S6 = 1_000_000;
  try {
    btn.disabled = true;
    await alignWallet(); const uid = state.uid; // 动钱前强制对齐当前激活钱包，杜绝 A 账号下注/B 钱包出钱的串号
    // 第一优先：纯站内下注，由后端实时余额判定——够就直接成功，绝不碰外部钱包（避免前端快照过期误扣）
    try {
      await api('/bet', { uid, side, amount, pick });
      $('amountInput').value = ''; await refresh(); wishOkToast(); return;
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
  // 保险状态横长条：开关开 且 保费≥20枚 → 绿色「保险生效中」，否则灰色「保险关闭中」
  const insActive = !!me.user.insSwitch && Number(a.premium) >= 20;
  const insBar = $('insStatusBar');
  if (insBar) { insBar.classList.toggle('on', insActive); insBar.classList.toggle('off', !insActive); insBar.textContent = insActive ? t('insOnBar') : t('insOffBar'); }
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
  if (byteLen(content) < 1 || byteLen(content) > BBS_MAX_BYTES) return;
  await api('/bbs/post', { uid: state.uid, content });
  $('bbsInput').value = ''; $('bbsChar').textContent = '0/' + BBS_MAX_BYTES; await loadBbs();
}

// ---------------- 动作 ----------------
async function switchIns() { await alignWallet(); const me = state.me; await api('/insurance/switch', { uid: state.uid, on: !me.user.insSwitch }); refresh(); }

// 保费存入：先纯站内（后端实时余额判定），仅当后端明确余额不足才用外部钱包补差
async function depositPremium() {
  const amount = Number($('premiumInput').value);
  const msg = $('premiumMsg'); msg.className = 'msg'; msg.textContent = '';
  if (!Number.isInteger(amount) || amount <= 0) { msg.textContent = t('premiumNeed'); return; }
  if (livePending().length) { msg.textContent = t('pendingLock'); return; } // 上一笔链上未确认，禁止重复存保费
  const btn = $('premiumBtn'), S6 = 1_000_000;
  try {
    btn.disabled = true;
    await alignWallet(); // 动钱前对齐当前激活钱包
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
    await alignWallet(); // 动钱前对齐当前激活钱包，防止提到/扣到错误账号
    const r = await api('/withdraw', { uid: state.uid, amount: v });
    if (r.paid === true) alert(t('wdOk') + '\n' + t('wdCheckReceive') + (r.txHash ? '\n' + r.txHash : ''));
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

// 押注成功祝贺：确认许愿成功（站内立即成功 / 链上补差确认入账）后弹一次
function wishOkToast() { setTimeout(() => alert(t('winCongrats')), 150); }
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
  $('connectBtn').onclick = connectWallet; $('demoBtn').onclick = demoEnter;
  $('sideRed').onclick = () => selectSide('red'); $('sideGreen').onclick = () => selectSide('green');
  $('betBtn').onclick = submitWish;
  $('selfCheckBtn').onclick = walletSelfCheck;
  document.querySelectorAll('.dock-item').forEach((d) => d.onclick = () => switchDock(d.dataset.dock));
  bindSwipe();
  $('disclaimerConfirm').onclick = confirmDisclaimer;
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
  $('bbsInput').oninput = () => { $('bbsChar').textContent = byteLen($('bbsInput').value) + '/' + BBS_MAX_BYTES; };
  selectSide('red');
  bindWalletEvents();
  (async () => {
    // 有钱包插件：以「当前激活账户」为准（切换过钱包也能直接登对账号）；无插件才回退本地缓存（演示）
    const active = await activeWalletAddr().catch(() => null);
    const addr = active || localStorage.getItem('wallet');
    if (!addr) return;
    try { await doLogin(addr); }
    catch { localStorage.removeItem('uid'); localStorage.removeItem('wallet'); }
  })();
}
const FE_BUILD = '2.3.2';
{ const el = document.getElementById('feBuild'); if (el) el.textContent = 'Ver.' + FE_BUILD; }
init();
