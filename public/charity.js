// charity.js - Difficulty Charity Relief Application Frontend
(function () {
  const $ = (id) => document.getElementById(id);
  let currentProject = null;
  let myVote = null;

  function t(k) { return (typeof window.t === 'function') ? window.t(k) : k; }
  function api(path, body) {
    const doFetch = (opts) => fetch(path, opts).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error) {
        throw new Error(data.error || data.message || ('HTTP ' + r.status));
      }
      return data;
    });
    if (body && (body.method || body.headers)) {
      return doFetch(body);
    }
    if (body === undefined || body === null) {
      return doFetch({});
    }
    return doFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  function getUid() { return localStorage.getItem('uid'); }

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
              <div class="charity-img-wrap">
                <span class="charity-round-badge">${p.projectId}</span>
                <img src="${p.photo}" class="charity-img" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23333%22 width=%22200%22 height=%22200%22/><text x=%22100%22 y=%22100%22 fill=%22%23666%22 font-size=%2216%22 text-anchor=%22middle%22>No Image</text></svg>'" />
              </div>
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
      alert(t('charityImgTooLarge') || 'Image too large, max 2MB');
      return;
    }
    const nameEl = $('charityPhotoName');
    if (nameEl) nameEl.textContent = file.name;
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

  // ---- Proof upload ----
  function handleProofUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('charityImgTooLarge') || 'Image too large, max 2MB');
      return;
    }
    const nameEl = $('charityProofName');
    if (nameEl) nameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        $('charityProofPreview').src = compressed;
        $('charityProofPreview').style.display = 'block';
        $('charityProofData').value = compressed;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ---- Submit application ----
  async function submitApply() {
    console.log('submitApply called, editMode=', window._charityEditMode);
    try {
      const form = $('charityApplyForm');
      if (!form) { alert('Form not found'); return; }
      const photoData = $('charityPhotoData').value;
      if (!photoData) {
        alert(t('charityPhotoRequired') || (t('charityPhoto') + ' required'));
        return;
      }
      // Use base64 directly - stored in DB, no filesystem dependency
      const proofData = $('charityProofData').value || '';
      const isEdit = !!window._charityEditMode;

      const name = form.charityName ? form.charityName.value : '';
      const gender = form.charityGender ? form.charityGender.value : 'unknown';
      const country = form.charityCountry ? form.charityCountry.value : '';
      const city = form.charityCity ? form.charityCity.value : '';
      const helpType = form.charityHelpType ? form.charityHelpType.value : '';
      const reason = form.charityReason ? form.charityReason.value : '';
      const amount = form.charityAmount ? (parseInt(form.charityAmount.value) || 100) : 100;

      if (!name) { alert('Name is required'); return; }
      if (!country) { alert('Country is required'); return; }
      if (!helpType) { alert('Help type is required'); return; }
      if (!reason) { alert('Reason is required'); return; }

      let res;
      if (isEdit) {
        const updateData = {
          uid: getUid(),
          projectId: window._charityEditMode,
          name, gender, photo: photoData, country, city, helpType, reason, proof: proofData,
        };
        res = await api('/charity/update', updateData);
        alert('Project updated successfully!');
        window._charityEditMode = null;
        if (form.charityAmount) {
          form.charityAmount.readOnly = false;
          form.charityAmount.style.opacity = '1';
        }
      } else {
        const data = {
          uid: getUid(), name, gender, photo: photoData, country, city, helpType, reason,
          targetAmount: amount, proof: proofData,
        };
        res = await api('/charity/create', data);
        alert(t('charitySubmitted') || 'Submitted successfully!');
      }
      showView('lottery');
      renderCharitySection();
    } catch (e) {
      console.error('Charity submit error:', e);
      alert('Submit failed: ' + (e.message || 'Unknown error') + '\nPlease check console for details.');
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
      // Show manage buttons if creator or admin
      const myUid = getUid();
      const isCreator = myUid === p.uid;
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      const btnContainer = $('charityManageButtons');
      if (btnContainer && (isCreator || isAdmin) && p.status === 'active') {
        btnContainer.innerHTML = `
          <button onclick="Charity.editProject()" class="btn-primary" style="flex:1;background:#3b82f6;">Edit</button>
          <button onclick="Charity.deleteProject()" class="btn-primary" style="flex:1;background:#ef4444;">Delete</button>
        `;
      } else if (btnContainer) {
        btnContainer.innerHTML = '';
      }
    } catch (e) {
      alert(t('charityLoadFail') || 'Failed to load project');
    }
  }

  // ---- Edit project (open apply form with prefilled data) ----
  function editProject() {
    if (!currentProject) return;
    const p = currentProject;
    const form = $('charityApplyForm');
    form.charityName.value = p.name || '';
    form.charityGender.value = p.gender || 'unknown';
    form.charityCountry.value = p.country || '';
    form.charityCity.value = p.city || '';
    form.charityHelpType.value = p.helpType || '';
    form.charityReason.value = p.reason || '';
    form.charityAmount.value = p.targetAmount || 100;
    form.charityAmount.readOnly = true;
    form.charityAmount.style.opacity = '0.6';
    $('charityPhotoData').value = p.photo || '';
    $('charityProofData').value = p.proof || '';
    // Show photo preview if exists
    const photoPreview = $('charityPhotoPreview');
    if (photoPreview && p.photo) {
      photoPreview.src = p.photo;
      photoPreview.style.display = 'block';
    }
    const proofPreview = $('charityProofPreview');
    if (proofPreview && p.proof) {
      proofPreview.src = p.proof;
      proofPreview.style.display = 'block';
    }
    // Set edit mode flag
    window._charityEditMode = p.projectId;
    showView('charityApply');
  }

  // ---- Delete project ----
  async function deleteProject() {
    if (!currentProject) return;
    if (!confirm('Are you sure you want to delete this project? All donations will be refunded.')) return;
    try {
      await api('/charity/delete', { uid: getUid(), projectId: currentProject.projectId });
      alert('Project deleted successfully');
      showView('lottery');
      renderCharitySection();
    } catch (e) {
      alert('Delete failed: ' + e.message);
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
        ${p.proof ? `<div style="margin-top:15px;padding:12px;background:var(--card2);border-radius:10px;border:1px solid var(--line);"><div style="color:var(--gold);font-weight:700;font-size:14px;margin-bottom:8px;">Proof of Need</div><img src="${p.proof}" style="max-width:100%;border-radius:8px;border:1px solid var(--border);display:block;margin:0 auto;" alt="Proof" /></div>` : ''}
      </div>
      <div class="charity-desc-box" style="margin-top:12px;">
        <div class="charity-desc-title">${t('charityPrizeTitle') || 'Prize Distribution'}</div>
        <div style="font-size:13px;line-height:1.8;color:var(--text);">
          <div style="margin-bottom:6px;"><strong>${t('charityPrizeGoal') || 'Goal = Requested x 5'}</strong></div>
          <div style="margin-bottom:4px;">${t('charityPrizeRecipient') || 'Recipient: 20%'}</div>
          <div style="margin-bottom:4px;">${t('charityPrize1st') || '1st Prize: 30% (1 winner)'}</div>
          <div style="margin-bottom:4px;">${t('charityPrize2nd') || '2nd Prize: 10% each (2 winners)'}</div>
          <div style="margin-bottom:4px;">${t('charityPrize3rd') || '3rd Prize: 2% each (10 winners)'}</div>
          <div style="margin-bottom:4px;">${t('charityPrizePlatform') || 'Platform: 10%'}</div>
          <div style="margin-top:8px;color:var(--muted);font-size:12px;">${t('charityPrizeNote') || 'Each 1 coin donated = 1 lottery ticket. Winners drawn randomly when goal reached. Donations not refunded if not won.'}</div>
        </div>
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
      <div id="charityManageButtons" style="display:flex;gap:10px;margin:15px 0;"></div>
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
        body: JSON.stringify({ uid: getUid(), projectId: currentProject.projectId, amount }),
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
        body: JSON.stringify({ uid: getUid(), projectId: currentProject.projectId, support }),
      });
      if (res.projectId) {
        alert('OK');
        const p = await api('/charity/project/' + currentProject.projectId);
        currentProject = p;
        renderDetail(p);
      } else {
        alert(res.message || (t('charitySubmitFail') || 'Failed'));
      }
    } catch (e) {
      alert((t('charityError') || 'Error') + ': ' + e.message);
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
        body: JSON.stringify({ uid: getUid(), projectId: currentProject.projectId, content }),
      });
      input.value = '';
      loadComments(currentProject.projectId);
      const p = await api('/charity/project/' + currentProject.projectId);
      currentProject = p;
      renderDetail(p);
    } catch (e) {
      alert((t('charityError') || 'Error') + ': ' + e.message);
    }
  }

  function showView(viewId) {
    document.querySelectorAll('.panel').forEach(v => v.classList.remove('active'));
    const el = $(viewId);
    if (el) el.classList.add('active');
  }

  function backToList() {
    document.querySelectorAll('.panel').forEach(v => v.classList.remove('active'));
    const el = $('tab-lottery');
    if (el) el.classList.add('active');
    if (typeof Lottery !== 'undefined' && Lottery.refresh) Lottery.refresh();
  }

  window.Charity = {
    renderCharitySection,
    openApply,
    handlePhotoUpload,
    handleProofUpload,
    submitApply,
    openDetail,
    editProject,
    deleteProject,
    donate,
    vote,
    postComment,
    backToList,
  };
})();
