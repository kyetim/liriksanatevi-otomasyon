interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Global Arama' },
  { keys: ['Ctrl', 'N'], label: 'Yeni Öğrenci' },
  { keys: ['Ctrl', 'P'], label: 'Ödeme Al' },
  { keys: ['Ctrl', 'F'], label: 'Sayfada Ara / Odaklan' },
  { keys: ['Ctrl', '?'], label: 'Kısayolları Göster' },
  { keys: ['Escape'], label: 'Modal / Arama Kapat' },
  { keys: ['↑', '↓'], label: 'Arama Sonuçlarında Gezin' },
  { keys: ['Enter'], label: 'Seçili Öğeyi Aç' },
]

const NAV_SHORTCUTS = [
  { keys: ['Alt', '1'], label: 'Ana Panel' },
  { keys: ['Alt', '2'], label: 'Öğrenciler' },
  { keys: ['Alt', '3'], label: 'Öğretmenler' },
  { keys: ['Alt', '4'], label: 'Ödemeler' },
  { keys: ['Alt', '5'], label: 'Dersler' },
]

function KbdGroup({ keys }: { keys: string[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {keys.map((k, i) => (
        <span key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <kbd style={{
            padding: '3px 8px', borderRadius: '6px', fontSize: '12px',
            background: '#f3f4f6', border: '1px solid #d1d5db',
            color: '#374151', fontFamily: 'inherit', fontWeight: 600
          }}>{k}</kbd>
          {i < keys.length - 1 && <span style={{ color: '#9ca3af', fontSize: '12px' }}>+</span>}
        </span>
      ))}
    </div>
  )
}

export default function ShortcutsModal({ open, onClose }: Props): JSX.Element | null {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', fontFamily: 'Inter, sans-serif'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '520px', borderRadius: '16px',
        background: 'var(--dm-surface, #fff)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: '1px solid var(--dm-border, #e5e7eb)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--dm-border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--dm-text, #1B3A6B)' }}>Klavye Kısayolları</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>Verimli çalışmak için kısayolları kullanın</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* General */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Genel</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SHORTCUTS.map(({ keys, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: '14px', color: 'var(--dm-text, #374151)' }}>{label}</span>
                  <KbdGroup keys={keys} />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sayfa Geçişi</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {NAV_SHORTCUTS.map(({ keys, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: '14px', color: 'var(--dm-text, #374151)' }}>{label}</span>
                  <KbdGroup keys={keys} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
