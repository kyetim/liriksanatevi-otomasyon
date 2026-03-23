import { z } from 'zod'

// ─── Ortak tipler ──────────────────────────────────────────────────────────────

const optionalStr = z.string().trim().nullable().optional()
const optionalNum = z.number().nullable().optional()
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()

// ─── Öğrenci ──────────────────────────────────────────────────────────────────

export const StudentCreateSchema = z.object({
  first_name: z.string().trim().min(1, 'Ad zorunlu'),
  last_name: z.string().trim().min(1, 'Soyad zorunlu'),
  birth_date: dateStr,
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  phone: optionalStr,
  email: z.string().email('Geçersiz e-posta').nullable().optional().or(z.literal('')),
  address: optionalStr,
  city: optionalStr,
  parent_name: optionalStr,
  parent_phone: optionalStr,
  parent_email: optionalStr,
  photo_path: optionalStr,
  registration_date: dateStr,
  status: z.enum(['active', 'passive', 'frozen']).optional(),
  notes: optionalStr,
  discount_rate: z.number().min(0).max(100).optional(),
  referral_source: optionalStr,
  referred_by_student_id: optionalNum,
  parent_profile_id: optionalNum,
})

export const StudentUpdateSchema = StudentCreateSchema.partial()

// ─── Öğretmen ─────────────────────────────────────────────────────────────────

export const TeacherCreateSchema = z.object({
  first_name: z.string().trim().min(1, 'Ad zorunlu'),
  last_name: z.string().trim().min(1, 'Soyad zorunlu'),
  birth_date: dateStr,
  phone: optionalStr,
  email: z.string().email('Geçersiz e-posta').nullable().optional().or(z.literal('')),
  address: optionalStr,
  specialization: optionalStr,
  employment_type: z.enum(['full_time', 'part_time', 'freelance']).nullable().optional(),
  salary_type: z.enum(['fixed', 'per_lesson', 'hybrid', 'percentage']).nullable().optional(),
  salary_amount: z.number().nonnegative().nullable().optional(),
  iban: optionalStr,
  hire_date: dateStr,
  status: z.enum(['active', 'passive']).nullable().optional(),
  photo_path: optionalStr,
  notes: optionalStr,
  tc_kimlik_no: optionalStr,
  sgk_no: optionalStr,
  contract_type: optionalStr,
  contract_start: dateStr,
  contract_end: dateStr,
  color_code: optionalStr,
})

export const TeacherUpdateSchema = TeacherCreateSchema.partial()

// ─── Kayıt (Enrollment) ───────────────────────────────────────────────────────

export const EnrollmentCreateSchema = z.object({
  student_id: z.number().int().positive('Öğrenci zorunlu'),
  teacher_id: optionalNum,
  instrument_id: optionalNum,
  lesson_type: z.enum(['individual', 'group']).optional(),
  lesson_duration: z.number().int().positive().optional(),
  lessons_per_week: z.number().int().positive().optional(),
  lesson_days: z.string().optional(),
  lesson_time: optionalStr,
  monthly_fee: z.number().nonnegative().optional(),
  per_lesson_fee: z.number().nonnegative().optional(),
  lesson_pricing_type: z.enum(['monthly', 'per_lesson']).optional(),
  start_date: dateStr,
  end_date: dateStr,
  status: z.enum(['active', 'inactive', 'completed']).optional(),
  notes: optionalStr,
})

export const EnrollmentUpdateSchema = EnrollmentCreateSchema.partial()

// ─── Ders ─────────────────────────────────────────────────────────────────────

export const LessonCreateSchema = z.object({
  enrollment_id: z.number().int().positive('Kayıt zorunlu'),
  student_id: z.number().int().positive('Öğrenci zorunlu'),
  teacher_id: optionalNum,
  lesson_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli tarih giriniz'),
  start_time: optionalStr,
  end_time: optionalStr,
  status: z.enum(['completed', 'cancelled', 'student_absent', 'teacher_absent', 'makeup']).optional(),
  topic_covered: optionalStr,
  homework: optionalStr,
  teacher_notes: optionalStr,
  makeup_lesson_id: optionalNum,
})

// ─── Ödeme ────────────────────────────────────────────────────────────────────

export const PaymentCreateSchema = z.object({
  student_id: z.number().int().positive('Öğrenci zorunlu'),
  enrollment_id: optionalNum,
  payment_type: z.enum(['monthly_fee', 'registration', 'material', 'other']).optional(),
  amount: z.number().nonnegative('Tutar negatif olamaz'),
  discount_amount: z.number().nonnegative().optional(),
  payment_method: z.enum(['cash', 'credit_card', 'bank_transfer', 'eft', 'check', 'promissory_note']).optional(),
  payment_date: dateStr,
  due_date: dateStr,
  period_month: z.number().int().min(1).max(12).nullable().optional(),
  period_year: z.number().int().min(2000).max(2100).nullable().optional(),
  status: z.enum(['paid', 'pending', 'overdue', 'partial']).optional(),
  notes: optionalStr,
  created_by: optionalStr,
})

export const PaymentUpdateSchema = PaymentCreateSchema.partial()

// ─── Gider ────────────────────────────────────────────────────────────────────

export const ExpenseCreateSchema = z.object({
  category: z.string().trim().min(1, 'Kategori zorunlu'),
  description: z.string().trim().min(1, 'Açıklama zorunlu'),
  amount: z.number().positive('Tutar sıfırdan büyük olmalı'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli tarih giriniz'),
  vendor: optionalStr,
  receipt_number: optionalStr,
  notes: optionalStr,
})

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial()

// ─── Enstrüman ────────────────────────────────────────────────────────────────

export const InstrumentCreateSchema = z.object({
  name: z.string().trim().min(1, 'İsim zorunlu'),
  category: optionalStr,
  description: optionalStr,
  color_code: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
})

// ─── Doğrulama yardımcısı ─────────────────────────────────────────────────────

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(', ')
    throw new Error(`Doğrulama hatası: ${messages}`)
  }
  return result.data
}
