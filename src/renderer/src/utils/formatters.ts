import { format, parseISO, isValid } from 'date-fns'
import { tr } from 'date-fns/locale'

export function formatCurrency(amount: number, currency = 'TL'): string {
  if (currency === 'TL') {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount)
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency
  }).format(amount)
}

export function formatDate(dateStr?: string, fmt = 'dd.MM.yyyy'): string {
  if (!dateStr) return '—'
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, fmt, { locale: tr })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr?: string): string {
  return formatDate(dateStr, 'dd.MM.yyyy HH:mm')
}

export function formatMonth(yearOrStr?: number | string, month?: number): string {
  if (yearOrStr === undefined) return '—'
  try {
    let date: Date
    if (typeof yearOrStr === 'number' && month !== undefined) {
      date = new Date(yearOrStr, month - 1, 1)
    } else {
      date = parseISO((yearOrStr as string) + '-01')
    }
    return format(date, 'MMMM yyyy', { locale: tr })
  } catch {
    return String(yearOrStr)
  }
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd')
  }
}

export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}
