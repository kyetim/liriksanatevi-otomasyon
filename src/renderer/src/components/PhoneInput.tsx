import React from 'react'

/**
 * Extracts up to 10 subscriber digits from any phone string.
 * Strips +90 / 0090 prefix first so the prefix digits don't pollute the count.
 */
function extractDigits(raw: string): string {
  let s = raw.trim()

  // Remove known prefixes before extracting digits
  if (s.startsWith('+90')) s = s.slice(3)
  else if (s.startsWith('0090')) s = s.slice(4)

  // Keep only digits
  let digits = s.replace(/\D/g, '')

  // Remove trunk 0 if present
  if (digits.startsWith('0')) digits = digits.slice(1)

  return digits.slice(0, 10)
}

/**
 * Formats a phone string into "+90 xxx xxx xx xx" display format.
 */
export function formatPhone(raw: string): string {
  const d = extractDigits(raw)
  if (!d) return ''

  let out = d.slice(0, 3)
  if (d.length > 3) out += ' ' + d.slice(3, 6)
  if (d.length > 6) out += ' ' + d.slice(6, 8)
  if (d.length > 8) out += ' ' + d.slice(8, 10)

  return '+90 ' + out
}

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
}

export default function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // If user cleared the field entirely
    if (!raw || raw === '+90' || raw === '+90 ') {
      onChange('')
      return
    }
    onChange(formatPhone(raw))
  }

  const displayValue = value ? formatPhone(value) : ''

  return (
    <input
      {...props}
      className={className}
      type="tel"
      value={displayValue}
      placeholder="+90 555 123 45 67"
      onChange={handleChange}
    />
  )
}
