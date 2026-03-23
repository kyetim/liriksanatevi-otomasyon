import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Student, SmsLog, SmsTemplate, SmsBulkResult } from '../types'

// ─── Inline SVG Icons (no external icon library) ─────────────────────────────
const Icon = {
  MessageSquare: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
  Send: ({ size = 16 }: { size?: number }) => <svg style={{ width: size, height: size }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  ClipboardList: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  History: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Check: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  ChevronDown: ({ rotated }: { rotated?: boolean }) => <svg className={`w-3 h-3 transition-transform ${rotated ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Spinner: () => <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>,
  Warning: () => <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Info: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ExternalLink: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  Refresh: () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
}

// ─── Yardımcı ───────────────────────────────────────────────────────────────

const TEMPLATE_VARS = [
  { key: 'VELİ_ADI',      desc: 'Veli / ebeveyn adı' },
  { key: 'ÖĞRENCİ_ADI',   desc: 'Öğrencinin tam adı' },
  { key: 'AY',             desc: 'Ay adı (Ocak, Şubat...)' },
  { key: 'TUTAR',          desc: 'Ödeme tutarı (TL)' },
  { key: 'TARİH',          desc: 'İlgili tarih' },
  { key: 'GÜN',            desc: 'Gün sayısı' },
  { key: 'SAAT',           desc: 'Ders saati' },
  { key: 'TELEFON',        desc: 'Okul telefonu' }
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  sent:    { label: 'Gönderildi', cls: 'bg-emerald-100 text-emerald-700' },
  failed:  { label: 'Başarısız',  cls: 'bg-red-100 text-red-700' },
  skipped: { label: 'Atlandı',    cls: 'bg-amber-100 text-amber-700' }
}

function charCount(text: string): { count: number; sms: number } {
  const count = text.length
  const sms = count === 0 ? 0 : count <= 160 ? 1 : Math.ceil(count / 153)
  return { count, sms }
}

function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-\(\)]/g, '')
  if (p.startsWith('+90')) p = p.slice(3)
  else if (p.startsWith('90') && p.length === 12) p = p.slice(2)
  else if (p.startsWith('0')) p = p.slice(1)
  return p
}

function openWhatsApp(phone: string, message: string): void {
  const p = normalizePhone(phone)
  const url = `https://wa.me/90${p}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

// ─── Sekme 1: Toplu SMS ──────────────────────────────────────────────────────

interface BulkTarget {
  student: Student
  selected: boolean
  phone: string
  message: string
}

function TabBulkSms({
  hasCredentials,
  templates
}: {
  hasCredentials: boolean
  templates: SmsTemplate[]
}) {
  const [students, setStudents]             = useState<Student[]>([])
  const [filterMode, setFilterMode]         = useState<'all' | 'single'>('all')
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('')
  const [selectedTemplate, setSelectedTemplate]   = useState<string>('')
  const [freeText, setFreeText]             = useState('')
  const [targets, setTargets]               = useState<BulkTarget[]>([])
  const [sending, setSending]               = useState(false)
  const [result, setResult]                 = useState<SmsBulkResult | null>(null)
  const [error, setError]                   = useState('')

  useEffect(() => {
    window.api.students.getAll().then((rows) =>
      setStudents(rows.filter((s) => s.status === 'active'))
    )
  }, [])

  // Derive effective message
  const effectiveMessage = useCallback((): string => {
    if (selectedTemplate) {
      return templates.find((t) => t.template_key === selectedTemplate)?.content ?? freeText
    }
    return freeText
  }, [selectedTemplate, freeText, templates])

  // Build targets list whenever filter/students/message changes
  useEffect(() => {
    const msg = effectiveMessage()
    let list: Student[] = []
    if (filterMode === 'all') {
      list = students
    } else if (filterMode === 'single' && selectedStudentId) {
      const s = students.find((s) => s.id === Number(selectedStudentId))
      if (s) list = [s]
    }
    setTargets(
      list.map((s) => ({
        student: s,
        selected: true,
        phone: s.parent_phone || s.phone || '',
        message: msg
      }))
    )
  }, [filterMode, selectedStudentId, students, effectiveMessage])

  const toggleSelect = (idx: number) => {
    setTargets((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], selected: !next[idx].selected }
      return next
    })
  }

  const toggleAll = () => {
    const allSelected = targets.every((t) => t.selected)
    setTargets((prev) => prev.map((t) => ({ ...t, selected: !allSelected })))
  }

  const handleSend = async () => {
    const items = targets
      .filter((t) => t.selected && t.phone)
      .map((t) => ({
        phone: t.phone,
        message: effectiveMessage(),
        studentId: t.student.id,
        recipientName: t.student.parent_name || `${t.student.first_name} ${t.student.last_name}`,
        templateKey: selectedTemplate || undefined
      }))

    if (items.length === 0) { setError('Gönderilecek kişi bulunamadı.'); return }

    setSending(true)
    setResult(null)
    setError('')
    try {
      const res = await window.api.sms.sendBulk(items)
      setResult(res)
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const selectedCount = targets.filter((t) => t.selected && t.phone).length
  const { count, sms } = charCount(effectiveMessage())

  return (
    <div className="space-y-5">
      {/* No credentials warning */}
      {!hasCredentials && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          <Icon.Info />
          <span>
            SMS desteği için Netgsm API bilgileri gerekli. WhatsApp ile gönderim her zaman aktiftir.
            <strong className="ml-1">İleride WhatsApp Business API ile otomatik gönderim eklenecektir.</strong>
          </span>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Hedef Kitle</h3>
        <div className="flex gap-3 flex-wrap">
          {['all', 'single'].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m as 'all' | 'single')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                filterMode === m
                  ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B3A6B]'
              }`}
            >
              {m === 'all' ? 'Tüm Aktif Öğrenciler' : 'Tek Öğrenci'}
            </button>
          ))}
        </div>

        {filterMode === 'single' && (
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          >
            <option value="">Öğrenci seçin...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} — Veli: {s.parent_name || '—'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Template & Message */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Mesaj</h3>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Şablon (opsiyonel)</label>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value)
              if (e.target.value) {
                const tpl = templates.find((t) => t.template_key === e.target.value)
                if (tpl) setFreeText(tpl.content)
              }
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          >
            <option value="">Şablon seçme, serbest yaz</option>
            {templates.map((t) => (
              <option key={t.template_key} value={t.template_key}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mesaj metni</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={4}
            placeholder="Mesajınızı buraya yazın..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARS.map((v) => (
                <button
                  key={v.key}
                  title={v.desc}
                  onClick={() => setFreeText((prev) => prev + `[${v.key}]`)}
                  className="text-xs bg-gray-100 hover:bg-[#1B3A6B]/10 text-gray-600 px-2 py-0.5 rounded transition-colors"
                >
                  [{v.key}]
                </button>
              ))}
            </div>
            <span className={`text-xs shrink-0 ml-2 ${count > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
              {count} karakter / {sms} SMS
            </span>
          </div>
        </div>
      </div>

      {/* Target List */}
      {targets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={targets.every((t) => t.selected)}
                onChange={toggleAll}
                className="accent-[#1B3A6B]"
              />
              <span className="text-sm text-gray-600">
                <strong>{selectedCount}</strong> / {targets.length} kişi seçili
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Telefonu olmayanlar gönderilemez
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {targets.map((t, idx) => (
              <div
                key={t.student.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  !t.phone ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.selected}
                  disabled={!t.phone}
                  onChange={() => toggleSelect(idx)}
                  className="accent-[#1B3A6B]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {t.student.first_name} {t.student.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.student.parent_name ? `Veli: ${t.student.parent_name} · ` : ''}
                    {t.phone || 'Telefon yok'}
                  </p>
                </div>
                {t.phone && (
                  <button
                    title="WhatsApp'ta aç"
                    onClick={() => openWhatsApp(t.phone, effectiveMessage())}
                    className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                  >
                    <Icon.ExternalLink />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
          <Icon.X /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${
          result.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <p className="font-semibold mb-1">Gönderim Tamamlandı</p>
          <p>Toplam: {result.total} · Başarılı: <span className="text-emerald-700 font-medium">{result.sent}</span> · Başarısız: <span className="text-red-600 font-medium">{result.failed}</span></p>
          {result.results.filter((r) => !r.success).map((r, i) => (
            <p key={i} className="text-red-600 text-xs mt-1">✗ {r.recipientName}: {r.error}</p>
          ))}
        </div>
      )}

      {/* Send buttons */}
      <div className="flex flex-col gap-2 items-end">

        {/* WhatsApp ile Gönder — Ana buton */}
        <button
          onClick={() => {
            const items = targets.filter(t => t.selected && t.phone)
            if (items.length === 0) return
            const first = items[0]
            openWhatsApp(first.phone, effectiveMessage())
            if (items.length > 1) {
              setError(`${items.length} kişi için WhatsApp penceresi açılıyor. Tarayıcı engellerse izin ver.`)
              setTimeout(() => setError(''), 4000)
            }
          }}
          disabled={targets.filter(t => t.selected && t.phone).length === 0 || !effectiveMessage().trim()}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp ile Gönder ({targets.filter(t => t.selected && t.phone).length} kişi)
        </button>

        {/* SMS gönder — ikincil, küçük */}
        {hasCredentials && (
          <button
            onClick={handleSend}
            disabled={sending || targets.filter(t => t.selected && t.phone).length === 0 || !effectiveMessage().trim()}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-600 px-4 py-2 rounded-lg text-sm hover:border-[#1B3A6B] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {sending ? <Icon.Spinner /> : <Icon.Send size={14} />}
            {sending ? 'Gönderiliyor...' : 'SMS ile Gönder (yedek)'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sekme 2: Şablonlar ──────────────────────────────────────────────────────

function TabTemplates({ templates, onRefresh }: { templates: SmsTemplate[]; onRefresh: () => void }) {
  const [editContents, setEditContents] = useState<Record<string, string>>({})
  const [saving, setSaving]             = useState<Record<string, boolean>>({})
  const [saved, setSaved]               = useState<Record<string, boolean>>({})

  useEffect(() => {
    const map: Record<string, string> = {}
    templates.forEach((t) => { map[t.template_key] = t.content })
    setEditContents(map)
  }, [templates])

  const handleSave = async (key: string) => {
    setSaving((p) => ({ ...p, [key]: true }))
    await window.api.sms.templatesUpdate(key, editContents[key] ?? '')
    setSaving((p) => ({ ...p, [key]: false }))
    setSaved((p) => ({ ...p, [key]: true }))
    setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        <Icon.Info />
        <span>Şablon değişkenleri: {TEMPLATE_VARS.map((v) => `[${v.key}]`).join(', ')}</span>
      </div>

      {templates.map((tpl) => {
        const content = editContents[tpl.template_key] ?? tpl.content
        const { count, sms } = charCount(content)
        return (
          <div key={tpl.template_key} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{tpl.name}</h3>
              <span className="text-xs text-gray-400 font-mono">{tpl.template_key}</span>
            </div>
            <textarea
              value={content}
              onChange={(e) =>
                setEditContents((p) => ({ ...p, [tpl.template_key]: e.target.value }))
              }
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARS.map((v) => (
                  <button
                    key={v.key}
                    title={v.desc}
                    onClick={() =>
                      setEditContents((p) => ({
                        ...p,
                        [tpl.template_key]: (p[tpl.template_key] ?? '') + `[${v.key}]`
                      }))
                    }
                    className="text-xs bg-gray-100 hover:bg-[#1B3A6B]/10 text-gray-600 px-2 py-0.5 rounded transition-colors"
                  >
                    [{v.key}]
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${count > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {count} karakter / {sms} SMS
                </span>
                <button
                  onClick={() => handleSave(tpl.template_key)}
                  disabled={saving[tpl.template_key]}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    saved[tpl.template_key]
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[#1B3A6B] text-white hover:bg-[#1B3A6B]/90'
                  } disabled:opacity-50`}
                >
                  {saving[tpl.template_key] ? (
                    <Icon.Spinner />
                  ) : saved[tpl.template_key] ? (
                    <Icon.Check />
                  ) : null}
                  {saved[tpl.template_key] ? 'Kaydedildi' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sekme 3: Geçmiş ─────────────────────────────────────────────────────────

function TabHistory() {
  const [logs, setLogs]           = useState<SmsLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState<number | null>(null)

  // Monthly summary
  const now = new Date()
  const [summaryYear]  = useState(now.getFullYear())
  const [summaryMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<{ total: number; sent: number; failed: number; skipped: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await window.api.sms.getHistory({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: statusFilter || undefined
    })
    setLogs(rows)
    setLoading(false)
  }, [dateFrom, dateTo, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.api.sms.getMonthlySummary(summaryYear, summaryMonth).then(setSummary)
  }, [summaryYear, summaryMonth])

  const filtered = logs.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.recipient_name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.student_name ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      {/* Monthly summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Toplam', value: summary.total, cls: 'text-gray-700' },
            { label: 'Gönderildi', value: summary.sent, cls: 'text-emerald-700' },
            { label: 'Başarısız', value: summary.failed, cls: 'text-red-600' },
            { label: 'Atlandı', value: summary.skipped, cls: 'text-amber-600' }
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              <p className="text-xs text-gray-400">{now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, telefon ara..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
          >
            <option value="">Tüm durumlar</option>
            <option value="sent">Gönderildi</option>
            <option value="failed">Başarısız</option>
            <option value="skipped">Atlandı</option>
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-[#1B3A6B] transition-colors"
          >
            <Icon.Refresh /> Yenile
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <svg className="animate-spin w-6 h-6 text-[#1B3A6B]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Kayıt bulunamadı</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Tarih</th>
                  <th className="px-4 py-3 text-left">Alıcı</th>
                  <th className="px-4 py-3 text-left">Telefon</th>
                  <th className="px-4 py-3 text-left">Şablon</th>
                  <th className="px-4 py-3 text-left">Durum</th>
                  <th className="px-4 py-3 text-left">Mesaj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => {
                  const badge = STATUS_BADGE[log.status] ?? { label: log.status, cls: 'bg-gray-100 text-gray-600' }
                  const isOpen = expanded === log.id
                  return (
                    <>
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.sent_at).toLocaleDateString('tr-TR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{log.recipient_name}</p>
                          {log.student_name && <p className="text-xs text-gray-400">{log.student_name}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{log.phone}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{log.template_key ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {log.error_message && (
                            <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpanded(isOpen ? null : log.id)}
                            className="flex items-center gap-1 text-[#1B3A6B] hover:underline text-xs"
                          >
                            {isOpen ? 'Gizle' : 'Göster'}
                            <Icon.ChevronDown rotated={isOpen} />
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${log.id}-detail`} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.message}</p>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'bulk',      label: 'WhatsApp Gönder', icon: Icon.Send },
  { key: 'templates', label: 'Şablonlar',        icon: Icon.ClipboardList },
  { key: 'history',   label: 'Geçmiş',           icon: Icon.History }
]

export default function Messages() {
  const [activeTab, setActiveTab]       = useState('bulk')
  const [templates, setTemplates]       = useState<SmsTemplate[]>([])
  const [hasCredentials, setHasCreds]   = useState(false)
  const [testLoading, setTestLoading]   = useState(false)
  const [testMsg, setTestMsg]           = useState('')

  const loadTemplates = async () => {
    const rows = await window.api.sms.templatesGetAll()
    setTemplates(rows)
  }

  useEffect(() => {
    loadTemplates()
    window.api.sms.hasCredentials().then((r) => setHasCreds(r.hasCredentials))
  }, [])

  const handleTest = async () => {
    setTestLoading(true)
    setTestMsg('')
    const res = await window.api.sms.testConnection()
    setTestMsg(res.message ?? res.error ?? '')
    setTestLoading(false)
    // Refresh credentials status
    window.api.sms.hasCredentials().then((r) => setHasCreds(r.hasCredentials))
  }

  return (
    <div className="min-h-screen bg-[#F8F6F1] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A6B]">İletişim</h1>
          <p className="text-sm text-gray-500 mt-0.5">WhatsApp gönder · Şablonları düzenle · Geçmişi görüntüle</p>
        </div>
        <div className="flex items-center gap-3">
          {testMsg && (
            <span className={`text-xs px-3 py-1.5 rounded-lg ${hasCredentials ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {testMsg}
            </span>
          )}
          <button
            onClick={handleTest}
            disabled={testLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-[#1B3A6B] transition-all disabled:opacity-50"
          >
            {testLoading ? <Icon.Spinner /> : <Icon.MessageSquare />}
            Bağlantıyı Test Et
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-[#1B3A6B] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'bulk' && (
            <TabBulkSms hasCredentials={hasCredentials} templates={templates} />
          )}
          {activeTab === 'templates' && (
            <TabTemplates templates={templates} onRefresh={loadTemplates} />
          )}
          {activeTab === 'history' && (
            <TabHistory />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
