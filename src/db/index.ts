/**
 * Datenbankzugriff.
 *
 * In der Desktop-App (Tauri) liegt die Datenbank als Datei 8moss.db im
 * App-Datenordner. Im Browser (npm run dev, nur zum Entwickeln) läuft
 * dieselbe Datenbank mit demselben Schema im Arbeitsspeicher (sql.js).
 *
 * Später, für die Cloud-Version, wird nur diese Datei gegen einen
 * Server-Zugriff getauscht. Der Rest des Programms bleibt gleich.
 *
 * Platzhalter in SQL: $1, $2, ...
 */
import { migrations } from "./migrations";

export interface Db {
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertId?: number; rowsAffected: number }>;
}

const istTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function oeffneTauri(): Promise<Db> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:8moss.db");
  await db.execute("PRAGMA foreign_keys = ON");
  return {
    select: (sql, params = []) => db.select(sql, params),
    execute: async (sql, params = []) => {
      const r = await db.execute(sql, params);
      return { lastInsertId: r.lastInsertId, rowsAffected: r.rowsAffected };
    },
  };
}

async function oeffneBrowser(): Promise<Db> {
  const { default: initSqlJs } = await import("sql.js");
  const { default: wasmUrl } = await import("sql.js/dist/sql-wasm.wasm?url");
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  const binde = (params: unknown[]) =>
    Object.fromEntries(params.map((v, i) => [`$${i + 1}`, v === undefined ? null : v])) as Record<string, never>;
  return {
    select: async <T,>(sql: string, params: unknown[] = []) => {
      const stmt = db.prepare(sql);
      stmt.bind(binde(params));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      stmt.free();
      return rows;
    },
    execute: async (sql, params = []) => {
      if (params.length) db.run(sql, binde(params));
      else db.exec(sql);
      const id = db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] as number | undefined;
      return { lastInsertId: id, rowsAffected: db.getRowsModified() };
    },
  };
}

async function migriere(db: Db) {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, ausgefuehrt_am TEXT DEFAULT (datetime('now')))",
  );
  const [{ v }] = await db.select<{ v: number | null }>("SELECT MAX(version) AS v FROM schema_version");
  for (const m of migrations) {
    if (m.version <= (v ?? 0)) continue;
    await db.execute(m.sql);
    await db.execute("INSERT INTO schema_version (version, name) VALUES ($1, $2)", [m.version, m.name]);
  }
}

let offen: Promise<Db> | null = null;

/** Liefert die geöffnete und aktuelle Datenbank. */
export function getDb(): Promise<Db> {
  offen ??= (async () => {
    const db = istTauri() ? await oeffneTauri() : await oeffneBrowser();
    await migriere(db);
    return db;
  })();
  return offen;
}
