// charity.js - Difficulty Charity Relief Application Frontend
(function () {
  const $ = (id) => document.getElementById(id);
  let currentProject = null;
  let myVote = null;

  function t(k) { return (typeof window.t === 'function') ? window.t(k) : k; }
  function api(path, opts) {
    return fetch(path, opts || {}).then(r => r.json());
  }

  // ---- Render charity project list (integrated into lottery page) ----
  async function renderCharitySection() {
    const container = $('charitySection');
    if (!container) return;
    try {
      const data = await api('/charity/projects?limit=6');
      const projects = data.list || [];
      if (projects.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);">${t('charityNoProjects')}</div>`;
        return;
      }
      const coinUnit = t('coinUnitLottery') || t('coinUnitLottery') || 'coins';
      container.innerHTML = `
        <div class="charity-grid">
          ${projects.map(p => {
            const progress = Math.min(100, Math.round(Number(p.raised) / Number(p.goalAmount) * 100));
            return `
            <div class="charity-card" onclick="Charity.openDetail('${p.projectId}')">
              <img src="${p.photo}" class="charity-img" alt="${p.name}" />
              <div class="charity-info">
                <div class="charity-name">${p.name}</div>
                <div class="charity-country">${p.country}</div>
                <div class="charity-progress-bar">
                  <div class="charity-progress-fill" style="width:${progress}%"></div>
                </div>
                <div class="charity-stats">
                  <span>${Number(p.raised).toFixed(0)} / ${Number(p.goalAmount).toFixed(0)} ${coinUnit}</span>
                  <span>👍 ${p.supportVotes}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);">Failed to load</div>`;
    }
  }

  // ---- Open apply form ----
  function openApply() {
    showView('charityApply');
    $('charityApplyForm').reset();
    $('charityPhotoPreview').style.display = 'none';
  }

  // ---- Photo upload ----
  function handlePhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large, max 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      // Compress image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        $('charityPhotoPreview').src = compressed;
        $('charityPhotoPreview').style.display = 'block';
        $('charityPhotoData').value = compressed;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ---- Submit application ----
  async function submitApply() {
    const form = $('charityApplyForm');
    const photoData = $('charityPhotoData').value;
    if (!photoData) {
      alert(t('charityPhoto') + ' required');
      return;
    }
    // Upload photo first
    let photoUrl = '';
    try {
      const up = await api('/charity/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: state.uid, photo: photoData }),
      });
      photoUrl = up.url;
    } catch (e) {
      alert('Photo upload failed');
      return;
    }

    const data = {
      uid: state.uid,
      name: form.charityName.value,
      gender: form.charityGender.value,
      photo: photoUrl,
      country: form.charityCountry.value,
      city: form.charityCity.value,
      helpType: form.charityHelpType.value,
      reason: form.charityReason.value,
      targetAmount: parseInt(form.charityAmount.value),
      proof: form.charityProof.value,
    };

    try {
      const res = await api('/charity/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.projectId) {
        alert('Submitted!');
        showView('lottery');
        renderCharitySection();
      } else {
        alert(res.message || 'Failed');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ---- Open project detail ----
  async function openDetail(projectId) {
    try {
      const p = await api('/charity/project/' + projectId);
      currentProject = p;
      showView('charityDetail');
      renderDetail(p);
      loadComments(projectId);
      // Check if user voted
      try {
        const votes = await api('/charity/comments/' + projectId); // just to check
      } catch {}
    } catch (e) {
      alert('Failed to load project');
    }
  }

  // ---- Render detail ----
  function renderDetail(p) {
    const coinUnit = t('coinUnitLottery') || t('coinUnitLottery') || 'coins';
    const progress = Math.min(100, Math.round(Number(p.raised) / Number(p.goalAmount) * 100));
    $('charityDetailContent').innerHTML = `
      <img src="${p.photo}" class="charity-detail-img" alt="${p.name}" />
      <h2 style="color:var(--gold);text-align:center;margin:10px 0;">${p.name}</h2>
      <div style="text-align:center;color:var(--muted);margin-bottom:10px;">${p.country} ${p.city ? '· ' + p.city : ''} · ${p.gender}</div>
      <div class="charity-desc-box">
        <div class="charity-desc-title">${t('howToPlay') || t('charityHowToPlay')}</div>
        <p>${p.helpType}</p>
        <p>${p.reason}</p>
        ${p.proof ? `<p><strong>Proof:</strong> ${p.proof}</p>` : ''}
      </div>
      <div class="charity-progress-section">
        <div class="charity-progress-bar large">
          <div class="charity-progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="charity-stats-row">
          <span>${t('charityRaised')}: <strong>${Number(p.raised).toFixed(0)}</strong> ${coinUnit}</span>
          <span>${t('charityGoal')}: <strong>${Number(p.goalAmount).toFixed(0)}</strong> ${coinUnit}</span>
          <span>${t('charityRequested')}: ${Number(p.targetAmount).toFixed(0)} ${coinUnit}</span>
        </div>
        <div class="charity-stats-row">
          <span>👍 ${t('charitySupport')}: ${p.supportVotes}</span>
          <span>👎 ${t('charityOppose')}: ${p.opposeVotes}</span>
          <span>💬 ${t('charityComments')}: ${p.commentCount}</span>
        </div>
      </div>
      ${p.status === 'active' ? `
      <div class="charity-donate-section">
        <div class="lottery-section-title">${t('lotteryBuyNow') || t('charityDonate')}</div>
        <div class="lottery-buy-row">
          <label>${t('lotteryAmount') || t('lotteryAmount')}:</label>
          <input type="number" id="charityDonateAmount" min="1" value="10" />
          <span style="font-size:12px;color:var(--muted);">${coinUnit}</span>
        </div>
        <button onclick="Charity.donate()" class="btn-primary" style="width:100%;">${t('lotteryConfirmBuy') || t('charityDonateNow')}</button>
        <div id="charityDonateResult" style="margin-top:10px;"></div>
      </div>
      <div class="charity-vote-section">
        <div class="lottery-section-title">Vote</div>
        <div style="display:flex;gap:10px;">
          <button onclick="Charity.vote(true)" class="btn-primary" style="flex:1;background:#16a34a;">👍 Support</button>
          <button onclick="Charity.vote(false)" class="btn-primary" style="flex:1;background:#ef4444;">👎 Oppose</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:5px;text-align:center;">Only users with insurance nodes can vote. One vote per project, cannot be changed.</div>
      </div>
      ` : `<div style="text-align:center;padding:15px;color:var(--gold);font-weight:600;">Status: ${p.status}</div>`}
      <div class="charity-comments-section">
        <div class="lottery-section-title">${t('lotteryComments') || t('charityComments')}</div>
        <div class="charity-comment-input">
          <input type="text" id="charityCommentInput" placeholder="${t('bbsPlaceholder') || t('charityCommentPh')}" maxlength="1024" />
          <button onclick="Charity.postComment()" class="btn-primary" style="padding:8px 16px;">${t('send') || t('charitySend')}</button>
        </div>
        <div id="charityCommentsList"></div>
      </div>
    `;
  }

  // ---- Donate ----
  async function donate() {
    if (!currentProject) return;
    const amount = parseInt($('charityDonateAmount').value);
    if (!amount || amount < 1) { alert(t('lotteryNeedAmount')); return; }
    const resultEl = $('charityDonateResult');
    resultEl.innerHTML = t('lotteryProcessing');
    resultEl.style.color = 'var(--muted)';
    try {
      const res = await api('/charity/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: state.uid, projectId: currentProject.projectId, amount }),
      });
      if (res.donated) {
        resultEl.innerHTML = `<span style="color:var(--gold);font-weight:600;">Donated ${Number(res.donated).toFixed(0)} coins successfully!</span>`;
        // Refresh detail
        const p = await api('/charity/project/' + currentProject.projectId);
        currentProject = p;
        renderDetail(p);
      } else {
        resultEl.innerHTML = `<span style="color:#ef4444;">${res.message || t('lotteryBuyFail')}</span>`;
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:#ef4444;">Error: ${e.message}</span>`;
    }
  }

  // ---- Vote ----
  async function vote(support) {
    if (!currentProject) return;
    if (!confirm(support ? t('charitySupport') + '?' : t('charityOppose') + '?')) return;
    try {
      const res = await api('/charity/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: state.uid, projectId: currentProject.projectId, support }),
      });
      if (res.projectId) {
        alert('OK');
        const p = await api('/charity/project/' + currentProject.projectId);
        currentProject = p;
        renderDetail(p);
      } else {
        alert(res.message || 'Failed');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  // ---- Comments ----
  async function loadComments(projectId) {
    try {
      const data = await api('/charity/comments/' + projectId);
      const list = data.list || [];
      const coinUnit = t('coinUnitLottery') || t('coinUnitLottery') || 'coins';
      $('charityCommentsList').innerHTML = list.map(c => `
        <div class="charity-comment">
          <div class="charity-comment-meta">
            <span>${c.uid.slice(0,6)}...${c.uid.slice(-4)}</span>
            ${c.donorAmount > 0 ? `<span class="donor-badge">Donor: ${Number(c.donorAmount).toFixed(0)} ${coinUnit}</span>` : ''}
          </div>
          <div class="charity-comment-text">${c.content}</div>
        </div>
      `).join('') || `<div style="color:var(--muted);text-align:center;padding:10px;">${t('lotteryNoComments')}</div>`;
    } catch {}
  }

  async function postComment() {
    if (!currentProject) return;
    const input = $('charityCommentInput');
    const content = input.value.trim();
    if (!content) return;
    try {
      await api('/charity/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: state.uid, projectId: currentProject.projectId, content }),
      });
      input.value = '';
      loadComments(currentProject.projectId);
      const p = await api('/charity/project/' + currentProject.projectId);
      currentProject = p;
      renderDetail(p);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  function showView(viewId) {
    document.querySelectorAll('.panel').forEach(v => v.classList.add('hide'));
    const el = $(viewId);
    if (el) el.classList.remove('hide');
  }

  function backToList() {
    document.querySelectorAll('.panel').forEach(v => v.classList.add('hide'));
    const el = $('tab-lottery');
    if (el) el.classList.remove('hide');
    if (typeof Lottery !== 'undefined' && Lottery.refresh) Lottery.refresh();
  }

  window.Charity = {
    renderCharitySection,
    openApply,
    handlePhotoUpload,
    submitApply,
    openDetail,
    donate,
    vote,
    postComment,
    backToList,
  };
})();
