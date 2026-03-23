import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { DashboardKpis, DashboardAlerts } from '../types'
import { MONTH_NAMES } from '../types'
import AdvancedPaymentModal from '@components/AdvancedPaymentModal'

const PRIMARY = '#1B3A6B'
const ACCENT = '#C9A84C'
const SUCCESS = '#16a34a'
const DANGER = '#dc2626'
const WARN = '#d97706'
const INFO = '#2563eb'
const INSTRUMENT_COLORS = ['#1B3A6B', '#C9A84C', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899']

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function fmtMoney(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── KPI KARTI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = PRIMARY, icon, trend }: {
  label: string; value: string | number; sub?: string
  color?: string; icon: string; trend?: { dir: 'up' | 'down' | 'neutral'; text: string }
}) {
  const trendColor = trend?.dir === 'up' ? SUCCESS : trend?.dir === 'down' ? DANGER : '#6b7280'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#fff', borderRadius: 10, padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${color}`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      {trend && <div style={{ fontSize: 11, color: trendColor, fontWeight: 500, marginTop: 2 }}>{trend.text}</div>}
    </motion.div>
  )
}

// ─── KAPASITE METER ─────────────────────────────────────────────────────────
function OccupancyMeter({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  const color = pct >= 90 ? DANGER : pct >= 70 ? WARN : SUCCESS
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>Kapasite Doluluk Oranı</span>
        <span style={{ fontSize: 18, fontWeight: 700, color }}>{capacity > 0 ? `%${pct}` : '—'}</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: 9999, height: 10, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: capacity > 0 ? `${pct}%` : '0%' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 9999 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: '#6b7280' }}>
        <span>{fmt(enrolled)} aktif kayıt</span>
        {capacity > 0 ? <span>Hedef: {fmt(capacity)}</span> : <span style={{ color: '#9ca3af' }}>Ayarlardan hedef girin</span>}
      </div>
    </div>
  )
}

// ─── ALERT SECTION ──────────────────────────────────────────────────────────
function AlertSection({ title, color, icon, children, count }: {
  title: string; color: string; icon: string; children: React.ReactNode; count: number
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
      <div style={{ background: color, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>{title}</span>
        </div>
        <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
          {count}
        </span>
      </div>
      <div style={{ maxHeight: 190, overflowY: 'auto' }}>
        {count === 0
          ? <div style={{ padding: '16px', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Kayıt yok</div>
          : children}
      </div>
    </div>
  )
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  completed:      { label: 'Tamamlandı', bg: '#dcfce7', color: SUCCESS },
  cancelled:      { label: 'İptal',       bg: '#fee2e2', color: DANGER },
  makeup:         { label: 'Telafi',       bg: '#dbeafe', color: INFO },
  student_absent: { label: 'Devamsız',     bg: '#fff7ed', color: WARN },
  teacher_absent: { label: 'Öğr.Yok',     bg: '#f3e8ff', color: '#7c3aed' },
}

function buildChartData(
  monthlyChart: DashboardKpis['monthlyChart'],
  expenseChart: DashboardKpis['expenseChart']
) {
  const map = new Map<string, { month: string; income: number; expenses: number }>()
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    map.set(key, { month: MONTH_NAMES[d.getMonth()].slice(0, 3), income: 0, expenses: 0 })
  }
  monthlyChart.forEach(r => { const k = `${r.year}-${r.month}`; if (map.has(k)) map.get(k)!.income = r.income })
  expenseChart.forEach(r => { const k = `${r.year}-${r.month}`; if (map.has(k)) map.get(k)!.expenses = r.expenses })
  return Array.from(map.values())
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null)
  const [todayLessons, setTodayLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payStudent, setPayStudent] = useState<{ id: number; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiData, alertData, statsData] = await Promise.all([
        window.api.dashboard.getKpis(),
        window.api.dashboard.getAlerts(),
        window.api.dashboard.getStats()
      ])
      setKpis(kpiData)
      setAlerts(alertData)
      setTodayLessons((statsData as any).todayLessons || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !kpis || !alerts) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>Yükleniyor...</div>
  }

  const chartData = buildChartData(kpis.monthlyChart, kpis.expenseChart)
  const collectionRate = kpis.monthlyExpected > 0 ? Math.round((kpis.monthlyRevenue / kpis.monthlyExpected) * 100) : 0
  const targetRate = kpis.revenueTarget > 0 ? Math.round((kpis.monthlyRevenue / kpis.revenueTarget) * 100) : 0

  return (
    <>
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', background: '#F8F6F1' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: PRIMARY, margin: 0 }}>Yönetim Paneli</h1>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={load}
          style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          ↻ Yenile
        </button>
      </div>

      {/* ROW 1: Finansal KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <KpiCard label="Bu Ay Tahsilat" value={`${fmtMoney(kpis.monthlyRevenue)} ₺`}
          sub={`Tahsilat: %${collectionRate}`} color={SUCCESS} icon="💰"
          trend={{ dir: collectionRate >= 80 ? 'up' : 'down', text: `Beklenen: ${fmtMoney(kpis.monthlyExpected)} ₺` }} />
        <KpiCard label="Hedef Gerçekleşme" value={kpis.revenueTarget > 0 ? `%${targetRate}` : '—'}
          sub={kpis.revenueTarget > 0 ? `Hedef: ${fmtMoney(kpis.revenueTarget)} ₺` : 'Ayarlardan hedef girin'}
          color={targetRate >= 100 ? SUCCESS : ACCENT} icon="🎯" />
        <KpiCard label="Gecikmiş Tutar" value={`${fmtMoney(kpis.overdueAmount)} ₺`}
          sub={`${alerts.overduePayments.length} öğrenci`}
          color={kpis.overdueAmount > 0 ? DANGER : SUCCESS} icon="⚠️"
          trend={kpis.overdueAmount > 0 ? { dir: 'down', text: 'Takip gerekiyor' } : { dir: 'up', text: 'Tüm ödemeler güncel' }} />
        <KpiCard label="Yaklaşan Taksit (30g)" value={alerts.upcomingInstallments.length}
          color={WARN} icon="📋" />
      </div>

      {/* ROW 1B: Cari Hesap KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <KpiCard label="Toplam Açık Borç" value={`${fmtMoney(kpis.totalOpenDebt)} ₺`}
          color={kpis.totalOpenDebt > 0 ? DANGER : SUCCESS} icon="📂"
          trend={kpis.totalOpenDebt > 0 ? { dir: 'down', text: 'Cari hesaptan' } : { dir: 'up', text: 'Borç yok' }} />
        <KpiCard label="Bu Ay Borç Oluştu" value={`${fmtMoney(kpis.monthlyDebtCreated)} ₺`}
          color={PRIMARY} icon="📌" />
        <KpiCard label="Bu Ay Tahsil Edildi" value={`${fmtMoney(kpis.monthlyCollected)} ₺`}
          color={SUCCESS} icon="✅"
          trend={{ dir: kpis.monthlyCollected >= kpis.monthlyDebtCreated ? 'up' : 'neutral',
            text: kpis.monthlyDebtCreated > 0 ? `%${Math.round(kpis.monthlyCollected / kpis.monthlyDebtCreated * 100)} tahsilat` : '' }} />
        <KpiCard label="Bu Ay Kalan" value={`${fmtMoney(Math.max(0, kpis.monthlyDebtCreated - kpis.monthlyCollected))} ₺`}
          color={kpis.monthlyDebtCreated > kpis.monthlyCollected ? WARN : SUCCESS} icon="⏳" />
      </div>

      {/* ROW 2: Öğrenci KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <KpiCard label="Aktif Öğrenci" value={fmt(kpis.activeStudents)}
          sub={`${kpis.totalEnrollments} aktif kayıt`} color={PRIMARY} icon="👥" />
        <KpiCard label="Bu Ay Yeni" value={fmt(kpis.newStudentsThisMonth)} color={SUCCESS} icon="✅"
          trend={{ dir: kpis.newStudentsThisMonth > 0 ? 'up' : 'neutral', text: 'Bu ay' }} />
        <KpiCard label="Bu Ay Ayrılan" value={fmt(kpis.departuresThisMonth)}
          color={kpis.departuresThisMonth > 0 ? DANGER : '#6b7280'} icon="🚪"
          trend={{ dir: kpis.departuresThisMonth > 0 ? 'down' : 'neutral', text: 'Bu ay' }} />
        <KpiCard label="Bekleyen Telafi" value={fmt(alerts.pendingMakeups.length)} color={INFO} icon="🔄" />
      </div>

      {/* ROW 3: Bugün */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard label="Bugün Toplam Ders" value={fmt(kpis.todayTotal)} color={PRIMARY} icon="📚" />
        <KpiCard label="Tamamlanan" value={fmt(kpis.todayCompleted)}
          sub={kpis.todayTotal > 0 ? `%${Math.round(kpis.todayCompleted / kpis.todayTotal * 100)} tamamlanma` : undefined}
          color={SUCCESS} icon="✔️" />
        <KpiCard label="İptal / Devamsız" value={fmt(kpis.todayCancelled)}
          color={kpis.todayCancelled > 0 ? DANGER : '#6b7280'} icon="❌" />
      </div>

      {/* Grafikler */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 12 }}>Aylık Gelir & Gider (Son 12 Ay)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 2, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DANGER} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={DANGER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip formatter={(v: number) => `${fmtMoney(v)} ₺`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="income" name="Gelir" stroke={PRIMARY} strokeWidth={2} fill="url(#incGrad)" />
              <Area type="monotone" dataKey="expenses" name="Gider" stroke={DANGER} strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 12 }}>Enstrümana Göre Öğrenci</div>
          {kpis.instrumentDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={kpis.instrumentDistribution} dataKey="student_count" nameKey="name"
                    cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2}>
                    {kpis.instrumentDistribution.map((e, i) => (
                      <Cell key={e.name} fill={e.color || INSTRUMENT_COLORS[i % INSTRUMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} öğrenci`} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                {kpis.instrumentDistribution.map((e, i) => (
                  <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: e.color || INSTRUMENT_COLORS[i % INSTRUMENT_COLORS.length], display: 'inline-block' }} />
                    <span style={{ color: '#374151' }}>{e.name} ({e.student_count})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>Henüz kayıt yok</div>
          )}
        </div>
      </div>

      {/* Kapasite */}
      <div style={{ marginBottom: 14 }}>
        <OccupancyMeter enrolled={kpis.totalEnrollments} capacity={kpis.capacityTarget} />
      </div>

      {/* Bugünkü dersler + Öğretmen doluluk */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
          <div style={{ background: PRIMARY, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>Bugünün Dersleri</span>
            <span style={{ color: '#fff', fontSize: 11, opacity: .8 }}>{todayLessons.length} ders</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {todayLessons.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Bugün ders yok</div>
              : todayLessons.map((l: any, i: number) => {
                  const cfg = STATUS_CFG[l.status] || { label: l.status, bg: '#f3f4f6', color: '#6b7280' }
                  return (
                    <div key={l.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid #f9fafb', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <div style={{ width: 3, height: 28, borderRadius: 9999, background: l.instrument_color || ACCENT, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.student_name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{l.instrument_name || '—'} · {l.teacher_name || '—'}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{l.start_time || '—'}</div>
                      <span style={{ padding: '2px 7px', borderRadius: 9999, fontSize: 9, fontWeight: 600, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                  )
                })
            }
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 10 }}>Öğretmen Doluluk (Bugün)</div>
          {kpis.teacherOccupancy.length === 0
            ? <div style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>Bugün ders yok</div>
            : kpis.teacherOccupancy.map((t, i) => {
                const pct = t.scheduled > 0 ? Math.round((t.completed / t.scheduled) * 100) : 0
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {t.teacher_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.teacher_name}</div>
                      <div style={{ background: '#f3f4f6', borderRadius: 9999, height: 4, marginTop: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: SUCCESS, borderRadius: 9999 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{t.completed}/{t.scheduled}</div>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* Top Borçlular */}
      {kpis.topDebtors.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ background: DANGER, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>En Yüksek Borçlu Öğrenciler</span>
            <span style={{ color: '#fff', fontSize: 10, opacity: .8 }}>Cari hesap bakiyesi</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {kpis.topDebtors.map((d, i) => (
              <div key={d.id} style={{ padding: '10px 14px', borderRight: i < 4 ? '1px solid #fef2f2' : undefined, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.student_name}</div>
                {d.phone && <div style={{ fontSize: 10, color: '#9ca3af' }}>{d.phone}</div>}
                <div style={{ fontSize: 13, fontWeight: 700, color: DANGER, marginTop: 2 }}>{fmtMoney(d.open_debt)} ₺</div>
                <button
                  onClick={() => setPayStudent({ id: d.id, name: d.student_name })}
                  style={{ marginTop: 4, fontSize: 10, padding: '3px 8px', background: DANGER, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, width: 'fit-content' }}>
                  Ödeme Al
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Alert Kartı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <AlertSection title="Gecikmiş Ödemeler" color={DANGER} icon="🔴" count={alerts.overduePayments.length}>
          {alerts.overduePayments.map((p, i) => (
            <div key={i} style={{ padding: '6px 14px', borderBottom: '1px solid #fef2f2', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.student_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ color: DANGER, fontWeight: 700 }}>{fmtMoney(p.total_amount)} ₺ · {p.days_overdue}g</span>
                <button
                  onClick={() => setPayStudent({ id: p.student_id, name: p.student_name })}
                  style={{ fontSize: 10, padding: '2px 7px', background: DANGER, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                  Öde
                </button>
              </div>
            </div>
          ))}
        </AlertSection>

        <AlertSection title="Bu Hafta Doğum Günleri" color="#db2777" icon="🎂" count={alerts.birthdays.length}>
          {alerts.birthdays.map((b, i) => (
            <div key={i} style={{ padding: '6px 14px', borderBottom: '1px solid #fdf2f8', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: '#374151' }}>{b.name}</div>
              <div style={{ color: '#db2777' }}>
                {new Date(b.birth_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                {b.phone && <span style={{ marginLeft: 6, color: '#9ca3af' }}>{b.phone}</span>}
              </div>
            </div>
          ))}
        </AlertSection>

        <AlertSection title="Bekleyen Telafiler" color={INFO} icon="🔄" count={alerts.pendingMakeups.length}>
          {alerts.pendingMakeups.map((m, i) => (
            <div key={i} style={{ padding: '6px 14px', borderBottom: '1px solid #eff6ff', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.student_name}</div>
              <div style={{ color: INFO }}>{new Date(m.original_date).toLocaleDateString('tr-TR')}{m.teacher_name && <span style={{ marginLeft: 6, color: '#9ca3af' }}>· {m.teacher_name}</span>}</div>
            </div>
          ))}
        </AlertSection>

        <AlertSection title="Yaklaşan Taksitler (30g)" color={WARN} icon="📅" count={alerts.upcomingInstallments.length}>
          {alerts.upcomingInstallments.map((inst, i) => (
            <div key={i} style={{ padding: '6px 14px', borderBottom: '1px solid #fffbeb', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.student_name}</div>
              <div style={{ color: WARN }}>{fmtMoney(inst.amount)} ₺ · {new Date(inst.due_date).toLocaleDateString('tr-TR')}</div>
            </div>
          ))}
        </AlertSection>
      </div>
    </div>

    {payStudent && (
      <AdvancedPaymentModal
        studentId={payStudent.id}
        studentName={payStudent.name}
        onClose={() => setPayStudent(null)}
        onSuccess={() => { setPayStudent(null); load() }}
      />
    )}
    </>
  )
}
