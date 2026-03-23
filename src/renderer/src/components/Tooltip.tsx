import { useState, useRef, ReactNode } from 'react'

interface Props {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ content, children, position = 'top' }: Props): JSX.Element {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 400) }
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  const posStyle: Record<string, React.CSSProperties> = {
    top:    { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 6px)',    left: '50%', transform: 'translateX(-50%)' },
    left:   { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' },
    right:  { left: 'calc(100% + 6px)',  top: '50%', transform: 'translateY(-50%)' }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <span style={{
          position: 'absolute', zIndex: 9999, whiteSpace: 'nowrap',
          padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
          background: 'rgba(17,24,39,0.9)', color: '#fff', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          ...posStyle[position]
        }}>
          {content}
        </span>
      )}
    </span>
  )
}
