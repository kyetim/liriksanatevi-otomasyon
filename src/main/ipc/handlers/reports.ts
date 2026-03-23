import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'

export function registerReportHandlers(): void {
  const db = () => getDatabase()

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  ipcMain.handle('reports:getFinancial', (_e, start: string, end: string) => {
    const monthlyRevenue = db().prepare(`
      SELECT period_year AS year, period_month AS month,
        COALESCE(SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN status='partial' THEN total_amount ELSE 0 END),0) AS partial_income,
        COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN total_amount ELSE 0 END),0) AS pending,
        COUNT(*) AS payment_count
      FROM payments WHERE payment_date BETWEEN ? AND ?
      GROUP BY period_year, period_month ORDER BY period_year, period_month
    `).all(start, end)

    const byMethod = db().prepare(`
      SELECT payment_method, COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS cnt
      FROM payments WHERE status='paid' AND payment_date BETWEEN ? AND ?
      GROUP BY payment_method ORDER BY total DESC
    `).all(start, end)

    const byType = db().prepare(`
      SELECT payment_type, COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS cnt
      FROM payments WHERE status='paid' AND payment_date BETWEEN ? AND ?
      GROUP BY payment_type ORDER BY total DESC
    `).all(start, end)

    const expensesByCategory = db().prepare(`
      SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
      FROM expenses WHERE payment_date BETWEEN ? AND ?
      GROUP BY category ORDER BY total DESC
    `).all(start, end)

    const monthlyExpenses = db().prepare(`
      SELECT CAST(strftime('%Y',payment_date) AS INTEGER) AS year,
        CAST(strftime('%m',payment_date) AS INTEGER) AS month,
        COALESCE(SUM(amount),0) AS expenses
      FROM expenses WHERE payment_date BETWEEN ? AND ?
      GROUP BY year, month ORDER BY year, month
    `).all(start, end)

    const overdueAging = db().prepare(`
      SELECT s.first_name || ' ' || s.last_name AS student_name, s.phone,
        p.total_amount, p.due_date, p.period_month, p.period_year,
        CAST(julianday('now') - julianday(COALESCE(p.due_date,'2000-01-01')) AS INTEGER) AS days_overdue
      FROM payments p JOIN students s ON p.student_id = s.id
      WHERE p.status = 'overdue' ORDER BY days_overdue DESC
    `).all()

    const totalIncome = (db().prepare(`
      SELECT COALESCE(SUM(total_amount),0) AS v FROM payments
      WHERE status='paid' AND payment_date BETWEEN ? AND ?
    `).get(start, end) as any).v

    const totalExpenses = (db().prepare(`
      SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE payment_date BETWEEN ? AND ?
    `).get(start, end) as any).v

    const payments = db().prepare(`
      SELECT p.*, s.first_name || ' ' || s.last_name AS student_name
      FROM payments p JOIN students s ON p.student_id = s.id
      WHERE p.payment_date BETWEEN ? AND ? ORDER BY p.payment_date DESC
    `).all(start, end)

    const expensesList = db().prepare(`
      SELECT e.*, e.vendor AS paid_to_name
      FROM expenses e
      WHERE e.payment_date BETWEEN ? AND ? ORDER BY e.payment_date DESC
    `).all(start, end)

    // Enstrümana göre gelir dağılımı
    const byInstrument = db().prepare(`
      SELECT i.name AS instrument_name, i.color_code,
        COALESCE(SUM(p.total_amount),0) AS total, COUNT(p.id) AS cnt
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE p.status = 'paid' AND p.payment_date BETWEEN ? AND ?
      GROUP BY i.id ORDER BY total DESC
    `).all(start, end)

    // Önceki dönem geliri karşılaştırma için
    const startDate = new Date(start)
    const endDate = new Date(end)
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
    const prevEnd = new Date(startDate.getTime() - 86400000).toISOString().slice(0, 10)
    const prevStart = new Date(startDate.getTime() - (daysDiff + 1) * 86400000).toISOString().slice(0, 10)
    const prevPeriodIncome = (db().prepare(`
      SELECT COALESCE(SUM(total_amount),0) AS v FROM payments
      WHERE status='paid' AND payment_date BETWEEN ? AND ?
    `).get(prevStart, prevEnd) as any).v

    return {
      monthlyRevenue, byMethod, byType, expensesByCategory, monthlyExpenses,
      overdueAging, totalIncome, totalExpenses, payments, expensesList,
      byInstrument, prevPeriodIncome
    }
  })

  ipcMain.handle('reports:getStudentReport', (_e, start: string, end: string, type: string) => {
    if (type === 'attendance') {
      return db().prepare(`
        SELECT s.id, s.first_name || ' ' || s.last_name AS student_name,
          s.phone, s.status AS student_status,
          COUNT(l.id) AS total_lessons,
          SUM(CASE WHEN l.status IN ('completed','makeup') THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN l.status='student_absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN l.status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
          ROUND(100.0*SUM(CASE WHEN l.status IN ('completed','makeup') THEN 1 ELSE 0 END)/NULLIF(COUNT(l.id),0),1) AS attendance_rate,
          i.name AS instrument_name,
          t.first_name || ' ' || t.last_name AS teacher_name
        FROM students s
        LEFT JOIN lessons l ON l.student_id=s.id AND l.lesson_date BETWEEN ? AND ?
        LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active'
        LEFT JOIN instruments i ON e.instrument_id=i.id
        LEFT JOIN teachers t ON e.teacher_id=t.id
        WHERE s.status='active'
        GROUP BY s.id ORDER BY attendance_rate ASC NULLS LAST
      `).all(start, end)
    }
    if (type === 'enrollment') {
      const newStudents = db().prepare(`
        SELECT s.id, s.first_name || ' ' || s.last_name AS student_name,
          s.registration_date, s.referral_source, s.phone,
          i.name AS instrument_name
        FROM students s
        LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active'
        LEFT JOIN instruments i ON e.instrument_id=i.id
        WHERE s.registration_date BETWEEN ? AND ?
        ORDER BY s.registration_date DESC
      `).all(start, end)
      const departures = db().prepare(`
        SELECT dr.departure_date, dr.reason_category AS reason, dr.reason_detail, dr.notes,
          s.first_name || ' ' || s.last_name AS student_name, s.phone
        FROM departure_records dr JOIN students s ON dr.student_id=s.id
        WHERE dr.departure_date BETWEEN ? AND ? ORDER BY dr.departure_date DESC
      `).all(start, end)
      const referralSources = db().prepare(`
        SELECT COALESCE(referral_source,'Belirtilmemiş') AS source, COUNT(*) AS cnt
        FROM students WHERE registration_date BETWEEN ? AND ?
        GROUP BY source ORDER BY cnt DESC
      `).all(start, end)
      return { newStudents, departures, referralSources }
    }
    if (type === 'net_growth') {
      // Aylık net büyüme: yeni kayıt - ayrılma (geniş tarih aralığı)
      const monthly = db().prepare(`
        WITH months AS (
          SELECT CAST(strftime('%Y',registration_date) AS INTEGER) AS year,
            CAST(strftime('%m',registration_date) AS INTEGER) AS month,
            COUNT(*) AS new_students
          FROM students
          WHERE registration_date BETWEEN ? AND ?
          GROUP BY year, month
        ),
        deps AS (
          SELECT CAST(strftime('%Y',departure_date) AS INTEGER) AS year,
            CAST(strftime('%m',departure_date) AS INTEGER) AS month,
            COUNT(*) AS departures
          FROM departure_records
          WHERE departure_date BETWEEN ? AND ?
          GROUP BY year, month
        )
        SELECT COALESCE(m.year,d.year) AS year, COALESCE(m.month,d.month) AS month,
          COALESCE(m.new_students,0) AS new_students,
          COALESCE(d.departures,0) AS departures,
          COALESCE(m.new_students,0) - COALESCE(d.departures,0) AS net
        FROM months m
        FULL OUTER JOIN deps d ON m.year=d.year AND m.month=d.month
        ORDER BY year, month
      `).all(start, end, start, end)
      // Churn reasons
      const churnReasons = db().prepare(`
        SELECT COALESCE(reason_category,'Belirtilmemiş') AS reason, COUNT(*) AS cnt
        FROM departure_records WHERE departure_date BETWEEN ? AND ?
        GROUP BY reason_category ORDER BY cnt DESC
      `).all(start, end)
      return { monthly, churnReasons }
    }
    return []
  })

  ipcMain.handle('reports:getTeacherReport', (_e, start: string, end: string) => {
    const workload = db().prepare(`
      SELECT t.id, t.first_name || ' ' || t.last_name AS teacher_name,
        t.specialization AS instrument_specialization,
        COUNT(l.id) AS total_lessons,
        SUM(CASE WHEN l.status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN l.status='teacher_absent' THEN 1 ELSE 0 END) AS teacher_absent,
        SUM(CASE WHEN l.status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN l.status='makeup' THEN 1 ELSE 0 END) AS makeup,
        COUNT(DISTINCT l.student_id) AS unique_students,
        ROUND(100.0*SUM(CASE WHEN l.status='completed' THEN 1 ELSE 0 END)/NULLIF(COUNT(l.id),0),1) AS completion_rate
      FROM teachers t
      LEFT JOIN lessons l ON l.teacher_id=t.id AND l.lesson_date BETWEEN ? AND ?
      WHERE t.status='active'
      GROUP BY t.id ORDER BY total_lessons DESC
    `).all(start, end)

    const monthlyByTeacher = db().prepare(`
      SELECT t.first_name || ' ' || t.last_name AS teacher_name,
        CAST(strftime('%Y',l.lesson_date) AS INTEGER) AS year,
        CAST(strftime('%m',l.lesson_date) AS INTEGER) AS month,
        COUNT(*) AS lesson_count,
        SUM(CASE WHEN l.status='completed' THEN 1 ELSE 0 END) AS completed
      FROM lessons l JOIN teachers t ON l.teacher_id=t.id
      WHERE l.lesson_date BETWEEN ? AND ?
      GROUP BY t.id, year, month ORDER BY year, month, teacher_name
    `).all(start, end)

    // Anket ortalamaları öğretmen başına
    const surveyAvg = db().prepare(`
      SELECT teacher_id,
        ROUND(AVG(score),1) AS avg_overall,
        COUNT(*) AS survey_count
      FROM teacher_surveys
      WHERE (year * 100 + month) BETWEEN CAST(strftime('%Y%m', ?) AS INTEGER)
                                     AND CAST(strftime('%Y%m', ?) AS INTEGER)
      GROUP BY teacher_id
    `).all(start, end) as Array<{ teacher_id: number; avg_overall: number; survey_count: number }>

    const surveyMap = new Map(surveyAvg.map(s => [s.teacher_id, s]))
    const workloadWithSurvey = (workload as Array<Record<string, unknown>>).map(w => {
      const s = surveyMap.get(w.id as number)
      return { ...w, avg_score: s?.avg_overall ?? null, survey_count: s?.survey_count ?? 0 }
    })

    return { workload: workloadWithSurvey, monthlyByTeacher }
  })

  ipcMain.handle('reports:getInstrumentOccupancy', () => {
    return db().prepare(`
      SELECT i.id, i.name AS instrument_name, i.color_code,
        COALESCE(SUM(CASE WHEN e.status='active' THEN 1 ELSE 0 END),0) AS active_students,
        COALESCE(SUM(CASE WHEN e.status='passive' THEN 1 ELSE 0 END),0) AS passive_students,
        COUNT(DISTINCT CASE WHEN e.status='active' THEN e.teacher_id END) AS teacher_count,
        COALESCE(SUM(CASE WHEN e.status='active' THEN e.monthly_fee ELSE 0 END),0) AS monthly_revenue
      FROM instruments i
      LEFT JOIN enrollments e ON e.instrument_id = i.id
      WHERE i.is_active = 1
      GROUP BY i.id ORDER BY active_students DESC
    `).all()
  })
}
