import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.main.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { LANGUAGES } from '../lib/verdicts.js'

// Serve Monaco from our own bundle instead of a CDN
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

const THEME = 'maat'
const defineTheme = (m) => {
  m.editor.defineTheme(THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7d7156', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'd4a94a' },
      { token: 'string', foreground: '5db88a' },
      { token: 'number', foreground: '7aa2ee' },
      { token: 'type', foreground: 'f0ce7a' },
      { token: 'delimiter', foreground: 'a89d84' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#efe6d0',
      'editorLineNumber.foreground': '#4a3d1f',
      'editorLineNumber.activeForeground': '#d4a94a',
      'editorCursor.foreground': '#f0ce7a',
      'editor.selectionBackground': '#4a3d1f99',
      'editor.lineHighlightBackground': '#0d0b08',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#1c170c',
      'editorWidget.background': '#0d0b08',
      'editorWidget.border': '#4a3d1f',
      'scrollbarSlider.background': '#4a3d1f66',
      'scrollbarSlider.hoverBackground': '#8c6b2688',
    },
  })
}

export default function MonacoEditor({ value, onChange, language, readOnly = false, label }) {
  return (
    <Editor
      value={value}
      language={LANGUAGES[language]?.monaco}
      theme={THEME}
      beforeMount={defineTheme}
      onChange={(next) => onChange?.(next ?? '')}
      loading={<div className="spinner" />}
      options={{
        readOnly,
        ariaLabel: label || 'Code editor',
        fontFamily: "'JetBrains Mono Variable', ui-monospace, Consolas, monospace",
        fontSize: 14,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: 'line',
        smoothScrolling: true,
        // On small screens the editor must not trap the page's scroll
        scrollbar: { alwaysConsumeMouseWheel: false },
      }}
    />
  )
}
