export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Every call goes to the same origin, so the login cookie is sent without any extra setup
export async function api(path, { method = 'GET', body, signal, rawBody, contentType } = {}) {
  const headers = {}
  let payload
  if (rawBody !== undefined) {
    payload = rawBody
    headers['Content-Type'] = contentType
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }

  let res
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, body: payload, signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  if (res.status === 204) return null
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(json?.message || 'Something went wrong. Try again.', res.status)
  }
  return json
}

// Builds ?a=1&b=2, leaving out anything empty
export const query = (params) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
