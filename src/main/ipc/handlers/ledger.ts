import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'

export function registerLedgerHandlers(): void {
  const db = () => getDatabase()

  // ─── INVENTORY ────────────────────────────────────────────────────────────
  ipcMain.handle('inventory:getAll', () => {
    return db().prepare(`
      SELECT inv.*,
        s.first_name || ' ' || s.last_name AS assigned_student_name,
        t.first_name || ' ' || t.last_name AS assigned_teacher_name
      FROM inventory inv
      LEFT JOIN students s ON inv.assigned_to_student_id = s.id
      LEFT JOIN teachers t ON inv.assigned_to_teacher_id = t.id
      ORDER BY inv.item_name
    `).all()
  })

  ipcMain.handle('inventory:create', (_e, data: Record<string, unknown>) => {
    const stmt = db().prepare(`
      INSERT INTO inventory (
        item_name, category, brand, model, serial_number,
        purchase_date, purchase_price, condition,
        assigned_to_student_id, assigned_to_teacher_id,
        location, notes, status
      ) VALUES (
        @item_name, @category, @brand, @model, @serial_number,
        @purchase_date, @purchase_price, @condition,
        @assigned_to_student_id, @assigned_to_teacher_id,
        @location, @notes, @status
      )
    `)
    const result = stmt.run(data)
    return db().prepare('SELECT * FROM inventory WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('inventory:update', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`
      UPDATE inventory SET
        item_name = @item_name, category = @category, brand = @brand,
        model = @model, condition = @condition, status = @status,
        assigned_to_student_id = @assigned_to_student_id,
        assigned_to_teacher_id = @assigned_to_teacher_id,
        location = @location, notes = @notes
      WHERE id = @id
    `).run({ ...data, id })
    return db().prepare('SELECT * FROM inventory WHERE id = ?').get(id)
  })

  ipcMain.handle('inventory:delete', (_e, id: number) => {
    db().prepare('DELETE FROM inventory WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── CARİ HESAP (Ledger) ──────────────────────────────────────────────────

  ipcMain.handle('ledger:getByStudent', (_e, studentId: number, filters?: {
    type?: string; dateFrom?: string; dateTo?: string
  }) => {
    const d = getDatabase()
    let where = 'WHERE sl.student_id = @studentId AND sl.status != \'cancelled\''
    const params: Record<string, unknown> = { studentId }
    if (filters?.type && filters.type !== 'all') {
      where += ' AND sl.transaction_type = @type'
      params.type = filters.type
    }
    if (filters?.dateFrom) {
      where += ' AND sl.transaction_date >= @dateFrom'
      params.dateFrom = filters.dateFrom
    }
    if (filters?.dateTo) {
      where += ' AND sl.transaction_date <= @dateTo'
      params.dateTo = filters.dateTo
    }
    const rows = d.prepare(`
      SELECT
        sl.*,
        l.lesson_date,
        i.name AS instrument_name,
        SUM(CASE WHEN sl2.status != 'cancelled' THEN sl2.debt_amount - sl2.credit_amount ELSE 0 END)
          OVER (PARTITION BY sl.student_id ORDER BY sl.transaction_date, sl.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
      FROM student_ledger sl
      LEFT JOIN lessons l ON sl.lesson_id = l.id
      LEFT JOIN enrollments e ON sl.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      LEFT JOIN student_ledger sl2 ON sl2.id = sl.id
      ${where}
      ORDER BY sl.transaction_date DESC, sl.id DESC
    `).all(params)
    return rows
  })

  ipcMain.handle('ledger:getBalance', (_e, studentId: number) => {
    const d = getDatabase()
    const row = d.prepare(`
      SELECT
        student_id,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN debt_amount ELSE 0 END), 0)   AS total_debt,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN credit_amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN debt_amount - credit_amount ELSE 0 END), 0) AS balance,
        COUNT(CASE WHEN status = 'open' AND debt_amount > credit_amount THEN 1 END) AS open_debt_count
      FROM student_ledger
      WHERE student_id = ?
    `).get(studentId)
    return row
  })

  ipcMain.handle('ledger:addManualDebt', (_e, data: {
    student_id: number; amount: number; description: string
    transaction_date: string; created_by?: string
  }) => {
    const d = getDatabase()
    const result = d.prepare(`
      INSERT INTO student_ledger
        (student_id, transaction_type, debt_amount, credit_amount,
         description, status, transaction_date, created_by)
      VALUES
        (@student_id, 'manual_debt', @amount, 0,
         @description, 'open', @transaction_date, @created_by)
    `).run({
      student_id: data.student_id,
      amount: data.amount,
      description: data.description,
      transaction_date: data.transaction_date,
      created_by: data.created_by ?? null
    })
    return d.prepare('SELECT * FROM student_ledger WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('ledger:cancelEntry', (_e, entryId: number) => {
    const d = getDatabase()
    d.prepare("UPDATE student_ledger SET status = 'cancelled' WHERE id = ?").run(entryId)
    return { success: true }
  })

  ipcMain.handle('ledger:addPayment', (_e, data: {
    student_id: number
    amount?: number            // basit kullanım: tek tutar
    gross_amount?: number      // indirim öncesi (opsiyonel)
    discount_amount?: number   // indirim tutarı (opsiyonel, varsayılan 0)
    net_amount?: number        // ödenen net tutar (opsiyonel)
    payment_method: string
    payment_date: string
    description?: string
    notes?: string
    created_by?: string
    debt_ids?: number[]
    allocation_strategy?: 'fifo' | 'proportional'
  }) => {
    const d = getDatabase()
    return d.transaction(() => {
      // amount / gross_amount / net_amount normalizasyonu
      const gross   = data.gross_amount   ?? data.amount ?? 0
      const discount = data.discount_amount ?? 0
      const net     = data.net_amount     ?? data.amount ?? gross

      // 1. Makbuz no üret
      const yr = data.payment_date.substring(0, 4)
      const { cnt } = d.prepare(
        `SELECT COUNT(*) as cnt FROM payments WHERE strftime('%Y', payment_date) = ?`
      ).get(yr) as { cnt: number }
      const receiptNumber = `${yr}-${String(cnt + 1).padStart(4, '0')}`

      // 2. payments tablosuna kayıt
      const safeMethod = ['cash','credit_card','bank_transfer','eft'].includes(data.payment_method)
        ? data.payment_method : 'bank_transfer'
      const payResult = d.prepare(`
        INSERT INTO payments (student_id, payment_type, amount, discount_amount, total_amount,
          payment_method, payment_date, status, receipt_number, notes, created_by)
        VALUES (@student_id, 'monthly_fee', @amount, @discount, @total,
          @method, @date, 'paid', @receipt, @notes, @created_by)
      `).run({
        student_id: data.student_id, amount: gross,
        discount, total: net,
        method: safeMethod, date: data.payment_date,
        receipt: receiptNumber, notes: data.notes ?? null,
        created_by: data.created_by ?? null
      })
      const paymentId = Number(payResult.lastInsertRowid)

      // 3. student_ledger payment_credit kaydı
      const desc = data.description || `Ödeme alındı — ${data.payment_method}`
      const ledgerResult = d.prepare(`
        INSERT INTO student_ledger
          (student_id, transaction_type, debt_amount, credit_amount,
           description, status, transaction_date, payment_id, created_by)
        VALUES
          (@student_id, 'payment', 0, @amount,
           @desc, 'paid', @date, @payment_id, @created_by)
      `).run({
        student_id: data.student_id, amount: net, desc,
        date: data.payment_date, payment_id: paymentId, created_by: data.created_by ?? null
      })
      const ledgerEntryId = Number(ledgerResult.lastInsertRowid)

      // 4. Seçilen borçları kapat (FIFO veya orantılı)
      const closedDebtIds: number[] = []
      if (data.debt_ids?.length) {
        const ph = data.debt_ids.map(() => '?').join(',')
        const debts = d.prepare(`
          SELECT id, debt_amount, credit_amount FROM student_ledger
          WHERE id IN (${ph}) AND student_id = ?
          ORDER BY transaction_date ASC, id ASC
        `).all([...data.debt_ids, data.student_id]) as Array<{ id: number; debt_amount: number; credit_amount: number }>

        const totalDebtNet = debts.reduce((s, x) => s + x.debt_amount - x.credit_amount, 0)
        const isPartial = net < totalDebtNet - 0.001

        if (!isPartial) {
          for (const debt of debts) {
            d.prepare("UPDATE student_ledger SET status = 'paid', payment_id = ? WHERE id = ?")
              .run(paymentId, debt.id)
            closedDebtIds.push(debt.id)
          }
        } else if (data.allocation_strategy === 'proportional') {
          for (const debt of debts) {
            const debtNet = debt.debt_amount - debt.credit_amount
            if ((net * (debtNet / totalDebtNet)) >= debtNet - 0.01) {
              d.prepare("UPDATE student_ledger SET status = 'paid', payment_id = ? WHERE id = ?")
                .run(paymentId, debt.id)
              closedDebtIds.push(debt.id)
            }
          }
        } else {
          // FIFO
          let remaining = net
          for (const debt of debts) {
            const debtNet = debt.debt_amount - debt.credit_amount
            if (remaining >= debtNet - 0.001) {
              d.prepare("UPDATE student_ledger SET status = 'paid', payment_id = ? WHERE id = ?")
                .run(paymentId, debt.id)
              closedDebtIds.push(debt.id)
              remaining -= debtNet
            }
            if (remaining <= 0.001) break
          }
        }
      }

      return { paymentId, ledgerEntryId, receiptNumber, closedDebtIds }
    })()
  })

  ipcMain.handle('ledger:cancelPayment', (_e, paymentId: number) => {
    const d = getDatabase()
    d.transaction(() => {
      d.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ?").run(paymentId)
      d.prepare("UPDATE student_ledger SET status = 'cancelled' WHERE payment_id = ? AND transaction_type = 'payment'").run(paymentId)
      d.prepare("UPDATE student_ledger SET status = 'open', payment_id = NULL WHERE payment_id = ? AND transaction_type != 'payment'").run(paymentId)
    })()
    return { success: true }
  })

  // ─── LEDGER EXTENDED ──────────────────────────────────────────────────────

  ipcMain.handle('ledger:getStudentBalances', () => {
    return db().prepare(`
      SELECT s.id AS student_id,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone, s.status AS student_status,
        COALESCE(SUM(CASE WHEN sl.transaction_type != 'payment' AND sl.status = 'open' THEN sl.debt_amount ELSE 0 END), 0) AS open_debt,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'payment' AND sl.status != 'cancelled' THEN sl.credit_amount ELSE 0 END), 0) AS total_paid,
        (SELECT MAX(sl2.transaction_date) FROM student_ledger sl2
          WHERE sl2.student_id = s.id AND sl2.transaction_type = 'payment' AND sl2.status != 'cancelled') AS last_payment_date,
        (SELECT MIN(sl3.transaction_date) FROM student_ledger sl3
          WHERE sl3.student_id = s.id AND sl3.status = 'open' AND sl3.transaction_type != 'payment') AS oldest_open_debt_date
      FROM students s
      LEFT JOIN student_ledger sl ON sl.student_id = s.id
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY open_debt DESC, s.first_name
    `).all()
  })

  ipcMain.handle('ledger:getOverdueStudents', () => {
    return db().prepare(`
      SELECT s.id AS student_id,
        s.first_name || ' ' || s.last_name AS student_name,
        s.phone,
        COALESCE(SUM(CASE WHEN sl.transaction_type != 'payment' AND sl.status = 'open' THEN sl.debt_amount ELSE 0 END), 0) AS open_debt,
        MIN(sl.transaction_date) AS oldest_debt_date,
        CAST(julianday('now') - julianday(MIN(sl.transaction_date)) AS INTEGER) AS days_overdue,
        COUNT(CASE WHEN sl.transaction_type != 'payment' AND sl.status = 'open' THEN 1 END) AS open_debt_count
      FROM students s
      JOIN student_ledger sl ON sl.student_id = s.id AND sl.status = 'open' AND sl.transaction_type != 'payment'
      WHERE s.status = 'active'
      GROUP BY s.id HAVING open_debt > 0
      ORDER BY days_overdue DESC, open_debt DESC
    `).all()
  })

  ipcMain.handle('ledger:getPeriodReport', (_e, dateFrom: string, dateTo: string) => {
    const d = getDatabase()

    const openingBalance = (d.prepare(`
      SELECT COALESCE(SUM(CASE WHEN transaction_type != 'payment' AND status != 'cancelled' THEN debt_amount ELSE 0 END)
        - SUM(CASE WHEN transaction_type = 'payment' AND status != 'cancelled' THEN credit_amount ELSE 0 END), 0) AS v
      FROM student_ledger WHERE transaction_date < ?
    `).get(dateFrom) as any).v

    const totalDebtCreated = (d.prepare(`
      SELECT COALESCE(SUM(debt_amount), 0) AS v FROM student_ledger
      WHERE transaction_date BETWEEN ? AND ? AND transaction_type != 'payment' AND status != 'cancelled'
    `).get(dateFrom, dateTo) as any).v

    const totalCollected = (d.prepare(`
      SELECT COALESCE(SUM(credit_amount), 0) AS v FROM student_ledger
      WHERE transaction_date BETWEEN ? AND ? AND transaction_type = 'payment' AND status != 'cancelled'
    `).get(dateFrom, dateTo) as any).v

    const endingBalance = openingBalance + totalDebtCreated - totalCollected
    const collectionRate = totalDebtCreated > 0 ? Math.round((totalCollected / totalDebtCreated) * 100) : 0

    const studentBreakdown = d.prepare(`
      SELECT s.id AS student_id,
        s.first_name || ' ' || s.last_name AS student_name, s.phone,
        COALESCE(SUM(CASE WHEN sl.transaction_type != 'payment' AND sl.status != 'cancelled' THEN sl.debt_amount ELSE 0 END), 0) AS debt_created,
        COALESCE(SUM(CASE WHEN sl.transaction_type = 'payment' AND sl.status != 'cancelled' THEN sl.credit_amount ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN sl.status = 'open' AND sl.transaction_type != 'payment' THEN sl.debt_amount ELSE 0 END), 0) AS remaining_open
      FROM students s
      JOIN student_ledger sl ON sl.student_id = s.id AND sl.transaction_date BETWEEN ? AND ?
      GROUP BY s.id HAVING (debt_created + collected) > 0
      ORDER BY remaining_open DESC, s.first_name
    `).all(dateFrom, dateTo)

    return { openingBalance, totalDebtCreated, totalCollected, endingBalance, collectionRate, studentBreakdown }
  })

  ipcMain.handle('ledger:getMonthlyStats', (_e, year: number, month: number) => {
    const d = getDatabase()
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const debtCreated = (d.prepare(`
      SELECT COALESCE(SUM(debt_amount), 0) AS v FROM student_ledger
      WHERE transaction_date >= ? AND transaction_date < ? AND transaction_type != 'payment' AND status != 'cancelled'
    `).get(monthStart, nextMonth) as any).v

    const collected = (d.prepare(`
      SELECT COALESCE(SUM(credit_amount), 0) AS v FROM student_ledger
      WHERE transaction_date >= ? AND transaction_date < ? AND transaction_type = 'payment' AND status != 'cancelled'
    `).get(monthStart, nextMonth) as any).v

    const remaining = debtCreated - collected

    const uncollectedStudents = d.prepare(`
      SELECT s.id AS student_id,
        s.first_name || ' ' || s.last_name AS student_name, s.phone,
        COALESCE(SUM(CASE WHEN sl.transaction_type != 'payment' AND sl.status = 'open' THEN sl.debt_amount ELSE 0 END), 0) AS open_debt
      FROM students s
      JOIN student_ledger sl ON sl.student_id = s.id
        AND sl.transaction_date >= ? AND sl.transaction_date < ?
        AND sl.transaction_type != 'payment' AND sl.status = 'open'
      GROUP BY s.id HAVING open_debt > 0
      ORDER BY open_debt DESC
    `).all(monthStart, nextMonth)

    return { debtCreated, collected, remaining, uncollectedStudents, collectionRate: debtCreated > 0 ? Math.round((collected / debtCreated) * 100) : 0 }
  })

  // ─── DERS EKLEMESİ (öğrenci + öğretmen carisine aynı anda) ───────────────

  ipcMain.handle('ledger:addLesson', (_e, data: {
    student_id: number
    teacher_id?: number | null
    lesson_date: string
    student_fee: number
    teacher_fee?: number | null
    description: string
    notes?: string
    created_by?: string
  }) => {
    const d = getDatabase()

    const tx = d.transaction(() => {
      // 1. Ders kaydı oluştur
      const lessonResult = d.prepare(`
        INSERT INTO lessons
          (student_id, teacher_id, lesson_date, status, lesson_fee, start_time, end_time,
           topic_covered, teacher_notes, enrollment_id)
        VALUES
          (@student_id, @teacher_id, @lesson_date, 'completed', @student_fee,
           NULL, NULL, @description, @notes, NULL)
      `).run({
        student_id: data.student_id,
        teacher_id: data.teacher_id ?? null,
        lesson_date: data.lesson_date,
        student_fee: data.student_fee,
        description: data.description ?? '',
        notes: data.notes ?? null
      })
      const lessonId = Number(lessonResult.lastInsertRowid)

      // 2. Öğrenci cari — borç kaydı
      const studentEntry = d.prepare(`
        INSERT INTO student_ledger
          (student_id, transaction_type, debt_amount, credit_amount,
           lesson_id, description, status, transaction_date, created_by)
        VALUES
          (@student_id, 'lesson_debt', @student_fee, 0,
           @lesson_id, @description, 'open', @lesson_date, @created_by)
      `).run({
        student_id: data.student_id,
        student_fee: data.student_fee,
        lesson_id: lessonId,
        description: data.description,
        lesson_date: data.lesson_date,
        created_by: data.created_by ?? null
      })
      const studentEntryId = Number(studentEntry.lastInsertRowid)

      // lessons tablosuna ledger_entry_id bağla
      d.prepare('UPDATE lessons SET ledger_entry_id = ? WHERE id = ?').run(studentEntryId, lessonId)

      // 3. Öğretmen cari — kazanç kaydı (öğretmen seçildiyse)
      let teacherEntryId: number | null = null
      if (data.teacher_id) {
        const teacherFee = data.teacher_fee ?? data.student_fee
        const teacherName = (d.prepare(
          "SELECT first_name || ' ' || last_name AS name FROM students WHERE id = ?"
        ).get(data.student_id) as { name: string } | undefined)?.name ?? 'Öğrenci'

        const teacherEntry = d.prepare(`
          INSERT INTO teacher_ledger
            (teacher_id, transaction_type, earned_amount, paid_amount,
             lesson_id, student_id, description, status, transaction_date, created_by)
          VALUES
            (@teacher_id, 'lesson_earned', @teacher_fee, 0,
             @lesson_id, @student_id, @description, 'active', @lesson_date, @created_by)
        `).run({
          teacher_id: data.teacher_id,
          teacher_fee: teacherFee,
          lesson_id: lessonId,
          student_id: data.student_id,
          description: `${teacherName} — ${data.description}`,
          lesson_date: data.lesson_date,
          created_by: data.created_by ?? null
        })
        teacherEntryId = Number(teacherEntry.lastInsertRowid)
      }

      return { lessonId, studentEntryId, teacherEntryId }
    })

    return tx()
  })

  // ─── ÖĞRETMEN CARİ HESAP ──────────────────────────────────────────────────

  ipcMain.handle('teacher_ledger:getByTeacher', (_e, teacherId: number, filters?: {
    type?: string; dateFrom?: string; dateTo?: string
  }) => {
    const d = getDatabase()
    let where = "WHERE tl.teacher_id = @teacherId AND tl.status != 'cancelled'"
    const params: Record<string, unknown> = { teacherId }

    if (filters?.type && filters.type !== 'all') {
      where += ' AND tl.transaction_type = @type'
      params.type = filters.type
    }
    if (filters?.dateFrom) {
      where += ' AND tl.transaction_date >= @dateFrom'
      params.dateFrom = filters.dateFrom
    }
    if (filters?.dateTo) {
      where += ' AND tl.transaction_date <= @dateTo'
      params.dateTo = filters.dateTo
    }

    return d.prepare(`
      SELECT
        tl.*,
        s.first_name || ' ' || s.last_name AS student_name,
        SUM(CASE WHEN tl2.status != 'cancelled' THEN tl2.earned_amount - tl2.paid_amount ELSE 0 END)
          OVER (PARTITION BY tl.teacher_id ORDER BY tl.transaction_date, tl.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
      FROM teacher_ledger tl
      LEFT JOIN students s ON tl.student_id = s.id
      LEFT JOIN teacher_ledger tl2 ON tl2.id = tl.id
      ${where}
      ORDER BY tl.transaction_date DESC, tl.id DESC
    `).all(params)
  })

  ipcMain.handle('teacher_ledger:getBalance', (_e, teacherId: number) => {
    const d = getDatabase()
    return d.prepare(`
      SELECT
        teacher_id,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN earned_amount ELSE 0 END), 0) AS total_earned,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN paid_amount   ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN earned_amount - paid_amount ELSE 0 END), 0) AS balance
      FROM teacher_ledger
      WHERE teacher_id = ?
    `).get(teacherId)
  })

  ipcMain.handle('teacher_ledger:addPayment', (_e, data: {
    teacher_id: number
    amount: number
    description: string
    transaction_date: string
    payment_method?: string
    notes?: string
    created_by?: string
  }) => {
    const d = getDatabase()
    const result = d.prepare(`
      INSERT INTO teacher_ledger
        (teacher_id, transaction_type, earned_amount, paid_amount,
         description, status, transaction_date, created_by, notes)
      VALUES
        (@teacher_id, 'payment_made', 0, @amount,
         @description, 'active', @transaction_date, @created_by, @notes)
    `).run({
      teacher_id: data.teacher_id,
      amount: data.amount,
      description: data.description,
      transaction_date: data.transaction_date,
      created_by: data.created_by ?? null,
      notes: data.notes ?? null
    })
    return d.prepare('SELECT * FROM teacher_ledger WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('teacher_ledger:cancelEntry', (_e, entryId: number) => {
    const d = getDatabase()
    d.prepare("UPDATE teacher_ledger SET status = 'cancelled' WHERE id = ?").run(entryId)
    return { success: true }
  })

  ipcMain.handle('teacher_ledger:addManualAdjustment', (_e, data: {
    teacher_id: number
    earned_amount: number
    paid_amount: number
    description: string
    transaction_date: string
    notes?: string
    created_by?: string
  }) => {
    const d = getDatabase()
    const result = d.prepare(`
      INSERT INTO teacher_ledger
        (teacher_id, transaction_type, earned_amount, paid_amount,
         description, status, transaction_date, created_by, notes)
      VALUES
        (@teacher_id, 'manual_adjustment', @earned_amount, @paid_amount,
         @description, 'active', @transaction_date, @created_by, @notes)
    `).run({
      teacher_id: data.teacher_id,
      earned_amount: data.earned_amount,
      paid_amount: data.paid_amount,
      description: data.description,
      transaction_date: data.transaction_date,
      created_by: data.created_by ?? null,
      notes: data.notes ?? null
    })
    return d.prepare('SELECT * FROM teacher_ledger WHERE id = ?').get(result.lastInsertRowid)
  })
}
