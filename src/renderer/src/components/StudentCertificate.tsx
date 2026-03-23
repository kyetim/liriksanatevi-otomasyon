import { forwardRef } from 'react'

export type CertificateTemplate = 'achievement' | 'participation' | 'special'

interface CertificateProps {
  studentName: string
  date: string
  title?: string
  body?: string
  signerName?: string
  template: CertificateTemplate
  academyName?: string
}

const TEMPLATE_CONFIGS: Record<CertificateTemplate, { heading: string; icon: string; borderStyle: string }> = {
  achievement: {
    heading: 'BAŞARI BELGESİ',
    icon: '🏆',
    borderStyle: 'border-8 border-double'
  },
  participation: {
    heading: 'KATILIM BELGESİ',
    icon: '🎵',
    borderStyle: 'border-4'
  },
  special: {
    heading: 'ÖZEL ÖDÜL BELGESİ',
    icon: '⭐',
    borderStyle: 'border-8 border-double'
  }
}

// forwardRef — react-to-print buna ref iletir
const StudentCertificate = forwardRef<HTMLDivElement, CertificateProps>(function StudentCertificate(
  { studentName, date, title, body, signerName, template, academyName = 'Lirik Sanat Evi' },
  ref
) {
  const config = TEMPLATE_CONFIGS[template]

  return (
    <div
      ref={ref}
      style={{ fontFamily: 'Georgia, serif' }}
      className="bg-white w-full min-h-[600px] flex flex-col items-center justify-between p-12 print:p-8"
    >
      {/* Dış bordür */}
      <div
        className={`w-full h-full absolute inset-4 pointer-events-none ${config.borderStyle} border-[#1B3A6B] opacity-20 rounded`}
        style={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16 }}
      />

      {/* Üst şerit */}
      <div className="w-full flex flex-col items-center gap-2 mb-8">
        <div
          className="w-full h-3 rounded"
          style={{ background: 'linear-gradient(90deg, #1B3A6B, #C9A84C, #1B3A6B)' }}
        />
        <div className="mt-4 text-5xl">{config.icon}</div>
        <h1
          className="text-3xl font-bold tracking-widest mt-2"
          style={{ color: '#1B3A6B', letterSpacing: '0.25em' }}
        >
          {config.heading}
        </h1>
        <p className="text-sm tracking-widest uppercase" style={{ color: '#C9A84C' }}>
          {academyName}
        </p>
      </div>

      {/* Orta içerik */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
        <p className="text-lg" style={{ color: '#444' }}>
          Bu belge aşağıdaki öğrenciye takdim edilmiştir:
        </p>

        <div
          className="border-b-2 pb-2 px-8"
          style={{ borderColor: '#C9A84C', minWidth: 320 }}
        >
          <p
            className="text-4xl font-bold"
            style={{ color: '#1B3A6B', fontFamily: 'Georgia, serif' }}
          >
            {studentName}
          </p>
        </div>

        {title && (
          <p className="text-xl font-semibold mt-2" style={{ color: '#1B3A6B' }}>
            {title}
          </p>
        )}

        {body && (
          <p className="text-base leading-relaxed max-w-lg" style={{ color: '#555', fontStyle: 'italic' }}>
            {body}
          </p>
        )}
      </div>

      {/* Alt kısım: imza + tarih */}
      <div className="w-full mt-8 flex justify-between items-end px-8">
        <div className="flex flex-col items-center gap-1">
          <div className="w-40 border-b border-gray-400" />
          <p className="text-sm text-gray-500">{signerName || 'Müzik Direktörü'}</p>
          <p className="text-xs text-gray-400">İmza</p>
        </div>

        <div
          className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: '#C9A84C' }}
        >
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: '#1B3A6B', fontSize: 8 }}>LSE</div>
            <div className="text-xs" style={{ color: '#C9A84C', fontSize: 6 }}>MÜHİR</div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-40 border-b border-gray-400" />
          <p className="text-sm text-gray-500">{date}</p>
          <p className="text-xs text-gray-400">Tarih</p>
        </div>
      </div>

      {/* Alt şerit */}
      <div
        className="w-full h-3 rounded mt-6"
        style={{ background: 'linear-gradient(90deg, #1B3A6B, #C9A84C, #1B3A6B)' }}
      />
    </div>
  )
})

export default StudentCertificate
