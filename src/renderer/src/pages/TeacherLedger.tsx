import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Teacher {
  id: number
  first_name: string
  last_name: string
  phone?: string
  specialization?: string
  employment_type?: string
  salary_type?: string
  salary_amount?: number
  status: string
}

interface TeacherLedgerEntry {
  id: number
  transaction_type: 'lesson_earned' | 'payment_made' | 'manual_adjustment'
  earned_amount: number
  paid_amount: number
  description: string
  status: string
  transaction_date: string
  student_name?: string
  running_balance: number
}

interface TeacherBalance {
  total_earned: number
  total_paid: number
  balance: number
}

const TODAY = new Date().toISOString().split('T')[0]

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit', credit_card: 'Kredi Kartı',
  bank_transfer: 'Havale/EFT', eft: 'EFT', check: 'Çek'
}

const TYPE_LABELS: Record<string, string> = {
  lesson_earned:     'Ders Kazancı',
  payment_made:      'Ödeme Yapıldı',
  manual_adjustment: 'Manuel Düzeltme',
}

const TYPE_COLORS: Record<string, string> = {
  lesson_earned:     'bg-blue-100 text-blue-700',
  payment_made:      'bg-green-100 text-green-700',
  manual_adjustment: 'bg-orange-100 text-orange-700',
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Ödeme Yapma Formu ────────────────────────────────────────────────────────

interface PaymentFormProps {
  teacherId: number
  onClose: () => void
  onSaved: () => void
}

function PaymentForm({ teacherId, onClose, onSaved }: PaymentFormProps) {
  const [date, setDate] = useState(TODAY)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [description, setDescription] = useState('Maaş Ödemesi')
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
      const res = await window.api.teacher_ledger.addPayment({
        teacher_id: teacherId,
        amount: amt,
        description: description || 'Maaş Ödemesi',
        transaction_date: date,
        payment_method: method,
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
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Öğretmene Ödeme Yap</h3>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Maaş ödemesi, avans, prim, vb."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
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
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Not (opsiyonel)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Mart maaşı, vb."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
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

// ─── Manuel Düzeltme Formu ────────────────────────────────────────────────────

interface ManualFormProps {
  teacherId: number
  onClose: () => void
  onSaved: () => void
}

function ManualForm({ teacherId, onClose, onSaved }: ManualFormProps) {
  const [date, setDate] = useState(TODAY)
  const [type, setType] = useState<'earn' | 'pay'>('earn')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!date || isNaN(amt) || amt <= 0 || !description.trim()) {
      setError('Tüm alanları doldurunuz.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await window.api.teacher_ledger.addManualAdjustment({
        teacher_id: teacherId,
        earned_amount: type === 'earn' ? amt : 0,
        paid_amount:   type === 'pay'  ? amt : 0,
        description: description.trim(),
        transaction_date: date,
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
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Manuel Düzeltme</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tür</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType('earn')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'earn' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                Alacak (Kazanç)
              </button>
              <button type="button" onClick={() => setType('pay')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'pay' ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                Ödeme (Borç)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tarih *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Açıklama *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} required
              placeholder="Düzeltme açıklaması"
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

const EMP_LABELS: Record<string, string> = {
  full_time: 'Tam Zamanlı', part_time: 'Yarı Zamanlı', freelance: 'Serbest'
}

export default function TeacherLedger() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const teacherId = Number(id)

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [entries, setEntries] = useState<TeacherLedgerEntry[]>([])
  const [balance, setBalance] = useState<TeacherBalance>({ total_earned: 0, total_paid: 0, balance: 0 })
  const [loading, setLoading] = useState(true)

  const [filterType, setFilterType] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [modal, setModal] = useState<'payment' | 'manual' | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, e, b] = await Promise.all([
      window.api.teachers.getById(teacherId),
      window.api.teacher_ledger.getByTeacher(teacherId, {
        type: filterType === 'all' ? undefined : filterType,
        dateFrom: filterFrom || undefined,
        dateTo: filterTo || undefined,
      }),
      window.api.teacher_ledger.getBalance(teacherId),
    ])
    setTeacher(t as Teacher)
    setEntries((e as TeacherLedgerEntry[]) ?? [])
    setBalance((b as TeacherBalance) ?? { total_earned: 0, total_paid: 0, balance: 0 })
    setLoading(false)
  }, [teacherId, filterType, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  const handleCancelEntry = async (entryId: number) => {
    await window.api.teacher_ledger.cancelEntry(entryId)
    setCancelConfirm(null)
    load()
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: 'bg-green-100 text-green-700', passive: 'bg-gray-100 text-gray-500' }
    const labelMap: Record<string, string> = { active: 'Aktif', passive: 'Pasif' }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] ?? ''}`}>{labelMap[s] ?? s}</span>
  }

  if (loading && !teacher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Yükleniyor…</div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">Öğretmen bulunamadı.</p>
        <button onClick={() => navigate('/teachers')} className="text-blue-600 text-sm underline">Öğretmenler'e dön</button>
      </div>
    )
  }

  // balance = ne kadar alacağı var (kazandı - ödendi)
  const remainingBalance = balance.balance
  const balanceColor = remainingBalance > 0
    ? 'text-orange-600'
    : remainingBalance < 0 ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/teachers')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-3 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Öğretmenler
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                {teacher.first_name[0]}{teacher.last_name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {teacher.first_name} {teacher.last_name}
                  </h1>
                  {statusBadge(teacher.status)}
                </div>
                <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
                  {teacher.phone && <span>📞 {teacher.phone}</span>}
                  {teacher.employment_type && <span>{EMP_LABELS[teacher.employment_type] ?? teacher.employment_type}</span>}
                  {teacher.specialization && <span>{teacher.specialization}</span>}
                  {(teacher.salary_amount ?? 0) > 0 && (
                    <span className="text-gray-400">
                      {teacher.salary_type === 'per_lesson' ? 'Ders başı:' : 'Maaş:'}
                      <span className="font-medium text-gray-600 dark:text-gray-400 ml-1">
                        {fmt(teacher.salary_amount ?? 0)} ₺
                      </span>
                      <span className="ml-1 text-xs text-gray-400">(bilgi)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-2">Kalan Alacak:</span>
              <span className={`text-2xl font-bold ${balanceColor}`}>
                {fmt(remainingBalance)} ₺
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Özet Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Toplam Kazanç</div>
            <div className="text-2xl font-bold text-blue-600">{fmt(balance.total_earned)} ₺</div>
            <div className="text-xs text-gray-400 mt-1">Girilen derslerin toplamı</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Toplam Ödenen</div>
            <div className="text-2xl font-bold text-green-600">{fmt(balance.total_paid)} ₺</div>
            <div className="text-xs text-gray-400 mt-1">Yapılan ödemelerin toplamı</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">
              {remainingBalance > 0 ? 'Kalan Alacak' : remainingBalance < 0 ? 'Fazla Ödeme' : 'Bakiye'}
            </div>
            <div className={`text-2xl font-bold ${balanceColor}`}>
              {fmt(Math.abs(remainingBalance))} ₺
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {remainingBalance > 0 ? 'Öğretmene ödenecek' : remainingBalance < 0 ? 'Fazla ödendi' : 'Dengede'}
            </div>
          </div>
        </div>

        {/* Butonlar + Filtreler */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setModal('payment')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ödeme Yap
            </button>
            <button
              onClick={() => setModal('manual')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manuel Düzeltme
            </button>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <option value="all">Tüm İşlemler</option>
                <option value="lesson_earned">Ders Kazançları</option>
                <option value="payment_made">Yapılan Ödemeler</option>
                <option value="manual_adjustment">Manuel Düzeltmeler</option>
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
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Öğrenci cari hesabına ders eklendiğinde bu öğretmenin işlemleri otomatik yansır.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Tarih</th>
                    <th className="px-4 py-3 text-left">Tür</th>
                    <th className="px-4 py-3 text-left">Açıklama</th>
                    <th className="px-4 py-3 text-left">Öğrenci</th>
                    <th className="px-4 py-3 text-right">Kazanç</th>
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
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {entry.student_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {entry.earned_amount > 0 ? (
                          <span className="text-blue-600">{fmt(entry.earned_amount)} ₺</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {entry.paid_amount > 0 ? (
                          <span className="text-green-600">{fmt(entry.paid_amount)} ₺</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold whitespace-nowrap">
                        <span className={entry.running_balance > 0 ? 'text-orange-600' : entry.running_balance < 0 ? 'text-blue-600' : 'text-gray-500'}>
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

      {modal === 'payment' && (
        <PaymentForm teacherId={teacherId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
      {modal === 'manual' && (
        <ManualForm teacherId={teacherId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
