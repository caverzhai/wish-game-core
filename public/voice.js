// =============================================================
// voice.js - voice rooms (chat rooms + meeting room real-time calls)
// Depends on app.js globals: $, api, t, state, fmt, escapeHtml, I18N, alignWallet
// =============================================================
(function () {
  // Supplement i18n (en/zh-TW/ja, others fall back to English)
  const V = {
    en: {
      voiceTitle: 'Voice Rooms', createRoom: 'Create Room', chatRoom: 'Chat Room', meetingRoom: 'Meeting',
      roomNamePh: 'Room name (optional)', rechargeAmountPh: 'Recharge (min 1 / 5)', confirmCreate: 'Create', cancel: 'Cancel',
      recharge: 'Recharge', send: 'Send', saySomething: 'Say something…', micOn: 'Mic ON', micOff: 'Mic OFF',
      inviteGuest: 'Invite guest', remain: 'Remain', people: 'people', noRooms: 'No rooms yet. Create one!',
      roomClosed: 'Room closed', recording: 'Recording…', max30s: 'max 30s', sendVoice: 'Voice', sendImage: 'Image',
      chatDesc: 'Everyone: text / voice (≤30s) / image', meetDesc: 'Host+1 guest live audio, others text/image',
      minRecharge: 'Min recharge', balanceShort: 'Balance short', roomClosedTip: 'This room has been closed.',
      share: 'Share', dissolveRoom: 'Dissolve', dissolveConfirm: 'Dissolve this room?', shareCopied: 'Share link copied!', addTime: 'Add Time', addTimeTip: 'Enter amount to extend room time',
      host: 'Host:', roomDescPh: 'Room description (optional, 200 chars)', editDescTip: 'Edit room description (200 chars):', hostNotice: 'Host Notice',
    },
    'zh-TW': {
      voiceTitle: '語音房', createRoom: '開房', chatRoom: '聊天室', meetingRoom: '會議室',
      roomNamePh: '房間名（可選）', rechargeAmountPh: '充值（最低1/5枚）', confirmCreate: '確認開房', cancel: '取消',
      recharge: '充值', send: '發送', saySomething: '說點什麼…', micOn: '開麥', micOff: '關麥',
      inviteGuest: '邀請嘉賓', remain: '剩餘', people: '人', noRooms: '還沒有房間，來開第一個！',
      roomClosed: '房間已關閉', recording: '錄音中…', max30s: '最長30秒', sendVoice: '語音', sendImage: '圖片',
      chatDesc: '所有人：文字/語音(≤30秒)/圖片', meetDesc: '主持+1嘉賓實時語音，其余打字/發圖',
      minRecharge: '最低充值', balanceShort: '餘額不足', roomClosedTip: '該房間已關閉。',
      share: '分享', dissolveRoom: '解散', dissolveConfirm: '確定解散房間？', shareCopied: '分享連結已複製！', addTime: '增加時間', addTimeTip: '輸入枚數延長房間時間',
      host: '房主：', roomDescPh: '房間說明（選填，200字內，話題/規則）', editDescTip: '編輯房間說明（200字）：', hostNotice: '房主聲明',
    },
    ja: {
      voiceTitle: 'ボイスルーム', createRoom: 'ルーム作成', chatRoom: 'チャットルーム', meetingRoom: '会議室',
      roomNamePh: '部屋名（任意）', rechargeAmountPh: 'チャージ（最低1/5）', confirmCreate: '作成', cancel: 'キャンセル',
      recharge: 'チャージ', send: '送信', saySomething: '何か話す…', micOn: 'マイクON', micOff: 'マイクOFF',
      inviteGuest: 'ゲスト招待', remain: '残り', people: '人', noRooms: 'まだ部屋がありません',
      roomClosed: '部屋は終了しました', recording: '録音中…', max30s: '最長30秒', sendVoice: 'ボイス', sendImage: '画像',
      chatDesc: '全員：テキスト/音声(≤30秒)/画像', meetDesc: '主催+1ゲストがライブ音声、他はテキスト/画像',
      minRecharge: '最低チャージ', balanceShort: '残高不足', roomClosedTip: 'この部屋は終了しました。',
      share: '共有', dissolveRoom: '解散', dissolveConfirm: '部屋を解散しますか？', shareCopied: '共有リンクをコピーしました！', addTime: '時間追加', addTimeTip: '時間延長のため枚数を入力',
      host: '主：', roomDescPh: '部屋説明（任意、200文字以内）', editDescTip: '部屋説明を編集（200文字）：', hostNotice: '主の宣言',
    },
  };
  for (const lang of Object.keys(V)) {
    if (I18N[lang]) Object.assign(I18N[lang], V[lang]);
  }
  const vt = (k) => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;

  // State
  let ws = null, curRoom = null, curMembers = [], curMsgs = [];
  let mediaRecorder = null, recordChunks = [], recordStart = 0, recordTimer = null;
  let localStream = null; // meeting room local mic stream
  const peerCons = new Map(); // uid -> RTCPeerConnection (speaker to listener / listener to speaker)
  const remoteAudios = new Map(); // uid -> audio element
  let roomTimer = null;

  // Sub-tab switching
  function bindSubTabs() {
    $('subTabBbs').onclick = () => {
      $('subTabBbs').classList.add('active'); $('subTabVoice').classList.remove('active');
      $('bbsView').classList.remove('hide'); $('voiceView').classList.add('hide');
    };
    $('subTabVoice').onclick = () => {
      $('subTabVoice').classList.add('active'); $('subTabBbs').classList.remove('active');
      $('voiceView').classList.remove('hide'); $('bbsView').classList.add('hide');
      loadRooms();
    };
  }

  // Room list
  async function loadRooms() {
    try {
      const rooms = await api('/voice/rooms');
      $('roomList').innerHTML = rooms.length ? rooms.map((r) => `
        <div class="room-card" data-rid="${r.roomId}">
          <div class="room-card-head">
            <b>${escapeHtml(r.name)}</b>
            <span class="room-type-tag ${r.type}">${r.type === 'chat' ? vt('chatRoom') : vt('meetingRoom')}</span>
          </div>
          <div class="room-card-meta">
            <span>${r.memberCount} ${vt('people')}</span>
            <span>${vt('remain')} ${fmtRemain(r.remainSec)}</span>
            ${r.rateMultiplier > 1 ? `<span class="rate-tag">${r.rateMultiplier}x</span>` : ''}
          </div>
        </div>`).join('') : `<p class="muted">${vt('noRooms')}</p>`;
      $('roomList').querySelectorAll('.room-card').forEach((c) => c.onclick = () => enterRoom(c.dataset.rid));
    } catch (e) { $('roomList').innerHTML = `<p class="muted">${e.message}</p>`; }
  }
  function fmtRemain(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  // Create room
  let createType = 'chat';
  function openCreateRoom() {
    createType = 'chat';
    document.querySelectorAll('.room-type').forEach((b) => b.classList.toggle('active', b.dataset.type === 'chat'));
    $('roomNameInput').value = ''; $('roomDescInput').value = '';
    $('createRoomMask').classList.remove('hide');
  }
  function closeCreateRoom() { $('createRoomMask').classList.add('hide'); }
  function bindCreateRoom() {
    $('createRoomBtn').onclick = openCreateRoom;
    $('cancelCreateRoom').onclick = closeCreateRoom;
    document.querySelectorAll('.room-type').forEach((b) => b.onclick = () => {
      createType = b.dataset.type;
      document.querySelectorAll('.room-type').forEach((x) => x.classList.toggle('active', x === b));
    });
    $('confirmCreateRoom').onclick = async () => {
      const amount = createType === 'chat' ? 1 : 5; // chat room default 1 unit, meeting room default 5 units
      const btn = $('confirmCreateRoom'); btn.disabled = true;
      try {
        await alignWallet();
        const r = await api('/voice/create', { uid: state.uid, type: createType, name: $('roomNameInput').value, amount, description: $('roomDescInput').value });
        closeCreateRoom();
        enterRoom(r.roomId);
      } catch (e) { alert(e.message || vt('balanceShort')); }
      finally { btn.disabled = false; }
    };
  }

  // Enter room
  async function enterRoom(roomId) {
    try {
      const detail = await api('/voice/room/' + roomId);
      curRoom = detail.room; curMembers = detail.members; curMsgs = detail.messages;
    } catch (e) { alert(vt('roomClosedTip')); return; }
    $('roomMask').classList.remove('hide');
    $('roomName').textContent = curRoom.name;
    renderRoomInfo(); renderMembers(); renderMsgs();
    connectWs(roomId);
    // Meeting room controls
    updateMeetingControls();
    // Room info periodic refresh (remaining time)
    if (roomTimer) clearInterval(roomTimer);
    roomTimer = setInterval(() => { if (curRoom) { curRoom.remainSec = Math.max(0, (curRoom.remainSec || 0) - 1); renderRoomInfo(); } }, 1000);
  }
  function connectWs(roomId) {
    if (ws) { try { ws.close(); } catch {} }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', roomId, uid: state.uid }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      onWsMsg(m);
    };
    ws.onclose = () => { /* auto-reconnect handled by leave/close */ };
    ws.onerror = () => {};
  }
  function onWsMsg(m) {
    switch (m.type) {
      case 'joined':
        curRoom = m.room; curMembers = m.members; curMsgs = m.messages || [];
        renderRoomInfo(); renderMembers(); renderMsgs(); updateMeetingControls();
        // Meeting room: auto-subscribe if there are speakers
        if (curRoom.type === 'meeting') setupListenToSpeakers();
        break;
      case 'msg':
        curMsgs.push(m.msg); if (curMsgs.length > 300) curMsgs.shift();
        appendMsg(m.msg); break;
      case 'members':
        curMembers = m.members; renderMembers(); updateMeetingControls();
        if (curRoom.type === 'meeting') setupListenToSpeakers(); break;
      case 'room':
        curRoom = m.room; renderRoomInfo(); break;
      case 'closed':
        alert(vt('roomClosedTip')); leaveRoom(); break;
      case 'rtc':
        handleRtc(m.from, m.data); break;
      case 'error':
        alert(m.message); break;
    }
  }
  function wsSend(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  function renderRoomInfo() {
    if (!curRoom) return;
    $('roomRemain').textContent = `${vt('remain')} ${fmtRemain(curRoom.remainSec)}`;
    $('roomHost').textContent = `${vt('host')} ${curRoom.hostUid}`;
    $('roomDissolveBtn').classList.toggle('hide', curRoom.hostUid !== state.uid);
    const descEl = $('roomDesc');
    if (curRoom.description) {
      $('roomDescBox').textContent = curRoom.description;
      descEl.classList.remove('hide');
    } else {
      descEl.classList.add('hide');
    }
  }

  // Host can click room description to edit
  async function editRoomDesc() {
    if (!curRoom || curRoom.hostUid !== state.uid) return;
    const v = prompt(vt('editDescTip'), curRoom.description || '');
    if (v === null) return;
    try {
      const r = await api('/voice/edit-description', { uid: state.uid, roomId: curRoom.roomId, description: v });
      curRoom.description = r.description;
      renderRoomInfo();
    } catch (e) { alert(e.message); }
  }
  function renderMembers() {
    $('roomMembers').innerHTML = curMembers.map((m) => {
      const roleTag = m.role === 'host' ? '👑' : m.role === 'guest' ? '🎤' : '';
      const micDot = m.micOn ? '<span class="mic-dot on"></span>' : '';
      return `<span class="member-chip" data-uid="${m.uid}">${roleTag}${escapeHtml(m.name)}${micDot}</span>`;
    }).join('');
    // Host can click member to invite/remove guest
    if (curRoom && curRoom.type === 'meeting' && isHost()) {
      $('roomMembers').querySelectorAll('.member-chip').forEach((c) => c.onclick = () => {
        const uid = c.dataset.uid;
        if (uid === state.uid) return;
        const isGuest = curRoom.guestUid === uid;
        if (confirm(isGuest ? 'Remove guest?' : 'Invite as guest (can mic)?')) {
          wsSend({ type: 'setGuest', guestUid: uid, on: !isGuest });
        }
      });
    }
  }
  function renderMsgs() {
    $('roomMsgs').innerHTML = '';
    curMsgs.forEach(appendMsg);
  }
  function appendMsg(m) {
    const box = $('roomMsgs');
    const time = new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let body = '';
    if (m.type === 'text') body = `<span class="msg-text">${escapeHtml(m.content)}</span>`;
    else if (m.type === 'voice') body = `<button class="voice-msg" data-file="${m.file}">▶ ${m.duration || 0}s</button>`;
    else if (m.type === 'image') body = `<img class="msg-img" src="/voice/media/${m.file}" alt="img" />`;
    const div = document.createElement('div');
    div.className = 'room-msg' + (m.uid === state.uid ? ' mine' : '');
    div.innerHTML = `<small>${escapeHtml(m.name)} · ${time}</small>${body}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    // Voice playback
    div.querySelectorAll('.voice-msg').forEach((b) => b.onclick = () => {
      const src = '/voice/media/' + b.dataset.file;
      let a = b._audio;
      if (!a) { a = new Audio(src); b._audio = a; }
      if (a.paused) { a.play(); b.textContent = '⏸'; a.onended = () => { b.textContent = `▶ ${b.dataset.file ? '' : ''}`; b.textContent = '▶ ' + (b._dur || ''); }; }
      else { a.pause(); b.textContent = '▶'; }
    });
  }

  // Send text
  function sendText() {
    const input = $('roomTextInput'); const content = input.value.trim();
    if (!content) return;
    wsSend({ type: 'text', content });
    input.value = '';
  }

  // Recording (<=30s)
  async function toggleRecord() {
    if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecord(); return; }
    // Meeting room: non-host non-guest cannot send voice
    if (curRoom.type === 'meeting' && !isSpeaker()) { alert('Only host and guest can send voice in meeting room'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const duration = Math.round((Date.now() - recordStart) / 1000);
        const blob = new Blob(recordChunks, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        $('recordTip').classList.add('hide');
        if (duration >= 1) {
          try {
            const file = await uploadMedia('voice', blob, duration);
            wsSend({ type: 'voice', file, duration });
          } catch (e) { alert(e.message); }
        }
      };
      recordStart = Date.now();
      mediaRecorder.start();
      $('recordTip').classList.remove('hide');
      $('recordTime').textContent = '0';
      let sec = 0;
      recordTimer = setInterval(() => {
        sec++; $('recordTime').textContent = sec;
        if (sec >= 30) stopRecord();
      }, 1000);
      $('voiceRecordBtn').textContent = '⏹';
    } catch (e) { alert('Cannot access microphone: ' + e.message); }
  }
  function stopRecord() {
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    $('voiceRecordBtn').textContent = '🎤';
  }

  // Image (<=200K, auto-compress)
  function pickImage() { $('imageFileInput').click(); }
  async function onImagePicked(ev) {
    const file = ev.target.files[0]; if (!file) return;
    ev.target.value = '';
    try {
      const dataUrl = await compressImage(file, 200 * 1024);
      const base64 = dataUrl.split(',')[1];
      const mime = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      const r = await api('/voice/upload', { uid: state.uid, mime, data: base64 });
      wsSend({ type: 'image', file: r.file });
    } catch (e) { alert(e.message); }
  }
  function compressImage(file, maxBytes) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        const tryQ = () => {
          const d = canvas.toDataURL('image/jpeg', quality);
          if (d.length < maxBytes * 1.37 || quality <= 0.1) resolve(d);
          else { quality -= 0.15; tryQ(); }
        };
        tryQ();
      };
      img.onerror = () => reject(new Error('Image read failed'));
      img.src = url;
    });
  }

  // Upload media
  async function uploadMedia(type, blob, duration) {
    const buf = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    const r = await api('/voice/upload', { uid: state.uid, mime: blob.type || 'audio/webm', data: base64 });
    return r.file;
  }
  function arrayBufferToBase64(buf) {
    let s = ''; const bytes = new Uint8Array(buf); const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }

  // Recharge
  async function rechargeRoom() {
    const v = prompt(vt('addTimeTip') + ' (units):');
    const amount = Number(v);
    if (!Number.isInteger(amount) || amount <= 0) return;
    try {
      await alignWallet();
      await api('/voice/recharge', { uid: state.uid, roomId: curRoom.roomId, amount });
    } catch (e) { alert(e.message); }
  }

  // Share room (link with ref for upline binding + room auto-enter)
  function shareRoom() {
    if (!curRoom) return;
    const link = `${location.origin}${location.pathname}?ref=${state.uid}&room=${curRoom.roomId}`;
    navigator.clipboard?.writeText(link).then(() => alert(vt('shareCopied') + '\n' + link)).catch(() => prompt(vt('share'), link));
  }
  // Host dissolves room (double confirm)
  async function dissolveRoom() {
    if (!curRoom || curRoom.hostUid !== state.uid) return;
    if (!confirm(vt('dissolveConfirm'))) return;
    try {
      await api('/voice/dissolve', { uid: state.uid, roomId: curRoom.roomId });
      leaveRoom();
    } catch (e) { alert(e.message); }
  }

  // Leave room
  function leaveRoom() {
    wsSend({ type: 'leave' });
    if (ws) { try { ws.close(); } catch {} ws = null; }
    if (roomTimer) { clearInterval(roomTimer); roomTimer = null; }
    stopBroadcast();
    curRoom = null; curMembers = []; curMsgs = [];
    $('roomMask').classList.add('hide');
    loadRooms();
  }

  // Meeting room WebRTC
  function isHost() { return curRoom && curRoom.hostUid === state.uid; }
  function isSpeaker() {
    if (!curRoom || curRoom.type !== 'meeting') return false;
    const me = curMembers.find((m) => m.uid === state.uid);
    return me && (me.role === 'host' || me.role === 'guest');
  }
  function updateMeetingControls() {
    const box = $('meetingControls');
    if (!curRoom || curRoom.type !== 'meeting') { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    const micBtn = $('micBtn');
    const me = curMembers.find((m) => m.uid === state.uid);
    const canMic = me && (me.role === 'host' || me.role === 'guest');
    micBtn.style.display = canMic ? '' : 'none';
    micBtn.textContent = (me && me.micOn) ? vt('micOff') : vt('micOn');
    const guestBtn = $('guestListBtn');
    guestBtn.classList.toggle('hide', !isHost());
    guestBtn.textContent = curRoom.guestUid ? vt('inviteGuest') + ' ✓' : vt('inviteGuest');
  }
  async function toggleMic() {
    const me = curMembers.find((m) => m.uid === state.uid);
    const nowOn = !(me && me.micOn);
    wsSend({ type: 'mic', on: nowOn });
    if (nowOn) startBroadcast(); else stopBroadcast();
  }
  async function startBroadcast() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { alert('Cannot access microphone: ' + e.message); wsSend({ type: 'mic', on: false }); return; }
    // Create PC and send offer for each listener
    for (const m of curMembers) {
      if (m.uid === state.uid || m.micOn) continue; // only send to non-speakers
      await offerTo(m.uid, localStream);
    }
  }
  function stopBroadcast() {
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
    for (const pc of peerCons.values()) { try { pc.close(); } catch {} }
    peerCons.clear();
    for (const a of remoteAudios.values()) { try { a.pause(); } catch {} }
    remoteAudios.clear();
  }
  async function offerTo(uid, stream) {
    if (peerCons.has(uid)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerCons.set(uid, pc);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'rtc', to: uid, data: { candidate: e.candidate } }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsSend({ type: 'rtc', to: uid, data: { sdp: pc.localDescription } });
  }
  // Listener: receive offer from speaker
  async function handleRtc(from, data) {
    if (data.sdp && data.sdp.type === 'offer') {
      let pc = peerCons.get(from);
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerCons.set(from, pc);
        pc.ontrack = (e) => {
          let a = remoteAudios.get(from);
          if (!a) { a = new Audio(); remoteAudios.set(from, a); document.body.appendChild(a); }
          a.srcObject = e.streams[0]; a.play().catch(() => {});
        };
        pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'rtc', to: from, data: { candidate: e.candidate } }); };
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: 'rtc', to: from, data: { sdp: pc.localDescription } });
    } else if (data.sdp && data.sdp.type === 'answer') {
      const pc = peerCons.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.candidate) {
      const pc = peerCons.get(from);
      if (pc) try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
    }
  }
  // Speaker: proactively offer when new member joins
  function setupListenToSpeakers() {
    if (!curRoom || curRoom.type !== 'meeting') return;
    // If I am speaker, send offer to new non-speaker member
    if (localStream) {
      for (const m of curMembers) {
        if (m.uid !== state.uid && !m.micOn && !peerCons.has(m.uid)) {
          offerTo(m.uid, localStream);
        }
      }
    }
  }

  // Bindings
  function bind() {
    bindSubTabs();
    bindCreateRoom();
    $('roomBackBtn').onclick = leaveRoom;
    $('roomRechargeBtn').onclick = rechargeRoom;
    $('roomShareBtn').onclick = shareRoom;
    $('roomDissolveBtn').onclick = dissolveRoom;
    $('roomSendBtn').onclick = sendText;
    $('roomTextInput').onkeydown = (e) => { if (e.key === 'Enter') sendText(); };
    $('voiceRecordBtn').onclick = toggleRecord;
    $('imageBtn').onclick = pickImage;
    $('imageFileInput').onchange = onImagePicked;
    $('micBtn').onclick = toggleMic;
    $('guestListBtn').onclick = () => alert('Click member avatar in room to invite/remove guest');
    // voice.js dynamically added i18n keys need re-translation
    applyI18n();
    $('roomNameInput').placeholder = vt('roomNamePh');
    $('roomDescInput').placeholder = vt('roomDescPh');
    $('roomTextInput').placeholder = vt('saySomething');
    $('roomDescBox').onclick = editRoomDesc;
    // Share link auto-enter room: ?room=ROOM_ID (ref param already bound by login logic)
    const roomInvite = new URLSearchParams(location.search).get('room');
    if (roomInvite) {
      const t = setInterval(() => {
        if (state.uid) {
          clearInterval(t);
          history.replaceState(null, '', location.pathname);
          // Wait for main UI init
          setTimeout(() => enterRoom(roomInvite), 800);
        }
      }, 300);
    }
  }

  // Init after page load (app.js finished)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
