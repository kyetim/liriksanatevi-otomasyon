import type { Database } from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { sendSms, buildMessage } from './smsService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: number
  first_name: string
  last_name: string
  parent_name: string | null
  parent_phone: string | null
}

interface PaymentRow {
  id: number
  student_id: number
  total_amount: number
  due_date: string
  first_name: string
  last_name: string
  parent_name: string | null
  parent_phone: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSettingStr(db: Database, key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return ''
  try { return JSON.parse(row.value) as string } catch { return row.value }
}

function getSettingBool(db: Database, key: string): boolean {
  const val = getSettingStr(db, key)
  return val === 'true' || val === '1'
}

function getTemplate(db: Database, key: string): string {
  const row = db.prepare(
    'SELECT content FROM sms_templates WHERE template_key = ? AND is_active = 1'
  ).get(key) as { content: string } | undefined
  return row?.content ?? ''
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime()
  const msB = new Date(b).getTime()
  return Math.round((msB - msA) / 86400000)
}

// ─── Daily Job ────────────────────────────────────────────────────────────────

export async function runDailyJob(db: Database): Promise<void> {
  console.log('[Scheduler] Günlük SMS görevi başlatıldı:', new Date().toLocaleString('tr-TR'))

  const today = todayStr()
  const in3Days = dateAddDays(today, 3)

  // ── 1. Ödeme Hatırlatma (3 gün sonra vadesi dolacak) ──────────────────────
  if (getSettingBool(db, 'sms_auto_payment_reminder')) {
    const template = getTemplate(db, 'payment_reminder')
    if (template) {
      const rows = db.prepare(`
        SELECT p.id, p.student_id, p.total_amount, p.due_date,
               s.first_name, s.last_name, s.parent_name, s.parent_phone
        FROM payments p
        JOIN students s ON p.student_id = s.id
        WHERE p.status IN ('pending','partial')
          AND p.due_date = @in3Days
      `).all({ in3Days }) as PaymentRow[]

      for (const row of rows) {
        const phone = row.parent_phone || ''
        if (!phone) continue
        const name = row.parent_name || `${row.first_name} ${row.last_name} Velisi`
        const message = buildMessage(template, {
          'VELİ_ADI': name,
          'ÖĞRENCİ_ADI': `${row.first_name} ${row.last_name}`,
          'AY': new Date(row.due_date).toLocaleDateString('tr-TR', { month: 'long' }),
          'TUTAR': row.total_amount.toFixed(2),
          'TARİH': new Date(row.due_date).toLocaleDateString('tr-TR'),
          'GÜN': '3',
          'SAAT': '',
          'TELEFON': getSettingStr(db, 'school_phone') || ''
        })
        await sendSms({ db, phone, message, studentId: row.student_id, recipientName: name, templateKey: 'payment_reminder' })
      }
    }
  }

  // ── 2. Gecikmiş Ödeme (dünden beri geçmis, hala pending) ─────────────────
  if (getSettingBool(db, 'sms_auto_overdue')) {
    const template = getTemplate(db, 'overdue')
    if (template) {
      const yesterday = dateAddDays(today, -1)
      const rows = db.prepare(`
        SELECT p.id, p.student_id, p.total_amount, p.due_date,
               s.first_name, s.last_name, s.parent_name, s.parent_phone
        FROM payments p
        JOIN students s ON p.student_id = s.id
        WHERE p.status IN ('pending','partial')
          AND p.due_date <= @yesterday
          AND NOT EXISTS (
            SELECT 1 FROM sms_log sl
            WHERE sl.student_id = p.student_id
              AND sl.template_key = 'overdue'
              AND sl.status = 'sent'
              AND date(sl.sent_at) = @today
          )
      `).all({ yesterday, today }) as PaymentRow[]

      for (const row of rows) {
        const phone = row.parent_phone || ''
        if (!phone) continue
        const name = row.parent_name || `${row.first_name} ${row.last_name} Velisi`
        const gunSayisi = daysBetween(row.due_date, today)
        const message = buildMessage(template, {
          'VELİ_ADI': name,
          'ÖĞRENCİ_ADI': `${row.first_name} ${row.last_name}`,
          'TUTAR': row.total_amount.toFixed(2),
          'GÜN': String(gunSayisi),
          'TARİH': new Date(row.due_date).toLocaleDateString('tr-TR'),
          'TELEFON': getSettingStr(db, 'school_phone') || '',
          'AY': '',
          'SAAT': ''
        })
        await sendSms({ db, phone, message, studentId: row.student_id, recipientName: name, templateKey: 'overdue' })
      }
    }
  }

  // ── 3. Doğum Günü ────────────────────────────────────────────────────────
  if (getSettingBool(db, 'sms_auto_birthday')) {
    const template = getTemplate(db, 'birthday')
    if (template) {
      // Match MM-DD part of birth_date with today
      const mmdd = today.slice(5) // "MM-DD"
      const rows = db.prepare(`
        SELECT id, first_name, last_name, parent_name, parent_phone
        FROM students
        WHERE status = 'active'
          AND birth_date IS NOT NULL
          AND substr(birth_date, 6) = @mmdd
          AND NOT EXISTS (
            SELECT 1 FROM sms_log sl
            WHERE sl.student_id = students.id
              AND sl.template_key = 'birthday'
              AND sl.status = 'sent'
              AND date(sl.sent_at) = @today
          )
      `).all({ mmdd, today }) as StudentRow[]

      for (const row of rows) {
        const phone = row.parent_phone || ''
        if (!phone) continue
        const name = row.parent_name || `${row.first_name} ${row.last_name} Velisi`
        const message = buildMessage(template, {
          'VELİ_ADI': name,
          'ÖĞRENCİ_ADI': `${row.first_name} ${row.last_name}`,
          'TUTAR': '',
          'GÜN': '',
          'TARİH': '',
          'TELEFON': '',
          'AY': '',
          'SAAT': ''
        })
        await sendSms({ db, phone, message, studentId: row.id, recipientName: name, templateKey: 'birthday' })
      }
    }
  }

  // ── Son çalışma tarihini kaydet ──────────────────────────────────────────
  db.prepare(`
    INSERT INTO settings (key, value, description)
    VALUES ('scheduler_last_run', @val, 'Son otomatik SMS çalışma tarihi')
    ON CONFLICT(key) DO UPDATE SET value = @val
  `).run({ val: JSON.stringify(today) })

  console.log('[Scheduler] Günlük SMS görevi tamamlandı.')
}

// ─── Auto Backup ─────────────────────────────────────────────────────────────

export function runAutoBackup(db: Database): void {
  try {
    const getSetting = (key: string): string => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
      if (!row) return ''
      try { return JSON.parse(row.value) as string } catch { return row.value }
    }

    if (getSetting('auto_backup_enabled') !== 'true') return

    const keep = parseInt(getSetting('auto_backup_keep') || '7', 10)
    const dbPath = (db as unknown as { name: string }).name // better-sqlite3 exposes .name as file path
    const backupDir = path.join(app.getPath('userData'), 'backups', 'auto')
    fs.mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const destFile = path.join(backupDir, `backup_${timestamp}.sqlite`)
    fs.copyFileSync(dbPath, destFile)
    console.log('[Backup] Otomatik yedek oluşturuldu:', destFile)

    // Eski yedekleri sil — keep sayısını aşanları kaldır
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .sort()
    if (files.length > keep) {
      const toDelete = files.slice(0, files.length - keep)
      for (const f of toDelete) {
        try { fs.unlinkSync(path.join(backupDir, f)) } catch { /* ignore */ }
      }
    }
  } catch (err) {
    console.error('[Backup] Otomatik yedek hatası:', err)
  }
}

// ─── Scheduler Start ─────────────────────────────────────────────────────────

export function startScheduler(db: Database): void {
  console.log('[Scheduler] Başlatıldı — her dakika kontrol edilecek.')

  const check = async (): Promise<void> => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const today = todayStr()

    // Run SMS job at 09:00
    if (hours === 9 && minutes === 0) {
      const lastRun = getSettingStr(db, 'scheduler_last_run')
      if (lastRun !== today) {
        await runDailyJob(db)
      }
    }

    // Run auto backup at 23:00
    if (hours === 23 && minutes === 0) {
      const lastBackup = getSettingStr(db, 'scheduler_last_backup')
      if (lastBackup !== today) {
        runAutoBackup(db)
        db.prepare(`INSERT INTO settings (key,value,description) VALUES ('scheduler_last_backup',@v,'Son otomatik yedek tarihi') ON CONFLICT(key) DO UPDATE SET value=@v`).run({ v: JSON.stringify(today) })
      }
    }
  }

  // Check immediately in case app starts at 09:00
  check().catch(err => console.error('[Scheduler] İlk kontrol hatası:', err))

  // Then check every minute
  setInterval(() => {
    check().catch(err => console.error('[Scheduler] Periyodik kontrol hatası:', err))
  }, 60 * 1000)
}
