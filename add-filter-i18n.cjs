const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// Add filter translations after taskAllTasks
const filterTrans = {
  en: 'taskFilterAll: "All", taskFilterOpen: "Open", taskFilterAssigned: "Assigned", taskFilterDone: "Done",',
  zh: 'taskFilterAll: "全部", taskFilterOpen: "招募中", taskFilterAssigned: "进行中", taskFilterDone: "已完成",',
  'zh-tw': 'taskFilterAll: "全部", taskFilterOpen: "招募中", taskFilterAssigned: "進行中", taskFilterDone: "已完成",',
};

for (const [lang, trans] of Object.entries(filterTrans)) {
  const searchStr = 'taskAllTasks: "';
  const idx = js.indexOf(searchStr);
  if (idx > -1) {
    const endIdx = js.indexOf('",', idx);
    if (endIdx > -1) {
      const insertPos = endIdx + 2;
      js = js.substring(0, insertPos) + ' ' + trans + js.substring(insertPos);
      console.log('Added filter translations for ' + lang);
    }
  }
}

// For other languages, use English
const otherLangs = ['ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];
for (const lang of otherLangs) {
  const searchStr = 'taskAllTasks: "';
  const idx = js.indexOf(searchStr);
  if (idx > -1) {
    const endIdx = js.indexOf('",', idx);
    if (endIdx > -1) {
      const insertPos = endIdx + 2;
      js = js.substring(0, insertPos) + ' ' + filterTrans.en + js.substring(insertPos);
      console.log('Added filter translations for ' + lang);
    }
  }
}

fs.writeFileSync(path, js, 'utf8');
console.log('app.js updated with filter translations');
