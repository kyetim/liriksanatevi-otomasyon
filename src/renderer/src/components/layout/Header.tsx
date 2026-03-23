import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import GlobalSearch from '../GlobalSearch'
import NotificationDropdown from '../NotificationDropdown'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':   'Ana Panel',
  '/students':    'Öğrenciler',
  '/teachers':    'Öğretmenler',
  '/staff':       'Personel & İnsan Kaynakları',
  '/classes':     'Dersler & Programlar',
  '/payments':    'Ödemeler',
  '/attendance':  'Ders Takibi',
  '/notifications': 'Bildirimler',
  '/messages':    'İletişim',
  '/events':      'Etkinlikler',
  '/reports':     'Raporlar',
  '/settings':    'Ayarlar',
  '/users':       'Kullanıcı Yönetimi'
}

export default function Header(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const title = PAGE_TITLES[location.pathname] ?? 'Lirik Sanat Evi'
  const now = new Date()
  const dateStr = now.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (ctrl && e.key === 'n') { e.preventDefault(); navigate('/students', { state: { openCreate: true } }) }
      if (ctrl && e.key === 'p') { e.preventDefault(); navigate('/payments', { state: { openCreate: true } }) }
      if (ctrl && (e.key === '?' || e.key === '/')) { e.preventDefault(); setShowShortcuts(s => !s) }
      // Alt + number navigation
      if (e.altKey) {
        const map: Record<string, string> = { '1': '/dashboard', '2': '/students', '3': '/teachers', '4': '/payments', '5': '/attendance' }
        if (map[e.key]) { e.preventDefault(); navigate(map[e.key]) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  // Expose showShortcuts to pass down
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setShowShortcuts(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header style={{
        height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0, gap: '16px',
        background: isDark ? 'var(--dm-surface)' : '#fff',
        borderBottom: `1px solid ${isDark ? 'var(--dm-border)' : '#e5e7eb'}`,
        transition: 'background 0.2s, border-color 0.2s'
      }}>
        {/* Left: breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: isDark ? 'var(--dm-text)' : '#1B3A6B', whiteSpace: 'nowrap' }}>
            {title}
          </h1>
          <span style={{ fontSize: '13px', color: isDark ? 'var(--dm-text-muted)' : '#9ca3af', display: 'none' }} className="hidden sm:block">
            {dateStr}
          </span>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Search bar */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Ara (Ctrl+K)"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '10px', border: `1px solid ${isDark ? 'var(--dm-border)' : '#e5e7eb'}`,
              background: isDark ? 'var(--dm-surface2)' : '#f9fafb',
              cursor: 'pointer', color: '#9ca3af', fontSize: '13px',
              transition: 'all 0.15s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span style={{ minWidth: '100px' }}>Ara...</span>
            <kbd style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', border: 'none', color: '#9ca3af' }}>
              Ctrl+K
            </kbd>
          </button>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Açık Tema' : 'Koyu Tema'}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isDark ? '#C9A84C' : '#6b7280', transition: 'all 0.15s'
            }}
          >
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>

          {/* Shortcuts help */}
          <button
            onClick={() => setShowShortcuts(s => !s)}
            title="Kısayollar (Ctrl+?)"
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isDark ? 'var(--dm-text-muted)' : '#6b7280', transition: 'all 0.15s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>

          {/* User avatar */}
          {user && (
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1B3A6B, #2a5298)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
              cursor: 'default'
            }} title={`${user.name} (${user.role})`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* Global Search overlay */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Shortcuts modal (lazy import via state) */}
      {showShortcuts && (
        <ShortcutsInline onClose={() => setShowShortcuts(false)} />
      )}
    </>
  )
}

// ─── Inline shortcuts modal ────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Global Arama' },
  { keys: ['Ctrl', 'N'], label: 'Yeni Öğrenci' },
  { keys: ['Ctrl', 'P'], label: 'Ödeme Al' },
  { keys: ['Ctrl', '?'], label: 'Bu Listeyi Göster/Gizle' },
  { keys: ['Escape'], label: 'Modal / Arama Kapat' },
  { keys: ['↑', '↓'], label: 'Arama Sonuçlarında Gezin' },
  { keys: ['Alt', '1–5'], label: 'Sayfa Geçişi' },
]

function ShortcutsInline({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Inter, sans-serif' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: '440px', borderRadius: '16px', background: 'var(--dm-surface, #fff)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--dm-border, #e5e7eb)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--dm-border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--dm-text, #1B3A6B)' }}>Klavye Kısayolları</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '20px' }}>×</button>
        </div>
        <div style={{ padding: '16px 24px 20px' }}>
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--dm-border, #f3f4f6)' }}>
              <span style={{ fontSize: '14px', color: 'var(--dm-text, #374151)' }}>{label}</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {keys.map((k, i) => (
                  <span key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <kbd style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '12px', background: '#f3f4f6', border: '1px solid #d1d5db', color: '#374151', fontWeight: 600 }}>{k}</kbd>
                    {i < keys.length - 1 && <span style={{ color: '#9ca3af', fontSize: '11px' }}>+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
