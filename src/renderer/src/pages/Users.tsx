import { useState, useEffect } from 'react'
import type { AppUser, UserRole } from '../types'
import { useAuth } from '../contexts/AuthContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Yönetici',
  secretary: 'Sekreter',
  teacher: 'Öğretmen',
  accountant: 'Muhasebeci'
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#C9A84C',
  secretary: '#3b82f6',
  teacher: '#10b981',
  accountant: '#8b5cf6'
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
}

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B3A6B, #2a5298)', color: '#fff',
  border: 'none', borderRadius: '8px', padding: '9px 18px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px',
  fontFamily: 'Inter, sans-serif', outline: 'none'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserForm {
  name: string; email: string; password: string; role: UserRole
  is_active: number; teacher_id: string
}

const emptyForm = (): UserForm => ({
  name: '', email: '', password: '', role: 'secretary', is_active: 1, teacher_id: ''
})

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Users(): JSX.Element {
  const { user: currentUser, changePassword } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'my_password'>('users')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  // Change own password
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loadUsers = async () => {
    setLoading(true)
    const data = await window.api.users.getAll()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const openCreate = () => {
    setEditUser(null)
    setForm(emptyForm())
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (u: AppUser) => {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active, teacher_id: String(u.teacher_id ?? '') })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setFormError('Ad ve e-posta zorunludur.'); return }
    if (!editUser && !form.password) { setFormError('Yeni kullanıcı için şifre zorunludur.'); return }
    setSaving(true)
    setFormError('')
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), email: form.email.trim(), role: form.role,
        is_active: form.is_active, teacher_id: form.teacher_id ? Number(form.teacher_id) : null
      }
      if (!editUser) {
        payload.password = form.password
        await window.api.users.create(payload as Parameters<typeof window.api.users.create>[0])
        showToast('Kullanıcı oluşturuldu.')
      } else {
        await window.api.users.update(editUser.id, payload)
        showToast('Kullanıcı güncellendi.')
      }
      setShowModal(false)
      loadUsers()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız.')
    }
    setSaving(false)
  }

  const handleDelete = async (u: AppUser) => {
    if (u.id === currentUser?.id) { showToast('Kendi hesabınızı silemezsiniz.'); return }
    if (!confirm(`"${u.name}" silinsin mi? Bu işlem geri alınamaz.`)) return
    await window.api.users.delete(u.id)
    showToast('Kullanıcı silindi.')
    loadUsers()
  }

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPw.trim()) return
    if (resetPw.length < 6) { setResetMsg('Şifre en az 6 karakter olmalı.'); return }
    await window.api.users.resetPassword(resetTarget.id, resetPw)
    setResetTarget(null)
    setResetPw('')
    setResetMsg('')
    showToast('Şifre sıfırlandı.')
  }

  const handleChangeOwnPassword = async () => {
    setPwMsg('')
    if (!oldPw || !newPw || !newPw2) { setPwMsg('Tüm alanları doldurun.'); return }
    if (newPw !== newPw2) { setPwMsg('Yeni şifreler eşleşmiyor.'); return }
    if (newPw.length < 6) { setPwMsg('Yeni şifre en az 6 karakter olmalı.'); return }
    const res = await changePassword(oldPw, newPw)
    if (res.success) {
      setOldPw(''); setNewPw(''); setNewPw2('')
      setPwMsg('✓ Şifre başarıyla değiştirildi.')
    } else {
      setPwMsg(res.error ?? 'Şifre değiştirilemedi.')
    }
  }

  const formatDate = (d?: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', maxWidth: '1100px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: '#1B3A6B', color: '#fff', padding: '12px 20px',
          borderRadius: '10px', fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          borderLeft: '4px solid #C9A84C'
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1B3A6B' }}>Kullanıcı Yönetimi</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>Sistem kullanıcıları ve rol yönetimi</p>
        </div>
        {currentUser?.role === 'admin' && (
          <button onClick={openCreate} style={primaryBtn}>+ Yeni Kullanıcı</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f3f4f6', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {(['users', 'my_password'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            background: tab === t ? '#fff' : 'transparent',
            color: tab === t ? '#1B3A6B' : '#6b7280',
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s'
          }}>
            {t === 'users' ? 'Kullanıcılar' : 'Şifremi Değiştir'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div style={card}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>Yükleniyor...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Ad Soyad', 'E-posta', 'Rol', 'Durum', 'Son Giriş', 'İşlem'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: ROLE_COLORS[u.role] + '20',
                          border: `2px solid ${ROLE_COLORS[u.role]}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 700, color: ROLE_COLORS[u.role], flexShrink: 0
                        }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111' }}>{u.name}</div>
                          {u.id === currentUser?.id && <div style={{ fontSize: '11px', color: '#9ca3af' }}>Siz</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#374151' }}>{u.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                        background: ROLE_COLORS[u.role] + '15', color: ROLE_COLORS[u.role],
                        border: `1px solid ${ROLE_COLORS[u.role]}30`
                      }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                        background: u.is_active ? '#dcfce7' : '#f3f4f6',
                        color: u.is_active ? '#16a34a' : '#6b7280'
                      }}>
                        {u.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>{formatDate(u.last_login)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {currentUser?.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(u)} style={{
                            padding: '5px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
                            background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#374151'
                          }}>Düzenle</button>
                          <button onClick={() => { setResetTarget(u); setResetPw(''); setResetMsg('') }} style={{
                            padding: '5px 10px', borderRadius: '6px', border: '1px solid #fbbf24',
                            background: '#fffbeb', fontSize: '12px', cursor: 'pointer', color: '#92400e'
                          }}>Şifre</button>
                          {u.id !== currentUser?.id && (
                            <button onClick={() => handleDelete(u)} style={{
                              padding: '5px 10px', borderRadius: '6px', border: '1px solid #fecaca',
                              background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626'
                            }}>Sil</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Change Password Tab */}
      {tab === 'my_password' && (
        <div style={{ ...card, padding: '32px', maxWidth: '480px' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: '#1B3A6B' }}>Şifremi Değiştir</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Mevcut Şifre</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Yeni Şifre</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} placeholder="En az 6 karakter" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Yeni Şifre (Tekrar)</label>
              <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={inputStyle} />
            </div>
            {pwMsg && (
              <p style={{ margin: 0, fontSize: '13px', color: pwMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{pwMsg}</p>
            )}
            <button onClick={handleChangeOwnPassword} style={{ ...primaryBtn, width: '100%', padding: '11px' }}>
              Şifreyi Değiştir
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ ...card, width: '100%', maxWidth: '480px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1B3A6B' }}>
                {editUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Ad Soyad *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>E-posta *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              {!editUser && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Şifre *</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} placeholder="En az 6 karakter" />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Durum</label>
                <select value={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: Number(e.target.value) }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value={1}>Aktif</option>
                  <option value={0}>Pasif</option>
                </select>
              </div>

              {formError && (
                <p style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>{formError}</p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={() => setShowModal(false)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db',
                  background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500
                }}>İptal</button>
                <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, flex: 1, padding: '10px', fontSize: '14px' }}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={e => { if (e.target === e.currentTarget) setResetTarget(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: '400px', padding: '32px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#1B3A6B' }}>Şifre Sıfırla</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280' }}>{resetTarget.name}</p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Yeni Şifre</label>
              <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} placeholder="En az 6 karakter" />
            </div>
            {resetMsg && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#dc2626' }}>{resetMsg}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setResetTarget(null)} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db',
                background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500
              }}>İptal</button>
              <button onClick={handleResetPassword} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                background: '#f59e0b', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
              }}>Sıfırla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
