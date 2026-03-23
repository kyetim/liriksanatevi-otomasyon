import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../../db/database'
import { validate, StudentCreateSchema, StudentUpdateSchema } from '../../validation/schemas'

export function registerStudentHandlers(): void {
  const db = () => getDatabase()

  // ─── STUDENTS ─────────────────────────────────────────────────────────────
  ipcMain.handle('students:getAll', () => {
    return db().prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active')
          AS active_enrollments,
        (SELECT COALESCE(SUM(e2.monthly_fee),0) FROM enrollments e2 WHERE e2.student_id = s.id AND e2.status = 'active')
          AS total_monthly_fee,
        (SELECT MAX(p.payment_date) FROM payments p WHERE p.student_id = s.id)
          AS last_payment_date,
        (rs.first_name || ' ' || rs.last_name) AS referred_by_name
      FROM students s
      LEFT JOIN students rs ON rs.id = s.referred_by_student_id
      ORDER BY s.first_name, s.last_name LIMIT 5000
    `).all()
  })

  ipcMain.handle('students:uploadPhoto', async (_e, studentId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Fotoğraf Seç',
      filters: [{ name: 'Görseller', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const sourcePath = result.filePaths[0]
    const ext = path.extname(sourcePath)
    const destDir = path.join(app.getPath('userData'), 'student_photos', String(studentId))
    fs.mkdirSync(destDir, { recursive: true })
    const destFile = path.join(destDir, `photo_${Date.now()}${ext}`)
    fs.copyFileSync(sourcePath, destFile)
    db().prepare("UPDATE students SET photo_path = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(destFile, studentId)
    return destFile
  })

  ipcMain.handle('students:getById', (_e, id: number) => {
    return db().prepare('SELECT * FROM students WHERE id = ?').get(id)
  })

  ipcMain.handle('students:search', (_e, query: string) => {
    const q = `%${query}%`
    return db().prepare(`
      SELECT * FROM students
      WHERE first_name LIKE ? OR last_name LIKE ?
         OR phone LIKE ? OR parent_phone LIKE ? OR email LIKE ?
      ORDER BY first_name, last_name
    `).all(q, q, q, q, q)
  })

  ipcMain.handle('students:create', (_e, data: unknown) => {
    try {
      const validated = validate(StudentCreateSchema, data)
      const params = {
        birth_date: null, gender: null, phone: null, email: null,
        address: null, city: null, parent_name: null, parent_phone: null,
        parent_email: null, photo_path: null, notes: null,
        registration_date: new Date().toISOString().split('T')[0],
        status: 'active', discount_rate: 0,
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO students (
          first_name, last_name, birth_date, gender,
          phone, email, address, city,
          parent_name, parent_phone, parent_email,
          photo_path, registration_date, status,
          notes, discount_rate
        ) VALUES (
          @first_name, @last_name, @birth_date, @gender,
          @phone, @email, @address, @city,
          @parent_name, @parent_phone, @parent_email,
          @photo_path, @registration_date, @status,
          @notes, @discount_rate
        )
      `)
      const result = stmt.run(params)
      return db().prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('students:update', (_e, id: number, data: unknown) => {
    try {
      const validated = validate(StudentUpdateSchema, data)
      const params = {
        birth_date: null, gender: null, phone: null, email: null,
        address: null, city: null, parent_name: null, parent_phone: null,
        parent_email: null, photo_path: null, notes: null,
        referral_source: null, referred_by_student_id: null, parent_profile_id: null,
        ...validated, id
      }
      db().prepare(`
        UPDATE students SET
          first_name = @first_name, last_name = @last_name,
          birth_date = @birth_date, gender = @gender,
          phone = @phone, email = @email,
          address = @address, city = @city,
          parent_name = @parent_name, parent_phone = @parent_phone,
          parent_email = @parent_email, photo_path = @photo_path,
          status = @status, notes = @notes,
          discount_rate = @discount_rate,
          referral_source = @referral_source,
          referred_by_student_id = @referred_by_student_id,
          parent_profile_id = @parent_profile_id
        WHERE id = @id
      `).run(params)
      return db().prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active') AS active_enrollments,
          (rs.first_name || ' ' || rs.last_name) AS referred_by_name
        FROM students s
        LEFT JOIN students rs ON rs.id = s.referred_by_student_id
        WHERE s.id = ?
      `).get(id)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('students:setStatus', (_e, id: number, status: string) => {
    try {
      const tx = db().transaction(() => {
        db().prepare('UPDATE students SET status = ? WHERE id = ?').run(status, id)
        // Pasife alınırken aktif kayıtları durdur; yeniden aktife alınırken dokunma
        if (status === 'passive') {
          db().prepare(`UPDATE enrollments SET status = 'inactive' WHERE student_id = ? AND status = 'active'`).run(id)
        }
      })
      tx()
      return { success: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('students:delete', (_e, id: number) => {
    try {
      db().prepare('DELETE FROM students WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  // ─── STUDENT PROGRESS ─────────────────────────────────────────────────────
  ipcMain.handle('progress:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT p.*,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name
      FROM student_progress p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      LEFT JOIN instruments i ON p.instrument_id = i.id
      WHERE p.student_id = ?
      ORDER BY p.assessment_date DESC
    `).all(studentId)
  })

  ipcMain.handle('progress:create', (_e, data: Record<string, unknown>) => {
    try {
      if (!data.student_id) return { error: 'student_id zorunlu' }
      const params = {
        teacher_id: null, instrument_id: null,
        technical_score: null, theory_score: null, practice_score: null, performance_score: null,
        current_level: null, current_piece: null, notes: null, goals: null,
        assessment_date: new Date().toISOString().split('T')[0],
        ...data
      }
      const result = db().prepare(`
        INSERT INTO student_progress (
          student_id, teacher_id, instrument_id, assessment_date,
          technical_score, theory_score, practice_score, performance_score,
          current_level, current_piece, notes, goals
        ) VALUES (
          @student_id, @teacher_id, @instrument_id, @assessment_date,
          @technical_score, @theory_score, @practice_score, @performance_score,
          @current_level, @current_piece, @notes, @goals
        )
      `).run(params)
      return db().prepare('SELECT * FROM student_progress WHERE id = ?').get(result.lastInsertRowid)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('progress:delete', (_e, id: number) => {
    try {
      db().prepare('DELETE FROM student_progress WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  // ─── STUDENT FREEZES ──────────────────────────────────────────────────────

  ipcMain.handle('student_freezes:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT * FROM student_freezes
      WHERE student_id = ?
      ORDER BY created_at DESC
    `).all(studentId)
  })

  ipcMain.handle('student_freezes:create', (_e, data: Record<string, unknown>) => {
    const freezeTx = db().transaction(() => {
      const params = {
        freeze_end: null, notes: null, extend_payment_plans: 1, status: 'active',
        ...data
      } as Record<string, unknown>
      const result = db().prepare(`
        INSERT INTO student_freezes (
          student_id, freeze_start, freeze_end, reason,
          extend_payment_plans, notes, status
        ) VALUES (
          @student_id, @freeze_start, @freeze_end, @reason,
          @extend_payment_plans, @notes, @status
        )
      `).run(params)
      const freezeId = result.lastInsertRowid as number

      // Mevcut öğrenci statusunu kaydet
      const student = db().prepare('SELECT status FROM students WHERE id = ?').get(params.student_id) as { status: string }
      const oldStatus = student?.status || 'active'

      // Öğrenci statusunu frozen yap
      db().prepare(`UPDATE students SET status = 'frozen' WHERE id = ?`).run(params.student_id)

      // Durum tarihçesi kaydı
      db().prepare(`
        INSERT INTO student_status_history (student_id, old_status, new_status, reason)
        VALUES (?, ?, 'frozen', ?)
      `).run(params.student_id, oldStatus, params.reason)

      // Taksit planı tarihlerini ötele (extend_payment_plans = 1 ve freeze_end belirlenmişse)
      if (params.extend_payment_plans && params.freeze_end && params.freeze_start) {
        const startDate = new Date(params.freeze_start as string)
        const endDate = new Date(params.freeze_end as string)
        const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 0) {
          db().prepare(`
            UPDATE payment_plan_items
            SET due_date = date(due_date, '+' || ? || ' days')
            WHERE plan_id IN (
              SELECT id FROM payment_plans WHERE student_id = ? AND status = 'active'
            ) AND status IN ('pending','overdue')
          `).run(diffDays, params.student_id)
        }
      }

      return db().prepare('SELECT * FROM student_freezes WHERE id = ?').get(freezeId)
    })
    return freezeTx()
  })

  ipcMain.handle('student_freezes:end', (_e, freezeId: number) => {
    const endFreezeTx = db().transaction(() => {
      const freeze = db().prepare('SELECT * FROM student_freezes WHERE id = ?').get(freezeId) as { student_id: number; status: string }
      if (!freeze || freeze.status === 'ended') return { success: false, error: 'Geçersiz dondurma kaydı' }

      const today = new Date().toISOString().split('T')[0]
      db().prepare(`
        UPDATE student_freezes SET status = 'ended', freeze_end = ? WHERE id = ?
      `).run(today, freezeId)

      db().prepare(`UPDATE students SET status = 'active' WHERE id = ?`).run(freeze.student_id)

      db().prepare(`
        INSERT INTO student_status_history (student_id, old_status, new_status, reason)
        VALUES (?, 'frozen', 'active', 'Dondurma kaldırıldı')
      `).run(freeze.student_id)

      return { success: true }
    })
    return endFreezeTx()
  })

  // ─── STUDENT STATUS HISTORY ───────────────────────────────────────────────

  ipcMain.handle('student_status_history:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT * FROM student_status_history
      WHERE student_id = ?
      ORDER BY changed_at DESC
    `).all(studentId)
  })

  // ─── DEPARTURE RECORDS ────────────────────────────────────────────────────

  ipcMain.handle('departure_records:getAll', () => {
    return db().prepare(`
      SELECT d.*, (s.first_name || ' ' || s.last_name) AS student_name
      FROM departure_records d
      LEFT JOIN students s ON s.id = d.student_id
      ORDER BY d.departure_date DESC
    `).all()
  })

  ipcMain.handle('departure_records:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT * FROM departure_records WHERE student_id = ? ORDER BY created_at DESC
    `).all(studentId)
  })

  ipcMain.handle('departure_records:create', (_e, data: Record<string, unknown>) => {
    const departureTx = db().transaction(() => {
      const params = {
        reason_detail: null, would_return: 0, net_promoter_score: null,
        last_lesson_date: null, notes: null,
        ...data
      } as Record<string, unknown>
      const result = db().prepare(`
        INSERT INTO departure_records (
          student_id, departure_date, reason_category, reason_detail,
          would_return, net_promoter_score, last_lesson_date, notes
        ) VALUES (
          @student_id, @departure_date, @reason_category, @reason_detail,
          @would_return, @net_promoter_score, @last_lesson_date, @notes
        )
      `).run(params)

      const student = db().prepare('SELECT status FROM students WHERE id = ?').get(params.student_id) as { status: string }
      const oldStatus = student?.status || 'active'

      db().prepare(`UPDATE students SET status = 'passive' WHERE id = ?`).run(params.student_id)

      db().prepare(`
        INSERT INTO student_status_history (student_id, old_status, new_status, reason)
        VALUES (?, ?, 'passive', ?)
      `).run(params.student_id, oldStatus, `Ayrılış: ${params.reason_category}`)

      return db().prepare('SELECT * FROM departure_records WHERE id = ?').get(result.lastInsertRowid)
    })
    return departureTx()
  })

  // ─── STUDENTS: REFERRAL REPORT ────────────────────────────────────────────

  ipcMain.handle('students:getReferralReport', () => {
    return db().prepare(`
      SELECT
        s.id,
        s.first_name || ' ' || s.last_name AS referrer_name,
        s.phone,
        COUNT(r.id) AS referred_count,
        GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') AS referred_students
      FROM students s
      INNER JOIN students r ON r.referred_by_student_id = s.id
      GROUP BY s.id
      ORDER BY referred_count DESC
    `).all()
  })

  // ─── PRE-REGISTRATIONS ────────────────────────────────────────────────────

  ipcMain.handle('pre_registrations:getAll', () => {
    return db().prepare(`
      SELECT * FROM pre_registrations
      ORDER BY created_at DESC
    `).all()
  })

  ipcMain.handle('pre_registrations:create', (_e, data: Record<string, unknown>) => {
    const params = {
      birth_date: null, phone: null, email: null,
      parent_name: null, parent_phone: null,
      instrument_interest: null, availability: null,
      how_heard: null, notes: null, status: 'pending',
      contacted_at: null, converted_student_id: null,
      ...data
    }
    const result = db().prepare(`
      INSERT INTO pre_registrations (
        first_name, last_name, birth_date, phone, email,
        parent_name, parent_phone, instrument_interest, availability,
        how_heard, notes, status
      ) VALUES (
        @first_name, @last_name, @birth_date, @phone, @email,
        @parent_name, @parent_phone, @instrument_interest, @availability,
        @how_heard, @notes, @status
      )
    `).run(params)
    return db().prepare('SELECT * FROM pre_registrations WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('pre_registrations:update', (_e, id: number, data: Record<string, unknown>) => {
    const existing = db().prepare('SELECT * FROM pre_registrations WHERE id = ?').get(id) as Record<string, unknown>
    const params = { ...existing, ...data, id }
    db().prepare(`
      UPDATE pre_registrations SET
        first_name = @first_name, last_name = @last_name,
        birth_date = @birth_date, phone = @phone, email = @email,
        parent_name = @parent_name, parent_phone = @parent_phone,
        instrument_interest = @instrument_interest, availability = @availability,
        how_heard = @how_heard, notes = @notes, status = @status,
        contacted_at = @contacted_at, converted_student_id = @converted_student_id
      WHERE id = @id
    `).run(params)
    return db().prepare('SELECT * FROM pre_registrations WHERE id = ?').get(id)
  })

  ipcMain.handle('pre_registrations:convert', (_e, preRegId: number, studentData: Record<string, unknown>) => {
    const convertTx = db().transaction(() => {
      const sParams = {
        birth_date: null, gender: null, phone: null, email: null,
        address: null, city: null, parent_name: null, parent_phone: null,
        parent_email: null, photo_path: null, notes: null,
        registration_date: new Date().toISOString().split('T')[0],
        status: 'active', discount_rate: 0,
        referral_source: null, referred_by_student_id: null, parent_profile_id: null,
        ...studentData
      }
      const sResult = db().prepare(`
        INSERT INTO students (
          first_name, last_name, birth_date, gender,
          phone, email, address, city,
          parent_name, parent_phone, parent_email,
          photo_path, registration_date, status,
          notes, discount_rate, referral_source,
          referred_by_student_id, parent_profile_id
        ) VALUES (
          @first_name, @last_name, @birth_date, @gender,
          @phone, @email, @address, @city,
          @parent_name, @parent_phone, @parent_email,
          @photo_path, @registration_date, @status,
          @notes, @discount_rate, @referral_source,
          @referred_by_student_id, @parent_profile_id
        )
      `).run(sParams)
      const newStudentId = sResult.lastInsertRowid as number

      db().prepare(`
        UPDATE pre_registrations SET
          status = 'converted',
          converted_student_id = ?
        WHERE id = ?
      `).run(newStudentId, preRegId)

      db().prepare(`
        INSERT INTO student_status_history (student_id, old_status, new_status, reason)
        VALUES (?, NULL, 'active', 'Ön kayıttan dönüştürüldü')
      `).run(newStudentId)

      return db().prepare('SELECT * FROM students WHERE id = ?').get(newStudentId)
    })
    return convertTx()
  })

  ipcMain.handle('pre_registrations:delete', (_e, id: number) => {
    db().prepare('DELETE FROM pre_registrations WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── PARENT PROFILES ──────────────────────────────────────────────────────

  ipcMain.handle('parent_profiles:getAll', () => {
    return db().prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM students s WHERE s.parent_profile_id = p.id) AS student_count
      FROM parent_profiles p
      ORDER BY p.last_name, p.first_name
    `).all()
  })

  ipcMain.handle('parent_profiles:search', (_e, query: string) => {
    const q = `%${query}%`
    return db().prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM students s WHERE s.parent_profile_id = p.id) AS student_count
      FROM parent_profiles p
      WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?
      ORDER BY p.last_name, p.first_name
    `).all(q, q, q)
  })

  ipcMain.handle('parent_profiles:create', (_e, data: Record<string, unknown>) => {
    const params = {
      phone: null, phone2: null, email: null, address: null,
      occupation: null, sibling_discount_rate: 0, notes: null,
      ...data
    }
    const result = db().prepare(`
      INSERT INTO parent_profiles (
        first_name, last_name, phone, phone2, email,
        address, occupation, sibling_discount_rate, notes
      ) VALUES (
        @first_name, @last_name, @phone, @phone2, @email,
        @address, @occupation, @sibling_discount_rate, @notes
      )
    `).run(params)
    return db().prepare('SELECT * FROM parent_profiles WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('parent_profiles:update', (_e, id: number, data: Record<string, unknown>) => {
    const existing = db().prepare('SELECT * FROM parent_profiles WHERE id = ?').get(id) as Record<string, unknown>
    const params = { ...existing, ...data, id }
    db().prepare(`
      UPDATE parent_profiles SET
        first_name = @first_name, last_name = @last_name,
        phone = @phone, phone2 = @phone2, email = @email,
        address = @address, occupation = @occupation,
        sibling_discount_rate = @sibling_discount_rate, notes = @notes
      WHERE id = @id
    `).run(params)
    return db().prepare('SELECT * FROM parent_profiles WHERE id = ?').get(id)
  })

  ipcMain.handle('parent_profiles:getStudents', (_e, parentProfileId: number) => {
    return db().prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active') AS active_enrollments
      FROM students s
      WHERE s.parent_profile_id = ?
      ORDER BY s.first_name, s.last_name
    `).all(parentProfileId)
  })
}
