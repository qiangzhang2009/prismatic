-- ============================================================
-- Cleanup: Remove legacy "shared conversation" dirty data
-- Created: 2026-04-22
-- ============================================================
-- BEFORE RUNNING: Backup your database or run in a transaction
-- BEGIN;

-- Step 1: See what we're about to delete
SELECT 'conversations' as table_name, COUNT(*) as rows_to_delete
FROM conversations
WHERE id = 'local';

SELECT 'messages' as table_name, COUNT(*) as rows_to_delete
FROM messages
WHERE "conversationId" = 'local';

-- Step 2: Delete messages first (foreign key)
DELETE FROM messages WHERE "conversationId" = 'local';

-- Step 3: Delete the conversation
DELETE FROM conversations WHERE id = 'local';

-- Step 4: Verify cleanup
SELECT 'Remaining conversations' as check, COUNT(*) as count FROM conversations;
SELECT 'Remaining messages' as check, COUNT(*) as count FROM messages;

-- COMMIT; -- Uncomment to commit, or ROLLBACK; to undo
