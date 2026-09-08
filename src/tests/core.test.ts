import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSnapshot } from '../shared/defaults'
import { backupSummary, createBackup, parseBackup } from '../data/backup'
import { fetchBangumiCollection } from '../data/bangumi'
import { goalProgress, isOverdue } from '../utils'

describe('goal progress', () => {
  it('calculates milestone completion and completed override', () => {
    expect(goalProgress([])).toBe(0)
    expect(goalProgress([true, false, true])).toBe(67)
    expect(goalProgress([false], 'completed')).toBe(100)
  })

  it('does not mark completed work as overdue', () => {
    expect(isOverdue('2000-01-01', true)).toBe(false)
    expect(isOverdue('2000-01-01', false)).toBe(true)
  })
})

describe('backup format', () => {
  it('round-trips a snapshot and reports its contents', () => {
    const envelope = createBackup(createDefaultSnapshot())
    const restored = parseBackup(JSON.stringify(envelope))
    expect(restored.format).toBe('siyue-workshop-backup')
    expect(backupSummary(restored)).toContain('笔记 0 条')
  })

  it('rejects unrelated json', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow()
  })
})

describe('Bangumi client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps and paginates public collections', async () => {
    const entry = (id: number) => ({
      subject_id: id, subject_type: 2, rate: 9, type: 3, comment: null, tags: ['科幻'], ep_status: 4, vol_status: 0,
      updated_at: '2026-01-01T00:00:00Z',
      subject: { id, name: `Title ${id}`, name_cn: `标题 ${id}`, short_summary: '简介', date: '2026-01-01', platform: 'TV', eps: 12, score: 8.2, rank: 100, images: { large: 'https://example.com/cover.jpg' } },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 2, limit: 1, offset: 0, data: [entry(1)] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 2, limit: 1, offset: 1, data: [entry(2)] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchBangumiCollection('sai')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ subjectId: 1, nameCn: '标题 1', summary: '简介', comment: '', collectionType: 3 })
    expect(fetchMock.mock.calls[1][0]).toContain('offset=1')
  })
})
