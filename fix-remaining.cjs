const fs = require('fs');

// Fix task.js loadTaskList hardcoded English
const taskPath = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\task.js';
let taskJs = fs.readFileSync(taskPath, 'utf8');

taskJs = taskJs.replace(
  '<button onclick="Task.loadTaskList(null)" class="task-filter-btn ${!status ? \'active\' : \'\'}">All</button>',
  '<button onclick="Task.loadTaskList(null)" class="task-filter-btn ${!status ? \'active\' : \'\'}">${t(\'taskFilterAll\')}</button>'
);
taskJs = taskJs.replace(
  '<button onclick="Task.loadTaskList(\'open\')" class="task-filter-btn ${status === \'open\' ? \'active\' : \'\'}">Open</button>',
  '<button onclick="Task.loadTaskList(\'open\')" class="task-filter-btn ${status === \'open\' ? \'active\' : \'\'}">${t(\'taskFilterOpen\')}</button>'
);
taskJs = taskJs.replace(
  '<button onclick="Task.loadTaskList(\'assigned\')" class="task-filter-btn ${status === \'assigned\' ? \'active\' : \'\'}">Assigned</button>',
  '<button onclick="Task.loadTaskList(\'assigned\')" class="task-filter-btn ${status === \'assigned\' ? \'active\' : \'\'}">${t(\'taskFilterAssigned\')}</button>'
);
taskJs = taskJs.replace(
  '<button onclick="Task.loadTaskList(\'completed\')" class="task-filter-btn ${status === \'completed\' ? \'active\' : \'\'}">Done</button>',
  '<button onclick="Task.loadTaskList(\'completed\')" class="task-filter-btn ${status === \'completed\' ? \'active\' : \'\'}">${t(\'taskFilterDone\')}</button>'
);
taskJs = taskJs.replace(
  '<button onclick="Task.openCreate()" class="task-post-btn-inline">+ Post</button>',
  '<button onclick="Task.openCreate()" class="task-post-btn-inline">+ ${t(\'taskPostBtn\')}</button>'
);
taskJs = taskJs.replace(
  'No tasks found',
  '${t(\'taskNoTasks\')}'
);
taskJs = taskJs.replace(
  '<div style="text-align:center;padding:30px;color:#ef4444;">Error: ${e.message}</div>',
  '<div style="text-align:center;padding:30px;color:#ef4444;">${t(\'taskError\')}: ${e.message}</div>'
);

fs.writeFileSync(taskPath, taskJs, 'utf8');
console.log('task.js loadTaskList fixed');

// Fix voice.js room recharge - replace prompt with number validation
const voicePath = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\voice.js';
let voiceJs = fs.readFileSync(voicePath, 'utf8');

// Replace prompt with a better input that only accepts positive integers
const oldRecharge = `  async function rechargeRoom() {
    const v = prompt(vt('addTimeTip') + ' (units):');
    const amount = Number(v);
    if (!Number.isInteger(amount) || amount <= 0) return;`;

const newRecharge = `  async function rechargeRoom() {
    let v = prompt(vt('addTimeTip') + ' (1-9999):');
    if (v === null) return;
    v = v.replace(/[^0-9]/g, '');
    const amount = parseInt(v, 10);
    if (!amount || amount < 1) { alert(vt('addTimeTip')); return; }`;

voiceJs = voiceJs.replace(oldRecharge, newRecharge);

fs.writeFileSync(voicePath, voiceJs, 'utf8');
console.log('voice.js recharge fixed');
