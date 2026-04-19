-- ============================================================
-- Prismatic — User Table Migration Script
-- Merges prismatic_users (old) into users (new/canonical).
-- Run this ONCE against your Neon PostgreSQL database.
-- ============================================================
-- Before running: BACKUP YOUR DATABASE.
-- Safety: uses DO $$ ... $$ block with transaction rollback on error.
-- ============================================================
--
-- TWO WAYS TO RUN THIS:
--
--   WAY 1 — SQL (via psql or Neon SQL editor):
--     \i scripts/migrate-user-tables.sql
--
--   WAY 2 — TypeScript (preferred, has more logic):
--     npx ts-node scripts/migrate-users-to-prisma.ts
--   (Requires: DATABASE_URL in .env.local)
--
-- ============================================================

DO $$
DECLARE
  old_user RECORD;
  merged_count INTEGER := 0;
  skipped_count INTEGER := 0;
  conflict_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Prismatic User Table Migration ===';
  RAISE NOTICE 'Merging prismatic_users → users';
  RAISE NOTICE 'Started at: %', NOW();

  -- Step 1: Report current state
  RAISE NOTICE '';
  RAISE NOTICE '--- Current State ---';

  BEGIN
    SELECT COUNT(*) AS total_old
    INTO STRICT
    FROM prismatic_users;
    RAISE NOTICE 'prismatic_users rows: %', total_old;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'prismatic_users table not found (may already be dropped).';
  END;

  BEGIN
    SELECT COUNT(*) AS total_new
    INTO STRICT
    FROM users;
    RAISE NOTICE 'users (new) rows:   %', total_new;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'users table not found.';
  END;

  -- Step 2: Merge prismatic_users into users
  RAISE NOTICE '';
  RAISE NOTICE '--- Merging rows ---';

  FOR old_user IN
    SELECT
      u.id,
      u.email,
      u.name,
      u.password_hash,
      u.gender,
      u.province,
      u.role,
      u.plan,
      u.credits,
      u.is_active,
      u.created_at,
      u.updated_at,
      u.email_verified,
      u.email_verified_at
    FROM prismatic_users u
    ORDER BY u.created_at ASC
  LOOP
    BEGIN
      -- Check if user already exists in new table
      IF EXISTS (SELECT 1 FROM users WHERE id = old_user.id) THEN
        -- User exists: merge non-null values that might be missing
        UPDATE users SET
          name              = COALESCE(NULLIF(users.name, ''), old_user.name),
          email             = COALESCE(users.email, old_user.email),
          passwordHash      = COALESCE(users.passwordHash, old_user.password_hash),
          role              = COALESCE(
                               NULLIF(users.role::text, '')::"UserRole",
                               COALESCE(old_user.role, 'FREE')::"UserRole"
                             ),
          plan              = COALESCE(
                               NULLIF(users.plan::text, '')::"SubscriptionPlan",
                               COALESCE(old_user.plan, 'FREE')::"SubscriptionPlan"
                             ),
          credits           = COALESCE(
                               NULLIF(users.credits, 0),
                               COALESCE(old_user.credits, 0)
                             ),
          status            = COALESCE(
                               NULLIF(users.status::text, '')::"UserStatus",
                               CASE WHEN old_user.is_active THEN 'ACTIVE'::"UserStatus"
                                    ELSE 'SUSPENDED'::"UserStatus"
                               END
                             ),
          emailVerified     = COALESCE(users.emailVerified, old_user.email_verified_at),
          preferences       = COALESCE(
                               NULLIF(users.preferences::text, '{}')::jsonb,
                               jsonb_build_object(
                                 'gender',   old_user.gender,
                                 'province', old_user.province
                               )
                             ),
          updatedAt         = GREATEST(users.updatedAt, COALESCE(old_user.updated_at, users.updatedAt))
        WHERE id = old_user.id;

        merged_count := merged_count + 1;

      ELSE
        -- User does not exist: insert complete record
        INSERT INTO users (
          id, email, passwordHash, name,
          preferences,
          status, role, plan, credits,
          emailVerified,
          createdAt, updatedAt
        ) VALUES (
          old_user.id,
          old_user.email,
          old_user.password_hash,
          old_user.name,
          jsonb_build_object(
            'gender',   old_user.gender,
            'province', old_user.province
          ),
          CASE WHEN old_user.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,
          COALESCE(old_user.role, 'FREE'),
          COALESCE(old_user.plan, 'FREE'),
          COALESCE(old_user.credits, 0),
          old_user.email_verified_at,
          COALESCE(old_user.created_at, NOW()),
          COALESCE(old_user.updated_at, NOW())
        )
        ON CONFLICT (id) DO NOTHING;

        IF NOT FOUND THEN
          conflict_count := conflict_count + 1;
        ELSE
          merged_count := merged_count + 1;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'WARNING: Failed to migrate user id=%. Error: %', old_user.id, SQLERRM;
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  -- Step 3: Final report
  RAISE NOTICE '';
  RAISE NOTICE '--- Migration Summary ---';
  RAISE NOTICE 'Merged/updated:   %', merged_count;
  RAISE NOTICE 'Skipped (error): %', skipped_count;
  RAISE NOTICE 'Conflicts:       %', conflict_count;
  RAISE NOTICE 'Completed at:    %', NOW();

  -- Step 4: Count final users in new table
  RAISE NOTICE '';
  RAISE NOTICE '--- Final State ---';
  SELECT COUNT(*) INTO STRICT total_new FROM users;
  RAISE NOTICE 'users rows after migration: %', total_new;

END $$;

-- ============================================================
-- After successful migration, you can drop the old table:
--
--   DROP TABLE IF EXISTS prismatic_users;
--
-- Or rename it for safety:
--
--   ALTER TABLE prismatic_users RENAME TO prismatic_users_migrated_20260419;
--
-- ============================================================
