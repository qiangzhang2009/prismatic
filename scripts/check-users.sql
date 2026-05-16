-- 检查用户创建时间分布
SELECT
  CASE
    WHEN "createdAt" < '2020-01-01' THEN 'before_2020'
    WHEN "createdAt" < '2025-01-01' THEN '2020_2024'
    WHEN "createdAt" < '2026-01-01' THEN '2025'
    WHEN "createdAt" < '2026-03-01' THEN '2026_Jan_Feb'
    WHEN "createdAt" < '2026-04-01' THEN '2026_Mar'
    WHEN "createdAt" < '2026-05-01' THEN '2026_Apr'
    ELSE '2026_May'
  END as period,
  COUNT(*) as cnt
FROM users
GROUP BY 1
ORDER BY
  CASE period
    WHEN 'before_2020' THEN 1
    WHEN '2020_2024' THEN 2
    WHEN '2025' THEN 3
    WHEN '2026_Jan_Feb' THEN 4
    WHEN '2026_Mar' THEN 5
    WHEN '2026_Apr' THEN 6
    WHEN '2026_May' THEN 7
  END;

-- 查看所有非删除用户
SELECT id, email, "createdAt"::text, status, plan
FROM users
WHERE status != 'DELETED'
ORDER BY "createdAt" DESC;

-- 查看所有用户总数（含删除）
SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status != 'DELETED') as non_deleted, COUNT(*) FILTER (WHERE status = 'DELETED') as deleted FROM users;
