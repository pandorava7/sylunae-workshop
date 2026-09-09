import { z } from 'zod'
import type { BangumiCollectionItem, BangumiCollectionType, BangumiProfileCache, BangumiSubjectType } from '../shared/types'

const collectionSchema = z.object({
  subject_id: z.number(),
  subject_type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
  rate: z.number().optional().default(0),
  type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  comment: z.preprocess((value) => value ?? '', z.string()),
  tags: z.array(z.string()).optional().default([]),
  ep_status: z.number().optional().default(0),
  vol_status: z.number().optional().default(0),
  updated_at: z.string(),
  subject: z.object({
    id: z.number().optional(),
    name: z.string().optional().default(''),
    name_cn: z.string().optional().default(''),
    short_summary: z.string().optional().default(''),
    date: z.string().nullable().optional(),
    platform: z.string().optional().default(''),
    eps: z.number().optional().default(0),
    score: z.number().optional().default(0),
    rank: z.number().nullable().optional(),
    images: z.object({ common: z.string().optional(), medium: z.string().optional(), large: z.string().optional() }).nullable().optional(),
    tags: z.array(z.object({ name: z.string(), count: z.number().optional() }).passthrough()).optional().default([]),
  }).passthrough(),
}).passthrough()

const pageSchema = z.object({ total: z.number(), limit: z.number(), offset: z.number(), data: z.array(collectionSchema) })

export class BangumiError extends Error {
  constructor(public code: 'not-found' | 'rate-limited' | 'network' | 'invalid-response', message: string) { super(message) }
}

export async function fetchBangumiCollection(username: string, signal?: AbortSignal): Promise<BangumiProfileCache> {
  const cleanUsername = username.trim()
  if (!cleanUsername) throw new BangumiError('not-found', '请输入 Bangumi 用户名')
  const items: BangumiCollectionItem[] = []
  let offset = 0
  const limit = 100
  let total = 1
  while (offset < total) {
    let response: Response
    try {
      response = await fetch(`https://api.bgm.tv/v0/users/${encodeURIComponent(cleanUsername)}/collections?limit=${limit}&offset=${offset}`, {
        headers: { Accept: 'application/json' }, signal, cache: 'no-store',
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error
      throw new BangumiError('network', '无法连接 Bangumi，请检查网络后重试')
    }
    if (response.status === 404) throw new BangumiError('not-found', '未找到该用户，或收藏不可公开访问')
    if (response.status === 429) throw new BangumiError('rate-limited', 'Bangumi 请求过于频繁，请稍后重试')
    if (!response.ok) throw new BangumiError('network', `Bangumi 暂时不可用（${response.status}）`)
    let page: z.infer<typeof pageSchema>
    try { page = pageSchema.parse(await response.json()) } catch { throw new BangumiError('invalid-response', 'Bangumi 返回了无法识别的数据') }
    total = page.total
    items.push(...page.data.map((entry) => ({
      subjectId: entry.subject_id,
      subjectType: entry.subject_type as BangumiSubjectType,
      collectionType: entry.type as BangumiCollectionType,
      name: entry.subject.name,
      nameCn: entry.subject.name_cn,
      summary: entry.subject.short_summary,
      cover: entry.subject.images?.large || entry.subject.images?.common || entry.subject.images?.medium || '',
      score: entry.subject.score,
      rank: entry.subject.rank ?? null,
      rate: entry.rate,
      comment: entry.comment,
      tags: entry.tags.length > 0 ? entry.tags : entry.subject.tags.map((tag) => tag.name),
      epStatus: entry.ep_status,
      volStatus: entry.vol_status,
      totalEpisodes: entry.subject.eps,
      airDate: entry.subject.date || '',
      platform: entry.subject.platform,
      updatedAt: entry.updated_at,
      url: `https://bgm.tv/subject/${entry.subject_id}`,
    })))
    offset += page.data.length
    if (page.data.length === 0) break
  }
  return { username: cleanUsername, items, syncedAt: new Date().toISOString() }
}

export const SUBJECT_LABELS: Record<BangumiSubjectType, string> = { 1: '书籍', 2: '动画', 3: '音乐', 4: '游戏', 6: '三次元' }
export const COLLECTION_LABELS: Record<BangumiCollectionType, string> = { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' }
