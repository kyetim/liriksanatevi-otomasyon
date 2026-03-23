import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { validate, InstrumentCreateSchema, EnrollmentCreateSchema, EnrollmentUpdateSchema } from '../../validation/schemas'

export function registerEnrollmentHandlers(): void {
  const db = () => getDatabase()

  // ─── INSTRUMENTS ──────────────────────────────────────────────────────────
  ipcMain.handle('instruments:getAll', () => {
    return db().prepare('SELECT * FROM instruments ORDER BY name').all()
  })

  ipcMain.handle('instruments:getActive', () => {
    return db().prepare('SELECT * FROM instruments WHERE is_active = 1 ORDER BY name').all()
  })

  ipcMain.handle('instruments:create', (_e, data: unknown) => {
    try {
      const validated = validate(InstrumentCreateSchema, data)
      const params = {
        category: null, description: null, color_code: '#1B3A6B', is_active: 1,
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO instruments (name, category, description, color_code, is_active)
        VALUES (@name, @category, @description, @color_code, @is_active)
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM instruments WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('instruments:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`
      UPDATE instruments SET
        name = @name, category = @category, description = @description,
        color_code = @color_code, is_active = @is_active
      WHERE id = @id
    `).run({ ...data, id })
    return db().prepare('SELECT * FROM instruments WHERE id = ?').get(id)
  })

  ipcMain.handle('instruments:delete', (_e, id: number) => {
    db().prepare('DELETE FROM instruments WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── ENROLLMENTS ──────────────────────────────────────────────────────────
  ipcMain.handle('enrollments:getAll', () => {
    return db().prepare(`
      SELECT e.*,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone AS student_phone,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      LEFT JOIN teachers t ON e.teacher_id = t.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      ORDER BY e.created_at DESC LIMIT 5000
    `).all()
  })

  ipcMain.handle('enrollments:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT e.*,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM enrollments e
      LEFT JOIN teachers t ON e.teacher_id = t.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE e.student_id = ?
      ORDER BY e.start_date DESC
    `).all(studentId)
  })

  ipcMain.handle('enrollments:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT e.*,
        s.first_name || ' ' || s.last_name AS student_name,
        i.name AS instrument_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE e.teacher_id = ? AND e.status = 'active'
      ORDER BY e.lesson_time
    `).all(teacherId)
  })

  ipcMain.handle('enrollments:create', (_e, data: unknown) => {
    try {
      const validated = validate(EnrollmentCreateSchema, data)
      const params = {
        teacher_id: null, instrument_id: null, end_date: null,
        lesson_time: null, notes: null, lesson_days: '[]',
        lesson_type: 'individual', lesson_duration: 45, lessons_per_week: 1,
        monthly_fee: 0, start_date: new Date().toISOString().split('T')[0], status: 'active',
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO enrollments (
          student_id, teacher_id, instrument_id,
          lesson_type, lesson_duration, lessons_per_week,
          lesson_days, lesson_time, monthly_fee,
          start_date, end_date, status, notes
        ) VALUES (
          @student_id, @teacher_id, @instrument_id,
          @lesson_type, @lesson_duration, @lessons_per_week,
          @lesson_days, @lesson_time, @monthly_fee,
          @start_date, @end_date, @status, @notes
        )
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM enrollments WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('enrollments:update', (_e, id: number, data: unknown) => {
    try {
      const validated = validate(EnrollmentUpdateSchema, data)
      const today = new Date().toISOString().split('T')[0]
      db().transaction(() => {
        db().prepare(`
          UPDATE enrollments SET
            teacher_id = @teacher_id, instrument_id = @instrument_id,
            lesson_type = @lesson_type, lesson_duration = @lesson_duration,
            lessons_per_week = @lessons_per_week, lesson_days = @lesson_days,
            lesson_time = @lesson_time, monthly_fee = @monthly_fee,
            start_date = @start_date, end_date = @end_date,
            status = @status, notes = @notes
          WHERE id = @id
        `).run({ ...validated, id })
        // Bugün ve sonrasındaki henüz tamamlanmamış dersleri yeni öğretmenle güncelle
        db().prepare(`
          UPDATE lessons SET teacher_id = @teacher_id
          WHERE enrollment_id = @id
            AND lesson_date >= @today
            AND status NOT IN ('completed', 'cancelled', 'makeup')
        `).run({ teacher_id: validated.teacher_id ?? null, id, today })
      })()
      return db().prepare('SELECT * FROM enrollments WHERE id = ?').get(id)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('enrollments:delete', (_e, id: number) => {
    db().prepare('DELETE FROM enrollments WHERE id = ?').run(id)
    return { success: true }
  })
}
