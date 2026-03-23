import { ipcMain } from 'electron'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../../db/database'

export function registerAuthHandlers(): void {
  const db = () => getDatabase()

  // ─── AUTH ─────────────────────────────────────────────────────────────────

  ipcMain.handle('auth:login', async (_e, email: string, password: string, remember: boolean) => {
    const user = db().prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).get(email) as Record<string, unknown> | undefined

    if (!user) return { success: false, error: 'Kullanıcı bulunamadı veya hesap pasif.' }

    const valid = await bcrypt.compare(password, user.password_hash as string)
    if (!valid) return { success: false, error: 'Şifre hatalı.' }

    // Token oluştur
    const token = crypto.randomBytes(32).toString('hex')
    const days = remember ? 30 : 1
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

    db().prepare(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt)

    // Son giriş güncelle
    db().prepare("UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?").run(user.id)

    // Not: auth olayları için audit_log şeması uygun değil, gerekirse ayrı tablo eklenebilir

    const { password_hash: _ph, ...safeUser } = user
    return { success: true, user: safeUser, token }
  })

  ipcMain.handle('auth:logout', (_e, token: string) => {
    if (!token) return { success: true }
    db().prepare('DELETE FROM user_sessions WHERE token = ?').run(token)
    return { success: true }
  })

  ipcMain.handle('auth:checkSession', (_e, token: string) => {
    if (!token) return null
    const session = db().prepare(
      'SELECT * FROM user_sessions WHERE token = ?'
    ).get(token) as Record<string, unknown> | undefined
    if (!session) return null
    // JS tarafında sona erme kontrolü (expires_at ISO string olarak saklanıyor)
    if (new Date(session.expires_at as string) < new Date()) {
      db().prepare('DELETE FROM user_sessions WHERE token = ?').run(token)
      return null
    }
    const user = db().prepare(
      'SELECT id, name, email, role, is_active, teacher_id, last_login, created_at FROM users WHERE id = ? AND is_active = 1'
    ).get(session.user_id) as Record<string, unknown> | undefined
    return user ?? null
  })

  ipcMain.handle('auth:changePassword', async (_e, userId: number, oldPassword: string, newPassword: string) => {
    const user = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' }
    const valid = await bcrypt.compare(oldPassword, user.password_hash)
    if (!valid) return { success: false, error: 'Mevcut şifre hatalı.' }
    const newHash = await bcrypt.hash(newPassword, 10)
    db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId)
    return { success: true }
  })

  // ─── USERS ────────────────────────────────────────────────────────────────

  ipcMain.handle('users:getAll', () => {
    return db().prepare(
      'SELECT id, name, email, role, is_active, teacher_id, last_login, created_at, updated_at FROM users ORDER BY name'
    ).all()
  })

  ipcMain.handle('users:create', async (_e, data: Record<string, unknown>) => {
    const hash = await bcrypt.hash(data.password as string, 10)
    const result = db().prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, teacher_id)
      VALUES (@name, @email, @password_hash, @role, @is_active, @teacher_id)
    `).run({ ...data, password_hash: hash, is_active: 1, teacher_id: data.teacher_id ?? null })
    return db().prepare(
      'SELECT id, name, email, role, is_active, teacher_id, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid)
  })

  ipcMain.handle('users:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`
      UPDATE users SET name=@name, email=@email, role=@role,
        is_active=@is_active, teacher_id=@teacher_id WHERE id=@id
    `).run({ ...data, id, teacher_id: data.teacher_id ?? null })
    return db().prepare(
      'SELECT id, name, email, role, is_active, teacher_id, last_login, created_at FROM users WHERE id = ?'
    ).get(id)
  })

  ipcMain.handle('users:delete', (_e, id: number) => {
    db().prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id)
    db().prepare('DELETE FROM users WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('users:resetPassword', async (_e, id: number, newPassword: string) => {
    const hash = await bcrypt.hash(newPassword, 10)
    db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id)
    db().prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id)
    return { success: true }
  })
}
