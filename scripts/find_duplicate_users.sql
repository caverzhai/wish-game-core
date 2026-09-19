-- ============================================
-- 查找重复钱包地址的用户
-- ============================================

-- 1. 找出所有重复的钱包地址（按小写分组）
SELECT 
  LOWER(wallet) as wallet_lower,
  COUNT(*) as duplicate_count,
  GROUP_CONCAT(uid ORDER BY uid DESC) as all_uids,
  GROUP_CONCAT(created_at ORDER BY uid DESC) as created_times
FROM users
GROUP BY LOWER(wallet)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 查看每组重复用户的账户余额
SELECT 
  u.uid,
  u.wallet,
  u.inviter_uid,
  u.created_at,
  a.available,
  a.frozen,
  a.premium
FROM users u
LEFT JOIN accounts a ON u.uid = a.uid
WHERE LOWER(u.wallet) IN (
  SELECT LOWER(wallet) FROM users GROUP BY LOWER(wallet) HAVING COUNT(*) > 1
)
ORDER BY LOWER(u.wallet), u.uid DESC;

-- 3. 统计需要合并的用户数量
SELECT 
  COUNT(*) as total_duplicate_users,
  COUNT(DISTINCT LOWER(wallet)) as duplicate_wallet_count
FROM users
WHERE LOWER(wallet) IN (
  SELECT LOWER(wallet) FROM users GROUP BY LOWER(wallet) HAVING COUNT(*) > 1
);
