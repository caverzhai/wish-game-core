-- ============================================
-- 合并重复钱包地址用户（小号合并到最新大号）
-- 保留每组中UID最大的用户，删除其他小号
-- ============================================

-- 注意：执行前请先备份数据库！

-- ============================================
-- 第一步：创建临时表，标记主账号和待删除账号
-- ============================================
DROP TEMPORARY TABLE IF EXISTS dup_wallets;
CREATE TEMPORARY TABLE dup_wallets (
  wallet_lower VARCHAR(64) PRIMARY KEY,
  main_uid VARCHAR(20),
  delete_uids TEXT
);

-- 找出每组重复钱包，保留UID最大的作为主账号
INSERT INTO dup_wallets (wallet_lower, main_uid, delete_uids)
SELECT 
  LOWER(wallet) as wallet_lower,
  MAX(uid) as main_uid,
  GROUP_CONCAT(uid ORDER BY uid DESC) as all_uids
FROM users
GROUP BY LOWER(wallet)
HAVING COUNT(*) > 1;

-- 查看待处理的重复钱包
SELECT * FROM dup_wallets;

-- ============================================
-- 第二步：合并账户余额（accounts表）
-- ============================================
-- 把小号的余额加到主账号
UPDATE accounts a_main
INNER JOIN users u_small ON u_small.uid != (SELECT main_uid FROM dup_wallets WHERE wallet_lower = LOWER(u_small.wallet))
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u_small.wallet)
INNER JOIN accounts a_small ON a_small.uid = u_small.uid
SET 
  a_main.available = a_main.available + a_small.available,
  a_main.frozen = a_main.frozen + a_small.frozen,
  a_main.premium = a_main.premium + a_small.premium,
  a_main.loss_accum = a_main.loss_accum + a_small.loss_accum
WHERE a_main.uid = d.main_uid;

-- ============================================
-- 第三步：转移关联数据到主账号
-- ============================================

-- 3.1 转移保险节点（nodes表）
UPDATE nodes n
INNER JOIN users u ON u.uid = n.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET n.uid = d.main_uid
WHERE n.uid != d.main_uid;

-- 3.2 转移节点日志（node_logs表）
UPDATE node_logs nl
INNER JOIN users u ON u.uid = nl.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET nl.uid = d.main_uid
WHERE nl.uid != d.main_uid;

-- 3.3 转移投注记录（bets表）
UPDATE bets b
INNER JOIN users u ON u.uid = b.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET b.uid = d.main_uid
WHERE b.uid != d.main_uid;

-- 3.4 转移邀请佣金记录（referral_logs表 - 邀请人）
UPDATE referral_logs rl
INNER JOIN users u ON u.uid = rl.inviter_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET rl.inviter_uid = d.main_uid
WHERE rl.inviter_uid != d.main_uid;

-- 3.5 转移邀请佣金记录（referral_logs表 - 被邀请人）
UPDATE referral_logs rl
INNER JOIN users u ON u.uid = rl.from_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET rl.from_uid = d.main_uid
WHERE rl.from_uid != d.main_uid;

-- 3.6 转移资金流水（flows表）
UPDATE flows f
INNER JOIN users u ON u.uid = f.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET f.uid = d.main_uid
WHERE f.uid != d.main_uid;

-- 3.7 转移提现记录（withdraws表）
UPDATE withdraws w
INNER JOIN users u ON u.uid = w.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET w.uid = d.main_uid
WHERE w.uid != d.main_uid;

-- 3.8 转移帖子（posts表）
UPDATE posts p
INNER JOIN users u ON u.uid = p.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET p.uid = d.main_uid
WHERE p.uid != d.main_uid;

-- 3.9 转移回复（replies表）
UPDATE replies r
INNER JOIN users u ON u.uid = r.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET r.uid = d.main_uid
WHERE r.uid != d.main_uid;

-- 3.10 转移语音房间（voice_rooms表 - 房主）
UPDATE voice_rooms vr
INNER JOIN users u ON u.uid = vr.host_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET vr.host_uid = d.main_uid
WHERE vr.host_uid != d.main_uid;

-- 3.11 转移语音房间（voice_rooms表 - 客人）
UPDATE voice_rooms vr
INNER JOIN users u ON u.uid = vr.guest_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET vr.guest_uid = d.main_uid
WHERE vr.guest_uid != d.main_uid;

-- 3.12 转移慈善项目（charity_projects表）
UPDATE charity_projects cp
INNER JOIN users u ON u.uid = cp.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET cp.uid = d.main_uid
WHERE cp.uid != d.main_uid;

-- 3.13 转移慈善捐款（charity_donations表）
UPDATE charity_donations cd
INNER JOIN users u ON u.uid = cd.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET cd.uid = d.main_uid
WHERE cd.uid != d.main_uid;

-- 3.14 转移慈善投票（charity_votes表）
UPDATE charity_votes cv
INNER JOIN users u ON u.uid = cv.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET cv.uid = d.main_uid
WHERE cv.uid != d.main_uid;

-- 3.15 转移慈善评论（charity_comments表）
UPDATE charity_comments cc
INNER JOIN users u ON u.uid = cc.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET cc.uid = d.main_uid
WHERE cc.uid != d.main_uid;

-- 3.16 转移任务（task_jobs表 - 发布者）
UPDATE task_jobs tj
INNER JOIN users u ON u.uid = tj.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tj.uid = d.main_uid
WHERE tj.uid != d.main_uid;

-- 3.17 转移任务（task_jobs表 - 接单人）
UPDATE task_jobs tj
INNER JOIN users u ON u.uid = tj.assigned_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tj.assigned_uid = d.main_uid
WHERE tj.assigned_uid != d.main_uid;

-- 3.18 转移任务申请（task_applications表）
UPDATE task_applications ta
INNER JOIN users u ON u.uid = ta.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET ta.uid = d.main_uid
WHERE ta.uid != d.main_uid;

-- 3.19 转移任务消息（task_messages表）
UPDATE task_messages tm
INNER JOIN users u ON u.uid = tm.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tm.uid = d.main_uid
WHERE tm.uid != d.main_uid;

-- 3.20 转移任务交付（task_deliveries表）
UPDATE task_deliveries td
INNER JOIN users u ON u.uid = td.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET td.uid = d.main_uid
WHERE td.uid != d.main_uid;

-- 3.21 转移任务纠纷（task_disputes表）
UPDATE task_disputes tdis
INNER JOIN users u ON u.uid = tdis.initiator_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tdis.initiator_uid = d.main_uid
WHERE tdis.initiator_uid != d.main_uid;

-- 3.22 转移任务投票（task_votes表）
UPDATE task_votes tv
INNER JOIN users u ON u.uid = tv.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tv.uid = d.main_uid
WHERE tv.uid != d.main_uid;

-- 3.23 转移任务评价（task_reviews表 - 评价者）
UPDATE task_reviews tr
INNER JOIN users u ON u.uid = tr.reviewer_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tr.reviewer_uid = d.main_uid
WHERE tr.reviewer_uid != d.main_uid;

-- 3.24 转移任务评价（task_reviews表 - 被评价者）
UPDATE task_reviews tr
INNER JOIN users u ON u.uid = tr.reviewee_uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET tr.reviewee_uid = d.main_uid
WHERE tr.reviewee_uid != d.main_uid;

-- 3.25 转移彩票记录（lottery_entries表）
UPDATE lottery_entries le
INNER JOIN users u ON u.uid = le.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET le.uid = d.main_uid
WHERE le.uid != d.main_uid;

-- 3.26 转移彩票评论（lottery_comments表）
UPDATE lottery_comments lc
INNER JOIN users u ON u.uid = lc.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET lc.uid = d.main_uid
WHERE lc.uid != d.main_uid;

-- 3.27 转移链上交易（chain_txs表）
UPDATE chain_txs ct
INNER JOIN users u ON u.uid = ct.uid
INNER JOIN dup_wallets d ON d.wallet_lower = LOWER(u.wallet)
SET ct.uid = d.main_uid
WHERE ct.uid != d.main_uid;

-- ============================================
-- 第四步：转移下级邀请关系
-- 把小号的下级（inviter_uid=小号）转移到主账号
-- ============================================
UPDATE users u_down
INNER JOIN dup_wallets d ON d.delete_uids LIKE CONCAT('%', u_down.inviter_uid, '%')
SET u_down.inviter_uid = d.main_uid
WHERE u_down.inviter_uid != d.main_uid;

-- ============================================
-- 第五步：统一主账号钱包地址为小写
-- ============================================
UPDATE users u
INNER JOIN dup_wallets d ON d.main_uid = u.uid
SET u.wallet = d.wallet_lower;

-- ============================================
-- 第六步：删除小号的账户记录和用户记录
-- ============================================
-- 删除小号的账户记录
DELETE a FROM accounts a
INNER JOIN users u ON u.uid = a.uid
INNER JOIN dup_wallets d ON d.delete_uids LIKE CONCAT('%', u.uid, '%')
WHERE u.uid != d.main_uid;

-- 删除小号用户
DELETE u FROM users u
INNER JOIN dup_wallets d ON d.delete_uids LIKE CONCAT('%', u.uid, '%')
WHERE u.uid != d.main_uid;

-- ============================================
-- 第七步：验证结果
-- ============================================
-- 检查是否还有重复钱包
SELECT 
  LOWER(wallet) as wallet_lower,
  COUNT(*) as cnt
FROM users
GROUP BY LOWER(wallet)
HAVING COUNT(*) > 1;

-- 显示合并完成
SELECT '合并完成！' as result;
