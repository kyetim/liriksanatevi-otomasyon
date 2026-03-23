import { ipcMain, dialog, app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../../db/database'

export function registerHrHandlers(): void {
  const db = () => getDatabase()

  // ─── HR: SALARY CONFIGS ───────────────────────────────────────────────────

  ipcMain.handle('salary_configs:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(
      'SELECT * FROM teacher_salary_configs WHERE teacher_id = ? ORDER BY effective_from DESC LIMIT 1'
    ).get(teacherId)
  })

  ipcMain.handle('salary_configs:upsert', (_e, data: Record<string, unknown>) => {
    // Önce mevcut config'i sil, sonra yenisini ekle
    db().prepare('DELETE FROM teacher_salary_configs WHERE teacher_id = ?').run(data.teacher_id)
    const params = {
      base_salary: 0, per_lesson_rate: 0, percentage_rate: 0,
      effective_from: new Date().toISOString().split('T')[0], notes: null,
      ...data
    }
    const result = db().prepare(`
      INSERT INTO teacher_salary_configs (
        teacher_id, salary_type, base_salary, per_lesson_rate, percentage_rate, effective_from, notes
      ) VALUES (
        @teacher_id, @salary_type, @base_salary, @per_lesson_rate, @percentage_rate, @effective_from, @notes
      )
    `).run(params)
    return db().prepare('SELECT * FROM teacher_salary_configs WHERE id = ?').get(result.lastInsertRowid)
  })

  // ─── HR: PAYROLLS ─────────────────────────────────────────────────────────

  ipcMain.handle('payrolls:getByMonth', (_e, year: number, month: number) => {
    return db().prepare(`
      SELECT mp.*, t.first_name || ' ' || t.last_name AS teacher_name, t.iban
      FROM monthly_payrolls mp
      JOIN teachers t ON t.id = mp.teacher_id
      WHERE mp.year = ? AND mp.month = ?
      ORDER BY t.last_name, t.first_name
    `).all(year, month)
  })

  ipcMain.handle('payrolls:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT * FROM monthly_payrolls WHERE teacher_id = ?
      ORDER BY year DESC, month DESC
    `).all(teacherId)
  })

  ipcMain.handle('payrolls:calculate', (_e, teacherId: number, year: number, month: number) => {
    const calcTx = db().transaction(() => {
      const teacher = db().prepare('SELECT * FROM teachers WHERE id = ?').get(teacherId) as Record<string, unknown>
      if (!teacher) throw new Error('Öğretmen bulunamadı')

      // Maaş konfigürasyonunu al (yoksa teachers tablosundan fallback)
      const cfg = db().prepare(
        'SELECT * FROM teacher_salary_configs WHERE teacher_id = ? ORDER BY effective_from DESC LIMIT 1'
      ).get(teacherId) as Record<string, number | string> | undefined

      const salaryType = (cfg?.salary_type ?? teacher.salary_type) as string
      const baseSalary = (cfg?.base_salary ?? (salaryType === 'fixed' ? teacher.salary_amount : 0)) as number
      const perLessonRate = (cfg?.per_lesson_rate ?? (salaryType === 'per_lesson' ? teacher.salary_amount : 0)) as number
      const percentageRate = (cfg?.percentage_rate ?? 0) as number

      // Ay başlangıç/bitiş tarihleri
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`
      const endDate = `${year}-${String(month).padStart(2,'0')}-31`

      // Tamamlanan dersleri say
      const lessonData = db().prepare(`
        SELECT COUNT(*) AS lesson_count,
               COALESCE(SUM(e.lesson_duration), 0) AS lesson_minutes
        FROM lessons l
        JOIN enrollments e ON e.id = l.enrollment_id
        WHERE l.teacher_id = ?
          AND l.lesson_date BETWEEN ? AND ?
          AND l.status = 'completed'
      `).get(teacherId, startDate, endDate) as { lesson_count: number; lesson_minutes: number }

      const lessonCount = lessonData.lesson_count
      const lessonMinutes = lessonData.lesson_minutes

      // Baz maaşı hesapla
      let baseAmount = 0
      if (salaryType === 'fixed') {
        baseAmount = baseSalary
      } else if (salaryType === 'per_lesson') {
        baseAmount = lessonCount * perLessonRate
      } else if (salaryType === 'hybrid') {
        baseAmount = baseSalary + lessonCount * perLessonRate
      } else if (salaryType === 'percentage') {
        // O ay bu öğretmenin öğrencilerinden gelen ödemelerin toplamı
        const revenueData = db().prepare(`
          SELECT COALESCE(SUM(p.total_amount), 0) AS total_revenue
          FROM payments p
          JOIN enrollments e ON e.id = p.enrollment_id
          WHERE e.teacher_id = ?
            AND p.period_year = ? AND p.period_month = ?
            AND p.status = 'paid'
        `).get(teacherId, year, month) as { total_revenue: number }
        baseAmount = revenueData.total_revenue * (percentageRate / 100)
      }

      // Primleri hesapla (bu ay için ve henüz bordro ID'si atanmamış)
      const bonusData = db().prepare(`
        SELECT COALESCE(SUM(amount), 0) AS bonus_total
        FROM teacher_bonuses
        WHERE teacher_id = ? AND year = ? AND month = ? AND payroll_id IS NULL
      `).get(teacherId, year, month) as { bonus_total: number }
      const bonusTotal = bonusData.bonus_total

      // Bekleyen avansları hesapla
      const advanceData = db().prepare(`
        SELECT COALESCE(SUM(amount), 0) AS advance_total
        FROM teacher_advances
        WHERE teacher_id = ? AND status = 'pending'
      `).get(teacherId) as { advance_total: number }
      const advanceDeduction = advanceData.advance_total

      const grossAmount = baseAmount + bonusTotal
      const netAmount = Math.max(0, grossAmount - advanceDeduction)

      // INSERT OR REPLACE (UNIQUE teacher_id + year + month)
      const result = db().prepare(`
        INSERT INTO monthly_payrolls (
          teacher_id, year, month, salary_type, lesson_count, lesson_minutes,
          base_amount, bonus_total, advance_deduction, gross_amount, net_amount, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft'
        )
        ON CONFLICT(teacher_id, year, month) DO UPDATE SET
          salary_type = excluded.salary_type,
          lesson_count = excluded.lesson_count,
          lesson_minutes = excluded.lesson_minutes,
          base_amount = excluded.base_amount,
          bonus_total = excluded.bonus_total,
          advance_deduction = excluded.advance_deduction,
          gross_amount = excluded.gross_amount,
          net_amount = excluded.net_amount,
          updated_at = datetime('now','localtime')
      `).run(teacherId, year, month, salaryType, lessonCount, lessonMinutes,
             baseAmount, bonusTotal, advanceDeduction, grossAmount, netAmount)

      // Oluşturulan/güncellenen bordroyu al
      const payroll = db().prepare(
        'SELECT * FROM monthly_payrolls WHERE teacher_id = ? AND year = ? AND month = ?'
      ).get(teacherId, year, month) as { id: number }

      // Primlerin payroll_id'sini güncelle
      if (bonusTotal > 0) {
        db().prepare(`
          UPDATE teacher_bonuses SET payroll_id = ?
          WHERE teacher_id = ? AND year = ? AND month = ? AND payroll_id IS NULL
        `).run(payroll.id, teacherId, year, month)
      }

      return { ...payroll, result }
    })
    return calcTx()
  })

  ipcMain.handle('payrolls:update', (_e, id: number, data: Record<string, unknown>) => {
    const params = { notes: null, ...data, id, updated_at: new Date().toISOString().replace('T',' ').slice(0,19) }
    db().prepare(`
      UPDATE monthly_payrolls SET
        status = @status, notes = @notes, updated_at = @updated_at
      WHERE id = @id
    `).run(params)
    return db().prepare('SELECT * FROM monthly_payrolls WHERE id = ?').get(id)
  })

  ipcMain.handle('payrolls:markPaid', (_e, id: number, data: Record<string, unknown>) => {
    const paidTx = db().transaction(() => {
      const payroll = db().prepare('SELECT * FROM monthly_payrolls WHERE id = ?').get(id) as Record<string, unknown>
      if (!payroll) throw new Error('Bordro bulunamadı')
      const params = { payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', ...data, id }
      db().prepare(`
        UPDATE monthly_payrolls SET
          status = 'paid', payment_date = @payment_date, payment_method = @payment_method,
          updated_at = datetime('now','localtime')
        WHERE id = @id
      `).run(params)
      // Bekleyen avansları bu bordroya bağla ve 'deducted' yap
      db().prepare(`
        UPDATE teacher_advances SET status = 'deducted', payroll_id = ?
        WHERE teacher_id = ? AND status = 'pending'
      `).run(id, payroll.teacher_id)
      return db().prepare('SELECT * FROM monthly_payrolls WHERE id = ?').get(id)
    })
    return paidTx()
  })

  ipcMain.handle('payrolls:delete', (_e, id: number) => {
    const payroll = db().prepare('SELECT * FROM monthly_payrolls WHERE id = ?').get(id) as Record<string, unknown>
    if (payroll?.status !== 'draft') throw new Error('Sadece taslak bordrolar silinebilir')
    db().prepare('DELETE FROM monthly_payrolls WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('payrolls:getPerformanceReport', (_e, year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate   = `${year}-${String(month).padStart(2,'0')}-31`
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`
    const prevEnd   = `${prevYear}-${String(prevMonth).padStart(2,'0')}-31`

    const teachers = db().prepare(
      `SELECT id, first_name || ' ' || last_name AS teacher_name FROM teachers WHERE status='active'`
    ).all() as { id: number; teacher_name: string }[]

    return teachers.map(t => {
      const lessonStats = db().prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status='teacher_absent' THEN 1 ELSE 0 END) AS teacher_absent,
          SUM(CASE WHEN status='student_absent' THEN 1 ELSE 0 END) AS student_absent
        FROM lessons WHERE teacher_id = ? AND lesson_date BETWEEN ? AND ?
      `).get(t.id, startDate, endDate) as { total: number; completed: number; teacher_absent: number; student_absent: number }

      const total = lessonStats.total || 1
      const cancelRate = Math.round((lessonStats.teacher_absent / total) * 100)
      const absentRate = Math.round((lessonStats.student_absent / total) * 100)

      const surveyData = db().prepare(`
        SELECT COALESCE(AVG(score), 0) AS avg_score
        FROM teacher_surveys WHERE teacher_id = ? AND year = ? AND month = ?
      `).get(t.id, year, month) as { avg_score: number }

      const activeStudents = (db().prepare(`
        SELECT COUNT(DISTINCT student_id) AS cnt FROM enrollments
        WHERE teacher_id = ? AND status = 'active'
      `).get(t.id) as { cnt: number }).cnt

      const prevActive = (db().prepare(`
        SELECT COUNT(DISTINCT e.student_id) AS cnt FROM enrollments e
        JOIN lessons l ON l.enrollment_id = e.id
        WHERE l.teacher_id = ? AND l.lesson_date BETWEEN ? AND ?
      `).get(t.id, prevStart, prevEnd) as { cnt: number }).cnt

      const payroll = db().prepare(
        'SELECT net_amount FROM monthly_payrolls WHERE teacher_id = ? AND year = ? AND month = ?'
      ).get(t.id, year, month) as { net_amount: number } | undefined

      return {
        teacher_id: t.id,
        teacher_name: t.teacher_name,
        lesson_count: lessonStats.completed,
        lesson_minutes: 0,
        cancel_rate: cancelRate,
        student_absent_rate: absentRate,
        avg_satisfaction: Math.round(surveyData.avg_score * 10) / 10,
        active_students: activeStudents,
        prev_active_students: prevActive,
        trend: activeStudents - prevActive,
        net_salary: payroll?.net_amount ?? 0
      }
    })
  })

  // ─── HR: ADVANCES ─────────────────────────────────────────────────────────

  ipcMain.handle('advances:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT a.*, t.first_name || ' ' || t.last_name AS teacher_name
      FROM teacher_advances a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.teacher_id = ? ORDER BY a.advance_date DESC
    `).all(teacherId)
  })

  ipcMain.handle('advances:getAll', (_e, year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate   = `${year}-${String(month).padStart(2,'0')}-31`
    return db().prepare(`
      SELECT a.*, t.first_name || ' ' || t.last_name AS teacher_name
      FROM teacher_advances a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.advance_date BETWEEN ? AND ?
      ORDER BY a.advance_date DESC
    `).all(startDate, endDate)
  })

  ipcMain.handle('advances:create', (_e, data: Record<string, unknown>) => {
    const params = {
      advance_date: new Date().toISOString().split('T')[0],
      description: null, ...data
    }
    const result = db().prepare(`
      INSERT INTO teacher_advances (teacher_id, amount, advance_date, description)
      VALUES (@teacher_id, @amount, @advance_date, @description)
    `).run(params)
    return db().prepare('SELECT * FROM teacher_advances WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('advances:cancel', (_e, id: number) => {
    const adv = db().prepare('SELECT * FROM teacher_advances WHERE id = ?').get(id) as Record<string, unknown>
    if (adv?.status !== 'pending') throw new Error('Sadece bekleyen avanslar iptal edilebilir')
    db().prepare(`UPDATE teacher_advances SET status = 'cancelled' WHERE id = ?`).run(id)
    return { success: true }
  })

  // ─── HR: BONUSES ──────────────────────────────────────────────────────────

  ipcMain.handle('bonuses:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT * FROM teacher_bonuses WHERE teacher_id = ? ORDER BY created_at DESC
    `).all(teacherId)
  })

  ipcMain.handle('bonuses:getAll', (_e, year: number, month: number) => {
    return db().prepare(`
      SELECT b.*, t.first_name || ' ' || t.last_name AS teacher_name
      FROM teacher_bonuses b
      JOIN teachers t ON t.id = b.teacher_id
      WHERE b.year = ? AND b.month = ?
      ORDER BY b.created_at DESC
    `).all(year, month)
  })

  ipcMain.handle('bonuses:create', (_e, data: Record<string, unknown>) => {
    const now = new Date()
    const params = {
      bonus_type: 'manual', reason: null,
      year: now.getFullYear(), month: now.getMonth() + 1,
      payroll_id: null, ...data
    }
    const result = db().prepare(`
      INSERT INTO teacher_bonuses (teacher_id, payroll_id, bonus_type, amount, reason, year, month)
      VALUES (@teacher_id, @payroll_id, @bonus_type, @amount, @reason, @year, @month)
    `).run(params)
    return db().prepare('SELECT * FROM teacher_bonuses WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('bonuses:delete', (_e, id: number) => {
    const bonus = db().prepare('SELECT * FROM teacher_bonuses WHERE id = ?').get(id) as Record<string, unknown>
    if (bonus?.payroll_id) throw new Error('Bordroya bağlı primler silinemez')
    db().prepare('DELETE FROM teacher_bonuses WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── HR: LEAVES ───────────────────────────────────────────────────────────

  ipcMain.handle('leaves:getAll', (_e, filters: Record<string, unknown> = {}) => {
    let sql = `
      SELECT l.*, t.first_name || ' ' || t.last_name AS teacher_name
      FROM leave_requests l
      JOIN teachers t ON t.id = l.teacher_id
      WHERE 1=1
    `
    const args: unknown[] = []
    if (filters.status) { sql += ' AND l.status = ?'; args.push(filters.status) }
    if (filters.teacher_id) { sql += ' AND l.teacher_id = ?'; args.push(filters.teacher_id) }
    sql += ' ORDER BY l.start_date DESC'
    return db().prepare(sql).all(...args)
  })

  ipcMain.handle('leaves:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT * FROM leave_requests WHERE teacher_id = ? ORDER BY start_date DESC
    `).all(teacherId)
  })

  ipcMain.handle('leaves:create', (_e, data: Record<string, unknown>) => {
    const leaveTx = db().transaction(() => {
      const params = { reason: null, notes: null, ...data }
      const result = db().prepare(`
        INSERT INTO leave_requests (teacher_id, leave_type, start_date, end_date, days_count, reason, notes)
        VALUES (@teacher_id, @leave_type, @start_date, @end_date, @days_count, @reason, @notes)
      `).run(params)
      // Yıllık izin ise bakiyeyi güncelle (istek pending olduğu için henüz düşme, ön rezervasyon gibi)
      return db().prepare('SELECT * FROM leave_requests WHERE id = ?').get(result.lastInsertRowid)
    })
    return leaveTx()
  })

  ipcMain.handle('leaves:approve', (_e, id: number, approvedBy: string) => {
    const approveTx = db().transaction(() => {
      const leave = db().prepare('SELECT * FROM leave_requests WHERE id = ?').get(id) as Record<string, unknown>
      if (!leave) throw new Error('İzin talebi bulunamadı')
      const now = new Date().toISOString().replace('T',' ').slice(0,19)
      db().prepare(`
        UPDATE leave_requests SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?
      `).run(approvedBy || 'Yönetici', now, id)
      // Yıllık izin ise bakiyeyi düş
      if (leave.leave_type === 'annual') {
        const year = new Date(leave.start_date as string).getFullYear()
        // Bakiye yoksa oluştur
        db().prepare(`
          INSERT OR IGNORE INTO leave_balances (teacher_id, year, total_days, used_days)
          VALUES (?, ?, 14, 0)
        `).run(leave.teacher_id, year)
        db().prepare(`
          UPDATE leave_balances SET used_days = used_days + ?
          WHERE teacher_id = ? AND year = ?
        `).run(leave.days_count, leave.teacher_id, year)
      }
      return db().prepare('SELECT * FROM leave_requests WHERE id = ?').get(id)
    })
    return approveTx()
  })

  ipcMain.handle('leaves:reject', (_e, id: number) => {
    db().prepare(`UPDATE leave_requests SET status = 'rejected' WHERE id = ?`).run(id)
    return db().prepare('SELECT * FROM leave_requests WHERE id = ?').get(id)
  })

  ipcMain.handle('leaves:getCalendar', (_e, year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate   = `${year}-${String(month).padStart(2,'0')}-31`
    return db().prepare(`
      SELECT l.*, t.first_name || ' ' || t.last_name AS teacher_name
      FROM leave_requests l
      JOIN teachers t ON t.id = l.teacher_id
      WHERE l.status = 'approved'
        AND l.start_date <= ? AND l.end_date >= ?
      ORDER BY l.start_date
    `).all(endDate, startDate)
  })

  // ─── HR: LEAVE BALANCES ───────────────────────────────────────────────────

  ipcMain.handle('leave_balances:getByTeacher', (_e, teacherId: number, year: number) => {
    // Yoksa otomatik oluştur
    db().prepare(`
      INSERT OR IGNORE INTO leave_balances (teacher_id, year, total_days, used_days)
      VALUES (?, ?, 14, 0)
    `).run(teacherId, year)
    return db().prepare(
      'SELECT * FROM leave_balances WHERE teacher_id = ? AND year = ?'
    ).get(teacherId, year)
  })

  ipcMain.handle('leave_balances:update', (_e, id: number, totalDays: number) => {
    db().prepare('UPDATE leave_balances SET total_days = ? WHERE id = ?').run(totalDays, id)
    return db().prepare('SELECT * FROM leave_balances WHERE id = ?').get(id)
  })

  // ─── HR: TEACHER DOCUMENTS ────────────────────────────────────────────────

  ipcMain.handle('teacher_documents:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(
      'SELECT * FROM teacher_documents WHERE teacher_id = ? ORDER BY upload_date DESC'
    ).all(teacherId)
  })

  ipcMain.handle('teacher_documents:upload', async (_e, teacherId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Belge Seç',
      filters: [
        { name: 'Belgeler', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
        { name: 'Tüm Dosyalar', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null

    const sourcePath = result.filePaths[0]
    const fileName = path.basename(sourcePath)
    const destDir = path.join(app.getPath('userData'), 'teacher_docs', String(teacherId))
    fs.mkdirSync(destDir, { recursive: true })
    // Dosya adı çakışmalarını önlemek için timestamp ekle
    const destName = `${Date.now()}_${fileName}`
    const destPath = path.join(destDir, destName)
    fs.copyFileSync(sourcePath, destPath)
    return { file_path: destPath, file_name: fileName }
  })

  ipcMain.handle('teacher_documents:create', (_e, data: Record<string, unknown>) => {
    const params = { notes: null, upload_date: new Date().toISOString().split('T')[0], ...data }
    const result = db().prepare(`
      INSERT INTO teacher_documents (teacher_id, doc_type, title, file_path, file_name, upload_date, notes)
      VALUES (@teacher_id, @doc_type, @title, @file_path, @file_name, @upload_date, @notes)
    `).run(params)
    return db().prepare('SELECT * FROM teacher_documents WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('teacher_documents:open', async (_e, filePath: string) => {
    await shell.openPath(filePath)
    return { success: true }
  })

  ipcMain.handle('teacher_documents:delete', (_e, id: number) => {
    const doc = db().prepare('SELECT * FROM teacher_documents WHERE id = ?').get(id) as Record<string, unknown>
    if (doc) {
      try { fs.unlinkSync(doc.file_path as string) } catch { /* dosya yoksa geç */ }
      db().prepare('DELETE FROM teacher_documents WHERE id = ?').run(id)
    }
    return { success: true }
  })

  // ─── HR: SURVEYS ──────────────────────────────────────────────────────────

  ipcMain.handle('surveys:getByTeacher', (_e, teacherId: number) => {
    return db().prepare(`
      SELECT s.*, st.first_name || ' ' || st.last_name AS student_name
      FROM teacher_surveys s
      LEFT JOIN students st ON st.id = s.student_id
      WHERE s.teacher_id = ?
      ORDER BY s.year DESC, s.month DESC
    `).all(teacherId)
  })

  ipcMain.handle('surveys:getMonthly', (_e, year: number, month: number) => {
    return db().prepare(`
      SELECT teacher_id, AVG(score) AS avg_score, COUNT(*) AS response_count
      FROM teacher_surveys WHERE year = ? AND month = ?
      GROUP BY teacher_id
    `).all(year, month)
  })

  ipcMain.handle('surveys:create', (_e, data: Record<string, unknown>) => {
    const now = new Date()
    const params = {
      student_id: null, feedback: null,
      year: now.getFullYear(), month: now.getMonth() + 1,
      ...data
    }
    const result = db().prepare(`
      INSERT INTO teacher_surveys (teacher_id, student_id, year, month, score, feedback)
      VALUES (@teacher_id, @student_id, @year, @month, @score, @feedback)
    `).run(params)
    return db().prepare('SELECT * FROM teacher_surveys WHERE id = ?').get(result.lastInsertRowid)
  })
}
