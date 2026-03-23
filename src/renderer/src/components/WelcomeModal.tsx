import { useState } from 'react'

const STEPS = [
  {
    icon: '🎵',
    title: 'Lirik Sanat Evi\'ne Hoşgeldiniz!',
    desc: 'Bu sistem müzik okulunuzun tüm süreçlerini yönetmenizi sağlar. Birkaç adımda temel özellikleri tanıyalım.'
  },
  {
    icon: '👨‍🎓',
    title: 'Öğrenci Yönetimi',
    desc: 'Öğrenciler sayfasında kayıt açabilir, ders programı oluşturabilir, devamsızlık takibi yapabilir ve veli iletişimini yönetebilirsiniz.'
  },
  {
    icon: '💳',
    title: 'Ödeme Takibi',
    desc: 'Ödemeler sayfasında aylık ücretleri takip edebilir, makbuz oluşturabilir ve gecikme uyarıları gönderebilirsiniz.'
  },
  {
    icon: '📊',
    title: 'Raporlar & Analiz',
    desc: 'Raporlar sayfasından gelir analizi, öğrenci istatistikleri ve öğretmen performans raporlarını görüntüleyip dışa aktarabilirsiniz.'
  },
  {
    icon: '⌨️',
    title: 'Klavye Kısayolları',
    desc: 'Ctrl+K ile hızlı arama, Ctrl+N ile yeni öğrenci, Ctrl+? ile kısayollar listesi açabilirsiniz. Verimli çalışmak için kısayolları kullanın!'
  }
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function WelcomeModal({ open, onClose }: Props): JSX.Element | null {
  const [step, setStep] = useState(0)

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const handleClose = () => {
    localStorage.setItem('lirik_welcomed', '1')
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10002,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: '100%', maxWidth: '460px', borderRadius: '20px',
        background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden', textAlign: 'center'
      }}>
        {/* Top accent bar */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #1B3A6B, #C9A84C)' }} />

        <div style={{ padding: '40px 36px 32px' }}>
          {/* Step icon */}
          <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>{current.icon}</div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '20px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? '24px' : '8px', height: '8px', borderRadius: '4px',
                background: i === step ? '#1B3A6B' : i < step ? '#C9A84C' : '#e5e7eb',
                transition: 'all 0.3s'
              }} />
            ))}
          </div>

          <h2 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 700, color: '#1B3A6B', lineHeight: 1.3 }}>
            {current.title}
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#6b7280', lineHeight: 1.6 }}>
            {current.desc}
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #e5e7eb',
                background: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151'
              }}>
                Geri
              </button>
            )}
            <button
              onClick={() => isLast ? handleClose() : setStep(s => s + 1)}
              style={{
                flex: 2, padding: '11px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #1B3A6B, #2a5298)',
                color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              {isLast ? 'Başla!' : 'İleri'}
            </button>
          </div>

          {!isLast && (
            <button onClick={handleClose} style={{
              marginTop: '14px', background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '13px', textDecoration: 'underline'
            }}>
              Atla
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
