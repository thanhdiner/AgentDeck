import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { safeStorage } from 'electron';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import type {
  DbConnectionConfig,
  DbSchemaMetadata,
  DbTableMetadata,
  DbColumnMetadata,
  DbAuditLog,
  DbConnectionSecretRecord
} from '../../shared/types.js';
import { readState, writeState, appDataPath } from './storageService.js';

const require = createRequire(import.meta.url);
const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadSqlJs() {
  sqlJsPromise ??= initSqlJs({ locateFile: (file) => (file === 'sql-wasm.wasm' ? sqlWasmPath : file) });
  return sqlJsPromise;
}

/**
 * Encrypt/Decrypt helper to secure database passwords in storage
 */
const IV_LENGTH = 16;
let fallbackEncryptionKey: Buffer | null = null;

function getFallbackKey(): Buffer {
  if (fallbackEncryptionKey) return fallbackEncryptionKey;
  const keyPath = path.join(path.dirname(SECRETS_FILE_PATH), '.db_key');
  try {
    const keyHex = fsSync.readFileSync(keyPath, 'utf8').trim();
    fallbackEncryptionKey = Buffer.from(keyHex, 'hex');
  } catch {
    fallbackEncryptionKey = crypto.randomBytes(32);
    try {
      fsSync.mkdirSync(path.dirname(keyPath), { recursive: true });
      fsSync.writeFileSync(keyPath, fallbackEncryptionKey.toString('hex'), 'utf8');
    } catch {
      fallbackEncryptionKey = crypto.scryptSync('agentdeck-db-secret-key-fallback', 'session-salt', 32);
    }
  }
  return fallbackEncryptionKey;
}

export function encrypt(text: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(text);
      return 'safestorage:' + encrypted.toString('base64');
    }
  } catch (err) {
    console.warn('[DATABASE SERVICE] safeStorage encryption failed, falling back to local key:', err);
  }

  const key = getFallbackKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return 'local:' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return text;
  
  if (text.startsWith('safestorage:')) {
    try {
      const encryptedBuffer = Buffer.from(text.substring('safestorage:'.length), 'base64');
      return safeStorage.decryptString(encryptedBuffer);
    } catch (err) {
      console.error('[DATABASE SERVICE] safeStorage decryption failed:', err);
      return '';
    }
  }

  if (text.startsWith('local:')) {
    try {
      const parts = text.substring('local:'.length).split(':');
      const iv = Buffer.from(parts.shift()!, 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const key = getFallbackKey();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (err) {
      console.error('[DATABASE SERVICE] Local key decryption failed:', err);
      return '';
    }
  }

  // Legacy fallback if stored raw or via legacy encryption
  try {
    const textParts = text.split(':');
    if (textParts.length === 2) {
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const key = crypto.scryptSync('agentdeck-db-secret-key-salt', 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    }
  } catch {
    // Ignore legacy decrypt failure
  }

  return text;
}

/**
 * Secure Main Process Secrets Storage Manager
 */
const SECRETS_FILE_PATH = appDataPath('db_secrets.json');
let secretsCache: DbConnectionSecretRecord[] | null = null;

async function loadSecrets(): Promise<DbConnectionSecretRecord[]> {
  if (secretsCache) return secretsCache;
  try {
    const data = await fs.readFile(SECRETS_FILE_PATH, 'utf8');
    secretsCache = JSON.parse(data) as DbConnectionSecretRecord[];
    return secretsCache;
  } catch {
    secretsCache = [];
    return secretsCache;
  }
}

async function saveSecrets(records: DbConnectionSecretRecord[]): Promise<void> {
  secretsCache = records;
  await fs.writeFile(SECRETS_FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
}

export async function getDbSecrets(connectionId: string): Promise<DbConnectionSecretRecord | undefined> {
  const secrets = await loadSecrets();
  return secrets.find(s => s.connectionId === connectionId);
}

export async function setDbSecrets(
  connectionId: string,
  secrets: { passwordEncryptedRef?: string; connectionStringEncryptedRef?: string; usernameEncryptedRef?: string }
): Promise<void> {
  const records = await loadSecrets();
  const existingIndex = records.findIndex(s => s.connectionId === connectionId);
  const now = Date.now();
  if (existingIndex !== -1) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...secrets,
      updatedAt: now
    };
  } else {
    records.push({
      connectionId,
      ...secrets,
      createdAt: now,
      updatedAt: now
    });
  }
  await saveSecrets(records);
}

export async function deleteDbSecrets(connectionId: string): Promise<void> {
  const records = await loadSecrets();
  const filtered = records.filter(s => s.connectionId !== connectionId);
  await saveSecrets(filtered);
}

/**
 * Log a database action into the audit trail in state.json
 */
export async function logDbAudit(
  workspaceId: string,
  connectionId: string,
  caller: 'agent' | 'user',
  sql: string,
  status: 'success' | 'failed',
  errorMessage?: string,
  approvedBy?: string
): Promise<void> {
  try {
    const state = await readState();
    const newLog: DbAuditLog = {
      id: `audit-${crypto.randomUUID()}`,
      workspaceId,
      connectionId,
      timestamp: Date.now(),
      caller,
      sql,
      status,
      errorMessage,
      approvedBy
    };
    
    state.databaseAuditLogs = [newLog, ...(state.databaseAuditLogs || [])].slice(0, 1000); // Limit to 1000 history entries
    await writeState(state);
  } catch (err) {
    console.error('[DATABASE SERVICE] Failed to write audit log:', err);
  }
}

/**
 * Test a database connection config
 */
function buildMongoUri(config: DbConnectionConfig, passwordDecrypted: string, usernameDecrypted?: string): string {
  let username = usernameDecrypted || config.maskedUsername || '';
  if (username.endsWith('****') && username.length > 4) {
    username = username.slice(0, -4);
  }
  
  let uri = `mongodb://`;
  if (username) {
    uri += `${encodeURIComponent(username)}`;
    if (passwordDecrypted) {
      uri += `:${encodeURIComponent(passwordDecrypted)}`;
    }
    uri += '@';
  }
  uri += `${config.host || 'localhost'}:${config.port || 27017}`;
  if (config.database) {
    uri += `/${config.database}`;
  }
  
  const queryParams: string[] = [];
  if (config.authSource) {
    queryParams.push(`authSource=${encodeURIComponent(config.authSource)}`);
  }
  if (config.ssl) {
    queryParams.push(`tls=true`);
  }
  
  if (queryParams.length > 0) {
    uri += `?${queryParams.join('&')}`;
  }
  return uri;
}

async function connectMongoClient(connStr: string) {
  // @ts-ignore
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(connStr, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    return client;
  } catch (err: any) {
    if (err.message?.includes('querySrv ECONNREFUSED') || err.message?.includes('querySrv ENOTFOUND')) {
      try {
        const dns = await import('node:dns');
        dns.setServers(['8.8.8.8', '8.8.4.4']);
        const retryClient = new MongoClient(connStr, { serverSelectionTimeoutMS: 5000 });
        await retryClient.connect();
        return retryClient;
      } catch {
        // Fallback failed, let original error propagate
      }
    }
    throw err;
  }
}

export async function testDbConnection(
  config: DbConnectionConfig,
  passwordOverride?: string,
  connectionStringOverride?: string,
  usernameOverride?: string
): Promise<{ ok: boolean; message: string }> {
  const dbType = config.type;

  if (dbType === 'sqlite') {
    if (!config.filepath) {
      return { ok: false, message: 'SQLite filepath is required' };
    }
    try {
      await fs.access(config.filepath);
      return { ok: true, message: 'SQLite database file verified successfully!' };
    } catch {
      // Create path if file does not exist to verify write access
      try {
        await fs.mkdir(path.dirname(config.filepath), { recursive: true });
        const fileHandle = await fs.open(config.filepath, 'a');
        await fileHandle.close();
        return { ok: true, message: 'Database file not found but successfully initialized a new SQLite file!' };
      } catch (err: any) {
        return { ok: false, message: `Failed to access or create SQLite file: ${err.message}` };
      }
    }
  }

  // Resolve password, connection string, and username
  let password = passwordOverride || '';
  let connectionString = connectionStringOverride || '';
  let username = usernameOverride || '';

  const secrets = await getDbSecrets(config.id);
  if (secrets) {
    if (!password) password = secrets.passwordEncryptedRef ? decrypt(secrets.passwordEncryptedRef) : '';
    if (!connectionString) connectionString = secrets.connectionStringEncryptedRef ? decrypt(secrets.connectionStringEncryptedRef) : '';
    if (!username) username = secrets.usernameEncryptedRef ? decrypt(secrets.usernameEncryptedRef) : '';
  }

  if (dbType === 'mongodb') {
    try {
      const connStr = connectionString || buildMongoUri(config, password, username);
      const client = await connectMongoClient(connStr);
      await client.db().admin().listDatabases();
      await client.close();
      return { ok: true, message: 'MongoDB connection verified successfully!' };
    } catch (err: any) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        return {
          ok: false,
          message: 'MongoDB driver (mongodb) is missing. Check your installation dependencies.'
        };
      }
      return { ok: false, message: `MongoDB connection failed: ${err.message}` };
    }
  }

  if (dbType === 'postgres' || dbType === 'supabase') {
    try {
      // @ts-ignore
      const { Client } = await import('pg');
      const cleanUser = username || config.maskedUsername || 'postgres';
      const user = cleanUser.endsWith('****') && cleanUser.length > 4 ? cleanUser.slice(0, -4) : cleanUser;
      const connStr = connectionString || `postgresql://${user}:${password}@${config.host}:${config.port}/${config.database}`;
      const client = new Client({
        connectionString: connStr,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
      });
      await client.connect();
      await client.end();
      return { ok: true, message: 'PostgreSQL connection verified successfully!' };
    } catch (err: any) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        return {
          ok: false,
          message: 'PostgreSQL driver is missing. Check your installation dependencies.'
        };
      }
      return { ok: false, message: `PostgreSQL connection failed: ${err.message}` };
    }
  }

  if (dbType === 'mysql') {
    try {
      // @ts-ignore
      const mysql = await import('mysql2/promise');
      const cleanUser = username || config.maskedUsername || 'root';
      const user = cleanUser.endsWith('****') && cleanUser.length > 4 ? cleanUser.slice(0, -4) : cleanUser;
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: user,
        password,
        database: config.database,
        connectTimeout: 5000,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined
      });
      await connection.end();
      return { ok: true, message: 'MySQL connection verified successfully!' };
    } catch (err: any) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        return {
          ok: false,
          message: 'MySQL driver (mysql2) is missing. Check your installation dependencies.'
        };
      }
      return { ok: false, message: `MySQL connection failed: ${err.message}` };
    }
  }

  return { ok: false, message: `Database type ${dbType} is planned but not currently implemented natively.` };
}

/**
 * Execute a query on a database connection
 */
export async function runDbQuery(
  config: DbConnectionConfig,
  sql: string
): Promise<{ columns: string[]; rows: any[] }> {
  const dbType = config.type;

  if (dbType === 'sqlite') {
    if (!config.filepath) throw new Error('SQLite filepath is required');
    const SQL = await loadSqlJs();
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(config.filepath);
    } catch {
      fileBuffer = Buffer.alloc(0);
    }
    const db = new SQL.Database(new Uint8Array(fileBuffer)) as any;
    try {
      const stmt = db.prepare(sql);
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      
      stmt.free();
      
      // If it was a mutation query, save back the state of SQLite database file
      const normalizedLower = sql.toLowerCase().trim();
      const isMutation = normalizedLower.startsWith('insert ') ||
                         normalizedLower.startsWith('update ') ||
                         normalizedLower.startsWith('delete ') ||
                         normalizedLower.startsWith('create ') ||
                         normalizedLower.startsWith('drop ') ||
                         normalizedLower.startsWith('alter ') ||
                         normalizedLower.startsWith('truncate ');
      
      if (isMutation) {
        const data = db.export();
        await fs.writeFile(config.filepath, Buffer.from(data));
      }
      
      return { columns, rows };
    } finally {
      db.close();
    }
  }

  // Resolve password and connection string secrets from secure store
  const secrets = await getDbSecrets(config.id);
  const password = secrets?.passwordEncryptedRef ? decrypt(secrets.passwordEncryptedRef) : '';
  const connectionString = secrets?.connectionStringEncryptedRef ? decrypt(secrets.connectionStringEncryptedRef) : '';
  const username = secrets?.usernameEncryptedRef ? decrypt(secrets.usernameEncryptedRef) : '';

  if (dbType === 'mongodb') {
    try {
      const connStr = connectionString || buildMongoUri(config, password, username);
      const client = await connectMongoClient(connStr);
      const db = client.db();

      const queryObj = JSON.parse(sql);
      const colName = queryObj.collection;
      if (!colName) {
        throw new Error('Collection name is required in Mongo query payload');
      }

      // TECHNICAL DEBT (P0 Shortcut): Using custom action strings inside runDbQuery for MongoDB metadata.
      // In a future refactoring, databaseService should expose specialized method APIs.
      const action = queryObj.action || 'find';

      if (action === 'count') {
        const filter = queryObj.filter || {};
        let count = 0;
        // Fast estimated count for collection preview, falling back to full count if filter is specified
        if (Object.keys(filter).length === 0) {
          count = await db.collection(colName).estimatedDocumentCount();
        } else {
          count = await db.collection(colName).countDocuments(filter);
        }
        await client.close();
        return { columns: ['count'], rows: [{ count }] };
      }

      if (action === 'schema') {
        const sampleDocs = await db.collection(colName).find().limit(20).toArray();
        const fieldsMap = new Map<string, { type: string; nullable: boolean }>();
        
        fieldsMap.set('_id', { type: 'ObjectId', nullable: false });

        for (const doc of sampleDocs) {
          for (const key of Object.keys(doc)) {
            if (key === '_id') continue;
            const val = doc[key];
            let detectedType: string = typeof val;
            if (val === null) {
              detectedType = 'null';
            } else if (Array.isArray(val)) {
              detectedType = 'array';
            } else if (val instanceof Date) {
              detectedType = 'date';
            } else if (typeof val === 'object') {
              detectedType = 'object';
            }
            
            fieldsMap.set(key, {
              type: detectedType,
              nullable: true
            });
          }
        }

        const columns = ['name', 'type', 'nullable', 'primaryKey'];
        const rows = Array.from(fieldsMap.entries()).map(([name, meta]) => ({
          name,
          type: meta.type,
          nullable: meta.nullable,
          primaryKey: name === '_id'
        }));

        await client.close();
        return { columns, rows };
      }

      if (action === 'indexes') {
        const indexes = await db.collection(colName).listIndexes().toArray();
        await client.close();
        const columns = ['name', 'key', 'unique', 'sparse'];
        const rows = indexes.map(idx => ({
          name: idx.name,
          key: JSON.stringify(idx.key),
          unique: !!idx.unique,
          sparse: !!idx.sparse
        }));
        return { columns, rows };
      }

      // Default to find action
      const filter = queryObj.filter || {};
      const limit = queryObj.limit || 20;
      const sort = queryObj.sort || {};

      let queryFilter = { ...filter };
      if (queryObj.cursor) {
        // @ts-ignore
        const { ObjectId } = await import('mongodb');
        let cursorVal = queryObj.cursor;
        if (typeof cursorVal === 'string') {
          if (cursorVal.startsWith('"') && cursorVal.endsWith('"')) {
            cursorVal = cursorVal.slice(1, -1);
          }
        }
        try {
          queryFilter._id = { $lt: new ObjectId(cursorVal) };
        } catch {
          // Safe fallback for custom non-ObjectId _id values
          queryFilter._id = { $lt: cursorVal };
        }
      }

      const docs = await db.collection(colName).find(queryFilter).sort(sort).limit(limit).toArray();
      await client.close();

      const columnsSet = new Set<string>();
      const rows = docs.map(doc => {
        const rowObj: Record<string, any> = {};
        for (const key of Object.keys(doc)) {
          columnsSet.add(key);
          const val = doc[key];
          
          // Stringify objects/arrays to display clean text representations in the results grid
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            try {
              rowObj[key] = JSON.stringify(val);
            } catch {
              rowObj[key] = String(val);
            }
          } else {
            rowObj[key] = val;
          }
        }
        return rowObj;
      });

      const columns = Array.from(columnsSet);
      if (columns.includes('_id')) {
        const index = columns.indexOf('_id');
        columns.splice(index, 1);
        columns.unshift('_id');
      }

      return { columns, rows };
    } catch (err: any) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        throw new Error('MongoDB driver (mongodb) is missing. Check your installation dependencies.');
      }
      throw err;
    }
  }

  if (dbType === 'postgres' || dbType === 'supabase') {
    // @ts-ignore
    const { Client } = await import('pg');
    const cleanUser = username || config.maskedUsername || 'postgres';
    const user = cleanUser.endsWith('****') && cleanUser.length > 4 ? cleanUser.slice(0, -4) : cleanUser;
    const connStr = connectionString || `postgresql://${user}:${password}@${config.host}:${config.port}/${config.database}`;
    const client = new Client({
      connectionString: connStr,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });
    await client.connect();
    try {
      const res = await client.query({ text: sql, rowMode: 'array' });
      const columns = res.fields.map((f: any) => f.name);
      
      // Format rows from array of arrays to array of objects
      const rows = res.rows.map((rowArr: any) => {
        const rowObj: Record<string, any> = {};
        columns.forEach((col: string, i: number) => {
          rowObj[col] = rowArr[i];
        });
        return rowObj;
      });
      
      return { columns, rows };
    } finally {
      await client.end();
    }
  }

  if (dbType === 'mysql') {
    // @ts-ignore
    const mysql = await import('mysql2/promise');
    const cleanUser = username || config.maskedUsername || 'root';
    const user = cleanUser.endsWith('****') && cleanUser.length > 4 ? cleanUser.slice(0, -4) : cleanUser;
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: user,
      password,
      database: config.database,
      connectTimeout: 5000,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
    try {
      const [rows, fields]: [any[], any[]] = await connection.query(sql);
      const columns = fields ? fields.map((f: any) => f.name) : [];
      return { columns, rows: Array.isArray(rows) ? rows : [] };
    } finally {
      await connection.end();
    }
  }

  throw new Error(`Execution not implemented natively for connection type: ${dbType}`);
}

/**
 * Retrieve schema catalog info (tables, columns, keys)
 */
export async function getDbSchema(config: DbConnectionConfig): Promise<DbSchemaMetadata> {
  const dbType = config.type;

  if (dbType === 'sqlite') {
    if (!config.filepath) throw new Error('SQLite filepath is required');
    const tables: DbTableMetadata[] = [];
    
    // SQLite query columns returns array of objects, extract table names
    const dbRes = await runDbQuery(config, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tableNames = dbRes.rows.map((r: any) => r.name as string);

    for (const name of tableNames) {
      const infoRes = await runDbQuery(config, `PRAGMA table_info("${name}");`);
      const fkRes = await runDbQuery(config, `PRAGMA foreign_key_list("${name}");`);
      
      const columns = infoRes.rows.map((r: any) => {
        const columnName = r.name as string;
        const fk = fkRes.rows.find((f: any) => f.from === columnName);
        
        const colMeta: DbColumnMetadata = {
          name: columnName,
          type: r.type as string,
          nullable: r.notnull === 0,
          primaryKey: r.pk > 0,
          defaultValue: r.dflt_value !== undefined ? String(r.dflt_value) : null
        };
        
        if (fk) {
          colMeta.foreignKey = {
            table: fk.table as string,
            column: fk.to as string
          };
        }
        return colMeta;
      });

      tables.push({ name, columns });
    }
    
    return { tables, updatedAt: Date.now() };
  }

  // Resolve secrets
  const secrets = await getDbSecrets(config.id);
  const password = secrets?.passwordEncryptedRef ? decrypt(secrets.passwordEncryptedRef) : '';
  const connectionString = secrets?.connectionStringEncryptedRef ? decrypt(secrets.connectionStringEncryptedRef) : '';
  const username = secrets?.usernameEncryptedRef ? decrypt(secrets.usernameEncryptedRef) : '';

  if (dbType === 'mongodb') {
    try {
      const connStr = connectionString || buildMongoUri(config, password, username);
      const client = await connectMongoClient(connStr);
      const db = client.db();

      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const userCollections = collections.filter(c => !c.name.startsWith('system.'));

      const tables = userCollections.map((colInfo) => ({
        name: colInfo.name,
        columns: []
      }));

      await client.close();
      return { tables, updatedAt: Date.now() };
    } catch (err: any) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message?.includes('Cannot find module')) {
        throw new Error('MongoDB driver (mongodb) is missing. Check your installation dependencies.');
      }
      throw err;
    }
  }

  if (dbType === 'postgres' || dbType === 'supabase') {
    const tableSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;
    const colSql = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        tc.constraint_type,
        kcu.table_name AS foreign_table,
        kcu.column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position;
    `;

    const { rows: tableRows } = await runDbQuery(config, tableSql);
    const { rows: colRows } = await runDbQuery(config, colSql);

    const tables: DbTableMetadata[] = [];
    
    tableRows.forEach((tRow: any) => {
      const tableName = tRow.table_name as string;
      const filteredCols = colRows.filter((c: any) => c.table_name === tableName);
      
      const columns = filteredCols.map((c: any) => {
        const colMeta: DbColumnMetadata = {
          name: c.column_name as string,
          type: c.data_type as string,
          nullable: c.is_nullable === 'YES',
          primaryKey: c.constraint_type === 'PRIMARY KEY',
          defaultValue: c.column_default !== null ? String(c.column_default) : null
        };
        
        if (c.constraint_type === 'FOREIGN KEY' && c.foreign_table) {
          colMeta.foreignKey = {
            table: c.foreign_table as string,
            column: c.foreign_column as string
          };
        }
        return colMeta;
      });

      tables.push({ name: tableName, columns });
    });

    return { tables, updatedAt: Date.now() };
  }

  if (dbType === 'mysql') {
    const tableSql = "SHOW TABLES;";
    const { rows: tableRows } = await runDbQuery(config, tableSql);
    const tableNames = (tableRows as any[]).map(tRow => {
      const firstKey = Object.keys(tRow)[0];
      return tRow[firstKey] as string;
    });

    try {
      const colSql = `
        SELECT 
          TABLE_NAME, 
          COLUMN_NAME, 
          COLUMN_TYPE, 
          IS_NULLABLE, 
          COLUMN_DEFAULT, 
          COLUMN_KEY 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        ORDER BY TABLE_NAME, ORDINAL_POSITION;
      `;
      const { rows: colRows } = await runDbQuery(config, colSql);

      const tableColumnsMap: Record<string, DbColumnMetadata[]> = {};
      for (const col of colRows as any[]) {
        const tName = col.TABLE_NAME as string;
        if (!tableColumnsMap[tName]) {
          tableColumnsMap[tName] = [];
        }

        const colMeta: DbColumnMetadata = {
          name: col.COLUMN_NAME as string,
          type: col.COLUMN_TYPE as string,
          nullable: col.IS_NULLABLE === 'YES',
          primaryKey: col.COLUMN_KEY === 'PRI',
          defaultValue: col.COLUMN_DEFAULT !== null ? String(col.COLUMN_DEFAULT) : null
        };

        if (col.COLUMN_KEY === 'MUL') {
          colMeta.foreignKey = null;
        }

        tableColumnsMap[tName].push(colMeta);
      }

      const tables: DbTableMetadata[] = tableNames.map(name => ({
        name,
        columns: tableColumnsMap[name] || []
      }));

      return { tables, updatedAt: Date.now() };
    } catch (err) {
      console.warn('Failed to query columns from information_schema, falling back to DESCRIBE queries:', err);
      const tables: DbTableMetadata[] = [];
      for (const tableName of tableNames) {
        try {
          const colSql = `DESCRIBE \`${tableName}\`;`;
          const { rows: colRows } = await runDbQuery(config, colSql);
          
          const columns = colRows.map((c: any) => {
            const columnName = c.Field as string;
            const colMeta: DbColumnMetadata = {
              name: columnName,
              type: c.Type as string,
              nullable: c.Null === 'YES',
              primaryKey: c.Key === 'PRI',
              defaultValue: c.Default !== null ? String(c.Default) : null
            };
            
            if (c.Key === 'MUL') {
              colMeta.foreignKey = null; 
            }
            return colMeta;
          });

          tables.push({ name: tableName, columns });
        } catch (tableErr) {
          console.error(`Failed to describe table ${tableName}:`, tableErr);
          tables.push({ name: tableName, columns: [] });
        }
      }
      return { tables, updatedAt: Date.now() };
    }
  }

  throw new Error(`Schema introspection not implemented for connection type: ${dbType}`);
}
