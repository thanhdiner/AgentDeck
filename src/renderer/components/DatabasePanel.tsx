// Đã đọc AGENTS.md
import React, { useState, useEffect, useRef } from 'react';
import { useDeckStore } from '../store/deckStore';
import type { DbConnectionConfig, DbSchemaMetadata, DbTableMetadata } from '../../shared/types';

const ChevronDownIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function DatabasePanel() {
  const { activeWorkspaceId, workspaces, addDbConnection, deleteDbConnection } = useDeckStore();
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const dbConnections = activeWorkspace?.dbConnections || [];

  // Connection form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<DbConnectionConfig['type']>('sqlite');
  const [environment, setEnvironment] = useState<DbConnectionConfig['environment']>('local');
  const [permissionMode, setPermissionMode] = useState<DbConnectionConfig['permissionMode']>('read-only');
  const [connectionMethod, setConnectionMethod] = useState<'manual' | 'connection-string'>('manual');
  const [filepath, setFilepath] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [ssl, setSsl] = useState(false);

  // MongoDB states
  const [authSource, setAuthSource] = useState('admin');
  const [mongoCollection, setMongoCollection] = useState('');
  const [mongoFilter, setMongoFilter] = useState('{\n  \n}');
  const [mongoLimit, setMongoLimit] = useState(20);
  const [mongoActiveTab, setMongoActiveTab] = useState<'documents' | 'schema' | 'indexes' | 'query'>('documents');
  const [mongoDocs, setMongoDocs] = useState<any[] | null>(null);
  const [mongoCols, setMongoCols] = useState<string[]>([]);
  const [mongoDocCount, setMongoDocCount] = useState<number | null>(null);
  const [mongoIndexes, setMongoIndexes] = useState<any[] | null>(null);
  const [mongoIndexesError, setMongoIndexesError] = useState<string | null>(null);
  const [mongoPreviewLoading, setMongoPreviewLoading] = useState(false);
  const [mongoViewMode, setMongoViewMode] = useState<'table' | 'json'>('table');
  const [mongoPageSize, setMongoPageSize] = useState<number>(20);
  const [mongoHasMore, setMongoHasMore] = useState<boolean>(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [mongoDocsLoadingMore, setMongoDocsLoadingMore] = useState<boolean>(false);
  const [mongoCollectionSearch, setMongoCollectionSearch] = useState<string>('');
  const [mongoCollectionSearchInput, setMongoCollectionSearchInput] = useState<string>('');
  const [mongoCollectionsCache, setMongoCollectionsCache] = useState<Record<string, string[]>>({});

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Active Connection & Schema State
  const [activeConnId, setActiveConnId] = useState<string>('');
  const activeConnection = dbConnections.find(c => c.id === activeConnId) || dbConnections[0];
  
  const [schema, setSchema] = useState<DbSchemaMetadata | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Query Console State
  const [sql, setSql] = useState('');
  const [lastGeneratedSql, setLastGeneratedSql] = useState('');
  const [sqlPageSize, setSqlPageSize] = useState<number>(20);
  const [sqlOffset, setSqlOffset] = useState<number>(0);
  const [sqlHasMore, setSqlHasMore] = useState<boolean>(false);
  const [sqlLoadingMore, setSqlLoadingMore] = useState<boolean>(false);
  const [sqlPreviewColumns, setSqlPreviewColumns] = useState<string[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[]; safetyReview?: any } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  // Column header interactive states
  const [activeHeaderMenu, setActiveHeaderMenu] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Textarea ref and cursor tracking for inserting column names
  const sqlEditorRef = useRef<HTMLTextAreaElement>(null);
  const [lastCursorPos, setLastCursorPos] = useState<number | null>(null);
  const [sqlEditorCollapsed, setSqlEditorCollapsed] = useState(false);


  // Dropdown toggle states
  const [typeOpen, setTypeOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const permRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) setTypeOpen(false);
      if (envRef.current && !envRef.current.contains(event.target as Node)) setEnvOpen(false);
      if (permRef.current && !permRef.current.contains(event.target as Node)) setPermOpen(false);
      if (connRef.current && !connRef.current.contains(event.target as Node)) setConnOpen(false);
      
      const target = event.target as HTMLElement;
      if (!target.closest('.column-header-container')) {
        setActiveHeaderMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Production Environment Guardrail
  useEffect(() => {
    if (environment === 'production') {
      setPermissionMode('read-only');
    }
  }, [environment]);

  // Update default port when type changes
  useEffect(() => {
    if (type === 'mongodb') {
      if (port === 5432 || port === 3306) {
        setPort(27017);
      }
    } else if (type === 'postgres') {
      if (port === 27017 || port === 3306) {
        setPort(5432);
      }
    } else if (type === 'mysql') {
      if (port === 27017 || port === 5432) {
        setPort(3306);
      }
    }
  }, [type]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setMongoCollectionSearch(mongoCollectionSearchInput);
    }, 200);
    return () => clearTimeout(handler);
  }, [mongoCollectionSearchInput]);

  // Memoize filtered tables/collections list
  const filteredCollections = React.useMemo(() => {
    if (!schema?.tables) return [];
    if (activeConnection?.type !== 'mongodb') return schema.tables;
    if (!mongoCollectionSearch) return schema.tables;
    const searchLower = mongoCollectionSearch.toLowerCase();
    return schema.tables.filter(table => table.name.toLowerCase().includes(searchLower));
  }, [schema?.tables, mongoCollectionSearch, activeConnection?.type]);

  // Watch for active connection switch to load schema
  useEffect(() => {
    if (activeConnection) {
      void loadSchema(activeConnection);
      setActiveConnId(activeConnection.id);
      setSql('');
      setLastGeneratedSql('');
      setQueryResult(null);
      setQueryError(null);
      setSqlPageSize(20);
      setSqlOffset(0);
      setSqlHasMore(false);
      setSqlLoadingMore(false);
      setSqlPreviewColumns([]);
      if (activeConnection.type === 'mongodb') {
        setMongoCollection('');
        setMongoFilter('{\n  \n}');
        setMongoLimit(20);
        setMongoActiveTab('documents');
        setMongoDocs(null);
        setMongoCols([]);
        setMongoDocCount(null);
        setMongoIndexes(null);
        setMongoIndexesError(null);
        setMongoViewMode('table');
        setMongoPageSize(20);
        setMongoHasMore(false);
        setLastSeenId(null);
        setMongoDocsLoadingMore(false);
        setMongoCollectionSearch('');
        setMongoCollectionSearchInput('');
      }
    } else {
      setSchema(null);
      setSelectedTable(null);
    }
  }, [activeConnection?.id]);

  const loadSchema = async (conn: DbConnectionConfig) => {
    const isNewConnection = activeConnId !== conn.id;

    if (isNewConnection) {
      setSelectedTable(null);
      
      const cachedCollections = mongoCollectionsCache[conn.id];
      if (conn.type === 'mongodb' && cachedCollections) {
        setSchema({
          tables: cachedCollections.map(name => ({
            name,
            columns: []
          })),
          updatedAt: Date.now()
        });
      } else {
        setSchema(null);
      }
    }

    setSchemaLoading(true);

    try {
      const res = await window.agentDeck.databaseGetSchema(conn);
      if (res.ok) {
        if (conn.type === 'mongodb') {
          const names = res.data.tables.map(t => t.name);
          setMongoCollectionsCache(prev => ({
            ...prev,
            [conn.id]: names
          }));
        }

        setSchema(prev => {
          if (conn.type === 'mongodb' && prev) {
            const mergedTables = res.data.tables.map(newTable => {
              const existingTable = prev.tables.find(t => t.name === newTable.name);
              return {
                ...newTable,
                columns: existingTable && existingTable.columns.length > 0 ? existingTable.columns : newTable.columns
              };
            });
            return {
              ...res.data,
              tables: mergedTables
            };
          }
          return res.data;
        });

        if (selectedTable) {
          const stillExists = res.data.tables.some(t => t.name === selectedTable);
          if (!stillExists) {
            setSelectedTable(null);
            setMongoCollection('');
            setMongoDocs(null);
            setMongoCols([]);
          }
        }
      } else {
        if (isNewConnection) {
          setSchema(null);
        }
        console.error('Failed to load database schema:', res.error.message);
      }
    } catch (err) {
      if (isNewConnection) {
        setSchema(null);
      }
      console.error('Schema introspection error:', err);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleConnectionStringChange = (val: string) => {
    setConnectionString(val);
    if (!val.trim()) return;

    try {
      const url = new URL(val.trim());
      if (url.protocol.startsWith('postgres') || url.protocol.startsWith('postgresql')) {
        setType('postgres');
        if (url.hostname) setHost(url.hostname);
        if (url.port) setPort(Number(url.port));
        if (url.pathname) setDatabase(url.pathname.substring(1));
        if (url.username) setUsername(url.username);
        if (url.password) setPassword(decodeURIComponent(url.password));
      } else if (url.protocol.startsWith('mysql')) {
        setType('mysql');
        if (url.hostname) setHost(url.hostname);
        if (url.port) setPort(Number(url.port));
        if (url.pathname) setDatabase(url.pathname.substring(1));
        if (url.username) setUsername(url.username);
        if (url.password) setPassword(decodeURIComponent(url.password));
      } else if (url.protocol.startsWith('mongodb')) {
        setType('mongodb');
        if (url.hostname) setHost(url.hostname);
        if (url.port) setPort(Number(url.port));
        if (url.pathname) setDatabase(url.pathname.substring(1));
        if (url.username) setUsername(url.username);
        if (url.password) setPassword(decodeURIComponent(url.password));
        
        const authSrc = url.searchParams.get('authSource');
        if (authSrc) setAuthSource(authSrc);
      }
    } catch {
      // Ignore URL parse failure while the user is typing
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    const maskedUsername = username ? `${username.slice(0, 4)}****` : undefined;
    let maskedConnectionString: string | undefined = undefined;
    
    if (connectionString) {
      try {
        const url = new URL(connectionString);
        maskedConnectionString = `${url.protocol}//${url.username ? `${url.username.slice(0, 4)}••••••••@` : ''}${url.host}${url.pathname}${url.search}`;
      } catch {
        if (connectionString.startsWith('mongodb')) {
          maskedConnectionString = connectionString.replace(/\/\/[^@]+@/, '//••••••••@');
        } else {
          maskedConnectionString = `${type === 'mongodb' ? 'mongodb' : 'postgresql'}://••••••••`;
        }
      }
    }

    const tempConfig: DbConnectionConfig = {
      id: 'temp',
      workspaceId: activeWorkspaceId || '',
      name: name || 'Test Connection',
      type,
      environment,
      permissionMode,
      connectionMethod,
      filepath: type === 'sqlite' ? filepath.trim() : undefined,
      host: type !== 'sqlite' && connectionMethod === 'manual' ? host.trim() : undefined,
      port: type !== 'sqlite' && connectionMethod === 'manual' ? Number(port) : undefined,
      database: type !== 'sqlite' && connectionMethod === 'manual' ? database.trim() : undefined,
      maskedUsername: type !== 'sqlite' && connectionMethod === 'manual' ? maskedUsername : undefined,
      maskedConnectionString: type !== 'sqlite' && connectionMethod === 'connection-string' ? maskedConnectionString : undefined,
      ssl,
      authSource: type === 'mongodb' && connectionMethod === 'manual' ? authSource.trim() : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const res = await window.agentDeck.databaseTestConnection(tempConfig, password, connectionString, username);
      if (res.ok) {
        setTestResult({ ok: true, message: res.data.message });
      } else {
        setTestResult({ ok: false, message: res.error.message });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Connection attempt timed out.' });
    } finally {
      setTesting(false);
    }
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const maskedUsername = username ? `${username.slice(0, 4)}****` : undefined;
    let maskedConnectionString: string | undefined = undefined;
    
    if (connectionString) {
      try {
        const url = new URL(connectionString);
        maskedConnectionString = `${url.protocol}//${url.username ? `${url.username.slice(0, 4)}••••••••@` : ''}${url.host}${url.pathname}${url.search}`;
      } catch {
        if (connectionString.startsWith('mongodb')) {
          maskedConnectionString = connectionString.replace(/\/\/[^@]+@/, '//••••••••@');
        } else {
          maskedConnectionString = `${type === 'mongodb' ? 'mongodb' : 'postgresql'}://••••••••`;
        }
      }
    }

    await addDbConnection({
      name: name.trim(),
      type,
      environment,
      permissionMode,
      connectionMethod,
      filepath: type === 'sqlite' ? filepath.trim() : undefined,
      host: type !== 'sqlite' && connectionMethod === 'manual' ? host.trim() : undefined,
      port: type !== 'sqlite' && connectionMethod === 'manual' ? Number(port) : undefined,
      database: type !== 'sqlite' && connectionMethod === 'manual' ? database.trim() : undefined,
      maskedUsername: type !== 'sqlite' && connectionMethod === 'manual' ? maskedUsername : undefined,
      maskedConnectionString: type !== 'sqlite' && connectionMethod === 'connection-string' ? maskedConnectionString : undefined,
      ssl: type !== 'sqlite' ? ssl : false,
      password: type !== 'sqlite' && connectionMethod === 'manual' ? password : undefined,
      connectionString: type !== 'sqlite' && connectionString ? connectionString.trim() : undefined,
      username: type !== 'sqlite' && connectionMethod === 'manual' ? username.trim() : undefined,
      authSource: type === 'mongodb' && connectionMethod === 'manual' ? authSource.trim() : undefined
    });

    // Reset form states and CLEAR raw credential secrets
    setName('');
    setFilepath('');
    setDatabase('');
    setUsername('');
    setPassword('');
    setConnectionString('');
    setHost('localhost');
    setPort(5432);
    setConnectionMethod('manual');
    setAuthSource('admin');
    setShowAddForm(false);
    setTestResult(null);
  };

  const buildSqlPreviewQuery = (tableName: string, cols: string[], limit: number, offset: number): string => {
    if (!tableName) return '';
    const quote = activeConnection?.type === 'mysql' ? '`' : '"';
    const tableWithQuotes = `${quote}${tableName}${quote}`;
    
    let selectList = '*';
    if (cols && cols.length > 0) {
      selectList = cols.map(c => `${quote}${c}${quote}`).join(', ');
    }
    
    return `SELECT ${selectList} FROM ${tableWithQuotes} LIMIT ${limit} OFFSET ${offset};`;
  };

  const handleSqlLoadMore = async () => {
    if (!selectedTable) return;
    const nextOffset = sqlOffset + sqlPageSize;
    const queryText = buildSqlPreviewQuery(selectedTable, sqlPreviewColumns, sqlPageSize, nextOffset);
    setSql(queryText);
    setLastGeneratedSql(queryText);
    setSqlOffset(nextOffset);
    await executeSqlQuery(queryText, true);
  };

  const executeSqlQuery = async (queryText: string, loadMore = false) => {
    if (!activeConnection || !queryText.trim()) return;
    
    if (loadMore) {
      setSqlLoadingMore(true);
    } else {
      setQueryLoading(true);
      setQueryResult(null);
    }
    setQueryError(null);
    setSafetyNotice(null);

    try {
      const res = await window.agentDeck.databaseRunQuery(activeConnection, queryText, 'user');
      if (res.ok) {
        const newRows = res.data.rows || [];
        if (loadMore) {
          setQueryResult(prev => {
            if (!prev) return res.data;
            return {
              ...prev,
              rows: [...prev.rows, ...newRows]
            };
          });
        } else {
          setQueryResult(res.data);
        }

        if (res.data.safetyReview?.message) {
          setSafetyNotice(res.data.safetyReview.message);
        }

        // Set pagination state if this is an app-generated preview query
        const clean = queryText.trim().replace(/\s+/g, ' ').toLowerCase();
        const isAppQuery = queryText === lastGeneratedSql || (clean.startsWith('select ') && clean.includes(' limit ') && clean.includes(' offset '));
        if (isAppQuery) {
          setSqlHasMore(newRows.length === sqlPageSize);
        } else {
          setSqlHasMore(false);
        }
      } else {
        setQueryError(res.error.message);
        setSqlHasMore(false);
      }
    } catch (err: any) {
      setQueryError(err.message || 'Query execution failed.');
      setSqlHasMore(false);
    } finally {
      setQueryLoading(false);
      setSqlLoadingMore(false);
    }
  };

  const handleRunQuery = async () => {
    if (!activeConnection) return;
    
    let queryText = sql;
    
    if (activeConnection.type === 'mongodb') {
      if (!mongoCollection) {
        setQueryError('Please select a collection first.');
        return;
      }
      
      let parsedFilter = {};
      try {
        const trimmed = mongoFilter.trim();
        if (trimmed) {
          parsedFilter = JSON.parse(trimmed);
        }
      } catch (err: any) {
        setQueryError(`Invalid filter JSON: ${err.message}`);
        return;
      }
      
      queryText = JSON.stringify({
        collection: mongoCollection,
        filter: parsedFilter,
        limit: mongoLimit || 20
      });
    }

    await executeSqlQuery(queryText);
  };

  const loadMongoCollectionPreview = async (collectionName: string, loadMore = false, overridePageSize?: number, forceRefreshMetadata = false) => {
    if (!activeConnection || activeConnection.type !== 'mongodb' || !collectionName) return;

    const pageSizeToUse = overridePageSize !== undefined ? overridePageSize : mongoPageSize;

    if (loadMore) {
      setMongoDocsLoadingMore(true);
    } else {
      setMongoPreviewLoading(true);
      setMongoDocs(null);
      setMongoCols([]);
      setLastSeenId(null);
      setMongoHasMore(false);
    }
    setQueryError(null);
    setMongoIndexesError(null);

    // 1. Fetch preview documents (always read-only find with limit of pageSizeToUse)
    const fetchDocs = async () => {
      try {
        const queryParams: any = {
          collection: collectionName,
          filter: {},
          sort: { _id: -1 },
          limit: pageSizeToUse
        };

        if (loadMore && lastSeenId) {
          queryParams.cursor = lastSeenId;
        }

        const docsRes = await window.agentDeck.databaseRunQuery(
          activeConnection,
          JSON.stringify(queryParams),
          'user'
        );

        if (docsRes.ok) {
          const newRows = docsRes.data.rows || [];
          
          setMongoDocs((prev) => {
            const currentDocs = loadMore && prev ? prev : [];
            const merged = [...currentDocs, ...newRows];
            return merged;
          });
          setMongoCols(docsRes.data.columns || []);

          if (newRows.length > 0) {
            const lastDoc = newRows[newRows.length - 1];
            if (lastDoc && lastDoc._id !== undefined) {
              setLastSeenId(lastDoc._id);
            } else {
              setLastSeenId(null);
            }
          }
          setMongoHasMore(newRows.length === pageSizeToUse);
        } else {
          if (!loadMore) {
            setMongoDocs(null);
            setMongoCols([]);
          }
          setQueryError(docsRes.error.message);
        }
      } catch (err: any) {
        if (!loadMore) {
          setMongoDocs(null);
          setMongoCols([]);
        }
        setQueryError(err.message || 'Failed to fetch preview documents.');
      }
    };

    // 2. Fetch count (uses fast metadata estimatedDocumentCount if filter is empty)
    const fetchCount = async () => {
      if (loadMore) return;
      try {
        const countRes = await window.agentDeck.databaseRunQuery(
          activeConnection,
          JSON.stringify({
            collection: collectionName,
            action: 'count'
          }),
          'user'
        );
        if (countRes.ok && countRes.data.rows?.[0]) {
          setMongoDocCount(countRes.data.rows[0].count);
        } else {
          setMongoDocCount('Count unavailable' as any);
        }
      } catch {
        setMongoDocCount('Count unavailable' as any);
      }
    };

    // 3. Fetch indexes (has its own error state, does not fail the main query or documents tab)
    const fetchIndexes = async () => {
      if (loadMore) return;
      try {
        const indexesRes = await window.agentDeck.databaseRunQuery(
          activeConnection,
          JSON.stringify({
            collection: collectionName,
            action: 'indexes'
          }),
          'user'
        );
        if (indexesRes.ok) {
          setMongoIndexes(indexesRes.data.rows);
        } else {
          setMongoIndexes(null);
          setMongoIndexesError(indexesRes.error.message);
        }
      } catch (err: any) {
        setMongoIndexes(null);
        setMongoIndexesError(err.message || 'Failed to load collection indexes.');
      }
    };

    // 4. Fetch inferred schema (runs if not already cached in schema, or if forceRefreshMetadata is true)
    const fetchSchema = async () => {
      if (loadMore) return;
      const cachedTable = schema?.tables.find(t => t.name === collectionName);
      if (cachedTable && cachedTable.columns && cachedTable.columns.length > 0 && !forceRefreshMetadata) {
        return;
      }
      try {
        const schemaRes = await window.agentDeck.databaseRunQuery(
          activeConnection,
          JSON.stringify({
            collection: collectionName,
            action: 'schema'
          }),
          'user'
        );
        if (schemaRes.ok) {
          const inferredColumns = schemaRes.data.rows.map((row: any) => ({
            name: row.name,
            type: row.type,
            nullable: row.nullable,
            primaryKey: row.primaryKey
          }));
          setSchema(prev => {
            if (!prev) return null;
            return {
              ...prev,
              tables: prev.tables.map(t => {
                if (t.name === collectionName) {
                  return {
                    ...t,
                    columns: inferredColumns
                  };
                }
                return t;
              })
            };
          });
        }
      } catch (err) {
        console.error('Failed to load inferred schema for collection:', err);
      }
    };

    if (loadMore) {
      await fetchDocs();
      setMongoDocsLoadingMore(false);
    } else {
      // Query all in parallel safely using Promise.allSettled
      await Promise.allSettled([
        fetchDocs(),
        fetchCount(),
        fetchIndexes(),
        fetchSchema()
      ]);
      setMongoPreviewLoading(false);
    }
  };

  const quickSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    if (activeConnection?.type === 'mongodb') {
      setMongoCollection(tableName);
      setMongoActiveTab('documents');
      void loadMongoCollectionPreview(tableName);
    } else {
      setSqlOffset(0);
      setSqlPreviewColumns([]);
      setSqlHasMore(false);
      const queryText = buildSqlPreviewQuery(tableName, [], sqlPageSize, 0);
      setSql(queryText);
      setLastGeneratedSql(queryText);
      void executeSqlQuery(queryText, false);
    }
    setLastCursorPos(null);
  };

  const handleColumnClick = (colName: string) => {
    const textarea = sqlEditorRef.current;
    
    if (activeConnection?.type === 'mongodb') {
      const currentText = mongoFilter;
      const trimmed = currentText.trim();
      const isEmptyOrTemplate = !trimmed || /^\{\s*\}$/.test(trimmed);
      
      let newText = '';
      let newPos = 0;
      
      if (isEmptyOrTemplate) {
        const inserted = `{\n  "${colName}": ""\n}`;
        newText = inserted;
        newPos = 9 + colName.length;
      } else {
        let insertPos = lastCursorPos !== null ? lastCursorPos : currentText.length;
        let prefix = currentText;
        let suffix = '';
        
        // If inserting at the end, and the query ends with a closing brace, insert before the brace
        if (insertPos === currentText.length && trimmed.endsWith('}')) {
          const lastBraceIdx = currentText.lastIndexOf('}');
          if (lastBraceIdx !== -1) {
            insertPos = lastBraceIdx;
          }
        }
        
        prefix = currentText.substring(0, insertPos);
        suffix = currentText.substring(insertPos);
        
        const inserted = `"${colName}": ""`;
        let separator = '';
        
        const trimmedPrefix = prefix.trim();
        if (trimmedPrefix && !trimmedPrefix.endsWith('{') && !trimmedPrefix.endsWith(',')) {
          const matchWs = prefix.match(/\s+$/);
          if (matchWs) {
            const ws = matchWs[0];
            const beforeWs = prefix.substring(0, prefix.length - ws.length);
            prefix = beforeWs + ',';
            separator = ws;
            if (ws.includes('\n')) {
              if (!separator.includes('  ')) {
                separator += '  ';
              }
            } else {
              if (!separator.includes(' ')) {
                separator += ' ';
              }
            }
          } else {
            separator = ',\n  ';
          }
        } else if (trimmedPrefix.endsWith('{')) {
          const matchWs = prefix.match(/\s+$/);
          if (!matchWs) {
            separator = '\n  ';
          }
        }
        
        if (currentText.includes('\n') && suffix.trim() === '}') {
          suffix = '\n}';
        }
        
        newText = prefix + separator + inserted + suffix;
        newPos = prefix.length + separator.length + inserted.length - 1;
      }
      
      setMongoFilter(newText);
      setLastCursorPos(newPos);
      
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 50);
      return;
    }

    const currentText = sql;
    
    // Check if the current editor query is empty or matches the last generated preview query
    const isCustomQuery = currentText.trim().length > 0 && currentText !== lastGeneratedSql;
    
    if (!isCustomQuery) {
      // 1. Safe Auto-Preview path
      const quote = activeConnection?.type === 'mysql' ? '`' : '"';
      const tableWithQuotes = selectedTable ? `${quote}${selectedTable}${quote}` : '';
      
      let newCols: string[] = [];
      if (!currentText.trim() || !selectedTable) {
        newCols = [colName];
      } else {
        const match = currentText.trim().match(/^SELECT\s+(.+?)\s+FROM\s+(.+?)\s+LIMIT\s+\d+\s*(?:OFFSET\s+\d+)?\s*;?$/i);
        if (match) {
          const selectList = match[1].trim();
          const cleanTableName = match[2].trim().replace(/[`"]/g, '');
          if (cleanTableName === selectedTable) {
            if (selectList === '*') {
              newCols = [colName];
            } else {
              const columns = selectList.split(',').map(c => c.trim().replace(/[`"]/g, ''));
              if (columns.includes(colName)) {
                newCols = columns;
              } else {
                newCols = [...columns, colName];
              }
            }
          } else {
            newCols = [colName];
          }
        } else {
          newCols = [colName];
        }
      }
      
      setSqlPreviewColumns(newCols);
      setSqlOffset(0);
      setSqlHasMore(false);
      
      const newQuery = buildSqlPreviewQuery(selectedTable || '', newCols, sqlPageSize, 0);
      setSql(newQuery);
      setLastGeneratedSql(newQuery);
      void executeSqlQuery(newQuery, false);
      return;
    }

    // 2. User Custom Query fallback path (inserts column at cursor, does NOT auto-execute)
    const isDefaultQuery = selectedTable && (
      currentText === `SELECT * FROM "${selectedTable}" LIMIT 20;` ||
      currentText === `SELECT * FROM ${selectedTable} LIMIT 20;`
    );
    if (isDefaultQuery) {
      const inserted = `"${colName}"`;
      const newText = currentText.replace('*', inserted);
      setSql(newText);
      const newCursorPos = currentText.indexOf('*') + inserted.length;
      setLastCursorPos(newCursorPos);
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 50);
      return;
    }

    let insertPos = lastCursorPos !== null ? lastCursorPos : currentText.length;
    let textToInsertInto = currentText;
    let suffix = '';
    
    if (insertPos === currentText.length && currentText.trim().endsWith(';')) {
      const lastSemicolonIndex = currentText.lastIndexOf(';');
      textToInsertInto = currentText.substring(0, lastSemicolonIndex);
      insertPos = textToInsertInto.length;
      suffix = ';';
    }
    
    const textBefore = textToInsertInto.substring(0, insertPos);
    let inserted = `"${colName}"`;
    if (/[a-zA-Z0-9_"]$/.test(textBefore)) {
      const selectIdx = textBefore.toLowerCase().lastIndexOf('select');
      const fromIdx = textBefore.toLowerCase().lastIndexOf('from');
      if (selectIdx !== -1 && (fromIdx === -1 || fromIdx < selectIdx)) {
        inserted = `, "${colName}"`;
      }
    }
    
    const newText = textToInsertInto.substring(0, insertPos) + inserted + textToInsertInto.substring(insertPos) + suffix;
    setSql(newText);
    setLastCursorPos(insertPos + inserted.length);
    
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(insertPos + inserted.length, insertPos + inserted.length);
      }
    }, 50);
  };

  const getSortedRows = () => {
    if (!queryResult) return [];
    if (!sortConfig) return queryResult.rows;
    return [...queryResult.rows].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#101012',
      color: '#e2e8f0',
      overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
    }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #222225', background: '#141416' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fafafa', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          </svg>
          Database Connections
        </h3>
        <button
          onClick={() => {
            if (showAddForm) {
              setName('');
              setFilepath('');
              setDatabase('');
              setUsername('');
              setPassword('');
              setConnectionString('');
              setHost('localhost');
              setPort(5432);
              setConnectionMethod('manual');
              setSsl(false);
            }
            setShowAddForm(!showAddForm);
            setTestResult(null);
          }}
          style={{
            background: showAddForm ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.15)',
            border: `1px solid ${showAddForm ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
            color: showAddForm ? '#fca5a5' : '#7dd3fc',
            padding: '5px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Database'}
        </button>
      </div>

      {/* ADD CONNECTION FORM */}
      {showAddForm && (
        <form onSubmit={handleAddConnection} style={{ padding: '16px', borderBottom: '1px solid #222225', background: '#16161a', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Connection Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SQLite Local, Postgres Dev" required style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Database Type</label>
              <div ref={typeRef} style={{ position: 'relative', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setTypeOpen(!typeOpen)}
                  className={`panel-select-trigger ${typeOpen ? 'open' : ''}`}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                >
                  <span className="panel-select-trigger-label">
                    <span className="panel-select-trigger-text" style={{ fontSize: '12px', textTransform: 'none', color: '#f4f4f5' }}>
                      {type === 'sqlite' ? 'SQLite (local file)' : type === 'postgres' ? 'PostgreSQL / Supabase' : type === 'mysql' ? 'MySQL' : 'MongoDB'}
                    </span>
                  </span>
                  <ChevronDownIcon size={12} />
                </button>
                {typeOpen && (
                  <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100, background: '#1a1a1c', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                    {[
                      { val: 'sqlite', label: 'SQLite (local file)' },
                      { val: 'postgres', label: 'PostgreSQL / Supabase' },
                      { val: 'mysql', label: 'MySQL' },
                      { val: 'mongodb', label: 'MongoDB' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setType(opt.val as any);
                          setTypeOpen(false);
                        }}
                        className={`panel-select-option ${type === opt.val ? 'active' : ''}`}
                        style={{ padding: '6px 8px', fontSize: '12px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'none' }}>
                          {opt.label}
                        </span>
                        {type === opt.val && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Environment</label>
              <div ref={envRef} style={{ position: 'relative', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setEnvOpen(!envOpen)}
                  className={`panel-select-trigger ${envOpen ? 'open' : ''}`}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                >
                  <span className="panel-select-trigger-label">
                    <span className="panel-select-trigger-text" style={{ fontSize: '12px', textTransform: 'capitalize', color: '#f4f4f5' }}>
                      {environment}
                    </span>
                  </span>
                  <ChevronDownIcon size={12} />
                </button>
                {envOpen && (
                  <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100, background: '#1a1a1c', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                    {['local', 'dev', 'staging', 'production'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setEnvironment(opt as any);
                          setEnvOpen(false);
                        }}
                        className={`panel-select-option ${environment === opt ? 'active' : ''}`}
                        style={{ padding: '6px 8px', fontSize: '12px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                          {opt}
                        </span>
                        {environment === opt && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Permission Mode</label>
              <div ref={permRef} style={{ position: 'relative', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setPermOpen(!permOpen)}
                  className={`panel-select-trigger ${permOpen ? 'open' : ''}`}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                >
                  <span className="panel-select-trigger-label">
                    <span className="panel-select-trigger-text" style={{ fontSize: '12px', textTransform: 'none', color: '#f4f4f5' }}>
                      {permissionMode === 'read-only' ? 'Read Only (SELECT only)' :
                       permissionMode === 'manual-approve' ? 'Manual Approve DML' :
                       permissionMode === 'dev-write' ? 'Dev Write (Auto-run WHERE)' : 'Danger Mode (Full access)'}
                    </span>
                  </span>
                  <ChevronDownIcon size={12} />
                </button>
                {permOpen && (
                  <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100, background: '#1a1a1c', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                    {[
                      { val: 'read-only', label: 'Read Only (SELECT only)' },
                      { val: 'manual-approve', label: 'Manual Approve DML' },
                      ...(environment !== 'production' ? [
                        { val: 'dev-write', label: 'Dev Write (Auto-run WHERE)' },
                        { val: 'danger', label: 'Danger Mode (Full access)' }
                      ] : [])
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setPermissionMode(opt.val as any);
                          setPermOpen(false);
                        }}
                        className={`panel-select-option ${permissionMode === opt.val ? 'active' : ''}`}
                        style={{ padding: '6px 8px', fontSize: '12px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'none' }}>
                          {opt.label}
                        </span>
                        {permissionMode === opt.val && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {environment === 'production' && (
            <div style={{
              padding: '8px 10px',
              borderRadius: '4px',
              fontSize: '11.5px',
              lineHeight: 1.45,
              border: '1px solid rgba(251, 191, 36, 0.28)',
              background: 'rgba(251, 191, 36, 0.08)',
              color: '#fcd34d',
              fontWeight: 500
            }}>
              ⚠️ WARNING: Connecting to a Production database. The permission mode is restricted to Read Only by default. Dangerous actions (DROP, TRUNCATE, ALTER) are strictly blocked.
            </div>
          )}

          {type !== 'sqlite' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Connection Method</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('manual')}
                  style={{
                    flex: 1,
                    background: connectionMethod === 'manual' ? 'rgba(59, 130, 246, 0.15)' : '#0e0e10',
                    border: `1px solid ${connectionMethod === 'manual' ? '#3b82f6' : '#2e2e34'}`,
                    borderRadius: '4px',
                    color: connectionMethod === 'manual' ? '#7dd3fc' : '#a1a1aa',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Manual Fields
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('connection-string')}
                  style={{
                    flex: 1,
                    background: connectionMethod === 'connection-string' ? 'rgba(59, 130, 246, 0.15)' : '#0e0e10',
                    border: `1px solid ${connectionMethod === 'connection-string' ? '#3b82f6' : '#2e2e34'}`,
                    borderRadius: '4px',
                    color: connectionMethod === 'connection-string' ? '#7dd3fc' : '#a1a1aa',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Connection String
                </button>
              </div>
            </div>
          )}

          {type === 'sqlite' ? (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Filepath *</label>
              <input value={filepath} onChange={e => setFilepath(e.target.value)} placeholder="e.g. D:/projects/myapp/dev.db" required style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
            </div>
          ) : connectionMethod === 'connection-string' ? (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Connection String URL *</label>
              <textarea
                value={connectionString}
                onChange={e => handleConnectionStringChange(e.target.value)}
                placeholder={type === 'mongodb' ? "mongodb://user:password@host:27017/database" : "postgresql://user:password@host:5432/database"}
                required
                style={{
                  width: '100%',
                  height: '60px',
                  background: '#0e0e10',
                  border: '1px solid #2e2e34',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  fontSize: '12px',
                  color: '#f4f4f5',
                  resize: 'none',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '4px', lineHeight: 1.45 }}>
                * Transient input state. Raw credentials are never logged or stored in the state.json/Zustand store.
              </div>
              {connectionString && (
                <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: '#d4d4d8', fontWeight: 600 }}>Masked Preview:</span>
                  <span style={{ background: '#1c1c1f', padding: '4px 6px', borderRadius: '4px', border: '1px solid #2e2e34', color: '#e4e4e7' }}>
                    {(() => {
                      try {
                        const url = new URL(connectionString.trim());
                        return `${url.protocol}//${url.username ? `${url.username.slice(0, 4)}••••••••@` : ''}${url.host}${url.pathname}${url.search}`;
                      } catch {
                        if (connectionString.startsWith('mongodb')) {
                          return connectionString.replace(/\/\/[^@]+@/, '//••••••••@');
                        }
                        return `${type === 'mongodb' ? 'mongodb' : 'postgresql'}://••••••••`;
                      }
                    })()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Host</label>
                  <input value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Port</label>
                  <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Database Name</label>
                  <input value={database} onChange={e => setDatabase(e.target.value)} placeholder={type === 'mongodb' ? 'test' : 'my_database'} style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder={type === 'mongodb' ? 'admin' : 'postgres'} style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                </div>
              </div>

              <div style={{ display: type === 'mongodb' ? 'grid' : 'block', gridTemplateColumns: type === 'mongodb' ? '1fr 1fr' : 'none', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                </div>
                {type === 'mongodb' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Auth Source</label>
                    <input value={authSource} onChange={e => setAuthSource(e.target.value)} placeholder="admin" style={{ width: '100%', background: '#0e0e10', border: '1px solid #2e2e34', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#f4f4f5' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#d4d4d8', cursor: 'pointer' }}>
                  <input type="checkbox" checked={ssl} onChange={e => setSsl(e.target.checked)} />
                  {type === 'mongodb' ? 'Enable TLS/SSL' : 'Enable SSL (Required for Supabase/Neon live connections)'}
                </label>
              </div>
            </>
          )}

          {/* Test connection results */}
          {testResult && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '11.5px',
              fontWeight: 500,
              lineHeight: 1.45,
              border: `1px solid ${testResult.ok ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.28)'}`,
              background: testResult.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: testResult.ok ? '#4ade80' : '#fca5a5'
            }}>
              {testResult.message}
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={handleTestConnection} disabled={testing} style={{ background: 'transparent', border: '1px solid #52525b', color: '#d4d4d8', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button type="submit" style={{ background: '#2563eb', border: 'none', color: '#ffffff', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Save Connection
            </button>
          </div>
        </form>
      )}

      {/* CONNECTION DROPDOWN SELECTION */}
      {dbConnections.length > 0 && !showAddForm && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #222225', background: '#121214', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, zIndex: 10 }}>
            <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>Active Connection:</span>
            <div ref={connRef} style={{ position: 'relative', minWidth: '220px' }}>
              <button
                type="button"
                onClick={() => setConnOpen(!connOpen)}
                className={`panel-select-trigger ${connOpen ? 'open' : ''}`}
                style={{ width: '100%', padding: '5px 8px', fontSize: '12px' }}
              >
                <span className="panel-select-trigger-label">
                  <span className="panel-select-trigger-text" style={{ fontSize: '12px', textTransform: 'none', color: '#f4f4f5' }}>
                    {activeConnection ? `${activeConnection.name} (${activeConnection.type.toUpperCase()}) - ${activeConnection.environment.toUpperCase()}` : 'Select Connection'}
                  </span>
                </span>
                <ChevronDownIcon size={12} />
              </button>
              {connOpen && (
                <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100, background: '#1a1a1c', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
                  {dbConnections.map(conn => (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => {
                        setActiveConnId(conn.id);
                        setConnOpen(false);
                      }}
                      className={`panel-select-option ${activeConnId === conn.id ? 'active' : ''}`}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    >
                      <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'none' }}>
                        {conn.name} ({conn.type.toUpperCase()}) - {conn.environment.toUpperCase()}
                      </span>
                      {activeConnId === conn.id && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this connection?')) {
                deleteDbConnection(activeConnId || dbConnections[0].id);
              }
            }}
            style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
          >
            Remove
          </button>
        </div>
      )}

      {/* MAIN CONTAINER: LEFT (SCHEMA EXPLORER) | RIGHT (QUERY PANEL) */}
      {dbConnections.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px 16px',
          margin: '16px',
          textAlign: 'center',
          gap: '10px',
          background: '#141416',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          </svg>
          <div style={{ fontSize: '13px', color: '#f4f4f5', fontWeight: 600 }}>No Databases Integrated</div>
          <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa', lineHeight: 1.5, maxWidth: 300 }}>
            Integrate local <strong style={{ color: '#e4e4e7', fontWeight: 600 }}>SQLite</strong> files or{' '}
            <strong style={{ color: '#e4e4e7', fontWeight: 600 }}>PostgreSQL/MySQL</strong> connections into this workspace to let agents explore tables and generate SQL structures automatically.
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* SCHEMA EXPLORER SIDEBAR */}
          <div style={{ width: '220px', borderRight: '1px solid #222225', background: '#121214', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1c1c1f' }}>
              {activeConnection?.type === 'mongodb' ? 'Collections Explorer' : 'Schema Tree Explorer'}
            </div>
            
            {schemaLoading && (!schema || schema.tables.length === 0) ? (
              <div style={{ padding: '16px', fontSize: '12px', color: '#a1a1aa', textAlign: 'center' }}>Introspecting database...</div>
            ) : !schema || schema.tables.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '12px', color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center' }}>
                No {activeConnection?.type === 'mongodb' ? 'collections' : 'tables'} found.
              </div>
            ) : (
              <div style={{ padding: '6px' }}>
                <style>{`
                  @keyframes db-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
                {schemaLoading && (
                  <div style={{ 
                    padding: '4px 8px', 
                    fontSize: '9px', 
                    color: '#a78bfa', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginBottom: '6px', 
                    background: 'rgba(139, 92, 246, 0.05)', 
                    borderRadius: '4px', 
                    border: '1px solid rgba(139, 92, 246, 0.1)' 
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'db-spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.1)" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Refreshing collections...</span>
                  </div>
                )}
                {activeConnection?.type === 'mongodb' && (
                  <div style={{ padding: '4px 6px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search collections..."
                      value={mongoCollectionSearchInput}
                      onChange={e => setMongoCollectionSearchInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#0d0d0f',
                        border: '1px solid #222225',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        color: '#cbd5e1',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
                {filteredCollections.map(table => (
                  <TableRow
                    key={table.name}
                    tableName={table.name}
                    isTableOpen={selectedTable === table.name}
                    onSelect={quickSelectTable}
                    columns={table.columns || []}
                    mongoPreviewLoading={mongoPreviewLoading}
                    isMongo={activeConnection?.type === 'mongodb'}
                    onColumnClick={handleColumnClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* QUERY CONSOLE & RESULT VIEW */}
          {activeConnection?.type === 'mongodb' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0c', overflow: 'hidden' }}>
              {/* Header with Connection Details & Mode */}
              <div style={{ padding: '12px', borderBottom: '1px solid #222225', background: '#101012', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {mongoCollection ? `Collection: ${mongoCollection}` : 'MongoDB Workspace'}
                  </span>
                  {mongoCollection && mongoDocCount !== null && (
                    <span style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '3px' }}>
                      {typeof mongoDocCount === 'number' ? `${mongoDocCount.toLocaleString()} docs` : mongoDocCount}
                    </span>
                  )}
                </div>
                {activeConnection && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeConnection.environment === 'production' && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Production DB
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: activeConnection.permissionMode === 'read-only' ? '#ef4444' : '#22c55e', fontWeight: 500 }}>
                      Mode: {activeConnection.permissionMode.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {!mongoCollection ? (
                // Empty State
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '11px', gap: '8px', padding: '40px', textAlign: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6', opacity: 0.5, marginBottom: '4px' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  <span>Select a collection to preview documents.</span>
                </div>
              ) : (
                <>
                  {/* Tab Navigation */}
                  <div style={{ display: 'flex', background: '#0e0e11', borderBottom: '1px solid #222225', padding: '0 8px' }}>
                    {(['documents', 'schema', 'indexes', 'query'] as const).map((tab) => {
                      const isActive = mongoActiveTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setMongoActiveTab(tab)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                            color: isActive ? '#3b82f6' : '#94a3b8',
                            padding: '8px 14px',
                            fontSize: '11px',
                            fontWeight: isActive ? 600 : 500,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Content Area */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px' }}>
                    
                    {queryError && (
                      <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#f87171', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                        ⚠️ MongoDB Error: {queryError}
                      </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {mongoActiveTab === 'documents' && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Controls Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', background: '#101012', padding: '6px 10px', borderRadius: '4px', border: '1px solid #222225' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 500 }}>
                              Showing {mongoDocs ? mongoDocs.length : 0} of {mongoDocCount !== null ? (typeof mongoDocCount === 'number' ? `~${mongoDocCount.toLocaleString()}` : mongoDocCount) : '...'} docs
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>Page Size:</span>
                              <select
                                value={mongoPageSize}
                                onChange={(e) => {
                                  const newSize = Number(e.target.value);
                                  setMongoPageSize(newSize);
                                  void loadMongoCollectionPreview(mongoCollection, false, newSize);
                                }}
                                style={{
                                  background: '#0d0d0f',
                                  border: '1px solid #222225',
                                  borderRadius: '3px',
                                  padding: '2px 4px',
                                  fontSize: '10px',
                                  color: '#cbd5e1',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                              </select>
                            </div>
                            <button
                              onClick={() => void loadMongoCollectionPreview(mongoCollection, false, undefined, false)}
                              disabled={mongoPreviewLoading}
                              style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid #222225',
                                color: '#cbd5e1',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ⟳ Refresh Docs
                            </button>
                            <button
                              onClick={() => void loadMongoCollectionPreview(mongoCollection, false, undefined, true)}
                              disabled={mongoPreviewLoading}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ⟳ Refresh Schema
                            </button>
                          </div>
                          
                          {/* JSON / Table Toggle */}
                          <div style={{ display: 'flex', background: '#0d0d0f', borderRadius: '4px', padding: '2px', border: '1px solid #222225' }}>
                            <button
                              onClick={() => setMongoViewMode('table')}
                              style={{
                                background: mongoViewMode === 'table' ? '#2563eb' : 'transparent',
                                border: 'none',
                                color: '#ffffff',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Table
                            </button>
                            <button
                              onClick={() => setMongoViewMode('json')}
                              style={{
                                background: mongoViewMode === 'json' ? '#2563eb' : 'transparent',
                                border: 'none',
                                color: '#ffffff',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        {/* Documents Preview Content */}
                        {mongoPreviewLoading ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '11px' }}>
                            Loading documents...
                          </div>
                        ) : !mongoDocs || mongoDocs.length === 0 ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '11px', fontStyle: 'italic' }}>
                            No documents found in this collection.
                          </div>
                        ) : mongoViewMode === 'json' ? (
                          // JSON View
                          <div style={{ flex: 1, overflow: 'auto', background: '#0e0e11', border: '1px solid #222225', borderRadius: '6px', padding: '12px', fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '10px', color: '#cbd5e1', whiteSpace: 'pre' }}>
                            {mongoDocs.map((doc, idx) => (
                              <div key={idx} style={{ marginBottom: '16px', borderBottom: '1px solid #222225', paddingBottom: '12px' }}>
                                <div style={{ color: '#64748b', fontSize: '9px', marginBottom: '4px', fontWeight: 600 }}>Document #{idx + 1}</div>
                                {JSON.stringify(doc, null, 2)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Table View
                          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #222225', borderRadius: '4px', background: '#0e0e11' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#141417', borderBottom: '1px solid #222225' }}>
                                  {mongoCols.map(col => (
                                    <th key={col} style={{ padding: '8px', color: '#cbd5e1', fontWeight: 600, borderRight: '1px solid #222225' }}>
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {mongoDocs.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #18181b', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)' }}>
                                    {mongoCols.map(col => (
                                      <td key={col} style={{ padding: '6px 8px', color: '#94a3b8', borderRight: '1px solid #1c1c1f', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                        {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span style={{ color: '#52525b', fontStyle: 'italic' }}>-</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Load More Button */}
                        {mongoDocs && mongoDocs.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', gap: '10px', alignItems: 'center' }}>
                            <button
                              onClick={() => void loadMongoCollectionPreview(mongoCollection, true)}
                              disabled={!mongoHasMore || mongoDocsLoadingMore}
                              style={{
                                background: mongoHasMore ? '#2563eb' : 'rgba(255, 255, 255, 0.02)',
                                border: mongoHasMore ? 'none' : '1px solid #222225',
                                color: mongoHasMore ? '#ffffff' : '#64748b',
                                padding: '6px 16px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: mongoHasMore && !mongoDocsLoadingMore ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {mongoDocsLoadingMore ? (
                                'Loading more...'
                              ) : mongoHasMore ? (
                                'Load More'
                              ) : (
                                'No more documents'
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SCHEMA TAB */}
                    {mongoActiveTab === 'schema' && (
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, marginBottom: '2px' }}>
                          Inferred Collection Schema
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', fontStyle: 'italic' }}>
                          * Inferred from the latest 20 sample documents. This is a schema overview and may not represent the complete schema of all documents in the collection.
                        </div>
                        <div style={{ border: '1px solid #222225', borderRadius: '6px', overflow: 'hidden', background: '#0e0e11' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: '#141417', borderBottom: '1px solid #222225', color: '#cbd5e1' }}>
                                <th style={{ padding: '8px' }}>Field Name</th>
                                <th style={{ padding: '8px' }}>Detected Type</th>
                                <th style={{ padding: '8px' }}>Key Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(schema?.tables.find(t => t.name === mongoCollection)?.columns || []).map((col) => (
                                <tr key={col.name} style={{ borderBottom: '1px solid #1c1c1f' }}>
                                  <td style={{ padding: '8px', color: col.primaryKey ? '#f59e0b' : '#cbd5e1', fontWeight: col.primaryKey ? 600 : 400, fontFamily: 'monospace' }}>
                                    {col.name}
                                  </td>
                                  <td style={{ padding: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                    {col.type.toLowerCase()}
                                  </td>
                                  <td style={{ padding: '8px', color: col.primaryKey ? '#f59e0b' : '#64748b' }}>
                                    {col.primaryKey ? 'Primary Key (_id)' : 'Standard Property'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* INDEXES TAB */}
                    {mongoActiveTab === 'indexes' && (
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, marginBottom: '8px' }}>
                          Collection Indexes
                        </div>
                        {mongoPreviewLoading ? (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Loading indexes...</div>
                        ) : mongoIndexesError ? (
                          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '4px', color: '#f87171', fontSize: '11px' }}>
                            ⚠️ {mongoIndexesError}
                          </div>
                        ) : !mongoIndexes || mongoIndexes.length === 0 ? (
                          <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No indexes detected.</div>
                        ) : (
                          <div style={{ border: '1px solid #222225', borderRadius: '6px', overflow: 'hidden', background: '#0e0e11' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#141417', borderBottom: '1px solid #222225', color: '#cbd5e1' }}>
                                  <th style={{ padding: '8px' }}>Index Name</th>
                                  <th style={{ padding: '8px' }}>Key Definition</th>
                                  <th style={{ padding: '8px' }}>Unique</th>
                                  <th style={{ padding: '8px' }}>Sparse</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mongoIndexes.map((idx, indexIdx) => (
                                  <tr key={indexIdx} style={{ borderBottom: '1px solid #1c1c1f' }}>
                                    <td style={{ padding: '8px', color: '#cbd5e1', fontWeight: 500 }}>
                                      {idx.name}
                                    </td>
                                    <td style={{ padding: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                      {idx.key}
                                    </td>
                                    <td style={{ padding: '8px', color: idx.unique ? '#22c55e' : '#64748b' }}>
                                      {idx.unique ? 'Yes' : 'No'}
                                    </td>
                                    <td style={{ padding: '8px', color: idx.sparse ? '#22c55e' : '#64748b' }}>
                                      {idx.sparse ? 'Yes' : 'No'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QUERY TAB */}
                    {mongoActiveTab === 'query' && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '12px', background: '#101012', border: '1px solid #222225', borderRadius: '6px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                              Mongo Query
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Collection</label>
                                <select
                                  value={mongoCollection}
                                  onChange={e => setMongoCollection(e.target.value)}
                                  style={{
                                    width: '100%',
                                    background: '#0d0d0f',
                                    border: '1px solid #222225',
                                    borderRadius: '4px',
                                    padding: '6px',
                                    fontSize: '11px',
                                    color: '#e2e8f0',
                                    outline: 'none'
                                  }}
                                >
                                  <option value="">-- Select Collection --</option>
                                  {schema?.tables.map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Limit</label>
                                <input
                                  type="number"
                                  value={mongoLimit}
                                  onChange={e => setMongoLimit(Number(e.target.value))}
                                  style={{
                                    width: '100%',
                                    background: '#0d0d0f',
                                    border: '1px solid #222225',
                                    borderRadius: '4px',
                                    padding: '6px',
                                    fontSize: '11px',
                                    color: '#e2e8f0',
                                    outline: 'none'
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontWeight: 600 }}>Filter JSON</label>
                              <textarea
                                ref={sqlEditorRef}
                                value={mongoFilter}
                                onChange={e => {
                                    setMongoFilter(e.target.value);
                                    setLastCursorPos(e.target.selectionStart);
                                }}
                                onBlur={e => setLastCursorPos(e.currentTarget.selectionStart)}
                                onKeyUp={e => setLastCursorPos(e.currentTarget.selectionStart)}
                                onMouseUp={e => setLastCursorPos(e.currentTarget.selectionStart)}
                                placeholder='{ "status": "active" }'
                                style={{
                                  width: '100%',
                                  height: '90px',
                                  background: '#0d0d0f',
                                  border: '1px solid #222225',
                                  borderRadius: '6px',
                                  padding: '8px',
                                  fontFamily: '"JetBrains Mono", Consolas, monospace',
                                  fontSize: '11px',
                                  color: '#e2e8f0',
                                  resize: 'none',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button
                              onClick={handleRunQuery}
                              disabled={queryLoading || !mongoCollection || !mongoFilter.trim()}
                              style={{
                                background: '#2563eb',
                                border: 'none',
                                color: '#ffffff',
                                padding: '6px 14px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              {queryLoading ? (
                                'Executing...'
                              ) : (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21" />
                                  </svg>
                                  Run Find
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Query results section */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                          {queryLoading ? (
                            <div style={{ color: '#64748b', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
                              Executing query...
                            </div>
                          ) : queryResult ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                                Results: {queryResult.rows.length} rows returned
                              </div>
                              {queryResult.rows.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '11px', padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>
                                  Query executed successfully. Empty result set returned.
                                </div>
                              ) : (
                                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #222225', borderRadius: '4px', background: '#0e0e11' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                                    <thead>
                                      <tr style={{ background: '#141417', borderBottom: '1px solid #222225' }}>
                                        {queryResult.columns.map(col => (
                                          <th key={col} style={{ padding: '6px 8px', color: '#cbd5e1', fontWeight: 600, borderRight: '1px solid #222225' }}>
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {queryResult.rows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #18181b', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)' }}>
                                          {queryResult.columns.map(col => (
                                            <td key={col} style={{ padding: '6px 8px', color: '#94a3b8', borderRight: '1px solid #1c1c1f', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                              {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span style={{ color: '#52525b', fontStyle: 'italic' }}>-</span>}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: '#52525b', fontSize: '11px', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>
                              Configure filter and click Run Find to query data.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0c', overflow: 'hidden' }}>
              
              {/* SQL EDITOR */}
              <div style={{ padding: sqlEditorCollapsed ? '8px 12px' : '12px', borderBottom: '1px solid #222225', background: '#101012' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sqlEditorCollapsed ? '0px' : '8px' }}>
                  <div 
                    onClick={() => setSqlEditorCollapsed(!sqlEditorCollapsed)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ 
                      display: 'inline-flex', 
                      transform: sqlEditorCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.2s ease',
                      alignItems: 'center',
                      color: '#64748b'
                    }}>
                      <ChevronDownIcon size={12} />
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SQL Editor
                    </span>
                  </div>
                  {activeConnection && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeConnection.environment === 'production' && (
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Production DB
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: activeConnection.permissionMode === 'read-only' ? '#ef4444' : '#22c55e', fontWeight: 500 }}>
                        Mode: {activeConnection.permissionMode.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                
                {!sqlEditorCollapsed && (
                  <>
                    <textarea
                      ref={sqlEditorRef}
                      value={sql}
                      onChange={e => {
                        setSql(e.target.value);
                        setLastCursorPos(e.target.selectionStart);
                      }}
                      onBlur={e => setLastCursorPos(e.currentTarget.selectionStart)}
                      onKeyUp={e => setLastCursorPos(e.currentTarget.selectionStart)}
                      onMouseUp={e => setLastCursorPos(e.currentTarget.selectionStart)}
                      placeholder="SELECT * FROM users LIMIT 10;"
                      style={{
                        width: '100%',
                        height: '90px',
                        background: '#0d0d0f',
                        border: '1px solid #222225',
                        borderRadius: '6px',
                        padding: '8px',
                        fontFamily: '"JetBrains Mono", Consolas, monospace',
                        fontSize: '11px',
                        color: '#e2e8f0',
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        onClick={handleRunQuery}
                        disabled={queryLoading || !sql.trim()}
                        style={{
                          background: '#2563eb',
                          border: 'none',
                          color: '#ffffff',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {queryLoading ? (
                          'Executing...'
                        ) : (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5 3 19 12 5 21" />
                            </svg>
                            Run SQL
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* RESULTS CONTAINER */}
              <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                
                {/* Safety notice/limit warnings */}
                {safetyNotice && (
                  <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '4px', color: '#60a5fa', fontSize: '10px', marginBottom: '10px' }}>
                    💡 {safetyNotice}
                  </div>
                )}

                {/* Error messages */}
                {queryError && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#f87171', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    ⚠️ SQL Error: {queryError}
                  </div>
                )}

                {/* Success Result Grid */}
                {queryResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {sql === lastGeneratedSql && selectedTable ? (
                        <span style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)', padding: '2px 6px', borderRadius: '3px' }}>
                          Previewing {selectedTable}
                        </span>
                      ) : (
                        <span>Results</span>
                      )}
                      <span style={{ color: '#64748b' }}>({queryResult.rows.length} rows returned)</span>
                    </div>

                    {/* Preview controls bar: Page Size and Load More */}
                    {selectedTable && sql === lastGeneratedSql && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#121214', border: '1px solid #222225', borderRadius: '4px', padding: '6px 12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Page Size:</span>
                          <div style={{ display: 'flex', background: '#0d0d0f', borderRadius: '4px', padding: '2px', border: '1px solid #222225' }}>
                            {[20, 50, 100].map(sz => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setSqlPageSize(sz);
                                  setSqlOffset(0);
                                  const queryText = buildSqlPreviewQuery(selectedTable, sqlPreviewColumns, sz, 0);
                                  setSql(queryText);
                                  setLastGeneratedSql(queryText);
                                  void executeSqlQuery(queryText, false);
                                }}
                                style={{
                                  background: sqlPageSize === sz ? '#3b82f6' : 'transparent',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            Showing {queryResult.rows.length} rows loaded
                          </span>
                          <button
                            type="button"
                            onClick={handleSqlLoadMore}
                            disabled={!sqlHasMore || sqlLoadingMore}
                            style={{
                              background: sqlHasMore ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${sqlHasMore ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                              color: sqlHasMore ? '#60a5fa' : '#64748b',
                              padding: '3px 10px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              cursor: sqlHasMore ? 'pointer' : 'default',
                              fontWeight: 600
                            }}
                          >
                            {sqlLoadingMore ? 'Loading more...' : sqlHasMore ? 'Load More' : 'No more rows'}
                          </button>
                        </div>
                      </div>
                    )}

                    {queryResult.rows.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: '11px', padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>
                        Query executed successfully. Empty result set returned.
                      </div>
                    ) : (
                      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #222225', borderRadius: '4px', background: '#0e0e11' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#141417', borderBottom: '1px solid #222225' }}>
                              {queryResult.columns.map(col => {
                                const isSorted = sortConfig?.key === col;
                                const isMenuOpen = activeHeaderMenu === col;
                                return (
                                  <th
                                    key={col}
                                    className="column-header-container"
                                    style={{
                                      padding: '6px 8px',
                                      color: '#cbd5e1',
                                      fontWeight: 600,
                                      borderRight: '1px solid #222225',
                                      position: 'relative',
                                      userSelect: 'none'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {col} {isSorted && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
                                      </span>
                                      
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveHeaderMenu(isMenuOpen ? null : col);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: isMenuOpen ? '#3b82f6' : '#71717a',
                                          cursor: 'pointer',
                                          padding: '2px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          borderRadius: '3px',
                                          transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                                        onMouseLeave={(e) => !isMenuOpen && (e.currentTarget.style.color = '#71717a')}
                                      >
                                        <ChevronDownIcon size={10} />
                                      </button>
                                    </div>

                                    {isMenuOpen && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: '100%',
                                          left: 4,
                                          marginTop: '4px',
                                          background: '#16161a',
                                          border: '1px solid #2e2e34',
                                          borderRadius: '4px',
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                          zIndex: 1000,
                                          padding: '2px',
                                          minWidth: '110px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '1px'
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSortConfig({ key: col, direction: 'asc' });
                                            setActiveHeaderMenu(null);
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#cbd5e1',
                                            padding: '5px 8px',
                                            fontSize: '10px',
                                            textAlign: 'left',
                                            width: '100%',
                                            cursor: 'pointer',
                                            borderRadius: '3px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                          ↑ Sort Ascending
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSortConfig({ key: col, direction: 'desc' });
                                            setActiveHeaderMenu(null);
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#cbd5e1',
                                            padding: '5px 8px',
                                            fontSize: '10px',
                                            textAlign: 'left',
                                            width: '100%',
                                            cursor: 'pointer',
                                            borderRadius: '3px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                          ↓ Sort Descending
                                        </button>
                                        {isSorted && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSortConfig(null);
                                              setActiveHeaderMenu(null);
                                            }}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: '#f87171',
                                              padding: '5px 8px',
                                              fontSize: '10px',
                                              textAlign: 'left',
                                              width: '100%',
                                              cursor: 'pointer',
                                              borderRadius: '3px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                          >
                                            ✕ Clear Sort
                                          </button>
                                        )}
                                        <div style={{ height: '1px', background: '#222225', margin: '2px 0' }} />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(col);
                                            setActiveHeaderMenu(null);
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#94a3b8',
                                            padding: '5px 8px',
                                            fontSize: '10px',
                                            textAlign: 'left',
                                            width: '100%',
                                            cursor: 'pointer',
                                            borderRadius: '3px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                          ⎗ Copy Name
                                        </button>
                                      </div>
                                    )}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedRows().map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #18181b', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)' }}>
                                {queryResult.columns.map(col => (
                                  <td key={col} style={{ padding: '6px 8px', color: '#94a3b8', borderRight: '1px solid #1c1c1f', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                    {row[col] !== null ? String(row[col]) : <span style={{ color: '#52525b', fontStyle: 'italic' }}>NULL</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Welcome/Empty state result */}
                {!queryResult && !queryError && (
                  <div style={{ color: '#52525b', fontSize: '11px', textAlign: 'center', padding: '40px', fontStyle: 'italic' }}>
                    Write a query and press Run SQL or select a table from Schema Tree.
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TableRowProps {
  tableName: string;
  isTableOpen: boolean;
  onSelect: (name: string) => void;
  columns: any[];
  mongoPreviewLoading: boolean;
  isMongo: boolean;
  onColumnClick: (colName: string) => void;
}

const TableRow = React.memo(({
  tableName,
  isTableOpen,
  onSelect,
  columns,
  mongoPreviewLoading,
  isMongo,
  onColumnClick
}: TableRowProps) => {
  return (
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={() => onSelect(tableName)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          textAlign: 'left',
          padding: '6px 8px',
          background: isTableOpen ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: isTableOpen ? '#60a5fa' : '#cbd5e1',
          fontSize: '11px',
          cursor: 'pointer',
          fontWeight: isTableOpen ? 600 : 400
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tableName}</span>
      </button>

      {isTableOpen && (
        <div style={{ paddingLeft: '22px', borderLeft: '1px solid #2e2e34', marginLeft: '12px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {isMongo && columns.length === 0 && mongoPreviewLoading ? (
            <div style={{ fontSize: '9px', padding: '3px 6px', color: '#64748b', fontStyle: 'italic' }}>
              Loading fields...
            </div>
          ) : isMongo && columns.length === 0 ? (
            <div style={{ fontSize: '9px', padding: '3px 6px', color: '#64748b', fontStyle: 'italic' }}>
              No fields inferred.
            </div>
          ) : (
            columns.map(col => (
              <div
                key={col.name}
                onClick={() => onColumnClick(col.name)}
                title={isMongo ? 'Click to insert field' : 'Click to insert into SQL Editor'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '9px',
                  padding: '3px 6px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  color: col.primaryKey ? '#f59e0b' : col.foreignKey ? '#38bdf8' : '#94a3b8',
                  fontWeight: col.primaryKey || col.foreignKey ? 600 : 400,
                  textDecoration: col.primaryKey ? 'underline' : 'none'
                }}>
                  {col.name}
                </span>
                <span style={{ color: '#52525b', fontSize: '8px' }}>{col.type?.toLowerCase() || ''}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.tableName === nextProps.tableName &&
    prevProps.isTableOpen === nextProps.isTableOpen &&
    prevProps.mongoPreviewLoading === nextProps.mongoPreviewLoading &&
    prevProps.isMongo === nextProps.isMongo &&
    prevProps.columns === nextProps.columns
  );
});
