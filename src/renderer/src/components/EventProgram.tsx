import { forwardRef } from 'react'
import type { Event, EventParticipant } from '../types'

interface EventProgramProps {
  event: Event
  participants: EventParticipant[]
  schoolName?: string
}

const EventProgram = forwardRef<HTMLDivElement, EventProgramProps>(function EventProgram(
  { event, participants, schoolName = 'Lirik Sanat Evi' },
  ref
) {
  const sorted = [...participants].sort((a, b) => (a.stage_order ?? 0) - (b.stage_order ?? 0))

  const eventTypeLabel: Record<string, string> = {
    concert: 'Konser', recital: 'Resital', workshop: 'Atölye',
    gala: 'Gala', summer_school: 'Yaz Okulu', other: 'Etkinlik'
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  }

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 18mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '11px',
        color: '#1a1a1a',
        backgroundColor: '#fff',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '3px solid #1B3A6B', paddingBottom: '12px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          {schoolName}
        </div>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1B3A6B', marginBottom: '4px', letterSpacing: '1px' }}>
          {event.name}
        </div>
        <div style={{ fontSize: '14px', color: '#C9A84C', fontStyle: 'italic', marginBottom: '8px' }}>
          {eventTypeLabel[event.event_type] ?? 'Etkinlik'}
        </div>
        <div style={{ fontSize: '12px', color: '#444' }}>
          {formatDate(event.event_date)}
          {event.start_time && <span> &nbsp;|&nbsp; Saat: {event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}</span>}
        </div>
        {event.venue && (
          <div style={{ fontSize: '12px', color: '#444', marginTop: '4px' }}>
            {event.venue}
          </div>
        )}
      </div>

      {/* Decorative gold line */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span style={{ color: '#C9A84C', fontSize: '18px', letterSpacing: '6px' }}>✦ ✦ ✦</span>
      </div>

      {/* Program Title */}
      <div style={{
        textAlign: 'center', fontSize: '16px', fontWeight: 'bold',
        color: '#1B3A6B', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '24px'
      }}>
        Program
      </div>

      {/* Participants Table */}
      {sorted.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #C9A84C' }}>
              <th style={{ width: '40px', textAlign: 'center', paddingBottom: '8px', color: '#1B3A6B', fontSize: '11px' }}>
                Sıra
              </th>
              <th style={{ textAlign: 'left', paddingBottom: '8px', paddingLeft: '12px', color: '#1B3A6B', fontSize: '11px' }}>
                Öğrenci
              </th>
              <th style={{ textAlign: 'left', paddingBottom: '8px', paddingLeft: '12px', color: '#1B3A6B', fontSize: '11px' }}>
                Eser
              </th>
              <th style={{ textAlign: 'left', paddingBottom: '8px', paddingLeft: '12px', color: '#1B3A6B', fontSize: '11px' }}>
                Besteci
              </th>
              <th style={{ textAlign: 'left', paddingBottom: '8px', paddingLeft: '12px', color: '#1B3A6B', fontSize: '11px' }}>
                Enstrüman
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#fafaf8' : '#fff' }}>
                <td style={{ textAlign: 'center', padding: '10px 4px', color: '#C9A84C', fontWeight: 'bold', fontSize: '13px' }}>
                  {p.stage_order}
                </td>
                <td style={{ padding: '10px 4px 10px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                  {p.student_name}
                </td>
                <td style={{ padding: '10px 4px 10px 12px', fontStyle: 'italic', fontSize: '12px' }}>
                  {p.piece_title ?? '—'}
                </td>
                <td style={{ padding: '10px 4px 10px 12px', color: '#555', fontSize: '11px' }}>
                  {p.piece_composer ?? '—'}
                </td>
                <td style={{ padding: '10px 4px 10px 12px', color: '#555', fontSize: '11px' }}>
                  {p.instrument_name ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '40px 0' }}>
          Program henüz oluşturulmamış.
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div style={{ marginTop: '32px', padding: '16px', border: '1px solid #e8e0d0', borderRadius: '4px', backgroundColor: '#fdf9f3' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Etkinlik Hakkında
          </div>
          <div style={{ fontSize: '11px', color: '#444', lineHeight: '1.6' }}>
            {event.description}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #ddd', textAlign: 'center', color: '#888', fontSize: '10px' }}>
        <div style={{ color: '#C9A84C', fontWeight: 'bold', marginBottom: '4px' }}>{schoolName}</div>
        <div>Bu program basılı kopyadır. Tüm hakları saklıdır.</div>
      </div>
    </div>
  )
})

export default EventProgram
