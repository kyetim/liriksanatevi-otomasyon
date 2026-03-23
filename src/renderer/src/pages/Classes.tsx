import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  format, parseISO, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isToday
} from 'date-fns'
import { tr } from 'date-fns/locale'
import Modal from '@components/ui/Modal'
import EmptyState from '@components/ui/EmptyState'
import type { Teacher, Student, TeacherDayCard, ScheduleLesson, ConfirmationStatus } from '../types'
import { CONFIRMATION_LABELS, CONFIRMATION_ICONS, openWhatsApp } from '../types'

type ViewMode = 'daily' | 'weekly' | 'monthly'

interface AddForm {
  student_id: string
  student_input: string
  teacher_id: string
  lesson_date: string
  start_time: string
  end_time: string
  confirmation_status: ConfirmationStatus
}

export default function Classes(): JSX.Element {
  const today = format(new Date(), 'yyyy-MM-dd')

  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [teacherCards, setTeacherCards] = useState<TeacherDayCard[]>([])
  const [rangeLessons, setRangeLessons] = useState<ScheduleLesson[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>({
    student_id: '',
    student_input: '',
    teacher_id: '',
    lesson_date: today,
    start_time: '',
    end_time: '',
    confirmation_status: 'pending'
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' } | null>(null)
  const [teacherStudentIds, setTeacherStudentIds] = useState<Set<number>>(new Set())
  const navigate = useNavigate()

  // ── Veri yükleme ────────────────────────────────────────────────────────────

  const loadDaily = async () => {
    setLoading(true)
    await window.api.lessons.ensureForDateRange(selectedDate, selectedDate)
    const data = await window.api.lessons.getByDateGroupedByTeacher(selectedDate)
    setTeacherCards(data as unknown as TeacherDayCard[])
    setLoading(false)
  }

  const loadRange = async (from: string, to: string) => {
    setLoading(true)
    await window.api.lessons.ensureForDateRange(from, to)
    const data = await window.api.lessons.getByDateRange(from, to)
    setRangeLessons(data as unknown as ScheduleLesson[])
    setLoading(false)
  }

  useEffect(() => {
    window.api.teachers.getAll().then(d => setTeachers(d as Teacher[]))
    window.api.students.getAll().then(d => setStudents(d as Student[]))
  }, [])

  useEffect(() => {
    if (viewMode === 'daily') {
      loadDaily()
    } else if (viewMode === 'weekly') {
      const start = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const end = format(endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      loadRange(start, end)
    } else {
      const start = format(startOfMonth(parseISO(selectedDate)), 'yyyy-MM-dd')
      const end = format(endOfMonth(parseISO(selectedDate)), 'yyyy-MM-dd')
      loadRange(start, end)
    }
  }, [selectedDate, viewMode])

  // ── Handler'lar ─────────────────────────────────────────────────────────────

  const handleConfirmation = async (lessonId: number, status: ConfirmationStatus, note?: string) => {
    await window.api.lessons.setConfirmation(lessonId, status, note)
    setTeacherCards(prev => prev.map(card => ({
      ...card,
      lessons: card.lessons.map(l =>
        l.id === lessonId
          ? { ...l, confirmation_status: status, confirmation_note: note ?? l.confirmation_note }
          : l
      )
    })))
    setRangeLessons(prev => prev.map(l =>
      l.id === lessonId
        ? { ...l, confirmation_status: status, confirmation_note: note ?? l.confirmation_note }
        : l
    ))
  }

  const handleDateNav = (direction: -1 | 1) => {
    const current = parseISO(selectedDate)
    let next: Date
    if (viewMode === 'daily') next = addDays(current, direction)
    else if (viewMode === 'weekly') next = addWeeks(current, direction)
    else next = addMonths(current, direction)
    setSelectedDate(format(next, 'yyyy-MM-dd'))
  }

  const handleAddSave = async () => {
    if (!addForm.student_id || !addForm.lesson_date) {
      showToast('Öğrenci ve tarih zorunludur.', 'warn')
      return
    }
    setSaving(true)
    const result = await window.api.lessons.createScheduleEntry({
      student_id: Number(addForm.student_id),
      teacher_id: addForm.teacher_id ? Number(addForm.teacher_id) : undefined,
      lesson_date: addForm.lesson_date,
      start_time: addForm.start_time || undefined,
      end_time: addForm.end_time || undefined,
      confirmation_status: addForm.confirmation_status
    })
    setSaving(false)
    if (result && 'error' in result) {
      showToast((result as { error: string }).error, 'warn')
      return
    }
    setIsAddModalOpen(false)
    setAddForm({ student_id: '', student_input: '', teacher_id: '', lesson_date: selectedDate, start_time: '', end_time: '', confirmation_status: 'pending' })
    showToast('Ders eklendi.', 'success')
    if (viewMode === 'daily') {
      loadDaily()
    } else {
      const from = viewMode === 'weekly'
        ? format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(parseISO(selectedDate)), 'yyyy-MM-dd')
      const to = viewMode === 'weekly'
        ? format(endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(endOfMonth(parseISO(selectedDate)), 'yyyy-MM-dd')
      loadRange(from, to)
    }
  }

  // Öğretmen değişince o öğretmene kayıtlı öğrencileri filtrele
  useEffect(() => {
    if (!addForm.teacher_id) {
      setTeacherStudentIds(new Set())
      return
    }
    window.api.enrollments.getByTeacher(Number(addForm.teacher_id)).then(enrollments => {
      setTeacherStudentIds(new Set((enrollments as Array<{ student_id: number }>).map(e => e.student_id)))
    })
  }, [addForm.teacher_id])

  const calcEndTime = (startTime: string): string => {
    const [h, m] = startTime.split(':').map(Number)
    const totalMin = h * 60 + m + 50
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
  }

  const showToast = (msg: string, type: 'success' | 'warn') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const buildStudentConfirmMessage = (lesson: {
    student_name: string
    lesson_date: string
    start_time?: string | null
    end_time?: string | null
  }) => {
    const date = format(parseISO(lesson.lesson_date), 'd MMMM yyyy, EEEE', { locale: tr })
    const time = lesson.start_time
      ? ` saat ${lesson.start_time}${lesson.end_time ? ` - ${lesson.end_time}` : ''}`
      : ''
    const firstName = lesson.student_name.split(' ')[0]
    return `Merhaba ${firstName},\n\n${date}${time} tarihindeki dersinizi hatırlatmak istedik.\n\nİyi dersler dileriz!\nLirik Sanat Evi`
  }

  const exportTeacherCardAsPng = async (teacherName: string, cardElementId: string) => {
    try {
      const html2canvas = (await import('html2canvas')).default
      const element = document.getElementById(cardElementId)
      if (!element) return

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0
      })

      const link = document.createElement('a')
      link.download = `${teacherName.replace(/\s+/g, '_')}_program_${selectedDate}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('PNG dışa aktarma hatası:', err)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const getDateLabel = () => {
    if (viewMode === 'daily') {
      return format(parseISO(selectedDate), 'd MMMM yyyy, EEEE', { locale: tr })
    } else if (viewMode === 'weekly') {
      const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
      const end = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: tr })} – ${format(end, 'd MMM yyyy', { locale: tr })}`
    } else {
      return format(parseISO(selectedDate), 'MMMM yyyy', { locale: tr })
    }
  }

  const visibleCards = selectedTeacherId
    ? teacherCards.filter(c => c.teacher_id === selectedTeacherId)
    : teacherCards

  const getLessonsForDay = (dateStr: string) => {
    const filtered = rangeLessons.filter(l => l.lesson_date === dateStr)
    return selectedTeacherId ? filtered.filter(l => l.teacher_id === selectedTeacherId) : filtered
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div id="print-schedule" className="space-y-4">
      <style>{`
        @media print {
          body > *:not(#print-schedule) { display: none !important; }
          #print-schedule { display: block !important; }
          .no-print { display: none !important; }
          .card { box-shadow: none; border: 1px solid #ddd; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>

      {/* ── TOOLBAR ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        {/* Görünüm tabları */}
        <div className="flex items-center bg-primary-50 rounded-lg p-0.5">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-white'
                  : 'text-primary-400 hover:text-primary hover:bg-primary-100'
              }`}
            >
              {mode === 'daily' ? 'Günlük' : mode === 'weekly' ? 'Haftalık' : 'Aylık'}
            </button>
          ))}
        </div>

        {/* Tarih navigasyonu */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleDateNav(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 text-primary-400 hover:text-primary transition-colors text-lg"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-primary min-w-[200px] text-center">
            {getDateLabel()}
          </span>
          <button
            onClick={() => handleDateNav(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 text-primary-400 hover:text-primary transition-colors text-lg"
          >
            ›
          </button>
          <button
            onClick={() => setSelectedDate(today)}
            className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-primary-50 text-primary hover:bg-primary-100 transition-colors"
          >
            Bugün
          </button>
        </div>

        <div className="flex-1" />

        {/* Öğretmen filtresi */}
        <select
          className="input w-44 text-sm py-1.5"
          value={selectedTeacherId ?? ''}
          onChange={e => setSelectedTeacherId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Tüm Öğretmenler</option>
          {teachers.filter(t => t.status === 'active').map(t => (
            <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
          ))}
        </select>

        <button
          onClick={() => { setAddForm(f => ({ ...f, lesson_date: selectedDate })); setIsAddModalOpen(true) }}
          className="btn-primary text-sm px-3 py-1.5"
        >
          + Ders Ekle
        </button>

        <button
          onClick={() => window.print()}
          className="btn-outline text-sm px-3 py-1.5"
        >
          🖨️ Yazdır
        </button>
      </div>

      {/* ── GÜNLÜK GÖRÜNÜM ───────────────────────────────────────────────────── */}
      {viewMode === 'daily' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-primary-300 text-sm">Yükleniyor…</div>
          ) : visibleCards.length === 0 ? (
            <EmptyState
              title="Bu güne ait ders bulunamadı"
              description="Ders eklemek için + Ders Ekle butonunu kullanın."
            />
          ) : (
            visibleCards.map(card => (
              <motion.div
                key={card.teacher_id ?? 0}
                id={`teacher-card-${card.teacher_id ?? 'unassigned'}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card overflow-hidden"
                style={{ borderLeft: `4px solid ${card.color_code || '#1B3A6B'}` }}
              >
                {/* Kart başlığı */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-primary-50"
                  style={{ backgroundColor: (card.color_code || '#1B3A6B') + '14' }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                      style={{ backgroundColor: card.color_code || '#1B3A6B' }}
                    >
                      {getInitials(card.teacher_name)}
                    </div>
                    <span className="font-semibold text-primary text-sm">{card.teacher_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary-400">{card.lessons.length} ders</span>

                    {/* PNG İndir */}
                    <button
                      onClick={() => exportTeacherCardAsPng(
                        card.teacher_name,
                        `teacher-card-${card.teacher_id ?? 'unassigned'}`
                      )}
                      className="no-print w-7 h-7 flex items-center justify-center rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-400 hover:text-primary transition-colors"
                      title="Programı PNG olarak indir"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>

                    {/* WhatsApp'ta Gönder */}
                    {card.lessons[0]?.teacher_id && (
                      <button
                        onClick={async () => {
                          await exportTeacherCardAsPng(
                            card.teacher_name,
                            `teacher-card-${card.teacher_id ?? 'unassigned'}`
                          )
                          const teacher = teachers.find(t => t.id === card.teacher_id)
                          if (teacher?.phone) {
                            const dateLabel = format(parseISO(selectedDate), 'dd MMMM yyyy, EEEE', { locale: tr })
                            const lessonSummary = card.lessons
                              .map(l => `* ${l.start_time ?? '--:--'} - ${l.student_name}${
                                l.confirmation_status === 'confirmed' ? ' (Geliyor)' :
                                l.confirmation_status === 'cancelled' ? ' (Gelemiyor)' : ' (Yanit bekleniyor)'
                              }`)
                              .join('\n')
                            const message = `Merhaba ${card.teacher_name}, ${dateLabel} ders programiniz:\n\n${lessonSummary}\n\nProgram gorseli ekte gonderilmistir.`
                            openWhatsApp(teacher.phone, message)
                          } else {
                            alert(`${card.teacher_name} için telefon numarası tanımlı değil.`)
                          }
                        }}
                        className="no-print w-7 h-7 flex items-center justify-center rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                        title="Programı WhatsApp'ta gönder (PNG indirilir + WhatsApp açılır)"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Ders satırları */}
                {card.lessons.length === 0 ? (
                  <p className="text-xs text-primary-300 px-4 py-3">Bu gün ders yok.</p>
                ) : (
                  <div className="divide-y divide-primary-50">
                    {card.lessons.map(lesson => (
                      <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                        {/* Saat */}
                        <span className="text-xs font-mono text-primary-500 w-20 flex-shrink-0">
                          {lesson.start_time ?? '--:--'}
                          {lesson.end_time ? ` – ${lesson.end_time}` : ''}
                        </span>

                        {/* Öğrenci + enstrüman */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary flex items-center gap-1 min-w-0">
                            <button
                              onClick={() => navigate(`/students/${lesson.student_id}/ledger`)}
                              className="truncate hover:underline hover:text-accent transition-colors text-left"
                              title="Cari hesaba git"
                            >
                              {lesson.student_name}
                            </button>
                            <button
                              onClick={() => navigate('/students', { state: { openStudentId: lesson.student_id } })}
                              className="flex-shrink-0 text-primary-300 hover:text-primary-600 transition-colors"
                              title="Öğrenci detayına git"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                            </button>
                          </p>
                          {lesson.instrument_name && (
                            <p className="text-xs text-primary-400 flex items-center gap-1">
                              {lesson.instrument_color && (
                                <span
                                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                  style={{ backgroundColor: lesson.instrument_color }}
                                />
                              )}
                              {lesson.instrument_name}
                            </p>
                          )}
                        </div>

                        {/* Teyit butonları */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                          {(['confirmed', 'cancelled', 'pending'] as ConfirmationStatus[]).map(s => (
                            <button
                              key={s}
                              onClick={() => handleConfirmation(lesson.id, s)}
                              title={CONFIRMATION_LABELS[s]}
                              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                lesson.confirmation_status === s
                                  ? s === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400'
                                    : s === 'cancelled'
                                    ? 'bg-red-100 text-red-600 ring-1 ring-red-400'
                                    : 'bg-amber-50 text-amber-600 ring-1 ring-amber-300'
                                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                              }`}
                            >
                              {CONFIRMATION_ICONS[s]} {CONFIRMATION_LABELS[s]}
                            </button>
                          ))}

                          {lesson.confirmation_status === 'cancelled' && (
                            <input
                              className="input text-xs w-32 py-1"
                              placeholder="Mazeret (opsiyonel)"
                              defaultValue={lesson.confirmation_note ?? ''}
                              onBlur={e => handleConfirmation(lesson.id, 'cancelled', e.target.value)}
                            />
                          )}
                        </div>

                        {/* WhatsApp butonu */}
                        {lesson.student_phone && (
                          <button
                            onClick={() => openWhatsApp(lesson.student_phone!, buildStudentConfirmMessage(lesson))}
                            title="WhatsApp ile bildir"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors flex-shrink-0"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.845L0 24l6.338-1.503A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.88 9.88 0 01-5.031-1.37l-.36-.214-3.742.887.945-3.635-.235-.374A9.86 9.86 0 012.118 12C2.118 6.533 6.533 2.118 12 2.118c5.467 0 9.882 4.415 9.882 9.882 0 5.467-4.415 9.882-9.882 9.882z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── HAFTALIK GÖRÜNÜM ─────────────────────────────────────────────────── */}
      {viewMode === 'weekly' && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {Array.from({ length: 7 }, (_, i) =>
              addDays(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), i)
            ).map(day => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const dayLessons = getLessonsForDay(dayStr)
              const isCurrentDay = isToday(day)
              return (
                <div
                  key={dayStr}
                  className={`card p-2 cursor-pointer hover:shadow-md transition-shadow ${
                    isCurrentDay ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => { setSelectedDate(dayStr); setViewMode('daily') }}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs font-semibold text-primary-400 uppercase">
                      {format(day, 'EEE', { locale: tr })}
                    </p>
                    <p className={`text-lg font-bold ${isCurrentDay ? 'text-primary' : 'text-dark'}`}>
                      {format(day, 'd')}
                    </p>
                    {dayLessons.length > 0 && (
                      <span className="inline-block text-xs bg-primary text-white rounded-full px-1.5 py-0.5 mt-0.5">
                        {dayLessons.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayLessons.slice(0, 4).map(l => (
                      <div
                        key={l.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate font-medium"
                        style={{
                          backgroundColor: l.start_time ? (l.teacher_color || '#1B3A6B') + '22' : '#f3f4f6',
                          color: l.start_time ? (l.teacher_color || '#1B3A6B') : '#9ca3af',
                          border: l.start_time ? 'none' : '1px dashed #d1d5db'
                        }}
                        title={l.start_time ? `${l.start_time} ${l.student_name}` : `${l.student_name} — Saat belirsiz`}
                      >
                        {l.start_time
                          ? `${l.start_time} ${l.student_name.split(' ')[0]}`
                          : `? ${l.student_name.split(' ')[0]}`}
                      </div>
                    ))}
                    {dayLessons.length > 4 && (
                      <p className="text-xs text-primary-400 text-center">+{dayLessons.length - 4} daha</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AYLIK GÖRÜNÜM ────────────────────────────────────────────────────── */}
      {viewMode === 'monthly' && (
        <div className="card p-4">
          <div className="grid grid-cols-7 mb-2">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-primary-400 py-1">{d}</div>
            ))}
          </div>
          {(() => {
            const monthStart = startOfMonth(parseISO(selectedDate))
            const monthEnd = endOfMonth(parseISO(selectedDate))
            const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
            const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
            const days = eachDayOfInterval({ start: calStart, end: calEnd })
            const weeks: Date[][] = []
            for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

            return weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const inMonth = day >= monthStart && day <= monthEnd
                  const isCurrentDay = isToday(day)
                  const dayLessons = getLessonsForDay(dayStr)

                  return (
                    <div
                      key={dayStr}
                      onClick={() => { setSelectedDate(dayStr); setViewMode('daily') }}
                      className={`border border-primary-50 p-1.5 min-h-[56px] cursor-pointer hover:bg-primary-50/50 transition-colors ${
                        !inMonth ? 'opacity-30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          isCurrentDay ? 'bg-primary text-white' : 'text-dark'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {dayLessons.length > 0 && (
                          <span className="text-xs bg-primary-100 text-primary rounded px-1">
                            {dayLessons.length}
                          </span>
                        )}
                      </div>
                      {dayLessons.slice(0, 2).map(l => (
                        <div
                          key={l.id}
                          className="text-xs truncate leading-tight flex items-center gap-0.5"
                          title={l.student_name}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block"
                            style={{ backgroundColor: l.teacher_color || '#1B3A6B' }}
                          />
                          <span style={{ color: l.start_time ? (l.teacher_color || '#1B3A6B') : '#9ca3af' }}>
                            {l.start_time ? `${l.start_time} ${l.student_name.split(' ')[0]}` : `? ${l.student_name.split(' ')[0]}`}
                          </span>
                        </div>
                      ))}
                      {dayLessons.length > 2 && (
                        <div className="text-xs text-primary-400">+{dayLessons.length - 2}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      )}

      {/* ── DERS EKLE MODAL ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Ders Ekle"
        size="md"
        footer={
          <>
            <button className="btn-outline text-sm" onClick={() => setIsAddModalOpen(false)}>
              İptal
            </button>
            <button className="btn-primary text-sm" onClick={handleAddSave} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Tarih *</label>
            <input
              type="date"
              className="input"
              value={addForm.lesson_date}
              onChange={e => setAddForm(f => ({ ...f, lesson_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Öğretmen</label>
            <select
              className="input"
              value={addForm.teacher_id}
              onChange={e => setAddForm(f => ({ ...f, teacher_id: e.target.value, student_id: '', student_input: '' }))}
            >
              <option value="">Seçiniz</option>
              {teachers.filter(t => t.status === 'active').map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Başlangıç</label>
              <input
                type="time"
                className="input"
                step={900}
                value={addForm.start_time}
                onChange={e => {
                  const s = e.target.value
                  setAddForm(f => ({ ...f, start_time: s, end_time: s ? calcEndTime(s) : f.end_time }))
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Bitiş</label>
              <input
                type="time"
                className="input"
                step={900}
                value={addForm.end_time}
                onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Öğrenci *</label>
            <input
              list="students-list"
              className="input"
              placeholder="Öğrenci ara…"
              value={addForm.student_input}
              onChange={e => {
                const val = e.target.value
                const match = students.find(
                  s => `${s.first_name} ${s.last_name}`.toLowerCase() === val.toLowerCase()
                )
                setAddForm(f => ({
                  ...f,
                  student_input: val,
                  student_id: match ? String(match.id) : ''
                }))
              }}
            />
            <datalist id="students-list">
              {students
                .filter(s => s.status === 'active' && (teacherStudentIds.size === 0 || teacherStudentIds.has(s.id)))
                .map(s => (
                  <option key={s.id} value={`${s.first_name} ${s.last_name}`} />
                ))}
            </datalist>
            {addForm.student_input && !addForm.student_id && (
              <p className="text-xs text-amber-500 mt-1">Listeden bir öğrenci seçin.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Teyit Durumu</label>
            <div className="flex gap-2 flex-wrap">
              {(['pending', 'confirmed', 'cancelled'] as ConfirmationStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAddForm(f => ({ ...f, confirmation_status: s }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    addForm.confirmation_status === s
                      ? s === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400'
                        : s === 'cancelled'
                        ? 'bg-red-100 text-red-600 ring-1 ring-red-400'
                        : 'bg-amber-50 text-amber-600 ring-1 ring-amber-300'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {CONFIRMATION_ICONS[s]} {CONFIRMATION_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── TOAST ────────────────────────────────────────────────────────────── */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          {toast.msg}
        </motion.div>
      )}
    </div>
  )
}
