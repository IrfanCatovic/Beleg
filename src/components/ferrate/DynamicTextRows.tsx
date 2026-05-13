import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

export function DynamicTextRows(props: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
}) {
  const list = props.values.length > 0 ? props.values : []
  return (
    <div className="space-y-2">
      {list.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder={props.placeholder}
            value={v}
            onChange={(e) => {
              const next = [...list]
              next[i] = e.target.value
              props.onChange(next)
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
            aria-label="Ukloni"
            onClick={() => props.onChange(list.filter((_, j) => j !== i))}
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => props.onChange([...list, ''])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
      >
        <PlusIcon className="h-4 w-4" />
        {props.addLabel}
      </button>
    </div>
  )
}
