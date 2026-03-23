import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Lesson } from '../types'
import { LESSON_STATUS_LABELS } from '../types'

const statusConfig: Record<Lesson['status'], { cls: string; dot: string }> = {
  completed:      { cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-emerald-400', dot: 'bg-emerald-500' },
  cancelled:      { cls: 'bg-red-100 text-red-600 hover:bg-red-200 ring-red-400',              dot: 'bg-red-500'     },
  student_absent: { cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-amber-400',      dot: 'bg-amber-500'   },
  teacher_absent: { cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200 ring-orange-400',  dot: 'bg-orange-500'  },
  makeup:         { cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200 ring-blue-400',          dot: 'bg-blue-500'    }
}

export default function Attendance(): JSX.Element {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [closingDay, setClosingDay] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' | 'info' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'warn' | 'info' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [noteForm, setNoteForm] = useState<{ topic_covered: string; homework: string; teacher_notes: string }>({
    topic_covered: '', homework: '', teacher_notes: ''
  })

  const load = async () => {
    setLoading(true)
    const data = await window.api.lessons.getByDate(selectedDate)
    setLessons(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedDate])

  const handleBulkCreate = async () => {
    setCreating(true)
    await window.api.lessons.bulkCreateForDate(selectedDate)
    await load()
    setCreating(false)
  }

  const handleStatus = async (id: number, status: Lesson['status']) => {
    setSaving(id)
    const result = await window.api.lessons.updateStatus(id, status)
    if (result.error) {
      showToast(result.error, 'warn')
    } else {
      setLessons(prev => prev.map(l =>
        l.id === id ? { ...l, ...(result.lesson ?? {}), status } : l
      ))
      if (result.ledgerError) {
        showToast(result.ledgerError, 'warn')
      } else if (result.ledgerAmount !== undefined && result.ledgerAmount > 0) {
        showToast(`${result.ledgerAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ borç kaydı oluşturuldu`)
      } else if (status === 'cancelled' || status === 'teacher_absent') {
        showToast('Borç kaydı iptal edildi', 'info')
      }
    }
    setSaving(null)
  }

  const handleCompleteDay = async () => {
    setClosingDay(true)
    const result = await window.api.lessons.completeDay(selectedDate)
    await load()
    if (result.count > 0) {
      showToast(`${result.count} ders tamamlandı — toplam ${result.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ borç kaydı oluşturuldu`)
    } else {
      showToast('Kapatılacak ders bulunamadı', 'info')
    }
    setClosingDay(false)
  }

  const openNotes = (l: Lesson) => {
    setExpandedId(expandedId === l.id ? null : l.id)
    setNoteForm({
      topic_covered: l.topic_covered || '',
      homework: l.homework || '',
      teacher_notes: l.teacher_notes || ''
    })
  }

  const saveNotes = async (id: number) => {
    setSaving(id)
    await window.api.lessons.update(id, noteForm)
    setLessons(prev => prev.map(l => l.id === id ? { ...l, ...noteForm } : l))
    setSaving(null)
    setExpandedId(null)
  }

  const completedCount = lessons.filter(l => l.status === 'completed').length
  const absentCount    = lessons.filter(l => l.status === 'student_absent' || l.status === 'teacher_absent').length
  const dateLabel = format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy, EEEE', { locale: tr })

  const toastColors = {
    success: 'bg-emerald-600',
    warn: 'bg-amber-500',
    info: 'bg-primary'
  }

  return (
    <div className="space-y-4">
      {/* Toast Bildirimi */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className={`${toastColors[toast.type]} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm`}
          >
            {toast.msg}
          </motion.div>
        </div>
      )}
      {/* Date Picker Row */}
      <div className="card flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-primary-400">Tarih:</label>
          <input
            type="date"
            className="input w-44"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
        <span className="text-sm text-primary-500 font-medium">{dateLabel}</span>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-primary-400">Tamamlanan: <strong className="text-primary">{completedCount}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-primary-400">Gelmedi: <strong className="text-primary">{absentCount}</strong></span>
          </span>
          <button
            onClick={handleBulkCreate}
            disabled={creating}
            className="btn-outline text-xs"
          >
            {creating ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                Oluşturuluyor...
              </span>
            ) : 'Dersleri Oluştur'}
          </button>
          <button
            onClick={handleCompleteDay}
            disabled={closingDay || lessons.length === 0}
            className="btn-primary text-xs"
            title="Günün tüm derslerini tamamla ve cari borç kaydı oluştur"
          >
            {closingDay ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                İşleniyor...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Günü Kapat
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Lesson List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 text-primary-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-primary-400 text-sm font-medium">Bu tarihe ait ders kaydı bulunamadı.</p>
          <p className="text-primary-300 text-xs mt-1">Aktif kayıtlar için "Dersleri Oluştur" butonuna tıklayın.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {lessons.map(lesson => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="card overflow-hidden"
            >
              <div className="flex items-center gap-4">
                {/* Instrument color dot + Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <span className="text-primary font-semibold text-sm">
                      {lesson.student_name?.split(' ').map(n => n[0]).join('') ?? '?'}
                    </span>
                  </div>
                  {lesson.instrument_color && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                      style={{ backgroundColor: lesson.instrument_color }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">{lesson.student_name}</p>
                  <p className="text-xs text-primary-400">
                    {lesson.instrument_name || 'Enstrüman belirtilmemiş'}
                    {lesson.teacher_name && ` • ${lesson.teacher_name}`}
                    {lesson.start_time && ` • ${lesson.start_time}`}
                  </p>
                </div>

                {/* Status Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                  {(Object.keys(statusConfig) as Lesson['status'][]).map(status => (
                    <button
                      key={status}
                      disabled={saving === lesson.id}
                      onClick={() => handleStatus(lesson.id, status)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        lesson.status === status
                          ? statusConfig[status].cls + ' ring-2 ring-offset-1'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {LESSON_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>

                {/* Notes toggle */}
                <button
                  onClick={() => openNotes(lesson)}
                  className={`btn-ghost p-1.5 rounded-lg flex-shrink-0 ${expandedId === lesson.id ? 'bg-primary-100 text-primary' : 'text-primary-300'}`}
                  title="Ders notu ekle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>

              {/* Notes expansion */}
              <AnimatePresence>
                {expandedId === lesson.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-primary-50 grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-primary-500 mb-1">İşlenen Konu</label>
                        <input
                          className="input text-sm"
                          placeholder="Bu derste işlenen konu..."
                          value={noteForm.topic_covered}
                          onChange={e => setNoteForm(n => ({ ...n, topic_covered: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary-500 mb-1">Ödev</label>
                        <input
                          className="input text-sm"
                          placeholder="Verilen ödev..."
                          value={noteForm.homework}
                          onChange={e => setNoteForm(n => ({ ...n, homework: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary-500 mb-1">Öğretmen Notu</label>
                        <textarea
                          className="input resize-none text-sm"
                          rows={2}
                          placeholder="Gözlemler, özel notlar..."
                          value={noteForm.teacher_notes}
                          onChange={e => setNoteForm(n => ({ ...n, teacher_notes: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setExpandedId(null)} className="btn-outline text-xs">İptal</button>
                        <button
                          onClick={() => saveNotes(lesson.id)}
                          disabled={saving === lesson.id}
                          className="btn-primary text-xs"
                        >
                          Kaydet
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
