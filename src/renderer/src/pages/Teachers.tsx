import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Modal from '@components/ui/Modal'
import EmptyState from '@components/ui/EmptyState'
import ConfirmDialog from '@components/ui/ConfirmDialog'
import { formatCurrency, formatDate } from '@utils/formatters'
import PhoneInput from '@components/PhoneInput'
import type { Teacher, Instrument } from '../types'

const TEACHER_COLORS = [
  '#7C3AED','#0369A1','#047857','#B45309','#BE123C',
  '#0F766E','#6D28D9','#0E7490','#15803D','#C2410C',
  '#4338CA','#9D174D'
]

const defaultForm: Partial<Teacher> = {
  first_name: '', last_name: '', phone: '', email: '',
  specialization: '', birth_date: '',
  hire_date: new Date().toISOString().split('T')[0],
  employment_type: 'full_time',
  salary_type: 'fixed',
  salary_amount: 0,
  color_code: '#7C3AED',
  iban: '', status: 'active', notes: ''
}

const employmentLabels: Record<Teacher['employment_type'], string> = {
  full_time: 'Tam Zamanlı',
  part_time: 'Yarı Zamanlı',
  freelance: 'Serbest'
}

const salaryTypeLabels: Record<Teacher['salary_type'], string> = {
  fixed: 'Sabit Maaş',
  per_lesson: 'Ders Başı'
}

export default function Teachers(): JSX.Element {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Teacher>>(defaultForm)
  const [formInstruments, setFormInstruments] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'hire_date' | 'salary'>('name')

  const load = async () => {
    const [data, instr] = await Promise.all([
      window.api.teachers.getAll(),
      window.api.instruments.getAll()
    ])
    setTeachers(data)
    setInstruments(instr)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm(defaultForm)
    setFormInstruments([])
    setEditingTeacher(null)
    setIsModalOpen(true)
  }
  const openEdit = async (t: Teacher) => {
    setEditingTeacher(t)
    setIsModalOpen(true)
    const [ids, cfg] = await Promise.all([
      window.api.teachers.getInstruments(t.id),
      window.api.salary_configs.getByTeacher(t.id)
    ])
    setFormInstruments(ids)
    if (cfg && (cfg as any).salary_type === 'percentage') {
      setForm({ ...t, salary_type: 'percentage' as any, salary_amount: (cfg as any).percentage_rate ?? 0 })
    } else if (cfg && (cfg as any).salary_type === 'per_lesson') {
      setForm({ ...t, salary_type: 'per_lesson', salary_amount: (cfg as any).per_lesson_rate ?? t.salary_amount })
    } else {
      setForm(t)
    }
  }

  const handleSave = async () => {
    // 'percentage' form tipi DB'de 'per_lesson' olarak saklanır
    const dbSalaryType = (form.salary_type as string) === 'percentage' ? 'per_lesson' : form.salary_type
    const cleanForm = {
      ...form,
      salary_type: dbSalaryType,
      birth_date: form.birth_date || null,
      hire_date: form.hire_date || null,
    }
    let result: { error?: string } | unknown
    if (editingTeacher) {
      result = await window.api.teachers.update(editingTeacher.id, cleanForm)
    } else {
      result = await window.api.teachers.create(cleanForm)
    }
    if ((result as { error?: string })?.error) {
      alert(`Kayıt hatası: ${(result as { error?: string }).error}`)
      return
    }
    const savedTeacher = result as Teacher
    if (savedTeacher?.id) {
      // Enstrüman bağlantılarını kaydet
      await window.api.teachers.setInstruments(savedTeacher.id, formInstruments)
      // Maaş konfigürasyonunu salary_configs tablosuna upsert et
      const isPercentage = (form.salary_type as string) === 'percentage'
      await window.api.salary_configs.upsert({
        teacher_id: savedTeacher.id,
        salary_type: isPercentage ? 'percentage' : 'per_lesson',
        per_lesson_rate: isPercentage ? 0 : (form.salary_amount ?? 0),
        percentage_rate: isPercentage ? (form.salary_amount ?? 0) : 0,
        base_salary: 0,
      } as any)
    }
    setIsModalOpen(false)
    load()
  }

  const handleDelete = async () => {
    if (deleteId) {
      const result = await window.api.teachers.delete(deleteId)
      if ((result as { error?: string })?.error) {
        alert(`Silme hatası: ${(result as { error?: string }).error}`)
        setDeleteId(null)
        return
      }
    }
    setDeleteId(null)
    load()
  }

  const displayed = useMemo(() => {
    let list = [...teachers]
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
        t.specialization?.toLowerCase().includes(q) ||
        t.phone?.includes(q)
      )
    }
    if (sortBy === 'name') list.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'tr'))
    else if (sortBy === 'hire_date') list.sort((a, b) => b.hire_date.localeCompare(a.hire_date))
    else if (sortBy === 'salary') list.sort((a, b) => b.salary_amount - a.salary_amount)
    return list
  }, [teachers, search, statusFilter, sortBy])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="input pl-9" placeholder="Ad, branş, telefon..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-primary-100">
          {(['all', 'active', 'passive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'text-primary-400 hover:bg-primary-50'}`}>
              {s === 'all' ? `Tümü (${teachers.length})` : s === 'active' ? `Aktif (${teachers.filter(t => t.status === 'active').length})` : `Pasif (${teachers.filter(t => t.status === 'passive').length})`}
            </button>
          ))}
        </div>
        <select className="input text-xs py-1.5 min-w-36" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="name">Ada Göre Sırala</option>
          <option value="hire_date">İşe Giriş Tarihine Göre</option>
          <option value="salary">Ücrete Göre</option>
        </select>
        <button onClick={openAdd} className="btn-primary ml-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Öğretmen
        </button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          title="Öğretmen bulunamadı"
          description={search || statusFilter !== 'all' ? 'Arama sonucu bulunamadı.' : 'Henüz öğretmen eklenmemiş.'}
          action={<button onClick={openAdd} className="btn-primary">Öğretmen Ekle</button>}
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover"
              style={{ borderLeft: `3px solid ${t.color_code || '#7C3AED'}` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (t.color_code || '#7C3AED') + '22' }}
                >
                  <span className="font-bold text-lg" style={{ color: t.color_code || '#7C3AED' }}>
                    {t.first_name[0]}{t.last_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary">{t.first_name} {t.last_name}</p>
                  <p className="text-sm text-primary-400 truncate">{t.specialization || 'Branş belirtilmemiş'}</p>
                </div>
                <span className={t.status === 'active' ? 'badge-green' : 'badge-gray'}>
                  {t.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                {t.phone && (
                  <p className="text-sm text-primary-500 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {t.phone}
                  </p>
                )}
                <p className="text-sm text-primary-500 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {employmentLabels[t.employment_type]}
                </p>
                <p className="text-sm text-primary-500 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {(() => {
                    const cfg = t as unknown as Record<string, unknown>
                    if (cfg.cfg_salary_type === 'percentage') return `%${cfg.cfg_percentage_rate} / ders`
                    if (cfg.cfg_salary_type === 'per_lesson') return `${formatCurrency(cfg.cfg_per_lesson_rate as number)} / ders`
                    if (cfg.cfg_salary_type === 'hybrid') return `${formatCurrency(cfg.cfg_base_salary as number)} taban + ${formatCurrency(cfg.cfg_per_lesson_rate as number)} / ders`
                    if (cfg.cfg_salary_type === 'fixed') return `${formatCurrency(cfg.cfg_base_salary as number)} / ay`
                    return `${formatCurrency(t.salary_amount)} ${t.salary_type === 'per_lesson' ? '/ ders' : '/ ay'}`
                  })()}
                </p>
                <p className="text-xs text-primary-400 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  İşe giriş: {formatDate(t.hire_date)}
                </p>
              </div>

              <div className="mt-3 flex gap-2 pt-3 border-t border-primary-50">
                <button onClick={() => navigate(`/teachers/${t.id}/ledger`)} className="btn-primary text-xs flex-1">Cari Hesap</button>
                <button onClick={() => openEdit(t)} className="btn-outline text-xs flex-1">Düzenle</button>
                <button onClick={() => setDeleteId(t.id)} className="btn-ghost text-xs text-red-500 hover:bg-red-50 px-3">Sil</button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Öğretmen Düzenle' : 'Yeni Öğretmen Ekle'}
        size="lg"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn-outline">İptal</button>
            <button
              onClick={handleSave}
              disabled={!form.first_name || !form.last_name}
              className="btn-primary"
            >
              {editingTeacher ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Ad *</label>
            <input className="input" value={form.first_name || ''} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Soyad *</label>
            <input className="input" value={form.last_name || ''} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Telefon</label>
            <PhoneInput className="input" value={form.phone || ''} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">E-posta</label>
            <input className="input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Branş / Uzmanlık</label>
            <input className="input" placeholder="Piyano, Keman..." value={form.specialization || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-2">Öğrettiği Enstrümanlar</label>
            <div className="flex flex-wrap gap-2">
              {instruments.filter(i => i.is_active).map(i => {
                const selected = formInstruments.includes(i.id)
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setFormInstruments(prev =>
                      selected ? prev.filter(x => x !== i.id) : [...prev, i.id]
                    )}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-primary-500 border-primary-200 hover:border-primary-400'
                    }`}
                  >
                    {i.name}
                  </button>
                )
              })}
              {instruments.filter(i => i.is_active).length === 0 && (
                <span className="text-xs text-primary-400">Henüz enstrüman tanımlanmamış.</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Doğum Tarihi</label>
            <input className="input" type="date" value={form.birth_date || ''} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Çalışma Tipi</label>
            <select className="input" value={form.employment_type || 'full_time'} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value as any }))}>
              <option value="full_time">Tam Zamanlı</option>
              <option value="part_time">Yarı Zamanlı</option>
              <option value="freelance">Serbest</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Ücret Tipi</label>
            <select className="input" value={(form.salary_type as string) === 'percentage' ? 'percentage' : 'per_lesson'} onChange={e => setForm(f => ({ ...f, salary_type: e.target.value as any, salary_amount: 0 }))}>
              <option value="per_lesson">Ders Başı / Sabit Ücret</option>
              <option value="percentage">Ders Başı / Yüzde</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">
              {(form.salary_type as string) === 'percentage' ? 'Yüzde Oranı (%)' : 'Ücret (₺) / ders'}
            </label>
            <div className="relative">
              <input className="input pr-8" type="number" min="0"
                max={(form.salary_type as string) === 'percentage' ? 100 : undefined}
                step={(form.salary_type as string) === 'percentage' ? 1 : 0.01}
                value={form.salary_amount ?? 0}
                onChange={e => setForm(f => ({ ...f, salary_amount: Number(e.target.value) }))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-400 pointer-events-none">
                {(form.salary_type as string) === 'percentage' ? '%' : '₺'}
              </span>
            </div>
            {(form.salary_type as string) === 'percentage' && (
              <p className="text-xs text-primary-400 mt-1">Her derste öğrenci ücretinin %{form.salary_amount ?? 0}'i öğretmene gider</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">İşe Giriş Tarihi</label>
            <input className="input" type="date" value={form.hire_date || ''} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">IBAN</label>
            <input className="input font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00" value={form.iban || ''} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
          </div>
          {editingTeacher && (
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Durum</label>
              <select className="input" value={form.status || 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-primary-500 mb-1">Renk</label>
            <div className="flex items-center gap-2 flex-wrap">
              {TEACHER_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color_code: color }))}
                  className="w-7 h-7 rounded-lg transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: color,
                    boxShadow: form.color_code === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none'
                  }}
                />
              ))}
              <input
                type="color"
                value={form.color_code || '#7C3AED'}
                onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))}
                className="w-7 h-7 rounded-lg cursor-pointer border border-primary-100 p-0.5"
                title="Özel renk seç"
              />
            </div>
          </div>
          <div className={editingTeacher ? '' : 'col-span-2'}>
            <label className="block text-xs font-medium text-primary-500 mb-1">Notlar</label>
            <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Öğretmen Sil"
        message="Bu öğretmeni silmek istediğinize emin misiniz? İlgili tüm kayıtlar da etkilenecektir."
        confirmLabel="Sil"
        danger
      />
    </div>
  )
}
