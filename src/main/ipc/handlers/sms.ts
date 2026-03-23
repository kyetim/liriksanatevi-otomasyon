import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { sendSms, logSms, hasNetgsmCredentials } from '../../services/smsService'
import { runDailyJob } from '../../services/scheduler'

export function registerSmsHandlers(): void {
  const db = () => getDatabase()

  // ─── SMS ──────────────────────────────────────────────────────────────────

  ipcMain.handle('sms:send', async (_e, params: Record<string, unknown>) => {
    const { phone, message, studentId, recipientName, templateKey } = params as {
      phone: string; message: string; studentId?: number
      recipientName: string; templateKey?: string
    }
    return sendSms({ db: db(), phone, message, studentId, recipientName, templateKey })
  })

  ipcMain.handle('sms:sendBulk', async (_e, items: Array<{
    phone: string; message: string; studentId?: number
    recipientName: string; templateKey?: string
  }>) => {
    const results: Array<{ recipientName: string; success: boolean; error?: string }> = []
    for (const item of items) {
      const res = await sendSms({ db: db(), ...item })
      results.push({ recipientName: item.recipientName, ...res })
    }
    const sent = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    return { total: items.length, sent, failed, results }
  })

  ipcMain.handle('sms:getHistory', (_e, params?: { dateFrom?: string; dateTo?: string; status?: string }) => {
    let sql = `
      SELECT sl.*, s.first_name || ' ' || s.last_name AS student_name
      FROM sms_log sl
      LEFT JOIN students s ON sl.student_id = s.id
      WHERE 1=1
    `
    const args: Record<string, unknown> = {}
    if (params?.dateFrom) { sql += ' AND date(sl.sent_at) >= @dateFrom'; args.dateFrom = params.dateFrom }
    if (params?.dateTo)   { sql += ' AND date(sl.sent_at) <= @dateTo';   args.dateTo   = params.dateTo   }
    if (params?.status)   { sql += ' AND sl.status = @status';            args.status   = params.status   }
    sql += ' ORDER BY sl.sent_at DESC LIMIT 500'
    return db().prepare(sql).all(args)
  })

  ipcMain.handle('sms:getHistoryByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT sl.*, s.first_name || ' ' || s.last_name AS student_name
      FROM sms_log sl
      LEFT JOIN students s ON sl.student_id = s.id
      WHERE sl.student_id = ?
      ORDER BY sl.sent_at DESC
    `).all(studentId)
  })

  ipcMain.handle('sms:getMonthlySummary', (_e, year: number, month: number) => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const row = db().prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'sent'    THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped
      FROM sms_log
      WHERE strftime('%Y-%m', sent_at) = ?
    `).get(monthStr) as { total: number; sent: number; failed: number; skipped: number }
    return row
  })

  ipcMain.handle('sms:templates:getAll', () => {
    return db().prepare('SELECT * FROM sms_templates ORDER BY id').all()
  })

  ipcMain.handle('sms:templates:update', (_e, templateKey: string, content: string) => {
    db().prepare(`
      UPDATE sms_templates
      SET content = ?, updated_at = datetime('now','localtime')
      WHERE template_key = ?
    `).run(content, templateKey)
    return { success: true }
  })

  ipcMain.handle('sms:testConnection', async () => {
    const hasCredentials = hasNetgsmCredentials(db())
    if (!hasCredentials) {
      return { success: false, error: 'Netgsm API bilgileri eksik. Lütfen Ayarlar sayfasından girin.' }
    }
    // Log a test entry (skipped, no actual send to avoid credit usage)
    logSms(db(), {
      studentId: undefined,
      recipientName: 'Bağlantı Testi',
      phone: '05000000000',
      message: 'Bağlantı testi',
      templateKey: undefined,
      status: 'skipped',
      errorMessage: 'Test — gerçek SMS gönderilmedi'
    })
    return { success: true, message: 'Netgsm bilgileri mevcut. SMS göndermeye hazır.' }
  })

  ipcMain.handle('sms:runDailyJob', async () => {
    await runDailyJob(db())
    return { success: true }
  })

  ipcMain.handle('sms:hasCredentials', () => {
    return { hasCredentials: hasNetgsmCredentials(db()) }
  })
}
