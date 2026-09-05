// Lottery page logic - fully tested
const Lottery = (() => {
  let currentProduct = null;

  function t(key) {
    if (typeof window.t === 'function') return window.t(key);
    return key;
  }

  async function loadProducts() {
    try {
      const res = await fetch('/lottery/products');
      const products = await res.json();
      renderProducts(products);
    } catch (e) {
      console.error('loadProducts error', e);
    }
  }

  function renderProducts(products) {
    const list = document.getElementById('lotteryList');
    if (!list) return;
    list.innerHTML = products.map(p => {
      const r = p.currentRound;
      const roundNum = r ? r.roundId.split('_R')[1] : '0001';
      return `
        <div class="lottery-card" data-id="${p.id}">
          <div class="lottery-img-wrap">
            <img src="${p.image}" alt="${p.name}" />
            <div class="lottery-round-badge">第${roundNum}期</div>
          </div>
          <div class="lottery-card-info">
            <div class="lottery-card-name">${p.name}</div>
            <div class="lottery-card-meta">
              <span>${r ? r.participantCount : 0} ${t('lotteryPlayers') || 'players'}</span>
              <span>${r ? r.progress : 0}%</span>
            </div>
            <div class="lottery-progress">
              <div class="lottery-progress-bar" style="width:${r ? r.progress : 0}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.lottery-card').forEach(card => {
      card.onclick = () => openDetail(card.dataset.id);
    });
  }

  async function openDetail(productId) {
    try {
      const res = await fetch(`/lottery/current/${productId}`);
      const data = await res.json();
      currentProduct = data;
      renderDetail(data);
      document.getElementById('lotteryListWrap').classList.add('hide');
      document.getElementById('lotteryDetail').classList.remove('hide');
      loadMyNumbers(productId);
      loadComments(productId);
      loadHistory(productId);
    } catch (e) {
      console.error('openDetail error', e);
      alert('Failed to load product: ' + e.message);
    }
  }

  function renderDetail(data) {
    const p = data.product;
    const r = data.summary;
    const content = document.getElementById('lotteryDetailContent');

    const prizesHtml = p.prizes.map(prize => `
      <div class="lottery-prize-row">
        <span class="lottery-prize-level">${prize.name} × ${prize.count}</span>
        <span class="lottery-prize-amount">${prize.amount} 枚</span>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="lottery-detail-header">
        <h3>${p.name}</h3>
        <div class="lottery-detail-meta">
          <span>${t('lotteryRound') || 'Round'}: ${r.roundId}</span>
          <span>${r.totalSold}/${r.totalAmount} ${t('lotterySold') || 'sold'}</span>
        </div>
        <div class="lottery-progress">
          <div class="lottery-progress-bar" style="width:${r.progress}%"></div>
        </div>
      </div>

      <div class="lottery-product-desc">
        <div class="lottery-desc-title">${t('lotteryProductDesc') || '产品说明'}</div>
        <p>${p.desc}</p>
        <p>${t('lotteryDesc1') || '每人投入整数枚数，按先来后到分配连续号码。号码售完后系统自动随机开奖，完全公平公正。'}</p>
        <p>${t('lotteryDesc2') || '奖金自动发放到余额，可立即提现，不押不申请不审核。'}</p>
      </div>

      <div class="lottery-prizes">
        <div class="lottery-section-title">${t('lotteryPrizePool') || '奖池结构'}</div>
        ${prizesHtml}
      </div>

      <div class="lottery-buy-section">
        <div class="lottery-section-title">${t('lotteryBuyNow') || '立即购买'}</div>
        <div class="lottery-buy-row">
          <label>${t('lotteryAmount') || '投入数量'}:</label>
          <input type="number" id="lotteryAmount" min="1" max="${r.totalAmount - r.totalSold}" value="55" />
          <span style="font-size:12px;color:var(--muted);">枚</span>
        </div>
        <button id="lotteryBuyBtn" class="btn-primary" style="width:100%;">${t('lotteryConfirmBuy') || '确认购买'}</button>
        <div id="lotteryResult" class="lottery-result" style="margin-top:10px;"></div>
      </div>

      <div class="lottery-mynumbers">
        <div class="lottery-section-title">${t('lotteryMyNumbers') || '我的号码'}</div>
        <div id="lotteryMyNumbersList" style="font-size:13px;color:var(--txt);">${t('lotteryNoNumbers') || '暂无购买记录'}</div>
      </div>

      <div class="lottery-history">
        <div class="lottery-section-title">${t('lotteryHistory') || '开奖记录'}</div>
        <div id="lotteryHistoryList"></div>
      </div>

      <div class="lottery-comments">
        <div class="lottery-section-title">${t('lotteryComments') || '评论'}</div>
        <div class="lottery-comment-input">
          <input type="text" id="lotteryCommentInput" placeholder="${t('lotteryCommentPh') || '说点什么...'}" maxlength="200" />
          <button id="lotteryCommentBtn" class="btn-primary" style="flex:0 0 auto;">${t('send') || '发送'}</button>
        </div>
        <div id="lotteryCommentList" class="lottery-comment-list"></div>
      </div>
    `;

    document.getElementById('lotteryBuyBtn').onclick = buy;
    document.getElementById('lotteryCommentBtn').onclick = postComment;
  }

  async function buy() {
    if (!currentProduct) return;
    const amount = parseInt(document.getElementById('lotteryAmount').value, 10);
    if (!amount || amount < 1) {
      alert(t('lotteryNeedAmount') || '请输入有效的数量');
      return;
    }

    if (typeof state === 'undefined' || !state.uid) {
      alert(t('needWallet') || '请先连接钱包');
      return;
    }

    const resultEl = document.getElementById('lotteryResult');
    resultEl.innerHTML = t('lotteryProcessing') || '处理中...';
    resultEl.style.color = 'var(--muted)';

    try {
      const data = await tryBuy(amount);
      if (data.success) {
        resultEl.innerHTML = `<span style="color:var(--gold);font-weight:700;">${t('lotteryBuySuccess') || '购买成功！'} 号码: ${data.startNum} - ${data.endNum}</span>`;
        setTimeout(() => {
          openDetail(currentProduct.product.id);
        }, 1500);
        return;
      }
      if (data.needWallet) {
        resultEl.innerHTML = t('lotteryNeedWallet') || '余额不足，正在调用钱包...';
        const ok = await topUpAndBuy(amount, data.cost);
        if (ok) {
          const data2 = await tryBuy(amount);
          if (data2.success) {
            resultEl.innerHTML = `<span style="color:var(--gold);font-weight:700;">${t('lotteryBuySuccess') || '购买成功！'} 号码: ${data2.startNum} - ${data2.endNum}</span>`;
            setTimeout(() => openDetail(currentProduct.product.id), 1500);
          } else {
            resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryBuyFail') || '购买失败'}</span>`;
          }
        } else {
          resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryWalletCancel') || '钱包支付已取消或失败'}</span>`;
        }
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryBuyFail') || '购买失败'}: ${e.message}</span>`;
    }
  }

  async function tryBuy(amount) {
    const res = await fetch('/lottery/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: state.uid, productId: currentProduct.product.id, amount }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Buy failed');
    }
    return await res.json();
  }

  async function topUpAndBuy(amount, totalCost) {
    if (typeof alignWallet !== 'function' || typeof ensureWalletReady !== 'function') {
      alert(t('chainNotConfigured') || '钱包功能未配置，请使用线上站点');
      return false;
    }
    const S6 = 1_000_000;
    await alignWallet();
    const fresh = await fetch('/user/' + state.uid).then(r => r.json());
    const availInner = Math.round(Number(fresh.account.available) * S6);
    const totalInner = amount * S6;
    const chainInner = Math.max(0, totalInner - Math.min(availInner, totalInner));
    if (chainInner <= 0) return true;
    await ensureWalletReady();
    const dec = state.chainCfg.decimals;
    const diff = dec - 6;
    if (diff < 0) { alert('Token decimals < 6, unsupported'); return false; }
    const needWei = BigInt(chainInner) * (10n ** BigInt(diff));
    const wbal = await walletTokenWei();
    if (wbal < needWei) {
      const s = Number(needWei - wbal) / (10 ** diff);
      alert((t('walletShort') || '钱包余额不足') + ' ' + (s / S6) + ' 枚');
      return false;
    }
    const data = erc20TransferData(state.chainCfg.platformAddress, chainInner, dec);
    let txHash;
    try {
      txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: state.wallet, to: state.chainCfg.tokenContract, data }],
      });
    } catch (e) {
      alert(e.message || String(e));
      return false;
    }
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const creditRes = await fetch('/wallet/credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: state.uid, txHash }),
        });
        const creditData = await creditRes.json();
        if (creditData.credited > 0 || creditData.already) return true;
      } catch { /* continue */ }
    }
    return false;
  }

  async function loadMyNumbers(productId) {
    if (typeof state === 'undefined' || !state.uid) return;
    try {
      const res = await fetch(`/lottery/mynumbers/${productId}/${state.uid}`);
      const numbers = await res.json();
      const list = document.getElementById('lotteryMyNumbersList');
      if (!list) return;
      if (numbers.length === 0) {
        list.innerHTML = t('lotteryNoNumbers') || '暂无购买记录';
      } else {
        list.innerHTML = numbers.map(n =>
          `<div style="padding:4px 0;">${t('lotteryNumberRange') || '号码'}: <strong>${n.startNum} - ${n.endNum}</strong> (${n.amount}枚)</div>`
        ).join('');
      }
    } catch (e) {
      console.error('loadMyNumbers error', e);
    }
  }

  async function loadComments(productId) {
    try {
      const res = await fetch(`/lottery/comments/${productId}`);
      const comments = await res.json();
      const list = document.getElementById('lotteryCommentList');
      if (!list) return;
      list.innerHTML = comments.map(c => `
        <div class="comment-item">
          <div class="lottery-comment-user">${c.uid}</div>
          <div class="lottery-comment-text">${escapeHtml(c.content)}</div>
        </div>
      `).join('') || `<div style="font-size:12px;color:var(--muted);">${t('lotteryNoComments') || '暂无评论'}</div>`;
    } catch (e) {
      console.error('loadComments error', e);
    }
  }

  async function postComment() {
    const input = document.getElementById('lotteryCommentInput');
    const content = input.value.trim();
    if (!content) return;
    if (typeof state === 'undefined' || !state.uid) {
      alert(t('needWallet') || '请先连接钱包');
      return;
    }
    try {
      await fetch('/lottery/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: state.uid, productId: currentProduct.product.id, content }),
      });
      input.value = '';
      loadComments(currentProduct.product.id);
    } catch (e) {
      console.error('postComment error', e);
    }
  }

  async function loadHistory(productId) {
    try {
      const res = await fetch(`/lottery/history/${productId}`);
      const history = await res.json();
      const list = document.getElementById('lotteryHistoryList');
      if (!list) return;
      list.innerHTML = history.map(h => {
        const winners = h.winners.map(w =>
          `<span class="lottery-winner-tag winner-${w.level}">${w.levelName}: ${w.number}</span>`
        ).join('');
        return `
          <div class="lottery-history-item">
            <div style="margin-bottom:4px;"><strong>${h.roundId}</strong> - ${new Date(h.finishedAt * 1000).toLocaleDateString()}</div>
            <div>${winners}</div>
          </div>
        `;
      }).join('') || `<div style="font-size:12px;color:var(--muted);">${t('lotteryNoHistory') || '暂无开奖记录'}</div>`;
    } catch (e) {
      console.error('loadHistory error', e);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function goBack() {
    document.getElementById('lotteryListWrap').classList.remove('hide');
    document.getElementById('lotteryDetail').classList.add('hide');
    currentProduct = null;
    loadProducts();
  }

  function init() {
    const backBtn = document.getElementById('lotteryBackBtn');
    if (backBtn) {
      backBtn.onclick = goBack;
    }
    loadProducts();
  }

  return { init, loadProducts };
})();
