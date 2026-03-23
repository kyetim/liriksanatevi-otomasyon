// ─────────────────────────────────────────────────────────────────────────────
// Lirik Sanat Evi — TypeScript Entity Tipleri
// ─────────────────────────────────────────────────────────────────────────────

export interface Student {
  id: number; first_name: string; last_name: string; birth_date?: string
  gender?: 'male' | 'female' | 'other'; phone?: string; email?: string
  address?: string; city?: string; parent_name?: string; parent_phone?: string
  parent_email?: string; photo_path?: string; registration_date: string
  status: 'active' | 'passive' | 'frozen'; notes?: string; discount_rate: number
  created_at: string; updated_at: string; active_enrollments?: number
  referral_source?: string; referred_by_student_id?: number; parent_profile_id?: number
  referred_by_name?: string; total_monthly_fee?: number; last_payment_date?: string
}

export interface Teacher {
  id: number; first_name: string; last_name: string; birth_date?: string
  phone?: string; email?: string; address?: string; specialization?: string
  employment_type: 'full_time' | 'part_time' | 'freelance'
  salary_type: 'fixed' | 'per_lesson'; salary_amount: number; iban?: string
  hire_date: string; status: 'active' | 'passive'; photo_path?: string; notes?: string
  created_at: string; updated_at: string; active_enrollments?: number
  color_code: string
  instrument_ids?: number[]
  // HR alanları (Migration 008)
  tc_kimlik_no?: string; sgk_no?: string; contract_type?: string
  contract_start?: string; contract_end?: string
}

export interface Instrument {
  id: number; name: string; category?: string; description?: string
  color_code: string; is_active: number
}

export interface Enrollment {
  id: number; student_id: number; teacher_id?: number; instrument_id?: number
  lesson_type: 'individual' | 'group'; lesson_duration: 30 | 45 | 60
  lessons_per_week: number; lesson_days: string; lesson_time?: string
  monthly_fee: number; start_date: string; end_date?: string
  status: 'active' | 'paused' | 'cancelled'; notes?: string
  created_at: string; updated_at: string
  student_name?: string; student_phone?: string; teacher_name?: string
  instrument_name?: string; instrument_color?: string
}

export interface Lesson {
  id: number; enrollment_id: number; student_id: number; teacher_id?: number
  lesson_date: string; start_time?: string; end_time?: string
  status: 'completed' | 'cancelled' | 'makeup' | 'student_absent' | 'teacher_absent'
  topic_covered?: string; homework?: string; teacher_notes?: string
  makeup_lesson_id?: number; created_at: string
  student_name?: string; teacher_name?: string
  instrument_name?: string; instrument_color?: string
}

export interface Payment {
  id: number; student_id: number; enrollment_id?: number
  payment_type: 'monthly_fee' | 'registration_fee' | 'material_fee' | 'other'
  amount: number; discount_amount: number; total_amount: number
  payment_method: 'cash' | 'credit_card' | 'bank_transfer' | 'eft'
  payment_date: string; due_date?: string; period_month?: number; period_year?: number
  status: 'paid' | 'pending' | 'overdue' | 'partial'
  receipt_number?: string; notes?: string; created_by?: string; created_at: string
  student_name?: string; instrument_name?: string
}

export interface Expense {
  id: number
  category: 'rent' | 'salary' | 'utility' | 'material' | 'maintenance' | 'other'
  description: string; amount: number; payment_date: string
  vendor?: string; receipt_number?: string; notes?: string; created_at: string
}

export interface MakeupLesson {
  id: number; original_lesson_id?: number; student_id: number; teacher_id?: number
  scheduled_date: string; scheduled_time?: string; reason?: string
  status: 'scheduled' | 'completed' | 'cancelled'; notes?: string; created_at: string
  student_name?: string; teacher_name?: string
}

export interface StudentProgress {
  id: number; student_id: number; teacher_id?: number; instrument_id?: number
  assessment_date: string; technical_score?: number; theory_score?: number
  practice_score?: number; performance_score?: number
  current_level?: 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'professional'
  current_piece?: string; notes?: string; goals?: string; created_at: string
  teacher_name?: string; instrument_name?: string
}

export interface InventoryItem {
  id: number; item_name: string
  category: 'instrument' | 'book' | 'material' | 'equipment'
  brand?: string; model?: string; serial_number?: string
  purchase_date?: string; purchase_price?: number
  condition: 'new' | 'good' | 'fair' | 'poor'
  assigned_to_student_id?: number; assigned_to_teacher_id?: number
  location?: string; notes?: string
  status: 'available' | 'in_use' | 'maintenance' | 'retired'; created_at: string
  assigned_student_name?: string; assigned_teacher_name?: string
}

export interface Notification {
  id: number; type: 'payment_due' | 'lesson_reminder' | 'birthday' | 'other'
  title: string; message: string; related_student_id?: number; related_payment_id?: number
  due_date?: string; is_read: number; is_sent: number; created_at: string
  student_name?: string
}

export interface DashboardStats {
  totalStudents: number; totalTeachers: number; totalEnrollments: number
  monthlyIncome: number; monthlyExpenses: number; netIncome: number
  pendingPayments: number; unreadNotifications: number
  recentPayments: Payment[]; todayLessons: Lesson[]
  monthlyChart: Array<{ year: number; month: number; income: number }>
}

export type LessonDay = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'

export const LESSON_DAY_LABELS: Record<LessonDay, string> = {
  monday:'Pazartesi', tuesday:'Salı', wednesday:'Çarşamba',
  thursday:'Perşembe', friday:'Cuma', saturday:'Cumartesi', sunday:'Pazar'
}

export const LESSON_STATUS_LABELS: Record<Lesson['status'], string> = {
  completed:'Tamamlandı', cancelled:'İptal', makeup:'Telafi',
  student_absent:'Öğrenci Gelmedi', teacher_absent:'Öğretmen Gelmedi'
}

export const PAYMENT_TYPE_LABELS: Record<Payment['payment_type'], string> = {
  monthly_fee:'Aylık Ücret', registration_fee:'Kayıt Ücreti',
  material_fee:'Materyal Ücreti', other:'Diğer'
}

export const PAYMENT_METHOD_LABELS: Record<Payment['payment_method'], string> = {
  cash:'Nakit', credit_card:'Kredi Kartı', bank_transfer:'Havale/EFT', eft:'EFT'
}

export const EXPENSE_CATEGORY_LABELS: Record<Expense['category'], string> = {
  rent:'Kira', salary:'Maaş', utility:'Fatura',
  material:'Materyal', maintenance:'Bakım/Onarım', other:'Diğer'
}

export const PROGRESS_LEVEL_LABELS: Record<NonNullable<StudentProgress['current_level']>, string> = {
  beginner:'Başlangıç', elementary:'Temel', intermediate:'Orta',
  advanced:'İleri', professional:'Profesyonel'
}

// ─── ÖDEME MODÜLÜ TİPLERİ ─────────────────────────────────────────────────────

export interface PaymentPlan {
  id: number; student_id: number; enrollment_id?: number
  title: string; total_amount: number; installment_count: number; start_date: string
  discount_type: 'none' | 'pesin' | 'percentage' | 'fixed'; discount_value: number
  notes?: string; status: 'active' | 'completed' | 'cancelled'
  created_at: string; updated_at: string
  student_name?: string; student_phone?: string
  paid_amount?: number; paid_count?: number
}

export interface PaymentPlanItem {
  id: number; plan_id: number; installment_no: number; due_date: string; amount: number
  status: 'pending' | 'paid' | 'overdue' | 'partial'
  payment_id?: number; paid_at?: string; created_at: string
  receipt_number?: string; payment_date?: string; payment_method?: string
}

export interface CashRegister {
  id: number; name: string; type: 'cash' | 'pos' | 'bank' | 'check' | 'note'
  current_balance: number; is_active: number; created_at: string
  last_movement?: string; today_movement_count?: number
}

export interface CashRegisterSession {
  id: number; register_id: number; session_date: string
  opening_balance: number; closing_balance?: number; status: 'open' | 'closed'
  opened_by?: string; closed_by?: string; notes?: string; created_at: string
}

export interface CashRegisterMovement {
  id: number; register_id: number; session_id?: number
  movement_type: 'income' | 'expense' | 'virman_in' | 'virman_out' | 'opening' | 'closing'
  amount: number; description: string
  payment_id?: number; expense_id?: number; virman_id?: number
  movement_date: string; created_at: string
}

export interface Check {
  id: number; check_number: string; bank_name: string; branch?: string
  account_holder: string; amount: number; issue_date: string; due_date: string
  student_id?: number; payment_id?: number
  status: 'portfolio' | 'deposited' | 'cleared' | 'bounced' | 'returned'
  notes?: string; created_at: string; student_name?: string
}

export interface PromissoryNote {
  id: number; note_number: string; debtor_name: string
  amount: number; issue_date: string; due_date: string
  student_id?: number; payment_id?: number
  status: 'active' | 'paid' | 'protested' | 'cancelled'
  notes?: string; created_at: string; student_name?: string
}

export interface Refund {
  id: number; original_payment_id: number; student_id: number
  refund_amount: number; reason: string
  refund_method: 'cash' | 'bank_transfer' | 'credit_card'
  refund_date: string; receipt_number?: string; notes?: string; created_at: string
  student_name?: string; original_receipt?: string; original_amount?: number
}

export interface VirmanTransfer {
  id: number; from_register_id: number; to_register_id: number
  amount: number; description: string; transfer_date: string; created_at: string
  from_register_name?: string; to_register_name?: string
}

export interface AuditLog {
  id: number; action: 'create' | 'update' | 'delete'
  table_name: string; record_id?: number
  old_values?: string; new_values?: string; created_at: string
}

export const CHECK_STATUS_LABELS: Record<Check['status'], string> = {
  portfolio: 'Portföyde', deposited: 'Bankaya Verildi',
  cleared: 'Tahsil Edildi', bounced: 'Karşılıksız', returned: 'İade Edildi'
}

export const NOTE_STATUS_LABELS: Record<PromissoryNote['status'], string> = {
  active: 'Aktif', paid: 'Ödendi', protested: 'Protesto', cancelled: 'İptal'
}

export const CASH_REGISTER_TYPE_LABELS: Record<CashRegister['type'], string> = {
  cash: 'Nakit', pos: 'POS / Kart', bank: 'Banka / Havale', check: 'Çek', note: 'Senet'
}

export const REFUND_METHOD_LABELS: Record<Refund['refund_method'], string> = {
  cash: 'Nakit', bank_transfer: 'Havale / EFT', credit_card: 'Kredi Kartı'
}

// ─── SMS MODÜLü TİPLERİ ───────────────────────────────────────────────────────

export interface SmsLog {
  id: number
  student_id?: number
  recipient_name: string
  phone: string
  message: string
  template_key?: string
  status: 'sent' | 'failed' | 'skipped'
  error_message?: string
  sent_at: string
  student_name?: string
}

export interface SmsTemplate {
  id: number
  template_key: string
  name: string
  content: string
  is_active: number
  updated_at: string
}

export interface SmsMonthlySummary {
  total: number
  sent: number
  failed: number
  skipped: number
}

export interface SmsBulkResult {
  total: number
  sent: number
  failed: number
  results: Array<{ recipientName: string; success: boolean; error?: string }>
}

// ─── CRM MODÜLü TİPLERİ ───────────────────────────────────────────────────────

export interface PreRegistration {
  id: number; first_name: string; last_name: string; birth_date?: string
  phone?: string; email?: string; parent_name?: string; parent_phone?: string
  instrument_interest?: string; availability?: string; how_heard?: string; notes?: string
  status: 'pending' | 'contacted' | 'converted' | 'cancelled'
  converted_student_id?: number; contacted_at?: string; created_at: string
}

export interface ParentProfile {
  id: number; first_name: string; last_name: string
  phone?: string; phone2?: string; email?: string; address?: string; occupation?: string
  sibling_discount_rate: number; notes?: string; created_at: string; updated_at: string
  student_count?: number
}

export interface StudentFreeze {
  id: number; student_id: number; freeze_start: string; freeze_end?: string
  reason: string; extend_payment_plans: number; notes?: string
  status: 'active' | 'ended'; created_at: string
}

export interface StudentStatusHistory {
  id: number; student_id: number; old_status?: string; new_status: string
  reason?: string; changed_by?: string; changed_at: string
}

export interface DepartureRecord {
  id: number; student_id: number; departure_date: string
  reason_category: 'financial' | 'relocation' | 'schedule' | 'dissatisfied' | 'graduation' | 'health' | 'other'
  reason_detail?: string; would_return: number
  student_rating?: number; school_rating?: number
  last_lesson_date?: string; notes?: string; created_at: string; student_name?: string
}

export const DEPARTURE_REASON_LABELS: Record<DepartureRecord['reason_category'], string> = {
  financial: 'Mali Sebepler', relocation: 'Taşınma / Uzaklık',
  schedule: 'Program Uyuşmazlığı', dissatisfied: 'Memnuniyetsizlik',
  graduation: 'Mezuniyet / Hedef Tamamlandı', health: 'Sağlık Sorunu', other: 'Diğer'
}

export const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  social_media: 'Sosyal Medya', friend_referral: 'Arkadaş Tavsiyesi',
  walk_in: 'Sokaktan / Tabeladan', web: 'Web Sitesi', other: 'Diğer'
}

export const PRE_REG_STATUS_LABELS: Record<PreRegistration['status'], string> = {
  pending: 'Bekliyor', contacted: 'İletişim Kuruldu',
  converted: 'Öğrenciye Dönüştürüldü', cancelled: 'İptal'
}

export const SMS_TEMPLATE_VARS = [
  { key: 'VELİ_ADI',      desc: 'Veli / ebeveyn adı' },
  { key: 'ÖĞRENCİ_ADI',   desc: 'Öğrencinin tam adı' },
  { key: 'AY',             desc: 'Ay adı (Ocak, Şubat...)' },
  { key: 'TUTAR',          desc: 'Ödeme tutarı (TL)' },
  { key: 'TARİH',          desc: 'İlgili tarih' },
  { key: 'GÜN',            desc: 'Gün sayısı (gecikme için)' },
  { key: 'SAAT',           desc: 'Ders saati' },
  { key: 'TELEFON',        desc: 'Okul telefon numarası' }
]

// ─────────────────────────────────────────────────────────────────────────────
// HR / Maaş Modülü Tipleri (Migration 008)
// ─────────────────────────────────────────────────────────────────────────────

export interface TeacherSalaryConfig {
  id: number; teacher_id: number
  salary_type: 'fixed' | 'per_lesson' | 'hybrid' | 'percentage'
  base_salary: number; per_lesson_rate: number; percentage_rate: number
  effective_from: string; notes?: string; created_at: string
}

export interface MonthlyPayroll {
  id: number; teacher_id: number; year: number; month: number
  salary_type: string; lesson_count: number; lesson_minutes: number
  base_amount: number; bonus_total: number; advance_deduction: number
  gross_amount: number; net_amount: number
  status: 'draft' | 'approved' | 'paid'
  payment_date?: string; payment_method?: 'cash' | 'bank_transfer' | 'eft'; notes?: string
  created_at: string; updated_at: string
  teacher_name?: string; iban?: string
}

export interface TeacherAdvance {
  id: number; teacher_id: number; amount: number; advance_date: string
  description?: string; payroll_id?: number
  status: 'pending' | 'deducted' | 'cancelled'; created_at: string
  teacher_name?: string
}

export interface TeacherBonus {
  id: number; teacher_id: number; payroll_id?: number
  bonus_type: 'manual' | 'performance'
  amount: number; reason?: string; year?: number; month?: number; created_at: string
  teacher_name?: string
}

export interface LeaveRequest {
  id: number; teacher_id: number
  leave_type: 'annual' | 'sick' | 'excuse' | 'unpaid'
  start_date: string; end_date: string; days_count: number
  reason?: string; status: 'pending' | 'approved' | 'rejected'
  approved_by?: string; approved_at?: string; notes?: string; created_at: string
  teacher_name?: string
}

export interface LeaveBalance {
  id: number; teacher_id: number; year: number
  total_days: number; used_days: number
}

export interface TeacherDocument {
  id: number; teacher_id: number
  doc_type: 'contract' | 'diploma' | 'certificate' | 'id_copy' | 'sgk' | 'other'
  title: string; file_path: string; file_name: string
  upload_date: string; notes?: string; created_at: string
}

export interface TeacherSurvey {
  id: number; teacher_id: number; student_id?: number
  year: number; month: number; score: number; feedback?: string; created_at: string
  student_name?: string
}

export interface TeacherPerformanceReport {
  teacher_id: number; teacher_name: string
  lesson_count: number; lesson_minutes: number
  cancel_rate: number; student_absent_rate: number
  avg_satisfaction: number; active_students: number
  prev_active_students: number; trend: number; net_salary: number
}

export const SALARY_TYPE_LABELS: Record<TeacherSalaryConfig['salary_type'], string> = {
  fixed: 'Sabit Maaş', per_lesson: 'Ders Başına',
  hybrid: 'Hibrit (Taban + Ders)', percentage: 'Yüzde Sistemi'
}

export const LEAVE_TYPE_LABELS: Record<LeaveRequest['leave_type'], string> = {
  annual: 'Yıllık İzin', sick: 'Hastalık İzni',
  excuse: 'Mazeret İzni', unpaid: 'Ücretsiz İzin'
}

export const DOC_TYPE_LABELS: Record<TeacherDocument['doc_type'], string> = {
  contract: 'Sözleşme', diploma: 'Diploma', certificate: 'Sertifika',
  id_copy: 'Kimlik Fotokopisi', sgk: 'SGK Belgesi', other: 'Diğer'
}

export const PAYROLL_STATUS_LABELS: Record<MonthlyPayroll['status'], string> = {
  draft: 'Taslak', approved: 'Onaylandı', paid: 'Ödendi'
}

export const MONTH_NAMES = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
]

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard & Reports Tipleri (PROMPT 6)
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  monthlyRevenue: number; monthlyExpected: number
  overdueAmount: number; revenueTarget: number
  activeStudents: number; newStudentsThisMonth: number; departuresThisMonth: number
  todayTotal: number; todayCompleted: number; todayCancelled: number
  teacherOccupancy: Array<{ teacher_name: string; scheduled: number; completed: number }>
  monthlyChart: Array<{ year: number; month: number; income: number }>
  expenseChart: Array<{ year: number; month: number; expenses: number }>
  instrumentDistribution: Array<{ name: string; color: string; student_count: number }>
  totalEnrollments: number; capacityTarget: number
  totalOpenDebt: number; monthlyDebtCreated: number; monthlyCollected: number
  topDebtors: Array<{ id: number; student_name: string; phone?: string; open_debt: number }>
}

export interface StudentLedgerBalance {
  student_id: number; student_name: string; phone?: string; student_status: string
  open_debt: number; total_paid: number; last_payment_date?: string; oldest_open_debt_date?: string
}

export interface OverdueStudent {
  student_id: number; student_name: string; phone?: string
  open_debt: number; oldest_debt_date: string; days_overdue: number; open_debt_count: number
}

export interface LedgerPeriodReport {
  openingBalance: number; totalDebtCreated: number; totalCollected: number
  endingBalance: number; collectionRate: number
  studentBreakdown: Array<{
    student_id: number; student_name: string; phone?: string
    debt_created: number; collected: number; remaining_open: number
  }>
}

export interface LedgerMonthlyStats {
  debtCreated: number; collected: number; remaining: number; collectionRate: number
  uncollectedStudents: Array<{ student_id: number; student_name: string; phone?: string; open_debt: number }>
}

export interface DashboardAlerts {
  overduePayments: Array<{ id: number; student_id: number; student_name: string; phone?: string; total_amount: number; due_date?: string; period_month: number; period_year: number; days_overdue: number }>
  birthdays: Array<{ name: string; birth_date: string; phone?: string }>
  pendingMakeups: Array<{ id: number; original_date: string; student_name: string; teacher_name?: string; status: string }>
  upcomingInstallments: Array<{ id: number; due_date: string; amount: number; student_name: string; phone?: string }>
  endingLeaves: Array<{ id: number; teacher_name: string; end_date: string; leave_type: string }>
}

export interface FinancialReport {
  monthlyRevenue: Array<{ year: number; month: number; income: number; partial_income: number; pending: number; payment_count: number }>
  byMethod: Array<{ payment_method: string; total: number; cnt: number }>
  byType: Array<{ payment_type: string; total: number; cnt: number }>
  expensesByCategory: Array<{ category: string; total: number; cnt: number }>
  monthlyExpenses: Array<{ year: number; month: number; expenses: number }>
  overdueAging: Array<{ student_name: string; phone?: string; total_amount: number; due_date?: string; period_month: number; period_year: number; days_overdue: number }>
  totalIncome: number; totalExpenses: number
  payments: Array<Record<string, unknown>>
  expensesList: Array<Record<string, unknown>>
  byInstrument: Array<{ instrument_name: string; color_code?: string; total: number; cnt: number }>
  prevPeriodIncome: number
}

export interface StudentAttendanceRow {
  id: number; student_name: string; phone?: string; student_status: string
  total_lessons: number; completed: number; absent: number; cancelled: number
  attendance_rate: number; instrument_name?: string; teacher_name?: string
}

export interface StudentEnrollmentReport {
  newStudents: Array<Record<string, unknown>>
  departures: Array<Record<string, unknown>>
  referralSources: Array<{ source: string; cnt: number }>
}

export interface NetGrowthReport {
  monthly: Array<{ year: number; month: number; new_students: number; departures: number; net: number }>
  churnReasons: Array<{ reason: string; cnt: number }>
}

export interface TeacherReport {
  workload: Array<{
    id: number; teacher_name: string; instrument_specialization?: string
    total_lessons: number; completed: number; teacher_absent: number
    cancelled: number; makeup: number; unique_students: number; completion_rate: number
    avg_score: number | null; survey_count: number
  }>
  monthlyByTeacher: Array<{ teacher_name: string; year: number; month: number; lesson_count: number; completed: number }>
}

export interface InstrumentOccupancy {
  id: number
  instrument_name: string
  color_code?: string
  active_students: number
  passive_students: number
  teacher_count: number
  monthly_revenue: number
}

// ─── ETKİNLİK & KONSER YÖNETİMİ ──────────────────────────────────────────────

export interface Event {
  id: number
  name: string
  event_type: 'concert' | 'recital' | 'workshop' | 'gala' | 'summer_school' | 'other'
  event_date: string
  start_time?: string
  end_time?: string
  venue?: string
  capacity?: number
  ticket_price?: number
  is_free: number
  description?: string
  poster_path?: string
  status: 'planning' | 'rehearsal' | 'ready' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
  participant_count?: number
}

export interface EventParticipant {
  id: number
  event_id: number
  student_id: number
  piece_title?: string
  piece_composer?: string
  instrument_id?: number
  stage_order: number
  performance_duration?: number
  is_attended?: number
  notes?: string
  created_at: string
  // JOIN fields
  student_name?: string
  student_phone?: string
  parent_name?: string
  parent_phone?: string
  instrument_name?: string
  instrument_color?: string
}

export interface EventRehearsal {
  id: number
  event_id: number
  rehearsal_date: string
  start_time?: string
  end_time?: string
  venue?: string
  notes?: string
  created_at: string
}

export interface EventChecklist {
  id: number
  event_id: number
  title: string
  is_done: number
  due_date?: string
  assigned_to?: string
  created_at: string
}

export interface EventPhoto {
  id: number
  event_id: number
  file_path: string
  file_name: string
  caption?: string
  uploaded_at: string
}

// ─── Users & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'secretary' | 'teacher' | 'accountant'

export interface AppUser {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: number
  teacher_id?: number | null
  last_login?: string | null
  created_at: string
  updated_at?: string
}

export interface AuthResult {
  success: boolean
  user?: AppUser
  token?: string
  error?: string
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export interface BackupFile {
  filename: string
  path: string
  size: number
  date: string
}

// ─── CARİ HESAP (Ledger) ──────────────────────────────────────────────────────

export type LedgerTransactionType =
  | 'lesson_debt'
  | 'payment'
  | 'manual_debt'
  | 'manual_credit'
  | 'discount'
  | 'refund'
  | 'correction'

export interface LedgerEntry {
  id: number
  student_id: number
  transaction_type: LedgerTransactionType
  debt_amount: number
  credit_amount: number
  description: string
  transaction_date: string
  lesson_id?: number
  enrollment_id?: number
  payment_id?: number
  status: 'open' | 'paid' | 'cancelled'
  created_by?: string
  created_at: string
  // computed
  running_balance?: number
  // join fields
  lesson_date?: string
  instrument_name?: string
}

export interface StudentBalance {
  student_id: number
  total_debt: number
  total_credit: number
  balance: number
  open_debt_count: number
}

export const LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = {
  lesson_debt:  'Ders Borcu',
  payment:      'Ödeme',
  manual_debt:  'Manuel Borç',
  manual_credit:'Manuel Alacak',
  discount:     'İndirim',
  refund:       'İade',
  correction:   'Düzeltme'
}

// ─── Teacher Ledger ───────────────────────────────────────────────────────────

export interface TeacherLedgerEntry {
  id: number
  teacher_id: number
  transaction_type: 'lesson_earned' | 'payment_made' | 'manual_adjustment'
  earned_amount: number
  paid_amount: number
  lesson_id?: number
  student_id?: number
  student_name?: string
  description: string
  status: 'active' | 'cancelled'
  transaction_date: string
  created_by?: string
  notes?: string
  created_at: string
  running_balance?: number
}

export interface TeacherBalance {
  teacher_id: number
  total_earned: number
  total_paid: number
  balance: number
}

// ─── DERS PROGRAMI (Schedule) ─────────────────────────────────────────────────

export type ConfirmationStatus = 'pending' | 'confirmed' | 'cancelled'

export interface ScheduleLesson {
  id: number
  student_id: number
  teacher_id?: number
  lesson_date: string
  start_time?: string
  end_time?: string
  status: Lesson['status']
  confirmation_status: ConfirmationStatus
  confirmation_note?: string
  topic_covered?: string
  student_name: string
  student_phone?: string
  teacher_name?: string
  teacher_color?: string
  instrument_name?: string
  instrument_color?: string
}

export interface TeacherDayCard {
  teacher_id: number | null
  teacher_name: string
  color_code?: string
  lessons: ScheduleLesson[]
}

export const CONFIRMATION_LABELS: Record<ConfirmationStatus, string> = {
  pending:   'Henüz haber yok',
  confirmed: 'Geliyor',
  cancelled: 'Gelemiyor'
}

export const CONFIRMATION_ICONS: Record<ConfirmationStatus, string> = {
  pending:   '⏳',
  confirmed: '✅',
  cancelled: '❌'
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  phone: string
  recipientName: string
  message: string
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  // Türkiye formatına normalize et: 05XX → 905XX
  let p = phone.replace(/[\s\-\(\)]/g, '')
  if (p.startsWith('+90')) p = p.slice(1)            // +90... → 90...
  else if (p.startsWith('0')) p = '90' + p.slice(1)  // 05XX → 905XX
  else if (!p.startsWith('90')) p = '90' + p         // 5XX → 905XX
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string, message: string): void {
  window.open(buildWhatsAppUrl(phone, message), '_blank')
}
