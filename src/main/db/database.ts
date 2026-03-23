import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Veritabanı henüz başlatılmadı')
  }
  return db
}

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'lirik-sanat-evi.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  console.log(`Veritabanı açıldı: ${dbPath}`)
}
