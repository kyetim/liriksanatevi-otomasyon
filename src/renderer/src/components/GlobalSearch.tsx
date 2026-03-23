import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  id: number
  label: string
  sub: string
  type: 'student' | 'teacher'
  path: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: Props): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Auto-focus when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const [students, teachers] = await Promise.all([
          window.api.students.search(query),
          window.api.teachers.getAll()
        ])

        const studentResults: SearchResult[] = students.slice(0, 8).map(s => ({
          id: s.id,
          label: `${s.first_name} ${s.last_name}`,
          sub: [s.phone, s.parent_phone, s.parent_name].filter(Boolean).join(' · '),
          type: 'student',
          path: '/students'
        }))

        const q = query.toLowerCase()
        const teacherResults: SearchResult[] = teachers
          .filter(t =>
            `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
            t.phone?.toLowerCase().includes(q) ||
            t.specialization?.toLowerCase().includes(q)
          )
          .slice(0, 4)
          .map(t => ({
            id: t.id,
            label: `${t.first_name} ${t.last_name}`,
            sub: [t.specialization, t.phone].filter(Boolean).join(' · '),
            type: 'teacher',
            path: '/teachers'
          }))

        setResults([...studentResults, ...teacherResults])
        setSelected(0)
      } catch { /* ignore */ }
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback((r: SearchResult) => {
    navigate(r.path, { state: { openId: r.id } })
    onClose()
  }, [navigate, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) { handleSelect(results[selected]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selected, handleSelect, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '80px'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '580px', borderRadius: '16px',
        background: 'var(--dm-surface, #fff)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid var(--dm-border, #e5e7eb)',
        overflow: 'hidden', fontFamily: 'Inter, sans-serif'
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--dm-border, #e5e7eb)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Öğrenci adı, telefon, öğretmen ara..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: '16px',
              background: 'transparent', color: 'var(--dm-text, #111)', fontFamily: 'inherit'
            }}
          />
          {loading && (
            <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#1B3A6B', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          )}
          <kbd style={{
            padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
            background: '#f3f4f6', color: '#9ca3af', border: '1px solid #d1d5db'
          }}>Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 20px', cursor: 'pointer',
                  background: i === selected ? 'rgba(27,58,107,0.07)' : 'transparent',
                  borderBottom: '1px solid var(--dm-border, #f3f4f6)'
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                  background: r.type === 'student' ? 'rgba(27,58,107,0.1)' : 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700,
                  color: r.type === 'student' ? '#1B3A6B' : '#10b981'
                }}>
                  {r.label.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dm-text, #111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.sub || (r.type === 'student' ? 'Öğrenci' : 'Öğretmen')}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                  background: r.type === 'student' ? 'rgba(27,58,107,0.08)' : 'rgba(16,185,129,0.08)',
                  color: r.type === 'student' ? '#1B3A6B' : '#10b981'
                }}>
                  {r.type === 'student' ? 'Öğrenci' : 'Öğretmen'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {query.trim() && !loading && results.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            "{query}" için sonuç bulunamadı
          </div>
        )}

        {/* Hint */}
        {!query && (
          <div style={{ padding: '20px 20px 16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { keys: '↑↓', label: 'Gezin' },
              { keys: 'Enter', label: 'Aç' },
              { keys: 'Esc', label: 'Kapat' }
            ].map(({ keys, label }) => (
              <div key={keys} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9ca3af' }}>
                <kbd style={{ padding: '2px 8px', borderRadius: '4px', background: '#f3f4f6', border: '1px solid #d1d5db', fontSize: '11px', color: '#6b7280' }}>{keys}</kbd>
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
