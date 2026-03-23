import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { validate, PaymentCreateSchema, PaymentUpdateSchema } from '../../validation/schemas'

export function registerPaymentHandlers(): void {
  const db = () => getDatabase()

  // ─── PAYMENTS ─────────────────────────────────────────────────────────────
  ipcMain.handle('payments:getAll', () => {
    return db().prepare(`
      SELECT p.*,
        s.first_name || ' ' || s.last_name AS student_name,
        i.name AS instrument_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN enrollments e ON p.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 2000
    `).all()
  })

  ipcMain.handle('payments:getByMonth', (_e, year: number, month: number) => {
    return db().prepare(`
      SELECT p.*,
        s.first_name || ' ' || s.last_name AS student_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      WHERE p.period_year = ? AND p.period_month = ?
      ORDER BY p.payment_date DESC
    `).all(year, month)
  })

  ipcMain.handle('payments:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT p.*, i.name AS instrument_name
      FROM payments p
      LEFT JOIN enrollments e ON p.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE p.student_id = ?
      ORDER BY p.payment_date DESC
    `).all(studentId)
  })

  ipcMain.handle('payments:getPending', () => {
    return db().prepare(`
      SELECT p.*,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone AS student_phone
      FROM payments p
      JOIN students s ON p.student_id = s.id
      WHERE p.status IN ('pending','overdue')
      ORDER BY p.due_date ASC
    `).all()
  })

  ipcMain.handle('payments:create', (_e, data: unknown) => {
    try {
      const validated = validate(PaymentCreateSchema, data)
      const amount = Number(validated.amount) || 0
      const discount = Number(validated.discount_amount) || 0
      const params = {
        enrollment_id: null, due_date: null, notes: null, created_by: null,
        discount_amount: 0, period_month: null, period_year: null,
        payment_type: 'monthly_fee', payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0], status: 'paid',
        ...validated,
        total_amount: Math.max(0, amount - discount)
      }
      const stmt = db().prepare(`
        INSERT INTO payments (
          student_id, enrollment_id, payment_type,
          amount, discount_amount, total_amount,
          payment_method, payment_date, due_date,
          period_month, period_year, status,
          notes, created_by
        ) VALUES (
          @student_id, @enrollment_id, @payment_type,
          @amount, @discount_amount, @total_amount,
          @payment_method, @payment_date, @due_date,
          @period_month, @period_year, @status,
          @notes, @created_by
        )
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('payments:update', (_e, id: number, data: unknown) => {
    try {
      const validated = validate(PaymentUpdateSchema, data)
      const amount = Number(validated.amount) || 0
      const discount = Number(validated.discount_amount) || 0
      db().prepare(`
        UPDATE payments SET
          payment_type = @payment_type, amount = @amount,
          discount_amount = @discount_amount, total_amount = @total_amount,
          payment_method = @payment_method, payment_date = @payment_date,
          due_date = @due_date, status = @status, notes = @notes
        WHERE id = @id
      `).run({ ...validated, id, total_amount: amount - discount })
      return db().prepare('SELECT * FROM payments WHERE id = ?').get(id)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('payments:delete', (_e, id: number) => {
    db().prepare('DELETE FROM payments WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── PAYMENT PLANS ────────────────────────────────────────────────────────
  ipcMain.handle('payment_plans:getAll', () => {
    return db().prepare(`
      SELECT pp.*,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone AS student_phone,
        COALESCE((SELECT SUM(ppi.amount) FROM payment_plan_items ppi WHERE ppi.plan_id = pp.id AND ppi.status = 'paid'), 0) AS paid_amount,
        COALESCE((SELECT COUNT(*) FROM payment_plan_items ppi WHERE ppi.plan_id = pp.id AND ppi.status = 'paid'), 0) AS paid_count
      FROM payment_plans pp
      JOIN students s ON pp.student_id = s.id
      ORDER BY pp.created_at DESC
    `).all()
  })

  ipcMain.handle('payment_plans:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT pp.*,
        s.first_name || ' ' || s.last_name AS student_name,
        COALESCE((SELECT SUM(ppi.amount) FROM payment_plan_items ppi WHERE ppi.plan_id = pp.id AND ppi.status = 'paid'), 0) AS paid_amount
      FROM payment_plans pp
      JOIN students s ON pp.student_id = s.id
      WHERE pp.student_id = ?
      ORDER BY pp.created_at DESC
    `).all(studentId)
  })

  ipcMain.handle('payment_plans:create', (_e, data: Record<string, unknown>) => {
    const items = data.items as Array<{ installment_no: number; due_date: string; amount: number }>
    delete data.items
    const params = {
      enrollment_id: null, notes: null, discount_type: 'none', discount_value: 0, status: 'active',
      ...data
    }
    const createPlan = db().transaction(() => {
      const planResult = db().prepare(`
        INSERT INTO payment_plans (student_id, enrollment_id, title, total_amount, installment_count, start_date, discount_type, discount_value, notes, status)
        VALUES (@student_id, @enrollment_id, @title, @total_amount, @installment_count, @start_date, @discount_type, @discount_value, @notes, @status)
      `).run(params)
      const planId = planResult.lastInsertRowid
      const insertItem = db().prepare(`
        INSERT INTO payment_plan_items (plan_id, installment_no, due_date, amount, status)
        VALUES (?, ?, ?, ?, 'pending')
      `)
      for (const item of items) {
        insertItem.run(planId, item.installment_no, item.due_date, item.amount)
      }
      return db().prepare('SELECT * FROM payment_plans WHERE id = ?').get(planId)
    })
    return createPlan()
  })

  ipcMain.handle('payment_plans:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`UPDATE payment_plans SET status = @status, notes = @notes, updated_at = datetime('now','localtime') WHERE id = @id`)
      .run({ status: 'active', notes: null, ...data, id })
    return db().prepare('SELECT * FROM payment_plans WHERE id = ?').get(id)
  })

  ipcMain.handle('payment_plans:delete', (_e, id: number) => {
    db().prepare('DELETE FROM payment_plans WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── PAYMENT PLAN ITEMS ───────────────────────────────────────────────────
  ipcMain.handle('payment_plan_items:getByPlan', (_e, planId: number) => {
    return db().prepare(`
      SELECT ppi.*, p.receipt_number, p.payment_date, p.payment_method
      FROM payment_plan_items ppi
      LEFT JOIN payments p ON ppi.payment_id = p.id
      WHERE ppi.plan_id = ?
      ORDER BY ppi.installment_no
    `).all(planId)
  })

  ipcMain.handle('payment_plan_items:markPaid', (_e, itemId: number, paymentId: number) => {
    const now = new Date().toISOString()
    db().prepare(`UPDATE payment_plan_items SET status = 'paid', payment_id = ?, paid_at = ? WHERE id = ?`).run(paymentId, now, itemId)
    // Tüm taksitler ödendiyse planı tamamlandı olarak işaretle
    const item = db().prepare('SELECT plan_id FROM payment_plan_items WHERE id = ?').get(itemId) as { plan_id: number } | undefined
    if (item) {
      const pending = (db().prepare(`SELECT COUNT(*) AS c FROM payment_plan_items WHERE plan_id = ? AND status != 'paid'`).get(item.plan_id) as { c: number }).c
      if (pending === 0) {
        db().prepare(`UPDATE payment_plans SET status = 'completed', updated_at = datetime('now','localtime') WHERE id = ?`).run(item.plan_id)
      }
    }
    return { success: true }
  })

  ipcMain.handle('payment_plan_items:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`UPDATE payment_plan_items SET due_date = @due_date, amount = @amount, status = @status WHERE id = @id`)
      .run({ ...data, id })
    return db().prepare('SELECT * FROM payment_plan_items WHERE id = ?').get(id)
  })

  // ─── CHECKS ───────────────────────────────────────────────────────────────
  ipcMain.handle('checks:getAll', () => {
    return db().prepare(`
      SELECT c.*,
        s.first_name || ' ' || s.last_name AS student_name
      FROM checks c
      LEFT JOIN students s ON c.student_id = s.id
      ORDER BY c.due_date ASC
    `).all()
  })

  ipcMain.handle('checks:create', (_e, data: Record<string, unknown>) => {
    const params = { branch: null, student_id: null, payment_id: null, notes: null, status: 'portfolio', ...data }
    const result = db().prepare(`
      INSERT INTO checks (check_number, bank_name, branch, account_holder, amount, issue_date, due_date, student_id, payment_id, status, notes)
      VALUES (@check_number, @bank_name, @branch, @account_holder, @amount, @issue_date, @due_date, @student_id, @payment_id, @status, @notes)
    `).run(params)
    return db().prepare('SELECT * FROM checks WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('checks:update', (_e, id: number, data: Record<string, unknown>) => {
    const existing = db().prepare('SELECT * FROM checks WHERE id = ?').get(id) as Record<string, unknown>
    db().prepare(`
      UPDATE checks SET check_number=@check_number, bank_name=@bank_name, branch=@branch,
      account_holder=@account_holder, amount=@amount, issue_date=@issue_date, due_date=@due_date,
      student_id=@student_id, payment_id=@payment_id, status=@status, notes=@notes WHERE id=@id
    `).run({ ...existing, ...data, id })
    return db().prepare('SELECT * FROM checks WHERE id = ?').get(id)
  })

  ipcMain.handle('checks:delete', (_e, id: number) => {
    db().prepare('DELETE FROM checks WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('checks:getDueSoon', () => {
    return db().prepare(`
      SELECT c.*, s.first_name || ' ' || s.last_name AS student_name
      FROM checks c
      LEFT JOIN students s ON c.student_id = s.id
      WHERE c.status = 'portfolio'
        AND date(c.due_date) <= date('now', '+7 days')
      ORDER BY c.due_date ASC
    `).all()
  })

  // ─── PROMISSORY NOTES (SENETLER) ──────────────────────────────────────────
  ipcMain.handle('promissory_notes:getAll', () => {
    return db().prepare(`
      SELECT pn.*,
        s.first_name || ' ' || s.last_name AS student_name
      FROM promissory_notes pn
      LEFT JOIN students s ON pn.student_id = s.id
      ORDER BY pn.due_date ASC
    `).all()
  })

  ipcMain.handle('promissory_notes:create', (_e, data: Record<string, unknown>) => {
    const params = { student_id: null, payment_id: null, notes: null, status: 'active', ...data }
    const result = db().prepare(`
      INSERT INTO promissory_notes (note_number, debtor_name, amount, issue_date, due_date, student_id, payment_id, status, notes)
      VALUES (@note_number, @debtor_name, @amount, @issue_date, @due_date, @student_id, @payment_id, @status, @notes)
    `).run(params)
    return db().prepare('SELECT * FROM promissory_notes WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('promissory_notes:update', (_e, id: number, data: Record<string, unknown>) => {
    const existing = db().prepare('SELECT * FROM promissory_notes WHERE id = ?').get(id) as Record<string, unknown>
    db().prepare(`
      UPDATE promissory_notes SET note_number=@note_number, debtor_name=@debtor_name, amount=@amount,
      issue_date=@issue_date, due_date=@due_date, student_id=@student_id, payment_id=@payment_id,
      status=@status, notes=@notes WHERE id=@id
    `).run({ ...existing, ...data, id })
    return db().prepare('SELECT * FROM promissory_notes WHERE id = ?').get(id)
  })

  ipcMain.handle('promissory_notes:delete', (_e, id: number) => {
    db().prepare('DELETE FROM promissory_notes WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('promissory_notes:getDueSoon', () => {
    return db().prepare(`
      SELECT pn.*, s.first_name || ' ' || s.last_name AS student_name
      FROM promissory_notes pn
      LEFT JOIN students s ON pn.student_id = s.id
      WHERE pn.status = 'active'
        AND date(pn.due_date) <= date('now', '+7 days')
      ORDER BY pn.due_date ASC
    `).all()
  })

  // ─── REFUNDS (İADELER) ────────────────────────────────────────────────────
  ipcMain.handle('refunds:getAll', () => {
    return db().prepare(`
      SELECT r.*,
        s.first_name || ' ' || s.last_name AS student_name,
        p.receipt_number AS original_receipt,
        p.total_amount AS original_amount
      FROM refunds r
      JOIN students s ON r.student_id = s.id
      JOIN payments p ON r.original_payment_id = p.id
      ORDER BY r.created_at DESC
    `).all()
  })

  ipcMain.handle('refunds:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT r.*, p.receipt_number AS original_receipt, p.total_amount AS original_amount
      FROM refunds r
      JOIN payments p ON r.original_payment_id = p.id
      WHERE r.student_id = ?
      ORDER BY r.created_at DESC
    `).all(studentId)
  })

  ipcMain.handle('refunds:create', (_e, data: Record<string, unknown>) => {
    try {
      const params: Record<string, unknown> = { notes: null, ...data }
      const tx = db().transaction(() => {
        const result = db().prepare(`
          INSERT INTO refunds (original_payment_id, student_id, refund_amount, reason, refund_method, refund_date, notes)
          VALUES (@original_payment_id, @student_id, @refund_amount, @reason, @refund_method, @refund_date, @notes)
        `).run(params)
        const id = result.lastInsertRowid
        const year = new Date().getFullYear()
        const receipt_number = `LSE-IADE-${year}-${String(id).padStart(4, '0')}`
        db().prepare('UPDATE refunds SET receipt_number = ? WHERE id = ?').run(receipt_number, id)
        return db().prepare('SELECT * FROM refunds WHERE id = ?').get(id)
      })
      return tx()
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  // ─── VIRMAN (KASALAR ARASI TRANSFER) ─────────────────────────────────────
  ipcMain.handle('virman:getAll', () => {
    return db().prepare(`
      SELECT vt.*,
        cr_from.name AS from_register_name,
        cr_to.name AS to_register_name
      FROM virman_transfers vt
      JOIN cash_registers cr_from ON vt.from_register_id = cr_from.id
      JOIN cash_registers cr_to ON vt.to_register_id = cr_to.id
      ORDER BY vt.created_at DESC
    `).all()
  })

  ipcMain.handle('virman:create', (_e, data: Record<string, unknown>) => {
    const { from_register_id, to_register_id, amount, description } = data as { from_register_id: number; to_register_id: number; amount: number; description: string }
    const doVirman = db().transaction(() => {
      const result = db().prepare(`
        INSERT INTO virman_transfers (from_register_id, to_register_id, amount, description)
        VALUES (?, ?, ?, ?)
      `).run(from_register_id, to_register_id, amount, description)
      const virmanId = result.lastInsertRowid
      // Kaynak kasadan çıkar
      db().prepare('UPDATE cash_registers SET current_balance = current_balance - ? WHERE id = ?').run(amount, from_register_id)
      db().prepare(`INSERT INTO cash_register_movements (register_id, movement_type, amount, description, virman_id) VALUES (?, 'virman_out', ?, ?, ?)`).run(from_register_id, amount, `Virman → ${description}`, virmanId)
      // Hedef kasaya ekle
      db().prepare('UPDATE cash_registers SET current_balance = current_balance + ? WHERE id = ?').run(amount, to_register_id)
      db().prepare(`INSERT INTO cash_register_movements (register_id, movement_type, amount, description, virman_id) VALUES (?, 'virman_in', ?, ?, ?)`).run(to_register_id, amount, `Virman ← ${description}`, virmanId)
      return db().prepare('SELECT * FROM virman_transfers WHERE id = ?').get(virmanId)
    })
    return doVirman()
  })
}
