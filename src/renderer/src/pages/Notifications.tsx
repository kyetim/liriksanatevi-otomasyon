import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate } from '@utils/formatters'
import type { Notification } from '../types'

const typeConfig: Record<Notification['type'], { label: string; icon: JSX.Element; cls: string }> = {
  payment_due: {
    label: 'Ödeme Hatırlatma',
    cls: 'bg-amber-100 text-amber-700',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  lesson_reminder: {
    label: 'Ders Hatırlatma',
    cls: 'bg-blue-100 text-blue-700',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  birthday: {
    label: 'Doğum Günü',
    cls: 'bg-pink-100 text-pink-700',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6l3-3m0 0l3 3m-3-3v14" />
      </svg>
    )
  },
  other: {
    label: 'Genel',
    cls: 'bg-gray-100 text-gray-600',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
}

export default function Notifications(): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = async () => {
    setLoading(true)
    const data = await window.api.notifications.getUnread()
    setNotifications(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: number) => {
    await window.api.notifications.markRead(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    await window.api.notifications.markAllRead()
    setNotifications([])
    setMarkingAll(false)
  }

  const generateReminders = async () => {
    setGenerating(true)
    const result = await window.api.notifications.generatePaymentReminders()
    await load()
    setGenerating(false)
    showToast(`${result.generated} yeni ödeme hatırlatması oluşturuldu.`, result.generated > 0 ? 'success' : 'info')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
          {toast.msg}
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">
            Okunmamış Bildirimler
            {notifications.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-accent text-white text-xs rounded-full font-bold">
                {notifications.length}
              </span>
            )}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={generateReminders}
            disabled={generating}
            className="btn-outline text-xs"
          >
            {generating ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                Oluşturuluyor...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Ödeme Hatırlatmaları
              </span>
            )}
          </button>
          {notifications.length > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="btn-primary text-xs"
            >
              Tümünü Okundu İşaretle
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-primary">Okunmamış bildirim yok</p>
          <p className="text-sm text-primary-400 mt-1">Tüm bildirimler okundu.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <AnimatePresence>
            {notifications.map((n, i) => {
              const config = typeConfig[n.type]
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="card flex items-start gap-4"
                >
                  {/* Type Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.cls}`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.cls}`}>
                        {config.label}
                      </span>
                      {n.due_date && (
                        <span className="text-xs text-primary-400">
                          Son: {formatDate(n.due_date)}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-primary mt-1">{n.title}</p>
                    <p className="text-sm text-primary-400 mt-0.5">{n.message}</p>
                    {n.student_name && (
                      <p className="text-xs text-primary-300 mt-1">Öğrenci: {n.student_name}</p>
                    )}
                    <p className="text-xs text-primary-300 mt-1">{formatDate(n.created_at)}</p>
                  </div>

                  {/* Mark as read */}
                  <button
                    onClick={() => markRead(n.id)}
                    className="btn-ghost p-1.5 rounded-lg text-primary-300 hover:text-primary hover:bg-primary-100 flex-shrink-0"
                    title="Okundu olarak işaretle"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
