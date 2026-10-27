export default function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (total <= limit) return null
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  return (
    <nav className="pagination" aria-label="Pages">
      <span>
        {first}–{last} of {total}
      </span>
      <div className="row">
        <button className="btn btn-quiet btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button className="btn btn-quiet btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  )
}
