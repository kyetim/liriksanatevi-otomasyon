import { contextBridge, ipcRenderer } from 'electron'

const api = {
  students: {
    getAll:  () => ipcRenderer.invoke('students:getAll'),
    getById: (id: number) => ipcRenderer.invoke('students:getById', id),
    search:  (q: string) => ipcRenderer.invoke('students:search', q),
    create:  (d: unknown) => ipcRenderer.invoke('students:create', d),
    update:    (id: number, d: unknown) => ipcRenderer.invoke('students:update', id, d),
    setStatus: (id: number, status: string) => ipcRenderer.invoke('students:setStatus', id, status),
    delete:    (id: number) => ipcRenderer.invoke('students:delete', id),
    uploadPhoto: (studentId: number) => ipcRenderer.invoke('students:uploadPhoto', studentId)
  },
  teachers: {
    getAll:  () => ipcRenderer.invoke('teachers:getAll'),
    getById: (id: number) => ipcRenderer.invoke('teachers:getById', id),
    create:  (d: unknown) => ipcRenderer.invoke('teachers:create', d),
    update:  (id: number, d: unknown) => ipcRenderer.invoke('teachers:update', id, d),
    delete:          (id: number) => ipcRenderer.invoke('teachers:delete', id),
    getInstruments:  (teacherId: number) => ipcRenderer.invoke('teachers:getInstruments', teacherId),
    setInstruments:  (teacherId: number, ids: number[]) => ipcRenderer.invoke('teachers:setInstruments', teacherId, ids),
    getByInstrument: (instrumentId: number) => ipcRenderer.invoke('teachers:getByInstrument', instrumentId)
  },
  instruments: {
    getAll:   () => ipcRenderer.invoke('instruments:getAll'),
    getActive:() => ipcRenderer.invoke('instruments:getActive'),
    create:   (d: unknown) => ipcRenderer.invoke('instruments:create', d),
    update:   (id: number, d: unknown) => ipcRenderer.invoke('instruments:update', id, d),
    delete:   (id: number) => ipcRenderer.invoke('instruments:delete', id)
  },
  enrollments: {
    getAll:      () => ipcRenderer.invoke('enrollments:getAll'),
    getByStudent:(id: number) => ipcRenderer.invoke('enrollments:getByStudent', id),
    getByTeacher:(id: number) => ipcRenderer.invoke('enrollments:getByTeacher', id),
    create:      (d: unknown) => ipcRenderer.invoke('enrollments:create', d),
    update:      (id: number, d: unknown) => ipcRenderer.invoke('enrollments:update', id, d),
    delete:      (id: number) => ipcRenderer.invoke('enrollments:delete', id)
  },
  lessons: {
    getByDate:      (date: string) => ipcRenderer.invoke('lessons:getByDate', date),
    getByStudent:   (id: number) => ipcRenderer.invoke('lessons:getByStudent', id),
    getByEnrollment:(id: number) => ipcRenderer.invoke('lessons:getByEnrollment', id),
    create:         (d: unknown) => ipcRenderer.invoke('lessons:create', d),
    update:         (id: number, d: unknown) => ipcRenderer.invoke('lessons:update', id, d),
    updateStatus:   (id: number, status: string) => ipcRenderer.invoke('lessons:updateStatus', id, status),
    delete:         (id: number) => ipcRenderer.invoke('lessons:delete', id),
    bulkCreateForDate: (date: string) => ipcRenderer.invoke('lessons:bulkCreateForDate', date),
    completeDay:    (date: string) => ipcRenderer.invoke('lessons:completeDay', date),
    getByDateGroupedByTeacher: (date: string) => ipcRenderer.invoke('lessons:getByDateGroupedByTeacher', date),
    getByDateRange: (dateFrom: string, dateTo: string) => ipcRenderer.invoke('lessons:getByDateRange', dateFrom, dateTo),
    setConfirmation: (id: number, status: string, note?: string) => ipcRenderer.invoke('lessons:setConfirmation', id, status, note),
    createScheduleEntry: (data: unknown) => ipcRenderer.invoke('lessons:createScheduleEntry', data),
    ensureForDateRange: (dateFrom: string, dateTo: string) => ipcRenderer.invoke('lessons:ensureForDateRange', dateFrom, dateTo)
  },
  payments: {
    getAll:      () => ipcRenderer.invoke('payments:getAll'),
    getByMonth:  (y: number, m: number) => ipcRenderer.invoke('payments:getByMonth', y, m),
    getByStudent:(id: number) => ipcRenderer.invoke('payments:getByStudent', id),
    getPending:  () => ipcRenderer.invoke('payments:getPending'),
    create:      (d: unknown) => ipcRenderer.invoke('payments:create', d),
    update:      (id: number, d: unknown) => ipcRenderer.invoke('payments:update', id, d),
    delete:      (id: number) => ipcRenderer.invoke('payments:delete', id)
  },
  expenses: {
    getAll:     () => ipcRenderer.invoke('expenses:getAll'),
    getByMonth: (y: number, m: number) => ipcRenderer.invoke('expenses:getByMonth', y, m),
    create:     (d: unknown) => ipcRenderer.invoke('expenses:create', d),
    update:     (id: number, d: unknown) => ipcRenderer.invoke('expenses:update', id, d),
    delete:     (id: number) => ipcRenderer.invoke('expenses:delete', id)
  },
  makeup: {
    getAll:  () => ipcRenderer.invoke('makeup:getAll'),
    create:  (d: unknown) => ipcRenderer.invoke('makeup:create', d),
    update:  (id: number, d: unknown) => ipcRenderer.invoke('makeup:update', id, d),
    delete:  (id: number) => ipcRenderer.invoke('makeup:delete', id)
  },
  progress: {
    getByStudent:(id: number) => ipcRenderer.invoke('progress:getByStudent', id),
    create:      (d: unknown) => ipcRenderer.invoke('progress:create', d),
    delete:      (id: number) => ipcRenderer.invoke('progress:delete', id)
  },
  inventory: {
    getAll:  () => ipcRenderer.invoke('inventory:getAll'),
    create:  (d: unknown) => ipcRenderer.invoke('inventory:create', d),
    update:  (id: number, d: unknown) => ipcRenderer.invoke('inventory:update', id, d),
    delete:  (id: number) => ipcRenderer.invoke('inventory:delete', id)
  },
  notifications: {
    getUnread:   () => ipcRenderer.invoke('notifications:getUnread'),
    markRead:    (id: number) => ipcRenderer.invoke('notifications:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
    create:      (d: unknown) => ipcRenderer.invoke('notifications:create', d),
    delete:      (id: number) => ipcRenderer.invoke('notifications:delete', id),
    generatePaymentReminders: () => ipcRenderer.invoke('notifications:generatePaymentReminders')
  },
  dashboard: {
    getStats:  () => ipcRenderer.invoke('dashboard:getStats'),
    getKpis:   () => ipcRenderer.invoke('dashboard:getKpis'),
    getAlerts: () => ipcRenderer.invoke('dashboard:getAlerts')
  },
  reports: {
    getFinancial:           (start: string, end: string) => ipcRenderer.invoke('reports:getFinancial', start, end),
    getStudentReport:       (start: string, end: string, type: string) => ipcRenderer.invoke('reports:getStudentReport', start, end, type),
    getTeacherReport:       (start: string, end: string) => ipcRenderer.invoke('reports:getTeacherReport', start, end),
    getInstrumentOccupancy: () => ipcRenderer.invoke('reports:getInstrumentOccupancy')
  },
  settings: {
    getAll:  () => ipcRenderer.invoke('settings:getAll'),
    set:     (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    setBulk: (entries: Record<string, unknown>) => ipcRenderer.invoke('settings:setBulk', entries)
  },
  payment_plans: {
    getAll:       () => ipcRenderer.invoke('payment_plans:getAll'),
    getByStudent: (id: number) => ipcRenderer.invoke('payment_plans:getByStudent', id),
    create:       (d: unknown) => ipcRenderer.invoke('payment_plans:create', d),
    update:       (id: number, d: unknown) => ipcRenderer.invoke('payment_plans:update', id, d),
    delete:       (id: number) => ipcRenderer.invoke('payment_plans:delete', id)
  },
  payment_plan_items: {
    getByPlan: (planId: number) => ipcRenderer.invoke('payment_plan_items:getByPlan', planId),
    markPaid:  (itemId: number, paymentId: number) => ipcRenderer.invoke('payment_plan_items:markPaid', itemId, paymentId),
    update:    (id: number, d: unknown) => ipcRenderer.invoke('payment_plan_items:update', id, d)
  },
  cash_registers: {
    getAll:       () => ipcRenderer.invoke('cash_registers:getAll'),
    openSession:  (registerId: number, openingBalance: number, openedBy?: string) => ipcRenderer.invoke('cash_registers:openSession', registerId, openingBalance, openedBy),
    closeSession: (sessionId: number, closedBy?: string) => ipcRenderer.invoke('cash_registers:closeSession', sessionId, closedBy),
    getMovements: (registerId: number, dateFrom?: string, dateTo?: string) => ipcRenderer.invoke('cash_registers:getMovements', registerId, dateFrom, dateTo),
    addMovement:  (d: unknown) => ipcRenderer.invoke('cash_registers:addMovement', d)
  },
  checks: {
    getAll:    () => ipcRenderer.invoke('checks:getAll'),
    create:    (d: unknown) => ipcRenderer.invoke('checks:create', d),
    update:    (id: number, d: unknown) => ipcRenderer.invoke('checks:update', id, d),
    delete:    (id: number) => ipcRenderer.invoke('checks:delete', id),
    getDueSoon:() => ipcRenderer.invoke('checks:getDueSoon')
  },
  promissory_notes: {
    getAll:    () => ipcRenderer.invoke('promissory_notes:getAll'),
    create:    (d: unknown) => ipcRenderer.invoke('promissory_notes:create', d),
    update:    (id: number, d: unknown) => ipcRenderer.invoke('promissory_notes:update', id, d),
    delete:    (id: number) => ipcRenderer.invoke('promissory_notes:delete', id),
    getDueSoon:() => ipcRenderer.invoke('promissory_notes:getDueSoon')
  },
  refunds: {
    getAll:       () => ipcRenderer.invoke('refunds:getAll'),
    getByStudent: (id: number) => ipcRenderer.invoke('refunds:getByStudent', id),
    create:       (d: unknown) => ipcRenderer.invoke('refunds:create', d)
  },
  virman: {
    getAll: () => ipcRenderer.invoke('virman:getAll'),
    create: (d: unknown) => ipcRenderer.invoke('virman:create', d)
  },
  audit_log: {
    getRecent: () => ipcRenderer.invoke('audit_log:getRecent')
  },
  sms: {
    send:               (d: unknown) => ipcRenderer.invoke('sms:send', d),
    sendBulk:           (items: unknown) => ipcRenderer.invoke('sms:sendBulk', items),
    getHistory:         (params?: unknown) => ipcRenderer.invoke('sms:getHistory', params),
    getHistoryByStudent:(id: number) => ipcRenderer.invoke('sms:getHistoryByStudent', id),
    getMonthlySummary:  (year: number, month: number) => ipcRenderer.invoke('sms:getMonthlySummary', year, month),
    templatesGetAll:    () => ipcRenderer.invoke('sms:templates:getAll'),
    templatesUpdate:    (key: string, content: string) => ipcRenderer.invoke('sms:templates:update', key, content),
    testConnection:     () => ipcRenderer.invoke('sms:testConnection'),
    runDailyJob:        () => ipcRenderer.invoke('sms:runDailyJob'),
    hasCredentials:     () => ipcRenderer.invoke('sms:hasCredentials')
  },
  pre_registrations: {
    getAll:  () => ipcRenderer.invoke('pre_registrations:getAll'),
    create:  (d: unknown) => ipcRenderer.invoke('pre_registrations:create', d),
    update:  (id: number, d: unknown) => ipcRenderer.invoke('pre_registrations:update', id, d),
    convert: (id: number, d: unknown) => ipcRenderer.invoke('pre_registrations:convert', id, d),
    delete:  (id: number) => ipcRenderer.invoke('pre_registrations:delete', id)
  },
  parent_profiles: {
    getAll:      () => ipcRenderer.invoke('parent_profiles:getAll'),
    search:      (q: string) => ipcRenderer.invoke('parent_profiles:search', q),
    create:      (d: unknown) => ipcRenderer.invoke('parent_profiles:create', d),
    update:      (id: number, d: unknown) => ipcRenderer.invoke('parent_profiles:update', id, d),
    getStudents: (parentId: number) => ipcRenderer.invoke('parent_profiles:getStudents', parentId)
  },
  student_freezes: {
    getByStudent: (id: number) => ipcRenderer.invoke('student_freezes:getByStudent', id),
    create:       (d: unknown) => ipcRenderer.invoke('student_freezes:create', d),
    end:          (id: number) => ipcRenderer.invoke('student_freezes:end', id)
  },
  status_history: {
    getByStudent: (id: number) => ipcRenderer.invoke('student_status_history:getByStudent', id)
  },
  departures: {
    getAll:       () => ipcRenderer.invoke('departure_records:getAll'),
    getByStudent: (id: number) => ipcRenderer.invoke('departure_records:getByStudent', id),
    create:       (d: unknown) => ipcRenderer.invoke('departure_records:create', d)
  },
  salary_configs: {
    getByTeacher: (teacherId: number) => ipcRenderer.invoke('salary_configs:getByTeacher', teacherId),
    upsert:       (d: unknown) => ipcRenderer.invoke('salary_configs:upsert', d)
  },
  payrolls: {
    getByMonth:          (year: number, month: number) => ipcRenderer.invoke('payrolls:getByMonth', year, month),
    getByTeacher:        (teacherId: number) => ipcRenderer.invoke('payrolls:getByTeacher', teacherId),
    calculate:           (teacherId: number, year: number, month: number) => ipcRenderer.invoke('payrolls:calculate', teacherId, year, month),
    update:              (id: number, d: unknown) => ipcRenderer.invoke('payrolls:update', id, d),
    markPaid:            (id: number, d: unknown) => ipcRenderer.invoke('payrolls:markPaid', id, d),
    delete:              (id: number) => ipcRenderer.invoke('payrolls:delete', id),
    getPerformanceReport:(year: number, month: number) => ipcRenderer.invoke('payrolls:getPerformanceReport', year, month)
  },
  advances: {
    getByTeacher: (teacherId: number) => ipcRenderer.invoke('advances:getByTeacher', teacherId),
    getAll:       (year: number, month: number) => ipcRenderer.invoke('advances:getAll', year, month),
    create:       (d: unknown) => ipcRenderer.invoke('advances:create', d),
    cancel:       (id: number) => ipcRenderer.invoke('advances:cancel', id)
  },
  bonuses: {
    getByTeacher: (teacherId: number) => ipcRenderer.invoke('bonuses:getByTeacher', teacherId),
    getAll:       (year: number, month: number) => ipcRenderer.invoke('bonuses:getAll', year, month),
    create:       (d: unknown) => ipcRenderer.invoke('bonuses:create', d),
    delete:       (id: number) => ipcRenderer.invoke('bonuses:delete', id)
  },
  leaves: {
    getAll:      (filters: unknown) => ipcRenderer.invoke('leaves:getAll', filters),
    getByTeacher:(teacherId: number) => ipcRenderer.invoke('leaves:getByTeacher', teacherId),
    create:      (d: unknown) => ipcRenderer.invoke('leaves:create', d),
    approve:     (id: number, by: string) => ipcRenderer.invoke('leaves:approve', id, by),
    reject:      (id: number) => ipcRenderer.invoke('leaves:reject', id),
    getCalendar: (year: number, month: number) => ipcRenderer.invoke('leaves:getCalendar', year, month)
  },
  leave_balances: {
    getByTeacher:(teacherId: number, year: number) => ipcRenderer.invoke('leave_balances:getByTeacher', teacherId, year),
    update:      (id: number, totalDays: number) => ipcRenderer.invoke('leave_balances:update', id, totalDays)
  },
  teacher_documents: {
    getByTeacher:(teacherId: number) => ipcRenderer.invoke('teacher_documents:getByTeacher', teacherId),
    upload:      (teacherId: number) => ipcRenderer.invoke('teacher_documents:upload', teacherId),
    create:      (d: unknown) => ipcRenderer.invoke('teacher_documents:create', d),
    open:        (filePath: string) => ipcRenderer.invoke('teacher_documents:open', filePath),
    delete:      (id: number) => ipcRenderer.invoke('teacher_documents:delete', id)
  },
  surveys: {
    getByTeacher:(teacherId: number) => ipcRenderer.invoke('surveys:getByTeacher', teacherId),
    getMonthly:  (year: number, month: number) => ipcRenderer.invoke('surveys:getMonthly', year, month),
    create:      (d: unknown) => ipcRenderer.invoke('surveys:create', d)
  },
  events: {
    getAll:       () => ipcRenderer.invoke('events:getAll'),
    getById:      (id: number) => ipcRenderer.invoke('events:getById', id),
    create:       (d: unknown) => ipcRenderer.invoke('events:create', d),
    update:       (id: number, d: unknown) => ipcRenderer.invoke('events:update', id, d),
    delete:       (id: number) => ipcRenderer.invoke('events:delete', id),
    uploadPoster: (id: number) => ipcRenderer.invoke('events:uploadPoster', id)
  },
  event_participants: {
    getByEvent: (eventId: number) => ipcRenderer.invoke('event_participants:getByEvent', eventId),
    add:        (d: unknown) => ipcRenderer.invoke('event_participants:add', d),
    update:     (id: number, d: unknown) => ipcRenderer.invoke('event_participants:update', id, d),
    remove:     (id: number) => ipcRenderer.invoke('event_participants:remove', id),
    reorder:    (eventId: number, orderedIds: number[]) => ipcRenderer.invoke('event_participants:reorder', eventId, orderedIds)
  },
  event_rehearsals: {
    getByEvent: (eventId: number) => ipcRenderer.invoke('event_rehearsals:getByEvent', eventId),
    create:     (d: unknown) => ipcRenderer.invoke('event_rehearsals:create', d),
    update:     (id: number, d: unknown) => ipcRenderer.invoke('event_rehearsals:update', id, d),
    delete:     (id: number) => ipcRenderer.invoke('event_rehearsals:delete', id)
  },
  event_checklist: {
    getByEvent: (eventId: number) => ipcRenderer.invoke('event_checklist:getByEvent', eventId),
    create:     (d: unknown) => ipcRenderer.invoke('event_checklist:create', d),
    toggle:     (id: number) => ipcRenderer.invoke('event_checklist:toggle', id),
    delete:     (id: number) => ipcRenderer.invoke('event_checklist:delete', id)
  },
  event_photos: {
    getByEvent: (eventId: number) => ipcRenderer.invoke('event_photos:getByEvent', eventId),
    upload:     (eventId: number) => ipcRenderer.invoke('event_photos:upload', eventId),
    delete:     (id: number) => ipcRenderer.invoke('event_photos:delete', id)
  },
  auth: {
    login:          (email: string, password: string, remember: boolean) => ipcRenderer.invoke('auth:login', email, password, remember),
    logout:         (token: string) => ipcRenderer.invoke('auth:logout', token),
    checkSession:   (token: string) => ipcRenderer.invoke('auth:checkSession', token),
    changePassword: (userId: number, oldPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword)
  },
  users: {
    getAll:        () => ipcRenderer.invoke('users:getAll'),
    create:        (d: unknown) => ipcRenderer.invoke('users:create', d),
    update:        (id: number, d: unknown) => ipcRenderer.invoke('users:update', id, d),
    delete:        (id: number) => ipcRenderer.invoke('users:delete', id),
    resetPassword: (id: number, newPassword: string) => ipcRenderer.invoke('users:resetPassword', id, newPassword)
  },
  backup: {
    create:   () => ipcRenderer.invoke('backup:create'),
    saveAs:   () => ipcRenderer.invoke('backup:saveAs'),
    restore:  () => ipcRenderer.invoke('backup:restore'),
    listAuto: () => ipcRenderer.invoke('backup:listAuto'),
    runNow:   () => ipcRenderer.invoke('backup:runNow')
  },
  logo: {
    upload: () => ipcRenderer.invoke('settings:uploadLogo')
  },
  ledger: {
    getByStudent: (studentId: number, filters?: { type?: string; dateFrom?: string; dateTo?: string }) =>
      ipcRenderer.invoke('ledger:getByStudent', studentId, filters),
    getBalance:    (studentId: number) => ipcRenderer.invoke('ledger:getBalance', studentId),
    addManualDebt: (data: unknown) => ipcRenderer.invoke('ledger:addManualDebt', data),
    cancelEntry:   (entryId: number) => ipcRenderer.invoke('ledger:cancelEntry', entryId),
    addLesson:     (data: unknown) => ipcRenderer.invoke('ledger:addLesson', data),
    addPayment:          (data: unknown) => ipcRenderer.invoke('ledger:addPayment', data),
    cancelPayment:       (paymentId: number) => ipcRenderer.invoke('ledger:cancelPayment', paymentId),
    getStudentBalances:  () => ipcRenderer.invoke('ledger:getStudentBalances'),
    getOverdueStudents:  () => ipcRenderer.invoke('ledger:getOverdueStudents'),
    getPeriodReport:     (dateFrom: string, dateTo: string) => ipcRenderer.invoke('ledger:getPeriodReport', dateFrom, dateTo),
    getMonthlyStats:     (year: number, month: number) => ipcRenderer.invoke('ledger:getMonthlyStats', year, month)
  },
  teacher_ledger: {
    getByTeacher:       (teacherId: number, filters?: { type?: string; dateFrom?: string; dateTo?: string }) =>
      ipcRenderer.invoke('teacher_ledger:getByTeacher', teacherId, filters),
    getBalance:         (teacherId: number) => ipcRenderer.invoke('teacher_ledger:getBalance', teacherId),
    addPayment:         (data: unknown) => ipcRenderer.invoke('teacher_ledger:addPayment', data),
    cancelEntry:        (entryId: number) => ipcRenderer.invoke('teacher_ledger:cancelEntry', entryId),
    addManualAdjustment:(data: unknown) => ipcRenderer.invoke('teacher_ledger:addManualAdjustment', data)
  }
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) }
  catch (e) { console.error(e) }
} else {
  (window as any).api = api
}
