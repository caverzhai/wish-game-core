// =============================================================
// voice.js —— 语音房（聊天室 + 会议室实时通话）
// 依赖 app.js 全局：$, api, t, state, fmt, escapeHtml, I18N, alignWallet
// =============================================================
(function () {
  // —— 补充 i18n（en/zh-TW/ja，其余回退英文）——
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
      host: 'Host:', roomDescPh: 'Room description (optional, 200 chars)', editDescTip: 'Edit room description (200 chars):',
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
      host: '房主：', roomDescPh: '房間說明（選填，200字內，話題/規則）', editDescTip: '編輯房間說明（200字）：',
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
      host: '主：', roomDescPh: '部屋説明（任意、200文字以内）', editDescTip: '部屋説明を編集（200文字）：',
    },
  };
  for (const lang of Object.keys(V)) {
    if (I18N[lang]) Object.assign(I18N[lang], V[lang]);
  }
  const vt = (k) => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;

  // —— 状态 ——
  let ws = null, curRoom = null, curMembers = [], curMsgs = [];
  let mediaRecorder = null, recordChunks = [], recordStart = 0, recordTimer = null;
  let localStream = null; // 会议室本地麦克风流
  const peerCons = new Map(); // uid -> RTCPeerConnection（上麦者对听众 / 听众对上麦者）
  const remoteAudios = new Map(); // uid -> audio element
  let roomTimer = null;

  // —— 子 tab 切换 ——
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

  // —— 房间列表 ——
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

  // —— 创建房间 ——
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
      const amount = createType === 'chat' ? 1 : 5; // 聊天室默认1枚，会议室默认5枚
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

  // —— 进入房间 ——
  async function enterRoom(roomId) {
    try {
      const detail = await api('/voice/room/' + roomId);
      curRoom = detail.room; curMembers = detail.members; curMsgs = detail.messages;
    } catch (e) { alert(vt('roomClosedTip')); return; }
    $('roomMask').classList.remove('hide');
    $('roomName').textContent = curRoom.name;
    renderRoomInfo(); renderMembers(); renderMsgs();
    connectWs(roomId);
    // 会议室控制
    updateMeetingControls();
    // 房间信息定时刷新（剩余时长）
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
    ws.onclose = () => { /* 自动重连由离开/关闭处理 */ };
    ws.onerror = () => {};
  }
  function onWsMsg(m) {
    switch (m.type) {
      case 'joined':
        curRoom = m.room; curMembers = m.members; curMsgs = m.messages || [];
        renderRoomInfo(); renderMembers(); renderMsgs(); updateMeetingControls();
        // 会议室：如果有上麦者，自动订阅
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
      descEl.textContent = curRoom.description;
      descEl.classList.remove('hide');
    } else {
      descEl.classList.add('hide');
    }
  }

  // 房主点击房间说明可编辑
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
    // 主持点击成员可邀请/取消嘉宾
    if (curRoom && curRoom.type === 'meeting' && isHost()) {
      $('roomMembers').querySelectorAll('.member-chip').forEach((c) => c.onclick = () => {
        const uid = c.dataset.uid;
        if (uid === state.uid) return;
        const isGuest = curRoom.guestUid === uid;
        if (confirm(isGuest ? '取消嘉宾？' : '邀请为嘉宾（可上麦）？')) {
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
    // 语音播放
    div.querySelectorAll('.voice-msg').forEach((b) => b.onclick = () => {
      const src = '/voice/media/' + b.dataset.file;
      let a = b._audio;
      if (!a) { a = new Audio(src); b._audio = a; }
      if (a.paused) { a.play(); b.textContent = '⏸'; a.onended = () => { b.textContent = `▶ ${b.dataset.file ? '' : ''}`; b.textContent = '▶ ' + (b._dur || ''); }; }
      else { a.pause(); b.textContent = '▶'; }
    });
  }

  // —— 发文字 ——
  function sendText() {
    const input = $('roomTextInput'); const content = input.value.trim();
    if (!content) return;
    wsSend({ type: 'text', content });
    input.value = '';
  }

  // —— 录音（≤30秒）——
  async function toggleRecord() {
    if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecord(); return; }
    // 会议室：非主持非嘉宾不能发语音
    if (curRoom.type === 'meeting' && !isSpeaker()) { alert('会议室仅主持和嘉宾可发语音'); return; }
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
    } catch (e) { alert('无法访问麦克风：' + e.message); }
  }
  function stopRecord() {
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    $('voiceRecordBtn').textContent = '🎤';
  }

  // —— 图片（≤200K，自动压缩）——
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
      img.onerror = () => reject(new Error('图片读取失败'));
      img.src = url;
    });
  }

  // —— 上传媒体 ——
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

  // —— 充值 ——
  async function rechargeRoom() {
    const v = prompt(vt('addTimeTip') + '（枚）：');
    const amount = Number(v);
    if (!Number.isInteger(amount) || amount <= 0) return;
    try {
      await alignWallet();
      await api('/voice/recharge', { uid: state.uid, roomId: curRoom.roomId, amount });
    } catch (e) { alert(e.message); }
  }

  // —— 分享房间（链接带 ref 绑定上下级 + room 自动进入）——
  function shareRoom() {
    if (!curRoom) return;
    const link = `${location.origin}${location.pathname}?ref=${state.uid}&room=${curRoom.roomId}`;
    navigator.clipboard?.writeText(link).then(() => alert(vt('shareCopied') + '\n' + link)).catch(() => prompt(vt('share'), link));
  }
  // —— 房主解散房间（二次确认）——
  async function dissolveRoom() {
    if (!curRoom || curRoom.hostUid !== state.uid) return;
    if (!confirm(vt('dissolveConfirm'))) return;
    try {
      await api('/voice/dissolve', { uid: state.uid, roomId: curRoom.roomId });
      leaveRoom();
    } catch (e) { alert(e.message); }
  }

  // —— 离开房间 ——
  function leaveRoom() {
    wsSend({ type: 'leave' });
    if (ws) { try { ws.close(); } catch {} ws = null; }
    if (roomTimer) { clearInterval(roomTimer); roomTimer = null; }
    stopBroadcast();
    curRoom = null; curMembers = []; curMsgs = [];
    $('roomMask').classList.add('hide');
    loadRooms();
  }

  // —— 会议室 WebRTC ——
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
    } catch (e) { alert('无法访问麦克风：' + e.message); wsSend({ type: 'mic', on: false }); return; }
    // 对每个听众创建 PC 发 offer
    for (const m of curMembers) {
      if (m.uid === state.uid || m.micOn) continue; // 只给非上麦者发
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
  // 听众：收到上麦者的 offer
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
  // 上麦者：新成员加入时主动 offer
  function setupListenToSpeakers() {
    if (!curRoom || curRoom.type !== 'meeting') return;
    // 如果我是上麦者，对新的非上麦成员发 offer
    if (localStream) {
      for (const m of curMembers) {
        if (m.uid !== state.uid && !m.micOn && !peerCons.has(m.uid)) {
          offerTo(m.uid, localStream);
        }
      }
    }
  }

  // —— 绑定 ——
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
    $('guestListBtn').onclick = () => alert('点击房间内成员头像可邀请/取消嘉宾');
    // voice.js 动态补充的 i18n key 需要重新翻译一次
    applyI18n();
    $('roomNameInput').placeholder = vt('roomNamePh');
    $('roomDescInput').placeholder = vt('roomDescPh');
    $('roomTextInput').placeholder = vt('saySomething');
    $('roomDesc').onclick = editRoomDesc;
    // 分享链接自动进房间：?room=ROOM_ID（ref 参数已由登录逻辑绑定上下级）
    const roomInvite = new URLSearchParams(location.search).get('room');
    if (roomInvite) {
      const t = setInterval(() => {
        if (state.uid) {
          clearInterval(t);
          history.replaceState(null, '', location.pathname);
          // 等主界面初始化完成
          setTimeout(() => enterRoom(roomInvite), 800);
        }
      }, 300);
    }
  }

  // 页面加载后初始化（app.js 已执行完）
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
