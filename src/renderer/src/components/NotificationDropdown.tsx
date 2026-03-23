import { useState, useEffect, useRef } from 'react'
import type { Notification } from '../types'

const TYPE_ICONS: Record<string, JSX.Element> = {
  payment_due: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  lesson_reminder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
    </svg>
  ),
  birthday: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  other: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

const TYPE_COLORS: Record<string, string> = {
  payment_due: '#f59e0b',
  lesson_reminder: '#3b82f6',
  birthday: '#ec4899',
  other: '#6b7280'
}

const TYPE_LABELS: Record<string, string> = {
  payment_due: 'Ödeme',
  lesson_reminder: 'Ders',
  birthday: 'Doğum Günü',
  other: 'Sistem'
}

type FilterTab = 'all' | 'payment_due' | 'lesson_reminder' | 'birthday' | 'other'

export default function NotificationDropdown(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const data = await window.api.notifications.getUnread()
    setNotifications(data as Notification[])
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter)

  const markRead = async (id: number) => {
    await window.api.notifications.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
  }

  const markAllRead = async () => {
    await window.api.notifications.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
  }

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Az önce'
    if (mins < 60) return `${mins}dk önce`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}s önce`
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', width: '36px', height: '36px', borderRadius: '10px',
          border: 'none', background: open ? 'rgba(27,58,107,0.08)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b7280', transition: 'all 0.15s'
        }}
        title="Bildirimler"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', lineHeight: 1
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000,
          width: '380px', maxHeight: '520px',
          background: 'var(--dm-surface, #fff)',
          borderRadius: '14px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--dm-border, #e5e7eb)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif', overflow: 'hidden',
          animation: 'slideDown 0.15s ease-out'
        }}>
          {/* Header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--dm-border, #f3f4f6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--dm-text, #111)' }}>
                Bildirimler
                {unreadCount > 0 && (
                  <span style={{ marginLeft: '8px', padding: '2px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: '#ef4444', color: '#fff' }}>
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#1B3A6B', fontWeight: 500, textDecoration: 'underline', padding: 0 }}>
                  Tümünü okundu işaretle
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
              {(['all', 'payment_due', 'lesson_reminder', 'birthday', 'other'] as FilterTab[]).map(t => {
                const count = t === 'all' ? notifications.length : notifications.filter(n => n.type === t).length
                return (
                  <button key={t} onClick={() => setFilter(t)} style={{
                    padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
                    background: filter === t ? '#1B3A6B' : 'rgba(0,0,0,0.04)',
                    color: filter === t ? '#fff' : 'var(--dm-text-muted, #6b7280)',
                    transition: 'all 0.15s'
                  }}>
                    {t === 'all' ? 'Tümü' : TYPE_LABELS[t]}
                    {count > 0 && <span style={{ marginLeft: '4px', opacity: 0.8 }}>({count})</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Bildirim yok
              </div>
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markRead(n.id) }}
                  style={{
                    display: 'flex', gap: '12px', padding: '12px 16px',
                    borderBottom: '1px solid var(--dm-border, #f9fafb)',
                    background: n.is_read ? 'transparent' : 'rgba(27,58,107,0.04)',
                    cursor: n.is_read ? 'default' : 'pointer',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: TYPE_COLORS[n.type] + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: TYPE_COLORS[n.type], marginTop: '2px'
                  }}>
                    {TYPE_ICONS[n.type] ?? TYPE_ICONS.other}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: n.is_read ? 400 : 600, color: 'var(--dm-text, #111)', lineHeight: 1.4, marginBottom: '2px' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n.message}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatTime(n.created_at)}</span>
                      <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 500, background: TYPE_COLORS[n.type] + '15', color: TYPE_COLORS[n.type] }}>
                        {TYPE_LABELS[n.type]}
                      </span>
                      {!n.is_read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1B3A6B', flexShrink: 0 }} />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
