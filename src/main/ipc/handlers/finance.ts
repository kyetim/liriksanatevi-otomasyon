import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { validate, ExpenseCreateSchema, ExpenseUpdateSchema } from '../../validation/schemas'

export function registerFinanceHandlers(): void {
  const db = () => getDatabase()

  // ─── EXPENSES ─────────────────────────────────────────────────────────────
  ipcMain.handle('expenses:getAll', () => {
    return db().prepare('SELECT * FROM expenses ORDER BY payment_date DESC LIMIT 2000').all()
  })

  ipcMain.handle('expenses:getByMonth', (_e, year: number, month: number) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return db().prepare(`
      SELECT * FROM expenses
      WHERE strftime('%Y-%m', payment_date) = ?
      ORDER BY payment_date DESC
    `).all(prefix)
  })

  ipcMain.handle('expenses:create', (_e, data: unknown) => {
    try {
      const validated = validate(ExpenseCreateSchema, data)
      const params = {
        vendor: null, receipt_number: null, notes: null,
        payment_date: new Date().toISOString().split('T')[0], category: 'other',
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO expenses (category, description, amount, payment_date, vendor, receipt_number, notes)
        VALUES (@category, @description, @amount, @payment_date, @vendor, @receipt_number, @notes)
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('expenses:update', (_e, id: number, data: unknown) => {
    try {
      const validated = validate(ExpenseUpdateSchema, data)
      db().prepare(`
        UPDATE expenses SET
          category = @category, description = @description, amount = @amount,
          payment_date = @payment_date, vendor = @vendor, notes = @notes
        WHERE id = @id
      `).run({ ...validated, id })
      return db().prepare('SELECT * FROM expenses WHERE id = ?').get(id)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('expenses:delete', (_e, id: number) => {
    db().prepare('DELETE FROM expenses WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── CASH REGISTERS ───────────────────────────────────────────────────────
  ipcMain.handle('cash_registers:getAll', () => {
    return db().prepare(`
      SELECT cr.*,
        (SELECT crm.movement_date FROM cash_register_movements crm WHERE crm.register_id = cr.id ORDER BY crm.created_at DESC LIMIT 1) AS last_movement,
        (SELECT COUNT(*) FROM cash_register_movements crm2 WHERE crm2.register_id = cr.id AND date(crm2.movement_date) = date('now')) AS today_movement_count
      FROM cash_registers cr
      WHERE cr.is_active = 1
      ORDER BY cr.id
    `).all()
  })

  ipcMain.handle('cash_registers:openSession', (_e, registerId: number, openingBalance: number, openedBy?: string) => {
    const today = new Date().toISOString().split('T')[0]
    const existing = db().prepare(`SELECT id FROM cash_register_sessions WHERE register_id = ? AND session_date = ? AND status = 'open'`).get(registerId, today)
    if (existing) throw new Error('Bu kasa bugün zaten açık')
    const result = db().prepare(`
      INSERT INTO cash_register_sessions (register_id, session_date, opening_balance, opened_by)
      VALUES (?, ?, ?, ?)
    `).run(registerId, today, openingBalance, openedBy ?? 'Sistem')
    db().prepare(`INSERT INTO cash_register_movements (register_id, session_id, movement_type, amount, description) VALUES (?, ?, 'opening', ?, 'Kasa açılışı')`).run(registerId, result.lastInsertRowid, openingBalance)
    db().prepare('UPDATE cash_registers SET current_balance = ? WHERE id = ?').run(openingBalance, registerId)
    return db().prepare('SELECT * FROM cash_register_sessions WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('cash_registers:closeSession', (_e, sessionId: number, closedBy?: string) => {
    const session = db().prepare('SELECT * FROM cash_register_sessions WHERE id = ?').get(sessionId) as any
    if (!session) throw new Error('Oturum bulunamadı')
    const balance = (db().prepare('SELECT current_balance FROM cash_registers WHERE id = ?').get(session.register_id) as any).current_balance
    db().prepare(`UPDATE cash_register_sessions SET status = 'closed', closing_balance = ?, closed_by = ? WHERE id = ?`).run(balance, closedBy ?? 'Sistem', sessionId)
    db().prepare(`INSERT INTO cash_register_movements (register_id, session_id, movement_type, amount, description) VALUES (?, ?, 'closing', ?, 'Kasa kapanışı')`).run(session.register_id, sessionId, balance)
    return { success: true, closing_balance: balance }
  })

  ipcMain.handle('cash_registers:getMovements', (_e, registerId: number, dateFrom?: string, dateTo?: string) => {
    const from = dateFrom ?? new Date().toISOString().split('T')[0]
    const to = dateTo ?? new Date().toISOString().split('T')[0]
    return db().prepare(`
      SELECT crm.*
      FROM cash_register_movements crm
      WHERE crm.register_id = ? AND date(crm.movement_date) BETWEEN ? AND ?
      ORDER BY crm.movement_date DESC
    `).all(registerId, from, to)
  })

  ipcMain.handle('cash_registers:addMovement', (_e, data: Record<string, unknown>) => {
    const params: Record<string, unknown> = { session_id: null, payment_id: null, expense_id: null, virman_id: null, ...data }
    const result = db().prepare(`
      INSERT INTO cash_register_movements (register_id, session_id, movement_type, amount, description, payment_id, expense_id, virman_id)
      VALUES (@register_id, @session_id, @movement_type, @amount, @description, @payment_id, @expense_id, @virman_id)
    `).run(params)
    // Bakiyeyi güncelle
    const delta = (params.movement_type === 'income' || params.movement_type === 'virman_in') ? Number(params.amount) : -Number(params.amount)
    db().prepare('UPDATE cash_registers SET current_balance = current_balance + ? WHERE id = ?').run(delta, params.register_id)
    return db().prepare('SELECT * FROM cash_register_movements WHERE id = ?').get(result.lastInsertRowid)
  })
}
