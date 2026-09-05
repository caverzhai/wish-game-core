// Lottery page logic - with wallet top-up support
const Lottery = (() => {
  let currentProduct = null;

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
      return `
        <div class="lottery-card" data-id="${p.id}">
          <img src="${p.image}" alt="${p.name}" />
          <div class="lottery-card-info">
            <div class="lottery-card-name">${p.name}</div>
            <div class="lottery-card-meta">
              <span>${r ? r.participantCount : 0} players</span>
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
      document.getElementById('lotteryList').classList.add('hide');
      document.getElementById('lotteryDetail').classList.remove('hide');
      loadComments(productId);
      loadHistory(productId);
    } catch (e) {
      console.error('openDetail error', e);
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
      <img src="${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <div class="lottery-card-meta" style="margin-bottom:12px;">
        <span>Round: ${r.roundId}</span>
        <span>${r.totalSold}/${r.totalAmount} sold</span>
      </div>
      <div class="lottery-progress" style="margin-bottom:16px;">
        <div class="lottery-progress-bar" style="width:${r.progress}%"></div>
      </div>
      <div class="lottery-prizes">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--gold);">Prize Pool</div>
        ${prizesHtml}
      </div>
      <div class="lottery-buy-section">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">Buy Numbers</div>
        <div class="lottery-buy-row">
          <label>Amount:</label>
          <input type="number" id="lotteryAmount" min="1" max="${r.totalAmount - r.totalSold}" value="1" />
          <span style="font-size:12px;color:var(--muted);">枚</span>
        </div>
        <button id="lotteryBuyBtn" class="btn-primary" style="width:100%;">Buy Now</button>
        <div id="lotteryResult" class="lottery-numbers" style="margin-top:10px;"></div>
      </div>
      <div class="lottery-comments">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--gold);">Comments</div>
        <div class="lottery-comment-input">
          <input type="text" id="lotteryCommentInput" placeholder="Say something..." maxlength="200" />
          <button id="lotteryCommentBtn" class="btn-primary" style="flex:0 0 auto;">Send</button>
        </div>
        <div id="lotteryCommentList" class="lottery-comment-list"></div>
      </div>
      <div class="lottery-history">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--gold);">History</div>
        <div id="lotteryHistoryList"></div>
      </div>
    `;

    document.getElementById('lotteryBuyBtn').onclick = buy;
    document.getElementById('lotteryCommentBtn').onclick = postComment;
  }

  async function buy() {
    if (!currentProduct) return;
    const amount = parseInt(document.getElementById('lotteryAmount').value, 10);
    if (!amount || amount < 1) {
      alert('Please enter a valid amount');
      return;
    }

    // Use global state from app.js
    if (typeof state === 'undefined' || !state.uid) {
      alert('Please connect wallet first');
      return;
    }

    const resultEl = document.getElementById('lotteryResult');
    resultEl.innerHTML = 'Processing...';

    try {
      // First try in-site balance
      const data = await tryBuy(amount);
      if (data.success) {
        resultEl.innerHTML = `Success! Numbers: <strong>${data.startNum} - ${data.endNum}</strong>`;
        setTimeout(() => openDetail(currentProduct.product.id), 1500);
        return;
      }
      if (data.needWallet) {
        // Need wallet top-up
        resultEl.innerHTML = 'Insufficient balance, charging wallet...';
        const ok = await topUpAndBuy(amount, data.cost);
        if (ok) {
          // Retry after topup
          const data2 = await tryBuy(amount);
          if (data2.success) {
            resultEl.innerHTML = `Success! Numbers: <strong>${data2.startNum} - ${data2.endNum}</strong>`;
            setTimeout(() => openDetail(currentProduct.product.id), 1500);
          } else {
            resultEl.innerHTML = 'Buy failed: ' + (data2.error || 'Unknown error');
          }
        } else {
          resultEl.innerHTML = 'Wallet payment cancelled or failed';
        }
      }
    } catch (e) {
      resultEl.innerHTML = 'Buy failed: ' + e.message;
    }
  }

  async function tryBuy(amount) {
    const res = await fetch('/lottery/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: state.uid, productId: currentProduct.product.id, amount }),
    });
    return await res.json();
  }

  async function topUpAndBuy(amount, totalCost) {
    // Use app.js global helpers
    if (typeof alignWallet !== 'function' || typeof ensureWalletReady !== 'function') {
      alert('Wallet functions not available. Please use the online site.');
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
      alert('Wallet balance short by ' + (s / S6) + ' 枚');
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

    // Wait for confirmation and credit
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
      } catch { /* continue waiting */ }
    }
    return false;
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
      `).join('') || '<div style="font-size:12px;color:var(--muted);">No comments yet</div>';
    } catch (e) {
      console.error('loadComments error', e);
    }
  }

  async function postComment() {
    const input = document.getElementById('lotteryCommentInput');
    const content = input.value.trim();
    if (!content) return;

    if (typeof state === 'undefined' || !state.uid) {
      alert('Please connect wallet first');
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
      }).join('') || '<div style="font-size:12px;color:var(--muted);">No history yet</div>';
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
    document.getElementById('lotteryList').classList.remove('hide');
    document.getElementById('lotteryDetail').classList.add('hide');
    currentProduct = null;
  }

  function init() {
    const backBtn = document.getElementById('lotteryBackBtn');
    if (backBtn) backBtn.onclick = goBack;
    loadProducts();
  }

  return { init, loadProducts };
})();
