import { useEffect, useState, useRef, useCallback, Component, type ReactNode } from 'react'
import { useReactToPrint } from 'react-to-print'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine,
  ComposedChart
} from 'recharts'
import type { FinancialReport, StudentAttendanceRow, StudentEnrollmentReport, TeacherReport, NetGrowthReport, InstrumentOccupancy, LedgerPeriodReport } from '../types'
import { MONTH_NAMES } from '../types'

class ReportErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Rapor yüklenirken hata oluştu</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{this.state.error.message}</div>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '6px 16px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Yeniden Dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const PRIMARY = '#1B3A6B'
const ACCENT = '#C9A84C'
const SUCCESS = '#16a34a'
const DANGER = '#dc2626'
const WARN = '#d97706'
const INFO = '#2563eb'
const CHART_COLORS = ['#1B3A6B', '#C9A84C', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899']

function fmtMoney(n: number) {
  return n?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00'
}
function fmt(n: number) { return (n ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) }
function monthLabel(year: number, month: number) { return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}` }
function getDefaultRange() {
  const now = new Date()
  return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().split('T')[0] }
}

function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Rapor') {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

// ─── REPORT CATEGORIES ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    group: 'Finansal Raporlar',
    items: [
      { id: 'monthly_revenue',  label: 'Aylık Gelir Raporu' },
      { id: 'payment_detail',   label: 'Ödeme Detay Raporu' },
      { id: 'overdue_aging',    label: 'Gecikmiş Ödemeler' },
      { id: 'expense_analysis', label: 'Gider Analizi' },
      { id: 'profit_loss',      label: 'Kar / Zarar Raporu' },
      { id: 'payment_methods',  label: 'Ödeme Yöntemi Dağılımı' },
    ]
  },
  {
    group: 'Öğrenci Raporları',
    items: [
      { id: 'student_attendance', label: 'Devamsızlık Raporu' },
      { id: 'enrollment_report',  label: 'Kayıt & Ayrılış Raporu' },
      { id: 'net_growth',         label: 'Net Büyüme Analizi' },
    ]
  },
  {
    group: 'Öğretmen Raporları',
    items: [
      { id: 'teacher_workload',   label: 'Öğretmen Performans' },
      { id: 'lesson_completion',  label: 'Ders Gerçekleşme Raporu' },
    ]
  },
  {
    group: 'Enstrüman Raporları',
    items: [
      { id: 'instrument_occupancy', label: 'Enstrüman Doluluk Raporu' },
    ]
  },
  {
    group: 'Cari Hesap',
    items: [
      { id: 'cari_hesap', label: 'Cari Hesap Raporu' },
    ]
  }
]

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function SummaryCard({ label, value, color = PRIMARY, sub, trend }: { label: string; value: string | number; color?: string; sub?: string; trend?: { value: number; label: string } }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      {trend && (
        <div style={{ fontSize: 11, marginTop: 4, color: trend.value >= 0 ? SUCCESS : DANGER, fontWeight: 600 }}>
          {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}% {trend.label}
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: 14 }}>
      {title && <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  )
}

function Table({ headers, rows, accentColor = PRIMARY }: { headers: string[]; rows: (string | number | React.ReactNode)[][]; accentColor?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: accentColor, color: '#fff' }}>
            {headers.map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '6px 10px', fontSize: 11 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExportRow({ onExcel, label = 'Excel İndir', onPrint }: { onExcel: () => void; label?: string; onPrint?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
      {onPrint && (
        <button onClick={onPrint} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🖨 PDF Yazdır
        </button>
      )}
      <button onClick={onExcel} style={{ background: SUCCESS, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        📊 {label}
      </button>
    </div>
  )
}

function ProgressBar({ value, color = PRIMARY, showLabel = true }: { value: number; color?: string; showLabel?: boolean }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 9999, height: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width .3s' }} />
      </div>
      {showLabel && <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 28 }}>%{pct.toFixed(0)}</span>}
    </div>
  )
}

// ─── 1. AYLIK GELİR RAPORU ──────────────────────────────────────────────────
function MonthlyRevenueReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const rows = data.monthlyRevenue ?? []
  const totalIncome = data.totalIncome ?? 0
  const prevIncome = data.prevPeriodIncome ?? 0
  const growthPct = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0
  const byInstrument = data.byInstrument ?? []
  const instTotal = byInstrument.reduce((s, r) => s + r.total, 0)

  const excelData = rows.map(r => ({
    'Dönem': monthLabel(r.year, r.month),
    'Tahsilat (₺)': r.income,
    'Kısmi (₺)': r.partial_income,
    'Bekleyen (₺)': r.pending,
    'Ödeme Sayısı': r.payment_count
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Tahsilat" value={`${fmtMoney(totalIncome)} ₺`} color={SUCCESS}
          trend={prevIncome > 0 ? { value: growthPct, label: 'önceki döneme göre' } : undefined} />
        <SummaryCard label="Önceki Dönem" value={`${fmtMoney(prevIncome)} ₺`} color={INFO} />
        <SummaryCard label="Bekleyen" value={`${fmtMoney(rows.reduce((s, r) => s + r.pending, 0))} ₺`} color={WARN} />
        <SummaryCard label="Dönem Sayısı" value={rows.length} color={PRIMARY} />
      </div>

      <Card title="Aylık Gelir Grafiği">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows.map(r => ({ name: `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`, Tahsilat: r.income, Bekleyen: r.pending }))} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
            <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Tahsilat" fill={PRIMARY} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Bekleyen" fill={WARN} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {byInstrument.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Card title="Enstrümana Göre Gelir Dağılımı">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byInstrument} dataKey="total" nameKey="instrument_name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                  {byInstrument.map((r, i) => <Cell key={i} fill={r.color_code || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Enstrüman Detayı">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>
                {['Enstrüman', 'Gelir', 'Adet', 'Oran'].map(h => <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 10 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {byInstrument.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '5px 6px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: r.color_code || CHART_COLORS[i % CHART_COLORS.length], marginRight: 6 }} />
                      {r.instrument_name ?? '—'}
                    </td>
                    <td style={{ padding: '5px 6px', fontWeight: 700, color: SUCCESS }}>{fmtMoney(r.total)} ₺</td>
                    <td style={{ padding: '5px 6px', color: '#6b7280' }}>{r.cnt}</td>
                    <td style={{ padding: '5px 6px', minWidth: 80 }}>
                      <ProgressBar value={instTotal > 0 ? (r.total / instTotal) * 100 : 0} color={r.color_code || PRIMARY} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <Table
        headers={['Dönem', 'Tahsilat', 'Kısmi', 'Bekleyen', 'Ödeme Sayısı']}
        rows={rows.map(r => [
          monthLabel(r.year, r.month),
          <span style={{ color: SUCCESS, fontWeight: 700 }}>{fmtMoney(r.income)} ₺</span>,
          <span style={{ color: INFO }}>{fmtMoney(r.partial_income)} ₺</span>,
          <span style={{ color: r.pending > 0 ? WARN : '#9ca3af' }}>{fmtMoney(r.pending)} ₺</span>,
          r.payment_count
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'aylik-gelir-raporu.xlsx', 'Gelir')} onPrint={onPrint} />
    </div>
  )
}

// ─── 2. ÖDEME DETAY RAPORU ──────────────────────────────────────────────────
function PaymentDetailReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const payments = data.payments as any[]
  const STATUS_LABELS: Record<string, string> = { paid: 'Ödendi', partial: 'Kısmi', pending: 'Bekliyor', overdue: 'Gecikmiş', cancelled: 'İptal' }
  const STATUS_COLORS: Record<string, string> = { paid: SUCCESS, partial: INFO, pending: WARN, overdue: DANGER, cancelled: '#9ca3af' }
  const excelData = payments.map(p => ({
    'Öğrenci': p.student_name, 'Tarih': p.payment_date, 'Tutar (₺)': p.total_amount,
    'Durum': STATUS_LABELS[p.status] || p.status, 'Yöntem': p.payment_method || '', 'Tür': p.payment_type || ''
  }))
  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam İşlem" value={payments.length} color={PRIMARY} />
        <SummaryCard label="Tahsilat" value={`${fmtMoney(data.totalIncome)} ₺`} color={SUCCESS} />
        <SummaryCard label="Bekleyen" value={payments.filter(p => p.status === 'pending').length} color={WARN} sub="adet" />
      </div>
      <Table
        headers={['Öğrenci', 'Tarih', 'Tutar', 'Durum', 'Yöntem', 'Tür', 'Makbuz']}
        rows={payments.map(p => [
          <span style={{ fontWeight: 600 }}>{p.student_name}</span>,
          p.payment_date ? new Date(p.payment_date).toLocaleDateString('tr-TR') : '—',
          <span style={{ fontWeight: 700, color: STATUS_COLORS[p.status] || '#222' }}>{fmtMoney(p.total_amount)} ₺</span>,
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#fff', background: STATUS_COLORS[p.status] || '#888' }}>{STATUS_LABELS[p.status] || p.status}</span>,
          p.payment_method || '—',
          p.payment_type || '—',
          p.receipt_number || '—'
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'odeme-detay-raporu.xlsx', 'Ödemeler')} onPrint={onPrint} />
    </div>
  )
}

// ─── 3. GECİKMİŞ ÖDEMELER ──────────────────────────────────────────────────
function OverdueAgingReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const rows = data.overdueAging
  const total = rows.reduce((s, r) => s + r.total_amount, 0)
  const buckets = [
    { label: '0-30 gün', count: rows.filter(r => r.days_overdue <= 30).length, amount: rows.filter(r => r.days_overdue <= 30).reduce((s, r) => s + r.total_amount, 0), color: WARN },
    { label: '31-60 gün', count: rows.filter(r => r.days_overdue > 30 && r.days_overdue <= 60).length, amount: rows.filter(r => r.days_overdue > 30 && r.days_overdue <= 60).reduce((s, r) => s + r.total_amount, 0), color: '#f97316' },
    { label: '60+ gün', count: rows.filter(r => r.days_overdue > 60).length, amount: rows.filter(r => r.days_overdue > 60).reduce((s, r) => s + r.total_amount, 0), color: DANGER },
  ]
  const excelData = rows.map(r => ({
    'Öğrenci': r.student_name, 'Tel': r.phone || '', 'Tutar (₺)': r.total_amount,
    'Vade': r.due_date || '', 'Dönem': `${r.period_month}/${r.period_year}`, 'Gecikme (gün)': r.days_overdue
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Gecikmiş" value={`${fmtMoney(total)} ₺`} color={DANGER} />
        <SummaryCard label="Gecikmiş Öğrenci" value={rows.length} color={WARN} sub="adet" />
        {buckets.map(b => <SummaryCard key={b.label} label={b.label} value={`${fmtMoney(b.amount)} ₺`} color={b.color} sub={`${b.count} öğrenci`} />)}
      </div>
      <Card title="Yaşlandırma Dağılımı">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={buckets} layout="vertical" margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Table
        headers={['Öğrenci', 'Tel', 'Tutar', 'Dönem', 'Gecikme']}
        accentColor={DANGER}
        rows={rows.map(r => [
          <span style={{ fontWeight: 600 }}>{r.student_name}</span>,
          r.phone || '—',
          <span style={{ fontWeight: 700, color: DANGER }}>{fmtMoney(r.total_amount)} ₺</span>,
          `${r.period_month}/${r.period_year}`,
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: r.days_overdue > 60 ? DANGER : r.days_overdue > 30 ? '#f97316' : WARN }}>{r.days_overdue} gün</span>
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'gecikme-raporu.xlsx', 'Gecikmiş')} onPrint={onPrint} />
    </div>
  )
}

// ─── 4. GİDER ANALİZİ ───────────────────────────────────────────────────────
function ExpenseAnalysisReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const total = data.expensesByCategory.reduce((s, r) => s + r.total, 0)
  const CAT_LABELS: Record<string, string> = { rent: 'Kira', salary: 'Maaş', utility: 'Faturalar', material: 'Malzeme', maintenance: 'Bakım/Onarım', marketing: 'Pazarlama', other: 'Diğer' }
  const excelData = (data.expensesList as any[]).map(e => ({
    'Tarih': e.payment_date, 'Kategori': CAT_LABELS[e.category] || e.category,
    'Açıklama': e.description || '', 'Tutar (₺)': e.amount, 'Ödenen': e.paid_to_name || e.paid_to || ''
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Gider" value={`${fmtMoney(total)} ₺`} color={DANGER} />
        <SummaryCard label="Kategori Sayısı" value={data.expensesByCategory.length} color={PRIMARY} />
        <SummaryCard label="İşlem Sayısı" value={(data.expensesList as any[]).length} color={INFO} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="Kategoriye Göre Dağılım">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.expensesByCategory.map(r => ({ ...r, category: CAT_LABELS[r.category] || r.category }))} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                {data.expensesByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Aylık Gider Trendi">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthlyExpenses.map(r => ({ name: `${MONTH_NAMES[r.month - 1].slice(0, 3)}`, gider: r.expenses }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="gider" stroke={DANGER} fill={DANGER + '20'} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Table
        headers={['Tarih', 'Kategori', 'Açıklama', 'Ödenen', 'Tutar']}
        accentColor={DANGER}
        rows={(data.expensesList as any[]).map(e => [
          e.payment_date ? new Date(e.payment_date).toLocaleDateString('tr-TR') : '—',
          CAT_LABELS[e.category] || e.category,
          <span style={{ color: '#6b7280' }}>{e.description || '—'}</span>,
          e.paid_to_name || e.paid_to || '—',
          <span style={{ fontWeight: 700, color: DANGER }}>{fmtMoney(e.amount)} ₺</span>
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'gider-analizi.xlsx', 'Giderler')} onPrint={onPrint} />
    </div>
  )
}

// ─── 5. KAR/ZARAR RAPORU ────────────────────────────────────────────────────
function ProfitLossReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const netProfit = data.totalIncome - data.totalExpenses
  const margin = data.totalIncome > 0 ? Math.round((netProfit / data.totalIncome) * 100) : 0
  const allMonths = new Map<string, { label: string; gelir: number; gider: number; kar: number }>()
  data.monthlyRevenue.forEach(r => {
    const k = `${r.year}-${r.month}`
    if (!allMonths.has(k)) allMonths.set(k, { label: `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`, gelir: 0, gider: 0, kar: 0 })
    allMonths.get(k)!.gelir = r.income
  })
  data.monthlyExpenses.forEach(r => {
    const k = `${r.year}-${r.month}`
    if (!allMonths.has(k)) allMonths.set(k, { label: `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`, gelir: 0, gider: 0, kar: 0 })
    allMonths.get(k)!.gider = r.expenses
  })
  allMonths.forEach(v => { v.kar = v.gelir - v.gider })
  const chartData = Array.from(allMonths.values()).sort()
  const excelData = chartData.map(r => ({ 'Dönem': r.label, 'Gelir (₺)': r.gelir, 'Gider (₺)': r.gider, 'Kar/Zarar (₺)': r.kar }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Gelir" value={`${fmtMoney(data.totalIncome)} ₺`} color={SUCCESS} />
        <SummaryCard label="Toplam Gider" value={`${fmtMoney(data.totalExpenses)} ₺`} color={DANGER} />
        <SummaryCard label="Net Kar/Zarar" value={`${fmtMoney(netProfit)} ₺`} color={netProfit >= 0 ? SUCCESS : DANGER} />
        <SummaryCard label="Kar Marjı" value={`%${margin}`} color={margin >= 20 ? SUCCESS : margin >= 0 ? WARN : DANGER} sub={margin >= 20 ? 'Sağlıklı' : margin >= 0 ? 'Düşük' : 'Zarar'} />
      </div>
      <Card title="Gelir — Gider — Kar Trendi">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
            <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Line type="monotone" dataKey="gelir" name="Gelir" stroke={SUCCESS} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gider" name="Gider" stroke={DANGER} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="kar" name="Kar" stroke={PRIMARY} strokeWidth={2} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Table
        headers={['Dönem', 'Gelir', 'Gider', 'Kar/Zarar', 'Marj']}
        rows={chartData.map(r => [
          r.label,
          <span style={{ color: SUCCESS, fontWeight: 600 }}>{fmtMoney(r.gelir)} ₺</span>,
          <span style={{ color: DANGER }}>{fmtMoney(r.gider)} ₺</span>,
          <span style={{ color: r.kar >= 0 ? SUCCESS : DANGER, fontWeight: 700 }}>{fmtMoney(r.kar)} ₺</span>,
          <ProgressBar value={r.gelir > 0 ? (r.kar / r.gelir) * 100 : 0} color={r.kar >= 0 ? SUCCESS : DANGER} />
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'kar-zarar-raporu.xlsx', 'K/Z')} onPrint={onPrint} />
    </div>
  )
}

// ─── 6. ÖDEME YÖNTEMİ ───────────────────────────────────────────────────────
function PaymentMethodsReport({ data, onPrint, printRef }: { data: FinancialReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const METHOD_LABELS: Record<string, string> = { cash: 'Nakit', bank_transfer: 'Havale/EFT', credit_card: 'Kredi Kartı', check: 'Çek', promissory_note: 'Senet', other: 'Diğer' }
  const excelData = data.byMethod.map(r => ({ 'Yöntem': METHOD_LABELS[r.payment_method] || r.payment_method, 'Tutar (₺)': r.total, 'Adet': r.cnt }))
  const totalMethods = data.byMethod.reduce((s, r) => s + r.total, 0)

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="Ödeme Yöntemi Dağılımı">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.byMethod.map(r => ({ ...r, payment_method: METHOD_LABELS[r.payment_method] || r.payment_method }))} dataKey="total" nameKey="payment_method" cx="50%" cy="50%" outerRadius={70} paddingAngle={2} label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                {data.byMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: PRIMARY, color: '#fff' }}>
              {['Yöntem', 'Tutar', 'Adet', 'Oran'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.byMethod.map((r, i) => {
                const pct = totalMethods > 0 ? Math.round((r.total / totalMethods) * 100) : 0
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600 }}>{METHOD_LABELS[r.payment_method] || r.payment_method}</td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: SUCCESS, fontWeight: 700 }}>{fmtMoney(r.total)} ₺</td>
                    <td style={{ padding: '7px 10px', fontSize: 11 }}>{r.cnt}</td>
                    <td style={{ padding: '7px 10px', minWidth: 80 }}><ProgressBar value={pct} color={CHART_COLORS[i % CHART_COLORS.length]} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ExportRow onExcel={() => exportToExcel(excelData, 'odeme-yontemi-raporu.xlsx', 'Yöntemler')} onPrint={onPrint} />
    </div>
  )
}

// ─── 7. DEVAMSIZLIK RAPORU ───────────────────────────────────────────────────
function StudentAttendanceReportView({ data, onPrint, printRef }: { data: StudentAttendanceRow[]; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const withLessons = data.filter(r => r.total_lessons > 0)
  const avgRate = withLessons.length > 0 ? Math.round(withLessons.reduce((s, r) => s + (r.attendance_rate || 0), 0) / withLessons.length) : 0
  const low = data.filter(r => (r.attendance_rate || 0) < 70 && r.total_lessons > 0)
  const top5Absent = [...data].sort((a, b) => b.absent - a.absent).slice(0, 5)
  const excelData = data.map(r => ({
    'Öğrenci': r.student_name, 'Enstrüman': r.instrument_name || '', 'Öğretmen': r.teacher_name || '',
    'Toplam': r.total_lessons, 'Tamamlanan': r.completed, 'Devamsız': r.absent, 'İptal': r.cancelled, 'Devam (%)': r.attendance_rate || 0
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Öğrenci" value={data.length} color={PRIMARY} />
        <SummaryCard label="Ortalama Devam" value={`%${avgRate}`} color={avgRate >= 80 ? SUCCESS : WARN} />
        <SummaryCard label="Düşük Devam (<70%)" value={low.length} color={low.length > 0 ? DANGER : SUCCESS} sub="öğrenci" />
        <SummaryCard label="Toplam Ders" value={fmt(data.reduce((s, r) => s + r.total_lessons, 0))} color={INFO} />
      </div>

      {low.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: DANGER }}>⚠ Kritik Devamsızlık: </span>
          <span style={{ color: '#374151' }}>{low.map(r => r.student_name).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="En Çok Devamsızlık Yapan 5 Öğrenci">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={top5Absent.map(r => ({ name: r.student_name.split(' ')[0], devamsız: r.absent, iptal: r.cancelled }))} layout="vertical" margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="devamsız" fill={DANGER} radius={[0, 4, 4, 0]} />
              <Bar dataKey="iptal" fill={WARN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Devam Dağılımı">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[
                { name: 'Tamamlanan', value: data.reduce((s, r) => s + r.completed, 0) },
                { name: 'Devamsız', value: data.reduce((s, r) => s + r.absent, 0) },
                { name: 'İptal', value: data.reduce((s, r) => s + r.cancelled, 0) },
              ]} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                <Cell fill={SUCCESS} /><Cell fill={DANGER} /><Cell fill={WARN} />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Table
        headers={['Öğrenci', 'Enstrüman', 'Öğretmen', 'Toplam', 'Tamamlanan', 'Devamsız', 'İptal', 'Devam Oranı']}
        rows={data.map(r => {
          const rate = r.attendance_rate || 0
          const rColor = rate >= 80 ? SUCCESS : rate >= 60 ? WARN : DANGER
          return [
            <span style={{ fontWeight: 600 }}>{r.student_name}</span>,
            <span style={{ color: '#6b7280' }}>{r.instrument_name || '—'}</span>,
            <span style={{ color: '#6b7280' }}>{r.teacher_name || '—'}</span>,
            r.total_lessons,
            <span style={{ color: SUCCESS, fontWeight: 600 }}>{r.completed}</span>,
            <span style={{ color: DANGER }}>{r.absent}</span>,
            r.cancelled,
            <ProgressBar value={rate} color={rColor} />
          ]
        })}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'devamsizlik-raporu.xlsx', 'Devamsızlık')} onPrint={onPrint} />
    </div>
  )
}

// ─── 8. KAYIT & AYRILIŞ RAPORU ───────────────────────────────────────────────
function EnrollmentReportView({ data, onPrint, printRef }: { data: StudentEnrollmentReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const newStudents = data.newStudents as any[]
  const departures = data.departures as any[]
  const sources = data.referralSources
  const excelNew = newStudents.map(s => ({ 'Öğrenci': s.student_name, 'Kayıt Tarihi': s.registration_date, 'Enstrüman': s.instrument_name || '', 'Kaynak': s.referral_source || '' }))
  const excelDep = departures.map(d => ({ 'Öğrenci': d.student_name, 'Ayrılış': d.departure_date, 'Sebep': d.reason || '' }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Yeni Kayıt" value={newStudents.length} color={SUCCESS} />
        <SummaryCard label="Ayrılan" value={departures.length} color={DANGER} />
        <SummaryCard label="Net Değişim" value={newStudents.length - departures.length} color={newStudents.length >= departures.length ? SUCCESS : DANGER} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: SUCCESS, marginBottom: 6 }}>Yeni Kayıtlar</div>
          <Table headers={['Öğrenci', 'Kayıt Tarihi', 'Enstrüman', 'Kaynak']} accentColor={SUCCESS}
            rows={newStudents.map(s => [
              <span style={{ fontWeight: 600 }}>{s.student_name}</span>,
              s.registration_date ? new Date(s.registration_date).toLocaleDateString('tr-TR') : '—',
              s.instrument_name || '—', s.referral_source || '—'
            ])} />
          <div style={{ fontSize: 12, fontWeight: 600, color: DANGER, margin: '12px 0 6px' }}>Ayrılanlar</div>
          <Table headers={['Öğrenci', 'Ayrılış', 'Sebep']} accentColor={DANGER}
            rows={departures.map(d => [
              <span style={{ fontWeight: 600 }}>{d.student_name}</span>,
              d.departure_date ? new Date(d.departure_date).toLocaleDateString('tr-TR') : '—',
              <span style={{ color: '#6b7280' }}>{d.reason || '—'}</span>
            ])} />
        </div>
        <Card title="Referans Kaynakları">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sources} dataKey="cnt" nameKey="source" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                {sources.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 6 }}>
            {sources.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, borderBottom: '1px solid #f3f4f6' }}>
                <span>{s.source}</span><span style={{ fontWeight: 700 }}>{s.cnt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <ExportRow onExcel={() => exportToExcel(excelNew, 'yeni-kayitlar.xlsx', 'Kayıtlar')} label="Kayıtlar Excel" onPrint={onPrint} />
        <ExportRow onExcel={() => exportToExcel(excelDep, 'ayrilanlar.xlsx', 'Ayrılanlar')} label="Ayrılanlar Excel" />
      </div>
    </div>
  )
}

// ─── 9. NET BÜYÜME ANALİZİ ───────────────────────────────────────────────────
function NetGrowthReportView({ data, onPrint, printRef }: { data: NetGrowthReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const totalNew = data.monthly.reduce((s, r) => s + r.new_students, 0)
  const totalDep = data.monthly.reduce((s, r) => s + r.departures, 0)
  const totalNet = totalNew - totalDep
  const churnRate = totalNew > 0 ? Math.round((totalDep / totalNew) * 100) : 0
  const chartData = data.monthly.map(r => ({ name: `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`, 'Yeni Kayıt': r.new_students, 'Ayrılan': r.departures, 'Net': r.net }))
  const excelData = data.monthly.map(r => ({ 'Dönem': `${r.month}/${r.year}`, 'Yeni Kayıt': r.new_students, 'Ayrılan': r.departures, 'Net': r.net }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Yeni Kayıt" value={totalNew} color={SUCCESS} />
        <SummaryCard label="Toplam Ayrılan" value={totalDep} color={DANGER} />
        <SummaryCard label="Net Büyüme" value={totalNet >= 0 ? `+${totalNet}` : String(totalNet)} color={totalNet >= 0 ? SUCCESS : DANGER} />
        <SummaryCard label="Churn Oranı" value={`%${churnRate}`} color={churnRate < 15 ? SUCCESS : churnRate < 30 ? WARN : DANGER} sub={churnRate < 15 ? 'Düşük - İyi' : churnRate < 30 ? 'Orta' : 'Yüksek'} />
      </div>

      <Card title="Aylık Büyüme Grafiği">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Bar dataKey="Yeni Kayıt" fill={SUCCESS} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Ayrılan" fill={DANGER} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Net" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {data.churnReasons.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Card title="Ayrılma Nedenleri (Churn Analizi)">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.churnReasons} dataKey="cnt" nameKey="reason" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                  {data.churnReasons.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Churn Neden Detayı">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>
                {['Neden', 'Adet', 'Oran'].map(h => <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 10 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.churnReasons.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 600 }}>{r.reason}</td>
                    <td style={{ padding: '5px 6px', color: DANGER, fontWeight: 700 }}>{r.cnt}</td>
                    <td style={{ padding: '5px 6px', minWidth: 80 }}>
                      <ProgressBar value={totalDep > 0 ? (r.cnt / totalDep) * 100 : 0} color={CHART_COLORS[i % CHART_COLORS.length]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <Table
        headers={['Dönem', 'Yeni Kayıt', 'Ayrılan', 'Net Değişim']}
        rows={data.monthly.map(r => [
          monthLabel(r.year, r.month),
          <span style={{ color: SUCCESS, fontWeight: 600 }}>+{r.new_students}</span>,
          <span style={{ color: DANGER }}>{r.departures > 0 ? `-${r.departures}` : '0'}</span>,
          <span style={{ color: r.net >= 0 ? SUCCESS : DANGER, fontWeight: 700 }}>{r.net >= 0 ? `+${r.net}` : r.net}</span>
        ])}
      />
      <ExportRow onExcel={() => exportToExcel(excelData, 'net-buyume-analizi.xlsx', 'Büyüme')} onPrint={onPrint} />
    </div>
  )
}

// ─── 10. ÖĞRETMEN PERFORMANS ─────────────────────────────────────────────────
function TeacherWorkloadReport({ data, onPrint, printRef }: { data: TeacherReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const active = data.workload.filter(t => t.total_lessons > 0)
  const avgCompletion = active.length > 0 ? Math.round(active.reduce((s, r) => s + (r.completion_rate || 0), 0) / active.length) : 0
  const avgScore = active.filter(t => t.avg_score != null).length > 0
    ? (active.filter(t => t.avg_score != null).reduce((s, t) => s + (t.avg_score || 0), 0) / active.filter(t => t.avg_score != null).length).toFixed(1)
    : '—'
  const excelData = data.workload.map(r => ({
    'Öğretmen': r.teacher_name, 'Uzmanlık': r.instrument_specialization || '',
    'Toplam Ders': r.total_lessons, 'Tamamlanan': r.completed, 'Öğr.Yokluk': r.teacher_absent,
    'İptal': r.cancelled, 'Telafi': r.makeup, 'Öğrenci Sayısı': r.unique_students,
    'Gerçekleşme (%)': r.completion_rate, 'Ort.Skor': r.avg_score ?? '', 'Anket Sayısı': r.survey_count
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Aktif Öğretmen" value={active.length} color={PRIMARY} />
        <SummaryCard label="Toplam Ders" value={fmt(data.workload.reduce((s, r) => s + r.total_lessons, 0))} color={INFO} />
        <SummaryCard label="Ort. Gerçekleşme" value={`%${avgCompletion}`} color={avgCompletion >= 80 ? SUCCESS : WARN} />
        <SummaryCard label="Ort. Memnuniyet" value={avgScore !== '—' ? `${avgScore}/10` : '—'} color={ACCENT} sub="anket ortalaması" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="Ders Dağılımı (Öğretmen Bazlı)">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data.workload.map(r => ({ name: r.teacher_name.split(' ')[1] || r.teacher_name, Tamamlanan: r.completed, İptal: r.cancelled, Telafi: r.makeup }))} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Tamamlanan" fill={SUCCESS} stackId="a" />
              <Bar dataKey="İptal" fill={DANGER} stackId="a" />
              <Bar dataKey="Telafi" fill={INFO} stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Memnuniyet Skorları">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data.workload.filter(t => t.avg_score != null).map(r => ({ name: r.teacher_name.split(' ')[1] || r.teacher_name, skor: r.avg_score, anket: r.survey_count }))} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `${v}/10`} />
              <Bar dataKey="skor" name="Memnuniyet Skoru" fill={ACCENT} radius={[0, 4, 4, 0]}>
                {data.workload.filter(t => t.avg_score != null).map((r, i) => (
                  <Cell key={i} fill={(r.avg_score ?? 0) >= 8 ? SUCCESS : (r.avg_score ?? 0) >= 6 ? ACCENT : DANGER} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: PRIMARY, color: '#fff' }}>
            {['Öğretmen', 'Uzmanlık', 'Toplam', 'Tamamlanan', 'Öğr.Yok', 'İptal', 'Telafi', 'Öğrenci', 'Gerçekleşme', 'Memnuniyet'].map(h => (
              <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.workload.map((r, i) => {
              const rate = r.completion_rate || 0
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600 }}>{r.teacher_name}</td>
                  <td style={{ padding: '6px 8px', fontSize: 10, color: '#6b7280' }}>{r.instrument_specialization || '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11 }}>{r.total_lessons}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: SUCCESS, fontWeight: 600 }}>{r.completed}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: '#7c3aed' }}>{r.teacher_absent}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: DANGER }}>{r.cancelled}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: INFO }}>{r.makeup}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11 }}>{r.unique_students}</td>
                  <td style={{ padding: '6px 8px', minWidth: 80 }}><ProgressBar value={rate} color={rate >= 80 ? SUCCESS : WARN} /></td>
                  <td style={{ padding: '6px 8px', fontSize: 11 }}>
                    {r.avg_score != null
                      ? <span style={{ fontWeight: 700, color: r.avg_score >= 8 ? SUCCESS : r.avg_score >= 6 ? ACCENT : DANGER }}>{r.avg_score}/10 <span style={{ color: '#9ca3af', fontWeight: 400 }}>({r.survey_count})</span></span>
                      : <span style={{ color: '#d1d5db' }}>—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ExportRow onExcel={() => exportToExcel(excelData, 'ogretmen-performans.xlsx', 'Performans')} onPrint={onPrint} />
    </div>
  )
}

// ─── 11. DERS GERÇEKLEŞMESİ ─────────────────────────────────────────────────
function LessonCompletionReport({ data, onPrint, printRef }: { data: TeacherReport; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const teachers = [...new Set(data.monthlyByTeacher.map(r => r.teacher_name))]
  const excelData = data.monthlyByTeacher.map(r => ({
    'Öğretmen': r.teacher_name, 'Yıl': r.year, 'Ay': MONTH_NAMES[r.month - 1],
    'Toplam Ders': r.lesson_count, 'Tamamlanan': r.completed
  }))

  return (
    <div ref={printRef}>
      <Card title="Aylık Ders Gerçekleşmesi (Öğretmen Bazlı)">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.monthlyByTeacher.reduce((acc, r) => {
            const key = `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`
            let entry = acc.find(e => e.month === key)
            if (!entry) { entry = { month: key }; acc.push(entry) }
            ;(entry as any)[r.teacher_name] = r.completed
            return acc
          }, [] as any[])} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            {teachers.map((t, i) => <Line key={t} type="monotone" dataKey={t} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <ExportRow onExcel={() => exportToExcel(excelData, 'ders-gerceklesme-raporu.xlsx', 'Dersler')} onPrint={onPrint} />
    </div>
  )
}

// ─── 12. ENSTRÜMANa GÖRE DOLULUK ─────────────────────────────────────────────
function InstrumentOccupancyReportView({ data, onPrint, printRef }: { data: InstrumentOccupancy[]; onPrint: () => void; printRef: React.RefObject<HTMLDivElement> }) {
  const totalActive = data.reduce((s, r) => s + r.active_students, 0)
  const totalRevenue = data.reduce((s, r) => s + r.monthly_revenue, 0)
  const maxStudents = Math.max(...data.map(r => r.active_students), 1)
  const excelData = data.map(r => ({
    'Enstrüman': r.instrument_name,
    'Aktif Öğrenci': r.active_students,
    'Pasif Öğrenci': r.passive_students,
    'Öğretmen Sayısı': r.teacher_count,
    'Aylık Gelir (₺)': r.monthly_revenue
  }))

  return (
    <div ref={printRef}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Toplam Aktif Öğrenci" value={totalActive} color={PRIMARY} />
        <SummaryCard label="Aktif Enstrüman" value={data.filter(r => r.active_students > 0).length} color={SUCCESS} />
        <SummaryCard label="Aylık Toplam Gelir" value={`${fmtMoney(totalRevenue)} ₺`} color={ACCENT} sub="enstrüman kayıtlarından" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card title="Öğrenci Dağılımı (Enstrümana Göre)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.filter(r => r.active_students > 0).map(r => ({ name: r.instrument_name, value: r.active_students }))}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}
                label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}>
                {data.map((r, i) => <Cell key={i} fill={r.color_code || CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Aylık Gelir (Enstrümana Göre)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.filter(r => r.active_students > 0).map(r => ({ name: r.instrument_name.slice(0, 8), gelir: r.monthly_revenue }))} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="gelir" name="Aylık Gelir" radius={[0, 4, 4, 0]}>
                {data.filter(r => r.active_students > 0).map((r, i) => <Cell key={i} fill={r.color_code || CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: PRIMARY, color: '#fff' }}>
            {['Enstrüman', 'Aktif Öğrenci', 'Pasif Öğrenci', 'Öğretmen', 'Aylık Gelir', 'Doluluk'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map((r, i) => {
              const fillPct = Math.round((r.active_students / maxStudents) * 100)
              const fillColor = r.color_code || CHART_COLORS[i % CHART_COLORS.length]
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: fillColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{r.instrument_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: r.active_students > 0 ? SUCCESS : '#d1d5db' }}>{r.active_students}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>{r.passive_students}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{r.teacher_count > 0 ? `${r.teacher_count} öğretmen` : '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: r.monthly_revenue > 0 ? ACCENT : '#d1d5db' }}>
                    {r.monthly_revenue > 0 ? `${fmtMoney(r.monthly_revenue)} ₺` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', minWidth: 120 }}>
                    <ProgressBar value={fillPct} color={fillColor} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ExportRow onExcel={() => exportToExcel(excelData, 'enstuman-doluluk-raporu.xlsx', 'Doluluk')} onPrint={onPrint} />
    </div>
  )
}

// ─── CARİ HESAP RAPORU ────────────────────────────────────────────────────────
function CariHesapReport({ data, onPrint, onExcel }: { data: LedgerPeriodReport; onPrint: () => void; onExcel: () => void }) {
  const barColor = data.collectionRate >= 80 ? SUCCESS : data.collectionRate >= 50 ? WARN : DANGER
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Dönem Başı Bakiye" value={`${fmtMoney(data.openingBalance)} ₺`} color={data.openingBalance > 0 ? DANGER : SUCCESS} />
        <SummaryCard label="Oluşan Borç" value={`${fmtMoney(data.totalDebtCreated)} ₺`} color={PRIMARY} />
        <SummaryCard label="Tahsil Edilen" value={`${fmtMoney(data.totalCollected)} ₺`} color={SUCCESS} />
        <SummaryCard label="Dönem Sonu Bakiye" value={`${fmtMoney(data.endingBalance)} ₺`} color={data.endingBalance > 0 ? DANGER : SUCCESS} />
        <SummaryCard label="Tahsilat Oranı" value={`%${data.collectionRate}`} color={barColor} />
      </div>

      {/* Progress Bar */}
      <Card title="Tahsilat İlerleme">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#6b7280' }}>
          <span>Tahsil: {fmtMoney(data.totalCollected)} ₺</span>
          <span style={{ fontWeight: 700, color: barColor }}>%{data.collectionRate}</span>
          <span>Kalan: {fmtMoney(Math.max(0, data.totalDebtCreated - data.totalCollected))} ₺</span>
        </div>
        <div style={{ height: 12, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${data.collectionRate}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width .4s ease' }} />
        </div>
      </Card>

      {/* Öğrenci Detay Tablosu */}
      {data.studentBreakdown.length > 0 && (
        <Card title="Öğrenci Bazlı Cari Hesap Detayı">
          <Table
            headers={['Öğrenci', 'Telefon', 'Dönem Borcu', 'Tahsil Edilen', 'Kalan Açık']}
            rows={data.studentBreakdown.map(s => [
              s.student_name,
              s.phone || '—',
              <span style={{ color: PRIMARY, fontWeight: 600 }}>{fmtMoney(s.debt_created)} ₺</span>,
              <span style={{ color: SUCCESS, fontWeight: 600 }}>{fmtMoney(s.collected)} ₺</span>,
              s.remaining_open > 0
                ? <span style={{ color: DANGER, fontWeight: 700 }}>{fmtMoney(s.remaining_open)} ₺</span>
                : <span style={{ color: SUCCESS }}>—</span>
            ])}
          />
        </Card>
      )}

      <ExportRow
        onExcel={onExcel}
        onPrint={onPrint}
      />
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [activeReport, setActiveReport] = useState('monthly_revenue')
  const [dateRange, setDateRange] = useState(getDefaultRange)
  const [financialData, setFinancialData]       = useState<FinancialReport | null>(null)
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendanceRow[] | null>(null)
  const [enrollmentData, setEnrollmentData]     = useState<StudentEnrollmentReport | null>(null)
  const [netGrowthData, setNetGrowthData]       = useState<NetGrowthReport | null>(null)
  const [teacherData, setTeacherData]           = useState<TeacherReport | null>(null)
  const [occupancyData, setOccupancyData]       = useState<InstrumentOccupancy[] | null>(null)
  const [cariData, setCariData]                 = useState<LedgerPeriodReport | null>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({ content: () => printRef.current })

  const FINANCIAL_IDS      = ['monthly_revenue', 'payment_detail', 'overdue_aging', 'expense_analysis', 'profit_loss', 'payment_methods']
  const STUDENT_ATTEND_IDS = ['student_attendance']
  const ENROLLMENT_IDS     = ['enrollment_report']
  const NET_GROWTH_IDS     = ['net_growth']
  const TEACHER_IDS        = ['teacher_workload', 'lesson_completion']
  const OCCUPANCY_IDS      = ['instrument_occupancy']
  const CARI_IDS           = ['cari_hesap']

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      if (FINANCIAL_IDS.includes(activeReport)) {
        setFinancialData(await window.api.reports.getFinancial(dateRange.start, dateRange.end))
      } else if (STUDENT_ATTEND_IDS.includes(activeReport)) {
        setStudentAttendance(await window.api.reports.getStudentReport(dateRange.start, dateRange.end, 'attendance') as StudentAttendanceRow[])
      } else if (ENROLLMENT_IDS.includes(activeReport)) {
        setEnrollmentData(await window.api.reports.getStudentReport(dateRange.start, dateRange.end, 'enrollment') as StudentEnrollmentReport)
      } else if (NET_GROWTH_IDS.includes(activeReport)) {
        setNetGrowthData(await window.api.reports.getStudentReport(dateRange.start, dateRange.end, 'net_growth') as NetGrowthReport)
      } else if (TEACHER_IDS.includes(activeReport)) {
        setTeacherData(await window.api.reports.getTeacherReport(dateRange.start, dateRange.end))
      } else if (OCCUPANCY_IDS.includes(activeReport)) {
        setOccupancyData(await window.api.reports.getInstrumentOccupancy())
      } else if (CARI_IDS.includes(activeReport)) {
        setCariData(await window.api.ledger.getPeriodReport(dateRange.start, dateRange.end))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [activeReport, dateRange])

  useEffect(() => { loadReport() }, [loadReport])

  function renderReport() {
    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: '#9ca3af', fontSize: 14 }}>Yükleniyor...</div>
    if (activeReport === 'monthly_revenue'    && financialData)    return <MonthlyRevenueReport  data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'payment_detail'     && financialData)    return <PaymentDetailReport    data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'overdue_aging'      && financialData)    return <OverdueAgingReport     data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'expense_analysis'   && financialData)    return <ExpenseAnalysisReport  data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'profit_loss'        && financialData)    return <ProfitLossReport       data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'payment_methods'    && financialData)    return <PaymentMethodsReport   data={financialData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'student_attendance' && studentAttendance) return <StudentAttendanceReportView data={studentAttendance} onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'enrollment_report'  && enrollmentData)   return <EnrollmentReportView   data={enrollmentData}   onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'net_growth'         && netGrowthData)    return <NetGrowthReportView    data={netGrowthData}    onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'teacher_workload'   && teacherData)      return <TeacherWorkloadReport  data={teacherData}      onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'lesson_completion'  && teacherData)      return <LessonCompletionReport data={teacherData}      onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'instrument_occupancy' && occupancyData)  return <InstrumentOccupancyReportView data={occupancyData} onPrint={handlePrint} printRef={printRef} />
    if (activeReport === 'cari_hesap' && cariData) return <CariHesapReport data={cariData} onPrint={handlePrint} onExcel={() => {
      const rows = cariData.studentBreakdown.map(s => ({
        'Öğrenci': s.student_name, 'Telefon': s.phone || '',
        'Dönem Borcu': s.debt_created, 'Tahsil Edilen': s.collected, 'Kalan Açık': s.remaining_open
      }))
      exportToExcel(rows, 'cari-hesap-raporu.xlsx', 'Cari Hesap')
    }} />
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af' }}>Veri yükleniyor...</div>
  }

  const activeLabel = CATEGORIES.flatMap(c => c.items).find(i => i.id === activeReport)?.label || ''
  const showDateRange = !OCCUPANCY_IDS.includes(activeReport)

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F8F6F1', overflow: 'hidden' }}>
      {/* Sol sidebar */}
      <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 12px', fontSize: 13, fontWeight: 700, color: PRIMARY }}>Raporlar</div>
        {CATEGORIES.map(cat => (
          <div key={cat.group} style={{ marginBottom: 4 }}>
            <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px' }}>{cat.group}</div>
            {cat.items.map(item => (
              <button key={item.id} onClick={() => setActiveReport(item.id)} style={{
                width: '100%', textAlign: 'left', padding: '7px 16px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: activeReport === item.id ? 700 : 400,
                background: activeReport === item.id ? '#EEF2FF' : 'transparent',
                color: activeReport === item.id ? PRIMARY : '#6b7280',
                borderLeft: activeReport === item.id ? `3px solid ${PRIMARY}` : '3px solid transparent',
                transition: 'all .15s'
              }}>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Başlık + filtreler */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: PRIMARY }}>{activeLabel}</div>
          </div>
          {showDateRange && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                <span>Başlangıç:</span>
                <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
                  style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, backgroundColor: '#fff' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                <span>Bitiş:</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
                  style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, backgroundColor: '#fff' }} />
              </div>
              <button onClick={loadReport} disabled={loading} style={{
                padding: '6px 16px', background: PRIMARY, color: '#fff', border: 'none',
                borderRadius: 6, cursor: loading ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                opacity: loading ? 0.7 : 1
              }}>
                {loading ? 'Yükleniyor...' : 'Getir'}
              </button>
            </>
          )}
          {!showDateRange && (
            <button onClick={loadReport} disabled={loading} style={{
              padding: '6px 16px', background: PRIMARY, color: '#fff', border: 'none',
              borderRadius: 6, cursor: loading ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          )}
        </div>

        {/* Rapor içeriği */}
        <ReportErrorBoundary key={activeReport}>
          {renderReport()}
        </ReportErrorBoundary>
      </div>
    </div>
  )
}
