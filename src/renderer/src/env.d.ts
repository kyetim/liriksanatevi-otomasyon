/// <reference types="vite/client" />
import type {
  Student, Teacher, Instrument, Enrollment, Lesson,
  Payment, Expense, MakeupLesson, StudentProgress,
  InventoryItem, Notification, DashboardStats,
  PaymentPlan, PaymentPlanItem, CashRegister, CashRegisterSession,
  CashRegisterMovement, Check, PromissoryNote, Refund, VirmanTransfer, AuditLog,
  SmsLog, SmsTemplate, SmsMonthlySummary, SmsBulkResult,
  PreRegistration, ParentProfile, StudentFreeze, StudentStatusHistory, DepartureRecord,
  TeacherSalaryConfig, MonthlyPayroll, TeacherAdvance, TeacherBonus,
  LeaveRequest, LeaveBalance, TeacherDocument, TeacherSurvey, TeacherPerformanceReport,
  DashboardKpis, DashboardAlerts, FinancialReport, StudentAttendanceRow, StudentEnrollmentReport,
  NetGrowthReport, TeacherReport, InstrumentOccupancy,
  StudentLedgerBalance, OverdueStudent, LedgerPeriodReport, LedgerMonthlyStats,
  Event, EventParticipant, EventRehearsal, EventChecklist, EventPhoto,
  AppUser, AuthResult, BackupFile,
  LedgerEntry, StudentBalance, TeacherLedgerEntry, TeacherBalance
} from './types'

interface IApi {
  students: {
    getAll: () => Promise<Student[]>
    getById: (id: number) => Promise<Student | undefined>
    search: (query: string) => Promise<Student[]>
    create: (data: Partial<Student>) => Promise<Student>
    update: (id: number, data: Partial<Student>) => Promise<Student>
    setStatus: (id: number, status: string) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
    uploadPhoto: (studentId: number) => Promise<string | null>
  }
  teachers: {
    getAll: () => Promise<Teacher[]>
    getById: (id: number) => Promise<Teacher | undefined>
    create: (data: Partial<Teacher>) => Promise<Teacher>
    update: (id: number, data: Partial<Teacher>) => Promise<Teacher>
    delete: (id: number) => Promise<{ success: boolean }>
    getInstruments: (teacherId: number) => Promise<number[]>
    setInstruments: (teacherId: number, instrumentIds: number[]) => Promise<{ success: boolean }>
    getByInstrument: (instrumentId: number) => Promise<Teacher[]>
  }
  instruments: {
    getAll: () => Promise<Instrument[]>
    getActive: () => Promise<Instrument[]>
    create: (data: Partial<Instrument>) => Promise<Instrument>
    update: (id: number, data: Partial<Instrument>) => Promise<Instrument>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  enrollments: {
    getAll: () => Promise<Enrollment[]>
    getByStudent: (studentId: number) => Promise<Enrollment[]>
    getByTeacher: (teacherId: number) => Promise<Enrollment[]>
    create: (data: Partial<Enrollment>) => Promise<Enrollment>
    update: (id: number, data: Partial<Enrollment>) => Promise<Enrollment>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  lessons: {
    getByDate: (date: string) => Promise<Lesson[]>
    getByStudent: (studentId: number) => Promise<Lesson[]>
    getByEnrollment: (enrollmentId: number) => Promise<Lesson[]>
    create: (data: Partial<Lesson>) => Promise<Lesson>
    update: (id: number, data: Partial<Lesson>) => Promise<Lesson>
    updateStatus: (id: number, status: string) => Promise<{ lesson: Lesson; ledgerAmount?: number; ledgerError?: string; error?: string }>
    delete: (id: number) => Promise<{ success: boolean }>
    bulkCreateForDate: (date: string) => Promise<{ success: boolean }>
    completeDay: (date: string) => Promise<{ count: number; totalAmount: number }>
    getByDateGroupedByTeacher: (date: string) => Promise<{ teacher_id: number | null; teacher_name: string; lessons: Lesson[] }[]>
    getByDateRange: (dateFrom: string, dateTo: string) => Promise<Lesson[]>
    setConfirmation: (id: number, status: 'pending' | 'confirmed' | 'cancelled', note?: string) => Promise<Lesson>
    createScheduleEntry: (data: { student_id: number; teacher_id?: number; lesson_date: string; start_time?: string; end_time?: string; enrollment_id?: number; confirmation_status?: string }) => Promise<Lesson | { error: string }>
    ensureForDateRange: (dateFrom: string, dateTo: string) => Promise<{ success: boolean }>
  }
  payments: {
    getAll: () => Promise<Payment[]>
    getByMonth: (year: number, month: number) => Promise<Payment[]>
    getByStudent: (studentId: number) => Promise<Payment[]>
    getPending: () => Promise<Payment[]>
    create: (data: Partial<Payment>) => Promise<Payment>
    update: (id: number, data: Partial<Payment>) => Promise<Payment>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  expenses: {
    getAll: () => Promise<Expense[]>
    getByMonth: (year: number, month: number) => Promise<Expense[]>
    create: (data: Partial<Expense>) => Promise<Expense>
    update: (id: number, data: Partial<Expense>) => Promise<Expense>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  makeup: {
    getAll: () => Promise<MakeupLesson[]>
    create: (data: Partial<MakeupLesson>) => Promise<MakeupLesson>
    update: (id: number, data: Partial<MakeupLesson>) => Promise<MakeupLesson>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  progress: {
    getByStudent: (studentId: number) => Promise<StudentProgress[]>
    create: (data: Partial<StudentProgress>) => Promise<StudentProgress>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  inventory: {
    getAll: () => Promise<InventoryItem[]>
    create: (data: Partial<InventoryItem>) => Promise<InventoryItem>
    update: (id: number, data: Partial<InventoryItem>) => Promise<InventoryItem>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  notifications: {
    getUnread: () => Promise<Notification[]>
    markRead: (id: number) => Promise<{ success: boolean }>
    markAllRead: () => Promise<{ success: boolean }>
    create: (data: Partial<Notification>) => Promise<Notification>
    delete: (id: number) => Promise<{ success: boolean }>
    generatePaymentReminders: () => Promise<{ generated: number }>
  }
  dashboard: {
    getStats:  () => Promise<DashboardStats>
    getKpis:   () => Promise<DashboardKpis>
    getAlerts: () => Promise<DashboardAlerts>
  }
  reports: {
    getFinancial:           (start: string, end: string) => Promise<FinancialReport>
    getStudentReport:       (start: string, end: string, type: 'attendance' | 'enrollment' | 'net_growth') => Promise<StudentAttendanceRow[] | StudentEnrollmentReport | NetGrowthReport>
    getTeacherReport:       (start: string, end: string) => Promise<TeacherReport>
    getInstrumentOccupancy: () => Promise<InstrumentOccupancy[]>
  }
  settings: {
    getAll: () => Promise<Record<string, unknown>>
    set: (key: string, value: unknown) => Promise<{ success: boolean }>
    setBulk: (entries: Record<string, unknown>) => Promise<{ success: boolean }>
  }
  payment_plans: {
    getAll: () => Promise<PaymentPlan[]>
    getByStudent: (studentId: number) => Promise<PaymentPlan[]>
    create: (data: unknown) => Promise<PaymentPlan>
    update: (id: number, data: Partial<PaymentPlan>) => Promise<PaymentPlan>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  payment_plan_items: {
    getByPlan: (planId: number) => Promise<PaymentPlanItem[]>
    markPaid: (itemId: number, paymentId: number) => Promise<{ success: boolean }>
    update: (id: number, data: Partial<PaymentPlanItem>) => Promise<PaymentPlanItem>
  }
  cash_registers: {
    getAll: () => Promise<CashRegister[]>
    openSession: (registerId: number, openingBalance: number, openedBy?: string) => Promise<CashRegisterSession>
    closeSession: (sessionId: number, closedBy?: string) => Promise<{ success: boolean; closing_balance: number }>
    getMovements: (registerId: number, dateFrom?: string, dateTo?: string) => Promise<CashRegisterMovement[]>
    addMovement: (data: unknown) => Promise<CashRegisterMovement>
  }
  checks: {
    getAll: () => Promise<Check[]>
    create: (data: unknown) => Promise<Check>
    update: (id: number, data: Partial<Check>) => Promise<Check>
    delete: (id: number) => Promise<{ success: boolean }>
    getDueSoon: () => Promise<Check[]>
  }
  promissory_notes: {
    getAll: () => Promise<PromissoryNote[]>
    create: (data: unknown) => Promise<PromissoryNote>
    update: (id: number, data: Partial<PromissoryNote>) => Promise<PromissoryNote>
    delete: (id: number) => Promise<{ success: boolean }>
    getDueSoon: () => Promise<PromissoryNote[]>
  }
  refunds: {
    getAll: () => Promise<Refund[]>
    getByStudent: (studentId: number) => Promise<Refund[]>
    create: (data: unknown) => Promise<Refund>
  }
  virman: {
    getAll: () => Promise<VirmanTransfer[]>
    create: (data: unknown) => Promise<VirmanTransfer>
  }
  audit_log: {
    getRecent: () => Promise<AuditLog[]>
  }
  sms: {
    send: (d: { phone: string; message: string; studentId?: number; recipientName: string; templateKey?: string }) => Promise<{ success: boolean; error?: string }>
    sendBulk: (items: Array<{ phone: string; message: string; studentId?: number; recipientName: string; templateKey?: string }>) => Promise<SmsBulkResult>
    getHistory: (params?: { dateFrom?: string; dateTo?: string; status?: string }) => Promise<SmsLog[]>
    getHistoryByStudent: (id: number) => Promise<SmsLog[]>
    getMonthlySummary: (year: number, month: number) => Promise<SmsMonthlySummary>
    templatesGetAll: () => Promise<SmsTemplate[]>
    templatesUpdate: (key: string, content: string) => Promise<{ success: boolean }>
    testConnection: () => Promise<{ success: boolean; message?: string; error?: string }>
    runDailyJob: () => Promise<{ success: boolean }>
    hasCredentials: () => Promise<{ hasCredentials: boolean }>
  }
  pre_registrations: {
    getAll: () => Promise<PreRegistration[]>
    create: (data: Partial<PreRegistration>) => Promise<PreRegistration>
    update: (id: number, data: Partial<PreRegistration>) => Promise<PreRegistration>
    convert: (id: number, studentData: Partial<Student>) => Promise<Student>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  parent_profiles: {
    getAll: () => Promise<ParentProfile[]>
    search: (q: string) => Promise<ParentProfile[]>
    create: (data: Partial<ParentProfile>) => Promise<ParentProfile>
    update: (id: number, data: Partial<ParentProfile>) => Promise<ParentProfile>
    getStudents: (parentId: number) => Promise<Student[]>
  }
  student_freezes: {
    getByStudent: (studentId: number) => Promise<StudentFreeze[]>
    create: (data: Partial<StudentFreeze>) => Promise<StudentFreeze>
    end: (freezeId: number) => Promise<{ success: boolean }>
  }
  status_history: {
    getByStudent: (studentId: number) => Promise<StudentStatusHistory[]>
  }
  departures: {
    getAll: () => Promise<DepartureRecord[]>
    getByStudent: (studentId: number) => Promise<DepartureRecord[]>
    create: (data: Partial<DepartureRecord>) => Promise<DepartureRecord>
  }
  salary_configs: {
    getByTeacher: (teacherId: number) => Promise<TeacherSalaryConfig | undefined>
    upsert: (data: Partial<TeacherSalaryConfig>) => Promise<TeacherSalaryConfig>
  }
  payrolls: {
    getByMonth: (year: number, month: number) => Promise<MonthlyPayroll[]>
    getByTeacher: (teacherId: number) => Promise<MonthlyPayroll[]>
    calculate: (teacherId: number, year: number, month: number) => Promise<MonthlyPayroll>
    update: (id: number, data: Partial<MonthlyPayroll>) => Promise<MonthlyPayroll>
    markPaid: (id: number, data: Partial<MonthlyPayroll>) => Promise<MonthlyPayroll>
    delete: (id: number) => Promise<{ success: boolean }>
    getPerformanceReport: (year: number, month: number) => Promise<TeacherPerformanceReport[]>
  }
  advances: {
    getByTeacher: (teacherId: number) => Promise<TeacherAdvance[]>
    getAll: (year: number, month: number) => Promise<TeacherAdvance[]>
    create: (data: Partial<TeacherAdvance>) => Promise<TeacherAdvance>
    cancel: (id: number) => Promise<{ success: boolean }>
  }
  bonuses: {
    getByTeacher: (teacherId: number) => Promise<TeacherBonus[]>
    getAll: (year: number, month: number) => Promise<TeacherBonus[]>
    create: (data: Partial<TeacherBonus>) => Promise<TeacherBonus>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  leaves: {
    getAll: (filters: Record<string, unknown>) => Promise<LeaveRequest[]>
    getByTeacher: (teacherId: number) => Promise<LeaveRequest[]>
    create: (data: Partial<LeaveRequest>) => Promise<LeaveRequest>
    approve: (id: number, by: string) => Promise<LeaveRequest>
    reject: (id: number) => Promise<LeaveRequest>
    getCalendar: (year: number, month: number) => Promise<LeaveRequest[]>
  }
  leave_balances: {
    getByTeacher: (teacherId: number, year: number) => Promise<LeaveBalance>
    update: (id: number, totalDays: number) => Promise<LeaveBalance>
  }
  teacher_documents: {
    getByTeacher: (teacherId: number) => Promise<TeacherDocument[]>
    upload: (teacherId: number) => Promise<{ file_path: string; file_name: string } | null>
    create: (data: Partial<TeacherDocument>) => Promise<TeacherDocument>
    open: (filePath: string) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  surveys: {
    getByTeacher: (teacherId: number) => Promise<TeacherSurvey[]>
    getMonthly: (year: number, month: number) => Promise<{ teacher_id: number; avg_score: number; response_count: number }[]>
    create: (data: Partial<TeacherSurvey>) => Promise<TeacherSurvey>
  }
  events: {
    getAll: () => Promise<Event[]>
    getById: (id: number) => Promise<Event | undefined>
    create: (data: unknown) => Promise<Event>
    update: (id: number, data: Partial<Event>) => Promise<Event>
    delete: (id: number) => Promise<{ success: boolean }>
    uploadPoster: (id: number) => Promise<string | null>
  }
  event_participants: {
    getByEvent: (eventId: number) => Promise<EventParticipant[]>
    add: (data: unknown) => Promise<EventParticipant>
    update: (id: number, data: Partial<EventParticipant>) => Promise<EventParticipant>
    remove: (id: number) => Promise<{ success: boolean }>
    reorder: (eventId: number, orderedIds: number[]) => Promise<{ success: boolean }>
  }
  event_rehearsals: {
    getByEvent: (eventId: number) => Promise<EventRehearsal[]>
    create: (data: unknown) => Promise<EventRehearsal>
    update: (id: number, data: Partial<EventRehearsal>) => Promise<EventRehearsal>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  event_checklist: {
    getByEvent: (eventId: number) => Promise<EventChecklist[]>
    create: (data: unknown) => Promise<EventChecklist>
    toggle: (id: number) => Promise<{ success: boolean }>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  event_photos: {
    getByEvent: (eventId: number) => Promise<EventPhoto[]>
    upload: (eventId: number) => Promise<EventPhoto[]>
    delete: (id: number) => Promise<{ success: boolean }>
  }
  auth: {
    login: (email: string, password: string, remember: boolean) => Promise<AuthResult>
    logout: (token: string) => Promise<{ success: boolean }>
    checkSession: (token: string) => Promise<AppUser | null>
    changePassword: (userId: number, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  }
  users: {
    getAll: () => Promise<AppUser[]>
    create: (data: Partial<AppUser> & { password: string }) => Promise<AppUser>
    update: (id: number, data: Partial<AppUser>) => Promise<AppUser>
    delete: (id: number) => Promise<{ success: boolean }>
    resetPassword: (id: number, newPassword: string) => Promise<{ success: boolean }>
  }
  backup: {
    create: () => Promise<{ success: boolean; path: string; filename: string }>
    saveAs: () => Promise<{ success: boolean; path?: string }>
    restore: () => Promise<{ success: boolean; message?: string }>
    listAuto: () => Promise<BackupFile[]>
    runNow: () => Promise<{ success: boolean }>
  }
  logo: {
    upload: () => Promise<string | null>
  }
  ledger: {
    getByStudent: (studentId: number, filters?: { type?: string; dateFrom?: string; dateTo?: string }) => Promise<LedgerEntry[]>
    getBalance:    (studentId: number) => Promise<StudentBalance>
    addManualDebt: (data: { student_id: number; amount: number; description: string; transaction_date: string; created_by?: string }) => Promise<LedgerEntry>
    cancelEntry:   (entryId: number) => Promise<{ success: boolean }>
    addPayment:    (data: { student_id: number; gross_amount: number; discount_amount: number; net_amount: number; payment_method: string; payment_date: string; description?: string; notes?: string; created_by?: string; debt_ids?: number[]; allocation_strategy?: 'fifo' | 'proportional' }) => Promise<{ paymentId: number; ledgerEntryId: number; receiptNumber: string; closedDebtIds: number[] }>
    cancelPayment: (paymentId: number) => Promise<{ success: boolean }>
    getStudentBalances: () => Promise<StudentLedgerBalance[]>
    getOverdueStudents: () => Promise<OverdueStudent[]>
    getPeriodReport: (dateFrom: string, dateTo: string) => Promise<LedgerPeriodReport>
    getMonthlyStats: (year: number, month: number) => Promise<LedgerMonthlyStats>
    addLesson: (data: { student_id: number; teacher_id?: number; student_fee: number; teacher_fee?: number; description: string; lesson_date: string; notes?: string; created_by?: string }) => Promise<{ lessonId: number; studentEntryId: number; teacherEntryId?: number }>
  }
  teacher_ledger: {
    getByTeacher: (teacherId: number, filters?: { type?: string; dateFrom?: string; dateTo?: string }) => Promise<TeacherLedgerEntry[]>
    getBalance:   (teacherId: number) => Promise<TeacherBalance>
    addPayment:   (data: { teacher_id: number; amount: number; description: string; payment_date: string; notes?: string; created_by?: string }) => Promise<{ id: number }>
    cancelEntry:  (entryId: number) => Promise<{ success: boolean }>
    addManualAdjustment: (data: { teacher_id: number; amount: number; adjustment_type: 'earned' | 'paid'; description: string; transaction_date: string; notes?: string; created_by?: string }) => Promise<{ id: number }>
  }
}

declare global {
  interface Window {
    api: IApi
  }
}
