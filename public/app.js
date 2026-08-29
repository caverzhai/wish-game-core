// =============================================================
// 前端：3分钟愿望实现（纯原生 JS，无构建）。金额单位统一「枚」。
// =============================================================
const $ = (id) => document.getElementById(id);
const state = { me: null, detail: null, round: null, side: 'red', pick: 0, lastRoundId: null, myBets: [], storeKind: 'memory' };

const fmt = (n) => { if (n == null || isNaN(n)) return '—'; const v = Math.round((n + Number.EPSILON) * 1e6) / 1e6; return v.toLocaleString('zh-CN', { maximumFractionDigits: 6 }); };
const t = (sec) => sec ? new Date(sec * 1000).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--';
const short = (s) => !s ? '' : (s.length > 10 ? s.slice(0, 6) + '…' + s.slice(-4) : s);
async function api(path, body) {
  const opt = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
  const res = await fetch(path, opt); const j = await res.json();
  if (!res.ok) throw new Error(j.message || '请求失败');
  return j;
}
function toast(msg, isErr) {
  const el = $('toast'); el.textContent = msg; el.style.color = isErr ? '#ff8080' : '#fff';
  el.classList.remove('hidden'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ---------- 登录 ----------
async function login() {
  const wallet = $('walletInput').value.trim();
  if (!wallet) { $('loginErr').textContent = '请输入钱包地址或账号标识'; return; }
  const inviterUid = $('refInput').value.trim() || null;
  try {
    const u = await api('/login', { wallet, inviterUid });
    state.me = u; localStorage.setItem('wg_wallet', wallet); localStorage.setItem('wg_uid', u.uid);
    enterApp();
  } catch (e) { $('loginErr').textContent = e.message; }
}
function enterApp() {
  $('loginMask').classList.add('hidden'); $('app').classList.remove('hidden');
  $('meInfo').textContent = `${state.me.uid} · ${short(state.me.wallet)}`;
  $('inviteLink').value = `${location.origin}/?ref=${state.me.uid}`;
  refreshAll(); setInterval(refreshAll, 1500); setInterval(renderCountdown, 1000);
}
function logout() { localStorage.clear(); location.reload(); }

// ---------- 数据刷新 ----------
async function refreshAll() {
  if (!state.me) return;
  try {
    state.detail = await api(`/user/${state.me.uid}`);
    const cur = await api('/round/current');
    state.round = cur || (await api('/recent'))[0] || null;
    renderAll();
  } catch (e) { /* 轮询静默 */ }
}

// ---------- 对局 ----------
function renderRound() {
  const r = state.round;
  if (!r) { $('rId').textContent = '—'; $('rState').textContent = '等待开局（首笔下注启动 180 秒）'; $('countdown').textContent = '--'; $('redPool').textContent = $('greenPool').textContent = '?'; $('betCount').textContent = '0'; $('resultBox').classList.add('hidden'); return; }
  if (state.lastRoundId !== r.roundId) { state.lastRoundId = r.roundId; state.myBets = []; renderMyBets(); }
  $('rId').textContent = r.roundId;
  const open = r.state === 'active' || r.state === 'locked';
  $('rState').textContent = r.state === 'active' ? '进行中' : r.state === 'locked' ? '已封盘，等待开奖' : r.state === 'settled' ? '已开奖' : '流局（某方无人，全额退回）';
  $('betCount').textContent = r.betCount ?? 0;
  if (open) { $('redPool').textContent = $('greenPool').textContent = '?'; } // 过程不公开
  else { $('redPool').textContent = fmt(r.redTotal) + ' 枚'; $('greenPool').textContent = fmt(r.greenTotal) + ' 枚'; }
  renderCountdown();
  const box = $('resultBox');
  if (r.state === 'settled' && r.result) {
    const x = r.result;
    box.classList.remove('hidden');
    box.innerHTML = `本期选号总和 <b>${r.sumPick}</b>（${r.sumPick % 2 ? '单' : '双'}）→ <b style="color:${x.winSide === 'red' ? '#e5484d' : '#2fb86b'}">${x.winSide === 'red' ? '红方胜' : '绿方胜'}</b><br>
      总池 ${fmt(x.total)} 枚，抽水 2.5% = ${fmt(x.fee)} 枚（其中 ${fmt(x.feeIns)} 入保险池），可分 ${fmt(x.pot)} 枚，分奖尾差 ${fmt(x.dust)} 枚入保险池，邀请返佣 ${fmt(x.referralTotal ?? 0)} 枚`;
  } else if (r.state === 'cancelled') { box.classList.remove('hidden'); box.textContent = '本期一方无人参与，流局：所有许愿金原路退回，不抽水、不计亏损与返佣。'; }
  else box.classList.add('hidden');
}
function renderCountdown() {
  const r = state.round; if (!r) return;
  const now = Math.floor(Date.now() / 1000);
  if (r.state === 'active') {
    const toLock = r.lockAt - now, toSettle = r.settleAt - now;
    $('countdown').textContent = toLock > 0 ? `距封盘 ${toLock}s / 开奖 ${toSettle}s` : `已封盘 · ${toSettle}s 后开奖`;
  } else if (r.state === 'locked') { $('countdown').textContent = `已封盘 · ${r.settleAt - now}s 后开奖`; }
  else $('countdown').textContent = '本期已结束';
}
async function doBet() {
  const amount = Number($('betAmount').value);
  if (!Number.isInteger(amount) || amount < 1 || amount > 99) return toast('许愿金须为 1-99 的正整数（枚）', true);
  try {
    await api('/bet', { uid: state.me.uid, side: state.side, amount, pick: state.pick });
    state.myBets.push({ side: state.side, amount, pick: state.pick }); renderMyBets();
    toast('下注成功'); refreshAll();
  } catch (e) { toast(e.message, true); }
}
function renderMyBets() {
  $('myBets').innerHTML = state.myBets.map((b) => `<li><span>${b.side === 'red' ? '红' : '绿'} · 数字 ${b.pick}</span><b>${fmt(b.amount)} 枚</b></li>`).join('') || '<li class="tip">本局还未下注</li>';
}

// ---------- 历史 ----------
async function loadHistory() {
  const list = await api('/recent');
  $('historyList').innerHTML = list.map((r) => {
    const win = r.state === 'settled' ? r.result.winSide : null;
    const cls = win === 'red' ? 'red' : win === 'green' ? 'green' : 'gray';
    const label = r.state === 'cancelled' ? '流局' : r.state === 'settled' ? (win === 'red' ? '红胜' : '绿胜') : '进行中';
    return `<div class="hist-row" data-id="${r.roundId}"><span class="dot ${cls}"></span><span class="mid">${r.roundId} · ${t(r.startAt)} 开始</span><span class="tag">${label} · 总和 ${r.sumPick ?? '?'}</span></div>`;
  }).join('') || '<p class="tip">暂无历史</p>';
  document.querySelectorAll('.hist-row').forEach((el) => el.onclick = () => showRound(el.dataset.id));
}
async function showRound(id) {
  const d = await api(`/round/${id}`); const box = $('roundDetail'); box.classList.remove('hidden');
  if (!d.bets) { box.innerHTML = `<h4>${id}</h4><p class="tip">${d.note || ''}</p>`; return; }
  box.innerHTML = `<h4>${id} · ${t(d.startAt)} 开始</h4>
    <table><tr><th>用户</th><th>方</th><th>投入(枚)</th><th>选号</th></tr>
    ${d.bets.map((b) => `<tr><td>${b.uid}</td><td>${b.side === 'red' ? '红' : '绿'}</td><td>${fmt(b.amount)}</td><td>${b.pick}</td></tr>`).join('')}</table>`;
}

// ---------- 保险 ----------
function renderInsurance() {
  const d = state.detail; if (!d) return;
  const on = d.user.insSwitch, active = on && d.account.premium >= 20;
  const sw = $('insSwitchBtn'); sw.textContent = on ? '当前：已开启（点击关闭）' : '当前：未开启（点击开启）';
  $('insStat').innerHTML = stat('保费账户', fmt(d.account.premium) + ' 枚') + stat('累计净亏', fmt(d.account.lossAccum) + ' 枚') + stat('是否生效', active ? '生效中' : '未生效');
  $('insHint').textContent = active ? '保险生效中：若中奖，按实分收益扣 10% 入保险池' : '保险未生效（需开启开关且保费 ≥ 20 枚）；不买保险中奖只扣 2.5% 全拿';
  $('nodeList').innerHTML = d.nodes.map((n) => {
    const pct = n.periodN;
    return `<div class="node-item"><span>${n.nodeId} · 第 ${n.periodN}/100 期 · ${n.state === 'active' ? '释放中' : '已完成'}</span>
      <span>已到账 ${fmt(n.paidToUserAmount)} 枚 · 断保充公 ${fmt(n.forfeitedAmount)} 枚</span>
      <span class="progress"><i style="width:${pct}%"></i></span></div>`;
  }).join('') || '<p class="tip">还没有赔付节点（净亏累计满 100 枚且保费 ≥ 20 枚时生成）</p>';
}
async function toggleIns() { try { await api('/insurance/switch', { uid: state.me.uid, on: !state.detail.user.insSwitch }); refreshAll(); } catch (e) { toast(e.message, true); } }
async function depositPremium() {
  const amount = Number($('premiumIn').value);
  if (!Number.isInteger(amount) || amount < 1) return toast('请输入正整数枚数', true);
  try { await api('/insurance/deposit', { uid: state.me.uid, amount }); $('premiumIn').value = ''; toast('已存入保费'); refreshAll(); } catch (e) { toast(e.message, true); }
}

// ---------- 邀请 ----------
function renderInvite() {
  const d = state.detail; if (!d) return; const v = d.invite;
  $('inviteLink').value = `${location.origin}/?ref=${state.me.uid}`;
  $('inviteStat').innerHTML = stat('名下节点直邀人数', v.nodeInviteeCount + ' 人') + stat('当前返佣比例', (v.perMille / 10).toFixed(1) + '%') + stat('累计返佣', fmt(v.rewardTotal) + ' 枚');
}

// ---------- 资产 / 提现 / 流水 ----------
const FLOW_NAME = { BET_FROZEN: '下注冻结', CANCEL_REFUND: '流局退回', WIN_CREDIT: '中奖入账', INS_WIN_CUT: '保险赢家扣费', PREMIUM_IN: '存入保费', NODE_PREMIUM_OUT: '生成节点扣保费', NODE_PAYOUT: '节点赔付到账', NODE_FORFEIT: '断保当期充公', REFERRAL: '邀请返佣', FAUCET: '领取', ISSUE: '发放', WITHDRAW_FEE: '提现手续费', WITHDRAW_PENDING: '提现在途', WITHDRAW_PAID: '已提出', WITHDRAW_REFUND: '提现失败退回' };
const POS = new Set(['CANCEL_REFUND', 'WIN_CREDIT', 'NODE_PAYOUT', 'REFERRAL', 'FAUCET', 'ISSUE', 'WITHDRAW_REFUND']);
const NEG = new Set(['BET_FROZEN', 'INS_WIN_CUT', 'PREMIUM_IN', 'NODE_PREMIUM_OUT', 'WITHDRAW_FEE', 'WITHDRAW_PENDING']);
function stat(k, v) { return `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
function renderWallet() {
  const d = state.detail; if (!d) return; const a = d.account;
  $('assetStat').innerHTML = stat('可用', fmt(a.available) + ' 枚') + stat('局中冻结', fmt(a.frozen) + ' 枚') + stat('保费账户', fmt(a.premium) + ' 枚');
  $('flowList').innerHTML = d.flows.map((f) => {
    const cls = POS.has(f.bizType) ? 'pos' : NEG.has(f.bizType) ? 'neg' : '';
    const sign = POS.has(f.bizType) ? '+' : NEG.has(f.bizType) ? '-' : '';
    return `<div class="flow-item"><span class="biz">${FLOW_NAME[f.bizType] || f.bizType}</span><span class="amt ${cls}">${sign}${fmt(f.amount)} 枚 · ${t(Math.floor(f.at / 1000))}</span></div>`;
  }).join('') || '<p class="tip">暂无流水</p>';
}
async function faucet() { try { await api('/faucet', { uid: state.me.uid, amount: 100 }); toast('已领取 100 枚'); refreshAll(); } catch (e) { toast(e.message, true); } }
function wdHint() { const n = Number($('wdAmount').value); $('wdArrive').textContent = (Number.isInteger(n) && n >= 2 && n <= 500) ? `实到 ${n - 1} 枚（固定手续费 1 枚）` : '单笔 2-500 枚'; }
async function withdraw() {
  const amount = Number($('wdAmount').value);
  try { const w = await api('/withdraw', { uid: state.me.uid, amount }); toast(`已生成提现单 ${w.withdrawId}，实到 ${fmt(w.arrive)} 枚`); $('wdAmount').value = ''; wdHint(); refreshAll(); } catch (e) { toast(e.message, true); }
}

function renderAll() { renderRound(); renderInsurance(); renderInvite(); renderWallet(); if ($('tab-history').classList.contains('hidden') === false) loadHistory(); }

// ---------- 初始化 ----------
function buildNumPick() {
  $('numPick').innerHTML = Array.from({ length: 10 }, (_, i) => `<button data-n="${i}" class="${i === 0 ? 'sel' : ''}">${i}</button>`).join('');
  document.querySelectorAll('#numPick button').forEach((b) => b.onclick = () => { state.pick = Number(b.dataset.n); document.querySelectorAll('#numPick button').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); });
  document.querySelectorAll('.side-btn').forEach((b) => { if (b.dataset.side === state.side) b.classList.add('sel'); b.onclick = () => { state.side = b.dataset.side; document.querySelectorAll('.side-btn').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); }; });
}
function bind() {
  $('loginBtn').onclick = login; $('logoutBtn').onclick = logout; $('betBtn').onclick = doBet;
  $('insSwitchBtn').onclick = toggleIns; $('premiumBtn').onclick = depositPremium;
  $('faucetBtn').onclick = faucet; $('wdBtn').onclick = withdraw; $('wdAmount').oninput = wdHint;
  $('copyInvite').onclick = () => { navigator.clipboard.writeText($('inviteLink').value); toast('已复制邀请链接'); };
  document.querySelectorAll('.tab').forEach((tb) => tb.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); tb.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden')); $('tab-' + tb.dataset.tab).classList.remove('hidden');
    if (tb.dataset.tab === 'history') loadHistory();
  });
}
async function boot() {
  buildNumPick(); bind();
  try { const h = await api('/health'); state.storeKind = h.store; $('storeTag').textContent = h.store === 'mysql' ? '数据已持久化' : '内存演示'; } catch {}
  const ref = new URLSearchParams(location.search).get('ref'); if (ref) $('refInput').value = ref;
  const wallet = localStorage.getItem('wg_wallet');
  if (wallet) {
    try { state.me = await api('/login', { wallet }); enterApp(); return; } catch { localStorage.clear(); }
  }
  $('loginMask').classList.remove('hidden');
}
boot();
