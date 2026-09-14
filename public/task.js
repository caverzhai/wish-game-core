// task.js - Find the Right Person (Task Marketplace) Frontend
(function () {
  const $ = (id) => document.getElementById(id);
  let currentJob = null;
  let currentDispute = null;

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
  function coinUnit() { return t('coinUnitLottery') || 'coins'; }

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

  function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
  }

  function statusLabel(s) {
    const map = {
      open: 'Open', assigned: 'Assigned', in_progress: 'In Progress',
      delivered: 'Delivered', disputed: 'Disputed', completed: 'Completed', cancelled: 'Cancelled'
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
          <span class="task-section-title">Find the Right Person</span>
          <button onclick="Task.openCreate()" class="task-post-btn">+ Post Task</button>
        </div>
        ${jobs.length === 0 ? `<div style="text-align:center;padding:15px;color:var(--muted);font-size:13px;">No tasks yet. Be the first to post!</div>` : `
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
          <button onclick="Task.showAll()" class="task-view-all-btn">View All Tasks →</button>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;padding:15px;color:var(--muted);">Failed to load tasks</div>`;
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
          <button onclick="Task.loadTaskList(null)" class="task-filter-btn ${!status ? 'active' : ''}">All</button>
          <button onclick="Task.loadTaskList('open')" class="task-filter-btn ${status === 'open' ? 'active' : ''}">Open</button>
          <button onclick="Task.loadTaskList('assigned')" class="task-filter-btn ${status === 'assigned' ? 'active' : ''}">Assigned</button>
          <button onclick="Task.loadTaskList('completed')" class="task-filter-btn ${status === 'completed' ? 'active' : ''}">Done</button>
          <button onclick="Task.openCreate()" class="task-post-btn-inline">+ Post</button>
        </div>
        ${jobs.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--muted);">No tasks found</div>` : `
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
      $('taskListContent').innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">Error: ${e.message}</div>`;
    }
  }

  // ---- My tasks ----
  async function showMyTasks() {
    showView('taskMy');
    try {
      const data = await api('/task/my');
      const jobs = data.list || [];
      const cu = coinUnit();
      $('taskMyContent').innerHTML = jobs.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--muted);">No tasks yet</div>` : `
        <div class="task-list">
          ${jobs.map(j => `
            <div class="task-list-item" onclick="Task.openDetail('${j.jobId}')">
              <div class="task-list-main">
                <div class="task-list-title">${j.title}</div>
                <div class="task-list-meta">${j.uid === getUid() ? 'Posted by me' : 'Assigned to me'} · ${statusLabel(j.status)}</div>
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
  }

  // ---- Submit create ----
  async function submitCreate() {
    const form = $('taskCreateForm');
    const title = form.taskTitle.value.trim();
    const description = form.taskDesc.value.trim();
    const location = form.taskLocation.value.trim();
    const reward = parseInt(form.taskReward.value);
    if (!title) { alert('Title is required'); return; }
    if (!description) { alert('Description is required'); return; }
    if (!reward || reward < 1) { alert('Reward must be a positive integer'); return; }
    try {
      const res = await api('/task/create', {
        uid: getUid(), title, description, location, reward,
      });
      alert('Task posted successfully! Reward escrowed: ' + reward + ' ' + coinUnit());
      backToList();
      renderTaskSection();
    } catch (e) {
      alert('Failed: ' + e.message);
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
      alert('Failed to load task: ' + e.message);
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
          <textarea id="taskApplyMsg" placeholder="Introduce yourself and why you're the right person..." rows="3"></textarea>
          <button onclick="Task.apply()" class="btn-primary" style="width:100%;margin-top:8px;">Apply for This Task</button>
        </div>`;
    }
    if (job.status === 'open' && isPoster && applications.length > 0) {
      actionHtml = `
        <div class="task-applications-box">
          <div class="task-box-title">Applications (${applications.length})</div>
          ${applications.map(a => `
            <div class="task-application">
              <div class="task-applicant">${a.uid.slice(0, 8)}...${a.uid.slice(-6)}</div>
              <div class="task-apply-msg">${a.message || '-'}</div>
              ${a.status === 'pending' ? `<button onclick="Task.accept('${a.applicationId}')" class="btn-primary" style="padding:4px 12px;font-size:12px;">Accept</button>` : `<span class="task-apply-status">${a.status}</span>`}
            </div>
          `).join('')}
        </div>`;
    }
    if (job.status === 'assigned' && isWorker) {
      actionHtml = `
        <div class="task-action-box">
          <div class="task-box-title">Submit Delivery</div>
          <textarea id="taskDeliveryContent" placeholder="Describe what you delivered..." rows="3"></textarea>
          <input type="file" id="taskDeliveryProof" accept="image/*" style="margin:8px 0;font-size:12px;" />
          <button onclick="Task.submitDelivery()" class="btn-primary" style="width:100%;">Submit Delivery Proof</button>
        </div>`;
    }
    if (job.status === 'delivered' && isPoster) {
      actionHtml = `
        <div class="task-action-box">
          <div class="task-box-title">Confirm Delivery</div>
          <p style="font-size:13px;color:var(--muted);">Auto-release in 15 days if no action.</p>
          <div style="display:flex;gap:8px;">
            <button onclick="Task.confirmDelivery()" class="btn-primary" style="flex:1;background:#16a34a;">Confirm & Release Payment</button>
            <button onclick="Task.refusePayment()" class="btn-primary" style="flex:1;background:#ef4444;">Dispute</button>
          </div>
        </div>`;
    }
    if ((job.status === 'assigned' || job.status === 'open') && isPoster) {
      actionHtml += `
        <div style="margin-top:10px;">
          <button onclick="Task.requestRefund()" class="btn-primary" style="width:100%;background:#f59e0b;font-size:13px;">Cancel & Request Refund</button>
        </div>`;
    }
    if (job.status === 'disputed' && dispute) {
      const myVote = await api('/task/vote/check', { disputeId: dispute.disputeId }).catch(() => null);
      actionHtml = `
        <div class="task-dispute-box">
          <div class="task-box-title">Dispute: ${dispute.type}</div>
          <p style="font-size:13px;">${dispute.reason}</p>
          <div style="display:flex;gap:10px;margin:10px 0;">
            <span>👍 Support: ${dispute.supportVotes}</span>
            <span>👎 Oppose: ${dispute.opposeVotes}</span>
          </div>
          ${dispute.status === 'voting' ? `
            <div style="display:flex;gap:8px;">
              <button onclick="Task.voteDispute('${dispute.disputeId}', true)" class="btn-primary" style="flex:1;background:#16a34a;">👍 Support</button>
              <button onclick="Task.voteDispute('${dispute.disputeId}', false)" class="btn-primary" style="flex:1;background:#ef4444;">👎 Oppose</button>
            </div>
            <p style="font-size:11px;color:var(--muted);margin-top:5px;">Only users with insurance nodes can vote. One vote per dispute.</p>
          ` : `<div style="color:var(--gold);">Admin decision: ${dispute.adminDecision || 'pending'}</div>`}
        </div>`;
    }
    if (job.status === 'assigned' && isWorker) {
      actionHtml += `
        <div style="margin-top:10px;">
          <button onclick="Task.agreeRefund()" class="btn-primary" style="width:100%;background:#f59e0b;font-size:13px;">Agree to Refund (cancel task)</button>
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
          <span>Poster: ${job.uid.slice(0, 8)}...${job.uid.slice(-6)}</span>
          ${job.assignedUid ? `<span>Worker: ${job.assignedUid.slice(0, 8)}...${job.assignedUid.slice(-6)}</span>` : ''}
        </div>
      </div>
      <div class="task-desc-box">
        <div class="task-box-title">Description</div>
        <p>${job.description}</p>
      </div>
      ${deliveries.length > 0 ? `
      <div class="task-desc-box">
        <div class="task-box-title">Delivery Proof</div>
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
        <div class="task-box-title">Discussion (${messages.length})</div>
        <div id="taskMessagesList" class="task-messages-list">
          ${messages.map(m => `
            <div class="task-message">
              <span class="task-msg-user">${m.uid.slice(0, 6)}...${m.uid.slice(-4)}</span>
              <span class="task-msg-text">${m.content}</span>
            </div>
          `).join('') || '<div style="color:var(--muted);font-size:12px;">No messages yet</div>'}
        </div>
        <div class="task-msg-input">
          <input type="text" id="taskMsgInput" placeholder="Say something..." maxlength="1000" />
          <button onclick="Task.postMessage()" class="btn-primary" style="padding:6px 14px;">Send</button>
        </div>
      </div>
    `;
  }

  // ---- Apply ----
  async function apply() {
    const msg = $('taskApplyMsg').value.trim();
    try {
      await api('/task/apply', { uid: getUid(), jobId: currentJob.jobId, message: msg });
      alert('Application submitted!');
      await renderDetail(currentJob);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Accept application ----
  async function accept(applicationId) {
    if (!confirm('Accept this applicant? The reward will be locked to this worker.')) return;
    try {
      await api('/task/accept', { uid: getUid(), jobId: currentJob.jobId, applicationId });
      alert('Applicant accepted!');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
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
    if (!content && !proof) { alert('Please provide delivery description or proof'); return; }
    try {
      await api('/task/deliver', { uid: getUid(), jobId: currentJob.jobId, content, proof });
      alert('Delivery submitted!');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Confirm delivery ----
  async function confirmDelivery() {
    const rating = prompt('Rate the worker (1-5):', '5');
    if (!rating) return;
    const review = prompt('Leave a review (optional):', '') || '';
    try {
      await api('/task/confirm', { uid: getUid(), jobId: currentJob.jobId, rating: parseInt(rating), reviewContent: review });
      alert('Payment released successfully!');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Refuse payment (dispute) ----
  async function refusePayment() {
    const reason = prompt('Why are you disputing this delivery?');
    if (!reason) return;
    try {
      await api('/task/refuse', { uid: getUid(), jobId: currentJob.jobId, reason });
      alert('Dispute opened! Community voting begins.');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Request refund (poster cancels) ----
  async function requestRefund() {
    const reason = prompt('Why do you want to cancel and request a refund?');
    if (!reason) return;
    try {
      const res = await api('/task/refund', { uid: getUid(), jobId: currentJob.jobId, reason });
      if (res.status === 'cancelled') {
        alert('Task cancelled, refund processed.');
      } else {
        alert('Refund request sent. Worker must agree, or it goes to community vote.');
      }
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Worker agrees to refund ----
  async function agreeRefund() {
    if (!confirm('Agree to refund? The task will be cancelled and reward returned to poster.')) return;
    try {
      await api('/task/refund/agree', { uid: getUid(), jobId: currentJob.jobId });
      alert('Refund agreed. Task cancelled.');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  // ---- Vote on dispute ----
  async function voteDispute(disputeId, support) {
    try {
      await api('/task/vote', { uid: getUid(), disputeId, support });
      alert('Vote recorded!');
      await openDetail(currentJob.jobId);
    } catch (e) {
      alert('Failed: ' + e.message);
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
      alert('Failed: ' + e.message);
    }
  }

  window.Task = {
    renderTaskSection,
    showAll,
    loadTaskList,
    showMyTasks,
    openCreate,
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
  };
})();
