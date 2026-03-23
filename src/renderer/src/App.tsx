import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Layout from '@components/layout/Layout'
import Dashboard from '@pages/Dashboard'
import Students from '@pages/Students'
import Teachers from '@pages/Teachers'
import Staff from '@pages/Staff'
import Classes from '@pages/Classes'
import Payments from '@pages/Payments'
import Attendance from '@pages/Attendance'
import Notifications from '@pages/Notifications'
import Reports from '@pages/Reports'
import Settings from '@pages/Settings'
import Messages from '@pages/Messages'
import Events from '@pages/Events'
import Users from '@pages/Users'
import LoginPage from '@pages/LoginPage'
import StudentLedger from '@pages/StudentLedger'
import TeacherLedger from '@pages/TeacherLedger'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import WelcomeModal from './components/WelcomeModal'

function AppRoutes(): JSX.Element {
  const { user, loading } = useAuth()
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('lirik_welcomed'))

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f1e3d', fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
          Yükleniyor...
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="staff" element={<Staff />} />
          <Route path="classes" element={<Classes />} />
          <Route path="payments" element={<Payments />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="messages" element={<Messages />} />
          <Route path="events" element={<Events />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="students/:id/ledger" element={<StudentLedger />} />
          <Route path="teachers/:id/ledger" element={<TeacherLedger />} />
        </Route>
      </Routes>
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </>
  )
}

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
