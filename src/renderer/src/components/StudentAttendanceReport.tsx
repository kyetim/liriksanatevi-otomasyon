import { forwardRef } from 'react'
import type { Student, Lesson } from '../types'

interface StudentAttendanceReportProps {
  student: Student
  lessons: Lesson[]
  periodLabel?: string
  schoolName?: string
  schoolPhone?: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed:      { label: 'Tamamlandı', color: '#2e7d32' },
  cancelled:      { label: 'İptal', color: '#c62828' },
  makeup:         { label: 'Telafi', color: '#1565c0' },
  student_absent: { label: 'Öğrenci Devamsız', color: '#e65100' },
  teacher_absent: { label: 'Öğretmen Devamsız', color: '#6a1b9a' }
}

const StudentAttendanceReport = forwardRef<HTMLDivElement, StudentAttendanceReportProps>(
  function StudentAttendanceReport(
    {
      student,
      lessons,
      periodLabel = '',
      schoolName = 'Lirik Sanat Evi',
      schoolPhone = ''
    },
    ref
  ) {
    const fullName = `${student.first_name} ${student.last_name}`

    const stats = {
      total: lessons.length,
      completed: lessons.filter(l => l.status === 'completed' || l.status === 'makeup').length,
      student_absent: lessons.filter(l => l.status === 'student_absent').length,
      teacher_absent: lessons.filter(l => l.status === 'teacher_absent').length,
      cancelled: lessons.filter(l => l.status === 'cancelled').length
    }
    const attendanceRate = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0

    const sortedLessons = [...lessons].sort(
      (a, b) => new Date(a.lesson_date).getTime() - new Date(b.lesson_date).getTime()
    )

    return (
      <div
        ref={ref}
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm 15mm',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          color: '#1a1a1a',
          backgroundColor: '#fff',
          boxSizing: 'border-box',
          lineHeight: '1.5'
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '3px solid #1B3A6B', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1B3A6B', letterSpacing: '1px' }}>
                {schoolName}
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Müzik Okulu</div>
              {schoolPhone && <div style={{ fontSize: '10px', color: '#666' }}>Tel: {schoolPhone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                backgroundColor: '#1B3A6B', color: '#fff',
                padding: '6px 14px', borderRadius: '4px',
                fontSize: '13px', fontWeight: 'bold'
              }}>
                DEVAMSIZLIK RAPORU
              </div>
              {periodLabel && (
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', fontWeight: 'bold' }}>
                  {periodLabel}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                Basım: {new Date().toLocaleDateString('tr-TR')}
              </div>
            </div>
          </div>
        </div>

        {/* Öğrenci Bilgisi */}
        <div style={{
          backgroundColor: '#f0f4fa', borderRadius: '6px',
          padding: '10px 14px', marginBottom: '16px',
          borderLeft: '4px solid #C9A84C'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1B3A6B' }}>{fullName}</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>
            {student.phone && <span style={{ marginRight: '16px' }}>Tel: {student.phone}</span>}
            {student.parent_name && <span>Veli: {student.parent_name}</span>}
            {student.parent_phone && <span style={{ marginLeft: '16px' }}>{student.parent_phone}</span>}
          </div>
        </div>

        {/* Özet İstatistikler */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '16px'
        }}>
          {[
            { label: 'Toplam Ders', value: stats.total, bg: '#1B3A6B', fg: '#fff' },
            { label: 'Katıldı', value: stats.completed, bg: '#e8f5e9', fg: '#2e7d32' },
            { label: 'Devamsız', value: stats.student_absent, bg: '#fff3e0', fg: '#e65100' },
            { label: 'İptal', value: stats.cancelled + stats.teacher_absent, bg: '#fce4ec', fg: '#c62828' },
            { label: 'Devam Oranı', value: `%${attendanceRate}`, bg: attendanceRate >= 80 ? '#e8f5e9' : '#fff3e0', fg: attendanceRate >= 80 ? '#2e7d32' : '#e65100' }
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '8px 4px',
              backgroundColor: s.bg, borderRadius: '6px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: s.fg }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: s.fg, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ders Listesi */}
        {sortedLessons.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#1B3A6B', color: '#fff' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', width: '10%' }}>#</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', width: '15%' }}>Tarih</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', width: '12%' }}>Saat</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', width: '15%' }}>Öğretmen</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px', width: '18%' }}>Durum</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Konu / Not</th>
              </tr>
            </thead>
            <tbody>
              {sortedLessons.map((lesson, i) => {
                const statusInfo = STATUS_LABELS[lesson.status] || { label: lesson.status, color: '#555' }
                return (
                  <tr
                    key={lesson.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '5px 10px', color: '#888' }}>{i + 1}</td>
                    <td style={{ padding: '5px 10px' }}>
                      {new Date(lesson.lesson_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td style={{ padding: '5px 10px' }}>{lesson.start_time || '—'}</td>
                    <td style={{ padding: '5px 10px', fontSize: '10px' }}>{lesson.teacher_name || '—'}</td>
                    <td style={{ padding: '5px 10px' }}>
                      <span style={{
                        color: statusInfo.color, fontWeight: 'bold', fontSize: '10px'
                      }}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '5px 10px', fontSize: '10px', color: '#555' }}>
                      {lesson.topic_covered || lesson.teacher_notes || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            Bu dönem için ders kaydı bulunamadı.
          </div>
        )}

        {/* İmza Alanı */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: '40px', paddingTop: '16px',
          borderTop: '1px dashed #ccc'
        }}>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '6px' }} />
            <div style={{ fontSize: '10px', color: '#555' }}>Öğrenci / Veli İmzası</div>
            <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>{fullName}</div>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '6px' }} />
            <div style={{ fontSize: '10px', color: '#555' }}>Okul Yöneticisi</div>
            <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic' }}>{schoolName}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#aaa' }}>
          Bu belge {schoolName} tarafından düzenlenmiştir. — {new Date().toLocaleDateString('tr-TR')}
        </div>
      </div>
    )
  }
)

export default StudentAttendanceReport
