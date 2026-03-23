import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_LOCK_MINUTES = 30

export default function ScreenLock({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, logout } = useAuth()
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockMinutes = DEFAULT_LOCK_MINUTES

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!user) return
    timerRef.current = setTimeout(() => {
      setLocked(true)
      setPassword('')
      setError('')
    }, lockMinutes * 60 * 1000)
  }, [user, lockMinutes])

  // Kullanıcı etkinliğinde timer'ı sıfırla
  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(ev => document.removeEventListener(ev, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, resetTimer])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !password) return
    setVerifying(true)
    setError('')
    try {
      // Login ile şifreyi doğrula — email + girilen şifre
      const result = await window.api.auth.login(user.email, password, false)
      if (result.success) {
        setLocked(false)
        setPassword('')
        resetTimer()
        // Yeni token saklamaya gerek yok — sadece kilit kaldır
      } else {
        setError('Şifre hatalı.')
      }
    } catch {
      setError('Doğrulama başarısız.')
    }
    setVerifying(false)
  }

  if (!locked || !user) return <>{children}</>

  return (
    <>
      {children}
      {/* Lock overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,30,61,0.96)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '100%', maxWidth: '380px', padding: '48px 40px',
          background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)', textAlign: 'center'
        }}>
          {/* Lock icon */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(201,168,76,0.15)', border: '2px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
            Ekran Kilitli
          </h2>
          <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            {user.name}
          </p>
          <p style={{ margin: '0 0 28px', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            {lockMinutes} dakika hareketsizlik sonrası kilitlendi
          </p>

          <form onSubmit={handleUnlock}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px',
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', textAlign: 'center'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword
                    ? <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></>
                    : <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>

            {error && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#fca5a5' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={verifying || !password}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: verifying || !password ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C, #e8c86a)',
                color: '#1B3A6B', fontSize: '14px', fontWeight: 700,
                cursor: verifying || !password ? 'not-allowed' : 'pointer',
                marginBottom: '12px'
              }}
            >
              {verifying ? 'Doğrulanıyor...' : 'Kilidi Aç'}
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'underline'
              }}
            >
              Farklı kullanıcıyla giriş yap
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
