const fs = require('fs');

// 1. Add task translations to zh-TW object
const appPath = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const zhTwTaskTrans = `taskSectionTitle: "找對人", taskPostBtn: "發布任務", taskViewAll: "查看全部", taskNoTasks: "暫無任務，快來發布第一個吧！", taskReward: "報酬", taskLocation: "地點", taskStatus: "狀態", taskApply: "申請接單", taskApplyMsg: "介紹一下你自己...", taskAccept: "確認接單", taskDeliver: "提交交付", taskDeliveryProof: "交付說明", taskConfirm: "確認並放款", taskRefuse: "拒絕放款", taskRequestRefund: "申請退款", taskAgreeRefund: "同意退款", taskVoteSupport: "支持", taskVoteOppose: "反對", taskVoteNote: "只有保險節點用戶可以投票，每個糾紛一票。", taskMessages: "留言", taskSendMsg: "發送", taskMyTasks: "我的任務", taskBack: "返回", taskTitle: "標題 *（至少16字，不能有標點和空格）", taskDesc: "描述 *（至少30字）", taskImage: "圖片 *（至少一張）", taskEscrowNotice: "平台已收取全額保證金", taskEscrowDesc: "報酬立即託管，確認交付後釋放。", taskStatusOpen: "招募中", taskStatusAssigned: "已接單", taskStatusDelivered: "已交付", taskStatusCompleted: "已完成", taskStatusDisputed: "糾紛中", taskStatusCancelled: "已取消", taskStatusResolved: "已解決", taskCreateTitle: "發布任務", taskTitlePh: "用至少16個字元清楚描述你的任務...", taskLocationPh: "例如：日本北海道（或遠端）", taskRewardPh: "全額報酬", taskDescPh: "描述你需要做什麼、時間線、要求...（至少30個字元）", taskStatusInProgress: "進行中", taskPostedByMe: "我發布的", taskAssignedToMe: "分配給我的", taskError: "錯誤", taskTitleRequired: "標題不能為空", taskTitleMin: "標題至少16個字元", taskTitleNoPunct: "標題不能包含標點和空格", taskDescRequired: "描述不能為空", taskDescMin: "描述至少30個字元", taskRewardInvalid: "報酬必須是正整數", taskImageRequired: "至少上傳一張圖片", taskImageTooLarge: "圖片太大，最大2MB", taskPostedSuccess: "任務發布成功！報酬已託管：", taskPostFail: "失敗", taskApplications: "申請列表", taskDeliverTitle: "提交交付", taskDeliveryPh: "描述你交付了什麼...", taskSubmitDelivery: "提交交付證明", taskConfirmTitle: "確認交付", taskAutoReleaseNote: "15天內無操作將自動放款。", taskConfirmRelease: "確認並放款", taskDispute: "糾紛", taskCancelRefund: "取消並申請退款", taskDisputeTitle: "糾紛", taskAdminDecision: "管理員裁定", taskPoster: "發布者", taskWorker: "接單方", taskDescription: "任務描述", taskDiscussion: "討論", taskNoMessages: "暫無留言", taskMsgPh: "說點什麼...", taskApplySuccess: "申請已提交！", taskAcceptSuccess: "已接受申請！", taskDeliverySuccess: "交付已提交！", taskConfirmSuccess: "已放款！", taskDisputeSuccess: "糾紛已開啟！", taskRefundSuccess: "退款申請已提交！", taskAgreeRefundSuccess: "已同意退款，任務取消。", taskVoteSuccess: "投票成功！", taskAllTasks: "全部任務", taskFilterAll: "全部", taskFilterOpen: "招募中", taskFilterAssigned: "進行中", taskFilterDone: "已完成",`;

// Find zh-TW object end (before ja: {)
const zhTwStart = appJs.indexOf("'zh-TW': {");
const jaStart = appJs.indexOf('  ja: {', zhTwStart);
if (zhTwStart > -1 && jaStart > -1) {
  // Find the closing brace before jaStart
  const insertPos = appJs.lastIndexOf('},', jaStart) + 2;
  appJs = appJs.substring(0, insertPos) + ' ' + zhTwTaskTrans + appJs.substring(insertPos);
  console.log('Added task translations to zh-TW');
}

fs.writeFileSync(appPath, appJs, 'utf8');

// 2. Modify task.js limits: title 50->16, desc 100->30
const taskPath = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\task.js';
let taskJs = fs.readFileSync(taskPath, 'utf8');

taskJs = taskJs.replace(/title\.length < 50/g, 'title.length < 16');
taskJs = taskJs.replace(/description\.length < 100/g, 'description.length < 30');

fs.writeFileSync(taskPath, taskJs, 'utf8');
console.log('Modified task.js limits: title min 16, desc min 30');
