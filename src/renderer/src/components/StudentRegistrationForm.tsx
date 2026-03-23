import { forwardRef } from 'react'
import type { Student, Enrollment } from '../types'

interface StudentRegistrationFormProps {
  student: Student
  enrollments?: Enrollment[]
  schoolName?: string
  schoolPhone?: string
  schoolAddress?: string
}

const StudentRegistrationForm = forwardRef<HTMLDivElement, StudentRegistrationFormProps>(
  function StudentRegistrationForm(
    {
      student,
      enrollments = [],
      schoolName = 'Lirik Sanat Evi',
      schoolPhone = '',
      schoolAddress = ''
    },
    ref
  ) {
    const fullName = `${student.first_name} ${student.last_name}`
    const age = student.birth_date
      ? Math.floor((Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null

    const DAYS: Record<string, string> = {
      monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba',
      thursday: 'Perşembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar'
    }

    const parseDays = (daysStr: string): string => {
      try {
        const arr: string[] = JSON.parse(daysStr)
        return arr.map(d => DAYS[d] || d).join(', ')
      } catch {
        return daysStr || ''
      }
    }

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
              {schoolAddress && <div style={{ fontSize: '10px', color: '#666' }}>{schoolAddress}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                backgroundColor: '#1B3A6B', color: '#fff',
                padding: '6px 14px', borderRadius: '4px',
                fontSize: '13px', fontWeight: 'bold'
              }}>
                ÖĞRENCİ KAYIT FORMU
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                Kayıt No: #{student.id} — {new Date(student.registration_date).toLocaleDateString('tr-TR')}
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                Basım Tarihi: {new Date().toLocaleDateString('tr-TR')}
              </div>
            </div>
          </div>
        </div>

        {/* Öğrenci Bilgileri */}
        <div style={{
          backgroundColor: '#f0f4fa', borderRadius: '6px',
          padding: '12px 14px', marginBottom: '16px',
          borderLeft: '4px solid #1B3A6B'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1B3A6B', marginBottom: '8px' }}>
            ÖĞRENCİ BİLGİLERİ
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 8px 3px 0', color: '#555', width: '30%' }}>Ad Soyad:</td>
                <td style={{ padding: '3px 0', fontWeight: 'bold' }}>{fullName}</td>
                <td style={{ padding: '3px 8px 3px 16px', color: '#555', width: '25%' }}>Doğum Tarihi:</td>
                <td style={{ padding: '3px 0' }}>
                  {student.birth_date
                    ? new Date(student.birth_date).toLocaleDateString('tr-TR')
                    : '—'}
                  {age !== null ? ` (${age} yaş)` : ''}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '3px 8px 3px 0', color: '#555' }}>Telefon:</td>
                <td style={{ padding: '3px 0' }}>{student.phone || '—'}</td>
                <td style={{ padding: '3px 8px 3px 16px', color: '#555' }}>E-posta:</td>
                <td style={{ padding: '3px 0' }}>{student.email || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 8px 3px 0', color: '#555' }}>Adres:</td>
                <td style={{ padding: '3px 0', colSpan: 3 } as React.CSSProperties}>
                  {student.address ? `${student.address}${student.city ? ', ' + student.city : ''}` : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '3px 8px 3px 0', color: '#555' }}>Durum:</td>
                <td style={{ padding: '3px 0' }}>
                  {student.status === 'active' ? 'Aktif' : student.status === 'passive' ? 'Pasif' : 'Donduruldu'}
                </td>
                <td style={{ padding: '3px 8px 3px 16px', color: '#555' }}>İndirim:</td>
                <td style={{ padding: '3px 0' }}>%{student.discount_rate || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Veli Bilgileri */}
        {(student.parent_name || student.parent_phone) && (
          <div style={{
            backgroundColor: '#fff8e7', borderRadius: '6px',
            padding: '12px 14px', marginBottom: '16px',
            borderLeft: '4px solid #C9A84C'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1B3A6B', marginBottom: '8px' }}>
              VELİ BİLGİLERİ
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 8px 3px 0', color: '#555', width: '30%' }}>Veli Adı:</td>
                  <td style={{ padding: '3px 0', fontWeight: 'bold' }}>{student.parent_name || '—'}</td>
                  <td style={{ padding: '3px 8px 3px 16px', color: '#555', width: '25%' }}>Telefon:</td>
                  <td style={{ padding: '3px 0' }}>{student.parent_phone || '—'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 8px 3px 0', color: '#555' }}>E-posta:</td>
                  <td style={{ padding: '3px 0', colSpan: 3 } as React.CSSProperties}>
                    {student.parent_email || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Ders Kayıtları */}
        {enrollments.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1B3A6B', marginBottom: '8px', paddingBottom: '4px', borderBottom: '2px solid #1B3A6B' }}>
              DERS KAYITLARI
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#1B3A6B', color: '#fff' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Enstrüman</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Öğretmen</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Tür / Süre</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Günler</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '10px' }}>Saat</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: '10px' }}>Aylık Ücret</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', fontSize: '10px' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr, i) => (
                  <tr key={enr.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 10px' }}>{enr.instrument_name || '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{enr.teacher_name || '—'}</td>
                    <td style={{ padding: '6px 10px' }}>
                      {enr.lesson_type === 'individual' ? 'Bireysel' : 'Grup'} / {enr.lesson_duration} dk
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '10px' }}>{parseDays(enr.lesson_days)}</td>
                    <td style={{ padding: '6px 10px' }}>{enr.lesson_time || '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {enr.monthly_fee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {enr.status === 'active' ? 'Aktif' : enr.status === 'paused' ? 'Durduruldu' : 'İptal'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#C9A84C' }}>
                  <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 'bold', fontSize: '12px', color: '#fff' }}>
                    TOPLAM AYLIK ÜCRET
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
                    {enrollments.filter(e => e.status === 'active').reduce((s, e) => s + e.monthly_fee, 0)
                      .toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Notlar */}
        {student.notes && (
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '16px', fontStyle: 'italic' }}>
            Not: {student.notes}
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

export default StudentRegistrationForm
