import { Suspense, lazy } from 'react'

// Monaco is large, so it is only fetched on pages that show an editor
const MonacoEditor = lazy(() => import('./MonacoEditor.jsx'))

export default function CodeEditor({ tall, ...props }) {
  return (
    <div className={`editor-frame ${tall ? 'editor-frame-tall' : ''}`}>
      <Suspense
        fallback={
          <div className="editor-fallback" role="status">
            <div className="spinner" />
            <span className="sr-only">Loading the editor</span>
          </div>
        }
      >
        <MonacoEditor {...props} />
      </Suspense>
    </div>
  )
}
