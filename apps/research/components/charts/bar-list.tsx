import { formatShare } from './share'

/** Part-to-whole as labelled horizontal bars (server-rendered, no JS). */
export function BarList({ items, total, format, color = '#3987e5' }: { items: { name: string; value: number }[]; total?: number; format: (v: number) => string; color?: string }) {
  const t = total ?? items.reduce((s, i) => s + i.value, 0)
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fg-2">{i.name}</span>
            <span className="num text-fg">
              {format(i.value)} <span className="text-fg-3">· {formatShare(i.value, t)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-750" title={`${i.name}: ${formatShare(i.value, t)}`}>
            <div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
