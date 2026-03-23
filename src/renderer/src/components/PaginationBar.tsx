interface Props {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageNumbers: number[]
  onPage: (p: number) => void
  onPageSize?: (ps: number) => void
  pageSizeOptions?: number[]
}

const btnBase: React.CSSProperties = {
  minWidth: '32px', height: '32px', padding: '0 8px', borderRadius: '8px',
  border: '1px solid #e5e7eb', background: '#fff', fontSize: '13px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
}

export default function PaginationBar({
  page, totalPages, totalItems, pageSize,
  pageNumbers, onPage, onPageSize,
  pageSizeOptions = [25, 50, 100]
}: Props): JSX.Element {
  const start = Math.min((page - 1) * pageSize + 1, totalItems)
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderTop: '1px solid #e5e7eb',
      fontFamily: 'Inter, sans-serif', flexWrap: 'wrap', gap: '8px'
    }}>
      {/* Info */}
      <span style={{ fontSize: '13px', color: '#6b7280' }}>
        {totalItems === 0 ? 'Kayıt yok' : `${start}–${end} / ${totalItems} kayıt`}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Page size */}
        {onPageSize && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Sayfa:</span>
            <select
              value={pageSize}
              onChange={e => onPageSize(Number(e.target.value))}
              style={{ ...btnBase, cursor: 'pointer', paddingLeft: '6px', paddingRight: '6px' }}
            >
              {pageSizeOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {/* Prev */}
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          style={{ ...btnBase, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          ‹
        </button>

        {/* Pages */}
        {pageNumbers.map((p, i) =>
          p === -1 ? (
            <span key={`ellipsis-${i}`} style={{ fontSize: '13px', color: '#9ca3af', padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                ...btnBase,
                background: p === page ? '#1B3A6B' : '#fff',
                color: p === page ? '#fff' : '#374151',
                borderColor: p === page ? '#1B3A6B' : '#e5e7eb',
                fontWeight: p === page ? 600 : 400
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          style={{ ...btnBase, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
        >
          ›
        </button>
      </div>
    </div>
  )
}
