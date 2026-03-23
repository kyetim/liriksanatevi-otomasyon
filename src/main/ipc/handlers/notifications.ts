import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'

export function registerNotificationHandlers(): void {
  const db = () => getDatabase()

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  ipcMain.handle('notifications:getUnread', () => {
    return db().prepare(`
      SELECT n.*,
        s.first_name || ' ' || s.last_name AS student_name
      FROM notifications n
      LEFT JOIN students s ON n.related_student_id = s.id
      WHERE n.is_read = 0
      ORDER BY n.due_date ASC, n.created_at DESC
    `).all()
  })

  ipcMain.handle('notifications:markRead', (_e, id: number) => {
    db().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('notifications:markAllRead', () => {
    db().prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run()
    return { success: true }
  })

  ipcMain.handle('notifications:create', (_e, data: Record<string, unknown>) => {
    const stmt = db().prepare(`
      INSERT INTO notifications (type, title, message, related_student_id, related_payment_id, due_date)
      VALUES (@type, @title, @message, @related_student_id, @related_payment_id, @due_date)
    `)
    const result = stmt.run(data)
    return db().prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('notifications:delete', (_e, id: number) => {
    db().prepare('DELETE FROM notifications WHERE id = ?').run(id)
    return { success: true }
  })

  // Ödeme hatırlatmalarını otomatik oluştur
  ipcMain.handle('notifications:generatePaymentReminders', () => {
    const settingRow = db().prepare("SELECT value FROM settings WHERE key = 'payment_due_day'").get() as any
    const dueDay = settingRow ? parseInt(JSON.parse(settingRow.value), 10) : 5
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()

    // Bu aya ait ödenmemiş kayıtları bul
    const unpaidStudents = db().prepare(`
      SELECT DISTINCT e.student_id, s.first_name || ' ' || s.last_name AS name,
        e.monthly_fee, i.name AS instrument_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE e.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = e.student_id
            AND p.period_month = ? AND p.period_year = ?
            AND p.status IN ('paid','partial')
        )
    `).all(thisMonth, thisYear) as any[]

    const insert = db().prepare(`
      INSERT OR IGNORE INTO notifications (type, title, message, related_student_id, due_date)
      VALUES ('payment_due', @title, @message, @student_id, @due_date)
    `)

    const dueDate = `${thisYear}-${String(thisMonth).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`

    const bulk = db().transaction(() => {
      for (const s of unpaidStudents) {
        insert.run({
          title: `Ödeme Hatırlatması — ${s.name}`,
          message: `${s.name} öğrencisinin ${thisMonth}/${thisYear} dönemi ödemesi bekliyor. (${s.monthly_fee} ₺)`,
          student_id: s.student_id,
          due_date: dueDate
        })
      }
    })
    bulk()
    return { generated: unpaidStudents.length }
  })
}
