const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// First, remove ALL duplicate task-related keys from I18N
// We'll remove all occurrences of task*: "..." patterns, then re-add clean versions
// Pattern: taskWord: "value", 
const taskKeyPattern = /\s*task[A-Za-z]+:\s*"[^"]*",?/g;

// Count before
const beforeCount = (js.match(taskKeyPattern) || []).length;
console.log('Found', beforeCount, 'task key occurrences');

// Remove all task keys
js = js.replace(taskKeyPattern, '');

// Now add clean task translations for each language
// We need to find each language object and add the keys at the end

const taskTranslations = {
  en: `taskSectionTitle: "Find the Right Person", taskPostBtn: "Post Task", taskViewAll: "View All", taskNoTasks: "No tasks yet. Be the first to post!", taskReward: "Reward", taskLocation: "Location", taskStatus: "Status", taskApply: "Apply", taskApplyMsg: "Introduce yourself...", taskAccept: "Accept", taskDeliver: "Submit Delivery", taskDeliveryProof: "Delivery Proof", taskConfirm: "Confirm & Release", taskRefuse: "Dispute", taskRequestRefund: "Request Refund", taskAgreeRefund: "Agree Refund", taskVoteSupport: "Support", taskVoteOppose: "Oppose", taskVoteNote: "Only insurance node users can vote.", taskMessages: "Messages", taskSendMsg: "Send", taskMyTasks: "My Tasks", taskBack: "Back", taskTitle: "Title * (min 16 chars, no punctuation or spaces)", taskDesc: "Description * (min 30 chars)", taskImage: "Image * (at least one)", taskEscrowNotice: "Platform has collected the full security deposit", taskEscrowDesc: "Reward is escrowed immediately.", taskStatusOpen: "Open", taskStatusAssigned: "Assigned", taskStatusDelivered: "Delivered", taskStatusCompleted: "Completed", taskStatusDisputed: "Disputed", taskStatusCancelled: "Cancelled", taskStatusResolved: "Resolved", taskCreateTitle: "Post a Task", taskTitlePh: "Describe your task clearly in at least 16 characters...", taskLocationPh: "e.g. Hokkaido, Japan (or Remote)", taskRewardPh: "Full payment amount", taskDescPh: "Describe what you need done, timeline, requirements... (at least 30 characters)", taskStatusInProgress: "In Progress", taskPostedByMe: "Posted by me", taskAssignedToMe: "Assigned to me", taskError: "Error", taskTitleRequired: "Title is required", taskTitleMin: "Title must be at least 16 characters", taskTitleNoPunct: "Title cannot contain punctuation or spaces", taskDescRequired: "Description is required", taskDescMin: "Description must be at least 30 characters", taskRewardInvalid: "Reward must be a positive integer", taskImageRequired: "At least one image is required", taskImageTooLarge: "Image too large, max 2MB", taskPostedSuccess: "Task posted successfully! Reward escrowed:", taskPostFail: "Failed", taskApplications: "Applications", taskDeliverTitle: "Submit Delivery", taskDeliveryPh: "Describe what you delivered...", taskSubmitDelivery: "Submit Delivery Proof", taskConfirmTitle: "Confirm Delivery", taskAutoReleaseNote: "Auto-release in 15 days if no action.", taskConfirmRelease: "Confirm & Release Payment", taskDispute: "Dispute", taskCancelRefund: "Cancel & Request Refund", taskDisputeTitle: "Dispute", taskAdminDecision: "Admin decision", taskPoster: "Poster", taskWorker: "Worker", taskDescription: "Description", taskDiscussion: "Discussion", taskNoMessages: "No messages yet", taskMsgPh: "Say something...", taskApplySuccess: "Application submitted!", taskAcceptSuccess: "Applicant accepted!", taskDeliverySuccess: "Delivery submitted!", taskConfirmSuccess: "Payment released!", taskDisputeSuccess: "Dispute opened!", taskRefundSuccess: "Refund requested!", taskAgreeRefundSuccess: "Refund agreed, task cancelled.", taskVoteSuccess: "Vote recorded!", taskAllTasks: "All Tasks", taskFilterAll: "All", taskFilterOpen: "Open", taskFilterAssigned: "Assigned", taskFilterDone: "Done",`,
  zh: `taskSectionTitle: "找对人", taskPostBtn: "发布任务", taskViewAll: "查看全部", taskNoTasks: "暂无任务，快来发布第一个吧！", taskReward: "报酬", taskLocation: "地点", taskStatus: "状态", taskApply: "申请接单", taskApplyMsg: "介绍一下你自己...", taskAccept: "确认接单", taskDeliver: "提交交付", taskDeliveryProof: "交付说明", taskConfirm: "确认并放款", taskRefuse: "拒绝放款", taskRequestRefund: "申请退款", taskAgreeRefund: "同意退款", taskVoteSupport: "支持", taskVoteOppose: "反对", taskVoteNote: "只有保险节点用户可以投票，每个纠纷一票。", taskMessages: "留言", taskSendMsg: "发送", taskMyTasks: "我的任务", taskBack: "返回", taskTitle: "标题 *（至少16字，不能有标点和空格）", taskDesc: "描述 *（至少30字）", taskImage: "图片 *（至少一张）", taskEscrowNotice: "平台已收取全额保证金", taskEscrowDesc: "报酬立即托管，确认交付后释放。", taskStatusOpen: "招募中", taskStatusAssigned: "已接单", taskStatusDelivered: "已交付", taskStatusCompleted: "已完成", taskStatusDisputed: "纠纷中", taskStatusCancelled: "已取消", taskStatusResolved: "已解决", taskCreateTitle: "发布任务", taskTitlePh: "用至少16个字符清楚描述你的任务...", taskLocationPh: "例如：日本北海道（或远程）", taskRewardPh: "全额报酬", taskDescPh: "描述你需要做什么、时间线、要求...（至少30个字符）", taskStatusInProgress: "进行中", taskPostedByMe: "我发布的", taskAssignedToMe: "分配给我的", taskError: "错误", taskTitleRequired: "标题不能为空", taskTitleMin: "标题至少16个字符", taskTitleNoPunct: "标题不能包含标点和空格", taskDescRequired: "描述不能为空", taskDescMin: "描述至少30个字符", taskRewardInvalid: "报酬必须是正整数", taskImageRequired: "至少上传一张图片", taskImageTooLarge: "图片太大，最大2MB", taskPostedSuccess: "任务发布成功！报酬已托管：", taskPostFail: "失败", taskApplications: "申请列表", taskDeliverTitle: "提交交付", taskDeliveryPh: "描述你交付了什么...", taskSubmitDelivery: "提交交付证明", taskConfirmTitle: "确认交付", taskAutoReleaseNote: "15天内无操作将自动放款。", taskConfirmRelease: "确认并放款", taskDispute: "纠纷", taskCancelRefund: "取消并申请退款", taskDisputeTitle: "纠纷", taskAdminDecision: "管理员裁定", taskPoster: "发布者", taskWorker: "接单方", taskDescription: "任务描述", taskDiscussion: "讨论", taskNoMessages: "暂无留言", taskMsgPh: "说点什么...", taskApplySuccess: "申请已提交！", taskAcceptSuccess: "已接受申请！", taskDeliverySuccess: "交付已提交！", taskConfirmSuccess: "已放款！", taskDisputeSuccess: "纠纷已开启！", taskRefundSuccess: "退款申请已提交！", taskAgreeRefundSuccess: "已同意退款，任务取消。", taskVoteSuccess: "投票成功！", taskAllTasks: "全部任务", taskFilterAll: "全部", taskFilterOpen: "招募中", taskFilterAssigned: "进行中", taskFilterDone: "已完成",`,
  'zh-tw': `taskSectionTitle: "找對人", taskPostBtn: "發布任務", taskViewAll: "查看全部", taskNoTasks: "暫無任務，快來發布第一個吧！", taskReward: "報酬", taskLocation: "地點", taskStatus: "狀態", taskApply: "申請接單", taskApplyMsg: "介紹一下你自己...", taskAccept: "確認接單", taskDeliver: "提交交付", taskDeliveryProof: "交付說明", taskConfirm: "確認並放款", taskRefuse: "拒絕放款", taskRequestRefund: "申請退款", taskAgreeRefund: "同意退款", taskVoteSupport: "支持", taskVoteOppose: "反對", taskVoteNote: "只有保險節點用戶可以投票，每個糾紛一票。", taskMessages: "留言", taskSendMsg: "發送", taskMyTasks: "我的任務", taskBack: "返回", taskTitle: "標題 *（至少16字，不能有標點和空格）", taskDesc: "描述 *（至少30字）", taskImage: "圖片 *（至少一張）", taskEscrowNotice: "平台已收取全額保證金", taskEscrowDesc: "報酬立即託管，確認交付後釋放。", taskStatusOpen: "招募中", taskStatusAssigned: "已接單", taskStatusDelivered: "已交付", taskStatusCompleted: "已完成", taskStatusDisputed: "糾紛中", taskStatusCancelled: "已取消", taskStatusResolved: "已解決", taskCreateTitle: "發布任務", taskTitlePh: "用至少16個字元清楚描述你的任務...", taskLocationPh: "例如：日本北海道（或遠端）", taskRewardPh: "全額報酬", taskDescPh: "描述你需要做什麼、時間線、要求...（至少30個字元）", taskStatusInProgress: "進行中", taskPostedByMe: "我發布的", taskAssignedToMe: "分配給我的", taskError: "錯誤", taskTitleRequired: "標題不能為空", taskTitleMin: "標題至少16個字元", taskTitleNoPunct: "標題不能包含標點和空格", taskDescRequired: "描述不能為空", taskDescMin: "描述至少30個字元", taskRewardInvalid: "報酬必須是正整數", taskImageRequired: "至少上傳一張圖片", taskImageTooLarge: "圖片太大，最大2MB", taskPostedSuccess: "任務發布成功！報酬已託管：", taskPostFail: "失敗", taskApplications: "申請列表", taskDeliverTitle: "提交交付", taskDeliveryPh: "描述你交付了什麼...", taskSubmitDelivery: "提交交付證明", taskConfirmTitle: "確認交付", taskAutoReleaseNote: "15天內無操作將自動放款。", taskConfirmRelease: "確認並放款", taskDispute: "糾紛", taskCancelRefund: "取消並申請退款", taskDisputeTitle: "糾紛", taskAdminDecision: "管理員裁定", taskPoster: "發布者", taskWorker: "接單方", taskDescription: "任務描述", taskDiscussion: "討論", taskNoMessages: "暫無留言", taskMsgPh: "說點什麼...", taskApplySuccess: "申請已提交！", taskAcceptSuccess: "已接受申請！", taskDeliverySuccess: "交付已提交！", taskConfirmSuccess: "已放款！", taskDisputeSuccess: "糾紛已開啟！", taskRefundSuccess: "退款申請已提交！", taskAgreeRefundSuccess: "已同意退款，任務取消。", taskVoteSuccess: "投票成功！", taskAllTasks: "全部任務", taskFilterAll: "全部", taskFilterOpen: "招募中", taskFilterAssigned: "進行中", taskFilterDone: "已完成",`,
};

// For other languages, use English
const otherLangs = ['ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];

// Find each language object and add task translations at the end
// Language objects look like:  en: { ... },  zh: { ... }, etc.
// We'll find the closing brace of each language object and insert before it

for (const [lang, trans] of Object.entries(taskTranslations)) {
  // Find the language object:  lang: {
  const langStart = js.indexOf('  ' + lang + ': {');
  if (langStart > -1) {
    // Find the closing brace:  }, at the same indentation level
    // We'll look for the next occurrence of '  },' after langStart
    // But this is tricky because of nested objects. Let's use a simpler approach:
    // Find the next language object start, and insert before it
    const allLangs = ['en', 'zh', 'zh-tw', 'ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];
    const currentIdx = allLangs.indexOf(lang);
    const nextLang = currentIdx < allLangs.length - 1 ? allLangs[currentIdx + 1] : null;
    
    let insertPos;
    if (nextLang) {
      const nextLangStart = js.indexOf('  ' + nextLang + ': {', langStart);
      if (nextLangStart > -1) {
        // Find the '},' before nextLangStart
        insertPos = js.lastIndexOf('},', nextLangStart) + 2;
      }
    } else {
      // Last language, find the closing of I18N
      insertPos = js.indexOf('};', langStart);
    }
    
    if (insertPos > -1) {
      js = js.substring(0, insertPos) + ' ' + trans + js.substring(insertPos);
      console.log('Added translations for', lang);
    }
  }
}

// For other languages, add English translations
for (const lang of otherLangs) {
  const langStart = js.indexOf('  ' + lang + ': {');
  if (langStart > -1) {
    const allLangs = ['en', 'zh', 'zh-tw', 'ja', 'ar', 'id', 'ko', 'ru', 'hi', 'ur'];
    const currentIdx = allLangs.indexOf(lang);
    const nextLang = currentIdx < allLangs.length - 1 ? allLangs[currentIdx + 1] : null;
    
    let insertPos;
    if (nextLang) {
      const nextLangStart = js.indexOf('  ' + nextLang + ': {', langStart);
      if (nextLangStart > -1) {
        insertPos = js.lastIndexOf('},', nextLangStart) + 2;
      }
    } else {
      insertPos = js.indexOf('};', langStart);
    }
    
    if (insertPos > -1) {
      js = js.substring(0, insertPos) + ' ' + taskTranslations.en + js.substring(insertPos);
      console.log('Added English translations for', lang);
    }
  }
}

fs.writeFileSync(path, js, 'utf8');
console.log('app.js cleaned and updated');
