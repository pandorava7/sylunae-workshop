export function markdownExport(title: string, content: string) {
  const heading = title.trim() || '无标题笔记'
  const body = content.trim()
  return `# ${heading}\n${body ? `\n${body}` : ''}\n`
}

export function splitMarkdownNote(markdown: string) {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = normalized.match(/^\s*#\s+(.+?)\s*#?\s*(?:\n|$)/)
  if (!match) return { title: null, content: normalized }

  return {
    title: match[1].trim() || null,
    content: normalized.slice(match[0].length).replace(/^\n/, ''),
  }
}

export function markdownFileName(title: string) {
  const safeTitle = (title.trim() || '无标题笔记')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  return `${safeTitle || '无标题笔记'}.md`
}
