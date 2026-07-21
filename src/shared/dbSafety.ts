import type { DbEnvironmentType, DbPermissionMode } from './types.js';

export interface SqlSafetyReview {
  sql: string;
  normalizedSql: string;
  safe: boolean;
  riskScore: number; // 0 to 100
  severity: 'info' | 'review' | 'danger' | 'block';
  message: string;
  suggestedSql: string;
}

/**
 * Strips SQL comments (-- comment and /* comment * /)
 */
export function stripSqlComments(sql: string): string {
  // Strip block comments
  let clean = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments
  clean = clean.split('\n').map(line => {
    const idx = line.indexOf('--');
    if (idx !== -1) {
      return line.substring(0, idx);
    }
    return line;
  }).join('\n');
  return clean;
}

/**
 * Detects if a SQL script contains query stacking (multiple active statements separated by semicolons).
 * It skips semicolons inside string literals ('...' or "...") and escaped characters.
 */
export function hasMultiStatements(sql: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      // Found a potential statement separator!
      // Check if there is any non-whitespace/non-comment character after this semicolon
      const remaining = sql.slice(i + 1).trim();
      if (remaining.length > 0 && !remaining.startsWith('--') && !remaining.startsWith('/*')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Analyzes a SQL query and returns its safety profile and risk score.
 */
export function validateSqlQuery(
  sql: string,
  env: DbEnvironmentType,
  mode: DbPermissionMode
): SqlSafetyReview {
  const cleanSql = stripSqlComments(sql).trim();
  const normalized = cleanSql.replace(/\s+/g, ' ').toLowerCase();

  const review: SqlSafetyReview = {
    sql,
    normalizedSql: cleanSql,
    safe: true,
    riskScore: 0,
    severity: 'info',
    message: 'Query is safe to execute.',
    suggestedSql: cleanSql
  };

  if (!normalized) {
    review.safe = false;
    review.message = 'Empty SQL query.';
    review.severity = 'block';
    review.riskScore = 100;
    return review;
  }

  // 0. Check for query stacking / multi-statement execution
  if (hasMultiStatements(cleanSql)) {
    if (mode === 'read-only' || mode === 'dev-write') {
      review.safe = false;
      review.riskScore = 95;
      review.severity = 'block';
      review.message = 'Multi-statement execution is strictly blocked in Read-Only and Dev-Write modes.';
      return review;
    }
    
    // In other modes, multi-statement queries carry a higher risk score
    review.riskScore = 60;
  }

  const isReadQuery = normalized.startsWith('select ') || 
                      normalized.startsWith('with ') || 
                      normalized.startsWith('explain ') || 
                      normalized.startsWith('pragma ') || 
                      normalized.startsWith('show ');

  const isDelete = normalized.includes('delete ');
  const isUpdate = normalized.includes('update ');
  const isInsert = normalized.includes('insert ');
  const isDrop = normalized.includes('drop ');
  const isTruncate = normalized.includes('truncate ');
  const isAlter = normalized.includes('alter ');
  const isCreate = normalized.includes('create ');

  // 1. Check CRITICAL actions (DROP, TRUNCATE)
  if (isDrop || isTruncate) {
    review.riskScore = 100;
    
    if (env === 'production' || env === 'staging') {
      review.safe = false;
      review.severity = 'block';
      review.message = `Structural modifications (DROP/TRUNCATE) are strictly blocked on ${env} environment.`;
      return review;
    }

    if (mode !== 'danger') {
      review.safe = false;
      review.severity = 'block';
      review.message = 'DROP or TRUNCATE commands require database "Danger Mode" to be enabled.';
      return review;
    }

    review.safe = false; // Still requires review/confirm even in danger mode
    review.severity = 'danger';
    review.message = 'WARNING: Executing destructive database command (DROP/TRUNCATE) in Danger Mode.';
    return review;
  }

  // 2. Production Environment Restrictions
  if (env === 'production') {
    // Danger Mode is strictly blocked in production
    if (mode === 'danger') {
      review.safe = false;
      review.riskScore = 100;
      review.severity = 'block';
      review.message = 'Danger Mode is strictly blocked on Production databases.';
      return review;
    }

    // All write actions in Production require Manual Approve
    if (mode === 'dev-write' && (isDelete || isUpdate || isInsert || isAlter || isCreate)) {
      review.safe = false;
      review.riskScore = 90;
      review.severity = 'review';
      review.message = 'Write operations on Production databases require Manual Approve mode.';
      return review;
    }
  }

  // 3. Read-only enforcement
  if (mode === 'read-only' && !isReadQuery) {
    review.safe = false;
    review.riskScore = 90;
    review.severity = 'block';
    review.message = 'Database is in Read-only Mode. Only SELECT, WITH, EXPLAIN, PRAGMA, and SHOW queries are allowed.';
    return review;
  }

  // 4. Mutating queries validation (UPDATE / DELETE)
  if (isDelete || isUpdate) {
    const hasWhere = normalized.includes(' where ');
    
    if (!hasWhere) {
      review.riskScore = 95;
      review.safe = false;
      review.severity = 'block';
      review.message = 'Destructive queries (UPDATE or DELETE) without a WHERE clause are strictly blocked.';
      return review;
    }

    review.riskScore = env === 'production' ? 80 : 40;

    if (mode === 'manual-approve' || env === 'production' || env === 'staging') {
      review.safe = false;
      review.severity = env === 'production' ? 'danger' : 'review';
      review.message = `Data mutation (UPDATE/DELETE) on ${env} or in Manual Approve mode requires user confirmation.`;
      return review;
    }

    // dev-write on local/dev with WHERE
    review.safe = true;
    review.severity = 'info';
    review.message = 'Data mutation query with WHERE is allowed in Dev Write mode.';
    return review;
  }

  // 5. Create / Alter commands
  if (isCreate || isAlter) {
    const isDestructiveAlter = isAlter && (normalized.includes('drop column') || normalized.includes('drop constraint'));
    review.riskScore = isDestructiveAlter ? 70 : 30;

    if (mode === 'manual-approve' || env === 'production' || env === 'staging') {
      review.safe = false;
      review.severity = isDestructiveAlter || env === 'production' ? 'danger' : 'review';
      review.message = `Schema modification query on ${env} requires user approval.`;
      return review;
    }

    review.safe = true;
    review.severity = 'info';
    return review;
  }

  // 6. Select query warnings (No regex limit injection to avoid query corruption)
  if (isReadQuery && (normalized.startsWith('select ') || normalized.startsWith('with '))) {
    const hasLimit = /\blimit\s+\d+/i.test(normalized);
    if (!hasLimit && !normalized.includes('count(')) {
      review.message = 'SELECT query does not have a LIMIT clause. Ensure you are not loading excessive rows.';
    }
  }

  return review;
}
