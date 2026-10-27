const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '')
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '')

// Local time in the shape <input type="datetime-local"> wants
export const toInputDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const countdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const pad = (n) => String(n).padStart(2, '0')
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
  return days ? `${days}d ${clock}` : clock
}

export const initial = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?')

// Only follow redirects that stay on this site
export const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/')
