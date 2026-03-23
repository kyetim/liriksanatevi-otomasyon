import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Payment, Student, Enrollment, PaymentPlan, PaymentPlanItem,
  CashRegister, Refund, VirmanTransfer,
  CASH_REGISTER_TYPE_LABELS,
  REFUND_METHOD_LABELS, OverdueStudent, LedgerMonthlyStats
} from '@renderer/types'
import { formatCurrency, formatDate } from '@renderer/utils/formatters'
import AdvancedPaymentModal from '@components/AdvancedPaymentModal'

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

const TABS = [
  { id: 'payment',   label: 'Ödeme Al',            icon: '💳' },
  { id: 'plans',     label: 'Taksit Planları',      icon: '📋' },
  { id: 'gecikme',   label: 'Gecikmiş Ödemeler',   icon: '🔴' },
  { id: 'tahsilat',  label: 'Aylık Tahsilat',       icon: '📊' },
  { id: 'registers', label: 'Kasalar',              icon: '🏦' },
  { id: 'refunds',   label: 'İade',                 icon: '↩' },
  { id: 'virman',    label: 'Virman',               icon: '↔' },
]

type TabId = typeof TABS[number]['id']

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function ModalBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"

// ─── Tab: Ödeme Al ────────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  monthly_fee: 'Aylık Ücret', registration_fee: 'Kayıt Ücreti',
  material_fee: 'Materyal', other: 'Diğer'
}

function PaymentTab({ students, registers }: { students: Student[]; registers: CashRegister[] }) {
  const [studentId, setStudentId] = useState('')
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [planItems, setPlanItems] = useState<PaymentPlanItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [paymentMethod, setPaymentMethod] = useState<Payment['payment_method']>('cash')
  const [registerId, setRegisterId] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [lateFee, setLateFee] = useState('0')
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [freeForm, setFreeForm] = useState({
    payment_type: 'monthly_fee' as Payment['payment_type'],
    amount: '',
    period_month: String(new Date().getMonth() + 1),
    period_year: String(new Date().getFullYear())
  })

  useEffect(() => {
    if (!studentId) { setPlans([]); setSelectedPlan(null); setPlanItems([]); return }
    window.api.payment_plans.getByStudent(Number(studentId)).then((data: PaymentPlan[]) => {
      setPlans(data.filter(p => p.status === 'active'))
      setSelectedPlan(null); setPlanItems([])
    })
  }, [studentId])

  useEffect(() => {
    if (!selectedPlan) { setPlanItems([]); setSelectedItems(new Set()); return }
    window.api.payment_plan_items.getByPlan(selectedPlan).then((items: PaymentPlanItem[]) => {
      setPlanItems(items); setSelectedItems(new Set())
    })
  }, [selectedPlan])

  const pendingItems = planItems.filter(i => i.status !== 'paid')
  const selectedTotal = pendingItems.filter(i => selectedItems.has(i.id)).reduce((s, i) => s + i.amount, 0)
  const freeAmt = Number(freeForm.amount) || 0
  const baseAmt = selectedPlan ? selectedTotal : freeAmt
  const netTotal = Math.max(0, baseAmt - Number(discountAmount) + Number(lateFee))

  const toggleItem = (id: number) => setSelectedItems(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const handleSave = async () => {
    if (!studentId) return
    setSaving(true)
    try {
      if (selectedPlan && selectedItems.size > 0) {
        // Taksit planı ödemesi — ledger + payments tablosuna yazar
        const result = await window.api.ledger.addPayment({
          student_id: Number(studentId),
          gross_amount: selectedTotal,
          discount_amount: Number(discountAmount),
          net_amount: netTotal,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          description: `Taksit ödemesi`,
          notes: notes || undefined
        })
        for (const itemId of selectedItems) {
          await window.api.payment_plan_items.markPaid(itemId, result.paymentId)
        }
        if (registerId) {
          await window.api.cash_registers.addMovement({
            register_id: Number(registerId), movement_type: 'income',
            amount: netTotal, description: `Taksit ödemesi — ${result.receiptNumber}`,
            payment_id: result.paymentId
          })
        }
      } else {
        // Serbest ödeme — ledger + payments tablosuna yazar
        const desc = PAYMENT_TYPE_LABELS[freeForm.payment_type] || 'Ödeme'
        const result = await window.api.ledger.addPayment({
          student_id: Number(studentId),
          gross_amount: freeAmt,
          discount_amount: Number(discountAmount),
          net_amount: netTotal,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          description: desc,
          notes: notes || undefined
        })
        if (registerId) {
          await window.api.cash_registers.addMovement({
            register_id: Number(registerId), movement_type: 'income',
            amount: netTotal, description: `${desc} — ${result.receiptNumber}`,
            payment_id: result.paymentId
          })
        }
      }
      setSuccess('Ödeme kaydedildi ve cari hesaba işlendi!')
      setSelectedItems(new Set()); setDiscountAmount('0'); setLateFee('0'); setNotes('')
      setFreeForm({ payment_type: 'monthly_fee', amount: '', period_month: String(new Date().getMonth() + 1), period_year: String(new Date().getFullYear()) })
      if (studentId) window.api.payment_plans.getByStudent(Number(studentId)).then((d: PaymentPlan[]) => setPlans(d.filter(p => p.status === 'active')))
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) { alert('Hata: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">Öğrenci ve Taksit Seçimi</h3>
          <Field label="Öğrenci">
            <select className={selectCls} value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">— Öğrenci seçin —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </Field>
          {plans.length > 0 && (
            <Field label="Taksit Planı (opsiyonel)">
              <select className={selectCls} value={selectedPlan ?? ''} onChange={e => setSelectedPlan(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Serbest ödeme —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.title} — {formatCurrency(p.total_amount - (p.paid_amount ?? 0))} kalan</option>)}
              </select>
            </Field>
          )}
          {selectedPlan && pendingItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Ödeme yapılacak taksitler</p>
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {pendingItems.map(item => (
                  <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItem(item.id)} className="accent-primary" />
                    <span className="flex-1 text-sm text-gray-700">Taksit {item.installment_no} — {formatDate(item.due_date)}</span>
                    <span className="text-sm font-medium text-gray-800">{formatCurrency(item.amount)}</span>
                    {new Date(item.due_date) < new Date() && <Badge label="Vadesi Geçmiş" color="bg-red-100 text-red-700" />}
                  </label>
                ))}
              </div>
            </div>
          )}
          {!selectedPlan && studentId && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-600">Serbest Ödeme</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ödeme Türü">
                  <select className={selectCls} value={freeForm.payment_type} onChange={e => setFreeForm(f => ({ ...f, payment_type: e.target.value as Payment['payment_type'] }))}>
                    <option value="monthly_fee">Aylık Ücret</option>
                    <option value="registration_fee">Kayıt Ücreti</option>
                    <option value="material_fee">Materyal</option>
                    <option value="other">Diğer</option>
                  </select>
                </Field>
                <Field label="Tutar (₺)">
                  <input type="number" className={inputCls} value={freeForm.amount} onChange={e => setFreeForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Dönem Ay">
                  <select className={selectCls} value={freeForm.period_month} onChange={e => setFreeForm(f => ({ ...f, period_month: e.target.value }))}>
                    {['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Dönem Yıl">
                  <input type="number" className={inputCls} value={freeForm.period_year} onChange={e => setFreeForm(f => ({ ...f, period_year: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">Ödeme Detayları</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ödeme Tarihi">
              <input type="date" className={inputCls} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </Field>
            <Field label="Ödeme Yöntemi">
              <select className={selectCls} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as Payment['payment_method'])}>
                <option value="cash">Nakit</option>
                <option value="credit_card">Kredi Kartı</option>
                <option value="bank_transfer">Havale / EFT</option>
                <option value="eft">EFT</option>
              </select>
            </Field>
            <Field label="Kasa">
              <select className={selectCls} value={registerId} onChange={e => setRegisterId(e.target.value)}>
                <option value="">— Kasa seçin —</option>
                {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="İndirim (₺)">
              <input type="number" className={inputCls} value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
            </Field>
            <Field label="Gecikme Zammı (₺)">
              <input type="number" className={inputCls} value={lateFee} onChange={e => setLateFee(e.target.value)} />
            </Field>
          </div>
          <Field label="Not">
            <input type="text" className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsiyonel not..." />
          </Field>
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Brüt tutar</span><span>{formatCurrency(baseAmt)}</span>
            </div>
            {Number(discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>İndirim</span><span>−{formatCurrency(Number(discountAmount))}</span>
              </div>
            )}
            {Number(lateFee) > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Gecikme zammı</span><span>+{formatCurrency(Number(lateFee))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-200 pt-2 mt-2">
              <span>Toplam</span>
              <span className="text-primary">{formatCurrency(netTotal)}</span>
            </div>
          </div>
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
                {success}
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleSave} disabled={saving || !studentId}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors">
            {saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Taksit Planları ─────────────────────────────────────────────────────

function PlansTab({ students }: { students: Student[] }) {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null)
  const [planItems, setPlanItems] = useState<PaymentPlanItem[]>([])
  const [form, setForm] = useState({
    student_id: '', enrollment_id: '', title: '', total_amount: '',
    installment_count: '3', start_date: new Date().toISOString().split('T')[0],
    discount_type: 'none', discount_value: '0', notes: ''
  })
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [preview, setPreview] = useState<Array<{ no: number; date: string; amount: number }>>([])

  const load = useCallback(() => { window.api.payment_plans.getAll().then(setPlans) }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (form.student_id) window.api.enrollments.getByStudent(Number(form.student_id)).then(setEnrollments)
    else setEnrollments([])
  }, [form.student_id])

  useEffect(() => {
    if (!form.total_amount || !form.installment_count || !form.start_date) { setPreview([]); return }
    const total = Number(form.total_amount)
    const count = Number(form.installment_count)
    let discounted = total
    if (form.discount_type === 'pesin') discounted = total - Number(form.discount_value)
    else if (form.discount_type === 'percentage') discounted = total * (1 - Number(form.discount_value) / 100)
    else if (form.discount_type === 'fixed') discounted = total - Number(form.discount_value)
    const perInstallment = Math.round((discounted / count) * 100) / 100
    const items = Array.from({ length: count }, (_, i) => {
      const d = new Date(form.start_date); d.setMonth(d.getMonth() + i)
      return { no: i + 1, date: d.toISOString().split('T')[0], amount: perInstallment }
    })
    setPreview(items)
  }, [form.total_amount, form.installment_count, form.start_date, form.discount_type, form.discount_value])

  const handleSave = async () => {
    if (!form.student_id || !form.title || !form.total_amount || preview.length === 0) return
    await window.api.payment_plans.create({
      student_id: Number(form.student_id),
      enrollment_id: form.enrollment_id ? Number(form.enrollment_id) : null,
      title: form.title, total_amount: Number(form.total_amount),
      installment_count: Number(form.installment_count), start_date: form.start_date,
      discount_type: form.discount_type, discount_value: Number(form.discount_value),
      notes: form.notes || null,
      items: preview.map(p => ({ installment_no: p.no, due_date: p.date, amount: p.amount }))
    })
    setShowModal(false)
    setForm({ student_id: '', enrollment_id: '', title: '', total_amount: '', installment_count: '3', start_date: new Date().toISOString().split('T')[0], discount_type: 'none', discount_value: '0', notes: '' })
    load()
  }

  const openPlan = async (plan: PaymentPlan) => {
    setSelectedPlan(plan)
    window.api.payment_plan_items.getByPlan(plan.id).then(setPlanItems)
  }

  const planStatusColors: Record<PaymentPlan['status'], string> = {
    active: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-600'
  }
  const planStatusLabels: Record<PaymentPlan['status'], string> = { active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' }
  const itemStatusColors: Record<PaymentPlanItem['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700', partial: 'bg-orange-100 text-orange-700'
  }
  const itemStatusLabels: Record<PaymentPlanItem['status'], string> = { pending: 'Bekliyor', paid: 'Ödendi', overdue: 'Vadesi Geçmiş', partial: 'Kısmi' }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Taksit Planları ({plans.length})</h3>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white text-sm px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">+ Yeni Plan</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div key={plan.id} onClick={() => openPlan(plan)}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div><p className="font-semibold text-gray-800 text-sm">{plan.title}</p><p className="text-xs text-gray-500">{plan.student_name}</p></div>
              <Badge label={planStatusLabels[plan.status]} color={planStatusColors[plan.status]} />
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-500"><span>Toplam</span><span className="font-medium text-gray-700">{formatCurrency(plan.total_amount)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>Ödenen</span><span className="font-medium text-green-600">{formatCurrency(plan.paid_amount ?? 0)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>Kalan</span><span className="font-medium text-red-500">{formatCurrency(plan.total_amount - (plan.paid_amount ?? 0))}</span></div>
            </div>
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((plan.paid_amount ?? 0) / plan.total_amount) * 100)}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">{plan.installment_count} taksit • {formatDate(plan.start_date)}</p>
          </div>
        ))}
        {plans.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400 text-sm">Henüz taksit planı yok</div>}
      </div>

      {selectedPlan && (
        <ModalBox title={`${selectedPlan.title} — Taksit Detayı`} onClose={() => setSelectedPlan(null)}>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-500">{selectedPlan.student_name}</span>
            <span className="font-semibold text-gray-800">Toplam: {formatCurrency(selectedPlan.total_amount)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {planItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{item.installment_no}</span>
                <span className="flex-1 text-sm text-gray-700">{formatDate(item.due_date)}</span>
                <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                <Badge label={itemStatusLabels[item.status]} color={itemStatusColors[item.status]} />
                {item.paid_at && <span className="text-xs text-gray-400">{formatDate(item.paid_at)}</span>}
              </div>
            ))}
          </div>
        </ModalBox>
      )}

      {showModal && (
        <ModalBox title="Yeni Taksit Planı" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Öğrenci">
                <select className={selectCls} value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                  <option value="">— Seçin —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </Field>
              <Field label="Kayıt (opsiyonel)">
                <select className={selectCls} value={form.enrollment_id} onChange={e => setForm(f => ({ ...f, enrollment_id: e.target.value }))}>
                  <option value="">— Seçin —</option>
                  {enrollments.map(e => <option key={e.id} value={e.id}>{e.instrument_name ?? `Kayıt #${e.id}`}</option>)}
                </select>
              </Field>
              <Field label="Plan Başlığı">
                <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Örn: 2025 Yıllık Taksit" />
              </Field>
              <Field label="Toplam Tutar (₺)">
                <input type="number" className={inputCls} value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </Field>
              <Field label="Taksit Sayısı">
                <input type="number" min="1" max="24" className={inputCls} value={form.installment_count} onChange={e => setForm(f => ({ ...f, installment_count: e.target.value }))} />
              </Field>
              <Field label="Başlangıç Tarihi">
                <input type="date" className={inputCls} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </Field>
              <Field label="İndirim Türü">
                <select className={selectCls} value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                  <option value="none">İndirim Yok</option>
                  <option value="pesin">Peşin İndirim (₺)</option>
                  <option value="percentage">Yüzde (%)</option>
                  <option value="fixed">Sabit (₺)</option>
                </select>
              </Field>
              {form.discount_type !== 'none' && (
                <Field label={form.discount_type === 'percentage' ? 'İndirim (%)' : 'İndirim (₺)'}>
                  <input type="number" className={inputCls} value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
                </Field>
              )}
            </div>
            <Field label="Not"><input className={inputCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>

            {preview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Taksit Önizlemesi</p>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
                  {preview.map(p => (
                    <div key={p.no} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-5 text-gray-400 text-xs">{p.no}.</span>
                      <span className="flex-1 text-gray-700">{formatDate(p.date)}</span>
                      <span className="font-medium text-gray-800">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">İptal</button>
              <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90">Planı Kaydet</button>
            </div>
          </div>
        </ModalBox>
      )}
    </div>
  )
}

// ─── Tab: Kasalar ─────────────────────────────────────────────────────────────

function RegistersTab() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [selected, setSelected] = useState<CashRegister | null>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [showMvForm, setShowMvForm] = useState(false)
  const [mvForm, setMvForm] = useState({ movement_type: 'income', amount: '', description: '' })

  const load = useCallback(() => { window.api.cash_registers.getAll().then(setRegisters) }, [])
  useEffect(() => { load() }, [load])

  const openRegister = async (r: CashRegister) => {
    setSelected(r)
    const mv = await window.api.cash_registers.getMovements(r.id)
    setMovements(mv)
  }

  const refreshSelected = async (r: CashRegister) => {
    load()
    const mv = await window.api.cash_registers.getMovements(r.id)
    setMovements(mv)
    const updated = await window.api.cash_registers.getAll() as CashRegister[]
    setSelected(updated.find(x => x.id === r.id) ?? null)
  }

  const addMovement = async () => {
    if (!selected || !mvForm.amount || !mvForm.description) return
    await window.api.cash_registers.addMovement({
      register_id: selected.id, movement_type: mvForm.movement_type,
      amount: Number(mvForm.amount), description: mvForm.description
    })
    setMvForm({ movement_type: 'income', amount: '', description: '' })
    setShowMvForm(false)
    await refreshSelected(selected)
  }

  const typeIcon: Record<string, string> = { cash: '💵', pos: '💳', bank: '🏦', check: '📄', note: '📃' }
  const isIncome = (t: string) => t === 'income' || t === 'virman_in' || t === 'opening'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {registers.map(r => (
          <div key={r.id} onClick={() => openRegister(r)}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-primary/30">
            <div className="text-2xl mb-2">{typeIcon[r.type] ?? '🏧'}</div>
            <p className="text-xs text-gray-500 mb-1">{CASH_REGISTER_TYPE_LABELS[r.type]}</p>
            <p className="font-semibold text-sm text-gray-800 mb-2">{r.name}</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(r.current_balance)}</p>
            {(r.today_movement_count ?? 0) > 0 && (
              <p className="text-xs text-gray-400 mt-1">{r.today_movement_count} hareket bugün</p>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <ModalBox title={`${selected.name} — Hareketler`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Güncel Bakiye</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(selected.current_balance)}</p>
              </div>
              <button onClick={() => setShowMvForm(!showMvForm)}
                className="text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
                + Hareket Ekle
              </button>
            </div>
            {showMvForm && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tür">
                    <select className={selectCls} value={mvForm.movement_type} onChange={e => setMvForm(f => ({ ...f, movement_type: e.target.value }))}>
                      <option value="income">Gelir</option>
                      <option value="expense">Gider</option>
                    </select>
                  </Field>
                  <Field label="Tutar (₺)">
                    <input type="number" className={inputCls} value={mvForm.amount} onChange={e => setMvForm(f => ({ ...f, amount: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Açıklama">
                  <input className={inputCls} value={mvForm.description} onChange={e => setMvForm(f => ({ ...f, description: e.target.value }))} />
                </Field>
                <button onClick={addMovement} className="w-full bg-primary text-white text-sm rounded-xl py-2 hover:bg-primary/90 transition-colors">Kaydet</button>
              </div>
            )}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {movements.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className={`text-sm font-medium w-28 ${isIncome(m.movement_type) ? 'text-green-600' : 'text-red-500'}`}>
                    {isIncome(m.movement_type) ? '+' : '−'}{formatCurrency(m.amount)}
                  </span>
                  <span className="flex-1 text-sm text-gray-700">{m.description}</span>
                  <span className="text-xs text-gray-400">{formatDate(m.movement_date)}</span>
                </div>
              ))}
              {movements.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">Henüz hareket yok</p>}
            </div>
          </div>
        </ModalBox>
      )}
    </div>
  )
}

// ─── Tab: İade ────────────────────────────────────────────────────────────────

function RefundsTab() {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [showModal, setShowModal] = useState(false)
  const [searchReceipt, setSearchReceipt] = useState('')
  const [foundPayment, setFoundPayment] = useState<Payment | null>(null)
  const [form, setForm] = useState({
    refund_amount: '', reason: '',
    refund_method: 'cash' as Refund['refund_method'],
    refund_date: new Date().toISOString().split('T')[0], notes: ''
  })

  const load = useCallback(() => { window.api.refunds.getAll().then(setRefunds) }, [])
  useEffect(() => { load() }, [load])

  const searchPayment = async () => {
    if (!searchReceipt) return
    const all = await window.api.payments.getAll() as Payment[]
    const found = all.find(p => p.receipt_number === searchReceipt.trim())
    setFoundPayment(found ?? null)
    if (!found) alert('Makbuz bulunamadı: ' + searchReceipt)
  }

  const handleSave = async () => {
    if (!foundPayment) return
    await window.api.refunds.create({
      original_payment_id: foundPayment.id, student_id: foundPayment.student_id,
      refund_amount: Number(form.refund_amount), reason: form.reason,
      refund_method: form.refund_method, refund_date: form.refund_date, notes: form.notes || null
    })
    setShowModal(false)
    setFoundPayment(null); setSearchReceipt('')
    setForm({ refund_amount: '', reason: '', refund_method: 'cash', refund_date: new Date().toISOString().split('T')[0], notes: '' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">İade İşlemleri ({refunds.length})</h3>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white text-sm px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">+ Yeni İade</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['İade Makbuzu','Orijinal Makbuz','Öğrenci','İade Tutarı','Yöntem','Neden','Tarih'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {refunds.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.receipt_number}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.original_receipt}</td>
                <td className="px-4 py-3 text-gray-700">{r.student_name}</td>
                <td className="px-4 py-3 font-semibold text-red-500">{formatCurrency(r.refund_amount)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{REFUND_METHOD_LABELS[r.refund_method]}</td>
                <td className="px-4 py-3 text-gray-600">{r.reason}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.refund_date)}</td>
              </tr>
            ))}
            {refunds.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Henüz iade yok</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ModalBox title="Yeni İade İşlemi" onClose={() => { setShowModal(false); setFoundPayment(null); setSearchReceipt('') }}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Makbuz numarasıyla ara</p>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="LSE-2025-00001" value={searchReceipt}
                  onChange={e => setSearchReceipt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPayment()} />
                <button onClick={searchPayment} className="bg-primary text-white px-4 py-2 rounded-xl text-sm whitespace-nowrap hover:bg-primary/90">Ara</button>
              </div>
            </div>
            {foundPayment && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-blue-800">{foundPayment.student_name}</p>
                <p className="text-blue-600">Makbuz: {foundPayment.receipt_number}</p>
                <p className="text-blue-600">Tutar: {formatCurrency(foundPayment.total_amount)}</p>
                <p className="text-blue-600">Tarih: {formatDate(foundPayment.payment_date)}</p>
              </div>
            )}
            {foundPayment && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="İade Tutarı (₺)">
                  <input type="number" className={inputCls} value={form.refund_amount} max={foundPayment.total_amount}
                    onChange={e => setForm(f => ({ ...f, refund_amount: e.target.value }))} />
                </Field>
                <Field label="İade Yöntemi">
                  <select className={selectCls} value={form.refund_method} onChange={e => setForm(f => ({ ...f, refund_method: e.target.value as Refund['refund_method'] }))}>
                    {Object.entries(REFUND_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="İade Tarihi">
                  <input type="date" className={inputCls} value={form.refund_date} onChange={e => setForm(f => ({ ...f, refund_date: e.target.value }))} />
                </Field>
                <Field label="Neden">
                  <input className={inputCls} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </Field>
                <div className="col-span-2">
                  <Field label="Not"><input className={inputCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setFoundPayment(null); setSearchReceipt('') }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">İptal</button>
              <button onClick={handleSave} disabled={!foundPayment}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">İadeyi Kaydet</button>
            </div>
          </div>
        </ModalBox>
      )}
    </div>
  )
}

// ─── Tab: Virman ──────────────────────────────────────────────────────────────

function VirmanTab({ registers }: { registers: CashRegister[] }) {
  const [transfers, setTransfers] = useState<VirmanTransfer[]>([])
  const [form, setForm] = useState({ from_register_id: '', to_register_id: '', amount: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [localRegs, setLocalRegs] = useState<CashRegister[]>(registers)

  useEffect(() => { setLocalRegs(registers) }, [registers])

  const load = useCallback(() => {
    window.api.virman.getAll().then(setTransfers)
    window.api.cash_registers.getAll().then(setLocalRegs)
  }, [])
  useEffect(() => { load() }, [load])

  const fromReg = localRegs.find(r => r.id === Number(form.from_register_id))

  const handleSave = async () => {
    if (!form.from_register_id || !form.to_register_id || !form.amount || !form.description) return
    if (form.from_register_id === form.to_register_id) { alert('Kaynak ve hedef kasa aynı olamaz'); return }
    setSaving(true)
    try {
      await window.api.virman.create({
        from_register_id: Number(form.from_register_id), to_register_id: Number(form.to_register_id),
        amount: Number(form.amount), description: form.description
      })
      setForm({ from_register_id: '', to_register_id: '', amount: '', description: '' })
      setSuccess('Virman başarıyla yapıldı!')
      load()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) { alert('Hata: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Kasalar Arası Virman</h3>
        <Field label="Kaynak Kasa">
          <select className={selectCls} value={form.from_register_id} onChange={e => setForm(f => ({ ...f, from_register_id: e.target.value }))}>
            <option value="">— Seçin —</option>
            {localRegs.map(r => <option key={r.id} value={r.id}>{r.name} ({formatCurrency(r.current_balance)})</option>)}
          </select>
        </Field>
        {fromReg && (
          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
            Mevcut bakiye: <span className="font-semibold text-gray-800">{formatCurrency(fromReg.current_balance)}</span>
          </div>
        )}
        <Field label="Hedef Kasa">
          <select className={selectCls} value={form.to_register_id} onChange={e => setForm(f => ({ ...f, to_register_id: e.target.value }))}>
            <option value="">— Seçin —</option>
            {localRegs.filter(r => r.id !== Number(form.from_register_id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Tutar (₺)">
          <input type="number" className={inputCls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
        </Field>
        <Field label="Açıklama">
          <input className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Virman nedeni..." />
        </Field>
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
              {success}
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-primary text-white font-medium rounded-xl px-4 py-3 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'İşleniyor...' : 'Virman Yap'}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Virman Geçmişi</h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {transfers.map(t => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.from_register_name} → {t.to_register_name}</p>
                <p className="text-xs text-gray-500 truncate">{t.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-primary">{formatCurrency(t.amount)}</p>
                <p className="text-xs text-gray-400">{formatDate(t.transfer_date)}</p>
              </div>
            </div>
          ))}
          {transfers.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Henüz virman yok</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

// ─── Gecikmiş Ödemeler Sekmesi ────────────────────────────────────────────────
function GecikmisTabs() {
  const [overdueList, setOverdueList] = useState<OverdueStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [payStudent, setPayStudent] = useState<{ id: number; name: string } | null>(null)
  const [smsNote, setSmsNote] = useState<string>('')
  const [smsTarget, setSmsTarget] = useState<OverdueStudent | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.api.ledger.getOverdueStudents()
    setOverdueList(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const agingColor = (days: number) => {
    if (days >= 30) return '#dc2626'
    if (days >= 15) return '#f97316'
    return '#d97706'
  }
  const agingBg = (days: number) => {
    if (days >= 30) return '#fef2f2'
    if (days >= 15) return '#fff7ed'
    return '#fffbeb'
  }
  const agingLabel = (days: number) => {
    if (days >= 30) return 'Kritik'
    if (days >= 15) return 'Gecikmeli'
    return 'Uyarı'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Yükleniyor...</div>
  )

  if (overdueList.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div style={{ fontSize: 40 }}>✅</div>
      <div className="text-gray-500 font-medium">Açık borcu olan öğrenci yok</div>
    </div>
  )

  return (
    <div>
      {/* Özet Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Toplam Borçlu', value: overdueList.length, icon: '👥', color: '#1B3A6B' },
          { label: '30+ Gün Gecikmiş', value: overdueList.filter(o => o.days_overdue >= 30).length, icon: '🔴', color: '#dc2626' },
          { label: 'Toplam Açık Borç', value: `${overdueList.reduce((s, o) => s + o.open_debt, 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`, icon: '💰', color: '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tablo */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Öğrenci', 'Telefon', 'Gecikme', 'Borç Sayısı', 'Toplam Açık Borç', 'İşlemler'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overdueList.map((o, i) => (
              <tr key={o.student_id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151', fontSize: 13 }}>{o.student_name}</td>
                <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{o.phone || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: agingBg(o.days_overdue), color: agingColor(o.days_overdue)
                  }}>
                    {o.days_overdue} gün — {agingLabel(o.days_overdue)}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{o.open_debt_count} borç</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: agingColor(o.days_overdue), fontSize: 13 }}>
                  {o.open_debt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setPayStudent({ id: o.student_id, name: o.student_name })}
                      style={{ fontSize: 11, padding: '4px 10px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                      Ödeme Al
                    </button>
                    <button
                      onClick={() => { setSmsTarget(o); setSmsNote('') }}
                      style={{ fontSize: 11, padding: '4px 10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                      SMS
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ödeme Modalı */}
      {payStudent && (
        <AdvancedPaymentModal
          studentId={payStudent.id}
          studentName={payStudent.name}
          onClose={() => setPayStudent(null)}
          onSuccess={() => { setPayStudent(null); load() }}
        />
      )}

      {/* SMS Modalı */}
      {smsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSmsTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', marginBottom: 4 }}>SMS Gönder</h3>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{smsTarget.student_name} — {smsTarget.phone || 'Telefon yok'}</p>
            {!smsTarget.phone && (
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>Bu öğrencinin telefon numarası kayıtlı değil, SMS gönderilemez.</p>
            )}
            <textarea
              value={smsNote}
              onChange={e => setSmsNote(e.target.value)}
              rows={4}
              placeholder={`Sayın ${smsTarget.student_name}, ${smsTarget.open_debt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ tutarında açık borcunuz bulunmaktadır.`}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setSmsTarget(null)} style={{ padding: '7px 16px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: '#fff', color: '#374151' }}>İptal</button>
              <button onClick={async () => {
                const msg = smsNote || `Sayın ${smsTarget.student_name}, ${smsTarget.open_debt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ tutarında açık borcunuz bulunmaktadır. Lütfen ödeme yapınız.`
                if (smsTarget.phone) {
                  await window.api.sms.send({ phone: smsTarget.phone, message: msg, studentId: smsTarget.student_id, recipientName: smsTarget.student_name })
                }
                setSmsTarget(null)
              }} disabled={!smsTarget.phone} style={{ padding: '7px 16px', background: smsTarget.phone ? '#1B3A6B' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, cursor: smsTarget.phone ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>Gönder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aylık Tahsilat Takip Sekmesi ─────────────────────────────────────────────
function TahsilatTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [stats, setStats] = useState<LedgerMonthlyStats | null>(null)
  const [loading, setLoading] = useState(false)

  const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.api.ledger.getMonthlyStats(year, month)
    setStats(data)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const pct = stats && stats.debtCreated > 0 ? Math.min(100, Math.round(stats.collected / stats.debtCreated * 100)) : 0
  const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

  return (
    <div>
      {/* Ay Seçici */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', minWidth: 120, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 16 }}>›</button>
      </div>

      {loading || !stats ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Yükleniyor...</div>
      ) : (
        <>
          {/* Özet Kartlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Oluşan Borç', value: `${stats.debtCreated.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`, color: '#1B3A6B', icon: '📌' },
              { label: 'Tahsil Edilen', value: `${stats.collected.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`, color: '#16a34a', icon: '✅' },
              { label: 'Kalan', value: `${stats.remaining.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`, color: stats.remaining > 0 ? '#dc2626' : '#16a34a', icon: '⏳' },
              { label: 'Tahsilat Oranı', value: `%${pct}`, color: barColor, icon: '📊' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderTop: `3px solid ${c.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 500 }}>{c.label}</span>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {stats.debtCreated > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Tahsilat İlerleme</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>%{pct}</span>
              </div>
              <div style={{ height: 10, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width .4s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
                <span>Tahsil: {stats.collected.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                <span>Kalan: {stats.remaining.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
              </div>
            </div>
          )}

          {/* Tahsil Edilmeyen Öğrenciler */}
          {stats.uncollectedStudents.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{ background: '#1B3A6B', padding: '9px 14px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>Bu Ay Tahsil Edilemeyen Öğrenciler</span>
                <span style={{ color: '#fff', fontSize: 11, opacity: .8 }}>{stats.uncollectedStudents.length} öğrenci</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Öğrenci', 'Telefon', 'Açık Borç'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.uncollectedStudents.map((s, i) => (
                    <tr key={s.student_id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#374151', fontSize: 12 }}>{s.student_name}</td>
                      <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: 12 }}>{s.phone || '—'}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 700, color: '#dc2626', fontSize: 12 }}>{s.open_debt.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stats.uncollectedStudents.length === 0 && stats.debtCreated > 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#16a34a', fontWeight: 600 }}>
              🎉 Bu ay tüm borçlar tahsil edildi!
            </div>
          )}

          {stats.debtCreated === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              Bu ay için cari hesap kaydı bulunamadı.
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Payments(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('payment')
  const [students, setStudents] = useState<Student[]>([])
  const [registers, setRegisters] = useState<CashRegister[]>([])

  useEffect(() => {
    window.api.students.getAll().then((data: Student[]) => setStudents(data.filter(s => s.status === 'active')))
    window.api.cash_registers.getAll().then(setRegisters)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Sekme başlıkları */}
      <div className="bg-white border-b border-gray-100 px-6 pt-4 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-0" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-xl transition-colors ${
                activeTab === tab.id
                  ? 'text-primary bg-primary/5 border border-b-0 border-primary/20'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sekme içeriği */}
      <div className="flex-1 overflow-y-auto p-6 bg-surface">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {activeTab === 'payment'   && <PaymentTab students={students} registers={registers} />}
            {activeTab === 'plans'     && <PlansTab students={students} />}
            {activeTab === 'gecikme'   && <GecikmisTabs />}
            {activeTab === 'tahsilat'  && <TahsilatTab />}
            {activeTab === 'registers' && <RegistersTab />}
            {activeTab === 'refunds'   && <RefundsTab />}
            {activeTab === 'virman'    && <VirmanTab registers={registers} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
