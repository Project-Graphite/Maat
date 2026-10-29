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

export const DRAFT_PREFIX = 'maat:draft:'

// On logout, so the code written on a shared computer leaves with its author
export const clearDrafts = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(DRAFT_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    // Storage is blocked, so there is nothing to clear
  }
}
