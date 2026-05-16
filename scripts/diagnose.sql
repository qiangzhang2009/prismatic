-- 诊断脚本：检查生产环境数据状态
-- 用法：PGPASSWORD=xxx psql -h ep-wild-haze-an17vdce.neonauth.c-6.us-east-1.aws.neon.tech -U neondb_owner -d neondb -f scripts/diagnose.sql

-- 1. 用户总数
SELECT
  COUNT(*) FILTER (WHERE status != 'DELETED') AS total_users,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_users,
  COUNT(*) FILTER (WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL) AS paid_users
FROM users;

-- 2. 全部用户列表
SELECT
  id,
  email,
  name,
  plan,
  status,
  created_at::text
FROM users
WHERE status != 'DELETED'
ORDER BY created_at DESC
LIMIT 20;

-- 3. 消息统计（全量）
SELECT
  COUNT(*) FILTER (WHERE content != '[message-counted]') AS total_messages,
  COUNT(DISTINCT "userId") FILTER (WHERE content != '[message-counted]') AS unique_users,
  COUNT(DISTINCT "conversationId") FILTER (WHERE content != '[message-counted]') AS unique_conversations
FROM messages;

-- 4. 对话统计（全量）
SELECT
  COUNT(*) AS total_conversations,
  COALESCE(SUM("totalCost"), 0) AS total_cost,
  COALESCE(SUM("totalTokens"), 0) AS total_tokens
FROM conversations;

-- 5. 近7天数据
SELECT
  COUNT(*) FILTER (WHERE content != '[message-counted]') AS messages_7d,
  COUNT(DISTINCT "userId") FILTER (WHERE content != '[message-counted]') AS mau_7d,
  COUNT(DISTINCT "conversationId") FILTER (WHERE content != '[message-counted]') AS convs_7d
FROM messages
WHERE "createdAt" >= NOW() - INTERVAL '7 days';

SELECT
  COALESCE(SUM("totalCost"), 0) AS cost_7d,
  COALESCE(SUM("totalTokens"), 0) AS tokens_7d
FROM conversations
WHERE "updatedAt" >= NOW() - INTERVAL '7 days';

-- 6. 检查重复消息（同对话+同用户+同内容出现多次）
SELECT
  "conversationId",
  "userId",
  LEFT(content, 60) AS content_preview,
  COUNT(*) AS duplicate_count
FROM messages
WHERE role = 'user'
  AND content != '[message-counted]'
GROUP BY "conversationId", "userId", content
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

-- 7. 检查同一对话中连续相同内容
SELECT
  m1.id AS msg1_id,
  m1."conversationId",
  m1.role,
  LEFT(m1.content, 80) AS content_preview,
  m1."createdAt" AS time1,
  m2.id AS msg2_id,
  m2."createdAt" AS time2,
  EXTRACT(EPOCH FROM (m2."createdAt" - m1."createdAt")) AS seconds_between
FROM messages m1
JOIN messages m2 ON m1."conversationId" = m2."conversationId"
  AND m1.id < m2.id
  AND m1.role = m2.role
  AND m1.content = m2.content
  AND m1.content != '[message-counted]'
ORDER BY "conversationId", m1."createdAt"
LIMIT 30;

-- 8. messages 表字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- 9. 消息样本
SELECT
  id,
  "conversationId",
  "userId",
  role,
  persona_id,
  LEFT(content, 100) AS content_preview,
  "tokensInput",
  "tokensOutput",
  "apiCost",
  "createdAt"::text
FROM messages
WHERE content != '[message-counted]'
ORDER BY "createdAt" DESC
LIMIT 10;
