import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type {
  Teacher, TeacherSalaryConfig, MonthlyPayroll, TeacherAdvance,
  TeacherBonus, LeaveRequest, LeaveBalance, TeacherDocument,
  TeacherSurvey, TeacherPerformanceReport, Student, Instrument
} from '../types'
import {
  SALARY_TYPE_LABELS, LEAVE_TYPE_LABELS, DOC_TYPE_LABELS,
  PAYROLL_STATUS_LABELS, MONTH_NAMES
} from '../types'
import PayrollSlip from '../components/PayrollSlip'

// ─── helpers ──────────────────────────────────────────────────────────────────
const now = new Date()
const fmtMoney = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('tr-TR') : '—'
const calcSeniority = (hireDate?: string) => {
  if (!hireDate) return '—'
  const years = (Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  return Math.floor(years) + ' yıl'
}
const statusColor = (s: MonthlyPayroll['status']) =>
  s === 'paid' ? '#2e7d32' : s === 'approved' ? '#1565c0' : '#795548'

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
function TeacherDetailModal({
  teacher, onClose, onRefresh
}: {
  teacher: Teacher
  onClose: () => void
  onRefresh: () => void
}) {
  const [subTab, setSubTab] = useState<'basic' | 'ozluk' | 'payroll' | 'advance_bonus' | 'leave'>('basic')
  const [salaryConfig, setSalaryConfig] = useState<TeacherSalaryConfig | null>(null)
  const [payrolls, setPayrolls] = useState<MonthlyPayroll[]>([])
  const [advances, setAdvances] = useState<TeacherAdvance[]>([])
  const [bonuses, setBonuses] = useState<TeacherBonus[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [documents, setDocuments] = useState<TeacherDocument[]>([])
  const [form, setForm] = useState<Partial<Teacher>>({ ...teacher })
  const [cfgForm, setCfgForm] = useState<Partial<TeacherSalaryConfig>>({
    salary_type: 'fixed', base_salary: 0, per_lesson_rate: 0, percentage_rate: 0
  })
  const [advForm, setAdvForm] = useState({ amount: '', description: '' })
  const [bonForm, setBonForm] = useState({ amount: '', reason: '', bonus_type: 'manual' })
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual', start_date: '', end_date: '', days_count: 1, reason: ''
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([])
  const [teacherInstrumentIds, setTeacherInstrumentIds] = useState<number[]>([])
  const [selectedPayroll, setSelectedPayroll] = useState<MonthlyPayroll | null>(null)
  const slipRef = useRef<HTMLDivElement>(null)

  const printSlip = useReactToPrint({ content: () => slipRef.current })

  const load = useCallback(async () => {
    const [cfg, ps, advs, bons, lvs, docs, instruments, instrIds] = await Promise.all([
      window.api.salary_configs.getByTeacher(teacher.id),
      window.api.payrolls.getByTeacher(teacher.id),
      window.api.advances.getByTeacher(teacher.id),
      window.api.bonuses.getByTeacher(teacher.id),
      window.api.leaves.getByTeacher(teacher.id),
      window.api.teacher_documents.getByTeacher(teacher.id),
      window.api.instruments.getAll(),
      window.api.teachers.getInstruments(teacher.id)
    ])
    if (cfg) {
      setSalaryConfig(cfg)
      setCfgForm({ ...cfg })
    }
    setPayrolls(ps)
    setAdvances(advs)
    setBonuses(bons)
    setLeaves(lvs)
    setDocuments(docs)
    setAllInstruments(instruments)
    setTeacherInstrumentIds(instrIds)
    const bal = await window.api.leave_balances.getByTeacher(teacher.id, now.getFullYear())
    setLeaveBalance(bal)
  }, [teacher.id])

  useEffect(() => { load() }, [load])

  const saveBasic = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const cleanForm = {
        ...form,
        birth_date: form.birth_date || null,
        hire_date: form.hire_date || null,
        contract_start: (form as Record<string, unknown>).contract_start || null,
        contract_end: (form as Record<string, unknown>).contract_end || null,
      }
      const res = await window.api.teachers.update(teacher.id, cleanForm)
      if ((res as { error?: string })?.error) {
        setSaveMsg(`Hata: ${(res as { error?: string }).error}`)
        return
      }
      await window.api.salary_configs.upsert({ teacher_id: teacher.id, ...cfgForm })
      await window.api.teachers.setInstruments(teacher.id, teacherInstrumentIds)
      setSaveMsg('Kaydedildi ✓')
      setTimeout(() => setSaveMsg(null), 2500)
      onRefresh()
    } catch (e) {
      setSaveMsg(`Hata: ${(e as Error).message}`)
    } finally { setSaving(false) }
  }

  const uploadDoc = async () => {
    const fileInfo = await window.api.teacher_documents.upload(teacher.id)
    if (!fileInfo) return
    const docType = (document.getElementById('doc_type_sel') as HTMLSelectElement)?.value || 'other'
    const title = (document.getElementById('doc_title_inp') as HTMLInputElement)?.value || fileInfo.file_name
    await window.api.teacher_documents.create({
      teacher_id: teacher.id, doc_type: docType as TeacherDocument['doc_type'],
      title, file_path: fileInfo.file_path, file_name: fileInfo.file_name
    })
    load()
  }

  const deleteDoc = async (id: number) => {
    await window.api.teacher_documents.delete(id)
    load()
  }

  const createAdvance = async () => {
    if (!advForm.amount) return
    await window.api.advances.create({ teacher_id: teacher.id, amount: +advForm.amount, description: advForm.description || undefined })
    setAdvForm({ amount: '', description: '' })
    load()
  }

  const createBonus = async () => {
    if (!bonForm.amount) return
    await window.api.bonuses.create({
      teacher_id: teacher.id, amount: +bonForm.amount,
      reason: bonForm.reason || undefined,
      bonus_type: bonForm.bonus_type as TeacherBonus['bonus_type'],
      year: now.getFullYear(), month: now.getMonth() + 1
    })
    setBonForm({ amount: '', reason: '', bonus_type: 'manual' })
    load()
  }

  const createLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) return
    const d1 = new Date(leaveForm.start_date), d2 = new Date(leaveForm.end_date)
    const days = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (24*3600*1000)) + 1)
    await window.api.leaves.create({ teacher_id: teacher.id, ...leaveForm, days_count: days })
    setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', days_count: 1, reason: '' })
    load()
  }

  const subTabs = [
    { key: 'basic', label: 'Temel & Maaş' },
    { key: 'ozluk', label: 'Özlük' },
    { key: 'payroll', label: 'Bordro Geçmişi' },
    { key: 'advance_bonus', label: 'Avans & Prim' },
    { key: 'leave', label: 'İzin Takibi' }
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Modal Header */}
        <div style={{ background: '#1B3A6B', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{teacher.first_name} {teacher.last_name}</div>
            <div style={{ fontSize: '12px', color: '#9fc3f8' }}>{teacher.employment_type === 'full_time' ? 'Tam Zamanlı' : teacher.employment_type === 'part_time' ? 'Yarı Zamanlı' : 'Freelance'} • Kıdem: {calcSeniority(teacher.hire_date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        {/* Sub-tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0, overflowX: 'auto' }}>
          {subTabs.map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: subTab === t.key ? 'bold' : 'normal', color: subTab === t.key ? '#1B3A6B' : '#6b7280', borderBottom: subTab === t.key ? '3px solid #1B3A6B' : '3px solid transparent', whiteSpace: 'nowrap', fontSize: '13px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── TEMEL BİLGİLER & MAAŞ ── */}
          {subTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['first_name','last_name','phone','email','address','iban'] as (keyof Teacher)[]).map(field => (
                  <div key={field}>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      {field === 'first_name' ? 'Ad' : field === 'last_name' ? 'Soyad' : field === 'phone' ? 'Telefon' : field === 'email' ? 'E-posta' : field === 'address' ? 'Adres' : 'IBAN'}
                    </label>
                    <input value={(form[field] as string) || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Çalışma Türü</label>
                  <select value={form.employment_type || 'full_time'} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value as Teacher['employment_type'] }))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                    <option value="full_time">Tam Zamanlı</option>
                    <option value="part_time">Yarı Zamanlı</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Durum</label>
                  <select value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value as Teacher['status'] }))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                  </select>
                </div>
              </div>

              {/* Öğrettiği Enstrümanlar */}
              <div style={{ background: '#f0f4fa', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #1B3A6B' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#1B3A6B' }}>Öğrettiği Enstrümanlar</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {allInstruments.filter(i => i.is_active).map(i => {
                    const selected = teacherInstrumentIds.includes(i.id)
                    return (
                      <button key={i.id} type="button"
                        onClick={() => setTeacherInstrumentIds(prev =>
                          selected ? prev.filter(x => x !== i.id) : [...prev, i.id]
                        )}
                        style={{ padding: '5px 12px', borderRadius: '20px', border: `2px solid ${selected ? '#1B3A6B' : '#d1d5db'}`, background: selected ? '#1B3A6B' : '#fff', color: selected ? '#fff' : '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: selected ? 'bold' : 'normal' }}>
                        {i.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Maaş Konfigürasyonu */}
              <div style={{ background: '#f0f4fa', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #C9A84C' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#1B3A6B' }}>Maaş Yapılandırması</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {(['fixed','per_lesson','hybrid','percentage'] as TeacherSalaryConfig['salary_type'][]).map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', border: `2px solid ${cfgForm.salary_type === t ? '#1B3A6B' : '#d1d5db'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: cfgForm.salary_type === t ? '#e8f0fe' : '#fff' }}>
                      <input type="radio" name="salary_type" value={t} checked={cfgForm.salary_type === t} onChange={() => setCfgForm(p => ({ ...p, salary_type: t }))} />
                      {SALARY_TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(cfgForm.salary_type === 'fixed' || cfgForm.salary_type === 'hybrid') && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Sabit Taban (₺/ay)</label>
                      <input type="number" value={cfgForm.base_salary || 0} onChange={e => setCfgForm(p => ({ ...p, base_salary: +e.target.value }))}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  {(cfgForm.salary_type === 'per_lesson' || cfgForm.salary_type === 'hybrid') && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Ders Başına (₺)</label>
                      <input type="number" value={cfgForm.per_lesson_rate || 0} onChange={e => setCfgForm(p => ({ ...p, per_lesson_rate: +e.target.value }))}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  {cfgForm.salary_type === 'percentage' && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Yüzde (%)</label>
                      <input type="number" value={cfgForm.percentage_rate || 0} onChange={e => setCfgForm(p => ({ ...p, percentage_rate: +e.target.value }))}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-end' }}>
                {saveMsg && (
                  <span style={{ fontSize: '13px', color: saveMsg.startsWith('Hata') ? '#dc2626' : '#2e7d32', fontWeight: 'bold' }}>
                    {saveMsg}
                  </span>
                )}
                <button onClick={saveBasic} disabled={saving}
                  style={{ padding: '10px 24px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          )}

          {/* ── ÖZLÜK DOSYASI ── */}
          {subTab === 'ozluk' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {([
                  ['tc_kimlik_no', 'TC Kimlik No'],
                  ['sgk_no', 'SGK No'],
                  ['contract_type', 'Sözleşme Türü'],
                  ['contract_start', 'Sözleşme Başlangıç'],
                  ['contract_end', 'Sözleşme Bitiş']
                ] as [keyof Teacher, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{label}</label>
                    <input
                      type={field.includes('date') || field.includes('start') || field.includes('end') ? 'date' : 'text'}
                      value={(form[field] as string) || ''}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f4fa', borderRadius: '8px', padding: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>İşe Giriş</div>
                    <div style={{ fontWeight: 'bold', color: '#1B3A6B' }}>{fmtDate(teacher.hire_date)}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Kıdem</div>
                    <div style={{ fontWeight: 'bold', color: '#C9A84C' }}>{calcSeniority(teacher.hire_date)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-end' }}>
                {saveMsg && (
                  <span style={{ fontSize: '13px', color: saveMsg.startsWith('Hata') ? '#dc2626' : '#2e7d32', fontWeight: 'bold' }}>
                    {saveMsg}
                  </span>
                )}
                <button onClick={saveBasic} disabled={saving}
                  style={{ padding: '10px 24px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              {/* Belge Arşivi */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 'bold', color: '#1B3A6B' }}>Belge Arşivi</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select id="doc_type_sel" style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}>
                      {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input id="doc_title_inp" placeholder="Belge başlığı" style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', width: '140px' }} />
                    <button onClick={uploadDoc}
                      style={{ padding: '6px 14px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                      + Ekle
                    </button>
                  </div>
                </div>
                {documents.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '13px' }}>Belge yok</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Tür</th>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Başlık</th>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Tarih</th>
                        <th style={{ padding: '8px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map(doc => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px' }}><span style={{ background: '#e8f0fe', color: '#1B3A6B', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{DOC_TYPE_LABELS[doc.doc_type]}</span></td>
                          <td style={{ padding: '8px' }}>{doc.title}</td>
                          <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDate(doc.upload_date)}</td>
                          <td style={{ padding: '8px' }}>
                            <button onClick={() => window.api.teacher_documents.open(doc.file_path)} style={{ marginRight: '6px', padding: '3px 10px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Aç</button>
                            <button onClick={() => deleteDoc(doc.id)} style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Sil</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── BORDRO GEÇMİŞİ ── */}
          {subTab === 'payroll' && (
            <div>
              {payrolls.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px', fontSize: '14px' }}>Bordro kaydı yok</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Dönem</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Ders</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Brüt</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Net</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Durum</th>
                      <th style={{ padding: '10px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: selectedPayroll?.id === p.id ? '#f0f4fa' : '#fff' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{MONTH_NAMES[p.month - 1]} {p.year}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>{p.lesson_count}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{fmtMoney(p.gross_amount)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#1B3A6B' }}>{fmtMoney(p.net_amount)}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: p.status === 'paid' ? '#dcfce7' : p.status === 'approved' ? '#dbeafe' : '#fef3c7', color: statusColor(p.status) }}>
                            {PAYROLL_STATUS_LABELS[p.status]}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <button onClick={() => { setSelectedPayroll(p); setTimeout(() => printSlip(), 100) }}
                            style={{ padding: '4px 10px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                            Yazdır
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── AVANS & PRİM ── */}
          {subTab === 'advance_bonus' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Avanslar */}
              <div>
                <div style={{ fontWeight: 'bold', color: '#1B3A6B', marginBottom: '12px' }}>Avanslar</div>
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Yeni Avans</div>
                  <input type="number" placeholder="Tutar (₺)" value={advForm.amount} onChange={e => setAdvForm(p => ({ ...p, amount: e.target.value }))}
                    style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
                  <input placeholder="Açıklama (opsiyonel)" value={advForm.description} onChange={e => setAdvForm(p => ({ ...p, description: e.target.value }))}
                    style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
                  <button onClick={createAdvance} style={{ width: '100%', padding: '8px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Ekle</button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {advances.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <div>
                        <div>{fmtDate(a.advance_date)}</div>
                        {a.description && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{a.description}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold' }}>{fmtMoney(a.amount)}</div>
                        <span style={{ fontSize: '11px', color: a.status === 'pending' ? '#d97706' : a.status === 'deducted' ? '#2e7d32' : '#6b7280' }}>
                          {a.status === 'pending' ? 'Bekliyor' : a.status === 'deducted' ? 'Kesildi' : 'İptal'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primler */}
              <div>
                <div style={{ fontWeight: 'bold', color: '#1B3A6B', marginBottom: '12px' }}>Primler</div>
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Yeni Prim</div>
                  <select value={bonForm.bonus_type} onChange={e => setBonForm(p => ({ ...p, bonus_type: e.target.value }))}
                    style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '6px' }}>
                    <option value="manual">Manuel Prim</option>
                    <option value="performance">Performans Primi</option>
                  </select>
                  <input type="number" placeholder="Tutar (₺)" value={bonForm.amount} onChange={e => setBonForm(p => ({ ...p, amount: e.target.value }))}
                    style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
                  <input placeholder="Sebep" value={bonForm.reason} onChange={e => setBonForm(p => ({ ...p, reason: e.target.value }))}
                    style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
                  <button onClick={createBonus} style={{ width: '100%', padding: '8px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Ekle</button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {bonuses.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <div>
                        <div>{b.reason || (b.bonus_type === 'performance' ? 'Performans Primi' : 'Manuel Prim')}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{b.year}/{b.month}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>+{fmtMoney(b.amount)}</div>
                        {!b.payroll_id && <button onClick={async () => { await window.api.bonuses.delete(b.id); load() }}
                          style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── İZİN TAKİBİ ── */}
          {subTab === 'leave' && (
            <div>
              {/* Bakiye */}
              {leaveBalance && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  {[
                    { label: 'Toplam', value: leaveBalance.total_days, color: '#1B3A6B' },
                    { label: 'Kullanılan', value: leaveBalance.used_days, color: '#c62828' },
                    { label: 'Kalan', value: leaveBalance.total_days - leaveBalance.used_days, color: '#2e7d32' }
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, background: '#f9fafb', borderRadius: '8px', padding: '12px', textAlign: 'center', border: `2px solid ${item.color}20` }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.label} Gün</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Yeni izin formu */}
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#1B3A6B' }}>Yeni İzin Talebi</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280' }}>İzin Türü</label>
                    <select value={leaveForm.leave_type} onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
                      style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginTop: '4px' }}>
                      {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280' }}>Sebep</label>
                    <input value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                      style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280' }}>Başlangıç</label>
                    <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(p => ({ ...p, start_date: e.target.value }))}
                      style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280' }}>Bitiş</label>
                    <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(p => ({ ...p, end_date: e.target.value }))}
                      style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button onClick={createLeave} style={{ marginTop: '10px', padding: '8px 20px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Talep Oluştur
                </button>
              </div>

              {/* İzin listesi */}
              {leaves.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>İzin kaydı yok</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Tür</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Tarih Aralığı</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Gün</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Durum</th>
                  </tr></thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px' }}>{LEAVE_TYPE_LABELS[l.leave_type]}</td>
                        <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDate(l.start_date)} — {fmtDate(l.end_date)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{l.days_count}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: l.status === 'approved' ? '#dcfce7' : l.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: l.status === 'approved' ? '#2e7d32' : l.status === 'rejected' ? '#dc2626' : '#92400e' }}>
                            {l.status === 'approved' ? 'Onaylı' : l.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden print area */}
      {selectedPayroll && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PayrollSlip ref={slipRef} payroll={selectedPayroll} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Staff Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Staff() {
  const [tab, setTab] = useState<'personel' | 'bordro' | 'avans_prim' | 'izinler' | 'performans'>('personel')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [empFilter, setEmpFilter] = useState<string>('all')

  // Bordro state
  const [payrollYear, setPayrollYear] = useState(now.getFullYear())
  const [payrollMonth, setPayrollMonth] = useState(now.getMonth() + 1)
  const [payrolls, setPayrolls] = useState<MonthlyPayroll[]>([])
  const [calculating, setCalculating] = useState<number | null>(null)
  const slipRef = useRef<HTMLDivElement>(null)
  const [printPayroll, setPrintPayroll] = useState<MonthlyPayroll | null>(null)
  const printSlip = useReactToPrint({ content: () => slipRef.current })

  // Avans & Prim state
  const [apYear, setApYear] = useState(now.getFullYear())
  const [apMonth, setApMonth] = useState(now.getMonth() + 1)
  const [allAdvances, setAllAdvances] = useState<TeacherAdvance[]>([])
  const [allBonuses, setAllBonuses] = useState<TeacherBonus[]>([])
  const [advForm, setAdvForm] = useState({ teacher_id: '', amount: '', description: '' })
  const [bonForm, setBonForm] = useState({ teacher_id: '', amount: '', reason: '', bonus_type: 'manual' })

  // İzin state
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([])
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all')
  const [newLeaveForm, setNewLeaveForm] = useState({ teacher_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })

  // Performans state
  const [perfYear, setPerfYear] = useState(now.getFullYear())
  const [perfMonth, setPerfMonth] = useState(now.getMonth() + 1)
  const [perfData, setPerfData] = useState<TeacherPerformanceReport[]>([])
  const [surveyForm, setSurveyForm] = useState({ teacher_id: '', student_id: '', score: '5', feedback: '' })

  const loadTeachers = useCallback(async () => {
    const ts = await window.api.teachers.getAll()
    setTeachers(ts)
  }, [])

  const loadStudents = useCallback(async () => {
    const ss = await window.api.students.getAll()
    setStudents(ss)
  }, [])

  const loadPayrolls = useCallback(async () => {
    const ps = await window.api.payrolls.getByMonth(payrollYear, payrollMonth)
    setPayrolls(ps)
  }, [payrollYear, payrollMonth])

  const loadApData = useCallback(async () => {
    const [advs, bons] = await Promise.all([
      window.api.advances.getAll(apYear, apMonth),
      window.api.bonuses.getAll(apYear, apMonth)
    ])
    setAllAdvances(advs)
    setAllBonuses(bons)
  }, [apYear, apMonth])

  const loadLeaves = useCallback(async () => {
    const filter: Record<string, unknown> = {}
    if (leaveStatusFilter !== 'all') filter.status = leaveStatusFilter
    const ls = await window.api.leaves.getAll(filter)
    setAllLeaves(ls)
  }, [leaveStatusFilter])

  const loadPerformance = useCallback(async () => {
    const data = await window.api.payrolls.getPerformanceReport(perfYear, perfMonth)
    setPerfData(data)
  }, [perfYear, perfMonth])

  useEffect(() => { loadTeachers(); loadStudents() }, [loadTeachers, loadStudents])
  useEffect(() => { if (tab === 'bordro') loadPayrolls() }, [tab, loadPayrolls])
  useEffect(() => { if (tab === 'avans_prim') loadApData() }, [tab, loadApData])
  useEffect(() => { if (tab === 'izinler') loadLeaves() }, [tab, loadLeaves])
  useEffect(() => { if (tab === 'performans') loadPerformance() }, [tab, loadPerformance])

  const calculatePayroll = async (teacherId: number) => {
    setCalculating(teacherId)
    try {
      await window.api.payrolls.calculate(teacherId, payrollYear, payrollMonth)
      await loadPayrolls()
    } finally { setCalculating(null) }
  }

  const calculateAll = async () => {
    for (const t of teachers.filter(t => t.status === 'active')) {
      setCalculating(t.id)
      await window.api.payrolls.calculate(t.id, payrollYear, payrollMonth)
    }
    setCalculating(null)
    loadPayrolls()
  }

  const advanceStatus = async (id: number, action: 'approve' | 'cancel') => {
    if (action === 'cancel') await window.api.advances.cancel(id)
    loadApData()
  }

  const handleApproveLeave = async (id: number) => {
    await window.api.leaves.approve(id, 'Yönetici')
    loadLeaves()
  }

  const handleRejectLeave = async (id: number) => {
    await window.api.leaves.reject(id)
    loadLeaves()
  }

  const createLeave = async () => {
    if (!newLeaveForm.teacher_id || !newLeaveForm.start_date || !newLeaveForm.end_date) return
    const d1 = new Date(newLeaveForm.start_date), d2 = new Date(newLeaveForm.end_date)
    const days = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (24 * 3600 * 1000)) + 1)
    await window.api.leaves.create({ teacher_id: +newLeaveForm.teacher_id, leave_type: newLeaveForm.leave_type as LeaveRequest['leave_type'], start_date: newLeaveForm.start_date, end_date: newLeaveForm.end_date, days_count: days, reason: newLeaveForm.reason || undefined })
    setNewLeaveForm({ teacher_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })
    loadLeaves()
  }

  const createSurvey = async () => {
    if (!surveyForm.teacher_id || !surveyForm.score) return
    await window.api.surveys.create({ teacher_id: +surveyForm.teacher_id, student_id: surveyForm.student_id ? +surveyForm.student_id : undefined, score: +surveyForm.score, feedback: surveyForm.feedback || undefined })
    setSurveyForm({ teacher_id: '', student_id: '', score: '5', feedback: '' })
    loadPerformance()
  }

  const filteredTeachers = empFilter === 'all' ? teachers : teachers.filter(t => t.employment_type === empFilter)
  const sortedPerf = [...perfData].sort((a, b) => {
    const scoreA = (a.lesson_count * 0.4) + ((100 - a.cancel_rate) * 0.3) + (a.avg_satisfaction * 20 * 0.3)
    const scoreB = (b.lesson_count * 0.4) + ((100 - b.cancel_rate) * 0.3) + (b.avg_satisfaction * 20 * 0.3)
    return scoreB - scoreA
  })

  const btnStyle = (active: boolean) => ({
    padding: '8px 16px', border: 'none', background: active ? '#1B3A6B' : '#f3f4f6',
    color: active ? '#fff' : '#374151', borderRadius: '8px', cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal', fontSize: '14px'
  })

  const inputStyle = { padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', background: '#f8fafc' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1B3A6B', margin: 0 }}>Personel Yönetimi</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>HR, maaş bordrosu, izin ve performans takibi</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'personel', label: '👥 Personel' },
          { key: 'bordro', label: '💰 Bordro' },
          { key: 'avans_prim', label: '💼 Avans & Prim' },
          { key: 'izinler', label: '📅 İzinler' },
          { key: 'performans', label: '📊 Performans' }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} style={btnStyle(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════ PERSONEL ══ */}
      {tab === 'personel' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['all', 'Tümü'], ['full_time', 'Tam Zamanlı'], ['part_time', 'Yarı Zamanlı'], ['freelance', 'Freelance']].map(([v, l]) => (
              <button key={v} onClick={() => setEmpFilter(v)} style={{ padding: '6px 14px', border: `1px solid ${empFilter === v ? '#1B3A6B' : '#d1d5db'}`, borderRadius: '20px', background: empFilter === v ? '#1B3A6B' : '#fff', color: empFilter === v ? '#fff' : '#374151', cursor: 'pointer', fontSize: '13px' }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredTeachers.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1B3A6B' }}>{t.first_name} {t.last_name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {t.employment_type === 'full_time' ? 'Tam Zamanlı' : t.employment_type === 'part_time' ? 'Yarı Zamanlı' : 'Freelance'}
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: t.status === 'active' ? '#dcfce7' : '#fee2e2', color: t.status === 'active' ? '#2e7d32' : '#dc2626' }}>
                    {t.status === 'active' ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                  {t.phone && <div>📞 {t.phone}</div>}
                  <div>📅 Kıdem: {calcSeniority(t.hire_date)}</div>
                  <div>💰 {(() => {
                    const c = t as unknown as Record<string, unknown>
                    if (c.cfg_salary_type === 'percentage') return `Yüzde %${c.cfg_percentage_rate} / ders`
                    if (c.cfg_salary_type === 'per_lesson') return `${c.cfg_per_lesson_rate} ₺ / ders`
                    if (c.cfg_salary_type === 'hybrid') return `${c.cfg_base_salary} ₺ taban + ${c.cfg_per_lesson_rate} ₺/ders`
                    if (c.cfg_salary_type === 'fixed') return `${c.cfg_base_salary} ₺ / ay`
                    return SALARY_TYPE_LABELS[t.salary_type as TeacherSalaryConfig['salary_type']] || t.salary_type
                  })()}</div>
                  {t.active_enrollments != null && <div>👨‍🎓 {t.active_enrollments} Aktif Öğrenci</div>}
                </div>
                <button onClick={() => setSelectedTeacher(t)}
                  style={{ width: '100%', padding: '8px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  Detay & Düzenle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ BORDRO ══ */}
      {tab === 'bordro' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={payrollMonth} onChange={e => setPayrollMonth(+e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={payrollYear} onChange={e => setPayrollYear(+e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadPayrolls} style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Yenile</button>
            <button onClick={calculateAll} style={{ padding: '8px 16px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>⚡ Tümünü Hesapla</button>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#1B3A6B', color: '#fff' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Öğretmen</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Ders</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Taban</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Brüt</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Kesinti</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Net</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Durum</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {teachers.filter(t => t.status === 'active').map(t => {
                  const p = payrolls.find(p => p.teacher_id === t.id)
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{t.first_name} {t.last_name}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>{p?.lesson_count ?? '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{p ? fmtMoney(p.base_amount) : '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{p ? fmtMoney(p.gross_amount) : '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#c62828' }}>{p && p.advance_deduction > 0 ? `-${fmtMoney(p.advance_deduction)}` : '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#1B3A6B' }}>{p ? fmtMoney(p.net_amount) : '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {p ? (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', background: p.status === 'paid' ? '#dcfce7' : p.status === 'approved' ? '#dbeafe' : '#fef3c7', color: statusColor(p.status) }}>
                            {PAYROLL_STATUS_LABELS[p.status]}
                          </span>
                        ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>Hesaplanmadı</span>}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => calculatePayroll(t.id)} disabled={calculating === t.id}
                            style={{ padding: '4px 10px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                            {calculating === t.id ? '...' : 'Hesapla'}
                          </button>
                          {p && p.status === 'draft' && (
                            <button onClick={async () => { await window.api.payrolls.update(p.id, { status: 'approved' }); loadPayrolls() }}
                              style={{ padding: '4px 10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Onayla</button>
                          )}
                          {p && p.status === 'approved' && (
                            <button onClick={async () => { await window.api.payrolls.markPaid(p.id, {}); loadPayrolls() }}
                              style={{ padding: '4px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Ödendi</button>
                          )}
                          {p && (
                            <button onClick={() => { setPrintPayroll(p); setTimeout(() => printSlip(), 100) }}
                              style={{ padding: '4px 10px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🖨</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ AVANS & PRİM ══ */}
      {tab === 'avans_prim' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <select value={apMonth} onChange={e => setApMonth(+e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={apYear} onChange={e => setApYear(+e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Avans Yönetimi */}
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1B3A6B', marginBottom: '12px' }}>Avanslar</div>
              <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#374151' }}>Yeni Avans</div>
                <select value={advForm.teacher_id} onChange={e => setAdvForm(p => ({ ...p, teacher_id: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '8px' }}>
                  <option value="">Öğretmen Seç</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
                <input type="number" placeholder="Tutar (₺)" value={advForm.amount} onChange={e => setAdvForm(p => ({ ...p, amount: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '8px' }} />
                <input placeholder="Açıklama" value={advForm.description} onChange={e => setAdvForm(p => ({ ...p, description: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '10px' }} />
                <button onClick={async () => {
                  if (!advForm.teacher_id || !advForm.amount) return
                  await window.api.advances.create({ teacher_id: +advForm.teacher_id, amount: +advForm.amount, description: advForm.description || undefined })
                  setAdvForm({ teacher_id: '', amount: '', description: '' })
                  loadApData()
                }} style={{ width: '100%', padding: '9px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Avans Ekle
                </button>
              </div>
              <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                {allAdvances.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Bu dönem avans yok</div>
                ) : allAdvances.map(a => (
                  <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{a.teacher_name}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{fmtDate(a.advance_date)}{a.description && ` — ${a.description}`}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: '#c62828' }}>{fmtMoney(a.amount)}</div>
                      <span style={{ fontSize: '11px', color: a.status === 'pending' ? '#d97706' : '#2e7d32' }}>
                        {a.status === 'pending' ? 'Bekliyor' : a.status === 'deducted' ? 'Kesildi' : 'İptal'}
                      </span>
                      {a.status === 'pending' && (
                        <button onClick={() => advanceStatus(a.id, 'cancel')} style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>İptal et</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prim Yönetimi */}
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1B3A6B', marginBottom: '12px' }}>Primler</div>
              <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#374151' }}>Yeni Prim</div>
                <select value={bonForm.teacher_id} onChange={e => setBonForm(p => ({ ...p, teacher_id: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '8px' }}>
                  <option value="">Öğretmen Seç</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
                <select value={bonForm.bonus_type} onChange={e => setBonForm(p => ({ ...p, bonus_type: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '8px' }}>
                  <option value="manual">Manuel Prim</option>
                  <option value="performance">Performans Primi</option>
                </select>
                <input type="number" placeholder="Tutar (₺)" value={bonForm.amount} onChange={e => setBonForm(p => ({ ...p, amount: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '8px' }} />
                <input placeholder="Sebep / Açıklama" value={bonForm.reason} onChange={e => setBonForm(p => ({ ...p, reason: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: '10px' }} />
                <button onClick={async () => {
                  if (!bonForm.teacher_id || !bonForm.amount) return
                  await window.api.bonuses.create({ teacher_id: +bonForm.teacher_id, amount: +bonForm.amount, reason: bonForm.reason || undefined, bonus_type: bonForm.bonus_type as TeacherBonus['bonus_type'], year: apYear, month: apMonth })
                  setBonForm({ teacher_id: '', amount: '', reason: '', bonus_type: 'manual' })
                  loadApData()
                }} style={{ width: '100%', padding: '9px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Prim Ekle
                </button>
              </div>
              <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                {allBonuses.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Bu dönem prim yok</div>
                ) : allBonuses.map(b => (
                  <div key={b.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{b.teacher_name}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{b.reason || (b.bonus_type === 'performance' ? 'Performans Primi' : 'Manuel')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>+{fmtMoney(b.amount)}</div>
                      {!b.payroll_id && (
                        <button onClick={async () => { await window.api.bonuses.delete(b.id); loadApData() }}
                          style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ İZİNLER ══ */}
      {tab === 'izinler' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px' }}>
          {/* Yeni İzin Formu */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', alignSelf: 'start' }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1B3A6B', marginBottom: '14px' }}>Yeni İzin Talebi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Öğretmen</label>
                <select value={newLeaveForm.teacher_id} onChange={e => setNewLeaveForm(p => ({ ...p, teacher_id: e.target.value }))} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="">Seçin</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>İzin Türü</label>
                <select value={newLeaveForm.leave_type} onChange={e => setNewLeaveForm(p => ({ ...p, leave_type: e.target.value }))} style={{ ...inputStyle, marginTop: '4px' }}>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Başlangıç</label>
                <input type="date" value={newLeaveForm.start_date} onChange={e => setNewLeaveForm(p => ({ ...p, start_date: e.target.value }))} style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Bitiş</label>
                <input type="date" value={newLeaveForm.end_date} onChange={e => setNewLeaveForm(p => ({ ...p, end_date: e.target.value }))} style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Sebep</label>
                <input value={newLeaveForm.reason} onChange={e => setNewLeaveForm(p => ({ ...p, reason: e.target.value }))} style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
              <button onClick={createLeave} style={{ padding: '10px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '4px' }}>
                Oluştur
              </button>
            </div>
          </div>

          {/* İzin Listesi */}
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[['all', 'Tümü'], ['pending', 'Bekleyen'], ['approved', 'Onaylı'], ['rejected', 'Reddedilen']].map(([v, l]) => (
                <button key={v} onClick={() => { setLeaveStatusFilter(v); loadLeaves() }}
                  style={{ padding: '6px 14px', border: `1px solid ${leaveStatusFilter === v ? '#1B3A6B' : '#d1d5db'}`, borderRadius: '20px', background: leaveStatusFilter === v ? '#1B3A6B' : '#fff', color: leaveStatusFilter === v ? '#fff' : '#374151', cursor: 'pointer', fontSize: '13px' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {allLeaves.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>İzin talebi yok</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Öğretmen</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Tür</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Tarih</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Gün</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Durum</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>İşlem</th>
                  </tr></thead>
                  <tbody>
                    {allLeaves.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 16px', fontWeight: '600' }}>{l.teacher_name}</td>
                        <td style={{ padding: '10px' }}>{LEAVE_TYPE_LABELS[l.leave_type]}</td>
                        <td style={{ padding: '10px', color: '#6b7280', fontSize: '12px' }}>{fmtDate(l.start_date)} — {fmtDate(l.end_date)}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{l.days_count}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: l.status === 'approved' ? '#dcfce7' : l.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: l.status === 'approved' ? '#2e7d32' : l.status === 'rejected' ? '#dc2626' : '#92400e' }}>
                            {l.status === 'approved' ? 'Onaylı' : l.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {l.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => handleApproveLeave(l.id)} style={{ padding: '4px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Onayla</button>
                              <button onClick={() => handleRejectLeave(l.id)} style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Reddet</button>
                            </div>
                          )}
                          {l.status !== 'pending' && l.approved_by && (
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>{l.approved_by}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ PERFORMANS ══ */}
      {tab === 'performans' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={perfMonth} onChange={e => { setPerfMonth(+e.target.value) }} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={perfYear} onChange={e => setPerfYear(+e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}>
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadPerformance} style={{ padding: '8px 16px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Güncelle</button>
          </div>

          {/* Anket Formu */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', color: '#1B3A6B', marginBottom: '12px' }}>Memnuniyet Anketi Ekle</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Öğretmen</label>
                <select value={surveyForm.teacher_id} onChange={e => setSurveyForm(p => ({ ...p, teacher_id: e.target.value }))} style={{ display: 'block', marginTop: '4px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                  <option value="">Seçin</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Öğrenci (opsiyonel)</label>
                <select value={surveyForm.student_id} onChange={e => setSurveyForm(p => ({ ...p, student_id: e.target.value }))} style={{ display: 'block', marginTop: '4px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                  <option value="">Anonim</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Puan (1–5)</label>
                <select value={surveyForm.score} onChange={e => setSurveyForm(p => ({ ...p, score: e.target.value }))} style={{ display: 'block', marginTop: '4px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5-n)} ({n})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280' }}>Yorum</label>
                <input value={surveyForm.feedback} onChange={e => setSurveyForm(p => ({ ...p, feedback: e.target.value }))} placeholder="Opsiyonel" style={{ display: 'block', marginTop: '4px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '200px' }} />
              </div>
              <button onClick={createSurvey} style={{ padding: '8px 20px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Kaydet</button>
            </div>
          </div>

          {/* BarChart */}
          {perfData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', color: '#1B3A6B', marginBottom: '12px' }}>Aylık Ders Sayıları</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={perfData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="teacher_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="lesson_count" fill="#1B3A6B" name="Ders Sayısı" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sıralama Tablosu */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1B3A6B', color: '#fff' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '40px' }}>#</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Öğretmen</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Ders</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>İptal %</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Devamsız %</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Memnuniyet</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Aktif Öğr.</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Trend</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Net Maaş</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerf.map((p, i) => (
                  <tr key={p.teacher_id} style={{ borderBottom: '1px solid #f3f4f6', background: i === 0 ? '#f0fff4' : i === sortedPerf.length - 1 && sortedPerf.length > 1 ? '#fff5f5' : '#fff' }}>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: i === 0 ? '#2e7d32' : i === sortedPerf.length - 1 ? '#c62828' : '#374151' }}>{i + 1}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                      {p.teacher_name}
                      {i === 0 && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#2e7d32' }}>🏆 En İyi</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{p.lesson_count}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: p.cancel_rate > 10 ? '#c62828' : '#374151' }}>{p.cancel_rate}%</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: p.student_absent_rate > 20 ? '#c62828' : '#374151' }}>{p.student_absent_rate}%</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {p.avg_satisfaction > 0 ? (
                        <span style={{ color: p.avg_satisfaction >= 4 ? '#2e7d32' : p.avg_satisfaction >= 3 ? '#d97706' : '#c62828' }}>
                          {'★'.repeat(Math.round(p.avg_satisfaction))} {p.avg_satisfaction.toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{p.active_students}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: p.trend > 0 ? '#2e7d32' : p.trend < 0 ? '#c62828' : '#6b7280' }}>
                      {p.trend > 0 ? `↑ +${p.trend}` : p.trend < 0 ? `↓ ${p.trend}` : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#1B3A6B' }}>
                      {p.net_salary > 0 ? fmtMoney(p.net_salary) : '—'}
                    </td>
                  </tr>
                ))}
                {perfData.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Veri yok — "Güncelle" butonuna tıklayın</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teacher Detail Modal */}
      {selectedTeacher && (
        <TeacherDetailModal
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
          onRefresh={loadTeachers}
        />
      )}

      {/* Hidden print area for Bordro tab */}
      {printPayroll && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PayrollSlip ref={slipRef} payroll={printPayroll} />
        </div>
      )}
    </div>
  )
}
