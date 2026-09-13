import { useState } from 'react'
import { zhCN } from 'date-fns/locale'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
  invalid?: boolean
}

export function DatePicker({ value, onChange, min, max, placeholder = '选择日期', ariaLabel = '选择日期', className, disabled = false, invalid = false }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseLocalDate(value)
  const minimum = parseLocalDate(min ?? '')
  const maximum = parseLocalDate(max ?? '')

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className={cn('date-picker-trigger', className)} disabled={disabled} aria-label={ariaLabel} aria-invalid={invalid || undefined}>
        <CalendarDays />
        <span className={selected ? 'private-date-value' : undefined} data-placeholder={!selected || undefined}>{selected ? formatLocalDate(selected) : placeholder}</span>
        <ChevronDown />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="date-picker-popover" align="start">
      <Calendar
        mode="single"
        locale={zhCN}
        selected={selected}
        defaultMonth={selected ?? minimum ?? new Date()}
        disabled={(date) => Boolean((minimum && date < minimum) || (maximum && date > maximum))}
        onSelect={(date) => {
          if (!date) return
          onChange(toLocalDateValue(date))
          setOpen(false)
        }}
      />
      {selected && <div className="date-picker-footer"><Button type="button" variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(false) }}>清除日期</Button></div>}
    </PopoverContent>
  </Popover>
}

function parseLocalDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}

function toLocalDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
