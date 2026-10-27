// Drafts survive a refresh. Storage can be blocked, so every call is guarded
export const load = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

export const save = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not saving a draft is not worth an error message
  }
}
