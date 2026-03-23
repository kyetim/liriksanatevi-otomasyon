import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'

export function registerDashboardHandlers(): void {
  const db = () => getDatabase()

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  ipcMain.handle('dashboard:getStats', () => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth() + 1

    const totalStudents = (db().prepare(
      "SELECT COUNT(*) AS c FROM students WHERE status = 'active'"
    ).get() as any).c

    const totalTeachers = (db().prepare(
      "SELECT COUNT(*) AS c FROM teachers WHERE status = 'active'"
    ).get() as any).c

    const totalEnrollments = (db().prepare(
      "SELECT COUNT(*) AS c FROM enrollments WHERE status = 'active'"
    ).get() as any).c

    const monthlyIncome = (db().prepare(`
      SELECT COALESCE(SUM(credit_amount), 0) AS total
      FROM student_ledger
      WHERE strftime('%Y', transaction_date) = ? AND strftime('%m', transaction_date) = ?
        AND transaction_type = 'payment' AND status != 'cancelled'
    `).get(String(thisYear), String(thisMonth).padStart(2, '0')) as any).total

    const monthlyExpenses = (db().prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE strftime('%Y-%m', payment_date) = ?
    `).get(`${thisYear}-${String(thisMonth).padStart(2, '0')}`) as any).total

    const pendingPayments = (db().prepare(
      "SELECT COUNT(DISTINCT student_id) AS c FROM student_ledger WHERE status = 'open' AND transaction_type != 'payment'"
    ).get() as any).c

    const unreadNotifications = (db().prepare(
      'SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0'
    ).get() as any).c

    const recentPayments = db().prepare(`
      SELECT p.*, s.first_name || ' ' || s.last_name AS student_name
      FROM payments p JOIN students s ON p.student_id = s.id
      ORDER BY p.created_at DESC LIMIT 8
    `).all()

    const todayLessons = db().prepare(`
      SELECT l.*,
        s.first_name || ' ' || s.last_name AS student_name,
        t.first_name || ' ' || t.last_name AS teacher_name,
        i.name AS instrument_name, i.color_code AS instrument_color
      FROM lessons l
      JOIN students s ON l.student_id = s.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.lesson_date = date('now')
      ORDER BY l.start_time
    `).all()

    // Son 6 ay gelir grafiği — student_ledger'dan
    const monthlyChart = db().prepare(`
      SELECT CAST(strftime('%Y', transaction_date) AS INTEGER) AS year,
             CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
             COALESCE(SUM(credit_amount), 0) AS income
      FROM student_ledger
      WHERE transaction_type = 'payment' AND status != 'cancelled'
        AND transaction_date >= date('now', '-5 months', 'start of month')
      GROUP BY year, month
      ORDER BY year, month
    `).all()

    return {
      totalStudents,
      totalTeachers,
      totalEnrollments,
      monthlyIncome,
      monthlyExpenses,
      netIncome: monthlyIncome - monthlyExpenses,
      pendingPayments,
      unreadNotifications,
      recentPayments,
      todayLessons,
      monthlyChart
    }
  })

  // ─── DASHBOARD KPIs (enhanced) ────────────────────────────────────────────
  ipcMain.handle('dashboard:getKpis', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const monthlyRevenue = (db().prepare(`
      SELECT COALESCE(SUM(credit_amount),0) AS v FROM student_ledger
      WHERE strftime('%Y', transaction_date) = ? AND strftime('%m', transaction_date) = ?
        AND transaction_type = 'payment' AND status != 'cancelled'
    `).get(String(y), String(m).padStart(2, '0')) as any).v

    const monthlyExpected = (db().prepare(`
      SELECT COALESCE(SUM(monthly_fee),0) AS v FROM enrollments WHERE status='active'
    `).get() as any).v

    const overdueAmount = (db().prepare(`
      SELECT COALESCE(SUM(debt_amount - credit_amount),0) AS v
      FROM student_ledger WHERE status = 'open' AND transaction_type != 'payment'
    `).get() as any).v

    const activeStudents = (db().prepare(
      "SELECT COUNT(*) AS v FROM students WHERE status='active'"
    ).get() as any).v

    const newStudentsThisMonth = (db().prepare(`
      SELECT COUNT(*) AS v FROM students WHERE strftime('%Y-%m', registration_date)=?
    `).get(monthStr) as any).v

    const departuresThisMonth = (db().prepare(`
      SELECT COUNT(*) AS v FROM departure_records WHERE strftime('%Y-%m', departure_date)=?
    `).get(monthStr) as any).v

    const todayRows = db().prepare(`
      SELECT status, COUNT(*) AS cnt FROM lessons WHERE lesson_date=date('now') GROUP BY status
    `).all() as any[]
    const todayTotal = todayRows.reduce((s: number, r: any) => s + r.cnt, 0)
    const todayCompleted = todayRows.find((r: any) => r.status === 'completed')?.cnt || 0
    const todayCancelled = todayRows.filter((r: any) =>
      r.status === 'cancelled' || r.status === 'student_absent').reduce((s: number, r: any) => s + r.cnt, 0)

    const teacherOccupancy = db().prepare(`
      SELECT t.first_name || ' ' || t.last_name AS teacher_name,
        COUNT(*) AS scheduled,
        SUM(CASE WHEN l.status='completed' THEN 1 ELSE 0 END) AS completed
      FROM lessons l JOIN teachers t ON l.teacher_id = t.id
      WHERE l.lesson_date = date('now')
      GROUP BY l.teacher_id ORDER BY scheduled DESC
    `).all()

    const monthlyChart = db().prepare(`
      SELECT CAST(strftime('%Y', transaction_date) AS INTEGER) AS year,
             CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
             COALESCE(SUM(credit_amount), 0) AS income
      FROM student_ledger
      WHERE transaction_type = 'payment' AND status != 'cancelled'
        AND transaction_date >= date('now', '-11 months', 'start of month')
      GROUP BY year, month ORDER BY year, month
    `).all()

    const expenseChart = db().prepare(`
      SELECT CAST(strftime('%Y',payment_date) AS INTEGER) AS year,
        CAST(strftime('%m',payment_date) AS INTEGER) AS month,
        COALESCE(SUM(amount),0) AS expenses
      FROM expenses
      WHERE payment_date >= date('now','-11 months','start of month')
      GROUP BY year, month ORDER BY year, month
    `).all()

    const instrumentDistribution = db().prepare(`
      SELECT i.name, i.color_code AS color, COUNT(e.id) AS student_count
      FROM enrollments e JOIN instruments i ON e.instrument_id = i.id
      WHERE e.status = 'active'
      GROUP BY e.instrument_id ORDER BY student_count DESC LIMIT 8
    `).all()

    const totalEnrollments = (db().prepare(
      "SELECT COUNT(*) AS v FROM enrollments WHERE status='active'"
    ).get() as any).v

    const capacityRow = db().prepare(
      "SELECT value FROM settings WHERE key='monthly_capacity_target'"
    ).get() as any
    const capacityTarget = capacityRow ? (Number(JSON.parse(capacityRow.value)) || 0) : 0

    const targetRow = db().prepare(
      "SELECT value FROM settings WHERE key='monthly_revenue_target'"
    ).get() as any
    const revenueTarget = targetRow ? (Number(JSON.parse(targetRow.value)) || 0) : 0

    const now2 = new Date()
    const y2 = now2.getFullYear()
    const m2 = now2.getMonth() + 1
    const monthStart = `${y2}-${String(m2).padStart(2, '0')}-01`

    const totalOpenDebt = (db().prepare(`
      SELECT COALESCE(SUM(debt_amount - credit_amount), 0) AS v
      FROM student_ledger WHERE status = 'open' AND transaction_type != 'payment'
    `).get() as any).v

    const monthlyDebtCreated = (db().prepare(`
      SELECT COALESCE(SUM(debt_amount), 0) AS v FROM student_ledger
      WHERE transaction_date >= ? AND transaction_type != 'payment' AND status != 'cancelled'
    `).get(monthStart) as any).v

    const monthlyCollected = (db().prepare(`
      SELECT COALESCE(SUM(credit_amount), 0) AS v FROM student_ledger
      WHERE transaction_date >= ? AND transaction_type = 'payment' AND status != 'cancelled'
    `).get(monthStart) as any).v

    const topDebtors = db().prepare(`
      SELECT s.id, s.first_name || ' ' || s.last_name AS student_name, s.phone,
        COALESCE(SUM(CASE WHEN sl.transaction_type != 'payment' AND sl.status = 'open' THEN sl.debt_amount ELSE 0 END), 0) AS open_debt
      FROM students s
      LEFT JOIN student_ledger sl ON sl.student_id = s.id
      WHERE s.status = 'active'
      GROUP BY s.id HAVING open_debt > 0
      ORDER BY open_debt DESC LIMIT 5
    `).all()

    return {
      monthlyRevenue, monthlyExpected, overdueAmount, revenueTarget,
      activeStudents, newStudentsThisMonth, departuresThisMonth,
      todayTotal, todayCompleted, todayCancelled,
      teacherOccupancy, monthlyChart, expenseChart,
      instrumentDistribution, totalEnrollments, capacityTarget,
      totalOpenDebt, monthlyDebtCreated, monthlyCollected, topDebtors
    }
  })

  ipcMain.handle('dashboard:getAlerts', () => {
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]

    const overduePayments = db().prepare(`
      SELECT p.id, p.student_id, p.total_amount, p.due_date, p.period_month, p.period_year,
        s.first_name || ' ' || s.last_name AS student_name, s.phone,
        CAST(julianday('now') - julianday(COALESCE(p.due_date,'2000-01-01')) AS INTEGER) AS days_overdue
      FROM payments p JOIN students s ON p.student_id = s.id
      WHERE p.status = 'overdue' ORDER BY days_overdue DESC LIMIT 20
    `).all()

    const birthdays = db().prepare(`
      SELECT first_name || ' ' || last_name AS name, birth_date, phone
      FROM students WHERE status='active' AND birth_date IS NOT NULL
        AND strftime('%m-%d', birth_date) BETWEEN strftime('%m-%d','now')
          AND strftime('%m-%d','now','+7 days')
      ORDER BY strftime('%m-%d', birth_date) LIMIT 10
    `).all()

    const pendingMakeups = db().prepare(`
      SELECT m.id, m.scheduled_date AS original_date, m.status,
        s.first_name || ' ' || s.last_name AS student_name,
        t.first_name || ' ' || t.last_name AS teacher_name
      FROM makeup_lessons m
      LEFT JOIN students s ON m.student_id = s.id
      LEFT JOIN teachers t ON m.teacher_id = t.id
      WHERE m.status = 'scheduled' ORDER BY m.scheduled_date ASC LIMIT 15
    `).all()

    const upcomingInstallments = db().prepare(`
      SELECT ppi.id, ppi.due_date, ppi.amount,
        s.first_name || ' ' || s.last_name AS student_name, s.phone
      FROM payment_plan_items ppi
      JOIN payment_plans pp ON ppi.plan_id = pp.id
      JOIN students s ON pp.student_id = s.id
      WHERE ppi.status = 'pending' AND ppi.due_date BETWEEN date('now') AND ?
      ORDER BY ppi.due_date ASC LIMIT 20
    `).all(in30Days)

    const endingLeaves = db().prepare(`
      SELECT lr.id, lr.end_date, lr.leave_type,
        t.first_name || ' ' || t.last_name AS teacher_name
      FROM leave_requests lr JOIN teachers t ON lr.teacher_id = t.id
      WHERE lr.status = 'approved' AND lr.end_date BETWEEN ? AND ?
      ORDER BY lr.end_date ASC
    `).all(today, in7Days)

    return { overduePayments, birthdays, pendingMakeups, upcomingInstallments, endingLeaves }
  })
}
