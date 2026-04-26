import { useState } from 'react'
import { useFeatureRequests } from './featureRequests'

export function FeatureRequestPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { items, add, markDone, usingFirebase } = useFeatureRequests()
  const [text, setText] = useState('')

  if (!open) return null

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    await add(text)
    setText('')
  }

  const openItems = items.filter((i) => i.status === 'open')
  const doneItems = items.filter((i) => i.status === 'done')

  return (
    <aside className="absolute top-12 right-0 bottom-0 w-96 bg-white border-l border-slate-200 shadow-lg z-30 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Feature requests
        </h2>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 text-lg leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-3 border-b border-slate-200 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Describe a feature for Claude to build…"
          className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 resize-y focus:outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {usingFirebase ? 'Shared via Firebase' : 'Stored locally'}
          </span>
          <button
            type="submit"
            disabled={!text.trim()}
            className="text-sm px-3 py-1 rounded bg-indigo-600 text-white disabled:bg-slate-300"
          >
            Submit
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <Section title={`Open (${openItems.length})`}>
          {openItems.map((r) => (
            <RequestRow key={r.id} text={r.text} createdAt={r.createdAt} onDone={() => markDone(r.id)} />
          ))}
          {openItems.length === 0 && (
            <p className="text-xs text-slate-400">No open requests.</p>
          )}
        </Section>
        {doneItems.length > 0 && (
          <Section title={`Done (${doneItems.length})`}>
            {doneItems.map((r) => (
              <RequestRow key={r.id} text={r.text} createdAt={r.createdAt} done />
            ))}
          </Section>
        )}
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function RequestRow({
  text,
  createdAt,
  done,
  onDone,
}: {
  text: string
  createdAt: number
  done?: boolean
  onDone?: () => void
}) {
  return (
    <div
      className={`text-sm border rounded p-2 ${
        done ? 'border-slate-200 text-slate-400 line-through' : 'border-slate-300 text-slate-800'
      }`}
    >
      <p className="whitespace-pre-wrap">{text}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-slate-400">
          {new Date(createdAt).toLocaleString()}
        </span>
        {!done && onDone && (
          <button
            onClick={onDone}
            className="text-[11px] text-indigo-600 hover:text-indigo-800"
          >
            Mark done
          </button>
        )}
      </div>
    </div>
  )
}
