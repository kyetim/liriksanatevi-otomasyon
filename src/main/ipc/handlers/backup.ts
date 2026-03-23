import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../../db/database'
import { runAutoBackup } from '../../services/scheduler'

export function registerBackupHandlers(): void {
  const db = () => getDatabase()

  // ─── BACKUP ───────────────────────────────────────────────────────────────

  ipcMain.handle('backup:create', () => {
    const dbPath = (db() as unknown as { name: string }).name
    const backupDir = path.join(app.getPath('userData'), 'backups', 'manual')
    fs.mkdirSync(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const destFile = path.join(backupDir, `backup_manual_${timestamp}.sqlite`)
    fs.copyFileSync(dbPath, destFile)
    return { success: true, path: destFile, filename: path.basename(destFile) }
  })

  ipcMain.handle('backup:saveAs', async () => {
    const dbPath = (db() as unknown as { name: string }).name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const result = await dialog.showSaveDialog({
      title: 'Yedeği Kaydet',
      defaultPath: `lirik_backup_${timestamp}.sqlite`,
      filters: [{ name: 'SQLite Veritabanı', extensions: ['sqlite'] }]
    })
    if (result.canceled || !result.filePath) return { success: false }
    fs.copyFileSync(dbPath, result.filePath)
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('backup:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Yedek Dosyası Seç',
      filters: [{ name: 'SQLite Veritabanı', extensions: ['sqlite'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { success: false }
    const srcFile = result.filePaths[0]
    const dbPath = (db() as unknown as { name: string }).name
    // Mevcut DB'yi önce yedekle
    const safeDir = path.join(app.getPath('userData'), 'backups', 'pre_restore')
    fs.mkdirSync(safeDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    fs.copyFileSync(dbPath, path.join(safeDir, `pre_restore_${ts}.sqlite`))
    // Geri yükle
    fs.copyFileSync(srcFile, dbPath)
    return { success: true, message: 'Yedek geri yüklendi. Uygulama yeniden başlatılacak.' }
  })

  ipcMain.handle('backup:listAuto', () => {
    const backupDir = path.join(app.getPath('userData'), 'backups', 'auto')
    if (!fs.existsSync(backupDir)) return []
    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .sort()
      .reverse()
      .map(f => {
        const fullPath = path.join(backupDir, f)
        const stat = fs.statSync(fullPath)
        return { filename: f, path: fullPath, size: stat.size, date: stat.mtime.toISOString() }
      })
  })

  ipcMain.handle('backup:runNow', () => {
    runAutoBackup(db())
    return { success: true }
  })
}
