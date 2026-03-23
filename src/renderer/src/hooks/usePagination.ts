import { useState, useMemo } from 'react'

interface PaginationResult<T> {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  items: T[]
  setPage: (p: number) => void
  setPageSize: (ps: number) => void
  nextPage: () => void
  prevPage: () => void
  goFirst: () => void
  goLast: () => void
  /** Page numbers to render (with -1 as ellipsis) */
  pageNumbers: number[]
}

export function usePagination<T>(data: T[], initialPageSize = 50): PaginationResult<T> {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(initialPageSize)

  const totalItems = data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const setPage = (p: number) => setPageRaw(Math.min(Math.max(1, p), totalPages))
  const setPageSize = (ps: number) => { setPageSizeRaw(ps); setPageRaw(1) }

  const items = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize])

  // Build visible page numbers (with ellipsis = -1)
  const pageNumbers = useMemo((): number[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: number[] = [1]
    if (page > 3) pages.push(-1)
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p)
    if (page < totalPages - 2) pages.push(-1)
    pages.push(totalPages)
    return pages
  }, [page, totalPages])

  return {
    page, pageSize, totalPages, totalItems, items, setPage, setPageSize,
    nextPage: () => setPage(page + 1),
    prevPage: () => setPage(page - 1),
    goFirst: () => setPage(1),
    goLast:  () => setPage(totalPages),
    pageNumbers
  }
}
