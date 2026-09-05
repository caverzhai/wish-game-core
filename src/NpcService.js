// =============================================================
// NpcService.js - Automated NPC bots: social posts + chat messages + random betting
// NPCs are regular users, no special treatment. Fixed 1 coin bets, no insurance.
// Each NPC speaks one fixed language, bets every 30-60 min independently.
// =============================================================
import { SCALE } from './money.js';

const nowSec = () => Math.floor(Date.now() / 1000);
const COIN = BigInt(SCALE); // 1 coin in inner units
const NPC_START_BALANCE = 100n * COIN; // 100 coins initial
const BET_AMOUNT = 1n * COIN; // always bet 1 coin

const LANGUAGES = ['en', 'zh-TW', 'ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];

// Content pools per language (same as before)
const CONTENT_BY_LANG = {
  en: [
    "How to play: Choose Red Pool or Green Pool, deposit 1-99 coins, pick a number 0-9. If the sum of all numbers is odd, Red wins; if even, Green wins. 2.5% fee deducted, winners split by stake ratio.",
    "Insurance guide: Deposit at least 20 coins and turn on insurance. If you win, 10% of your profit goes to the insurance pool. If you lose and accumulate 100 coins in losses, a payout node is created and returned over 100 periods.",
    "Referral rewards: Share your invite link. Friends who register via your link become your downline. Regular users earn 0.1% on direct referrals. Whitelist team leaders can earn higher rates with multi-level commissions.",
    "Withdrawal info: Winnings go directly to your balance. Withdraw anytime, 2-500 coins per withdrawal, fixed 1 coin fee. No waiting, no review, no hold.",
    "Transparency: After each round ends, every player's bet amount and number choice are revealed publicly. Fair, open, and verifiable for everyone.",
    "Our principle: Fairness first. Every bet is recorded, every result is publicly verifiable. No hidden fees beyond the stated 2.5%.",
    "Chat room guide: 1 coin opens a chat room where everyone can type and send voice messages (up to 30s). Meeting rooms cost 5 coins, max 2 speakers, others type.",
    "Anyone else playing tonight? Share your strategy below!",
    "Tip: Turn on insurance if you plan to play multiple rounds. It smooths out the variance significantly.",
    "Remember: this is entertainment first. Play responsibly and have fun.",
  ],
  'zh-TW': [
    "玩法說明：選擇紅願池或綠願池，投入1-99枚，再選0-9一個數字。所有數字相加為單數則紅方勝，雙數則綠方勝。扣2.5%手續費後按投入比例分配。",
    "保險玩法：存入最少20枚保費並打開保險開關。許願成功扣10%收益入保險池；許願失敗累計滿100枚生成賠付節點，分100期返還。",
    "邀請返傭：分享邀請連結，好友通過你的連結註冊即綁定上下級。普通用戶直推返0.1%，白名單團長可享更高比例及多級返傭。",
    "提現說明：收益即時到帳餘額，主動發起提現，單筆2-500枚，固定扣1枚手續費。不審核不押款。",
    "公正透明：每局結束後公開所有人的投入和數字選擇，公正透明可追溯。",
    "平台理念：公平優先。每筆下注都有記錄，每個結果都可公開驗證。除公示的2.5%外無隱藏費用。",
    "聊天室指南：1枚即可開語音聊天室，所有人可發文字和語音（最長30秒）。會議室5枚開房，最多2人上麥，其他人打字互動。",
    "今晚有人一起玩嗎？歡迎分享你的策略！",
    "小技巧：如果打算多玩幾輪，建議打開保險，能有效平滑波動。",
    "記住：娛樂為主，理性參與，祝你好運！",
  ],
  ja: [
    "遊び方：赤いプールか緑のプールを選び、1-99枚を入金し、0-9の数字を選びます。全員の数字の合計が奇数なら赤の勝ち、偶数なら緑の勝ち。2.5%の手数料を差し引いた後、賭け金比率で分配されます。",
    "保険ガイド：最低20枚を入金して保険スイッチをオンに。勝った場合は利益の10%が保険プールに。負けて損失が100枚に達すると、配当ノードが作成され100期に分けて返還されます。",
    "紹介報酬：招待リンクを共有。リンクから登録した友達があなたの下位となります。一般ユーザーは直接紹介で0.1%。ホワイトリストのリーダーはより高い率と多段階報酬を得られます。",
    "出金情報：賞金は即座に残高に。いつでも出金可能、1回2-500枚、手数料は固定1枚。待ち時間なし、審査なし。",
    "透明性：各ラウンド終了後、全プレイヤーの賭け金と数字選択が公開されます。公平でオープン、誰でも検証可能。",
    "プラットフォーム理念：公平性第一。すべての賭けは記録され、すべての結果は公開検証可能。表示された2.5%以外の隠れた手数料はありません。",
    "チャットルームガイド：1枚でチャットルームを開設。誰でもテキストとボイスメッセージ（最長30秒）を送信可能。会議室は5枚、最大2名がスピーカー、その他はテキストのみ。",
    "今夜遊んでいる人いますか？戦略を共有しましょう！",
    "コツ：複数ラウンドプレイする予定なら、保険をオンにすると変動が緩和されます。",
    "忘れないで：エンターテイメントが第一。責任を持って楽しんでください！",
  ],
  ar: [
    "كيفية اللعب: اختر الحوض الأحمر أو الأخضر، أودع 1-99 عملة، اختر رقماً من 0-9. إذا كان مجموع الأرقام فردياً يفوز الأحمر، إذا كان زوجياً يفوز الأخضر. يتم خصم 2.5% رسوم ثم التوزيع حسب نسبة المشاركة.",
    "دليل التأمين: أودع 20 عملة على الأقل وشغل التأمين. إذا فزت، يذهب 10% من أرباحك إلى صندوق التأمين. إذا خسرت وتراكمت خسائرك 100 عملة، يتم إنشاء عقدة تعويض وتُعاد على 100 فترة.",
    "مكافآت الإحالة: شارك رابط الدعوة. الأصدقاء الذين يسجلون عبر رابطك يصبحون تحت خطك. المستخدمون العاديون يحصلون على 0.1% من الإحالات المباشرة. قادة القوائم البيضاء يحصلون على نسب أعلى ومكافآت متعددة المستويات.",
    "معلومات السحب: الأرباح تذهب مباشرة إلى رصيدك. اسحب في أي وقت، 2-500 عملة لكل سحب، رسوم ثابتة 1 عملة. لا انتظار، لا مراجعة.",
    "الشفافية: بعد انتهاء كل جولة، يتم الكشف عن مبلغ رهان كل لاعب واختيار الرقم علناً. عادل ومفتوح وقابل للتحقق للجميع.",
    "مبدأ المنصة: العدالة أولاً. كل رهان مسجل، كل نتيجة قابلة للتحقق علناً. لا رسوم خفية غير الـ 2.5% المعلنة.",
    "دليل غرف الدردشة: عملة واحدة تفتح غرفة دردشة حيث يمكن للجميع إرسال نصوص ورسائل صوتية (حتى 30 ثانية). غرف الاجتماعات تكلف 5 عملات، حد أقصى 2 متحدثين، البقية يكتبون.",
    "هل هناك من يلعب الليلة؟ شارك استراتيجيتك!",
    "نصيحة: إذا كنت تخطط للعب عدة جولات، شغل التأمين لتقليل التقلبات.",
    "تذكر: الترفيه أولاً. العب بمسؤولية واستمتع!",
  ],
  id: [
    "Cara bermain: Pilih Kolam Merah atau Kolam Hijau, setor 1-99 koin, pilih angka 0-9. Jika jumlah semua angka ganjil, Merah menang; jika genap, Hijau menang. Biaya 2.5% dipotong, pemenang bagi hasil sesuai rasio taruhan.",
    "Panduan asuransi: Setor minimal 20 koin dan nyalakan asuransi. Jika menang, 10% keuntungan masuk ke kolam asuransi. Jika kalah dan kerugian menumpuk 100 koin, node pembayaran dibuat dan dikembalikan selama 100 periode.",
    "Hadiah referral: Bagikan link undangan. Teman yang daftar via linkmu menjadi downline. Pengguna biasa dapat 0.1% dari referral langsung. Leader whitelist dapat rate lebih tinggi dan komisi multi-level.",
    "Info penarikan: Kemenangan langsung ke saldo. Tarik kapan saja, 2-500 koin per tarik, biaya tetap 1 koin. Tanpa tunggu, tanpa review.",
    "Transparansi: Setelah setiap ronde, jumlah taruhan dan pilihan angka semua pemain diungkapkan publik. Adil, terbuka, dapat diverifikasi semua orang.",
    "Prinsip platform: Keadilan utama. Setiap taruhan tercatat, setiap hasil dapat diverifikasi publik. Tidak ada biaya tersembunyi selain 2.5% yang diumumkan.",
    "Panduan ruang obrol: 1 koin buka ruang obrol, semua orang bisa kirim teks dan pesan suara (maks 30 detik). Ruang rapat 5 koin, maks 2 pembicara, yang lain mengetik.",
    "Ada yang main malam ini? Bagikan strategimu!",
    "Tips: Jika berencana main beberapa ronde, nyalakan asuransi untuk mengurangi fluktuasi.",
    "Ingat: hiburan utama. Bermain bertanggung jawab dan selamat bersenang-senang!",
  ],
  ko: [
    "게임 방법: 레드 풀 또는 그린 풀을 선택하고 1-99코인을 입금한 후 0-9 숫자를 고르세요. 모든 숫자의 합이 홀수면 레드 승, 짝수면 그린 승. 2.5% 수수료 차감 후 베팅 비율대로 분배.",
    "보험 가이드: 최소 20코인을 입금하고 보험을 켜세요. 이기면 수익의 10%가 보험 풀로. 지고 손실이 100코인 누적되면 지급 노드가 생성되어 100기간에 걸쳐 반환.",
    "추천 보상: 초대 링크를 공유하세요. 링크로 가입한 친구가 다운라인이 됩니다. 일반 사용자는 직접 추천 0.1%. 화이트리스트 리더는 더 높은 비율과 다단계 수수료.",
    "출금 안내: 당첨금은 즉시 잔액으로. 언제든 출금 가능, 1회 2-500코인, 수수료 고정 1코인. 대기 없음, 심사 없음.",
    "투명성: 매 라운드 종료 후 모든 플레이어의 베팅 금액과 숫자 선택이 공개됩니다. 공정하고 개방적이며 누구나 검증 가능.",
    "플랫폼 원칙: 공정성 우선. 모든 베팅은 기록되고 모든 결과는 공개 검증 가능. 공지된 2.5% 외 숨겨진 수수료 없음.",
    "채팅방 가이드: 1코인으로 채팅방 개설. 모두 텍스트와 음성 메시지(최대 30초) 전송 가능. 회의실은 5코인, 최대 2명 발언, 나머지는 텍스트만.",
    "오늘 밤 게임하시는 분 있나요? 전략을 공유해주세요!",
    "팁: 여러 라운드 플레이할 계획이라면 보험을 켜서 변동성을 줄이세요.",
    "기억하세요: 엔터테인먼트가 우선입니다. 책임감 있게 즐기세요!",
  ],
  ru: [
    "Как играть: выберите Красный или Зелёный пул, внесите 1-99 монет, выберите число 0-9. Если сумма всех чисел нечётная — выигрывает Красный, если чётная — Зелёный. Комиссия 2.5%, победители делят по ставкам.",
    "Гид по страховке: внесите минимум 20 монет и включите страховку. При выигрыше 10% прибыли идёт в страховой пул. При проигрыше и накоплении 100 монет создаётся узел выплат, возвращается за 100 периодов.",
    "Реферальные награды: поделитесь ссылкой. Друзья, зарегистрировавшиеся по вашей ссылке, становятся вашей нижней линией. Обычные пользователи получают 0.1% с прямых приглашений. Лидеры из белого списка — более высокие ставки и многоуровневые комиссии.",
    "Информация о выводе: выигрыш сразу на баланс. Вывод в любое время, 2-500 монет за вывод, фиксированная комиссия 1 монета. Без ожидания, без проверки.",
    "Прозрачность: после каждого раунда ставка и выбор числа всех игроков публично раскрываются. Справедливо, открыто, проверяемо для всех.",
    "Принцип платформы: справедливость прежде всего. Каждая ставка записана, каждый результат публично проверяем. Никаких скрытых комиссий кроме заявленных 2.5%.",
    "Гид по чатам: 1 монета открывает чат, все могут отправлять текст и голосовые сообщения (до 30 сек). Комнаты встреч — 5 монет, максимум 2 говорящих, остальные пишут.",
    "Кто-нибудь играет сегодня вечером? Поделитесь стратегией!",
    "Совет: если планируете несколько раундов, включите страховку — сгладит колебания.",
    "Помните: развлечение прежде всего. Играйте ответственно и получайте удовольствие!",
  ],
  hi: [
    "कैसे खेलें: लाल या हरा पूल चुनें, 1-99 सिक्के जमा करें, 0-9 कोई संख्या चुनें। सभी संख्याओं का योग विषम होने पर लाल जीतता है, सम होने पर हरा जीतता है। 2.5% शुल्क काटने के बाद जीतने वाले दांव के अनुपात में बांटते हैं।",
    "बीमा गाइड: कम से कम 20 सिक्के जमा करें और बीमा चालू करें। जीतने पर आपके लाभ का 10% बीमा पूल में जाता है। हारने और 100 सिक्के घाटे जमा होने पर भुगतान नोड बनता है जो 100 अवधियों में वापस आता है।",
    "रेफरल इनाम: अपना आमंत्रण लिंक साझा करें। आपके लिंक से पंजीकृत दोस्त आपके डाउनलाइन बन जाते हैं। सामान्य उपयोगकर्ता सीधे रेफरल पर 0.1% पाते हैं। व्हाइटलिस्ट लीडर को उच्च दर और बहु-स्तरीय कमीशन मिलता है।",
    "निकासी जानकारी: जीतने की राशि सीधे बैलेंस में। कभी भी निकासी करें, प्रति निकासी 2-500 सिक्के, निश्चित शुल्क 1 सिक्का। कोई इंतजार नहीं, कोई समीक्षा नहीं।",
    "पारदर्शिता: प्रत्येक राउंड के बाद सभी खिलाड़ियों की दांव राशि और संख्या चयन सार्वजनिक रूप से प्रकट होते हैं। निष्पक्ष, खुला, सभी के लिए सत्यापन योग्य।",
    "प्लेटफॉर्म सिद्धांत: निष्पक्षता सर्वोपरि। हर दांव दर्ज है, हर परिणाम सार्वजनिक रूप से सत्यापन योग्य। घोषित 2.5% के अलावा कोई छिपी शुल्क नहीं।",
    "चैट रूम गाइड: 1 सिक्का चैट रूम खोलता है, सभी टेक्स्ट और वॉयस संदेश (अधिकतम 30 सेकंड) भेज सकते हैं। मीटिंग रूम 5 सिक्के, अधिकतम 2 बोलने वाले, बाकी टाइप करते हैं।",
    "आज रात कोई खेल रहा है? अपनी रणनीति साझा करें!",
    "युक्ति: यदि आप कई राउंड खेलने की योजना बना रहे हैं, तो बीमा चालू करें — यह उतार-चढ़ाव को कम करता है।",
    "याद रखें: मनोरंजन सबसे पहले। जिम्मेदारी से खेलें और मजे करें!",
  ],
  ur: [
    "کیسے کھیلیں: سرخ یا سبز پول منتخب کریں، 1-99 سکے جمع کروائیں، 0-9 کوئی عدد منتخب کریں۔ تمام اعداد کا مجموعہ طے ہونے پر سرخ جیتتا ہے، جوڑ ہونے پر سبز جیتتا ہے۔ 2.5% فیس کاٹنے کے بعد جیتنے والے شرط کے تناسب میں بانٹتے ہیں۔",
    "انشورنس گائیڈ: کم از کم 20 سکے جمع کروائیں اور انشورنس آن کریں۔ جیتنے پر آپ کے منافع کا 10% انشورنس پول میں جاتا ہے۔ ہارنے اور 100 سکے نقصان جمع ہونے پر ادائیگی نوڈ بنتا ہے جو 100 ادوار میں واپس آتا ہے۔",
    "ریفرل انعام: اپنا دعوت لنک شیئر کریں۔ آپ کے لنک سے رجسٹر ہونے والے دوست آپ کے ڈاؤن لائن بن جاتے ہیں۔ عام صارف براہ راست ریفرل پر 0.1% پاتے ہیں۔ وائٹ لسٹ لیڈر کو بلند شرح اور کثیر سطحی کمیشن ملتا ہے۔",
    "نکاسی کی معلومات: جیت کی رقم سیدھا بیلنس میں۔ کسی بھی وقت نکاسی کریں، فی نکاسی 2-500 سکے، مقررہ فیس 1 سکا۔ کوئی انتظار نہیں، کوئی جانچ نہیں۔",
    "شفافیت: ہر راؤنڈ کے بعد تمام کھلاڑیوں کی شرط کی رقم اور عدد کا انتخاب عوامی طور پر ظاہر ہوتا ہے۔ منصفانہ، کھلا، سب کے لیے قابل تصدیق۔",
    "پلیٹ فارم کا اصول: انصاف اولین ہر شرط درج ہے، ہر نتیجہ عوامی طور پر قابل تصدیق ہے۔ اعلان کردہ 2.5% کے علاوہ کوئی چھپی فیس نہیں۔",
    "چیٹ روم گائیڈ: 1 سکا چیٹ روم کھولتا ہے، سب ٹیکسٹ اور وائس میسج (زیادہ سے زیادہ 30 سیکنڈ) بھیج سکتے ہیں۔ میٹنگ روم 5 سکے، زیادہ سے زیادہ 2 بولنے والے، باقی ٹائپ کرتے ہیں۔",
    "آج رات کوئی کھیل رہا ہے؟ اپنی حکمت عملی شیئر کریں!",
    "ٹپ: اگر آپ کئی راؤنڈ کھیلنے کا ارادہ رکھتے ہیں، تو انشورنس آن کریں — یہ اتار چڑھاؤ کو کم کرتا ہے۔",
    "یاد رکھیں: تفریح سب سے پہلے۔ ذمہ داری سے کھیلیں اور لطف اندوز ہوں!",
  ],
};

export class NpcService {
  constructor(app) {
    this.app = app;
    this.store = app.store;
    this.game = app.game;
    this.social = app.social;
    this.voice = app.voice;
    this._langIndex = 0;
    this._npcRoom = new Map(); // npcId -> current roomId
  }

  async addNpc(name, wallet, language) {
    // Use provided wallet if given, otherwise generate random 0x address
    const w = (wallet && wallet.trim()) ? wallet.trim() :
      '0x' + Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    try {
      // Reuse existing user if wallet already registered, otherwise register new
      let user;
      try { user = await this.store.getUserByWallet(w); } catch { user = null; }
      if (!user) user = await this.game.register(w, null, nowSec());
      // Use provided language if valid, otherwise round-robin
      const lang = (language && LANGUAGES.includes(language)) ? language : LANGUAGES[this._langIndex % LANGUAGES.length];
      this._langIndex++;
      const npc = {
        npcId: await this.store.nextId('npc', 'NPC'),
        uid: user.uid,
        wallet: w,
        name: name || ('NPC-' + lang.toUpperCase()),
        enabled: true,
        createdAt: nowSec(),
        lastPostAt: 0,
        lastChatAt: 0,
        lastBetAt: 0,
        nextPostAt: this._rollNextTime(),
        nextChatAt: this._rollNextTime(),
        nextBetAt: this._rollBetTime(),
        language: lang,
      };
      await this.store.insertNpc(npc);
      // Fund NPC with 100 coins from platform account (ledger: platform decreases, account increases)
      await this.store.transaction(async () => {
        await this.store.applyLedger({ plat: -NPC_START_BALANCE });
        await this.store.applyAccount(user.uid, { avail: NPC_START_BALANCE });
        await this.store.addFlow(user.uid, 'NPC_FUND', NPC_START_BALANCE, { note: 'initial NPC funding from platform' });
      }, 'npc-fund');
      console.log('[npc:add] success', npc.npcId, w, lang);
      return npc;
    } catch (e) {
      console.error('[npc:add] FAILED', w, e.message, e.stack);
      throw e;
    }
  }

  async removeNpc(npcId) {
    return await this.store.removeNpc(npcId);
  }

  async listNpcs() {
    return await this.store.listNpcs();
  }

  // Admin manually recharges an NPC from platform account
  async rechargeNpc(npcId, amountCoins) {
    const npcs = await this.store.listNpcs();
    const npc = npcs.find(n => n.npcId === npcId);
    if (!npc) throw new Error('NPC not found');
    const amount = BigInt(Math.floor(Number(amountCoins))) * COIN;
    if (amount <= 0n) throw new Error('Invalid amount');
    await this.store.applyLedger({ issued: amount });
    await this.store.applyAccount(npc.uid, { avail: amount });
    await this.store.addFlow(npc.uid, 'NPC_RECHARGE', amount, { note: 'admin recharge (minted)' });
    return { npcId, amount: Number(amount) / Number(COIN) };
  }

  _rollNextTime() {
    // 1-5 min for social posts (testing mode)
    return nowSec() + Math.floor(Math.random() * 2400) + 1200;
  }

  _rollBetTime() {
    // 1-5 min for bets (testing mode)
    return nowSec() + Math.floor(Math.random() * 2400) + 1200;
  }

  _rollRetryTime() {
    return nowSec() + Math.floor(Math.random() * 120) + 60;
  }

  _pickContent(lang) {
    const pool = CONTENT_BY_LANG[lang] || CONTENT_BY_LANG.en;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async tick(nowSecVal) {
    const npcs = await this.store.listNpcs();
    const actions = { posts: [], chats: [], bets: [] };
    for (const npc of npcs) {
      if (!npc.enabled) continue;
      const lang = npc.language || 'en';

      // --- Random bet (30-60 min interval, 1 coin, random side/pick, no insurance) ---
      if (nowSecVal >= npc.nextBetAt) {
        let betOk = false;
        try {
          // Check balance first
          const acc = await this.store.getAccount(npc.uid).catch(() => null);
          if (acc && acc.available >= BET_AMOUNT) {
            const side = Math.random() < 0.5 ? 'red' : 'green';
            const pick = Math.floor(Math.random() * 10);
            await this.game.bet(npc.uid, side, 1, pick, nowSecVal); // bet 1 coin (game handles unit conversion)
            actions.bets.push({ npc: npc.name, side, pick });
            betOk = true;
          }
          // If balance < 1 coin, skip (admin must manually recharge)
        } catch (e) {
          console.error('[npc:bet]', npc.name, e.name, e.message);
          // ROUND_LOCKED: round in last 30s, give up and wait next interval
          // INSUFFICIENT_BALANCE: skip, wait for admin recharge
        }
        try {
          await this.store.updateNpc(npc.npcId, {
            lastBetAt: betOk ? nowSecVal : npc.lastBetAt,
            nextBetAt: betOk ? this._rollBetTime() : this._rollBetTime(),
          });
        } catch (e) { console.error('[npc:updateBet]', e.message); }
      }

      // --- Random BBS post ---
      if (nowSecVal >= npc.nextPostAt) {
        let ok = false;
        try {
          const content = this._pickContent(lang);
          await this.social.post(npc.uid, content);
          actions.posts.push({ npc: npc.name, lang });
          ok = true;
        } catch (e) { /* banned or error, skip */ }
        try {
          await this.store.updateNpc(npc.npcId, {
            lastPostAt: ok ? nowSecVal : npc.lastPostAt,
            nextPostAt: ok ? this._rollNextTime() : this._rollRetryTime(),
          });
        } catch (e) { console.error('[npc:updatePost]', e.message); }
      }

      // --- Random chat room message (NPC stays in room, no immediate leave) ---
      if (nowSecVal >= npc.nextChatAt) {
        let ok = false;
        try {
          const rooms = this.voice.listRooms ? (await this.voice.listRooms()) : [];
          const sorted = rooms
            .filter(r => r.type === 'chat')
            .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
            .slice(0, 10);
          if (sorted.length > 0) {
            const room = sorted[Math.floor(Math.random() * sorted.length)];
            const curRoom = this._npcRoom.get(npc.npcId);
            // If NPC is in a different room, leave it first
            if (curRoom && curRoom !== room.roomId) {
              try { await this.voice.leave(curRoom, npc.uid); } catch { /* */ }
              this._npcRoom.delete(npc.npcId);
            }
            // Join if not already in this room
            if (this._npcRoom.get(npc.npcId) !== room.roomId) {
              try { await this.voice.join(room.roomId, npc.uid); this._npcRoom.set(npc.npcId, room.roomId); } catch { /* already in or full */ }
            }
            const msgContent = this._pickContent(lang);
            try {
              await this.voice.sendMessage(room.roomId, npc.uid, { type: 'text', content: msgContent });
              actions.chats.push({ npc: npc.name, room: room.name, lang });
              ok = true;
            } catch { /* send failed, maybe room closed */ this._npcRoom.delete(npc.npcId); }
          }
        } catch (e) { /* voice not ready or no rooms */ }
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
