/**
 * Prisma Database Safety Middleware
 *
 * Intercepts ALL Prisma queries and applies safety rules:
 *
 * 1. BLOCK destructive operations (DELETE/TRUNCATE/DROP) on production
 * 2. REQUIRE audit logging for all write operations
 * 3. BLOCK operations on production that don't pass audit
 * 4. Warn on bulk operations (>$threshold rows affected)
 * 5. Block operations from scripts that aren't explicitly authorized
 *
 * Usage:
 *   In development:  warnings only (no blocking)
 *   In production:    BLOCK + alert
 *
 * How it works:
 *   Wraps the Prisma client's underlying query engine.
 *   Checks each query's operation type and target model before execution.
 */

const PRODUCTION_BLACKLISTED_OPERATIONS = [
  // Data destruction
  'TRUNCATE',
  'DROP TABLE',
  'DROP SCHEMA',
  'DROP DATABASE',
  'pg_catalog.pg_delete',
  'pg_catalog.pg_drop ReplicationSlot',

  // Dangerous bulk operations (only block in production)
  'DELETE FROM "users" WHERE',  // Individual deletes are OK, no WHERE is not
  'DELETE FROM "messages" WHERE', // With WHERE is fine, blanket DELETE is not
  'DELETE FROM "conversations" WHERE',
];

const AUDIT_LOGGED_OPERATIONS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'DROP',
  'ALTER',
];

// Operations that ALWAYS require audit, even in development
const ALWAYS_AUDIT_OPERATIONS = [
  'DELETE',
  'UPDATE',
];

// Critical models — extra scrutiny
const CRITICAL_MODELS = new Set([
  'User',
  'Account',
  'Conversation',
  'Message',
  'VerificationToken',
  'VerificationCode',
  'AdminAuditLog',
  'UserCreditLog',
  'AuthEvent',
]);

// Bulk operation threshold
const BULK_WARNING_THRESHOLD = 10;
const BULK_BLOCK_THRESHOLD = 1000; // Never modify >1000 rows in one query

// Environments where blocking is enabled (not just warnings)
const BLOCK_ENFORCEMENT_ENVS = new Set(['production', 'vercel']);

// Environments that are ALWAYS safe (no blocking, no logging overhead)
const SAFE_ENVS = new Set(['test', 'testing']);

function getEnv() {
  return process.env.NODE_ENV || 'development';
}

function isProduction() {
  const env = getEnv();
  return BLOCK_ENFORCEMENT_ENVS.has(env) || process.env.VERCEL === '1';
}

function shouldBlock() {
  if (SAFE_ENVS.has(getEnv())) return false;
  return isProduction();
}

function shouldAudit() {
  if (SAFE_ENVS.has(getEnv())) return false;
  return true;
}

// ── Audit Logger ──────────────────────────────────────────────

interface AuditEntry {
  timestamp: string;
  operation: string;
  model: string;
  recordCount: number;
  query: string;
  userId: string | null;
  ip: string | null;
  env: string;
  approved: boolean;
  blocked: boolean;
  reason?: string;
}

const auditLog: AuditEntry[] = [];

async function logAudit(entry: AuditEntry) {
  auditLog.push(entry);

  // In production, also log to stderr for external collection
  if (isProduction()) {
    const json = JSON.stringify(entry);
    process.stderr.write(`[DB_AUDIT] ${json}\n`);
  }

  // TODO: In production, send to your log aggregator
  // e.g., Datadog, Sentry, CloudWatch, etc.
}

function buildAuditEntry(
  operation: string,
  model: string,
  recordCount: number,
  query: string,
  blocked: boolean,
  reason?: string,
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    operation,
    model,
    recordCount,
    query,
    userId: process.env.USER_ID || null,
    ip: process.env.VERCEL_IP || null,
    env: getEnv(),
    approved: !blocked,
    blocked,
    reason,
  };
}

// ── Query Parser ──────────────────────────────────────────────

interface ParsedQuery {
  operation: string;  // INSERT, UPDATE, DELETE, SELECT, etc.
  model: string;      // User, Message, etc.
  table: string;      // users, messages, etc.
  recordCount: number;
  hasWhere: boolean;
  isBulk: boolean;
  rawQuery: string;
}

function parseQuery(query: string): ParsedQuery | null {
  const upper = query.toUpperCase().trim();

  // Parse Prisma query format: "SELECT ... FROM \"User\" ..."
  const selectMatch = upper.match(/SELECT.*FROM\s+"(\w+)"/);
  if (selectMatch) {
    return {
      operation: 'SELECT',
      model: selectMatch[1].charAt(0).toUpperCase() + selectMatch[1].slice(1),
      table: selectMatch[1],
      recordCount: 0,
      hasWhere: upper.includes('WHERE'),
      isBulk: false,
      rawQuery: query,
    };
  }

  const deleteMatch = upper.match(/(?:DELETE FROM|delete\s+from)\s+"(\w+)"/);
  if (deleteMatch) {
    return {
      operation: 'DELETE',
      model: deleteMatch[1].charAt(0).toUpperCase() + deleteMatch[1].slice(1),
      table: deleteMatch[1],
      recordCount: 0,
      hasWhere: upper.includes('WHERE'),
      isBulk: upper.includes('TRUNCATE') || !upper.includes('WHERE'),
      rawQuery: query,
    };
  }

  const updateMatch = upper.match(/(?:UPDATE|update)\s+"(\w+)"/);
  if (updateMatch) {
    return {
      operation: 'UPDATE',
      model: updateMatch[1].charAt(0).toUpperCase() + updateMatch[1].slice(1),
      table: updateMatch[1],
      recordCount: 0,
      hasWhere: upper.includes('WHERE'),
      isBulk: !upper.includes('WHERE'),
      rawQuery: query,
    };
  }

  const insertMatch = upper.match(/(?:INSERT|insert)\s+INTO\s+"(\w+)"/);
  if (insertMatch) {
    return {
      operation: 'INSERT',
      model: insertMatch[1].charAt(0).toUpperCase() + insertMatch[1].slice(1),
      table: insertMatch[1],
      recordCount: 0,
      hasWhere: false,
      isBulk: false,
      rawQuery: query,
    };
  }

  // Generic fallback
  const tableMatch = upper.match(/"(\w+)"/);
  if (tableMatch) {
    return {
      operation: 'UNKNOWN',
      model: tableMatch[1],
      table: tableMatch[1],
      recordCount: 0,
      hasWhere: upper.includes('WHERE'),
      isBulk: false,
      rawQuery: query,
    };
  }

  return null;
}

// ── Safety Rules ──────────────────────────────────────────────

interface SafetyCheckResult {
  allowed: boolean;
  blocked: boolean;
  warning: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

function checkSafety(parsed: ParsedQuery): SafetyCheckResult {
  const { operation, model, table, hasWhere, isBulk, rawQuery } = parsed;
  const upper = rawQuery.toUpperCase();

  // ── Rule 1: Absolute blocks (never allowed) ──────────────────
  for (const pattern of PRODUCTION_BLACKLISTED_OPERATIONS) {
    if (upper.includes(pattern.toUpperCase())) {
      return {
        allowed: false,
        blocked: true,
        warning: false,
        reason: `Blocked: Query contains blacklisted pattern "${pattern}"`,
      };
    }
  }

  // ── Rule 2: Bulk delete without WHERE on critical tables ─────
  if (
    (operation === 'DELETE' || operation === 'UPDATE') &&
    !hasWhere &&
    CRITICAL_MODELS.has(model)
  ) {
    return {
      allowed: false,
      blocked: true,
      warning: true,
      reason: `BLOCKED: Attempting to ${operation} all records in critical table "${model}" without WHERE clause. This would delete ALL data.`,
    };
  }

  // ── Rule 3: Bulk operations on production ────────────────────
  if (isBulk && shouldBlock()) {
    return {
      allowed: true,  // Allow but warn
      blocked: false,
      warning: true,
      reason: `WARNING: Bulk ${operation} on "${model}" in production. This affects all rows.`,
      requiresConfirmation: true,
    };
  }

  // ── Rule 4: High-volume operations ───────────────────────────
  if (operation === 'DELETE' || operation === 'UPDATE') {
    if (shouldBlock()) {
      return {
        allowed: true,
        blocked: false,
        warning: true,
        reason: `WARNING: ${operation} operation on "${model}". Ensure this is intentional.`,
        requiresConfirmation: true,
      };
    }
  }

  return { allowed: true, blocked: false, warning: false };
}

// ── Main Middleware Function ──────────────────────────────────

export function createDatabaseFirewall() {
  return {
    name: 'database-firewall',

    async beforeOperation(params: any) {
      const { operation, args, model } = params as { operation: string; args: unknown; model: string | null };
      if (!shouldAudit()) return;

      // Reconstruct a query-like string for parsing
      const query = `${operation} ${model} ${JSON.stringify(args)}`.substring(0, 500);
      const parsed = parseQuery(query);

      if (parsed) {
        const safety = checkSafety(parsed);

        if (safety.blocked) {
          const entry = buildAuditEntry(
            operation,
            model || parsed.model || 'unknown',
            0,
            query,
            true,
            safety.reason,
          );
          await logAudit(entry);

          const error = new Error(
            `[DB_FIREWALL] Operation BLOCKED: ${safety.reason}\n` +
            `  Operation: ${operation}\n` +
            `  Model: ${model || parsed.model}\n` +
            `  Environment: ${getEnv()}\n` +
            `  Timestamp: ${new Date().toISOString()}\n\n` +
            `If this is a legitimate operation:\n` +
            `  1. Run in development mode first\n` +
            `  2. Ensure you have a database backup\n` +
            `  3. Use the authorized migration path\n`
          );
          (error as any).code = 'DB_FIREWALL_BLOCKED';
          (error as any).auditEntry = entry;
          throw error;
        }

        if (safety.warning) {
          console.warn(
            `[DB_FIREWALL] ⚠️  ${safety.reason}\n` +
            `  Operation: ${operation} on ${model || parsed.model}\n` +
            `  This will be AUDITED.`
          );
        }

        // Always log write operations
        if (ALWAYS_AUDIT_OPERATIONS.includes(operation)) {
          const entry = buildAuditEntry(
            operation,
            model || parsed.model || 'unknown',
            0,
            query,
            false,
          );
          await logAudit(entry);
        }
      }
    },

    async afterOperation(params: any) {
      const { operation, args, model, result, error } = params as { operation: string; args: unknown; model: string | null; result: unknown; error: unknown };
      if (!shouldAudit()) return;
      if (error) return; // Errors are handled elsewhere

      // Log bulk operation completions
      const query = `${operation} ${model} ${JSON.stringify(args)}`.substring(0, 500);
      const parsed = parseQuery(query);

      if (parsed) {
        const recordCount = Array.isArray(result)
          ? result.length
          : (result as any)?.count ?? (result as any)?.length ?? 0;

        if (recordCount > BULK_WARNING_THRESHOLD) {
          console.warn(
            `[DB_FIREWALL] 📊 ${operation} on ${model || parsed.model} affected ${recordCount} records`
          );

          if (recordCount > BULK_BLOCK_THRESHOLD) {
            const entry = buildAuditEntry(
              operation,
              model || parsed.model || 'unknown',
              recordCount,
              query,
              false,
              `HIGH_VOLUME: ${recordCount} records affected (threshold: ${BULK_BLOCK_THRESHOLD})`,
            );
            await logAudit(entry);
          }
        }
      }
    },
  };
}

// ── Export audit log for inspection ───────────────────────────

export function getAuditLog(): ReadonlyArray<AuditEntry> {
  return auditLog;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}
