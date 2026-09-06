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
    const coinUnit = t('coinUnitLottery') || 'coins';
    list.innerHTML = products.map(p => {
      const r = p.currentRound;
      const roundNum = r ? r.roundId.split('_R')[1] : '0001';
      const firstPrize = p.prizes.find(pr => pr.level === 1) || p.prizes[0];
      const maxDonation = firstPrize ? firstPrize.amount : 0;
      return `
        <div class="lottery-card" data-id="${p.id}">
          <div class="lottery-img-wrap">
            <img src="${p.image}" alt="${p.name}" />
            <div class="lottery-round-badge">${t('lotteryRound') || 'Round'} ${roundNum}</div>
          </div>
          <div class="lottery-card-info">
            <div class="lottery-card-name">${t('maxDonation') || 'Max Donation'} ${maxDonation} ${coinUnit}</div>
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
    const firstPrize = p.prizes.find(pr => pr.level === 1) || p.prizes[0];
    const maxDonation = firstPrize ? firstPrize.amount : 0;

    const prizeNames = { 1: t('prize1') || 'First Prize', 2: t('prize2') || 'Second Prize', 3: t('prize3') || 'Third Prize', 4: t('prize4') || 'Fourth Prize' };
    const coinUnit = t('coinUnitLottery') || 'coins';
    const prizesHtml = p.prizes.map(prize => `
      <div class="lottery-prize-row">
        <span class="lottery-prize-level">${prizeNames[prize.level] || prize.name} × ${prize.count}</span>
        <span class="lottery-prize-amount">${prize.amount} ${coinUnit}</span>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="lottery-detail-header-large">
        <h2 class="lottery-product-name-large">${t('maxDonation') || 'Max Donation'} ${maxDonation} ${coinUnit}</h2>
      </div>

      <div class="lottery-desc-box">
        <div class="lottery-desc-title">${t('howToPlay') || 'How to Play'}</div>
        <p class="lottery-desc-text">${t('lotteryDescDetail') || 'Enter an integer amount. Numbers assigned sequentially. Auto draw when sold out. Prizes credited instantly.'}</p>
        <p class="lottery-desc-text">${p.desc}</p>
      </div>

      <div class="lottery-prizes">
        <div class="lottery-section-title">${t('lotteryPrizePool') || 'Prize Structure'}</div>
        ${prizesHtml}
      </div>

      <div class="lottery-buy-section">
        <div class="lottery-section-title">${t('lotteryBuyNow') || 'Buy Now'}</div>
        <div class="lottery-buy-row">
          <label>${t('lotteryAmount') || 'Amount'}:</label>
          <input type="number" id="lotteryAmount" min="1" max="${r.totalAmount - r.totalSold}" value="55" />
          <span style="font-size:12px;color:var(--muted);">${coinUnit}</span>
        </div>
        <button id="lotteryBuyBtn" class="btn-primary" style="width:100%;">${t('lotteryConfirmBuy') || 'Confirm Buy'}</button>
        <div id="lotteryResult" class="lottery-result" style="margin-top:10px;"></div>
      </div>

      <div class="lottery-mynumbers">
        <div class="lottery-section-title">${t('lotteryMyNumbers') || 'My Numbers'}</div>
        <div id="lotteryMyNumbersList" style="font-size:13px;color:var(--txt);">${t('lotteryNoNumbers') || 'No purchases yet'}</div>
      </div>

      <div class="lottery-history">
        <div class="lottery-section-title">${t('lotteryHistory') || 'Draw History'}</div>
        <div id="lotteryHistoryList"></div>
      </div>

      <div class="lottery-comments">
        <div class="lottery-section-title">${t('lotteryComments') || 'Comments'}</div>
        <div class="lottery-comment-input">
          <input type="text" id="lotteryCommentInput" placeholder="${t('lotteryCommentPh') || 'Say something...'}" maxlength="200" />
          <button id="lotteryCommentBtn" class="btn-primary" style="flex:0 0 auto;">${t('send') || 'Send'}</button>
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
      alert(t('lotteryNeedAmount') || 'Please enter a valid amount');
      return;
    }

    if (typeof state === 'undefined' || !state.uid) {
      alert(t('needWallet') || 'Please connect wallet first');
      return;
    }

    const resultEl = document.getElementById('lotteryResult');
    resultEl.innerHTML = t('lotteryProcessing') || 'Processing...';
    resultEl.style.color = 'var(--muted)';

    try {
      const data = await tryBuy(amount);
      if (data.success) {
        resultEl.innerHTML = `<span style="color:var(--gold);font-weight:700;">${t('lotteryBuySuccess') || 'Purchase successful!'} Numbers: ${data.startNum} - ${data.endNum}</span>`;
        setTimeout(() => {
          openDetail(currentProduct.product.id);
        }, 1500);
        return;
      }
      if (data.needWallet) {
        resultEl.innerHTML = t('lotteryNeedWallet') || 'Insufficient balance, charging wallet...';
        const ok = await topUpAndBuy(amount, data.cost);
        if (ok) {
          const data2 = await tryBuy(amount);
          if (data2.success) {
            resultEl.innerHTML = `<span style="color:var(--gold);font-weight:700;">${t('lotteryBuySuccess') || 'Purchase successful!'} Numbers: ${data2.startNum} - ${data2.endNum}</span>`;
            setTimeout(() => openDetail(currentProduct.product.id), 1500);
          } else {
            resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryBuyFail') || 'Purchase failed'}</span>`;
          }
        } else {
          resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryWalletCancel') || 'Wallet payment cancelled or failed'}</span>`;
        }
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:#ef4444;">${t('lotteryBuyFail') || 'Purchase failed'}: ${e.message}</span>`;
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
      alert(t('chainNotConfigured') || 'Wallet not configured, please use online site');
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
      alert((t('walletShort') || 'Insufficient wallet balance') + ' ' + (s / S6) + ' coins');
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
        list.innerHTML = t('lotteryNoNumbers') || 'No purchases yet';
      } else {
        list.innerHTML = numbers.map(n =>
          `<div style="padding:4px 0;">${t('lotteryNumberRange') || 'Numbers'}: <strong>${n.startNum} - ${n.endNum}</strong> (${n.amount} coins)</div>`
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
      `).join('') || `<div style="font-size:12px;color:var(--muted);">${t('lotteryNoComments') || 'No comments yet'}</div>`;
    } catch (e) {
      console.error('loadComments error', e);
    }
  }

  async function postComment() {
    const input = document.getElementById('lotteryCommentInput');
    const content = input.value.trim();
    if (!content) return;
    if (typeof state === 'undefined' || !state.uid) {
      alert(t('needWallet') || 'Please connect wallet first');
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
      list.innerHTML = history.map((h, hi) => {
        // Group winners by level
        const byLevel = {};
        for (const w of h.winners) {
          if (!byLevel[w.level]) byLevel[w.level] = { name: w.levelName, amount: w.amount, items: [] };
          byLevel[w.level].items.push(w);
        }
        const levels = Object.keys(byLevel).sort((a, b) => a - b);
        const prizeNames = { 1: t('prize1') || 'First Prize', 2: t('prize2') || 'Second Prize', 3: t('prize3') || 'Third Prize', 4: t('prize4') || 'Fourth Prize' };
        const coinUnit = t('coinUnitLottery') || 'coins';
        const peopleUnit = t('lotteryPlayers') || 'people';
        const winnerHtml = levels.map(lv => {
          const g = byLevel[lv];
          const prizeName = prizeNames[lv] || g.name;
          const collapsible = g.items.length > 6;
          const items = g.items.map(w => {
            const walletShort = w.wallet ? w.wallet.slice(0, 6) + '...' + w.wallet.slice(-4) : w.uid;
            return `<div class="lottery-winner-row"><span class="lottery-winner-num">${w.number}</span><span class="lottery-winner-wallet">${walletShort}</span></div>`;
          }).join('');
          const toggleId = `lottery-toggle-${hi}-${lv}`;
          if (collapsible) {
            return `
              <div class="lottery-prize-group">
                <div class="lottery-prize-header" onclick="document.getElementById('${toggleId}').classList.toggle('hide')">
                  <span class="lottery-prize-name">${prizeName} (${g.items.length}${peopleUnit})</span>
                  <span class="lottery-prize-amount">${g.amount}${coinUnit} ▾</span>
                </div>
                <div id="${toggleId}" class="lottery-prize-winners lottery-winners-grid hide">
                  ${items}
                </div>
              </div>
            `;
          } else {
            return `
              <div class="lottery-prize-group">
                <div class="lottery-prize-header">
                  <span class="lottery-prize-name">${prizeName}</span>
                  <span class="lottery-prize-amount">${g.amount}${coinUnit}</span>
                </div>
                <div class="lottery-prize-winners lottery-winners-grid">
                  ${items}
                </div>
              </div>
            `;
          }
        }).join('');
        return `
          <div class="lottery-history-item">
            <div style="margin-bottom:8px;"><strong>${h.roundId}</strong> - ${new Date(h.finishedAt * 1000).toLocaleDateString()}</div>
            ${winnerHtml}
          </div>
        `;
      }).join('') || `<div style="font-size:12px;color:var(--muted);">${t('lotteryNoHistory') || 'No draws yet'}</div>`;
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

  function refresh() {
    if (currentProduct) {
      renderDetail(currentProduct);
      loadMyNumbers(currentProduct.product.id);
      loadComments(currentProduct.product.id);
      loadHistory(currentProduct.product.id);
    } else {
      loadProducts();
    }
  }

  return { init, loadProducts, refresh };
})();
