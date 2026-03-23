import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uygulama hatası:', error.message, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0f1e3d',
          fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 16
        }}>
          <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 600 }}>
            Beklenmeyen bir hata oluştu
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 13,
            maxWidth: 420, textAlign: 'center', lineHeight: 1.6
          }}>
            {this.state.error?.message ?? 'Bilinmeyen hata'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: '8px 24px', background: '#1B3A6B',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 14
            }}
          >
            Yeniden Dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
