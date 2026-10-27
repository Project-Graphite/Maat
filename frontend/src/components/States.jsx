export function Loading({ label = 'Loading' }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <h2>{error?.status === 404 ? 'Not found' : error?.status === 403 ? 'No access' : 'Something went wrong'}</h2>
      <p>{error?.message || 'Try again in a moment.'}</p>
      {onRetry && error?.status !== 404 && (
        <button className="btn btn-quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
