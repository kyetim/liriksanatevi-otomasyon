import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
// SVG icon helpers (inline — no lucide-react dependency)
const SpinnerIcon = () => (
  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
)
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [smsTestLoading, setSmsTestLoading] = useState(false)
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    window.api.settings.getAll().then((s) => {
      setSettings(s as Record<string, string>)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    for (const [key, value] of Object.entries(settings)) {
      await window.api.settings.set(key, value)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (key: string, value: string) =>
    setSettings(s => ({ ...s, [key]: value }))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-xl space-y-6">
      {/* Akademi Bilgileri */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </span>
          Akademi Bilgileri
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Akademi Adı</label>
            <input
              className="input"
              value={settings.academy_name || ''}
              onChange={e => set('academy_name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Telefon</label>
              <input
                className="input"
                value={settings.academy_phone || ''}
                onChange={e => set('academy_phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">E-posta</label>
              <input
                className="input"
                type="email"
                value={settings.academy_email || ''}
                onChange={e => set('academy_email', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Adres</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={settings.academy_address || ''}
              onChange={e => set('academy_address', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Web Sitesi</label>
              <input className="input" value={settings.academy_website || ''} onChange={e => set('academy_website', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Para Birimi Sembolü</label>
              <input className="input" value={settings.currency_symbol || '₺'} onChange={e => set('currency_symbol', e.target.value)} placeholder="₺" />
            </div>
          </div>
          {/* Logo Upload */}
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-2">Akademi Logosu</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {settings.academy_logo_path ? (
                <img
                  src={`file://${settings.academy_logo_path}`}
                  alt="Logo"
                  style={{ height: '52px', maxWidth: '120px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', padding: '4px' }}
                />
              ) : (
                <div style={{ width: '52px', height: '52px', borderRadius: '8px', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
              )}
              <button
                type="button"
                onClick={async () => {
                  const p = await window.api.logo.upload()
                  if (p) set('academy_logo_path', p)
                }}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
              >
                {settings.academy_logo_path ? 'Değiştir' : 'Logo Yükle'}
              </button>
              {settings.academy_logo_path && (
                <button type="button" onClick={() => set('academy_logo_path', '')} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '13px', cursor: 'pointer', color: '#dc2626' }}>
                  Kaldır
                </button>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9ca3af' }}>Makbuz, sertifika ve raporlarda görünür. PNG, JPG, SVG desteklenir.</p>
          </div>
        </div>
      </motion.div>

      {/* Çalışma Saatleri & Finansal Ayarlar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-accent-100 rounded-md flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </span>
          Çalışma Saatleri & Finansal Ayarlar
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Açılış Saati</label>
              <input type="time" className="input" value={settings.working_hours_start || '09:00'} onChange={e => set('working_hours_start', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Kapanış Saati</label>
              <input type="time" className="input" value={settings.working_hours_end || '21:00'} onChange={e => set('working_hours_end', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Standart Ders Ücreti (₺)</label>
              <input type="number" className="input" value={settings.default_lesson_fee || ''} onChange={e => set('default_lesson_fee', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Kardeş İndirimi (%)</label>
              <input type="number" className="input" min="0" max="100" value={settings.sibling_discount_rate || ''} onChange={e => set('sibling_discount_rate', e.target.value)} placeholder="10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Gecikme Faizi (%/ay)</label>
              <input type="number" className="input" min="0" value={settings.late_payment_interest || ''} onChange={e => set('late_payment_interest', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">KDV Oranı (%)</label>
              <input type="number" className="input" min="0" max="100" value={settings.vat_rate || ''} onChange={e => set('vat_rate', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Tatil Günleri (virgülle ay-gün, örn: 01-01,04-23)</label>
            <input className="input" value={settings.holiday_dates || ''} onChange={e => set('holiday_dates', e.target.value)} placeholder="01-01, 04-23, 05-01, 10-29" />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary-500 mb-1">Makbuz Alt Notu</label>
            <input className="input" value={settings.receipt_footer || ''} onChange={e => set('receipt_footer', e.target.value)} placeholder="Teşekkür ederiz..." />
          </div>
        </div>
      </motion.div>

      {/* Uygulama Ayarları */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          Uygulama Ayarları
        </h2>
        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1">Para Birimi</label>
          <select
            className="input w-40"
            value={settings.currency || 'TL'}
            onChange={e => set('currency', e.target.value)}
          >
            <option value="TL">₺ Türk Lirası</option>
            <option value="USD">$ Dolar</option>
            <option value="EUR">€ Euro</option>
          </select>
        </div>
      </motion.div>

      {/* SMS / Netgsm Ayarları */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </span>
          SMS / Netgsm Ayarları
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Kullanıcı Kodu (usercode)</label>
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={settings.netgsm_usercode || ''}
                onChange={e => set('netgsm_usercode', e.target.value)}
                placeholder="Netgsm kullanıcı kodu"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">Şifre (password)</label>
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={settings.netgsm_password || ''}
                onChange={e => set('netgsm_password', e.target.value)}
                placeholder="Netgsm şifresi"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-500 mb-1">SMS Başlığı — msgheader (maks. 11 karakter)</label>
              <input
                className="input"
                value={settings.netgsm_msgheader || ''}
                onChange={e => set('netgsm_msgheader', e.target.value.slice(0, 11))}
                placeholder="LirikSanat"
                maxLength={11}
              />
              <p className="text-xs text-gray-400 mt-0.5">{(settings.netgsm_msgheader || '').length}/11 karakter</p>
            </div>
            <div className="flex items-end">
              <div className="space-y-1">
                <button
                  onClick={async () => {
                    setSmsTestLoading(true)
                    setSmsTestResult(null)
                    // Save current settings first
                    await window.api.settings.set('netgsm_usercode', settings.netgsm_usercode || '')
                    await window.api.settings.set('netgsm_password', settings.netgsm_password || '')
                    await window.api.settings.set('netgsm_msgheader', settings.netgsm_msgheader || 'LirikSanat')
                    const res = await window.api.sms.testConnection()
                    setSmsTestResult({ ok: res.success, msg: res.message ?? res.error ?? '' })
                    setSmsTestLoading(false)
                  }}
                  disabled={smsTestLoading}
                  className="btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50"
                >
                  {smsTestLoading ? <SpinnerIcon /> : null}
                  Bağlantıyı Test Et
                </button>
                {smsTestResult && (
                  <p className={`text-xs flex items-center gap-1 ${smsTestResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {smsTestResult.ok ? <CheckIcon /> : <XIcon />}
                    {smsTestResult.msg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Otomatik SMS Toggleları */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Otomatik SMS Bildirimleri</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'sms_auto_payment_reminder', label: 'Ödeme Hatırlatma', desc: '3 gün öncesinden hatırlat' },
                { key: 'sms_auto_overdue',          label: 'Gecikme Bildirimi', desc: 'Vadesi geçen ödemeler için' },
                { key: 'sms_auto_birthday',         label: 'Doğum Günü',        desc: 'Öğrenci doğum günlerinde' },
                { key: 'sms_auto_absence',          label: 'Devamsızlık',       desc: 'Ders kaçırıldığında' }
              ].map((item) => {
                const isOn = settings[item.key] === 'true' || settings[item.key] === '1'
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      isOn ? 'border-[#1B3A6B]/30 bg-[#1B3A6B]/5' : 'border-gray-200 bg-white'
                    }`}
                    onClick={() => set(item.key, isOn ? 'false' : 'true')}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${isOn ? 'bg-[#1B3A6B]' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isOn ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Kaydet Butonu */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary px-6">
          Ayarları Kaydet
        </button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-emerald-600 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Kaydedildi
          </motion.span>
        )}
      </div>

      {/* Yedekleme & Geri Yükleme */}
      <BackupSection />
    </div>
  )
}

// ─── Backup Section ───────────────────────────────────────────────────────────

function BackupSection(): JSX.Element {
  const [autoFiles, setAutoFiles] = React.useState<{ filename: string; path: string; size: number; date: string }[]>([])
  const [msg, setMsg] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const loadAuto = async () => {
    const files = await window.api.backup.listAuto()
    setAutoFiles(files)
  }

  React.useEffect(() => { loadAuto() }, [])

  const handleCreate = async () => {
    setBusy(true)
    const res = await window.api.backup.create()
    if (res.success) { showMsg(`✓ Yedek oluşturuldu: ${res.filename}`); loadAuto() }
    setBusy(false)
  }

  const handleSaveAs = async () => {
    setBusy(true)
    const res = await window.api.backup.saveAs()
    if (res.success) showMsg('✓ Yedek dosyaya kaydedildi.')
    setBusy(false)
  }

  const handleRestore = async () => {
    if (!confirm('Geri yükleme, mevcut verilerin üzerine yazar ve uygulama yeniden başlatılacaktır. Devam etmek istiyor musunuz?')) return
    setBusy(true)
    const res = await window.api.backup.restore()
    if (res.success) {
      showMsg(res.message ?? 'Geri yüklendi.')
      setTimeout(() => window.location.reload(), 2000)
    }
    setBusy(false)
  }

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`
  const fmtDate = (d: string) => new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1B3A6B]/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#1B3A6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7h16M4 7l2-3h12l2 3M12 12v5M9 14l3 3 3-3" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-800">Yedekleme & Geri Yükleme</h2>
      </div>

      <div className="p-6">
        {msg && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '8px',
            background: msg.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.startsWith('✓') ? '#bbf7d0' : '#fecaca'}`,
            color: msg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: '13px'
          }}>{msg}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button
            onClick={handleCreate} disabled={busy}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: '#1B3A6B', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1
            }}
          >
            Manuel Yedek Al
          </button>
          <button
            onClick={handleSaveAs} disabled={busy}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 500,
              background: '#fff', color: '#374151', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1
            }}
          >
            Farklı Kaydet...
          </button>
          <button
            onClick={handleRestore} disabled={busy}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', fontWeight: 500,
              background: '#fef2f2', color: '#dc2626', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1
            }}
          >
            Yedekten Geri Yükle...
          </button>
        </div>

        {/* Auto Backup List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              Otomatik Yedekler ({autoFiles.length})
            </p>
            <button onClick={loadAuto} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', textDecoration: 'underline' }}>
              Yenile
            </button>
          </div>
          {autoFiles.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
              Henüz otomatik yedek yok. (Her gün saat 23:00'de alınır)
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {autoFiles.map(f => (
                <div key={f.filename} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb',
                  fontSize: '13px'
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#374151' }}>{f.filename}</div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>{fmtDate(f.date)} · {fmtSize(f.size)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
