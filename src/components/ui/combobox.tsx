import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { Input } from './input'

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  emptyMessage = '没有匹配的已有分类',
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  options: readonly string[]
  emptyMessage?: string
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const normalizedOptions = React.useMemo(() => [...new Set(options.map((option) => option.trim()).filter(Boolean))], [options])
  const matches = React.useMemo(() => {
    const query = value.trim().toLocaleLowerCase()
    return query ? normalizedOptions.filter((option) => option.toLocaleLowerCase().includes(query)) : normalizedOptions
  }, [normalizedOptions, value])

  React.useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const select = (option: string) => {
    onValueChange(option)
    setOpen(false)
  }

  return <div ref={rootRef} className={cn('relative', className)}>
    <Input
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls="category-combobox-options"
      value={value}
      onFocus={() => setOpen(true)}
      onChange={(event) => { onValueChange(event.target.value); setOpen(true) }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
        if (event.key === 'ArrowDown') setOpen(true)
      }}
      {...props}
    />
    <button type="button" className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((current) => !current)} aria-label="显示已有分类">
      <ChevronDown size={16} />
    </button>
    {open && <div id="category-combobox-options" role="listbox" className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
      {matches.length ? matches.map((option) => <button key={option} type="button" role="option" aria-selected={value === option} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => select(option)}><Check className={cn('size-4', value === option ? 'opacity-100' : 'opacity-0')} />{option}</button>) : <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyMessage}</p>}
    </div>}
  </div>
}
