import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.main.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { formatCode } from '../lib/formatter.js'
import { useTheme } from '../lib/theme.js'
import { LANGUAGES } from '../lib/verdicts.js'

// Serve Monaco from our own bundle instead of a CDN
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

// Monaco's own Format Document command (Shift+Alt+F) uses the same formatters as the Format button
for (const [language, { monaco: id }] of Object.entries(LANGUAGES)) {
  monaco.languages.registerDocumentFormattingEditProvider(id, {
    provideDocumentFormattingEdits: async (model) => {
      try {
        return [{ range: model.getFullModelRange(), text: await formatCode(language, model.getValue()) }]
      } catch {
        return []
      }
    },
  })
}

const defineTheme = (m) => {
  m.editor.defineTheme('maat-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a7d5e', fontStyle: 'italic' },
      { token: 'keyword', foreground: '8a6417' },
      { token: 'string', foreground: '2b7a51' },
      { token: 'number', foreground: '2f5cb0' },
      { token: 'type', foreground: '6e4f12' },
      { token: 'delimiter', foreground: '6b5f45' },
    ],
    colors: {
      'editor.background': '#fffaf0',
      'editor.foreground': '#1f1a12',
      'editorLineNumber.foreground': '#c8b07a',
      'editorLineNumber.activeForeground': '#8a6417',
      'editorCursor.foreground': '#8a6417',
      'editor.selectionBackground': '#d4a94a55',
      'editor.lineHighlightBackground': '#f6efdf',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#efe4c9',
      'editorWidget.background': '#fffaf0',
      'editorWidget.border': '#c8b07a',
    },
  })
  m.editor.defineTheme('maat', {
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
  const [theme] = useTheme()
  return (
    <Editor
      value={value}
      language={LANGUAGES[language]?.monaco}
      theme={theme === 'light' ? 'maat-light' : 'maat'}
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
