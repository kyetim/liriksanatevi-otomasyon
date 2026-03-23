import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import type { Event, EventParticipant, EventRehearsal, EventChecklist, EventPhoto, Student, Instrument } from '../types'
import EventProgram from '../components/EventProgram'
import EventInvitation from '../components/EventInvitation'

// ─── Yardımcı sabitler ────────────────────────────────────────────────────────

const EVENT_TYPES: Record<Event['event_type'], string> = {
  concert: 'Konser', recital: 'Resital', workshop: 'Atölye',
  gala: 'Gala', summer_school: 'Yaz Okulu', other: 'Diğer'
}

const EVENT_STATUSES: Record<Event['status'], { label: string; color: string }> = {
  planning:   { label: 'Planlama',    color: '#6b7280' },
  rehearsal:  { label: 'Prova',       color: '#8b5cf6' },
  ready:      { label: 'Hazır',       color: '#059669' },
  completed:  { label: 'Tamamlandı',  color: '#1B3A6B' },
  cancelled:  { label: 'İptal',       color: '#dc2626' }
}

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [modalTab, setModalTab] = useState<'participants' | 'rehearsals' | 'checklist' | 'photos'>('participants')

  // Modal data
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [rehearsals, setRehearsals] = useState<EventRehearsal[]>([])
  const [checklist, setChecklist] = useState<EventChecklist[]>([])
  const [photos, setPhotos] = useState<EventPhoto[]>([])
  const [loadingModal, setLoadingModal] = useState(false)

  // Print refs
  const programRef = useRef<HTMLDivElement>(null)
  const invitationRef = useRef<HTMLDivElement>(null)
  const [printInvitationParticipant, setPrintInvitationParticipant] = useState<EventParticipant | null>(null)
  const [invitationHeader, setInvitationHeader] = useState('')
  const [invitationFooter, setInvitationFooter] = useState('')

  // Create/Edit form
  const [form, setForm] = useState<Partial<Event>>({
    event_type: 'concert', status: 'planning', is_free: 1
  })
  const [editMode, setEditMode] = useState(false)

  // Participant add form
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [participantForm, setParticipantForm] = useState<Record<string, unknown>>({})

  // Rehearsal add form
  const [showAddRehearsal, setShowAddRehearsal] = useState(false)
  const [rehearsalForm, setRehearsalForm] = useState<Record<string, unknown>>({})

  // Checklist add form
  const [checklistInput, setChecklistInput] = useState('')

  // Notifications
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  // Settings
  const [settings, setSettings] = useState<Record<string, unknown>>({})

  // ─── Load ────────────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const [evts, stds, insts, sett] = await Promise.all([
        window.api.events.getAll(),
        window.api.students.getAll(),
        window.api.instruments.getAll(),
        window.api.settings.getAll()
      ])
      setEvents(evts)
      setStudents(stds)
      setInstruments(insts)
      setSettings(sett)
      // Init invitation header/footer from settings
      if (sett.event_invitation_header) setInvitationHeader(String(sett.event_invitation_header))
      if (sett.event_invitation_footer) setInvitationFooter(String(sett.event_invitation_footer))
    } catch {
      showToast('Etkinlikler yüklenemedi', false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  const loadModalData = useCallback(async (eventId: number) => {
    setLoadingModal(true)
    try {
      const [parts, rehrs, chkl, phts] = await Promise.all([
        window.api.event_participants.getByEvent(eventId),
        window.api.event_rehearsals.getByEvent(eventId),
        window.api.event_checklist.getByEvent(eventId),
        window.api.event_photos.getByEvent(eventId)
      ])
      setParticipants(parts)
      setRehearsals(rehrs)
      setChecklist(chkl)
      setPhotos(phts)
    } finally {
      setLoadingModal(false)
    }
  }, [])

  // ─── Print handlers ──────────────────────────────────────────────────────────

  const printProgram = useReactToPrint({ content: () => programRef.current })
  const printInvitation = useReactToPrint({ content: () => invitationRef.current })

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    try {
      await window.api.events.create(form)
      showToast('Etkinlik oluşturuldu')
      setShowCreateModal(false)
      setForm({ event_type: 'concert', status: 'planning', is_free: 1 })
      loadEvents()
    } catch {
      showToast('Etkinlik oluşturulamadı', false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedEvent) return
    try {
      const updated = await window.api.events.update(selectedEvent.id, form)
      setSelectedEvent(updated)
      setEvents(ev => ev.map(e => e.id === updated.id ? updated : e))
      showToast('Etkinlik güncellendi')
      setEditMode(false)
    } catch {
      showToast('Güncelleme başarısız', false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return
    try {
      await window.api.events.delete(id)
      setEvents(ev => ev.filter(e => e.id !== id))
      if (selectedEvent?.id === id) { setShowModal(false); setSelectedEvent(null) }
      showToast('Etkinlik silindi')
    } catch {
      showToast('Silme başarısız', false)
    }
  }

  const handleUploadPoster = async () => {
    if (!selectedEvent) return
    const path = await window.api.events.uploadPoster(selectedEvent.id)
    if (path) {
      const updated = { ...selectedEvent, poster_path: path }
      setSelectedEvent(updated)
      setEvents(ev => ev.map(e => e.id === selectedEvent.id ? updated : e))
      showToast('Afiş yüklendi')
    }
  }

  const handleAddParticipant = async () => {
    if (!selectedEvent) return
    try {
      const p = await window.api.event_participants.add({ ...participantForm, event_id: selectedEvent.id })
      setParticipants(prev => [...prev, p])
      setShowAddParticipant(false)
      setParticipantForm({})
      showToast('Katılımcı eklendi')
    } catch {
      showToast('Katılımcı eklenemedi', false)
    }
  }

  const handleRemoveParticipant = async (id: number) => {
    await window.api.event_participants.remove(id)
    setParticipants(prev => prev.filter(p => p.id !== id))
    showToast('Katılımcı çıkarıldı')
  }

  const handleReorder = async (id: number, dir: 'up' | 'down') => {
    const sorted = [...participants].sort((a, b) => a.stage_order - b.stage_order)
    const idx = sorted.findIndex(p => p.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === sorted.length - 1) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
    const orderedIds = sorted.map(p => p.id)
    await window.api.event_participants.reorder(selectedEvent!.id, orderedIds)
    setParticipants(sorted.map((p, i) => ({ ...p, stage_order: i + 1 })))
  }

  const handleMarkAttended = async (id: number, val: number) => {
    await window.api.event_participants.update(id, { is_attended: val })
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, is_attended: val } : p))
  }

  const handleAddRehearsal = async () => {
    if (!selectedEvent) return
    try {
      const r = await window.api.event_rehearsals.create({ ...rehearsalForm, event_id: selectedEvent.id })
      setRehearsals(prev => [...prev, r])
      setShowAddRehearsal(false)
      setRehearsalForm({})
      showToast('Prova eklendi')
    } catch {
      showToast('Prova eklenemedi', false)
    }
  }

  const handleDeleteRehearsal = async (id: number) => {
    await window.api.event_rehearsals.delete(id)
    setRehearsals(prev => prev.filter(r => r.id !== id))
  }

  const handleToggleCheck = async (id: number) => {
    await window.api.event_checklist.toggle(id)
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, is_done: c.is_done ? 0 : 1 } : c))
  }

  const handleAddCheck = async () => {
    if (!checklistInput.trim() || !selectedEvent) return
    const item = await window.api.event_checklist.create({ event_id: selectedEvent.id, title: checklistInput.trim() })
    setChecklist(prev => [...prev, item])
    setChecklistInput('')
  }

  const handleDeleteCheck = async (id: number) => {
    await window.api.event_checklist.delete(id)
    setChecklist(prev => prev.filter(c => c.id !== id))
  }

  const handleUploadPhotos = async () => {
    if (!selectedEvent) return
    const newPhotos = await window.api.event_photos.upload(selectedEvent.id)
    setPhotos(prev => [...prev, ...newPhotos])
    showToast(`${newPhotos.length} fotoğraf yüklendi`)
  }

  const handleDeletePhoto = async (id: number) => {
    await window.api.event_photos.delete(id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const openModal = (ev: Event) => {
    setSelectedEvent(ev)
    setForm({
      name: ev.name, event_type: ev.event_type, event_date: ev.event_date,
      start_time: ev.start_time, end_time: ev.end_time, venue: ev.venue,
      capacity: ev.capacity, ticket_price: ev.ticket_price, is_free: ev.is_free,
      description: ev.description, status: ev.status, notes: ev.notes
    })
    setModalTab('participants')
    setShowModal(true)
    setEditMode(false)
    loadModalData(ev.id)
  }

  // ─── Filtered events ─────────────────────────────────────────────────────────

  const filtered = events.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false
    if (filterType && e.event_type !== filterType) return false
    return true
  })

  // ─── Calendar view ───────────────────────────────────────────────────────────

  const calendarMonths = MONTHS.map((name, idx) => ({
    name,
    events: events.filter(e => {
      const d = new Date(e.event_date)
      return d.getFullYear() === calendarYear && d.getMonth() === idx
    })
  }))

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#888' }}>
        Yükleniyor...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '8px', color: '#fff', fontWeight: 600,
          backgroundColor: toast.ok ? '#059669' : '#dc2626', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1B3A6B' }}>Etkinlik & Konser Yönetimi</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '14px' }}>
            {events.length} etkinlik · {events.filter(e => e.status !== 'completed' && e.status !== 'cancelled').length} aktif
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {(['list', 'calendar'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
                backgroundColor: view === v ? '#1B3A6B' : '#fff',
                color: view === v ? '#fff' : '#555'
              }}>
                {v === 'list' ? 'Liste' : 'Takvim'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreateModal(true)} style={{
            padding: '8px 20px', backgroundColor: '#1B3A6B', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
          }}>
            + Yeni Etkinlik
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">Tüm Durumlar</option>
          {Object.entries(EVENT_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Tüm Türler</option>
          {Object.entries(EVENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ─── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: '60px', fontSize: '16px' }}>
              Henüz etkinlik yok. Yeni bir etkinlik oluşturun.
            </div>
          )}
          {filtered.map(ev => (
            <div key={ev.id} style={cardStyle} onClick={() => openModal(ev)}>
              {/* Poster / Placeholder */}
              <div style={{
                height: '140px', borderRadius: '8px 8px 0 0', overflow: 'hidden',
                backgroundColor: '#1B3A6B', position: 'relative', flexShrink: 0
              }}>
                {ev.poster_path ? (
                  <img src={`file://${ev.poster_path}`} alt="afiş" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎵</div>
                    <div style={{ fontSize: '14px', opacity: 0.7 }}>{EVENT_TYPES[ev.event_type]}</div>
                  </div>
                )}
                <div style={{
                  position: 'absolute', top: '8px', right: '8px', padding: '3px 10px',
                  borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#fff',
                  backgroundColor: EVENT_STATUSES[ev.status].color
                }}>
                  {EVENT_STATUSES[ev.status].label}
                </div>
              </div>

              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B3A6B', marginBottom: '4px', lineHeight: 1.3 }}>
                  {ev.name}
                </div>
                <div style={{ fontSize: '12px', color: '#C9A84C', marginBottom: '8px' }}>
                  {EVENT_TYPES[ev.event_type]}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#555' }}>
                  <span>📅 {new Date(ev.event_date).toLocaleDateString('tr-TR')}</span>
                  {ev.start_time && <span>🕐 {ev.start_time}</span>}
                </div>
                {ev.venue && (
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>📍 {ev.venue}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    👥 {ev.participant_count ?? 0} katılımcı
                  </span>
                  {!ev.is_free && ev.ticket_price && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                      {ev.ticket_price.toLocaleString('tr-TR')} ₺
                    </span>
                  )}
                  {ev.is_free ? <span style={{ fontSize: '12px', color: '#8b5cf6' }}>Ücretsiz</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── CALENDAR VIEW ──────────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <button onClick={() => setCalendarYear(y => y - 1)} style={navBtnStyle}>‹</button>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#1B3A6B' }}>{calendarYear}</span>
            <button onClick={() => setCalendarYear(y => y + 1)} style={navBtnStyle}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {calendarMonths.map((m, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', backgroundColor: '#fff' }}>
                <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: '8px', fontSize: '14px' }}>{m.name}</div>
                {m.events.length === 0 ? (
                  <div style={{ color: '#ccc', fontSize: '12px' }}>Etkinlik yok</div>
                ) : (
                  m.events.map(ev => (
                    <div key={ev.id} onClick={() => openModal(ev)} style={{
                      padding: '6px 8px', borderRadius: '6px', marginBottom: '6px', cursor: 'pointer',
                      backgroundColor: '#f0f4ff', border: `1px solid ${EVENT_STATUSES[ev.status].color}30`
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1B3A6B' }}>{ev.name}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {new Date(ev.event_date).getDate()} {MONTHS[idx]}
                        {ev.start_time && ` · ${ev.start_time}`}
                      </div>
                      <div style={{
                        display: 'inline-block', marginTop: '3px', padding: '1px 8px', borderRadius: '10px',
                        fontSize: '10px', color: '#fff', backgroundColor: EVENT_STATUSES[ev.status].color
                      }}>
                        {EVENT_STATUSES[ev.status].label}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ───────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <ModalOverlay onClose={() => setShowCreateModal(false)}>
          <div style={{ width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <h2 style={{ margin: '0 0 20px', color: '#1B3A6B' }}>Yeni Etkinlik</h2>
            <EventFormFields form={form} onChange={f => setForm(f)} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>İptal</button>
              <button onClick={handleCreate} style={primaryBtnStyle}>Oluştur</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─── DETAIL MODAL ───────────────────────────────────────────────────────── */}
      {showModal && selectedEvent && (
        <ModalOverlay onClose={() => { setShowModal(false); setSelectedEvent(null) }}>
          <div style={{ width: '900px', maxWidth: '97vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#1B3A6B' }}>{selectedEvent.name}</h2>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: '#fff',
                    backgroundColor: EVENT_STATUSES[selectedEvent.status].color
                  }}>
                    {EVENT_STATUSES[selectedEvent.status].label}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                  {EVENT_TYPES[selectedEvent.event_type]} · {new Date(selectedEvent.event_date).toLocaleDateString('tr-TR')}
                  {selectedEvent.start_time && ` · ${selectedEvent.start_time}`}
                  {selectedEvent.venue && ` · ${selectedEvent.venue}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => setEditMode(e => !e)} style={editMode ? activeBtnStyle : outlineBtnStyle}>
                  {editMode ? 'Düzenleniyor...' : 'Düzenle'}
                </button>
                <button onClick={() => handleDelete(selectedEvent.id)} style={{ ...outlineBtnStyle, color: '#dc2626', borderColor: '#dc2626' }}>
                  Sil
                </button>
                <button onClick={() => { setShowModal(false); setSelectedEvent(null) }} style={closeBtnStyle}>✕</button>
              </div>
            </div>

            {/* Edit form */}
            {editMode && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <EventFormFields form={form} onChange={f => setForm(f)} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditMode(false)} style={cancelBtnStyle}>İptal</button>
                  <button onClick={handleUpdate} style={primaryBtnStyle}>Kaydet</button>
                </div>
              </div>
            )}

            {/* Poster + actions row */}
            {!editMode && (
              <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedEvent.poster_path ? (
                  <img src={`file://${selectedEvent.poster_path}`} alt="afiş" style={{ height: '60px', borderRadius: '6px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '60px', width: '45px', borderRadius: '6px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎵</div>
                )}
                <button onClick={handleUploadPoster} style={outlineBtnStyle}>Afiş Yükle</button>
                <div style={{ flex: 1 }} />
                <button onClick={() => { setPrintInvitationParticipant(null); printProgram() }} style={outlineBtnStyle}>
                  Program Kitapçığı Yazdır
                </button>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
              {([
                ['participants', `Katılımcılar (${participants.length})`],
                ['rehearsals', `Provalar (${rehearsals.length})`],
                ['checklist', `Kontrol Listesi (${checklist.filter(c => c.is_done).length}/${checklist.length})`],
                ['photos', `Fotoğraflar (${photos.length})`]
              ] as [typeof modalTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setModalTab(key)} style={{
                  padding: '12px 16px', border: 'none', borderBottom: modalTab === key ? '2px solid #1B3A6B' : '2px solid transparent',
                  backgroundColor: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: modalTab === key ? 700 : 400,
                  color: modalTab === key ? '#1B3A6B' : '#888', marginBottom: '-1px'
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {loadingModal && <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>Yükleniyor...</div>}

              {/* ─ PARTICIPANTS ─ */}
              {!loadingModal && modalTab === 'participants' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
                    <button onClick={() => setShowAddParticipant(v => !v)} style={primaryBtnStyle}>+ Katılımcı Ekle</button>
                  </div>

                  {showAddParticipant && (
                    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#f9fafb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={labelStyle}>Öğrenci *</label>
                          <select value={String(participantForm.student_id ?? '')}
                            onChange={e => setParticipantForm(p => ({ ...p, student_id: Number(e.target.value) }))}
                            style={inputStyle}>
                            <option value="">Seçin</option>
                            {students.filter(s => s.status === 'active').map(s => (
                              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Enstrüman</label>
                          <select value={String(participantForm.instrument_id ?? '')}
                            onChange={e => setParticipantForm(p => ({ ...p, instrument_id: e.target.value ? Number(e.target.value) : null }))}
                            style={inputStyle}>
                            <option value="">Seçin</option>
                            {instruments.map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Eser Adı</label>
                          <input value={String(participantForm.piece_title ?? '')}
                            onChange={e => setParticipantForm(p => ({ ...p, piece_title: e.target.value }))}
                            style={inputStyle} placeholder="Örn: Für Elise" />
                        </div>
                        <div>
                          <label style={labelStyle}>Besteci</label>
                          <input value={String(participantForm.piece_composer ?? '')}
                            onChange={e => setParticipantForm(p => ({ ...p, piece_composer: e.target.value }))}
                            style={inputStyle} placeholder="Örn: Beethoven" />
                        </div>
                        <div>
                          <label style={labelStyle}>Süre (dk)</label>
                          <input type="number" value={String(participantForm.performance_duration ?? '')}
                            onChange={e => setParticipantForm(p => ({ ...p, performance_duration: Number(e.target.value) }))}
                            style={inputStyle} placeholder="5" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowAddParticipant(false); setParticipantForm({}) }} style={cancelBtnStyle}>İptal</button>
                        <button onClick={handleAddParticipant} style={primaryBtnStyle}>Ekle</button>
                      </div>
                    </div>
                  )}

                  {participants.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Henüz katılımcı yok.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                          <th style={thStyle}>Sıra</th>
                          <th style={thStyle}>Öğrenci</th>
                          <th style={thStyle}>Eser</th>
                          <th style={thStyle}>Besteci</th>
                          <th style={thStyle}>Enstrüman</th>
                          <th style={thStyle}>Katıldı</th>
                          <th style={thStyle}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...participants].sort((a, b) => a.stage_order - b.stage_order).map((p, idx, arr) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button onClick={() => handleReorder(p.id, 'up')} disabled={idx === 0} style={arrowBtnStyle}>▲</button>
                                <span style={{ textAlign: 'center', fontWeight: 700, color: '#C9A84C' }}>{p.stage_order}</span>
                                <button onClick={() => handleReorder(p.id, 'down')} disabled={idx === arr.length - 1} style={arrowBtnStyle}>▼</button>
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 600 }}>{p.student_name}</div>
                              {p.parent_name && <div style={{ fontSize: '11px', color: '#888' }}>{p.parent_name}</div>}
                            </td>
                            <td style={{ ...tdStyle, fontStyle: p.piece_title ? 'italic' : 'normal', color: p.piece_title ? '#222' : '#bbb' }}>
                              {p.piece_title ?? '—'}
                            </td>
                            <td style={{ ...tdStyle, color: '#666' }}>{p.piece_composer ?? '—'}</td>
                            <td style={tdStyle}>
                              {p.instrument_color ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: '#fff',
                                  backgroundColor: p.instrument_color
                                }}>
                                  {p.instrument_name}
                                </span>
                              ) : (p.instrument_name ?? '—')}
                            </td>
                            <td style={tdStyle}>
                              {selectedEvent.status === 'completed' ? (
                                <input type="checkbox" checked={!!p.is_attended}
                                  onChange={e => handleMarkAttended(p.id, e.target.checked ? 1 : 0)} />
                              ) : <span style={{ color: '#ccc', fontSize: '11px' }}>—</span>}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => {
                                  const student = students.find(s => s.id === p.student_id)
                                  if (student) { setPrintInvitationParticipant(p); setTimeout(() => printInvitation(), 100) }
                                }} style={microBtnStyle}>Davetiye</button>
                                <button onClick={() => handleRemoveParticipant(p.id)} style={{ ...microBtnStyle, color: '#dc2626' }}>Çıkar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ─ REHEARSALS ─ */}
              {!loadingModal && modalTab === 'rehearsals' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button onClick={() => setShowAddRehearsal(v => !v)} style={primaryBtnStyle}>+ Prova Ekle</button>
                  </div>

                  {showAddRehearsal && (
                    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#f9fafb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={labelStyle}>Tarih *</label>
                          <input type="date" value={String(rehearsalForm.rehearsal_date ?? '')}
                            onChange={e => setRehearsalForm(p => ({ ...p, rehearsal_date: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Başlangıç</label>
                          <input type="time" value={String(rehearsalForm.start_time ?? '')}
                            onChange={e => setRehearsalForm(p => ({ ...p, start_time: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Bitiş</label>
                          <input type="time" value={String(rehearsalForm.end_time ?? '')}
                            onChange={e => setRehearsalForm(p => ({ ...p, end_time: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={labelStyle}>Mekan</label>
                          <input value={String(rehearsalForm.venue ?? '')}
                            onChange={e => setRehearsalForm(p => ({ ...p, venue: e.target.value }))}
                            style={inputStyle} placeholder="Prova salonu" />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                          <label style={labelStyle}>Notlar</label>
                          <input value={String(rehearsalForm.notes ?? '')}
                            onChange={e => setRehearsalForm(p => ({ ...p, notes: e.target.value }))}
                            style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowAddRehearsal(false); setRehearsalForm({}) }} style={cancelBtnStyle}>İptal</button>
                        <button onClick={handleAddRehearsal} style={primaryBtnStyle}>Ekle</button>
                      </div>
                    </div>
                  )}

                  {rehearsals.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Henüz prova eklenmemiş.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {rehearsals.map(r => (
                        <div key={r.id} style={{ padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '80px', textAlign: 'center', padding: '8px', backgroundColor: '#EEF2FF', borderRadius: '6px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1B3A6B' }}>
                              {new Date(r.rehearsal_date).getDate()}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                              {MONTHS[new Date(r.rehearsal_date).getMonth()]}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#222' }}>
                              {r.start_time && `${r.start_time}${r.end_time ? ` – ${r.end_time}` : ''}`}
                            </div>
                            {r.venue && <div style={{ fontSize: '12px', color: '#888' }}>📍 {r.venue}</div>}
                            {r.notes && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{r.notes}</div>}
                          </div>
                          <button onClick={() => handleDeleteRehearsal(r.id)} style={{ ...microBtnStyle, color: '#dc2626' }}>Sil</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─ CHECKLIST ─ */}
              {!loadingModal && modalTab === 'checklist' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input value={checklistInput} onChange={e => setChecklistInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCheck()}
                      placeholder="Yeni madde ekle (Enter)" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={handleAddCheck} style={primaryBtnStyle}>Ekle</button>
                  </div>

                  {checklist.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Kontrol listesi boş.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Progress bar */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                          <span>İlerleme</span>
                          <span>{checklist.filter(c => c.is_done).length} / {checklist.length}</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px', backgroundColor: '#059669', transition: 'width 0.3s',
                            width: `${checklist.length ? (checklist.filter(c => c.is_done).length / checklist.length) * 100 : 0}%`
                          }} />
                        </div>
                      </div>
                      {checklist.map(c => (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                          border: '1px solid #e5e7eb', borderRadius: '8px',
                          backgroundColor: c.is_done ? '#f0fdf4' : '#fff',
                          opacity: c.is_done ? 0.75 : 1
                        }}>
                          <input type="checkbox" checked={!!c.is_done} onChange={() => handleToggleCheck(c.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                          <span style={{ flex: 1, textDecoration: c.is_done ? 'line-through' : 'none', color: c.is_done ? '#888' : '#222' }}>
                            {c.title}
                          </span>
                          {c.due_date && <span style={{ fontSize: '11px', color: '#888' }}>📅 {c.due_date}</span>}
                          {c.assigned_to && <span style={{ fontSize: '11px', color: '#888' }}>👤 {c.assigned_to}</span>}
                          <button onClick={() => handleDeleteCheck(c.id)} style={{ ...microBtnStyle, color: '#dc2626' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─ PHOTOS ─ */}
              {!loadingModal && modalTab === 'photos' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button onClick={handleUploadPhotos} style={primaryBtnStyle}>+ Fotoğraf Yükle</button>
                  </div>
                  {photos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: '60px' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                      <div>Henüz fotoğraf yüklenmemiş.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                      {photos.map(ph => (
                        <div key={ph.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                          <img src={`file://${ph.file_path}`} alt={ph.file_name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                          <div style={{ padding: '8px', backgroundColor: '#fff' }}>
                            <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ph.file_name}
                            </div>
                          </div>
                          <button onClick={() => handleDeletePhoto(ph.id)} style={{
                            position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px',
                            borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
                            cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─── HIDDEN PRINT COMPONENTS ────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {selectedEvent && (
          <EventProgram ref={programRef} event={selectedEvent} participants={participants}
            schoolName={String(settings.school_name ?? 'Lirik Sanat Evi')} />
        )}
        {selectedEvent && printInvitationParticipant && (
          <EventInvitation ref={invitationRef} event={selectedEvent} participant={printInvitationParticipant}
            schoolName={String(settings.school_name ?? 'Lirik Sanat Evi')}
            schoolPhone={String(settings.school_phone ?? '')}
            invitationHeader={invitationHeader || undefined}
            invitationFooter={invitationFooter || undefined} />
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function EventFormFields({ form, onChange }: { form: Partial<Event>; onChange: (f: Partial<Event>) => void }) {
  const set = (key: keyof Event, val: unknown) => onChange({ ...form, [key]: val })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={labelStyle}>Etkinlik Adı *</label>
        <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder="Yıl Sonu Konseri" />
      </div>
      <div>
        <label style={labelStyle}>Tür</label>
        <select value={form.event_type ?? 'concert'} onChange={e => set('event_type', e.target.value)} style={inputStyle}>
          {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Durum</label>
        <select value={form.status ?? 'planning'} onChange={e => set('status', e.target.value)} style={inputStyle}>
          {Object.entries(EVENT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Tarih *</label>
        <input type="date" value={form.event_date ?? ''} onChange={e => set('event_date', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Mekan</label>
        <input value={form.venue ?? ''} onChange={e => set('venue', e.target.value)} style={inputStyle} placeholder="Salon adı" />
      </div>
      <div>
        <label style={labelStyle}>Başlangıç Saati</label>
        <input type="time" value={form.start_time ?? ''} onChange={e => set('start_time', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Bitiş Saati</label>
        <input type="time" value={form.end_time ?? ''} onChange={e => set('end_time', e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Kapasite</label>
        <input type="number" value={form.capacity ?? ''} onChange={e => set('capacity', Number(e.target.value))} style={inputStyle} placeholder="100" />
      </div>
      <div>
        <label style={labelStyle}>Ücret</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="checkbox" checked={!!form.is_free} onChange={e => set('is_free', e.target.checked ? 1 : 0)} />
          <span style={{ fontSize: '13px', color: '#555' }}>Ücretsiz</span>
          {!form.is_free && (
            <input type="number" value={form.ticket_price ?? ''} onChange={e => set('ticket_price', Number(e.target.value))}
              style={{ ...inputStyle, width: '100px' }} placeholder="₺" />
          )}
        </div>
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={labelStyle}>Açıklama</label>
        <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
          rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Etkinlik hakkında kısa bilgi" />
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={labelStyle}>Notlar</label>
        <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
          rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
  fontSize: '13px', backgroundColor: '#fff', cursor: 'pointer', color: '#333'
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px',
  fontSize: '13px', backgroundColor: '#fff', boxSizing: 'border-box', outline: 'none'
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px'
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px', backgroundColor: '#1B3A6B', color: '#fff',
  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 18px', backgroundColor: '#f3f4f6', color: '#555',
  border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
}

const outlineBtnStyle: React.CSSProperties = {
  padding: '6px 14px', backgroundColor: '#fff', color: '#1B3A6B',
  border: '1px solid #1B3A6B', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
}

const activeBtnStyle: React.CSSProperties = {
  padding: '6px 14px', backgroundColor: '#C9A84C', color: '#fff',
  border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
}

const closeBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '50%', border: 'none',
  backgroundColor: '#f3f4f6', cursor: 'pointer', fontSize: '16px', color: '#555'
}

const microBtnStyle: React.CSSProperties = {
  padding: '3px 10px', fontSize: '11px', border: '1px solid #e5e7eb',
  borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', color: '#555'
}

const navBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #e5e7eb',
  backgroundColor: '#fff', cursor: 'pointer', fontSize: '18px', color: '#555'
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden',
  backgroundColor: '#fff', cursor: 'pointer', transition: 'box-shadow 0.2s',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: '12px',
  fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px'
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: '13px', verticalAlign: 'middle'
}

const arrowBtnStyle: React.CSSProperties = {
  width: '20px', height: '20px', border: '1px solid #e5e7eb', borderRadius: '4px',
  backgroundColor: '#fff', cursor: 'pointer', fontSize: '10px', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 0
}
