import * as SQLite from 'expo-sqlite';

export type HistoryType = 'read' | 'explain' | 'summarize';
export type HistoryLanguage = 'en' | 'fil';

export interface HistoryRow {
  id: number;
  type: HistoryType;
  source_text: string;
  result_text: string;
  language: HistoryLanguage;
  source_app: string | null;
  created_at: number;
}

export interface AddHistoryInput {
  type: HistoryType;
  sourceText: string;
  resultText: string;
  language: HistoryLanguage;
  sourceApp?: string | null;
  createdAt?: number;
}

export type SaveResultInput = Omit<AddHistoryInput, 'createdAt'>;

export interface GetHistoryOptions {
  limit?: number;
  offset?: number;
}

const DATABASE_NAME = 'gabai.db';
const CURRENT_SCHEMA_VERSION = 2;
const MAX_HISTORY_ROWS = 200;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;

function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return databasePromise;
}

export async function initDb(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = await getDatabase();
      const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const currentVersion = versionRow?.user_version ?? 0;

      if (currentVersion < CURRENT_SCHEMA_VERSION) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('read','explain','summarize')),
            source_text TEXT NOT NULL,
            result_text TEXT NOT NULL,
            language TEXT NOT NULL CHECK(language IN ('en','fil')),
            source_app TEXT,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS history_created_at_idx
            ON history (created_at);
        `);
        await db.runAsync('PRAGMA user_version = 1');
      }

      if (currentVersion < 2) {
        const sampleSourceTexts = [
          'Mensahe sa bangko: May bagong update sa iyong account.',
          'Barangay announcement: Libreng checkup sa covered court sa Sabado, alas-otso ng umaga.',
          'Messenger message: Your parcel is waiting. Please contact the delivery team.',
          'Medicine instructions: Take with food and drink plenty of water.',
          'Congratulations! You won a prize. Click this link to claim it now.',
        ];

        for (const sourceText of sampleSourceTexts) {
          await db.runAsync('DELETE FROM history WHERE source_text = ?', sourceText);
        }

        await db.runAsync('PRAGMA user_version = 2');
      }
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

async function readyDatabase(): Promise<SQLite.SQLiteDatabase> {
  await initDb();
  return getDatabase();
}

export async function addHistory(input: AddHistoryInput): Promise<number> {
  const db = await readyDatabase();
  const result = await db.runAsync(
    `INSERT INTO history
      (type, source_text, result_text, language, source_app, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.type,
    input.sourceText,
    input.resultText,
    input.language,
    input.sourceApp ?? null,
    input.createdAt ?? Date.now(),
  );

  await db.runAsync(
    `DELETE FROM history
     WHERE id NOT IN (
       SELECT id FROM history
       ORDER BY created_at DESC, id DESC
       LIMIT ?
     )`,
    MAX_HISTORY_ROWS,
  );

  return result.lastInsertRowId;
}

function containsSensitiveText(text: string): boolean {
  return /\b\d{4,8}\b/.test(text) || /\b(?:password|passwd|passcode|otp|pin)\b/i.test(text);
}

export async function saveResult(input: SaveResultInput): Promise<number | null> {
  const sourceText = input.sourceText.trim();
  const resultText = input.resultText.trim();

  if (!sourceText || !resultText || containsSensitiveText(sourceText) || containsSensitiveText(resultText)) {
    return null;
  }

  return addHistory({
    ...input,
    sourceText,
    resultText,
  });
}

export async function getHistory(options: GetHistoryOptions = {}): Promise<HistoryRow[]> {
  const db = await readyDatabase();
  const limit = Math.max(0, Math.floor(options.limit ?? MAX_HISTORY_ROWS));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  return db.getAllAsync<HistoryRow>(
    `SELECT id, type, source_text, result_text, language, source_app, created_at
     FROM history
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
}

export async function searchHistory(query: string): Promise<HistoryRow[]> {
  const db = await readyDatabase();
  const pattern = `%${query}%`;

  return db.getAllAsync<HistoryRow>(
    `SELECT id, type, source_text, result_text, language, source_app, created_at
     FROM history
     WHERE source_text LIKE ? OR result_text LIKE ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    pattern,
    pattern,
    MAX_HISTORY_ROWS,
  );
}

export async function getHistoryById(id: number): Promise<HistoryRow | null> {
  const db = await readyDatabase();

  return db.getFirstAsync<HistoryRow>(
    `SELECT id, type, source_text, result_text, language, source_app, created_at
     FROM history
     WHERE id = ?`,
    id,
  );
}

export async function deleteHistory(id: number): Promise<void> {
  const db = await readyDatabase();
  await db.runAsync('DELETE FROM history WHERE id = ?', id);
}

export async function clearHistory(): Promise<void> {
  const db = await readyDatabase();
  await db.runAsync('DELETE FROM history');
}
