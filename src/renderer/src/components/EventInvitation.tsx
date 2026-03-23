import { forwardRef } from 'react'
import type { Event, EventParticipant } from '../types'

interface EventInvitationProps {
  event: Event
  participant: EventParticipant
  schoolName?: string
  schoolPhone?: string
  invitationHeader?: string
  invitationFooter?: string
}

const EventInvitation = forwardRef<HTMLDivElement, EventInvitationProps>(function EventInvitation(
  {
    event,
    participant,
    schoolName = 'Lirik Sanat Evi',
    schoolPhone = '',
    invitationHeader,
    invitationFooter
  },
  ref
) {
  const eventTypeLabel: Record<string, string> = {
    concert: 'Konser', recital: 'Resital', workshop: 'Atölye',
    gala: 'Gala', summer_school: 'Yaz Okulu', other: 'Etkinlik'
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  }

  const defaultHeader = invitationHeader ??
    `Sayın ${participant.parent_name ?? 'Veli'},\n\n${schoolName} olarak düzenlediğimiz etkinliğe sizi davet etmekten büyük mutluluk duyuyoruz.`

  const defaultFooter = invitationFooter ??
    `Katılımınız bizler için büyük bir onur olacaktır. Saygılarımızla,\n${schoolName}${schoolPhone ? `\nTel: ${schoolPhone}` : ''}`

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '148mm',
        padding: '18mm 20mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '12px',
        color: '#1a1a1a',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {/* Decorative border */}
      <div style={{
        position: 'absolute', top: '8mm', left: '8mm', right: '8mm', bottom: '8mm',
        border: '2px solid #C9A84C', pointerEvents: 'none'
      }} />

      {/* School name */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: '#888', letterSpacing: '3px', textTransform: 'uppercase' }}>
          {schoolName}
        </div>
        <div style={{ marginTop: '6px', height: '1px', background: 'linear-gradient(to right, transparent, #C9A84C, transparent)' }} />
      </div>

      {/* Davetiye başlığı */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '32px', color: '#1B3A6B', fontWeight: 'bold', letterSpacing: '4px', textTransform: 'uppercase' }}>
          DAVETİYE
        </div>
      </div>

      {/* Body text */}
      <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#333', marginBottom: '20px', whiteSpace: 'pre-line' }}>
        {defaultHeader}
      </div>

      {/* Event info box */}
      <div style={{
        border: '1px solid #1B3A6B', borderRadius: '4px', padding: '16px 20px', margin: '20px 0',
        backgroundColor: '#f8f9ff'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1B3A6B', marginBottom: '8px' }}>
          {event.name}
        </div>
        <div style={{ fontSize: '12px', color: '#C9A84C', fontStyle: 'italic', marginBottom: '12px' }}>
          {eventTypeLabel[event.event_type] ?? 'Etkinlik'}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#444' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', width: '80px', color: '#888', fontWeight: 'bold' }}>Tarih</td>
              <td style={{ padding: '4px 0', fontWeight: 'bold', color: '#222' }}>{formatDate(event.event_date)}</td>
            </tr>
            {event.start_time && (
              <tr>
                <td style={{ padding: '4px 0', color: '#888', fontWeight: 'bold' }}>Saat</td>
                <td style={{ padding: '4px 0', fontWeight: 'bold', color: '#222' }}>
                  {event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}
                </td>
              </tr>
            )}
            {event.venue && (
              <tr>
                <td style={{ padding: '4px 0', color: '#888', fontWeight: 'bold' }}>Mekan</td>
                <td style={{ padding: '4px 0', fontWeight: 'bold', color: '#222' }}>{event.venue}</td>
              </tr>
            )}
            {participant.piece_title && (
              <tr>
                <td style={{ padding: '4px 0', color: '#888', fontWeight: 'bold' }}>Eser</td>
                <td style={{ padding: '4px 0', fontStyle: 'italic', color: '#222' }}>
                  {participant.piece_title}
                  {participant.piece_composer ? ` — ${participant.piece_composer}` : ''}
                </td>
              </tr>
            )}
            {participant.stage_order > 0 && (
              <tr>
                <td style={{ padding: '4px 0', color: '#888', fontWeight: 'bold' }}>Sahne Sırası</td>
                <td style={{ padding: '4px 0', color: '#222' }}>{participant.stage_order}. performans</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Student highlight */}
      <div style={{ textAlign: 'center', margin: '20px 0', padding: '12px', backgroundColor: '#fdf9f0', borderRadius: '4px' }}>
        <span style={{ fontSize: '11px', color: '#888' }}>Performans gösterecek öğrencimiz: </span>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1B3A6B' }}>{participant.student_name}</span>
        {participant.instrument_name && (
          <span style={{ fontSize: '11px', color: '#888' }}> — {participant.instrument_name}</span>
        )}
      </div>

      {/* Footer text */}
      <div style={{ fontSize: '11px', lineHeight: '1.7', color: '#555', marginTop: '16px', whiteSpace: 'pre-line' }}>
        {defaultFooter}
      </div>

      {/* Bottom decoration */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <span style={{ color: '#C9A84C', fontSize: '14px', letterSpacing: '4px' }}>✦ ✦ ✦</span>
      </div>
    </div>
  )
})

export default EventInvitation
