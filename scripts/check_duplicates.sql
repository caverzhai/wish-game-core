SELECT 
  LOWER(wallet) as wallet_lower,
  COUNT(*) as cnt,
  GROUP_CONCAT(uid ORDER BY uid DESC) as uids,
  GROUP_CONCAT(wallet ORDER BY uid DESC) as wallets
FROM users
GROUP BY LOWER(wallet)
HAVING COUNT(*) > 1;
