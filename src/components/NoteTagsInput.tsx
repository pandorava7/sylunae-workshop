import { useEffect, useRef, useState } from 'react'
import { Input } from './ui/input'

function parseTags(value: string) {
  return value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
}

export function NoteTagsInput({ tags, disabled, onChange }: { tags: string[]; disabled: boolean; onChange: (tags: string[]) => void }) {
  const savedValue = tags.join(', ')
  const [draft, setDraft] = useState(savedValue)
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(savedValue)
  }, [savedValue])

  return <Input
    className="tag-input"
    value={draft}
    disabled={disabled}
    onFocus={() => { editing.current = true }}
    onChange={(event) => {
      const value = event.target.value
      setDraft(value)
      onChange(parseTags(value))
    }}
    onBlur={() => {
      editing.current = false
      setDraft(parseTags(draft).join(', '))
    }}
    placeholder="添加标签，用逗号分隔"
  />
}
