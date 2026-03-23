import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { validate, LessonCreateSchema } from '../../validation/schemas'

// ─── Cari Hesap Yardımcı Fonksiyonları ───────────────────────────────────────

type LedgerResult = { id: number; amount: number } | { error: string }

function createLessonDebt(
  db: ReturnType<typeof getDatabase>,
  lessonId: number,
  createdBy?: string
): LedgerResult {
  const lesson = db.prepare(`
    SELECT l.*, e.monthly_fee, e.lessons_per_week,
           COALESCE(e.lesson_pricing_type, 'monthly') AS lesson_pricing_type,
           COALESCE(e.per_lesson_fee, 0) AS per_lesson_fee,
           i.name AS instrument_name
    FROM lessons l
    JOIN enrollments e ON l.enrollment_id = e.id
    LEFT JOIN instruments i ON e.instrument_id = i.id
    WHERE l.id = ?
  `).get(lessonId) as Record<string, unknown> | undefined

  if (!lesson) return { error: 'Ders bulunamadı.' }

  // Çift kayıt kontrolü
  if (lesson.ledger_entry_id) {
    const existing = db.prepare(
      'SELECT status FROM student_ledger WHERE id = ?'
    ).get(lesson.ledger_entry_id) as { status: string } | undefined
    if (existing && existing.status !== 'cancelled')
      return { error: 'Bu derse ait borç kaydı zaten mevcut.' }
  }

  // Birim ücret hesaplama
  let fee = 0
  if (lesson.lesson_pricing_type === 'per_lesson') {
    fee = Number(lesson.per_lesson_fee) || 0
  } else {
    const wRow = db.prepare(
      "SELECT value FROM settings WHERE key = 'ledger_lesson_weeks'"
    ).get() as { value: string } | undefined
    const weeks = wRow ? Number(JSON.parse(wRow.value)) : 4
    const perMonth = Math.max(1, Number(lesson.lessons_per_week || 1) * weeks)
    fee = Math.round((Number(lesson.monthly_fee) / perMonth) * 100) / 100
  }

  const timeStr = lesson.start_time ? ` ${lesson.start_time}` : ''
  const description = `${lesson.instrument_name || 'Ders'} dersi — ${lesson.lesson_date}${timeStr}`

  const result = db.prepare(`
    INSERT INTO student_ledger
      (student_id, transaction_type, debt_amount, credit_amount,
       lesson_id, enrollment_id, description, status, transaction_date, created_by)
    VALUES
      (@student_id, 'lesson_debt', @fee, 0,
       @lesson_id, @enrollment_id, @description, 'open', @lesson_date, @created_by)
  `).run({
    student_id: lesson.student_id,
    fee,
    lesson_id: lessonId,
    enrollment_id: lesson.enrollment_id,
    description,
    lesson_date: lesson.lesson_date,
    created_by: createdBy ?? null
  })

  const entryId = Number(result.lastInsertRowid)
  db.prepare('UPDATE lessons SET lesson_fee = ?, ledger_entry_id = ? WHERE id = ?')
    .run(fee, entryId, lessonId)

  return { id: entryId, amount: fee }
}

function cancelLessonDebt(
  db: ReturnType<typeof getDatabase>,
  lessonId: number
): void {
  const row = db.prepare(
    'SELECT ledger_entry_id FROM lessons WHERE id = ?'
  ).get(lessonId) as { ledger_entry_id: number | null } | undefined
  if (row?.ledger_entry_id) {
    db.prepare("UPDATE student_ledger SET status = 'cancelled' WHERE id = ?")
      .run(row.ledger_entry_id)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function registerLessonHandlers(): void {
  const db = () => getDatabase()

  // ─── LESSONS ──────────────────────────────────────────────────────────────
  ipcMain.handle('lessons:getByDate', (_e, date: string) => {
    return db().prepare(`
      SELECT l.*,
        s.first_name || ' ' || s.last_name AS student_name,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM lessons l
      JOIN students s ON l.student_id = s.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.lesson_date = ?
      ORDER BY l.start_time
    `).all(date)
  })

  ipcMain.handle('lessons:getByStudent', (_e, studentId: number) => {
    return db().prepare(`
      SELECT l.*,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name
      FROM lessons l
      LEFT JOIN teachers t ON l.teacher_id = t.id
      JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.student_id = ?
      ORDER BY l.lesson_date DESC, l.start_time DESC LIMIT 500
    `).all(studentId)
  })

  ipcMain.handle('lessons:getByEnrollment', (_e, enrollmentId: number) => {
    return db().prepare(`
      SELECT * FROM lessons
      WHERE enrollment_id = ?
        AND lesson_date <= date('now')
        AND confirmation_status != 'pending'
      ORDER BY lesson_date DESC
    `).all(enrollmentId)
  })

  ipcMain.handle('lessons:create', (_e, data: unknown) => {
    try {
      const validated = validate(LessonCreateSchema, data)
      const params = {
        teacher_id: null, start_time: null, end_time: null,
        topic_covered: null, homework: null, teacher_notes: null, makeup_lesson_id: null,
        status: 'completed',
        ...validated
      }
      const stmt = db().prepare(`
        INSERT INTO lessons (
          enrollment_id, student_id, teacher_id,
          lesson_date, start_time, end_time, status,
          topic_covered, homework, teacher_notes, makeup_lesson_id
        ) VALUES (
          @enrollment_id, @student_id, @teacher_id,
          @lesson_date, @start_time, @end_time, @status,
          @topic_covered, @homework, @teacher_notes, @makeup_lesson_id
        )
      `)
      const result = stmt.run(params)
      const lessonId = Number(result.lastInsertRowid)
      // Tamamlandı olarak oluşturulduysa otomatik borç kaydı
      if (params.status === 'completed') {
        createLessonDebt(db(), lessonId)
      }
      return db().prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('lessons:update', (_e, id: number, data: Record<string, unknown>) => {
    // Mevcut kaydı çek, sadece gönderilen alanları güncelle
    const existing = db().prepare('SELECT * FROM lessons WHERE id = ?').get(id) as Record<string, unknown>
    const merged = { ...existing, ...data, id }
    db().prepare(`
      UPDATE lessons SET
        lesson_date = @lesson_date, start_time = @start_time, end_time = @end_time,
        status = @status, topic_covered = @topic_covered,
        homework = @homework, teacher_notes = @teacher_notes
      WHERE id = @id
    `).run(merged)
    return db().prepare('SELECT * FROM lessons WHERE id = ?').get(id)
  })

  ipcMain.handle('lessons:delete', (_e, id: number) => {
    db().prepare('DELETE FROM lessons WHERE id = ?').run(id)
    return { success: true }
  })

  // ── Ders durum değişimi + otomatik cari borç ──────────────────────────────
  ipcMain.handle('lessons:updateStatus', (_e, id: number, status: string) => {
    const existing = db().prepare(
      'SELECT status FROM lessons WHERE id = ?'
    ).get(id) as { status: string } | undefined
    if (!existing) return { error: 'Ders bulunamadı.' }

    db().prepare('UPDATE lessons SET status = ? WHERE id = ?').run(status, id)

    let ledgerAmount: number | undefined
    let ledgerError: string | undefined

    if (status === 'completed') {
      const r = createLessonDebt(db(), id)
      if ('error' in r) ledgerError = r.error
      else ledgerAmount = r.amount

    } else if (status === 'student_absent') {
      const row = db().prepare(
        "SELECT value FROM settings WHERE key = 'charge_absent_student'"
      ).get() as { value: string } | undefined
      const charge = row ? JSON.parse(row.value) !== false : true
      if (charge) {
        const r = createLessonDebt(db(), id)
        if ('error' in r) ledgerError = r.error
        else ledgerAmount = r.amount
      } else {
        cancelLessonDebt(db(), id)
      }

    } else if (status === 'cancelled' || status === 'teacher_absent') {
      cancelLessonDebt(db(), id)
    }

    const lesson = db().prepare('SELECT * FROM lessons WHERE id = ?').get(id)
    return { lesson, ledgerAmount, ledgerError }
  })

  // ── Tüm günü kapat (bulk complete + cari borç) ────────────────────────────
  ipcMain.handle('lessons:completeDay', (_e, date: string) => {
    // Henüz cari kaydı olmayan ve iptal/öğretmen devamsızlık değil tüm dersler
    const toProcess = db().prepare(`
      SELECT id FROM lessons
      WHERE lesson_date = ?
        AND status NOT IN ('cancelled','teacher_absent')
        AND ledger_entry_id IS NULL
    `).all(date) as { id: number }[]

    let count = 0
    let totalAmount = 0

    const bulkComplete = db().transaction(() => {
      for (const { id } of toProcess) {
        db().prepare("UPDATE lessons SET status = 'completed' WHERE id = ?").run(id)
        const r = createLessonDebt(db(), id)
        if (!('error' in r)) {
          count++
          totalAmount = Math.round((totalAmount + r.amount) * 100) / 100
        }
      }
    })
    bulkComplete()

    return { count, totalAmount }
  })

  // Toplu yoklama kaydı (bir güne ait tüm aktif kayıtları oluştur)
  ipcMain.handle('lessons:bulkCreateForDate', (_e, date: string) => {
    const activeEnrollments = db().prepare(`
      SELECT e.id, e.student_id, e.teacher_id, e.lesson_time, e.lesson_duration
      FROM enrollments e
      WHERE e.status = 'active'
    `).all() as any[]

    const insertLesson = db().prepare(`
      INSERT OR IGNORE INTO lessons (enrollment_id, student_id, teacher_id, lesson_date, start_time, status)
      VALUES (@enrollment_id, @student_id, @teacher_id, @lesson_date, @start_time, 'completed')
    `)

    const bulk = db().transaction(() => {
      for (const e of activeEnrollments) {
        insertLesson.run({
          enrollment_id: e.id,
          student_id: e.student_id,
          teacher_id: e.teacher_id,
          lesson_date: date,
          start_time: e.lesson_time ?? null
        })
      }
    })
    bulk()
    return { success: true }
  })

  // ─── DERS TAKVİMİ & ONAY ─────────────────────────────────────────────────

  ipcMain.handle('lessons:getByDateGroupedByTeacher', (_e, date: string) => {
    const lessons = db().prepare(`
      SELECT l.id, l.student_id, l.teacher_id, l.lesson_date,
        l.start_time, l.end_time, l.status,
        l.confirmation_status, l.confirmation_note,
        l.topic_covered,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone AS student_phone,
        t.first_name || ' ' || t.last_name AS teacher_name,
        t.color_code AS teacher_color,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM lessons l
      JOIN students s ON l.student_id = s.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.lesson_date = ?
      ORDER BY l.teacher_id, l.start_time
    `).all(date) as Record<string, unknown>[]

    const grouped: Record<number, { teacher_id: number | null; teacher_name: string; color_code: string; lessons: Record<string, unknown>[] }> = {}
    for (const lesson of lessons) {
      const tid = (lesson.teacher_id as number) ?? 0
      const tname = (lesson.teacher_name as string) ?? 'Öğretmen Atanmamış'
      const tcolor = (lesson.teacher_color as string) ?? '#1B3A6B'
      if (!grouped[tid]) grouped[tid] = { teacher_id: tid || null, teacher_name: tname, color_code: tcolor, lessons: [] }
      grouped[tid].lessons.push(lesson)
    }
    return Object.values(grouped)
  })

  ipcMain.handle('lessons:getByDateRange', (_e, dateFrom: string, dateTo: string) => {
    return db().prepare(`
      SELECT l.id, l.student_id, l.teacher_id, l.lesson_date,
        l.start_time, l.end_time, l.status,
        l.confirmation_status, l.confirmation_note,
        s.first_name || ' ' || s.last_name AS student_name,
        t.first_name || ' ' || t.last_name AS teacher_name,
        t.color_code AS teacher_color,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM lessons l
      JOIN students s ON l.student_id = s.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.lesson_date BETWEEN ? AND ?
      ORDER BY l.lesson_date, l.teacher_id, l.start_time
    `).all(dateFrom, dateTo)
  })

  ipcMain.handle('lessons:setConfirmation',
    (_e, id: number, status: 'pending' | 'confirmed' | 'cancelled', note?: string) => {
      db().prepare(`
        UPDATE lessons SET confirmation_status = ?, confirmation_note = ? WHERE id = ?
      `).run(status, note ?? null, id)
      return db().prepare('SELECT * FROM lessons WHERE id = ?').get(id)
    }
  )

  ipcMain.handle('lessons:createScheduleEntry', (_e, data: {
    student_id: number; teacher_id?: number; lesson_date: string;
    start_time?: string; end_time?: string; enrollment_id?: number; confirmation_status?: string
  }) => {
    const params: Record<string, unknown> = {
      enrollment_id: null, teacher_id: null, start_time: null, end_time: null,
      confirmation_status: 'pending', confirmation_note: null, status: 'completed',
      topic_covered: null, homework: null, teacher_notes: null, makeup_lesson_id: null,
      ...data
    }
    if (params.teacher_id && params.start_time) {
      const conflict = db().prepare(`
        SELECT id FROM lessons WHERE teacher_id = ? AND lesson_date = ? AND start_time = ?
      `).get(params.teacher_id, params.lesson_date, params.start_time)
      if (conflict) return { error: 'Bu saatte bu öğretmene ait başka bir ders mevcut.' }
    }
    if (!params.enrollment_id && params.teacher_id) {
      const enrollment = db().prepare(`
        SELECT id FROM enrollments WHERE student_id = ? AND teacher_id = ? AND status = 'active' LIMIT 1
      `).get(params.student_id, params.teacher_id) as { id: number } | undefined
      if (enrollment) params.enrollment_id = enrollment.id
    }
    const result = db().prepare(`
      INSERT INTO lessons (
        enrollment_id, student_id, teacher_id,
        lesson_date, start_time, end_time, status,
        confirmation_status, confirmation_note,
        topic_covered, homework, teacher_notes, makeup_lesson_id
      ) VALUES (
        @enrollment_id, @student_id, @teacher_id,
        @lesson_date, @start_time, @end_time, @status,
        @confirmation_status, @confirmation_note,
        @topic_covered, @homework, @teacher_notes, @makeup_lesson_id
      )
    `).run(params)
    return db().prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid)
  })

  // ─── HAFTALIK PROGRAMA OTOMATIK EKLEME ───────────────────────────────────
  // Aktif kayıtların lesson_days alanına bakarak verilen tarih aralığı için
  // eksik dersleri INSERT OR NOT EXISTS mantığıyla oluşturur.
  ipcMain.handle('lessons:ensureForDateRange', (_e, dateFrom: string, dateTo: string) => {
    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    const activeEnrollments = db().prepare(`
      SELECT e.id, e.student_id, e.teacher_id, e.lesson_time, e.lesson_days
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.status = 'active'
        AND s.status = 'active'
        AND e.lesson_days IS NOT NULL
        AND e.lesson_days != '[]'
        AND e.lesson_days != ''
        AND e.lesson_time IS NOT NULL
        AND e.lesson_time != ''
    `).all() as { id: number; student_id: number; teacher_id: number | null; lesson_time: string; lesson_days: string }[]

    // Saati olmayan placeholder dersleri temizle (inactive enrollment veya passive öğrenciye ait)
    db().prepare(`
      DELETE FROM lessons
      WHERE (start_time IS NULL OR start_time = '')
        AND confirmation_status = 'pending'
        AND status = 'completed'
        AND lesson_date >= @from
        AND lesson_date <= @to
    `).run({ from: dateFrom, to: dateTo })

    const insertIfMissing = db().prepare(`
      INSERT INTO lessons (enrollment_id, student_id, teacher_id, lesson_date, start_time, status, confirmation_status)
      SELECT @enrollment_id, @student_id, @teacher_id, @lesson_date, @start_time, 'completed', 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM lessons WHERE enrollment_id = @enrollment_id AND lesson_date = @lesson_date
      )
    `)

    const bulk = db().transaction(() => {
      const current = new Date(dateFrom + 'T12:00:00')
      const end = new Date(dateTo + 'T12:00:00')
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0]
        const dayName = DAY_NAMES[current.getDay()]
        for (const e of activeEnrollments) {
          let days: string[] = []
          try { days = JSON.parse(e.lesson_days) } catch { continue }
          if (days.includes(dayName)) {
            insertIfMissing.run({
              enrollment_id: e.id,
              student_id: e.student_id,
              teacher_id: e.teacher_id,
              lesson_date: dateStr,
              start_time: e.lesson_time ?? null
            })
          }
        }
        current.setDate(current.getDate() + 1)
      }
    })
    bulk()
    return { success: true }
  })

  // ─── MAKEUP LESSONS ───────────────────────────────────────────────────────
  ipcMain.handle('makeup:getAll', () => {
    return db().prepare(`
      SELECT m.*,
        s.first_name || ' ' || s.last_name AS student_name,
        t.first_name || ' ' || t.last_name AS teacher_name
      FROM makeup_lessons m
      JOIN students s ON m.student_id = s.id
      LEFT JOIN teachers t ON m.teacher_id = t.id
      ORDER BY m.scheduled_date DESC
    `).all()
  })

  ipcMain.handle('makeup:create', (_e, data: Record<string, unknown>) => {
    const params = {
      original_lesson_id: null, teacher_id: null,
      scheduled_time: null, reason: null, notes: null, status: 'scheduled',
      ...data
    }
    const stmt = db().prepare(`
      INSERT INTO makeup_lessons (
        original_lesson_id, student_id, teacher_id,
        scheduled_date, scheduled_time, reason, status, notes
      ) VALUES (
        @original_lesson_id, @student_id, @teacher_id,
        @scheduled_date, @scheduled_time, @reason, @status, @notes
      )
    `)
    const result = stmt.run(params)
    return db().prepare('SELECT * FROM makeup_lessons WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('makeup:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`
      UPDATE makeup_lessons SET
        scheduled_date = @scheduled_date, scheduled_time = @scheduled_time,
        reason = @reason, status = @status, notes = @notes
      WHERE id = @id
    `).run({ ...data, id })
    return db().prepare('SELECT * FROM makeup_lessons WHERE id = ?').get(id)
  })

  ipcMain.handle('makeup:delete', (_e, id: number) => {
    db().prepare('DELETE FROM makeup_lessons WHERE id = ?').run(id)
    return { success: true }
  })
}
