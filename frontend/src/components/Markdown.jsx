import ReactMarkdown from 'react-markdown'

// react-markdown never renders raw HTML, so a statement cannot inject a script
export default function Markdown({ children }) {
  return (
    <div className="prose">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
