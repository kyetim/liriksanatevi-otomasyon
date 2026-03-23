import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { validate, TeacherCreateSchema, TeacherUpdateSchema } from '../../validation/schemas'

export function registerTeacherHandlers(): void {
  const db = () => getDatabase()

  // ─── TEACHERS ─────────────────────────────────────────────────────────────
  ipcMain.handle('teachers:getAll', () => {
    const rows = db().prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM enrollments e WHERE e.teacher_id = t.id AND e.status = 'active')
          AS active_enrollments,
        (SELECT GROUP_CONCAT(ti.instrument_id) FROM teacher_instruments ti WHERE ti.teacher_id = t.id)
          AS instrument_ids_csv,
        sc.salary_type   AS cfg_salary_type,
        sc.base_salary   AS cfg_base_salary,
        sc.per_lesson_rate AS cfg_per_lesson_rate,
        sc.percentage_rate AS cfg_percentage_rate
      FROM teachers t
      LEFT JOIN (
        SELECT teacher_id, salary_type, base_salary, per_lesson_rate, percentage_rate
        FROM teacher_salary_configs
        WHERE id IN (
          SELECT MAX(id) FROM teacher_salary_configs GROUP BY teacher_id
        )
      ) sc ON sc.teacher_id = t.id
      ORDER BY t.first_name, t.last_name
    `).all() as (Record<string, unknown> & { instrument_ids_csv?: string })[]

    return rows.map(row => ({
      ...row,
      instrument_ids: row.instrument_ids_csv
        ? row.instrument_ids_csv.split(',').map(Number)
        : [],
      instrument_ids_csv: undefined
    }))
  })

  ipcMain.handle('teachers:getById', (_e, id: number) => {
    return db().prepare('SELECT * FROM teachers WHERE id = ?').get(id)
  })

  ipcMain.handle('teachers:create', (_e, data: unknown) => {
    try {
      const validated = validate(TeacherCreateSchema, data)
      const params = {
        birth_date: null, phone: null, email: null, address: null,
        specialization: null, iban: null, photo_path: null, notes: null,
        employment_type: 'full_time', salary_type: 'fixed', salary_amount: 0,
        hire_date: new Date().toISOString().split('T')[0], status: 'active',
        color_code: '#7C3AED',
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO teachers (
          first_name, last_name, birth_date, phone, email, address,
          specialization, employment_type, salary_type, salary_amount,
          iban, hire_date, status, photo_path, notes, color_code
        ) VALUES (
          @first_name, @last_name, @birth_date, @phone, @email, @address,
          @specialization, @employment_type, @salary_type, @salary_amount,
          @iban, @hire_date, @status, @photo_path, @notes, @color_code
        )
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM teachers WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('teachers:update', (_e, id: number, data: unknown) => {
    try {
      const validated = validate(TeacherUpdateSchema, data)
      const params = {
        birth_date: null, phone: null, email: null, address: null,
        specialization: null, iban: null, photo_path: null, notes: null,
        tc_kimlik_no: null, sgk_no: null, contract_type: null,
        contract_start: null, contract_end: null, color_code: '#7C3AED',
        ...validated, id
      }
      db().prepare(`
        UPDATE teachers SET
          first_name = @first_name, last_name = @last_name,
          birth_date = @birth_date, phone = @phone,
          email = @email, address = @address,
          specialization = @specialization, employment_type = @employment_type,
          salary_type = @salary_type, salary_amount = @salary_amount,
          iban = @iban, status = @status,
          photo_path = @photo_path, notes = @notes,
          tc_kimlik_no = @tc_kimlik_no, sgk_no = @sgk_no,
          contract_type = @contract_type, contract_start = @contract_start,
          contract_end = @contract_end, color_code = @color_code
        WHERE id = @id
      `).run(params)
      return db().prepare('SELECT * FROM teachers WHERE id = ?').get(id)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('teachers:delete', (_e, id: number) => {
    try {
      const del = db().transaction(() => {
        db().prepare('DELETE FROM monthly_payrolls WHERE teacher_id = ?').run(id)
        db().prepare('DELETE FROM teachers WHERE id = ?').run(id)
      })
      del()
      return { success: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  // ─── Öğretmen–Enstrüman bağlantısı ────────────────────────────────────────

  ipcMain.handle('teachers:getInstruments', (_e, teacherId: number) => {
    return (db().prepare(
      'SELECT instrument_id FROM teacher_instruments WHERE teacher_id = ?'
    ).all(teacherId) as { instrument_id: number }[]).map(r => r.instrument_id)
  })

  ipcMain.handle('teachers:setInstruments', (_e, teacherId: number, instrumentIds: number[]) => {
    const replace = db().transaction((ids: number[]) => {
      db().prepare('DELETE FROM teacher_instruments WHERE teacher_id = ?').run(teacherId)
      const ins = db().prepare('INSERT INTO teacher_instruments (teacher_id, instrument_id) VALUES (?, ?)')
      for (const id of ids) ins.run(teacherId, id)
    })
    replace(instrumentIds)
    return { success: true }
  })

  /** Belirtilen enstrümanı öğreten aktif öğretmenler */
  ipcMain.handle('teachers:getByInstrument', (_e, instrumentId: number) => {
    return db().prepare(`
      SELECT t.*, (
        SELECT COUNT(*) FROM enrollments e
        WHERE e.teacher_id = t.id AND e.status = 'active'
      ) AS active_enrollments
      FROM teachers t
      INNER JOIN teacher_instruments ti ON ti.teacher_id = t.id
      WHERE ti.instrument_id = ? AND t.status = 'active'
      ORDER BY t.first_name, t.last_name
    `).all(instrumentId)
  })
}
