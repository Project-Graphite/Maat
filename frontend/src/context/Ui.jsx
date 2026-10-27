import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const UiContext = createContext(null)

// Toasts for results of actions, and one confirm dialog for anything that deletes
export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmation, setConfirmation] = useState(null)
  const nextId = useRef(0)
  const dialog = useRef(null)

  const toast = useCallback((message, tone = 'info') => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000)
  }, [])

  const confirm = useCallback(
    (message, { confirmLabel = 'Delete', title = 'Are you sure?' } = {}) =>
      new Promise((resolve) => {
        setConfirmation({ message, confirmLabel, title, resolve })
        requestAnimationFrame(() => dialog.current?.showModal())
      }),
    [],
  )

  const answer = (value) => {
    dialog.current?.close()
    confirmation?.resolve(value)
    setConfirmation(null)
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone}>
            {t.message}
          </div>
        ))}
      </div>
      <dialog ref={dialog} className="dialog" onCancel={() => answer(false)}>
        {confirmation && (
          <>
            <h2 style={{ fontSize: 'var(--step-2)' }}>{confirmation.title}</h2>
            <p style={{ marginTop: 12 }}>{confirmation.message}</p>
            <div className="dialog-actions">
              <button className="btn btn-quiet" onClick={() => answer(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => answer(true)}>
                {confirmation.confirmLabel}
              </button>
            </div>
          </>
        )}
      </dialog>
    </UiContext.Provider>
  )
}

export const useUi = () => useContext(UiContext)
