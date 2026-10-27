import { useEffect, useRef } from 'react'

// A modal built on the native <dialog>: it traps focus and closes on Escape by itself
export default function Dialog({ open, onClose, title, wide, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} onClose={onClose} aria-label={title}>
      {open && (
        <>
          <h2 style={{ fontSize: 'var(--step-2)', marginBottom: 20 }}>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  )
}
