import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../../db/database'
import { encryptCredential, decryptCredential, SENSITIVE_KEYS } from '../../services/credentialService'

export function registerSettingsHandlers(): void {
  const db = () => getDatabase()

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getAll', () => {
    const rows = db().prepare('SELECT key, value, description FROM settings').all() as any[]
    return rows.reduce((acc: Record<string, unknown>, row) => {
      let parsed: unknown
      try { parsed = JSON.parse(row.value) } catch { parsed = row.value }
      // Hassas anahtarları şifresi çözülmüş olarak döndür
      if (SENSITIVE_KEYS.has(row.key) && typeof parsed === 'string') {
        acc[row.key] = decryptCredential(parsed)
      } else {
        acc[row.key] = parsed
      }
      return acc
    }, {})
  })

  ipcMain.handle('settings:set', (_e, key: string, value: unknown) => {
    const plain = typeof value === 'string' ? value : JSON.stringify(value)
    const stored = SENSITIVE_KEYS.has(key)
      ? encryptCredential(plain)
      : plain
    const jsonValue = SENSITIVE_KEYS.has(key) ? JSON.stringify(stored) : JSON.stringify(value)
    db().prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(key, jsonValue)
    return { success: true }
  })

  ipcMain.handle('settings:setBulk', (_e, entries: Record<string, unknown>) => {
    const upsert = db().prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `)
    const bulk = db().transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        const plain = typeof value === 'string' ? value : JSON.stringify(value)
        const stored = SENSITIVE_KEYS.has(key)
          ? encryptCredential(plain)
          : plain
        upsert.run(key, SENSITIVE_KEYS.has(key) ? JSON.stringify(stored) : JSON.stringify(value))
      }
    })
    bulk()
    return { success: true }
  })

  // ─── AUDIT LOG ────────────────────────────────────────────────────────────
  ipcMain.handle('audit_log:getRecent', () => {
    return db().prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all()
  })

  // ─── LOGO UPLOAD ──────────────────────────────────────────────────────────

  ipcMain.handle('settings:uploadLogo', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Logo Seç',
      filters: [{ name: 'Görseller', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const src = result.filePaths[0]
    const destDir = path.join(app.getPath('userData'), 'academy')
    fs.mkdirSync(destDir, { recursive: true })
    const destFile = path.join(destDir, `logo${path.extname(src)}`)
    fs.copyFileSync(src, destFile)
    db().prepare(`INSERT INTO settings (key, value, description) VALUES ('academy_logo_path', @v, 'Akademi logo dosya yolu') ON CONFLICT(key) DO UPDATE SET value=@v`).run({ v: JSON.stringify(destFile) })
    return destFile
  })
}
