import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import type { LedgerEntry, StudentBalance } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'credit_card' | 'bank_transfer' | 'eft' | 'check' | 'note'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Nakit', credit_card: 'Kredi Kartı',
  bank_transfer: 'Havale / EFT', eft: 'EFT',
  check: 'Çek', note: 'Senet'
}

interface SaveResult {
  paymentId: number
  receiptNumber: string
  closedDebtIds: number[]
  netAmount: number
  grossAmount: number
  discountAmount: number
  method: PaymentMethod
  date: string
  closedDebts: LedgerEntry[]
  remainingBalance: number
}

interface Props {
  studentId: number
  studentName: string
  onClose: () => void
  onSuccess: () => void
  initialDebtIds?: number[]
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
const fmtMethod = (m: string) => METHOD_LABELS[m as PaymentMethod] ?? m

// ─── Receipt Template (for printing) ─────────────────────────────────────────

function ReceiptTemplate({ result, studentName, settings }: {
  result: SaveResult
  studentName: string
  settings: Record<string, unknown>
}) {
  const getStr = (k: string) => {
    const v = settings[k]
    if (!v) return ''
    try { return JSON.parse(v as string) } catch { return String(v) }
  }
  const academyName = getStr('academy_name') || 'Lirik Sanat Evi'
  const academyPhone = getStr('academy_phone') || ''
  const academyAddress = getStr('academy_address') || ''

  return (
    <div style={{ fontFamily: 'serif', fontSize: 13, color: '#111', padding: 32, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1B3A6B', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1B3A6B' }}>{academyName}</div>
        {academyPhone && <div style={{ fontSize: 11, color: '#555' }}>{academyPhone}</div>}
        {academyAddress && <div style={{ fontSize: 11, color: '#555' }}>{academyAddress}</div>}
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10, letterSpacing: 1 }}>ÖDEME MAKBUZU</div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12 }}>
        <div><strong>Makbuz No:</strong> {result.receiptNumber}</div>
        <div><strong>Tarih:</strong> {new Date(result.date).toLocaleDateString('tr-TR')}</div>
      </div>
      <div style={{ marginBottom: 16, fontSize: 12 }}>
        <strong>Öğrenci:</strong> {studentName}
      </div>

      {/* Paid debts */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1B3A6B', backgroundColor: '#f0f4fb' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Açıklama</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Tutar</th>
          </tr>
        </thead>
        <tbody>
          {result.closedDebts.map(d => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 6px' }}>{d.description}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmt(d.debt_amount)} ₺</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ borderTop: '1px solid #ccc', paddingTop: 8, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Toplam Borç:</span><span>{fmt(result.grossAmount)} ₺</span>
        </div>
        {result.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#16a34a' }}>
            <span>İndirim:</span><span>-{fmt(result.discountAmount)} ₺</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '2px solid #1B3A6B', paddingTop: 6, marginTop: 4 }}>
          <span>NET ÖDENEN:</span><span>{fmt(result.netAmount)} ₺</span>
        </div>
      </div>

      {/* Payment info */}
      <div style={{ marginTop: 16, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
        <div><strong>Ödeme Yöntemi:</strong> {fmtMethod(result.method)}</div>
        <div><strong>Kalan Borç:</strong> {result.remainingBalance > 0 ? fmt(result.remainingBalance) + ' ₺' : '—'}</div>
      </div>

      {/* Signature */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12 }}>
        <div style={{ textAlign: 'center', width: 180 }}>
          <div style={{ borderTop: '1px solid #555', paddingTop: 4 }}>Kaşe / İmza</div>
        </div>
        <div style={{ textAlign: 'center', width: 180 }}>
          <div style={{ borderTop: '1px solid #555', paddingTop: 4 }}>Alan</div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvancedPaymentModal({
  studentId, studentName, onClose, onSuccess, initialDebtIds
}: Props) {
  const [openDebts, setOpenDebts]   = useState<LedgerEntry[]>([])
  const [balance, setBalance]       = useState<StudentBalance | null>(null)
  const [settings, setSettings]     = useState<Record<string, unknown>>({})
  const [loading, setLoading]       = useState(true)

  const [selectedIds, setSelectedIds]       = useState<number[]>(initialDebtIds ?? [])
  const [amountStr, setAmountStr]           = useState('')
  const [discountType, setDiscountType]     = useState<'amount' | 'percent'>('amount')
  const [discountStr, setDiscountStr]       = useState('0')
  const [method, setMethod]                 = useState<PaymentMethod>('cash')
  const [payDate, setPayDate]               = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes]                   = useState('')
  const [strategy, setStrategy]             = useState<'fifo' | 'proportional'>('fifo')
  const [printOnSave, setPrintOnSave]       = useState(true)

  const [saving, setSaving]     = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const receiptRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ content: () => receiptRef.current })

  const load = useCallback(async () => {
    setLoading(true)
    const [debts, bal, setts] = await Promise.all([
      window.api.ledger.getByStudent(studentId),
      window.api.ledger.getBalance(studentId),
      window.api.settings.getAll()
    ])
    const open = (debts as LedgerEntry[]).filter(d => d.status === 'open' && d.debt_amount > d.credit_amount)
    setOpenDebts(open)
    setBalance(bal)
    setSettings(setts)
    if (!initialDebtIds?.length) setSelectedIds(open.map(d => d.id))
    setLoading(false)
  }, [studentId, initialDebtIds])

  useEffect(() => { load() }, [load])

  // ─── Computed ───────────────────────────────────────────────────────────────

  const selected = useMemo(() => openDebts.filter(d => selectedIds.includes(d.id)), [openDebts, selectedIds])
  const selectedTotal = useMemo(() => selected.reduce((s, d) => s + d.debt_amount - d.credit_amount, 0), [selected])

  useEffect(() => {
    if (!saveResult) setAmountStr(selectedTotal > 0 ? selectedTotal.toFixed(2) : '')
  }, [selectedTotal, saveResult])

  const amount = parseFloat(amountStr) || 0
  const discountAmount = useMemo(() => {
    const dv = parseFloat(discountStr) || 0
    return discountType === 'percent' ? Math.round(amount * dv) / 100 : Math.min(dv, amount)
  }, [discountType, discountStr, amount])
  const netAmount = Math.max(0, amount - discountAmount)
  const isPartial = selectedTotal > 0 && netAmount < selectedTotal - 0.01
  const remainingAfter = (balance?.balance ?? 0) - netAmount

  // Preview: which debts will close
  const willClose = useMemo(() => {
    if (!isPartial) return selectedIds
    const sorted = [...selected].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id - b.id)
    if (strategy === 'proportional') {
      return sorted.filter(d => {
        const net = d.debt_amount - d.credit_amount
        return (netAmount * (net / selectedTotal)) >= net - 0.01
      }).map(d => d.id)
    }
    // FIFO
    const closed: number[] = []
    let rem = netAmount
    for (const d of sorted) {
      const net = d.debt_amount - d.credit_amount
      if (rem >= net - 0.01) { closed.push(d.id); rem -= net }
      if (rem <= 0.01) break
    }
    return closed
  }, [isPartial, selectedIds, selected, strategy, netAmount, selectedTotal])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const toggleDebt = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    if (netAmount <= 0 || saving) return
    setSaving(true)
    try {
      const result = await window.api.ledger.addPayment({
        student_id: studentId,
        gross_amount: amount,
        discount_amount: discountAmount,
        net_amount: netAmount,
        payment_method: method,
        payment_date: payDate,
        description: `Ödeme alındı — ${METHOD_LABELS[method]}`,
        notes: notes || undefined,
        debt_ids: selectedIds,
        allocation_strategy: strategy
      })
      const closedDebts = selected.filter(d => result.closedDebtIds.includes(d.id))
      setSaveResult({
        paymentId: result.paymentId,
        receiptNumber: result.receiptNumber,
        closedDebtIds: result.closedDebtIds,
        netAmount,
        grossAmount: amount,
        discountAmount,
        method,
        date: payDate,
        closedDebts,
        remainingBalance: remainingAfter
      })
      onSuccess()
      if (printOnSave) setTimeout(() => handlePrint(), 400)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!saveResult || cancelling) return
    setCancelling(true)
    await window.api.ledger.cancelPayment(saveResult.paymentId)
    setCancelling(false)
    onSuccess()
    onClose()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden receipt for printing */}
      <div style={{ display: 'none' }}>
        <div ref={receiptRef}>
          {saveResult && <ReceiptTemplate result={saveResult} studentName={studentName} settings={settings} />}
        </div>
      </div>

      {/* Modal overlay */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary-100 flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-primary">
                {saveResult ? 'Ödeme Tamamlandı' : 'Ödeme Al'}
              </h2>
              <p className="text-xs text-primary-400">{studentName}</p>
            </div>
            <button onClick={onClose} className="text-primary-300 hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <div className="text-center py-12 text-primary-400">Yükleniyor...</div>
            ) : saveResult ? (
              /* ── SUCCESS PHASE ── */
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">✓</div>
                  <p className="font-semibold text-green-700">{fmt(saveResult.netAmount)} ₺ ödeme kaydedildi</p>
                  <p className="text-xs text-green-600">Makbuz No: {saveResult.receiptNumber}</p>
                </div>
                <div className="border border-primary-100 rounded-lg overflow-hidden">
                  <ReceiptTemplate result={saveResult} studentName={studentName} settings={settings} />
                </div>
              </div>
            ) : (
              /* ── FORM PHASE ── */
              <div className="space-y-5">

                {/* BÖLÜM A — Açık Borçlar */}
                <div className="border border-primary-100 rounded-lg overflow-hidden">
                  <div className="bg-primary-50 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Ödenecek Borçlar ({openDebts.length})</span>
                    <div className="flex gap-2">
                      <button className="text-xs text-primary-500 hover:text-primary underline"
                        onClick={() => setSelectedIds(openDebts.map(d => d.id))}>Tümünü Seç</button>
                      <button className="text-xs text-primary-500 hover:text-primary underline"
                        onClick={() => setSelectedIds([])}>Temizle</button>
                    </div>
                  </div>
                  {openDebts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-primary-400">Açık borç yok</div>
                  ) : (
                    <div className="divide-y divide-primary-50 max-h-48 overflow-y-auto">
                      {openDebts.map(d => {
                        const isSelected = selectedIds.includes(d.id)
                        const willBeClosed = willClose.includes(d.id)
                        return (
                          <label key={d.id}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-primary-25' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleDebt(d.id)}
                              className="rounded border-primary-300 text-primary" />
                            <span className="flex-1 text-xs text-primary">{d.description}</span>
                            <span className="text-xs text-primary-400">{d.transaction_date}</span>
                            <span className={`text-xs font-semibold w-20 text-right ${isSelected && !willBeClosed && isPartial ? 'text-orange-500' : 'text-red-600'}`}>
                              {fmt(d.debt_amount)} ₺
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <div className="px-4 py-2.5 bg-primary-25 border-t border-primary-100 flex justify-between items-center">
                    <span className="text-xs text-primary-500">Seçili Borç Toplamı</span>
                    <span className="text-sm font-bold text-primary">{fmt(selectedTotal)} ₺</span>
                  </div>
                </div>

                {/* BÖLÜM B — Ödeme Bilgileri */}
                <div className="border border-primary-100 rounded-lg p-4 space-y-4">
                  <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Ödeme Bilgileri</h4>

                  {/* Amount + Discount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">Ödeme Tutarı (₺)</label>
                      <input type="number" min="0" step="0.01" className="input text-sm font-semibold"
                        value={amountStr} onChange={e => setAmountStr(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">İndirim</label>
                      <div className="flex gap-1">
                        <select className="input text-xs py-2 w-20 flex-shrink-0"
                          value={discountType} onChange={e => setDiscountType(e.target.value as 'amount' | 'percent')}>
                          <option value="amount">₺</option>
                          <option value="percent">%</option>
                        </select>
                        <input type="number" min="0" step="0.01" className="input text-sm flex-1"
                          value={discountStr} onChange={e => setDiscountStr(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Net amount display */}
                  <div className="bg-primary-50 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-semibold text-primary-600">NET ÖDENECEK</span>
                    <span className="text-xl font-bold text-primary">{fmt(netAmount)} ₺</span>
                  </div>

                  {/* Partial payment notice */}
                  {isPartial && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-orange-700">
                        Kısmi ödeme: {fmt(selectedTotal - netAmount)} ₺ borç kalmaya devam edecek
                      </p>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="strategy" value="fifo" checked={strategy === 'fifo'}
                            onChange={() => setStrategy('fifo')} className="text-primary" />
                          <span className="text-xs text-orange-700">En eski borçtan başla (önerilen)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="strategy" value="proportional" checked={strategy === 'proportional'}
                            onChange={() => setStrategy('proportional')} className="text-primary" />
                          <span className="text-xs text-orange-700">Orantılı dağıt</span>
                        </label>
                      </div>
                      <p className="text-xs text-orange-600">
                        Kapatılacak borçlar ({willClose.length} adet):&nbsp;
                        {openDebts.filter(d => willClose.includes(d.id)).map(d => d.description).join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Method + Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">Ödeme Yöntemi</label>
                      <select className="input text-sm" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
                        {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">Ödeme Tarihi</label>
                      <input type="date" className="input text-sm" value={payDate} onChange={e => setPayDate(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-primary-500 mb-1">Açıklama / Not</label>
                    <input type="text" className="input text-sm" placeholder="İsteğe bağlı..."
                      value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                </div>

                {/* BÖLÜM C — Özet */}
                <div className="border border-primary-100 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Özet</h4>
                  <div className="flex justify-between text-xs">
                    <span className="text-primary-500">Ödeme sonrası kalan borç</span>
                    <span className={`font-semibold ${remainingAfter > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {remainingAfter > 0 ? fmt(remainingAfter) + ' ₺' : 'Borç kalmadı ✓'}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={printOnSave} onChange={e => setPrintOnSave(e.target.checked)}
                      className="rounded border-primary-300 text-primary" />
                    <span className="text-xs text-primary-600">Makbuz yazdır</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-primary-100 flex-shrink-0">
            {saveResult ? (
              <>
                <button onClick={handleCancel} disabled={cancelling}
                  className="btn-outline text-red-600 border-red-300 hover:bg-red-50 flex-1">
                  {cancelling ? 'İptal Ediliyor...' : 'Ödemeyi İptal Et'}
                </button>
                <button onClick={handlePrint} className="btn-outline flex-1">Makbuzu Yazdır</button>
                <button onClick={onClose} className="btn-primary flex-1">Kapat</button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="btn-outline flex-1">Vazgeç</button>
                <button onClick={handleSave} disabled={saving || netAmount <= 0 || selectedIds.length === 0}
                  className="btn-primary flex-1">
                  {saving ? 'Kaydediliyor...' : `${fmt(netAmount)} ₺ Ödemeyi Kaydet`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
