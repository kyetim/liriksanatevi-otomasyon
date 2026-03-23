import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePagination } from '@renderer/hooks/usePagination'
import { useSortableTable } from '@renderer/hooks/useSortableTable'
import PaginationBar from '@components/PaginationBar'
import { useReactToPrint } from 'react-to-print'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import Modal from '@components/ui/Modal'
import AdvancedPaymentModal from '@components/AdvancedPaymentModal'
import EmptyState from '@components/ui/EmptyState'
import ConfirmDialog from '@components/ui/ConfirmDialog'
import StudentCertificate, { type CertificateTemplate } from '@components/StudentCertificate'
import StudentRegistrationForm from '@components/StudentRegistrationForm'
import StudentAttendanceReport from '@components/StudentAttendanceReport'
import { formatDate } from '@utils/formatters'
import PhoneInput from '@components/PhoneInput'
import type {
  Student, Enrollment, Lesson, Payment, StudentProgress, PreRegistration, ParentProfile,
  StudentFreeze, StudentStatusHistory, DepartureRecord, Instrument, Teacher,
  StudentLedgerBalance
} from '../types'
import {
  REFERRAL_SOURCE_LABELS, DEPARTURE_REASON_LABELS, PRE_REG_STATUS_LABELS,
  PROGRESS_LEVEL_LABELS
} from '../types'

// ─── Constants ───────────────────────────────────────────────────────────────

const statusConfig = {
  active:  { label: 'Aktif',       cls: 'badge-green' },
  passive: { label: 'Pasif',       cls: 'badge-gray'  },
  frozen:  { label: 'Dondurulmuş', cls: 'badge-blue'  }
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  monthly_fee: 'Aylık Ücret', registration_fee: 'Kayıt Ücreti',
  material_fee: 'Materyal', other: 'Diğer'
}
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit', credit_card: 'Kredi Kartı', bank_transfer: 'Banka', eft: 'EFT'
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Ödendi', pending: 'Bekliyor', overdue: 'Gecikmiş', partial: 'Kısmi'
}
const PAYMENT_STATUS_CLS: Record<string, string> = {
  paid: 'badge-green', pending: 'badge-yellow', overdue: 'badge-red', partial: 'badge-blue'
}

const LESSON_DAYS: Record<string, string> = {
  monday: 'Pzt', tuesday: 'Sal', wednesday: 'Çar',
  thursday: 'Per', friday: 'Cum', saturday: 'Cmt', sunday: 'Paz'
}

const defaultStudent: Partial<Student> = {
  first_name: '', last_name: '', phone: '', email: '',
  gender: undefined, city: '', parent_name: '', parent_phone: '',
  parent_email: '', birth_date: '',
  registration_date: new Date().toISOString().split('T')[0],
  status: 'active', discount_rate: 0, notes: '', address: '',
  referral_source: undefined, referred_by_student_id: undefined
}

const defaultAddEnrollForm = () => ({
  instrument_id: '', teacher_id: '', lesson_type: 'individual' as 'individual' | 'group',
  lesson_duration: 45 as 30|45|60, lessons_per_week: 1,
  lesson_days: '[]', lesson_time: '', monthly_fee: 0,
  start_date: new Date().toISOString().split('T')[0]
})

function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function parseLessonDays(daysStr: string): string {
  try {
    const arr: string[] = JSON.parse(daysStr)
    return arr.map(d => LESSON_DAYS[d] || d).join(', ')
  } catch { return daysStr || '' }
}

function StudentAvatar({ student, size = 32 }: { student: Student; size?: number }) {
  const [imgErr, setImgErr] = useState(false)
  const initials = `${student.first_name[0] || ''}${student.last_name[0] || ''}`
  const colors = ['#1B3A6B','#C9A84C','#2e7d32','#1565c0','#6a1b9a','#e65100']
  const color = colors[(student.id || 0) % colors.length]

  if (student.photo_path && !imgErr) {
    return (
      <img
        src={`file://${student.photo_path}`}
        alt={initials}
        onError={() => setImgErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <span style={{ fontSize: size * 0.35, fontWeight: 700, color }}>{initials}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Students(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [students, setStudents]       = useState<Student[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [teachers, setTeachers]       = useState<Teacher[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter]       = useState('all')
  const [instrumentFilter, setInstrumentFilter] = useState('')
  const [teacherFilter, setTeacherFilter]     = useState('')
  const [ageFilter, setAgeFilter]             = useState('')
  const [showFilters, setShowFilters]         = useState(false)
  const [onlyDebtors, setOnlyDebtors]         = useState(false)
  const [ledgerBalances, setLedgerBalances]   = useState<Record<number, number>>({})
  const [pageTab, setPageTab]                 = useState<'students' | 'pre_registrations' | 'former_students'>('students')
  const [isAddOpen, setIsAddOpen]             = useState(false)
  const [addTab, setAddTab]                   = useState<'student' | 'lesson'>('student')
  const [addForm, setAddForm]                 = useState<Partial<Student>>(defaultStudent)
  const [addEnrollForm, setAddEnrollForm]     = useState(defaultAddEnrollForm)
  const [addSaving, setAddSaving]             = useState(false)
  const [detailStudent, setDetailStudent]     = useState<Student | null>(null)
  const [formerDetailStudent, setFormerDetailStudent] = useState<Student | null>(null)
  const [deleteId, setDeleteId]               = useState<number | null>(null)
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; student: Student } | null>(null)
  const [quickPayStudent, setQuickPayStudent] = useState<Student | null>(null)
  const [bulkSmsOpen, setBulkSmsOpen]         = useState(false)

  const loadStudents = useCallback(async () => {
    const [data, instr, teach, balances] = await Promise.all([
      window.api.students.getAll(),
      window.api.instruments.getAll(),
      window.api.teachers.getAll(),
      window.api.ledger.getStudentBalances()
    ])
    setStudents(data)
    setInstruments(instr)
    setTeachers(teach)
    const balMap: Record<number, number> = {}
    balances.forEach((b: StudentLedgerBalance) => { balMap[b.student_id] = b.open_debt })
    setLedgerBalances(balMap)
    setLoading(false)
  }, [])

  useEffect(() => { loadStudents() }, [loadStudents])

  /** Enstrüman seçiliyse yalnızca o enstrümanı öğreten aktif öğretmenleri döndürür. */
  const teachersForInstrument = useCallback((instrumentId: string | number) => {
    const active = teachers.filter(t => t.status === 'active')
    if (!instrumentId) return active
    const iid = Number(instrumentId)
    return active.filter(t => (t.instrument_ids || []).includes(iid))
  }, [teachers])

  // Classes.tsx gibi başka sayfadan gelen öğrenci detayı isteğini aç
  useEffect(() => {
    const openId = (location.state as { openStudentId?: number } | null)?.openStudentId
    if (!openId || students.length === 0) return
    const s = students.find(st => st.id === openId)
    if (s) setDetailStudent(s)
  }, [location.state, students])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const formerStudents = students.filter(s => s.status === 'passive')

  // Filter students in renderer
  const filtered = students.filter(s => {
    if (s.status === 'passive') return false // passive = eski öğrenci, ayrı sekmede gösterilir
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (!fullName.includes(q) && !s.phone?.includes(q) && !s.parent_name?.toLowerCase().includes(q) && !s.parent_phone?.includes(q)) return false
    }
    if (ageFilter) {
      const age = calcAge(s.birth_date)
      if (age === null) return false
      if (ageFilter === '6-10' && !(age >= 6 && age <= 10)) return false
      if (ageFilter === '11-14' && !(age >= 11 && age <= 14)) return false
      if (ageFilter === '15-17' && !(age >= 15 && age <= 17)) return false
      if (ageFilter === '18+' && age < 18) return false
    }
    // instrument/teacher filter requires enrollment data — skip here (handled per row if data exists)
    if (onlyDebtors && !(ledgerBalances[s.id] > 0)) return false
    return true
  })

  const { sorted, toggleSort, sortIcon } = useSortableTable<Student>(filtered, 'first_name')
  const { items: pagedStudents, page, pageSize, totalPages, totalItems, pageNumbers, setPage, setPageSize } = usePagination(sorted, 50)

  // Filtre değişince 1. sayfaya dön
  useEffect(() => { setPage(1) }, [search, statusFilter, instrumentFilter, teacherFilter, ageFilter, onlyDebtors]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    active:  students.filter(s => s.status === 'active').length,
    passive: students.filter(s => s.status === 'passive').length,
    frozen:  students.filter(s => s.status === 'frozen').length,
  }

  const handleAdd = async () => {
    setAddSaving(true)
    const created = await window.api.students.create(addForm) as { id?: number; error?: string }
    if (created?.id && addEnrollForm.instrument_id) {
      await window.api.enrollments.create({
        student_id: created.id,
        instrument_id: Number(addEnrollForm.instrument_id),
        teacher_id: addEnrollForm.teacher_id ? Number(addEnrollForm.teacher_id) : undefined,
        lesson_type: addEnrollForm.lesson_type,
        lesson_duration: addEnrollForm.lesson_duration,
        lessons_per_week: addEnrollForm.lessons_per_week,
        lesson_days: addEnrollForm.lesson_days,
        lesson_time: (addEnrollForm.lesson_time && addEnrollForm.lesson_time !== 'TBD') ? addEnrollForm.lesson_time : undefined,
        monthly_fee: addEnrollForm.monthly_fee,
        start_date: addEnrollForm.start_date,
        status: 'active' as const
      })
      // Kayıt gününden 4 hafta ileriye ders kartları oluştur
      if (addEnrollForm.lesson_days && addEnrollForm.lesson_days !== '[]') {
        const today = new Date()
        const from = today.toISOString().split('T')[0]
        const to = new Date(today.getTime() + 28 * 24 * 3600 * 1000).toISOString().split('T')[0]
        await window.api.lessons.ensureForDateRange(from, to)
      }
    }
    setAddSaving(false)
    setIsAddOpen(false)
    loadStudents()
  }

  const handleDelete = async () => {
    if (deleteId) await window.api.students.delete(deleteId)
    setDeleteId(null)
    loadStudents()
  }

  const handleContextMenu = (e: React.MouseEvent, student: Student) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, student })
  }

  const handlePassive = async (s: Student) => {
    await window.api.students.update(s.id, { ...s, status: 'passive' })
    loadStudents()
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(s => s.id)))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Page Tabs */}
      <div className="flex items-center gap-1 border-b border-primary-100">
        {([
          { key: 'students', label: `Öğrenciler (${students.filter(s => s.status !== 'passive').length})` },
          { key: 'former_students', label: `Eski Öğrenciler (${formerStudents.length})` },
          { key: 'pre_registrations', label: 'Ön Kayıtlar' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setPageTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              pageTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-primary-400 hover:text-primary'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {pageTab === 'students' ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="input pl-9" placeholder="Ad, telefon, veli..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex rounded-lg overflow-hidden border border-primary-100">
              {(['all', 'active', 'frozen'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'text-primary-400 hover:bg-primary-50'}`}>
                  {s === 'all' ? `Tümü (${students.filter(x => x.status !== 'passive').length})` : s === 'active' ? `Aktif (${counts.active})` : `Dondurulmuş (${counts.frozen})`}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilters(v => !v)} className={`btn-outline text-xs px-3 ${showFilters ? 'bg-primary-50' : ''}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zM6 10h12M9 16h6" />
              </svg>
              Filtreler
            </button>
            <button onClick={() => { setAddForm(defaultStudent); setAddEnrollForm(defaultAddEnrollForm()); setAddTab('student'); setIsAddOpen(true) }} className="btn-primary ml-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Öğrenci
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-primary-50/50 border border-primary-100 rounded-lg p-3 flex gap-3 flex-wrap items-end">
              <div className="min-w-36">
                <label className="block text-xs font-medium text-primary-500 mb-1">Enstrüman</label>
                <select className="input text-xs py-1.5" value={instrumentFilter} onChange={e => setInstrumentFilter(e.target.value)}>
                  <option value="">Tümü</option>
                  {instruments.filter(i => i.is_active).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </div>
              <div className="min-w-36">
                <label className="block text-xs font-medium text-primary-500 mb-1">Öğretmen</label>
                <select className="input text-xs py-1.5" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}>
                  <option value="">Tümü</option>
                  {teachers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="min-w-32">
                <label className="block text-xs font-medium text-primary-500 mb-1">Yaş Grubu</label>
                <select className="input text-xs py-1.5" value={ageFilter} onChange={e => setAgeFilter(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="6-10">6–10 yaş</option>
                  <option value="11-14">11–14 yaş</option>
                  <option value="15-17">15–17 yaş</option>
                  <option value="18+">18+ yaş</option>
                </select>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-primary-600">
                  <input type="checkbox" checked={onlyDebtors} onChange={e => setOnlyDebtors(e.target.checked)} className="cursor-pointer" />
                  Sadece borçlular
                </label>
              </div>
              <button onClick={() => { setInstrumentFilter(''); setTeacherFilter(''); setAgeFilter(''); setOnlyDebtors(false) }}
                className="btn-outline text-xs px-2 py-1.5">Temizle</button>
            </motion.div>
          )}

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-primary">{selectedIds.size} öğrenci seçildi</span>
              <button onClick={() => setBulkSmsOpen(true)} className="btn-primary text-xs px-3 py-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Toplu SMS Gönder
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState title="Öğrenci bulunamadı" description="Henüz öğrenci eklenmemiş veya arama sonucu boş."
              action={<button onClick={() => setIsAddOpen(true)} className="btn-primary">Öğrenci Ekle</button>} />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th onClick={() => toggleSort('first_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Ad Soyad <span className="text-primary-300 text-xs">{sortIcon('first_name')}</span>
                    </th>
                    <th onClick={() => toggleSort('birth_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Yaş <span className="text-primary-300 text-xs">{sortIcon('birth_date')}</span>
                    </th>
                    <th>Telefon</th>
                    <th onClick={() => toggleSort('parent_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Veli <span className="text-primary-300 text-xs">{sortIcon('parent_name')}</span>
                    </th>
                    <th onClick={() => toggleSort('total_monthly_fee')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Aylık Ücret <span className="text-primary-300 text-xs">{sortIcon('total_monthly_fee')}</span>
                    </th>
                    <th style={{ cursor: 'default' }}>Açık Borç</th>
                    <th onClick={() => toggleSort('last_payment_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Son Ödeme <span className="text-primary-300 text-xs">{sortIcon('last_payment_date')}</span>
                    </th>
                    <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Durum <span className="text-primary-300 text-xs">{sortIcon('status')}</span>
                    </th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStudents.map(s => (
                    <tr key={s.id} onContextMenu={e => handleContextMenu(e, s)}
                      className={selectedIds.has(s.id) ? 'bg-primary-50' : ''}>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)} className="cursor-pointer" />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StudentAvatar student={s} size={32} />
                          <button
                            onClick={() => navigate(`/students/${s.id}/ledger`)}
                            className="font-medium text-left hover:text-accent transition-colors"
                          >
                            {s.first_name} {s.last_name}
                          </button>
                        </div>
                      </td>
                      <td className="text-primary-400 text-sm">
                        {calcAge(s.birth_date) !== null ? `${calcAge(s.birth_date)} yaş` : '—'}
                      </td>
                      <td className="text-primary-400">{s.phone || '—'}</td>
                      <td>
                        <div className="text-sm">
                          <div>{s.parent_name || '—'}</div>
                          {s.parent_phone && <div className="text-primary-300 text-xs">{s.parent_phone}</div>}
                        </div>
                      </td>
                      <td>
                        {(s.total_monthly_fee || 0) > 0
                          ? <span className="text-sm font-medium text-primary">{(s.total_monthly_fee || 0).toLocaleString('tr-TR')} ₺</span>
                          : <span className="text-primary-300">—</span>}
                      </td>
                      <td>
                        {(ledgerBalances[s.id] || 0) > 0
                          ? <span className="text-sm font-medium" style={{ color: '#dc2626' }}>{(ledgerBalances[s.id]).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                          : <span className="text-primary-200">—</span>}
                      </td>
                      <td className="text-primary-400 text-sm">
                        {s.last_payment_date ? formatDate(s.last_payment_date) : <span className="text-primary-200">—</span>}
                      </td>
                      <td>
                        <span className={statusConfig[s.status]?.cls ?? 'badge-gray'}>
                          {statusConfig[s.status]?.label ?? s.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/students/${s.id}/ledger`)} className="btn-ghost px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Cari</button>
                          <button onClick={() => setDetailStudent(s)} className="btn-ghost px-2 py-1 text-xs">Detay</button>
                          <button onClick={() => setDeleteId(s.id)} className="btn-ghost px-2 py-1 text-xs text-red-500 hover:bg-red-50">Sil</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar
                page={page} totalPages={totalPages} totalItems={totalItems}
                pageSize={pageSize} pageNumbers={pageNumbers}
                onPage={setPage} onPageSize={setPageSize}
              />
            </motion.div>
          )}

          {/* Context Menu */}
          {contextMenu && (
            <div
              style={{
                position: 'fixed', top: contextMenu.y, left: contextMenu.x,
                zIndex: 9999, minWidth: 160,
                backgroundColor: '#fff', border: '1px solid #e2e8f0',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '4px 0'
              }}
              onClick={e => e.stopPropagation()}
            >
              {[
                { label: 'Profil Aç', action: () => { setDetailStudent(contextMenu.student); setContextMenu(null) } },
                { label: 'Ödeme Al', action: () => { setQuickPayStudent(contextMenu.student); setContextMenu(null) } },
                { label: 'Pasife Al', action: () => { handlePassive(contextMenu.student); setContextMenu(null) }, danger: contextMenu.student.status === 'active' },
              ].map((item, i) => (
                <button key={i} onClick={item.action}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 14px', fontSize: 13, background: 'none', border: 'none',
                    cursor: 'pointer', color: item.danger ? '#dc2626' : '#1B3A6B'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f4fa')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : pageTab === 'former_students' ? (
        <div className="space-y-2">
          {formerStudents.length === 0 ? (
            <p className="text-sm text-primary-400 text-center py-8">Ayrılmış öğrenci bulunmuyor.</p>
          ) : formerStudents.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-white border border-primary-100 rounded-lg px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-primary-800">{s.first_name} {s.last_name}</span>
                {s.phone && <span className="ml-3 text-primary-400 text-xs">{s.phone}</span>}
              </div>
              <div className="flex items-center gap-3">
                {s.birth_date && <span className="text-xs text-primary-400">{calcAge(s.birth_date)} yaş</span>}
                <button
                  onClick={async () => {
                    await window.api.students.setStatus(s.id, 'active')
                    loadStudents()
                  }}
                  className="text-xs text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1"
                >
                  Yeniden Aktif Et
                </button>
                <button onClick={() => setFormerDetailStudent(s)} className="text-xs text-primary-500 hover:text-primary border border-primary-200 rounded px-2 py-1">
                  Detay
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PreRegistrationsTab onStudentCreated={loadStudents} />
      )}

      {/* Add Student Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Yeni Öğrenci Ekle" size="xl"
        footer={<>
          <button onClick={() => setIsAddOpen(false)} className="btn-outline">İptal</button>
          {addTab === 'student' ? (
            <button onClick={() => setAddTab('lesson')} disabled={!addForm.first_name || !addForm.last_name} className="btn-primary">
              Ders Kaydı →
            </button>
          ) : (
            <button onClick={handleAdd} disabled={addSaving} className="btn-primary">
              {addSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
        </>}>

        {/* Sekme başlıkları */}
        <div className="flex border-b border-primary-100 mb-4 -mx-6 px-6">
          <button
            onClick={() => setAddTab('student')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${addTab === 'student' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Kişisel Bilgiler
          </button>
          <button
            onClick={() => setAddTab('lesson')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${addTab === 'lesson' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Ders Kaydı
            {addEnrollForm.instrument_id && (
              <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">✓</span>
            )}
          </button>
        </div>

        {addTab === 'student' ? (
          <StudentFormFields form={addForm} setForm={setAddForm} students={students} isEdit={false} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Enstrüman *</label>
              <select className="input" value={addEnrollForm.instrument_id} onChange={e => setAddEnrollForm(p => ({ ...p, instrument_id: e.target.value, teacher_id: '' }))}>
                <option value="">Seçiniz (opsiyonel)</option>
                {instruments.filter(i => i.is_active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Öğretmen</label>
              {(() => {
                const list = teachersForInstrument(addEnrollForm.instrument_id)
                const noTeacher = addEnrollForm.instrument_id && list.length === 0
                return noTeacher ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Bu enstrüman için kayıtlı öğretmen yok.{' '}
                    <button
                      type="button"
                      className="font-semibold underline hover:text-amber-900"
                      onClick={() => { setIsAddOpen(false); navigate('/teachers') }}
                    >
                      Öğretmenler sayfasına git →
                    </button>
                    <span className="block text-amber-500 mt-0.5">Öğretmeni düzenleyip "Öğrettiği Enstrümanlar" bölümünden enstrüman seçin.</span>
                  </div>
                ) : (
                  <select className="input" value={addEnrollForm.teacher_id} onChange={e => setAddEnrollForm(p => ({ ...p, teacher_id: e.target.value }))}>
                    <option value="">Seçiniz</option>
                    {list.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                )
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Ders Türü</label>
              <select className="input" value={addEnrollForm.lesson_type} onChange={e => setAddEnrollForm(p => ({ ...p, lesson_type: e.target.value as 'individual' | 'group' }))}>
                <option value="individual">Bireysel</option>
                <option value="group">Grup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Süre</label>
              <select className="input" value={addEnrollForm.lesson_duration} onChange={e => setAddEnrollForm(p => ({ ...p, lesson_duration: Number(e.target.value) as 30|45|60 }))}>
                <option value={30}>30 dk</option>
                <option value={45}>45 dk</option>
                <option value={60}>60 dk</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-primary-500 mb-1">Ders Günleri</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(LESSON_DAYS) as [string, string][]).map(([day, label]) => {
                  let selectedDays: string[] = []
                  try { selectedDays = JSON.parse(addEnrollForm.lesson_days) } catch { /* ignore */ }
                  const isSelected = selectedDays.includes(day)
                  return (
                    <button key={day} type="button"
                      onClick={() => {
                        let days: string[] = []
                        try { days = JSON.parse(addEnrollForm.lesson_days) } catch { /* ignore */ }
                        const next = isSelected ? days.filter(d => d !== day) : [...days, day]
                        setAddEnrollForm(p => ({ ...p, lesson_days: JSON.stringify(next) }))
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${isSelected ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Ders Saati</label>
              <input className="input" type="time" value={addEnrollForm.lesson_time}
                onChange={e => setAddEnrollForm(p => ({ ...p, lesson_time: e.target.value }))}
                disabled={addEnrollForm.lesson_time === 'TBD'} />
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                <input type="checkbox"
                  checked={addEnrollForm.lesson_time === 'TBD'}
                  onChange={e => setAddEnrollForm(p => ({ ...p, lesson_time: e.target.checked ? 'TBD' : '' }))} />
                <span className="text-xs text-primary-400">Saat henüz belirsiz (sonradan eklenecek)</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Aylık Ücret (₺)</label>
              <input className="input" type="number" min="0" value={addEnrollForm.monthly_fee}
                onChange={e => setAddEnrollForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Başlangıç Tarihi</label>
              <input className="input" type="date" value={addEnrollForm.start_date}
                onChange={e => setAddEnrollForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            {!addEnrollForm.instrument_id && (
              <div className="col-span-2 text-xs text-primary-400 bg-primary-50 rounded-lg p-3">
                Enstrüman seçilirse kayıt oluşturulur ve seçtiğiniz günler otomatik olarak Dersler programına eklenir.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Student Detail Modal */}
      {detailStudent && (
        <StudentDetailModal
          student={detailStudent}
          students={students}
          instruments={instruments}
          teachers={teachers}
          onClose={() => setDetailStudent(null)}
          onRefresh={async () => {
            await loadStudents()
            const all = await window.api.students.getAll()
            const updated = all.find(s => s.id === detailStudent.id)
            if (updated) setDetailStudent(updated)
          }}
        />
      )}

      {formerDetailStudent && (
        <FormerStudentDetailModal
          student={formerDetailStudent}
          onClose={() => setFormerDetailStudent(null)}
        />
      )}

      {/* Quick Pay Modal */}
      {quickPayStudent && (
        <AdvancedPaymentModal
          studentId={quickPayStudent.id}
          studentName={`${quickPayStudent.first_name} ${quickPayStudent.last_name}`}
          onClose={() => setQuickPayStudent(null)}
          onSuccess={() => loadStudents()}
        />
      )}

      {/* Bulk SMS Modal */}
      {bulkSmsOpen && (
        <BulkSmsModal
          students={students.filter(s => selectedIds.has(s.id))}
          onClose={() => setBulkSmsOpen(false)}
        />
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Öğrenci Sil" message="Bu öğrenciyi silmek istediğinize emin misiniz? İlgili tüm kayıtlar da silinecektir."
        confirmLabel="Sil" danger />
    </div>
  )
}

// QuickPayModal → AdvancedPaymentModal ile değiştirildi

// ─── Bulk SMS Modal ───────────────────────────────────────────────────────────

function BulkSmsModal({ students, onClose }: { students: Student[]; onClose: () => void }) {
  const [templates, setTemplates] = useState<{ key: string; name: string; content: string }[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [customMsg, setCustomMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    window.api.sms.templatesGetAll().then(list =>
      setTemplates(list.map(t => ({ key: t.template_key, name: t.name, content: t.content })))
    )
  }, [])

  const selectedTemplate = templates.find(t => t.key === selectedKey)
  const message = selectedKey ? (selectedTemplate?.content || '') : customMsg

  const handleSend = async () => {
    setSending(true)
    const items = students
      .filter(s => s.phone)
      .map(s => ({
        phone: s.phone!,
        recipientName: `${s.first_name} ${s.last_name}`,
        message: message
          .replace('{ad}', s.first_name)
          .replace('{soyad}', s.last_name)
          .replace('{ad_soyad}', `${s.first_name} ${s.last_name}`)
      }))
    await window.api.sms.sendBulk(items)
    setSending(false)
    setResult(`${items.length} öğrenciye SMS gönderildi.`)
  }

  return (
    <Modal isOpen onClose={onClose} title="Toplu SMS Gönder" size="lg"
      footer={<>
        <button onClick={onClose} className="btn-outline">Kapat</button>
        {!result && (
          <button onClick={handleSend} disabled={!message.trim() || sending} className="btn-primary">
            {sending ? 'Gönderiliyor...' : `${students.filter(s=>s.phone).length} Kişiye Gönder`}
          </button>
        )}
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-primary-500">{students.length} öğrenci seçildi ({students.filter(s => !s.phone).length} telefon yok)</p>
        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">{result}</div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Şablon Seç</label>
              <select className="input" value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
                <option value="">Özel Mesaj Yaz</option>
                {templates.map(t => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">
                Mesaj {selectedKey ? '(şablondan)' : ''}
                <span className="text-primary-300 ml-1">— {'{ad}'}, {'{soyad}'}, {'{ad_soyad}'} kullanabilirsiniz</span>
              </label>
              <textarea className="input resize-none" rows={4}
                value={selectedKey ? templates[selectedKey] || '' : customMsg}
                readOnly={!!selectedKey}
                onChange={e => !selectedKey && setCustomMsg(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Student Form Fields ──────────────────────────────────────────────────────

function StudentFormFields({
  form, setForm, students, isEdit
}: {
  form: Partial<Student>
  setForm: (fn: (prev: Partial<Student>) => Partial<Student>) => void
  students: Student[]
  isEdit: boolean
}) {
  const f = (field: keyof Student, val: unknown) => setForm(p => ({ ...p, [field]: val }))
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Ad *</label>
        <input className="input" value={form.first_name || ''} onChange={e => f('first_name', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Soyad *</label>
        <input className="input" value={form.last_name || ''} onChange={e => f('last_name', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Cinsiyet</label>
        <select className="input" value={form.gender || ''} onChange={e => f('gender', e.target.value || undefined)}>
          <option value="">Belirtilmemiş</option>
          <option value="male">Erkek</option>
          <option value="female">Kadın</option>
          <option value="other">Diğer</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Doğum Tarihi</label>
        <input className="input" type="date" value={form.birth_date || ''} onChange={e => f('birth_date', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Telefon</label>
        <PhoneInput className="input" value={form.phone || ''} onChange={v => f('phone', v)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">E-posta</label>
        <input className="input" type="email" value={form.email || ''} onChange={e => f('email', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Şehir</label>
        <input className="input" value={form.city || ''} onChange={e => f('city', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">İndirim (%)</label>
        <input className="input" type="number" min="0" max="100" value={form.discount_rate ?? 0} onChange={e => f('discount_rate', Number(e.target.value))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Veli Adı</label>
        <input className="input" value={form.parent_name || ''} onChange={e => f('parent_name', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Veli Telefonu</label>
        <PhoneInput className="input" value={form.parent_phone || ''} onChange={v => f('parent_phone', v)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Veli E-posta</label>
        <input className="input" type="email" value={form.parent_email || ''} onChange={e => f('parent_email', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Kayıt Tarihi</label>
        <input className="input" type="date" value={form.registration_date || ''} onChange={e => f('registration_date', e.target.value)} />
      </div>
      {isEdit && (
        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1">Durum</label>
          <select className="input" value={form.status || 'active'} onChange={e => f('status', e.target.value)}>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="frozen">Dondurulmuş</option>
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Referans Kaynağı</label>
        <select className="input" value={form.referral_source || ''} onChange={e => f('referral_source', e.target.value || undefined)}>
          <option value="">Belirtilmemiş</option>
          {Object.entries(REFERRAL_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-primary-500 mb-1">Referans Veren Öğrenci</label>
        <select className="input" value={form.referred_by_student_id || ''} onChange={e => f('referred_by_student_id', e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Seçiniz</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-primary-500 mb-1">Adres</label>
        <input className="input" value={form.address || ''} onChange={e => f('address', e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-primary-500 mb-1">Notlar</label>
        <textarea className="input resize-none" rows={3} value={form.notes || ''} onChange={e => f('notes', e.target.value)} />
      </div>
    </div>
  )
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function StudentDetailModal({ student, students, instruments, teachers, onClose, onRefresh }: {
  student: Student; students: Student[]; instruments: Instrument[]; teachers: Teacher[]
  onClose: () => void; onRefresh: () => Promise<void>
}) {
  const [detailTab, setDetailTab] = useState<'general' | 'enrollments' | 'payments' | 'progress' | 'documents'>('general')
  const [form, setForm]   = useState<Partial<Student>>(student)
  const [saving, setSaving] = useState(false)
  const [photoPath, setPhotoPath] = useState(student.photo_path || '')

  const handleSave = async () => {
    setSaving(true)
    await window.api.students.update(student.id, { ...form, photo_path: photoPath || undefined })
    setSaving(false)
    onRefresh()
  }

  const handlePhotoUpload = async () => {
    const path = await window.api.students.uploadPhoto(student.id)
    if (path) {
      setPhotoPath(path)
      onRefresh()
    }
  }

  const teachersForInstrument = (instrumentId: string | number) => {
    const active = teachers.filter(t => t.status === 'active')
    if (!instrumentId) return active
    const iid = Number(instrumentId)
    return active.filter(t => (t.instrument_ids || []).includes(iid))
  }

  const TABS = [
    { key: 'general',     label: 'Genel Bilgiler' },
    { key: 'enrollments', label: 'Kayıt & Dersler' },
    { key: 'payments',    label: 'Ödemeler' },
    { key: 'progress',    label: 'Gelişim Takibi' },
    { key: 'documents',   label: 'Belgeler' },
  ] as const

  return (
    <Modal isOpen onClose={onClose} title={`${student.first_name} ${student.last_name}`} size="2xl"
      footer={
        detailTab === 'general'
          ? <><button onClick={onClose} className="btn-outline">Kapat</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Kaydediliyor...' : 'Güncelle'}</button></>
          : <button onClick={onClose} className="btn-outline">Kapat</button>
      }>
      <div className="flex gap-0 border-b border-primary-100 mb-4 -mx-6 px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setDetailTab(t.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              detailTab === t.key ? 'border-primary text-primary' : 'border-transparent text-primary-400 hover:text-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === 'general' && (
        <div className="space-y-4">
          {/* Photo Upload */}
          <div className="flex items-center gap-4 pb-4 border-b border-primary-50">
            <StudentAvatar student={{ ...student, photo_path: photoPath }} size={72} />
            <div>
              <p className="text-sm font-semibold text-primary">{student.first_name} {student.last_name}</p>
              <p className="text-xs text-primary-400 mb-2">{calcAge(student.birth_date) !== null ? `${calcAge(student.birth_date)} yaş` : ''}</p>
              <button onClick={handlePhotoUpload} className="btn-outline text-xs px-3 py-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Fotoğraf Değiştir
              </button>
            </div>
          </div>
          <StudentFormFields form={form} setForm={setForm} students={students.filter(s => s.id !== student.id)} isEdit />
          <FreezeSection student={student} onRefresh={onRefresh} />
          <DepartureSection student={student} onRefresh={onRefresh} onClose={onClose} />
          <ParentProfileSection student={student} onRefresh={onRefresh} />
        </div>
      )}
      {detailTab === 'enrollments' && (
        <EnrollmentsTab student={student} instruments={instruments} teachers={teachers} teachersForInstrument={teachersForInstrument} />
      )}
      {detailTab === 'payments' && (
        <PaymentsTab student={student} />
      )}
      {detailTab === 'progress' && <PortfolioTab student={student} />}
      {detailTab === 'documents'  && (
        <BelgelerTab student={student} />
      )}
    </Modal>
  )
}

// ─── Enrollments Tab ──────────────────────────────────────────────────────────

function EnrollmentsTab({ student, instruments, teachers, teachersForInstrument }: {
  student: Student; instruments: Instrument[]; teachers: Teacher[]
  teachersForInstrument: (instrumentId: string | number) => Teacher[]
}) {
  const navigate = useNavigate()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [lessons, setLessons]         = useState<Lesson[]>([])
  const [selectedEnrId, setSelectedEnrId] = useState<number | null>(null)
  const [showForm, setShowForm]       = useState(false)
  const [editingEnrId, setEditingEnrId] = useState<number | null>(null)
  const [saving, setSaving]           = useState(false)
  const [form, setForm] = useState({
    instrument_id: '', teacher_id: '', lesson_type: 'individual',
    lesson_duration: 45 as 30 | 45 | 60,
    lessons_per_week: 1, lesson_days: '[]', lesson_time: '',
    monthly_fee: 0, start_date: new Date().toISOString().split('T')[0], notes: ''
  })

  const load = useCallback(async () => {
    const data = await window.api.enrollments.getByStudent(student.id)
    setEnrollments(data)
    if (data.length > 0 && !selectedEnrId) setSelectedEnrId(data[0].id)
  }, [student.id, selectedEnrId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (selectedEnrId) {
      window.api.lessons.getByEnrollment(selectedEnrId).then(setLessons)
    } else {
      setLessons([])
    }
  }, [selectedEnrId])

  const handleCreate = async () => {
    setSaving(true)
    await window.api.enrollments.create({
      student_id: student.id,
      instrument_id: form.instrument_id ? Number(form.instrument_id) : undefined,
      teacher_id: form.teacher_id ? Number(form.teacher_id) : undefined,
      lesson_type: form.lesson_type as 'individual' | 'group',
      lesson_duration: form.lesson_duration,
      lessons_per_week: form.lessons_per_week,
      lesson_days: form.lesson_days,
      lesson_time: form.lesson_time || undefined,
      monthly_fee: form.monthly_fee,
      start_date: form.start_date,
      notes: form.notes,
      status: 'active' as const
    })
    setSaving(false)
    setShowForm(false)
    load()
  }

  const openEdit = (enr: Enrollment) => {
    setForm({
      instrument_id: enr.instrument_id ? String(enr.instrument_id) : '',
      teacher_id: enr.teacher_id ? String(enr.teacher_id) : '',
      lesson_type: enr.lesson_type || 'individual',
      lesson_duration: (enr.lesson_duration as 30 | 45 | 60) || 45,
      lessons_per_week: enr.lessons_per_week || 1,
      lesson_days: enr.lesson_days || '[]',
      lesson_time: enr.lesson_time || '',
      monthly_fee: enr.monthly_fee || 0,
      start_date: enr.start_date || new Date().toISOString().split('T')[0],
      notes: enr.notes || ''
    })
    setEditingEnrId(enr.id)
    setShowForm(true)
  }

  const handleUpdate = async () => {
    if (!editingEnrId) return
    setSaving(true)
    await window.api.enrollments.update(editingEnrId, {
      instrument_id: form.instrument_id ? Number(form.instrument_id) : undefined,
      teacher_id: form.teacher_id ? Number(form.teacher_id) : undefined,
      lesson_type: form.lesson_type as 'individual' | 'group',
      lesson_duration: form.lesson_duration,
      lessons_per_week: form.lessons_per_week,
      lesson_days: form.lesson_days,
      lesson_time: (form.lesson_time && form.lesson_time !== 'TBD') ? form.lesson_time : undefined,
      monthly_fee: form.monthly_fee,
      start_date: form.start_date,
      notes: form.notes,
    })
    const today = new Date().toISOString().split('T')[0]
    const to = new Date(Date.now() + 28 * 24 * 3600 * 1000).toISOString().split('T')[0]
    await window.api.lessons.ensureForDateRange(today, to)
    setSaving(false)
    setShowForm(false)
    setEditingEnrId(null)
    load()
  }

  const handleStatusChange = async (enr: Enrollment, status: Enrollment['status']) => {
    await window.api.enrollments.update(enr.id, { ...enr, status })
    load()
  }

  const stats = {
    total: lessons.length,
    completed: lessons.filter(l => l.status === 'completed' || l.status === 'makeup').length,
    absent: lessons.filter(l => l.status === 'student_absent').length,
    cancelled: lessons.filter(l => l.status === 'cancelled' || l.status === 'teacher_absent').length
  }
  const rate = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0

  const LESSON_STATUS_CLS: Record<string, string> = {
    completed: 'badge-green', cancelled: 'badge-red', makeup: 'badge-blue',
    student_absent: 'badge-yellow', teacher_absent: 'badge-gray'
  }
  const LESSON_STATUS_TR: Record<string, string> = {
    completed: 'Tamamlandı', cancelled: 'İptal', makeup: 'Telafi',
    student_absent: 'Öğrenci Devamsız', teacher_absent: 'Öğretmen Devamsız'
  }

  return (
    <div className="space-y-4">
      {/* Enrollments List */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-primary">Kayıtlar ({enrollments.length})</h4>
        <button onClick={() => { setShowForm(v => !v); setEditingEnrId(null) }} className="btn-outline text-xs px-2 py-1">
          {showForm ? 'İptal' : '+ Yeni Kayıt'}
        </button>
      </div>

      {showForm && (
        <div className="border border-primary-100 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-primary-500">{editingEnrId ? 'Kaydı Düzenle' : 'Yeni Kayıt'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Enstrüman</label>
              <select className="input" value={form.instrument_id} onChange={e => setForm(p => ({ ...p, instrument_id: e.target.value, teacher_id: '' }))}>
                <option value="">Seçiniz</option>
                {instruments.filter(i => i.is_active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Öğretmen</label>
              {(() => {
                const list = teachersForInstrument(form.instrument_id ?? '')
                const noTeacher = form.instrument_id && list.length === 0
                return noTeacher ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Bu enstrüman için kayıtlı öğretmen yok.{' '}
                    <button
                      type="button"
                      className="font-semibold underline hover:text-amber-900"
                      onClick={() => navigate('/teachers')}
                    >
                      Öğretmenler sayfasına git →
                    </button>
                    <span className="block text-amber-500 mt-0.5">Öğretmeni düzenleyip "Öğrettiği Enstrümanlar" bölümünden enstrüman seçin.</span>
                  </div>
                ) : (
                  <select className="input" value={form.teacher_id} onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))}>
                    <option value="">Seçiniz</option>
                    {list.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                )
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Ders Türü</label>
              <select className="input" value={form.lesson_type} onChange={e => setForm(p => ({ ...p, lesson_type: e.target.value }))}>
                <option value="individual">Bireysel</option>
                <option value="group">Grup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Süre</label>
              <select className="input" value={form.lesson_duration} onChange={e => setForm(p => ({ ...p, lesson_duration: Number(e.target.value) as 30|45|60 }))}>
                <option value={30}>30 dk</option>
                <option value={45}>45 dk</option>
                <option value={60}>60 dk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Haftalık Ders</label>
              <input className="input" type="number" min="1" max="7" value={form.lessons_per_week}
                onChange={e => setForm(p => ({ ...p, lessons_per_week: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-primary-500 mb-1">Ders Günleri</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(LESSON_DAYS) as [string, string][]).map(([day, label]) => {
                  let selectedDays: string[] = []
                  try { selectedDays = JSON.parse(form.lesson_days) } catch { /* ignore */ }
                  const isSelected = selectedDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        let days: string[] = []
                        try { days = JSON.parse(form.lesson_days) } catch { /* ignore */ }
                        const next = isSelected ? days.filter(d => d !== day) : [...days, day]
                        setForm(p => ({ ...p, lesson_days: JSON.stringify(next) }))
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Saat</label>
              <input className="input" type="time" value={form.lesson_time === 'TBD' ? '' : form.lesson_time}
                onChange={e => setForm(p => ({ ...p, lesson_time: e.target.value }))}
                disabled={form.lesson_time === 'TBD'} />
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                <input type="checkbox"
                  checked={form.lesson_time === 'TBD'}
                  onChange={e => setForm(p => ({ ...p, lesson_time: e.target.checked ? 'TBD' : '' }))} />
                <span className="text-xs text-primary-400">Saat henüz belirsiz</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Aylık Ücret (₺)</label>
              <input className="input" type="number" min="0" value={form.monthly_fee}
                onChange={e => setForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Başlangıç Tarihi</label>
              <input className="input" type="date" value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-primary-500 mb-1">Notlar</label>
              <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditingEnrId(null) }} className="btn-outline text-xs px-3 py-1">İptal</button>
            <button onClick={editingEnrId ? handleUpdate : handleCreate} disabled={saving} className="btn-primary text-xs px-3 py-1">
              {saving ? 'Kaydediliyor...' : editingEnrId ? 'Güncelle' : 'Kayıt Oluştur'}
            </button>
          </div>
        </div>
      )}

      {enrollments.length === 0 ? (
        <p className="text-sm text-primary-400 py-4 text-center">Henüz ders kaydı yok.</p>
      ) : (
        <div className="space-y-2">
          {enrollments.map(enr => (
            <div key={enr.id}
              onClick={() => setSelectedEnrId(enr.id)}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedEnrId === enr.id ? 'border-primary bg-primary-50/40' : 'border-primary-100 hover:bg-primary-50/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {enr.instrument_color && (
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: enr.instrument_color }} />
                  )}
                  <span className="font-medium text-sm">{enr.instrument_name || '—'}</span>
                  <span className="text-primary-400 text-xs">— {enr.teacher_name || 'Öğretmen yok'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={enr.status === 'active' ? 'badge-green' : enr.status === 'paused' ? 'badge-blue' : 'badge-gray'}>
                    {enr.status === 'active' ? 'Aktif' : enr.status === 'paused' ? 'Durduruldu' : 'İptal'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); openEdit(enr) }}
                    className="text-xs text-primary-400 hover:text-primary-600 underline">Düzenle</button>
                  {enr.status === 'active' && (
                    <button onClick={e => { e.stopPropagation(); handleStatusChange(enr, 'paused') }}
                      className="text-xs text-primary-400 hover:text-primary-600 underline">Durdur</button>
                  )}
                  {enr.status === 'paused' && (
                    <button onClick={e => { e.stopPropagation(); handleStatusChange(enr, 'active') }}
                      className="text-xs text-green-600 hover:text-green-800 underline">Devam Et</button>
                  )}
                </div>
              </div>
              <div className="text-xs text-primary-400 mt-1">
                {enr.lesson_type === 'individual' ? 'Bireysel' : 'Grup'} · {enr.lesson_duration}dk · {parseLessonDays(enr.lesson_days)} {enr.lesson_time ? `@ ${enr.lesson_time}` : ''} · {enr.monthly_fee.toLocaleString('tr-TR')} ₺/ay
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lessons for selected enrollment */}
      {selectedEnrId && (
        <div className="border-t border-primary-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-primary">Ders Geçmişi</h4>
            <div className="flex gap-3 text-xs text-primary-500">
              <span className="text-green-600">✓ {stats.completed}</span>
              <span className="text-orange-500">✗ {stats.absent}</span>
              <span className="text-red-500">— {stats.cancelled}</span>
              <span className="font-medium">Devam: %{rate}</span>
            </div>
          </div>
          {lessons.length === 0 ? (
            <p className="text-sm text-primary-400">Bu kayıt için ders kaydı yok.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {[...lessons].sort((a,b) => b.lesson_date.localeCompare(a.lesson_date)).map(l => (
                <div key={l.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-primary-50">
                  <span className="text-primary-400 text-xs w-24 flex-shrink-0">{formatDate(l.lesson_date)}</span>
                  <span className={LESSON_STATUS_CLS[l.status] || 'badge-gray'}>
                    {LESSON_STATUS_TR[l.status] || l.status}
                  </span>
                  <span className="text-primary-400 text-xs truncate">{l.topic_covered || l.teacher_notes || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ student }: { student: Student }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [year, setYear]         = useState(new Date().getFullYear())
  const [showPayForm, setShowPayForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [payForm, setPayForm] = useState<{
    amount: number
    payment_method: Payment['payment_method']
    payment_type: Payment['payment_type']
    period_month: number; period_year: number; notes: string
  }>({
    amount: (student.total_monthly_fee || 0),
    payment_method: 'cash', payment_type: 'monthly_fee',
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(), notes: ''
  })

  const load = useCallback(async () => {
    const data = await window.api.payments.getByStudent(student.id)
    setPayments(data)
  }, [student.id])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    const discount = student.discount_rate || 0
    const discountAmt = (payForm.amount * discount) / 100
    await window.api.payments.create({
      student_id: student.id,
      payment_type: payForm.payment_type,
      amount: payForm.amount,
      discount_amount: discountAmt,
      total_amount: payForm.amount - discountAmt,
      payment_method: payForm.payment_method,
      payment_date: new Date().toISOString().split('T')[0],
      period_month: payForm.period_month,
      period_year: payForm.period_year,
      status: 'paid',
      notes: payForm.notes
    })
    setSaving(false)
    setShowPayForm(false)
    load()
  }

  // Monthly payment map for selected year
  const monthlyMap: Record<number, Payment[]> = {}
  for (let m = 1; m <= 12; m++) monthlyMap[m] = []
  payments.filter(p => p.period_year === year && p.payment_type === 'monthly_fee').forEach(p => {
    if (p.period_month) monthlyMap[p.period_month]?.push(p)
  })

  const MONTH_NAMES = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  const now = new Date()

  const monthStatus = (m: number): 'paid' | 'overdue' | 'pending' | 'future' => {
    const plist = monthlyMap[m] || []
    if (plist.some(p => p.status === 'paid')) return 'paid'
    if (year < now.getFullYear() || (year === now.getFullYear() && m < now.getMonth() + 1)) return 'overdue'
    if (year === now.getFullYear() && m === now.getMonth() + 1) return 'pending'
    return 'future'
  }

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    paid:    { bg: '#e8f5e9', text: '#2e7d32', label: 'Ödendi' },
    overdue: { bg: '#fce4ec', text: '#c62828', label: 'Gecikmiş' },
    pending: { bg: '#fff3e0', text: '#e65100', label: 'Bekliyor' },
    future:  { bg: '#f5f5f5', text: '#9e9e9e', label: '' }
  }

  const selectedMonthPayments = selectedMonth ? payments.filter(p => p.period_month === selectedMonth && p.period_year === year) : []

  return (
    <div className="space-y-4">
      {/* Year selector + Quick Pay button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="btn-ghost px-2 py-1">‹</button>
          <span className="font-semibold text-primary">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="btn-ghost px-2 py-1">›</button>
        </div>
        <button onClick={() => setShowPayForm(!showPayForm)} className="btn-primary text-xs px-3 py-1.5">
          + Ödeme Al
        </button>
      </div>

      {/* Quick Pay Form */}
      {showPayForm && (
        <div className="border border-primary-100 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Tutar (₺)</label>
              <input className="input" type="number" min="0" value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Yöntem</label>
              <select className="input" value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value as Payment['payment_method'] }))}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Tür</label>
              <select className="input" value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value as Payment['payment_type'] }))}>
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Dönem</label>
              <div className="flex gap-1">
                <select className="input" value={payForm.period_month} onChange={e => setPayForm(p => ({ ...p, period_month: Number(e.target.value) }))}>
                  {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <input className="input w-20" type="number" value={payForm.period_year}
                  onChange={e => setPayForm(p => ({ ...p, period_year: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-primary-500 mb-1">Not</label>
              <input className="input" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowPayForm(false)} className="btn-outline text-xs px-3 py-1">İptal</button>
            <button onClick={handleSave} disabled={saving || !payForm.amount} className="btn-primary text-xs px-3 py-1">
              {saving ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* Monthly Calendar Grid */}
      <div className="grid grid-cols-6 gap-2">
        {MONTH_NAMES.map((m, i) => {
          const month = i + 1
          const st = monthStatus(month)
          const style = statusStyles[st]
          const isPaid = st === 'paid'
          const total = (monthlyMap[month] || []).reduce((s, p) => s + p.total_amount, 0)
          return (
            <button key={month} onClick={() => setSelectedMonth(selectedMonth === month ? null : month)}
              style={{
                backgroundColor: selectedMonth === month ? '#1B3A6B' : style.bg,
                color: selectedMonth === month ? '#fff' : style.text,
                borderRadius: 8, padding: '8px 4px', border: 'none', cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.15s'
              }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{m}</div>
              {isPaid && total > 0 && (
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>{total.toLocaleString('tr-TR')}₺</div>
              )}
              {style.label && !isPaid && (
                <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8 }}>{style.label}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Month Payments */}
      {selectedMonth !== null && (
        <div className="border border-primary-100 rounded-lg p-3">
          <h5 className="text-xs font-semibold text-primary-600 mb-2">{MONTH_NAMES[selectedMonth - 1]} {year} Ödemeleri</h5>
          {selectedMonthPayments.length === 0 ? (
            <p className="text-xs text-primary-400">Bu ay için ödeme kaydı yok.</p>
          ) : selectedMonthPayments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-primary-50 text-sm">
              <div>
                <span>{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</span>
                <span className="text-primary-400 text-xs ml-2">— {PAYMENT_METHOD_LABELS[p.payment_method]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.total_amount.toLocaleString('tr-TR')} ₺</span>
                <span className={PAYMENT_STATUS_CLS[p.status] || 'badge-gray'}>{PAYMENT_STATUS_LABELS[p.status]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment History Table */}
      <div>
        <h4 className="text-xs font-semibold text-primary-500 mb-2">Tüm Ödemeler ({payments.length})</h4>
        {payments.length === 0 ? (
          <p className="text-sm text-primary-400">Henüz ödeme kaydı yok.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th>Tutar</th>
                  <th>Yöntem</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {[...payments].sort((a,b) => b.payment_date.localeCompare(a.payment_date)).map(p => (
                  <tr key={p.id}>
                    <td className="text-primary-400 text-xs">{formatDate(p.payment_date)}</td>
                    <td>{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</td>
                    <td className="font-medium">{p.total_amount.toLocaleString('tr-TR')} ₺</td>
                    <td className="text-primary-400 text-xs">{PAYMENT_METHOD_LABELS[p.payment_method]}</td>
                    <td><span className={PAYMENT_STATUS_CLS[p.status] || 'badge-gray'}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Portfolio Tab (Gelişim Takibi) ──────────────────────────────────────────

function PortfolioTab({ student }: { student: Student }) {
  const [progressList, setProgressList] = useState<StudentProgress[]>([])
  const [lessons, setLessons]           = useState<Lesson[]>([])
  const [showForm, setShowForm]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm] = useState({
    technical_score: 5, theory_score: 5, practice_score: 5, performance_score: 5,
    current_level: '' as StudentProgress['current_level'], current_piece: '', goals: '', notes: ''
  })

  useEffect(() => {
    window.api.progress.getByStudent(student.id).then(setProgressList)
    window.api.lessons.getByStudent(student.id).then(setLessons)
  }, [student.id])

  const latest = progressList[0]
  const radarData = [
    { subject: 'Teknik',     value: latest?.technical_score   ?? 0, fullMark: 10 },
    { subject: 'Teori',      value: latest?.theory_score      ?? 0, fullMark: 10 },
    { subject: 'Pratik',     value: latest?.practice_score    ?? 0, fullMark: 10 },
    { subject: 'Performans', value: latest?.performance_score ?? 0, fullMark: 10 },
  ]

  const handleSave = async () => {
    setSaving(true)
    await window.api.progress.create({ student_id: student.id, assessment_date: new Date().toISOString().split('T')[0], ...form })
    setSaving(false)
    setShowForm(false)
    window.api.progress.getByStudent(student.id).then(setProgressList)
  }

  return (
    <div className="space-y-5">
      <div className="bg-primary-50/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-primary">Son Değerlendirme</h4>
          <button onClick={() => setShowForm(!showForm)} className="btn-outline text-xs px-2 py-1">
            {showForm ? 'İptal' : '+ Yeni Değerlendirme'}
          </button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
            <Radar dataKey="value" stroke="#1B3A6B" fill="#1B3A6B" fillOpacity={0.3} />
            <Tooltip formatter={(v) => [`${v}/10`, '']} />
          </RadarChart>
        </ResponsiveContainer>
        {latest && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {latest.current_level && <span className="badge-green">{PROGRESS_LEVEL_LABELS[latest.current_level]}</span>}
            {latest.current_piece && <span className="badge-blue">Parça: {latest.current_piece}</span>}
          </div>
        )}
      </div>

      {showForm && (
        <div className="border border-primary-100 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-semibold text-primary-600">Yeni Değerlendirme</h5>
          <div className="grid grid-cols-2 gap-3">
            {([['technical_score','Teknik'],['theory_score','Teori'],['practice_score','Pratik'],['performance_score','Performans']] as [string, string][]).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-primary-500 mb-1">{label} (1-10)</label>
                <input className="input" type="number" min="1" max="10" value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Seviye</label>
              <select className="input" value={form.current_level || ''} onChange={e => setForm(p => ({ ...p, current_level: e.target.value as any || undefined }))}>
                <option value="">Belirtilmemiş</option>
                {Object.entries(PROGRESS_LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Güncel Parça</label>
              <input className="input" value={form.current_piece} onChange={e => setForm(p => ({ ...p, current_piece: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-primary-500 mb-1">Notlar</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs px-3 py-1">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {progressList.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-primary-500 mb-2">Geçmiş Değerlendirmeler</h5>
          {progressList.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center gap-3 text-sm p-2 bg-primary-50/40 rounded mb-1">
              <span className="text-primary-400 text-xs w-20 flex-shrink-0">{formatDate(p.assessment_date)}</span>
              <span className="text-xs text-primary-500">T:{p.technical_score} Th:{p.theory_score} P:{p.practice_score} Pf:{p.performance_score}</span>
              {p.current_level && <span className="badge-green text-xs">{PROGRESS_LEVEL_LABELS[p.current_level]}</span>}
            </div>
          ))}
        </div>
      )}

      {lessons.filter(l => l.homework).length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-primary-500 mb-2">Son Ödevler</h5>
          {lessons.filter(l => l.homework).slice(0, 8).map(l => (
            <div key={l.id} className="text-sm p-2 bg-yellow-50 rounded border border-yellow-100 mb-1">
              <span className="text-primary-400 text-xs mr-2">{formatDate(l.lesson_date)}</span>
              <span>{l.homework}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Belgeler Tab ─────────────────────────────────────────────────────────────

function BelgelerTab({ student }: { student: Student }) {
  const certRef        = useRef<HTMLDivElement>(null)
  const regFormRef     = useRef<HTMLDivElement>(null)
  const attendanceRef  = useRef<HTMLDivElement>(null)
  const [template, setTemplate]   = useState<CertificateTemplate>('achievement')
  const [certTitle, setCertTitle] = useState('')
  const [certBody, setCertBody]   = useState('')
  const [certSigner, setCertSigner] = useState('')
  const [certDate, setCertDate]   = useState(new Date().toLocaleDateString('tr-TR'))
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [lessons, setLessons]         = useState<Lesson[]>([])
  const [statusHistory, setStatusHistory] = useState<StudentStatusHistory[]>([])
  const [departures, setDepartures]   = useState<DepartureRecord[]>([])

  useEffect(() => {
    window.api.enrollments.getByStudent(student.id).then(setEnrollments)
    window.api.lessons.getByStudent(student.id).then(setLessons)
    window.api.status_history.getByStudent(student.id).then(setStatusHistory)
    window.api.departures.getByStudent(student.id).then(setDepartures)
  }, [student.id])

  const printCert       = useReactToPrint({ content: () => certRef.current })
  const printRegForm    = useReactToPrint({ content: () => regFormRef.current })
  const printAttendance = useReactToPrint({ content: () => attendanceRef.current })

  const dotColor: Record<string, string> = { active: 'bg-green-400', passive: 'bg-gray-400', frozen: 'bg-blue-400' }
  const statusTr: Record<string, string> = { active: 'Aktif', passive: 'Pasif', frozen: 'Dondurulmuş' }

  return (
    <div className="space-y-5">
      {/* Print Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={printRegForm} className="border border-primary-200 rounded-lg p-3 text-center hover:bg-primary-50 transition-colors">
          <svg className="w-6 h-6 mx-auto mb-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs font-medium text-primary">Kayıt Formu</p>
          <p className="text-xs text-primary-400">Yazdır / PDF</p>
        </button>
        <button onClick={printAttendance} className="border border-primary-200 rounded-lg p-3 text-center hover:bg-primary-50 transition-colors">
          <svg className="w-6 h-6 mx-auto mb-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <p className="text-xs font-medium text-primary">Devamsızlık Raporu</p>
          <p className="text-xs text-primary-400">Yazdır / PDF</p>
        </button>
        <button onClick={printCert} className="border border-accent/50 rounded-lg p-3 text-center hover:bg-accent/5 transition-colors">
          <svg className="w-6 h-6 mx-auto mb-1 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p className="text-xs font-medium text-accent">Sertifika</p>
          <p className="text-xs text-primary-400">Yazdır / PDF</p>
        </button>
      </div>

      {/* Certificate Settings */}
      <div className="border border-primary-100 rounded-lg p-3 space-y-3">
        <h5 className="text-xs font-semibold text-primary-600">Sertifika Ayarları</h5>
        <div className="flex gap-2">
          {([['achievement','Başarı'],['participation','Katılım'],['special','Özel']] as [CertificateTemplate, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTemplate(t)}
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${template === t ? 'border-primary bg-primary text-white' : 'border-primary-100 text-primary-500 hover:bg-primary-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Tarih</label>
            <input className="input text-xs" value={certDate} onChange={e => setCertDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">İmzalayan</label>
            <input className="input text-xs" placeholder="Öğretmen..." value={certSigner} onChange={e => setCertSigner(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Başlık</label>
            <input className="input text-xs" placeholder="Ödül adı..." value={certTitle} onChange={e => setCertTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">İçerik</label>
            <input className="input text-xs" placeholder="Metin..." value={certBody} onChange={e => setCertBody(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Status History */}
      {statusHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-primary mb-3">Durum Tarihçesi</h4>
          {statusHistory.map(h => (
            <div key={h.id} className="flex items-start gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor[h.new_status] || 'bg-gray-400'}`} />
              <div className="flex-1 text-sm">
                <span className="font-medium">{statusTr[h.new_status] || h.new_status}</span>
                {h.old_status && <span className="text-primary-400 text-xs ml-2">← {statusTr[h.old_status] || h.old_status}</span>}
                {h.reason && <p className="text-primary-400 text-xs">{h.reason}</p>}
                <p className="text-primary-300 text-xs">{new Date(h.changed_at).toLocaleString('tr-TR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {departures.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-3">Ayrılış Kayıtları</h4>
          {departures.map(d => (
            <div key={d.id} className="bg-red-50 rounded-lg p-3 border border-red-100 text-sm space-y-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-700">{DEPARTURE_REASON_LABELS[d.reason_category]}</span>
                <span className="text-xs text-red-400">{formatDate(d.departure_date)}</span>
              </div>
              {d.reason_detail && <p className="text-red-600 text-xs">{d.reason_detail}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Hidden print components */}
      <div style={{ position: 'absolute', left: -9999, top: 0 }}>
        <StudentRegistrationForm ref={regFormRef} student={student} enrollments={enrollments} />
        <StudentAttendanceReport ref={attendanceRef} student={student} lessons={lessons} />
        <StudentCertificate ref={certRef}
          studentName={`${student.first_name} ${student.last_name}`}
          date={certDate} title={certTitle} body={certBody}
          signerName={certSigner} template={template} />
      </div>
    </div>
  )
}

// ─── Freeze Section ───────────────────────────────────────────────────────────

function FreezeSection({ student, onRefresh }: { student: Student; onRefresh: () => Promise<void> }) {
  const [freezes, setFreezes]   = useState<StudentFreeze[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    freeze_start: new Date().toISOString().split('T')[0],
    freeze_end: '', reason: '', extend_payment_plans: true, notes: ''
  })

  useEffect(() => { window.api.student_freezes.getByStudent(student.id).then(setFreezes) }, [student.id])

  const activeFreeze = freezes.find(f => f.status === 'active')

  const handleFreeze = async () => {
    setSaving(true)
    await window.api.student_freezes.create({
      student_id: student.id,
      freeze_start: form.freeze_start,
      freeze_end: form.freeze_end || undefined,
      reason: form.reason,
      extend_payment_plans: form.extend_payment_plans ? 1 : 0,
      notes: form.notes
    })
    setSaving(false)
    setShowForm(false)
    window.api.student_freezes.getByStudent(student.id).then(setFreezes)
    onRefresh()
  }

  const handleEndFreeze = async () => {
    if (!activeFreeze) return
    await window.api.student_freezes.end(activeFreeze.id)
    window.api.student_freezes.getByStudent(student.id).then(setFreezes)
    onRefresh()
  }

  return (
    <div className="border border-blue-100 rounded-lg p-4 bg-blue-50/30">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-primary">Kayıt Dondurma</h4>
        {activeFreeze
          ? <button onClick={handleEndFreeze} className="btn-outline text-xs px-2 py-1">Dondurumu Kaldır</button>
          : <button onClick={() => setShowForm(!showForm)} className="btn-outline text-xs px-2 py-1">{showForm ? 'İptal' : 'Kaydı Dondur'}</button>}
      </div>
      {activeFreeze && (
        <div className="text-sm text-blue-700 bg-blue-100 rounded p-2 mb-2">
          <span className="font-medium">Aktif Dondurma:</span> {formatDate(activeFreeze.freeze_start)}
          {activeFreeze.freeze_end ? ` → ${formatDate(activeFreeze.freeze_end)}` : ' (süresiz)'}
          <span className="text-xs text-blue-500 ml-2">— {activeFreeze.reason}</span>
        </div>
      )}
      {showForm && !activeFreeze && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Başlangıç *</label>
            <input className="input" type="date" value={form.freeze_start} onChange={e => setForm(p => ({ ...p, freeze_start: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Bitiş (opsiyonel)</label>
            <input className="input" type="date" value={form.freeze_end} onChange={e => setForm(p => ({ ...p, freeze_end: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">Neden *</label>
            <input className="input" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Hastalık, seyahat..." />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="extPlan" checked={form.extend_payment_plans} onChange={e => setForm(p => ({ ...p, extend_payment_plans: e.target.checked }))} />
            <label htmlFor="extPlan" className="text-xs text-primary-600 cursor-pointer">Taksit plan vadelerini öte</label>
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs px-3 py-1">İptal</button>
            <button onClick={handleFreeze} disabled={!form.reason || saving} className="btn-primary text-xs px-3 py-1">
              {saving ? 'Kaydediliyor...' : 'Dondur'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Departure Section ────────────────────────────────────────────────────────

function DepartureSection({ student, onRefresh, onClose }: { student: Student; onRefresh: () => Promise<void>; onClose: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    departure_date: new Date().toISOString().split('T')[0],
    reason_category: 'other' as DepartureRecord['reason_category'],
    reason_detail: '', would_return: false,
    student_rating: 0, school_rating: 0,
    last_lesson_date: '', notes: ''
  })

  const handleSave = async () => {
    setSaving(true)
    await window.api.departures.create({
      student_id: student.id,
      departure_date: form.departure_date,
      reason_category: form.reason_category,
      reason_detail: form.reason_detail,
      would_return: form.would_return ? 1 : 0,
      student_rating: form.student_rating || undefined,
      school_rating: form.school_rating || undefined,
      last_lesson_date: form.last_lesson_date || undefined,
      notes: form.notes
    })
    await window.api.students.setStatus(student.id, 'passive')
    setSaving(false)
    await onRefresh()
    onClose()
  }

  return (
    <div className="border border-red-100 rounded-lg p-4 bg-red-50/20">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-red-700">Ayrılış Kaydı</h4>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-red-600 hover:text-red-800 underline">
          {showForm ? 'İptal' : 'Ayrılış Formu Doldur'}
        </button>
      </div>
      {showForm && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Ayrılış Tarihi *</label>
            <input className="input" type="date" value={form.departure_date} onChange={e => setForm(p => ({ ...p, departure_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Son Ders Tarihi</label>
            <input className="input" type="date" value={form.last_lesson_date} onChange={e => setForm(p => ({ ...p, last_lesson_date: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">Ayrılış Nedeni *</label>
            <select className="input" value={form.reason_category} onChange={e => setForm(p => ({ ...p, reason_category: e.target.value as any }))}>
              {Object.entries(DEPARTURE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">Açıklama</label>
            <input className="input" value={form.reason_detail} onChange={e => setForm(p => ({ ...p, reason_detail: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Öğrencinin Kurumu Değerlendirmesi</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, student_rating: Math.max(0, p.student_rating - 1) }))}
                className="w-8 h-8 rounded border border-primary-200 text-primary-600 hover:bg-primary-50 flex items-center justify-center text-lg font-bold">−</button>
              <span className="w-8 text-center font-semibold text-primary-800">{form.student_rating || '—'}</span>
              <button type="button" onClick={() => setForm(p => ({ ...p, student_rating: Math.min(5, p.student_rating + 1) }))}
                className="w-8 h-8 rounded border border-primary-200 text-primary-600 hover:bg-primary-50 flex items-center justify-center text-lg font-bold">+</button>
              <span className="text-xs text-primary-400">/ 5</span>
              {form.student_rating > 0 && <button type="button" onClick={() => setForm(p => ({ ...p, student_rating: 0 }))} className="text-xs text-primary-300 hover:text-primary-500">sıfırla</button>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Kurumun Öğrenciyi Değerlendirmesi</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, school_rating: Math.max(0, p.school_rating - 1) }))}
                className="w-8 h-8 rounded border border-primary-200 text-primary-600 hover:bg-primary-50 flex items-center justify-center text-lg font-bold">−</button>
              <span className="w-8 text-center font-semibold text-primary-800">{form.school_rating || '—'}</span>
              <button type="button" onClick={() => setForm(p => ({ ...p, school_rating: Math.min(5, p.school_rating + 1) }))}
                className="w-8 h-8 rounded border border-primary-200 text-primary-600 hover:bg-primary-50 flex items-center justify-center text-lg font-bold">+</button>
              <span className="text-xs text-primary-400">/ 5</span>
              {form.school_rating > 0 && <button type="button" onClick={() => setForm(p => ({ ...p, school_rating: 0 }))} className="text-xs text-primary-300 hover:text-primary-500">sıfırla</button>}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="wReturn" checked={form.would_return} onChange={e => setForm(p => ({ ...p, would_return: e.target.checked }))} />
            <label htmlFor="wReturn" className="text-xs text-primary-600 cursor-pointer">Tekrar gelmek ister</label>
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs px-3 py-1">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1" style={{ background: '#dc2626' }}>
              {saving ? 'Kaydediliyor...' : 'Ayrılışı Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Parent Profile Section ───────────────────────────────────────────────────

function ParentProfileSection({ student, onRefresh }: { student: Student; onRefresh: () => Promise<void> }) {
  const [open, setOpen]             = useState(false)
  const [profile, setProfile]       = useState<ParentProfile | null>(null)
  const [siblings, setSiblings]     = useState<Student[]>([])
  const [searchQ, setSearchQ]       = useState('')
  const [results, setResults]       = useState<ParentProfile[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState<Partial<ParentProfile>>({
    first_name: '', last_name: '', phone: '', phone2: '',
    email: '', address: '', occupation: '', sibling_discount_rate: 0
  })

  useEffect(() => {
    if (open && student.parent_profile_id) {
      window.api.parent_profiles.getAll().then(all => {
        const found = all.find(p => p.id === student.parent_profile_id)
        if (found) {
          setProfile(found)
          window.api.parent_profiles.getStudents(found.id).then(s => setSiblings(s.filter(x => x.id !== student.id)))
        }
      })
    }
  }, [open, student.parent_profile_id, student.id])

  const handleSearch = async () => {
    if (!searchQ.trim()) return
    setResults(await window.api.parent_profiles.search(searchQ))
  }

  const handleLink = async (profileId: number) => {
    await window.api.students.update(student.id, { ...student, parent_profile_id: profileId })
    setResults([])
    setSearchQ('')
    onRefresh()
  }

  const handleCreate = async () => {
    setSaving(true)
    const np = await window.api.parent_profiles.create(form)
    await window.api.students.update(student.id, { ...student, parent_profile_id: np.id })
    setSaving(false)
    setShowCreate(false)
    setProfile(np)
    onRefresh()
  }

  const fld = (field: keyof ParentProfile, val: unknown) => setForm(p => ({ ...p, [field]: val }))

  return (
    <div className="border border-primary-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-primary-50/30 hover:bg-primary-50 transition-colors text-sm font-semibold text-primary text-left">
        Veli Profili
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {profile ? (
            <div className="space-y-3">
              <div className="bg-primary-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-primary">{profile.first_name} {profile.last_name}</h4>
                  <span className="badge-green">Bağlı</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm text-primary-600">
                  {profile.phone && <div><span className="font-medium">Tel:</span> {profile.phone}</div>}
                  {profile.email && <div><span className="font-medium">E:</span> {profile.email}</div>}
                  {profile.occupation && <div><span className="font-medium">Meslek:</span> {profile.occupation}</div>}
                </div>
              </div>
              {siblings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary-500 mb-1">Kardeşler</p>
                  {siblings.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm p-2 bg-primary-50/50 rounded mb-1">
                      <span className="font-medium">{s.first_name} {s.last_name}</span>
                      <span className={statusConfig[s.status]?.cls ?? 'badge-gray'}>{statusConfig[s.status]?.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-primary-400">Bu öğrenciye bağlı veli profili yok.</p>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Ad, soyad veya tel..." value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} className="btn-outline px-3 text-xs">Ara</button>
              </div>
              {results.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 border border-primary-100 rounded text-sm">
                  <span>{p.first_name} {p.last_name} {p.phone && `— ${p.phone}`}</span>
                  <button onClick={() => handleLink(p.id)} className="btn-primary text-xs px-2 py-1">Bağla</button>
                </div>
              ))}
              <button onClick={() => setShowCreate(!showCreate)} className="btn-outline text-xs">
                {showCreate ? 'İptal' : '+ Yeni Veli Profili'}
              </button>
              {showCreate && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {([['first_name','Ad *'],['last_name','Soyad *'],['phone','Telefon'],['email','E-posta']] as [keyof ParentProfile, string][]).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-primary-500 mb-1">{label}</label>
                      {field === 'phone' ? (
                        <PhoneInput className="input text-sm" value={(form as any)[field] || ''} onChange={v => fld(field, v)} />
                      ) : (
                        <input className="input text-sm" value={(form as any)[field] || ''} onChange={e => fld(field, e.target.value)} />
                      )}
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-end gap-2">
                    <button onClick={() => setShowCreate(false)} className="btn-outline text-xs px-3 py-1">İptal</button>
                    <button onClick={handleCreate} disabled={!form.first_name || !form.last_name || saving} className="btn-primary text-xs px-3 py-1">
                      {saving ? 'Oluşturuluyor...' : 'Oluştur & Bağla'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pre-Registrations Tab ────────────────────────────────────────────────────

function PreRegistrationsTab({ onStudentCreated }: { onStudentCreated: () => void }) {
  const [preRegs, setPreRegs]             = useState<PreRegistration[]>([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState('all')
  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [convertTarget, setConvertTarget] = useState<PreRegistration | null>(null)
  const [deleteId, setDeleteId]           = useState<number | null>(null)
  const [saving, setSaving]               = useState(false)
  const [form, setForm]                   = useState<Partial<PreRegistration>>({
    first_name: '', last_name: '', phone: '', email: '',
    parent_name: '', parent_phone: '', instrument_interest: '',
    how_heard: '', notes: '', status: 'pending'
  })

  const load = async () => {
    const data = await window.api.pre_registrations.getAll()
    setPreRegs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = preRegs.filter(p => filter === 'all' || p.status === filter)

  const handleCreate = async () => {
    setSaving(true)
    await window.api.pre_registrations.create(form)
    setSaving(false)
    setIsModalOpen(false)
    load()
  }

  const handleContact = async (pr: PreRegistration) => {
    await window.api.pre_registrations.update(pr.id, { ...pr, status: 'contacted', contacted_at: new Date().toISOString() })
    load()
  }

  const handleCancel = async (id: number) => {
    await window.api.pre_registrations.update(id, { status: 'cancelled' } as any)
    load()
  }

  const handleConvert = async () => {
    if (!convertTarget) return
    setSaving(true)
    await window.api.pre_registrations.convert(convertTarget.id, {
      first_name: convertTarget.first_name, last_name: convertTarget.last_name,
      birth_date: convertTarget.birth_date, phone: convertTarget.phone,
      email: convertTarget.email, parent_name: convertTarget.parent_name,
      parent_phone: convertTarget.parent_phone, notes: convertTarget.notes,
      status: 'active', discount_rate: 0,
      registration_date: new Date().toISOString().split('T')[0]
    })
    setSaving(false)
    setConvertTarget(null)
    load()
    onStudentCreated()
  }

  const handleDelete = async () => {
    if (deleteId) await window.api.pre_registrations.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const statusColors: Record<string, string> = {
    pending: 'badge-gray', contacted: 'badge-blue', converted: 'badge-green', cancelled: 'badge-red'
  }

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-primary-100">
          {(['all', 'pending', 'contacted', 'converted', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === s ? 'bg-primary text-white' : 'text-primary-400 hover:bg-primary-50'}`}>
              {s === 'all' ? `Tümü (${preRegs.length})` : PRE_REG_STATUS_LABELS[s as PreRegistration['status']]}
            </button>
          ))}
        </div>
        <button onClick={() => { setForm({ first_name: '', last_name: '', phone: '', email: '', parent_name: '', parent_phone: '', instrument_interest: '', how_heard: '', notes: '', status: 'pending' }); setIsModalOpen(true) }} className="btn-primary ml-auto">
          + Ön Kayıt Ekle
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Ön kayıt bulunamadı" description="Henüz ön kayıt eklenmemiş."
          action={<button onClick={() => setIsModalOpen(true)} className="btn-primary">Ön Kayıt Ekle</button>} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Ad Soyad</th><th>Telefon</th><th>Veli</th>
                <th>İlgi Alanı</th><th>Nereden Duydu</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pr => (
                <tr key={pr.id}>
                  <td className="font-medium">{pr.first_name} {pr.last_name}</td>
                  <td className="text-primary-400">{pr.phone || '—'}</td>
                  <td className="text-sm">{pr.parent_name || '—'} {pr.parent_phone ? `(${pr.parent_phone})` : ''}</td>
                  <td className="text-sm text-primary-500">{pr.instrument_interest || '—'}</td>
                  <td className="text-sm text-primary-400">{pr.how_heard || '—'}</td>
                  <td><span className={statusColors[pr.status] || 'badge-gray'}>{PRE_REG_STATUS_LABELS[pr.status]}</span></td>
                  <td>
                    <div className="flex items-center gap-1 flex-wrap">
                      {pr.status === 'pending' && <button onClick={() => handleContact(pr)} className="btn-ghost px-2 py-1 text-xs">İletişim Kuruldu</button>}
                      {(pr.status === 'pending' || pr.status === 'contacted') && <button onClick={() => setConvertTarget(pr)} className="btn-ghost px-2 py-1 text-xs text-green-700 hover:bg-green-50">Dönüştür</button>}
                      {pr.status !== 'cancelled' && pr.status !== 'converted' && <button onClick={() => handleCancel(pr.id)} className="btn-ghost px-2 py-1 text-xs text-red-500">İptal</button>}
                      <button onClick={() => setDeleteId(pr.id)} className="btn-ghost px-2 py-1 text-xs text-red-500">Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Yeni Ön Kayıt" size="lg"
        footer={<>
          <button onClick={() => setIsModalOpen(false)} className="btn-outline">İptal</button>
          <button onClick={handleCreate} disabled={!form.first_name || !form.last_name || saving} className="btn-primary">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          {([['first_name','Ad *'],['last_name','Soyad *'],['phone','Telefon'],['email','E-posta'],['parent_name','Veli Adı'],['parent_phone','Veli Telefonu']] as [keyof PreRegistration, string][]).map(([field, label]) => (
            <div key={field}>
              <label className="block text-xs font-medium text-primary-500 mb-1">{label}</label>
              {(field === 'phone' || field === 'parent_phone') ? (
                <PhoneInput className="input" value={(form as any)[field] || ''} onChange={v => setForm(p => ({ ...p, [field]: v }))} />
              ) : (
                <input className="input" value={(form as any)[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">İlgi Duyduğu Enstrüman</label>
            <input className="input" placeholder="Piyano, Keman..." value={form.instrument_interest || ''} onChange={e => setForm(p => ({ ...p, instrument_interest: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Nereden Duydu</label>
            <select className="input" value={form.how_heard || ''} onChange={e => setForm(p => ({ ...p, how_heard: e.target.value }))}>
              <option value="">Belirtilmemiş</option>
              <option value="social_media">Sosyal Medya</option>
              <option value="friend">Arkadaş Tavsiyesi</option>
              <option value="web">Web Sitesi</option>
              <option value="walk_in">Sokaktan / Tabeladan</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">Notlar</label>
            <textarea className="input resize-none" rows={3} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {convertTarget && (
        <Modal isOpen onClose={() => setConvertTarget(null)} title="Öğrenciye Dönüştür" size="md"
          footer={<>
            <button onClick={() => setConvertTarget(null)} className="btn-outline">İptal</button>
            <button onClick={handleConvert} disabled={saving} className="btn-primary">
              {saving ? 'Dönüştürülüyor...' : 'Öğrenci Olarak Kaydet'}
            </button>
          </>}>
          <p className="text-sm text-primary-600">
            <span className="font-semibold">{convertTarget.first_name} {convertTarget.last_name}</span> adlı ön kaydı aktif öğrenciye dönüştürmek istediğinize emin misiniz?
          </p>
        </Modal>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Ön Kayıt Sil" message="Bu ön kaydı silmek istediğinize emin misiniz?"
        confirmLabel="Sil" danger />
    </div>
  )
}

// ─── Eski Öğrenci Özet Modalı ─────────────────────────────────────────────
function FormerStudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const [departures, setDepartures] = useState<DepartureRecord[]>([])
  const [lessons, setLessons]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.departures.getByStudent(student.id),
      window.api.lessons.getByStudent(student.id),
    ]).then(([deps, lsns]) => {
      setDepartures(deps as DepartureRecord[])
      setLessons((lsns as any[]).filter(l => l.lesson_date <= new Date().toISOString().split('T')[0]))
      setLoading(false)
    })
  }, [student.id])

  const dep = departures[0]

  return (
    <Modal isOpen onClose={onClose} title={`${student.first_name} ${student.last_name} — Özet`} size="lg"
      footer={<button onClick={onClose} className="btn-outline">Kapat</button>}>
      {loading ? (
        <p className="text-sm text-primary-400 text-center py-6">Yükleniyor...</p>
      ) : (
        <div className="space-y-5">
          {/* Ayrılış Bilgileri */}
          {dep ? (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-700">Ayrılış Bilgileri</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-primary-700">
                <div><span className="text-primary-400">Ayrılış Tarihi:</span> {formatDate(dep.departure_date)}</div>
                {dep.last_lesson_date && <div><span className="text-primary-400">Son Ders:</span> {formatDate(dep.last_lesson_date)}</div>}
                <div><span className="text-primary-400">Neden:</span> {DEPARTURE_REASON_LABELS[dep.reason_category] ?? dep.reason_category}</div>
                <div><span className="text-primary-400">Tekrar gelir mi?</span> {dep.would_return ? 'Evet' : 'Hayır'}</div>
                {dep.student_rating != null && <div><span className="text-primary-400">Öğrenci değerlendirmesi:</span> {dep.student_rating}/5</div>}
                {dep.school_rating != null && <div><span className="text-primary-400">Kurum değerlendirmesi:</span> {dep.school_rating}/5</div>}
                {dep.reason_detail && <div className="col-span-2"><span className="text-primary-400">Açıklama:</span> {dep.reason_detail}</div>}
                {dep.notes && <div className="col-span-2"><span className="text-primary-400">Not:</span> {dep.notes}</div>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-primary-400">Ayrılış kaydı bulunamadı.</p>
          )}

          {/* Ders Geçmişi */}
          <div>
            <h4 className="text-sm font-semibold text-primary-700 mb-2">
              Ders Geçmişi ({lessons.length} ders)
            </h4>
            {lessons.length === 0 ? (
              <p className="text-xs text-primary-400">Ders kaydı bulunamadı.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {lessons.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-xs bg-primary-50 rounded px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-primary-400 w-22 flex-shrink-0">{formatDate(l.lesson_date)}</span>
                      {l.start_time && <span className="text-primary-500">{l.start_time}</span>}
                      {l.instrument_name && <span className="font-medium text-primary-700">{l.instrument_name}</span>}
                      {l.teacher_name && <span className="text-primary-400">— {l.teacher_name}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.status === 'completed' ? 'bg-green-100 text-green-700' :
                      l.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      l.status === 'student_absent' ? 'bg-orange-100 text-orange-700' :
                      'bg-primary-100 text-primary-600'
                    }`}>
                      {l.status === 'completed' ? 'Tamamlandı' :
                       l.status === 'cancelled' ? 'İptal' :
                       l.status === 'student_absent' ? 'Öğrenci Gelmedi' :
                       l.status === 'teacher_absent' ? 'Öğretmen Gelmedi' : l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
