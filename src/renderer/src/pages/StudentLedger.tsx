import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Student {
  id: number
  first_name: string
  last_name: string
  phone?: string
  parent_phone?: string
  status: string
  total_monthly_fee?: number
}

interface Teacher { id: number; first_name: string; last_name: string }

interface LedgerEntry {
  id: number
  transaction_type: 'lesson_debt' | 'payment' | 'manual_debt' | 'discount' | 'refund' | 'correction'
  debt_amount: number
  credit_amount: number
  description: string
  status: string
  transaction_date: string
  running_balance: number
  instrument_name?: string
  lesson_date?: string
}

interface Balance {
  total_debt: number
  total_credit: number
  balance: number
}

const TODAY = new Date().toISOString().split('T')[0]

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit', credit_card: 'Kredi Kartı',
  bank_transfer: 'Havale/EFT', eft: 'EFT', check: 'Çek', promissory_note: 'Senet'
}

const TYPE_LABELS: Record<string, string> = {
  lesson_debt: 'Ders', payment: 'Ödeme', manual_debt: 'Manuel Borç',
  discount: 'İndirim', refund: 'İade', correction: 'Düzeltme'
}

const TYPE_COLORS: Record<string, string> = {
  lesson_debt:  'bg-red-100 text-red-700',
  payment:      'bg-green-100 text-green-700',
  manual_debt:  'bg-orange-100 text-orange-700',
  discount:     'bg-blue-100 text-blue-700',
  refund:       'bg-purple-100 text-purple-700',
  correction:   'bg-gray-100 text-gray-600',
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Ders Ekleme Formu ────────────────────────────────────────────────────────

interface LessonFormProps {
  studentId: number
  teachers: Teacher[]
  onClose: () => void
  onSaved: () => void
}

function LessonForm({ studentId, teachers, onClose, onSaved }: LessonFormProps) {
  const [date, setDate] = useState(TODAY)
  const [teacherId, setTeacherId] = useState('')
  const [studentFee, setStudentFee] = useState('')
  const [teacherFee, setTeacherFee] = useState('')
  const [description, setDescription] = useState('Ders')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [studentFeeHint, setStudentFeeHint] = useState('')
  const [teacherFeeHint, setTeacherFeeHint] = useState('')

  // Öğrencinin aktif kaydından aylık ücret/4 → otomatik doldur
  useEffect(() => {
    window.api.enrollments.getByStudent(studentId).then((enrollments: any[]) => {
      const active = enrollments.find(e => e.status === 'active')
      if (active?.monthly_fee && active.monthly_fee > 0) {
        const perLesson = Math.round(active.monthly_fee / 4 * 100) / 100
        setStudentFee(String(perLesson))
        setStudentFeeHint(`Aylık ${active.monthly_fee.toLocaleString('tr-TR')}₺ ÷ 4 = ${perLesson.toLocaleString('tr-TR')}₺`)
        // Öğretmen atanmışsa ve bu öğrencinin kayıtlı öğretmeni varsa otomatik seç
        if (active.teacher_id) {
          setTeacherId(String(active.teacher_id))
        }
      }
    })
  }, [studentId])

  // Öğretmen seçilince maaş tipine göre öğretmen ücretini hesapla
  useEffect(() => {
    if (!teacherId) { setTeacherFee(''); setTeacherFeeHint(''); return }
    window.api.salary_configs.getByTeacher(Number(teacherId)).then((cfg: any) => {
      const fee = parseFloat(studentFee) || 0
      if (!cfg) { setTeacherFeeHint(''); return }
      if (cfg.salary_type === 'percentage' && cfg.percentage_rate > 0) {
        const tf = Math.round(fee * cfg.percentage_rate / 100 * 100) / 100
        setTeacherFee(String(tf))
        setTeacherFeeHint(`Öğrenci ücretinin %${cfg.percentage_rate}'i = ${tf.toLocaleString('tr-TR')}₺`)
      } else if (cfg.salary_type === 'per_lesson' && cfg.per_lesson_rate > 0) {
        setTeacherFee(String(cfg.per_lesson_rate))
        setTeacherFeeHint(`Ders başı sabit: ${cfg.per_lesson_rate.toLocaleString('tr-TR')}₺`)
      } else if (cfg.salary_type === 'hybrid') {
        const tf = cfg.per_lesson_rate || 0
        setTeacherFee(String(tf))
        setTeacherFeeHint(`Hibrit — ders başı: ${tf.toLocaleString('tr-TR')}₺`)
      } else {
        setTeacherFeeHint('Sabit maaş — ders başı ücret manuel girilmeli')
      }
    })
  }, [teacherId, studentFee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fee = parseFloat(studentFee)
    if (!date || isNaN(fee) || fee <= 0) {
      setError('Tarih ve geçerli bir ücret giriniz.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await window.api.ledger.addLesson({
        student_id: studentId,
        teacher_id: teacherId ? Number(teacherId) : null,
        lesson_date: date,
        student_fee: fee,
        teacher_fee: teacherFee ? parseFloat(teacherFee) : null,
        description: description || 'Ders',
        notes: notes || null,
      })
      if ((res as any)?.error) { setError((res as any).error); setSaving(false); return }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Ders Ekle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tarih *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Öğretmen</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">— Öğretmen seçin (opsiyonel) —</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ders, Piyano dersi, vb."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Öğrenci Ücreti (₺) *</label>
              <input type="number" value={studentFee} onChange={e => setStudentFee(e.target.value)}
                min="0" step="0.01" required placeholder="500"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              {studentFeeHint && <p className="text-xs text-blue-500 mt-1">{studentFeeHint}</p>}
            </div>
            {teacherId && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Öğretmen Ücreti (₺)</label>
                <input type="number" value={teacherFee} onChange={e => setTeacherFee(e.target.value)}
                  min="0" step="0.01" placeholder="0"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                {teacherFeeHint && <p className="text-xs text-blue-500 mt-1">{teacherFeeHint}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Not (opsiyonel)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="İsteğe bağlı not"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Ödeme Alma Formu ─────────────────────────────────────────────────────────

interface PaymentFormProps {
  studentId: number
  onClose: () => void
  onSaved: () => void
}

function PaymentForm({ studentId, onClose, onSaved }: PaymentFormProps) {
  const [date, setDate] = useState(TODAY)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!date || isNaN(amt) || amt <= 0) {
      setError('Tarih ve geçerli bir tutar giriniz.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await window.api.ledger.addPayment({
        student_id: studentId,
        amount: amt,
        payment_method: method,
        payment_date: date,
        notes: notes || null,
      })
      if ((res as any)?.error) { setError((res as any).error); setSaving(false); return }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Ödeme Al</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tarih *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tutar (₺) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              min="0.01" step="0.01" required placeholder="0,00"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ödeme Yöntemi</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Not (opsiyonel)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Mart ödemesi, vb."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Kaydediliyor…' : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Manuel Kayıt Formu ───────────────────────────────────────────────────────

interface ManualFormProps {
  studentId: number
  onClose: () => void
  onSaved: () => void
}

function ManualForm({ studentId, onClose, onSaved }: ManualFormProps) {
  const [date, setDate] = useState(TODAY)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!date || isNaN(amt) || amt <= 0 || !description.trim()) {
      setError('Tüm zorunlu alanları doldurunuz.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await window.api.ledger.addManualDebt({
        student_id: studentId, amount: amt,
        description: description.trim(), transaction_date: date
      })
      if ((res as any)?.error) { setError((res as any).error); setSaving(false); return }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Manuel Borç Kaydı</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tarih *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} required
              placeholder="Kayıt ücreti, materyal bedeli, vb."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tutar (₺) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              min="0.01" step="0.01" required placeholder="0,00"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function StudentLedger() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = Number(id)

  const [student, setStudent] = useState<Student | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [balance, setBalance] = useState<Balance>({ total_debt: 0, total_credit: 0, balance: 0 })
  const [loading, setLoading] = useState(true)

  const [filterType, setFilterType] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [modal, setModal] = useState<'lesson' | 'payment' | 'manual' | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, t, e, b] = await Promise.all([
      window.api.students.getById(studentId),
      window.api.teachers.getAll(),
      window.api.ledger.getByStudent(studentId, {
        type: filterType === 'all' ? undefined : filterType,
        dateFrom: filterFrom || undefined,
        dateTo: filterTo || undefined,
      }),
      window.api.ledger.getBalance(studentId),
    ])
    setStudent(s as Student)
    setTeachers((t as Teacher[]) ?? [])
    setEntries((e as LedgerEntry[]) ?? [])
    setBalance((b as Balance) ?? { total_debt: 0, total_credit: 0, balance: 0 })
    setLoading(false)
  }, [studentId, filterType, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  const handleCancelEntry = async (entryId: number) => {
    await window.api.ledger.cancelEntry(entryId)
    setCancelConfirm(null)
    load()
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700', passive: 'bg-gray-100 text-gray-500', frozen: 'bg-blue-100 text-blue-700'
    }
    const labelMap: Record<string, string> = { active: 'Aktif', passive: 'Pasif', frozen: 'Dondurulmuş' }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] ?? ''}`}>{labelMap[s] ?? s}</span>
  }

  if (loading && !student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Yükleniyor…</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">Öğrenci bulunamadı.</p>
        <button onClick={() => navigate('/students')} className="text-blue-600 text-sm underline">Öğrenciler'e dön</button>
      </div>
    )
  }

  const balanceColor = balance.balance > 0 ? 'text-red-600' : balance.balance < 0 ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/students')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-3 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Öğrenciler
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg">
                {student.first_name[0]}{student.last_name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {student.first_name} {student.last_name}
                  </h1>
                  {statusBadge(student.status)}
                </div>
                <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
                  {student.phone && <span>📞 {student.phone}</span>}
                  {student.parent_phone && <span>👨‍👩‍👧 {student.parent_phone}</span>}
                  {(student.total_monthly_fee ?? 0) > 0 && (
                    <span className="text-gray-400">
                      Aylık: <span className="font-medium text-gray-600 dark:text-gray-400">
                        {fmt(student.total_monthly_fee ?? 0)} ₺
                      </span>
                      <span className="ml-1 text-xs text-gray-400">(bilgi)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bakiye özeti (sağ üst) */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-2">Güncel Bakiye:</span>
              <span className={`text-2xl font-bold ${balanceColor}`}>
                {balance.balance > 0 ? '+' : ''}{fmt(balance.balance)} ₺
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Özet Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Toplam Borç</div>
            <div className="text-2xl font-bold text-red-600">{fmt(balance.total_debt)} ₺</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Toplam Ödeme</div>
            <div className="text-2xl font-bold text-green-600">{fmt(balance.total_credit)} ₺</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">
              {balance.balance > 0 ? 'Kalan Borç' : balance.balance < 0 ? 'Fazla Ödeme' : 'Bakiye'}
            </div>
            <div className={`text-2xl font-bold ${balanceColor}`}>
              {fmt(Math.abs(balance.balance))} ₺
            </div>
          </div>
        </div>

        {/* İşlem Butonları + Filtreler */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setModal('lesson')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ders Ekle
            </button>
            <button
              onClick={() => setModal('payment')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ödeme Al
            </button>
            <button
              onClick={() => setModal('manual')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manuel Kayıt
            </button>

            {/* Filtreler */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <option value="all">Tüm İşlemler</option>
                <option value="lesson_debt">Ders Borçları</option>
                <option value="payment">Ödemeler</option>
                <option value="manual_debt">Manuel Borç</option>
              </select>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
              <span className="text-xs text-gray-400">—</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
              {(filterFrom || filterTo || filterType !== 'all') && (
                <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterType('all') }}
                  className="text-xs text-red-500 hover:text-red-700">Temizle</button>
              )}
            </div>
          </div>
        </div>

        {/* İşlem Tablosu */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Yükleniyor…</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm">Henüz işlem kaydı yok</span>
              <button onClick={() => setModal('lesson')} className="text-sm text-blue-600 hover:underline">İlk dersi ekle →</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Tarih</th>
                    <th className="px-4 py-3 text-left">Tür</th>
                    <th className="px-4 py-3 text-left">Açıklama</th>
                    <th className="px-4 py-3 text-right">Borç</th>
                    <th className="px-4 py-3 text-right">Ödeme</th>
                    <th className="px-4 py-3 text-right">Bakiye</th>
                    <th className="px-4 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {format(new Date(entry.transaction_date), 'dd MMM yyyy', { locale: tr })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[entry.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[entry.transaction_type] ?? entry.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs">
                        <div>{entry.description}</div>
                        {entry.instrument_name && (
                          <div className="text-xs text-gray-400">{entry.instrument_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {entry.debt_amount > 0 ? (
                          <span className="text-red-600">{fmt(entry.debt_amount)} ₺</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {entry.credit_amount > 0 ? (
                          <span className="text-green-600">{fmt(entry.credit_amount)} ₺</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold whitespace-nowrap">
                        <span className={entry.running_balance > 0 ? 'text-red-600' : entry.running_balance < 0 ? 'text-green-600' : 'text-gray-500'}>
                          {fmt(entry.running_balance)} ₺
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cancelConfirm === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleCancelEntry(entry.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium">Evet</button>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => setCancelConfirm(null)}
                              className="text-xs text-gray-500 hover:text-gray-700">Hayır</button>
                          </div>
                        ) : (
                          <button onClick={() => setCancelConfirm(entry.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-xs">
                            İptal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modallar */}
      {modal === 'lesson' && (
        <LessonForm studentId={studentId} teachers={teachers}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
      {modal === 'payment' && (
        <PaymentForm studentId={studentId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
      {modal === 'manual' && (
        <ManualForm studentId={studentId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
