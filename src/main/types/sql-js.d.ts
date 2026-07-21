declare module 'sql.js' {
  export type QueryExecResult = {
    columns: string[];
    values: unknown[][];
  };

  export class Database {
    constructor(data?: Uint8Array);
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export type SqlJsStatic = {
    Database: typeof Database;
  };

  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
