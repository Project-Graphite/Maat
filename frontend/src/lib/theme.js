import { useSyncExternalStore } from 'react'
import { load, save } from './storage.js'

// Light or dark follows the system until the user picks one. The CSS reads data-theme on <html>
const KEY = 'maat:theme'
const system = window.matchMedia?.('(prefers-color-scheme: light)')
const listeners = new Set()

const current = () => load(KEY) || (system?.matches ? 'light' : 'dark')
const apply = () => {
  const chosen = load(KEY)
  if (chosen) document.documentElement.dataset.theme = chosen
  else delete document.documentElement.dataset.theme
  listeners.forEach((listener) => listener())
}

apply()
system?.addEventListener('change', apply)

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current)
  const toggle = () => {
    save(KEY, theme === 'light' ? 'dark' : 'light')
    apply()
  }
  return [theme, toggle]
}
