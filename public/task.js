// task.js - ${t('taskSectionTitle')} (Task Marketplace) Frontend
(function () {
  const $ = (id) => document.getElementById(id);
  let currentJob = null;
  let currentDispute = null;

  function t(k) { return (typeof window.t === 'function') ? window.t(k) : k; }
  function api(path, body) {
    const doFetch = (opts) => fetch((localStorage.getItem('demoMode') === '1' || location.pathname.startsWith('/demo')) && !path.startsWith('/demo/') && !path.startsWith('http') ? '/demo' + path : path, opts).then(async r => {
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
  function coinUnit() { return t('coinUnitLottery') || 'coins'; }

  function showView(viewId) {
    document.querySelectorAll('.panel').forEach(v => v.classList.remove('active'));
    const el = $(viewId);
    if (el) el.classList.add('active');
    if (typeof applyI18n === 'function') applyI18n();
  }

  function backToList() {
    document.querySelectorAll('.panel').forEach(v => v.classList.remove('active'));
    const el = $('tab-lottery');
    if (el) el.classList.add('active');
    if (typeof Lottery !== 'undefined' && Lottery.refresh) Lottery.refresh();
  }

  function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
  }

  function statusLabel(s) {
    const map = {
      open: t('taskStatusOpen'), assigned: t('taskStatusAssigned'), in_progress: t('taskStatusInProgress'),
      delivered: t('taskStatusDelivered'), disputed: t('taskStatusDisputed'), completed: t('taskStatusCompleted'), cancelled: t('taskStatusCancelled')
    };
    return map[s] || s;
  }

  // ---- Render task section on lottery page ----
  async function renderTaskSection() {
    const container = $('taskSection');
    if (!container) return;
    try {
      const data = await api('/task/jobs?limit=4&status=open');
      const jobs = data.list || [];
      const cu = coinUnit();
      container.innerHTML = `
        <div class="task-section-header">
          <span class="task-section-title">${t('taskSectionTitle')}</span>
          <button onclick="Task.openCreate()" class="task-post-btn">+ ${t('taskPostBtn')}</button>
        </div>
        ${jobs.length === 0 ? `<div style="text-align:center;padding:15px;color:var(--muted);font-size:13px;">${t('taskNoTasks')}</div>` : `
        <div class="task-grid">
          ${jobs.map(j => `
            <div class="task-card" onclick="Task.openDetail('${j.jobId}')">
              <div class="task-card-title">${j.title}</div>
              <div class="task-card-loc">${j.location || 'Remote'}</div>
              <div class="task-card-reward">${Number(j.reward).toFixed(0)} ${cu}</div>
              <div class="task-card-status">${statusLabel(j.status)}</div>
            </div>
          `).join('')}
        </div>`}
        <div style="text-align:center;margin-top:8px;">
          <button onclick="Task.showAll()" class="task-view-all-btn">${t('taskViewAll')} →</button>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;padding:15px;color:var(--muted);">${t('taskLoadFail')}</div>`;
    }
  }

  // ---- Show all tasks page ----
  async function showAll() {
    showView('taskList');
    await loadTaskList();
  }

  async function loadTaskList(status = null) {
    try {
      const url = status ? `/task/jobs?limit=50&status=${status}` : '/task/jobs?limit=50';
      const data = await api(url);
      const jobs = data.list || [];
      const cu = coinUnit();
      $('taskListContent').innerHTML = `
        <div class="task-filter-bar">
          <button onclick="Task.loadTaskList(null)" class="task-filter-btn ${!status ? 'active' : ''}">${t('taskFilterAll')}</button>
          <button onclick="Task.loadTaskList('open')" class="task-filter-btn ${status === 'open' ? 'active' : ''}">${t('taskFilterOpen')}</button>
          <button onclick="Task.loadTaskList('assigned')" class="task-filter-btn ${status === 'assigned' ? 'active' : ''}">${t('taskFilterAssigned')}</button>
          <button onclick="Task.loadTaskList('completed')" class="task-filter-btn ${status === 'completed' ? 'active' : ''}">${t('taskFilterDone')}</button>
          <button onclick="Task.openCreate()" class="task-post-btn-inline">+ ${t('taskPostBtn')}</button>
        </div>
        ${jobs.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--muted);">${t('taskNoTasks')}</div>` : `
        <div class="task-list">
          ${jobs.map(j => `
            <div class="task-list-item" onclick="Task.openDetail('${j.jobId}')">
              <div class="task-list-main">
                <div class="task-list-title">${j.title}</div>
                <div class="task-list-meta">${j.location || 'Remote'} · ${formatTime(j.createdAt)}</div>
              </div>
              <div class="task-list-right">
                <div class="task-list-reward">${Number(j.reward).toFixed(0)} ${cu}</div>
                <div class="task-list-status status-${j.status}">${statusLabel(j.status)}</div>
              </div>
            </div>
          `).join('')}
        </div>`}
      `;
    } catch (e) {
      $('taskListContent').innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">${t('taskError')}: ${e.message}</div>`;
    }
  }

  // ---- My tasks ----
  async function showMyTasks() {
    showView('taskMy');
    try {
      const data = await api('/task/my');
      const jobs = data.list || [];
      const cu = coinUnit();
      $('taskMyContent').innerHTML = jobs.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--muted);">${t('taskNoTasks')}</div>` : `
        <div class="task-list">
          ${jobs.map(j => `
            <div class="task-list-item" onclick="Task.openDetail('${j.jobId}')">
              <div class="task-list-main">
                <div class="task-list-title">${j.title}</div>
                <div class="task-list-meta">${j.uid === getUid() ? t('taskPostedByMe') : t('taskAssignedToMe')} · ${statusLabel(j.status)}</div>
              </div>
              <div class="task-list-right">
                <div class="task-list-reward">${Number(j.reward).toFixed(0)} ${cu}</div>
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch (e) {
      $('taskMyContent').innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">Error: ${e.message}</div>`;
    }
  }

  // ---- Open create form ----
  function openCreate() {
    showView('taskCreate');
    $('taskCreateForm').reset();
    const preview = $('taskImagePreview');
    if (preview) preview.style.display = 'none';
    const data = $('taskImageData');
    if (data) data.value = '';
    const err = $('taskCreateError');
    if (err) err.style.display = 'none';
    updateCharCount('taskTitle', 'titleCount', 16);
    updateCharCount('taskDesc', 'descCount', 30);
  }

  // ---- Image upload ----
  function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('taskImageTooLarge'));
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
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
        $('taskImagePreview').src = compressed;
        $('taskImagePreview').style.display = 'block';
        $('taskImageData').value = compressed;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---- Char count helper ----
  function updateCharCount(inputName, countId, min) {
    const form = $('taskCreateForm');
    if (!form) return;
    const val = form[inputName] ? form[inputName].value : '';
    const el = $(countId);
    if (el) {
      el.textContent = val.length;
      el.style.color = val.length >= min ? '#22c55e' : 'var(--muted)';
    }
  }

  function showCreateError(msg) {
    const el = $('taskCreateError');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }

  // ---- Submit create ----
  async function submitCreate() {
    const form = $('taskCreateForm');
    const title = form.taskTitle.value.trim();
    const description = form.taskDesc.value.trim();
    const location = form.taskLocation.value.trim();
    const reward = parseInt(form.taskReward.value);
    const image = $('taskImageData').value;

    // Validation
    if (!title) { showCreateError(t('taskTitleRequired')); return; }
    if (title.length < 16) { showCreateError(t('taskTitleMin') + ' (' + title.length + '/16)'); return; }
    // No punctuation or spaces allowed
    if (/[\s\p{P}\p{S}]/u.test(title)) { showCreateError(t('taskTitleNoPunct')); return; }
    if (!description) { showCreateError(t('taskDescRequired')); return; }
    if (description.length < 30) { showCreateError(t('taskDescMin') + ' (' + description.length + '/30)'); return; }
    if (!reward || reward < 1) { showCreateError(t('taskRewardInvalid')); return; }
    if (!image) { showCreateError(t('taskImageRequired')); return; }

    try {
      const res = await api('/task/create', {
        uid: getUid(), title, description, location, reward, image,
      });
      alert(t('taskPostedSuccess') + ' ' + reward + ' ' + coinUnit());
      backToList();
      renderTaskSection();
    } catch (e) {
      showCreateError(t('taskPostFail') + ': ' + e.message);
    }
  }

  // ---- Open detail ----
  async function openDetail(jobId) {
    try {
      const job = await api('/task/job/' + jobId);
      currentJob = job;
      showView('taskDetail');
      await renderDetail(job);
    } catch (e) {
      alert(t('taskLoadFail') + ': ' + e.message);
    }
  }

  async function renderDetail(job) {
    const cu = coinUnit();
    const myUid = getUid();
    const isPoster = job.uid === myUid;
    const isWorker = job.assignedUid === myUid;
    const applications = job.status === 'open' ? await api('/task/applications/' + job.jobId).then(d => d.list || []).catch(() => []) : [];
    const messages = await api('/task/messages/' + job.jobId).then(d => d.list || []).catch(() => []);
    const deliveries = (job.status === 'delivered' || job.status === 'completed' || job.status === 'disputed') ? await api('/task/deliveries/' + job.jobId).then(d => d.list || []).catch(() => []) : [];
    const dispute = (job.status === 'disputed') ? await api('/task/dispute/' + job.jobId).catch(() => null) : null;

    let actionHtml = '';
    if (job.status === 'open' && !isPoster) {
      actionHtml = `
        <div class="task-action-box">
          <textarea id="taskApplyMsg" placeholder="${t('taskApplyMsg')}" rows="3"></textarea>
          <button onclick="Task.apply()" class="btn-primary" style="width:100%;margin-top:8px;">${t('taskApply')}</button>
        </div>`;
    }
    if (job.status === 'open' && isPoster && applications.length > 0) {
      actionHtml = `
        <div class="task-applications-box">
          <div class="task-box-title">${t('taskApplications')} (${applications.length})</div>
          ${applications.map(a => `
            <div class="task-application">
              <div class="task-applicant">${a.uid.slice(0, 8)}...${a.uid.slice(-6)}</div>
              <div class="task-apply-msg">${a.message || '-'}</div>
              ${a.status === 'pending' ? `<button onclick="Task.accept('${a.applicationId}')" class="btn-primary" style="padding:4px 12px;font-size:12px;">${t('taskAccept')}</button>` : `<span class="task-apply-status">${a.status}</span>`}
            </div>
          `).join('')}
        </div>`;
    }
    if (job.status === 'assigned' && isWorker) {
      actionHtml = `
        <div class="task-action-box">
          <div class="task-box-title">${t('taskDeliverTitle')}</div>
          <textarea id="taskDeliveryContent" placeholder="${t('taskDeliveryPh')}" rows="3"></textarea>
          <input type="file" id="taskDeliveryProof" accept="image/*" style="margin:8px 0;font-size:12px;" />
          <button onclick="Task.submitDelivery()" class="btn-primary" style="width:100%;">${t('taskSubmitDelivery')}</button>
        </div>`;
    }
    if (job.status === 'delivered' && isPoster) {
      actionHtml = `
        <div class="task-action-box">
          <div class="task-box-title">${t('taskConfirmTitle')}</div>
          <p style="font-size:13px;color:var(--muted);">${t('taskAutoReleaseNote')}</p>
          <div style="display:flex;gap:8px;">
            <button onclick="Task.confirmDelivery()" class="btn-primary" style="flex:1;background:#16a34a;">${t('taskConfirmRelease')}</button>
            <button onclick="Task.refusePayment()" class="btn-primary" style="flex:1;background:#ef4444;">${t('taskDispute')}</button>
          </div>
        </div>`;
    }
    if ((job.status === 'assigned' || job.status === 'open') && isPoster) {
      actionHtml += `
        <div style="margin-top:10px;">
          <button onclick="Task.requestRefund()" class="btn-primary" style="width:100%;background:#f59e0b;font-size:13px;">${t('taskCancelRefund')}</button>
        </div>`;
    }
    if (job.status === 'disputed' && dispute) {
      const myVote = await api('/task/vote/check', { disputeId: dispute.disputeId }).catch(() => null);
      actionHtml = `
        <div class="task-dispute-box">
          <div class="task-box-title">${t('taskDisputeTitle')}: ${dispute.type}</div>
          <p style="font-size:13px;">${dispute.reason}</p>
          <div style="display:flex;gap:10px;margin:10px 0;">
            <span>👍 ${t('taskVoteSupport')}: ${dispute.supportVotes}</span>
            <span>👎 ${t('taskVoteOppose')}: ${dispute.opposeVotes}</span>
          </div>
          ${dispute.status === 'voting' ? `
            <div style="display:flex;gap:8px;">
              <button onclick="Task.voteDispute('${dispute.disputeId}', true)" class="btn-primary" style="flex:1;background:#16a34a;">👍 ${t('taskVoteSupport')}</button>
              <button onclick="Task.voteDispute('${dispute.disputeId}', false)" class="btn-primary" style="flex:1;background:#ef4444;">👎 ${t('taskVoteOppose')}</button>
            </div>
            <p style="font-size:11px;color:var(--muted);margin-top:5px;">${t('taskVoteNote')}</p>
          ` : `<div style="color:var(--gold);">${t('taskAdminDecision')}: ${dispute.adminDecision || 'pending'}</div>`}
        </div>`;
    }
    if (job.status === 'assigned' && isWorker) {
      actionHtml += `
        <div style="margin-top:10px;">
          <button onclick="Task.agreeRefund()" class="btn-primary" style="width:100%;background:#f59e0b;font-size:13px;">${t('taskAgreeRefund')}</button>
        </div>`;
    }

    $('taskDetailContent').innerHTML = `
      <div class="task-detail-header">
        <h2>${job.title}</h2>
        <div class="task-detail-meta">
          <span>📍 ${job.location || 'Remote'}</span>
          <span>💰 ${Number(job.reward).toFixed(0)} ${cu}</span>
          <span class="status-${job.status}">${statusLabel(job.status)}</span>
        </div>
        <div class="task-detail-parties">
          <span>${t('taskPoster')}: ${job.uid.slice(0, 8)}...${job.uid.slice(-6)}</span>
          ${job.assignedUid ? `<span>${t('taskWorker')}: ${job.assignedUid.slice(0, 8)}...${job.assignedUid.slice(-6)}</span>` : ''}
        </div>
      </div>
      ${job.image ? `<img src="${job.image}" style="width:100%;border-radius:12px;margin-bottom:12px;" alt="Task image" />` : ''}
      <div class="task-desc-box">
        <div class="task-box-title">${t('taskDescription')}</div>
        <p>${job.description}</p>
      </div>
      ${deliveries.length > 0 ? `
      <div class="task-desc-box">
        <div class="task-box-title">${t('taskDeliveryProof')}</div>
        ${deliveries.map(d => `
          <div class="task-delivery">
            <div style="font-size:12px;color:var(--muted);">${formatTime(d.createdAt)}</div>
            <p>${d.content}</p>
            ${d.proof ? `<img src="${d.proof}" style="max-width:100%;border-radius:8px;margin-top:8px;" />` : ''}
          </div>
        `).join('')}
      </div>` : ''}
      ${actionHtml}
      <div class="task-messages-box">
        <div class="task-box-title">${t('taskDiscussion')} (${messages.length})</div>
        <div id="taskMessagesList" class="task-messages-list">
          ${messages.map(m => `
            <div class="task-message">
              <span class="task-msg-user">${m.uid.slice(0, 6)}...${m.uid.slice(-4)}</span>
              <span class="task-msg-text">${m.content}</span>
            </div>
          `).join('') || '<div style="color:var(--muted);font-size:12px;">' + t('taskNoMessages') + '</div>'}
        </div>
        <div class="task-msg-input">
          <input type="text" id="taskMsgInput" placeholder="${t('taskMsgPh')}" maxlength="1000" />
          <button onclick="Task.postMessage()" class="btn-primary" style="padding:6px 14px;">${t('taskSend')}</button>
        </div>
      </div>
    `;
  }

  // ---- Apply ----
  async function apply() {
    const msg = $('taskApplyMsg').value.trim();
    if (currentJob.uid === getUid()) { alert(t('taskCannotApplyOwn')); return; }
    try {
      await api('/task/apply', { uid: getUid(), jobId: currentJob.jobId, message: msg });
      alert(t('taskApplySuccess'));
      await renderDetail(currentJob);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Accept application ----
  async function accept(applicationId) {
    if (!confirm(t('taskAcceptConfirm'))) return;
    try {
      await api('/task/accept', { uid: getUid(), jobId: currentJob.jobId, applicationId });
      alert(t('taskAcceptSuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Submit delivery ----
  async function submitDelivery() {
    const content = $('taskDeliveryContent').value.trim();
    const fileInput = $('taskDeliveryProof');
    let proof = '';
    if (fileInput.files[0]) {
      const reader = new FileReader();
      proof = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
      });
    }
    if (!content && !proof) { alert(t('taskDeliveryRequired')); return; }
    try {
      await api('/task/deliver', { uid: getUid(), jobId: currentJob.jobId, content, proof });
      alert(t('taskDeliverySuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Confirm delivery ----
  async function confirmDelivery() {
    const rating = prompt(t('taskRateWorker'), '5');
    if (!rating) return;
    const review = prompt(t('taskLeaveReview'), '') || '';
    try {
      await api('/task/confirm', { uid: getUid(), jobId: currentJob.jobId, rating: parseInt(rating), reviewContent: review });
      alert(t('taskConfirmSuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Refuse payment (dispute) ----
  async function refusePayment() {
    const reason = prompt(t('taskDisputeReason'));
    if (!reason) return;
    try {
      await api('/task/refuse', { uid: getUid(), jobId: currentJob.jobId, reason });
      alert(t('taskDisputeSuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Request refund (poster cancels) ----
  async function requestRefund() {
    const reason = prompt(t('taskRefundReason'));
    if (!reason) return;
    try {
      const res = await api('/task/refund', { uid: getUid(), jobId: currentJob.jobId, reason });
      if (res.status === 'cancelled') {
        alert(t('taskRefundCancelled'));
      } else {
        alert(t('taskRefundSent'));
      }
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Worker agrees to refund ----
  async function agreeRefund() {
    if (!confirm(t('taskAgreeRefundConfirm'))) return;
    try {
      await api('/task/refund/agree', { uid: getUid(), jobId: currentJob.jobId });
      alert(t('taskAgreeRefundSuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Vote on dispute ----
  async function voteDispute(disputeId, support) {
    try {
      await api('/task/vote', { uid: getUid(), disputeId, support });
      alert(t('taskVoteSuccess'));
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  // ---- Post message ----
  async function postMessage() {
    const input = $('taskMsgInput');
    const content = input.value.trim();
    if (!content) return;
    try {
      await api('/task/message', { uid: getUid(), jobId: currentJob.jobId, content });
      input.value = '';
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert(t('taskError') + ': ' + e.message);
    }
  }

  window.Task = {
    renderTaskSection,
    showAll,
    loadTaskList,
    showMyTasks,
    openCreate,
    handleImageUpload,
    submitCreate,
    openDetail,
    apply,
    accept,
    submitDelivery,
    confirmDelivery,
    refusePayment,
    requestRefund,
    agreeRefund,
    voteDispute,
    postMessage,
    backToList,
    updateCharCount,
  };
})();
