import https from 'https'
import type { Database } from 'better-sqlite3'
import { decryptCredential } from './credentialService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmsOptions {
  db: Database
  phone: string
  message: string
  studentId?: number
  recipientName: string
  templateKey?: string
}

export interface SmsCredentials {
  usercode: string
  password: string
  msgheader: string
}

interface LogSmsData {
  studentId?: number
  recipientName: string
  phone: string
  message: string
  templateKey?: string
  status: 'sent' | 'failed' | 'skipped'
  errorMessage?: string
}

// ─── Template Engine ──────────────────────────────────────────────────────────

export function buildMessage(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`[${key}]`, value)
  }
  return result
}

// ─── Netgsm API ───────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function sendSmsNetgsm(
  credentials: SmsCredentials,
  phone: string,
  message: string
): Promise<{ success: boolean; code: string; error?: string }> {
  return new Promise((resolve) => {
    // Normalize phone: remove spaces, dashes, leading +90 or 0
    let gsmno = phone.replace(/[\s\-\(\)]/g, '')
    if (gsmno.startsWith('+90')) gsmno = gsmno.slice(3)
    else if (gsmno.startsWith('90') && gsmno.length === 12) gsmno = gsmno.slice(2)
    else if (gsmno.startsWith('0')) gsmno = gsmno.slice(1)

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<mainbody>
  <header>
    <usercode>${escapeXml(credentials.usercode)}</usercode>
    <password>${escapeXml(credentials.password)}</password>
    <msgheader>${escapeXml(credentials.msgheader)}</msgheader>
  </header>
  <body>
    <msg><![CDATA[${message}]]></msg>
    <no>${gsmno}</no>
  </body>
</mainbody>`

    const bodyBuffer = Buffer.from(xmlBody, 'utf8')

    const req = https.request(
      {
        hostname: 'api.netgsm.com.tr',
        path: '/sms/send/xml',
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=UTF-8',
          'Content-Length': bodyBuffer.length
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          const code = data.trim().split(' ')[0]
          // Netgsm success codes: 00, 01, 02
          if (code === '00' || code === '01' || code === '02') {
            resolve({ success: true, code })
          } else {
            resolve({ success: false, code, error: `Netgsm hata kodu: ${data.trim()}` })
          }
        })
      }
    )

    req.on('error', (err) => {
      resolve({ success: false, code: 'NET_ERR', error: err.message })
    })

    req.setTimeout(10000, () => {
      req.destroy()
      resolve({ success: false, code: 'TIMEOUT', error: 'İstek zaman aşımına uğradı' })
    })

    req.write(bodyBuffer)
    req.end()
  })
}

// ─── SMS Logger ───────────────────────────────────────────────────────────────

export function logSms(db: Database, data: LogSmsData): void {
  db.prepare(`
    INSERT INTO sms_log (student_id, recipient_name, phone, message, template_key, status, error_message)
    VALUES (@studentId, @recipientName, @phone, @message, @templateKey, @status, @errorMessage)
  `).run({
    studentId: data.studentId ?? null,
    recipientName: data.recipientName,
    phone: data.phone,
    message: data.message,
    templateKey: data.templateKey ?? null,
    status: data.status,
    errorMessage: data.errorMessage ?? null
  })
}

// ─── Main Send Function ───────────────────────────────────────────────────────

export async function sendSms(opts: SmsOptions): Promise<{ success: boolean; error?: string }> {
  const { db, phone, message, studentId, recipientName, templateKey } = opts

  // Get credentials from settings (decrypt if stored encrypted)
  const getVal = (key: string): string => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return ''
    let parsed: string
    try { parsed = JSON.parse(row.value) as string } catch { parsed = row.value }
    return decryptCredential(parsed)
  }

  const usercode = getVal('netgsm_usercode')
  const password = getVal('netgsm_password')
  const msgheader = getVal('netgsm_msgheader') || 'LirikSanat'

  // No credentials → skip
  if (!usercode || !password) {
    logSms(db, {
      studentId,
      recipientName,
      phone,
      message,
      templateKey,
      status: 'skipped',
      errorMessage: 'Netgsm bilgileri girilmemiş'
    })
    return { success: false, error: 'Netgsm API bilgileri ayarlanmamış' }
  }

  const result = await sendSmsNetgsm({ usercode, password, msgheader }, phone, message)

  logSms(db, {
    studentId,
    recipientName,
    phone,
    message,
    templateKey,
    status: result.success ? 'sent' : 'failed',
    errorMessage: result.error
  })

  return result
}

// ─── Credentials Check ────────────────────────────────────────────────────────

export function hasNetgsmCredentials(db: Database): boolean {
  const getVal = (key: string): string => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return ''
    let parsed: string
    try { parsed = JSON.parse(row.value) as string } catch { parsed = row.value }
    return decryptCredential(parsed)
  }
  return !!(getVal('netgsm_usercode') && getVal('netgsm_password'))
}
