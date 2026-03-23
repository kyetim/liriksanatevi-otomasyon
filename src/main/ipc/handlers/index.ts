import { registerStudentHandlers } from './students'
import { registerTeacherHandlers } from './teachers'
import { registerEnrollmentHandlers } from './enrollments'
import { registerLessonHandlers } from './lessons'
import { registerPaymentHandlers } from './payments'
import { registerFinanceHandlers } from './finance'
import { registerNotificationHandlers } from './notifications'
import { registerDashboardHandlers } from './dashboard'
import { registerReportHandlers } from './reports'
import { registerSettingsHandlers } from './settings'
import { registerSmsHandlers } from './sms'
import { registerHrHandlers } from './hr'
import { registerEventHandlers } from './events'
import { registerAuthHandlers } from './auth'
import { registerBackupHandlers } from './backup'
import { registerLedgerHandlers } from './ledger'

export function registerIpcHandlers(): void {
  registerStudentHandlers()
  registerTeacherHandlers()
  registerEnrollmentHandlers()
  registerLessonHandlers()
  registerPaymentHandlers()
  registerFinanceHandlers()
  registerNotificationHandlers()
  registerDashboardHandlers()
  registerReportHandlers()
  registerSettingsHandlers()
  registerSmsHandlers()
  registerHrHandlers()
  registerEventHandlers()
  registerAuthHandlers()
  registerBackupHandlers()
  registerLedgerHandlers()
}
