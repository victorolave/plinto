export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Tabs<T extends string>({ items, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`tabs ${className}`.trim()} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`tab ${value === item.id ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {typeof item.count === 'number' ? (
            <span className="tab-count">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
