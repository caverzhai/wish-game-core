// =============================================================
// WSServer.js —— 语音房 WebSocket 实时通道
// 消息：join/leave/text/voice/image/recharge/mic/setGuest/rtc(信令)
// 广播：msg/members/room/rtc/closed
// =============================================================
import { WebSocketServer } from 'ws';

export function createWSServer(server, voice) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      try {
        await handleMessage(ws, msg, voice, wss);
      } catch (e) {
        safeSend(ws, { type: 'error', message: e.message });
      }
    });
    ws.on('close', async () => {
      if (ws.roomId && ws.uid) {
        try {
          await voice.leave(ws.roomId, ws.uid);
          const detail = voice.getRoomDetail(ws.roomId);
          broadcastRoom(wss, ws.roomId, { type: 'members', members: detail.members });
        } catch { /* 房间已销毁 */ }
      }
    });
  });

  // 心跳：30秒 ping，无响应断开
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch { /* */ }
    });
  }, 30000);

  // 房间被 tick 销毁时通知
  voice._broadcastClosed = (roomId) => {
    broadcastRoom(wss, roomId, { type: 'closed', reason: '房间已关闭' });
  };

  return wss;
}

async function handleMessage(ws, msg, voice, wss) {
  switch (msg.type) {
    case 'join': {
      const { roomId, uid } = msg;
      if (!roomId || !uid) throw new Error('缺少房间或用户');
      const { room, members } = await voice.join(roomId, uid);
      ws.uid = uid; ws.roomId = roomId;
      const detail = voice.getRoomDetail(roomId);
      safeSend(ws, { type: 'joined', room, members, messages: detail.messages });
      broadcastRoom(wss, roomId, { type: 'members', members });
      break;
    }
    case 'leave': {
      if (ws.roomId) {
        await voice.leave(ws.roomId, ws.uid);
        try {
          const detail = voice.getRoomDetail(ws.roomId);
          broadcastRoom(wss, ws.roomId, { type: 'members', members: detail.members });
        } catch { /* 已销毁 */ }
        ws.roomId = null;
      }
      break;
    }
    case 'text': {
      const item = await voice.sendMessage(ws.roomId, ws.uid, { type: 'text', content: msg.content });
      broadcastRoom(wss, ws.roomId, { type: 'msg', msg: item });
      break;
    }
    case 'voice': {
      const item = await voice.sendMessage(ws.roomId, ws.uid, { type: 'voice', file: msg.file, duration: msg.duration });
      broadcastRoom(wss, ws.roomId, { type: 'msg', msg: item });
      break;
    }
    case 'image': {
      const item = await voice.sendMessage(ws.roomId, ws.uid, { type: 'image', file: msg.file });
      broadcastRoom(wss, ws.roomId, { type: 'msg', msg: item });
      break;
    }
    case 'recharge': {
      await voice.recharge(ws.roomId, ws.uid, BigInt(msg.amount));
      const detail = voice.getRoomDetail(ws.roomId);
      broadcastRoom(wss, ws.roomId, { type: 'room', room: detail.room });
      break;
    }
    case 'mic': {
      const r = await voice.setMic(ws.roomId, ws.uid, !!msg.on);
      broadcastRoom(wss, ws.roomId, { type: 'members', members: r.members });
      break;
    }
    case 'setGuest': {
      const r = await voice.setGuest(ws.roomId, ws.uid, msg.guestUid, !!msg.on);
      broadcastRoom(wss, ws.roomId, { type: 'members', members: r.members });
      break;
    }
    case 'rtc': {
      // WebRTC 信令转发：{to, data}
      sendToUser(wss, msg.to, { type: 'rtc', from: ws.uid, data: msg.data });
      break;
    }
  }
}

function broadcastRoom(wss, roomId, obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === 1 && c.roomId === roomId) safeSend(c, s);
  });
}
function sendToUser(wss, uid, obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === 1 && c.uid === uid) safeSend(c, s);
  });
}
function safeSend(ws, data) {
  try { if (ws.readyState === 1) ws.send(typeof data === 'string' ? data : JSON.stringify(data)); } catch { /* */ }
}
