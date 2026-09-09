import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { ExternalLink, Search, Sparkles, Star, X } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import { COLLECTION_LABELS, fetchBangumiCollection, SUBJECT_LABELS } from '../data/bangumi'
import type { BangumiCollectionItem, BangumiCollectionType, BangumiProfileCache, BangumiSubjectType } from '../shared/types'
import { formatDate } from '../utils'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState, Spinner } from '../components/Icons'
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '../components/ui/pagination'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

const PAGE_SIZE = 12
const SUBJECT_TYPES = [2, 3, 4, 6, 1] as const satisfies readonly BangumiSubjectType[]
const COLLECTION_TYPES = [1, 2, 3, 4, 5] as const satisfies readonly BangumiCollectionType[]

export function LibraryPage() {
  const { snapshot } = useAppStore()
  const [subjectType, setSubjectType] = useState<BangumiSubjectType>(2)
  const [collectionType, setCollectionType] = useState<BangumiCollectionType | 0>(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BangumiCollectionItem | null>(null)
  const [collection, setCollection] = useState<BangumiProfileCache | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const username = snapshot?.settings.bangumiUsername.trim() || ''
  const cache = collection

  useEffect(() => {
    setCollection(null)
    setSelected(null)
    setSyncError('')
    if (!username) {
      setSyncing(false)
      return
    }

    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    setSyncing(true)

    void fetchBangumiCollection(username, controller.signal)
      .then((result) => { if (active) setCollection(result) })
      .catch((error: Error) => {
        if (active) setSyncError(error.name === 'AbortError' ? '加载超时，请重新进入收藏库' : error.message)
      })
      .finally(() => {
        clearTimeout(timeout)
        if (active) setSyncing(false)
      })

    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [username])

  const subjectCounts = useMemo(() => {
    const counts = new Map<BangumiSubjectType, number>()
    for (const item of cache?.items || []) counts.set(item.subjectType, (counts.get(item.subjectType) || 0) + 1)
    return counts
  }, [cache?.items])

  const visibleSubjectTypes = useMemo(() => {
    const populated = SUBJECT_TYPES.filter((type) => subjectCounts.has(type))
    return populated.length > 0 ? populated : SUBJECT_TYPES.slice(0, 4)
  }, [subjectCounts])

  useEffect(() => {
    if (cache?.items.length && !subjectCounts.has(subjectType)) setSubjectType(visibleSubjectTypes[0])
  }, [cache?.items.length, subjectCounts, subjectType, visibleSubjectTypes])

  const statusCounts = useMemo(() => {
    const counts = new Map<BangumiCollectionType, number>()
    for (const item of cache?.items || []) {
      if (item.subjectType === subjectType) counts.set(item.collectionType, (counts.get(item.collectionType) || 0) + 1)
    }
    return counts
  }, [cache?.items, subjectType])

  const items = useMemo(() => (cache?.items || []).filter((item) => (
    item.subjectType === subjectType && (!collectionType || item.collectionType === collectionType)
  )), [cache?.items, subjectType, collectionType])

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const pagedItems = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page])

  useEffect(() => setPage(1), [subjectType, collectionType])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const openExternal = (url: string) => window.siyue?.system.openExternal(url) ?? window.open(url, '_blank', 'noopener,noreferrer')

  if (!username) {
    return <section className="page library-page">
      <header className="page-header"><div><span className="eyebrow">COLLECTION</span><h1>收藏库</h1><p>连接你的 Bangumi 公开收藏</p></div></header>
      <EmptyState icon={<Sparkles size={26} />} title="从 Bangumi 开始" description="前往设置填写一个公开的 Bangumi 用户名，五类收藏会安静地汇聚在这里。" />
    </section>
  }

  return <section className="page library-page">
    <Tabs className="library-tabs" value={String(subjectType)} onValueChange={(value) => setSubjectType(Number(value) as BangumiSubjectType)}>
      <TabsList variant="line" aria-label="收藏类型">
        {visibleSubjectTypes.map((type) => <TabsTrigger key={type} value={String(type)}>
          <span>{SUBJECT_LABELS[type]}</span><span className="library-tab-count">{subjectCounts.get(type) || 0}</span>
        </TabsTrigger>)}
      </TabsList>
    </Tabs>

    <div className="library-statuses" role="radiogroup" aria-label="收藏状态">
      {subjectCounts.get(subjectType) ? <Badge asChild variant={collectionType === 0 ? 'outline' : 'secondary'} className={collectionType === 0 ? 'active' : ''}>
        <button type="button" role="radio" aria-checked={collectionType === 0} onClick={() => setCollectionType(0)}>全部 <span>({subjectCounts.get(subjectType)})</span></button>
      </Badge> : null}
      {COLLECTION_TYPES.map((type) => statusCounts.get(type) ? <Badge key={type} asChild variant={collectionType === type ? 'outline' : 'secondary'} className={collectionType === type ? 'active' : ''}>
        <button type="button" role="radio" aria-checked={collectionType === type} onClick={() => setCollectionType(type)}>{COLLECTION_LABELS[type]} <span>({statusCounts.get(type)})</span></button>
      </Badge> : null)}
    </div>

    {syncError && <div className="notice error"><span>{syncError}</span><button onClick={() => setSyncError('')} aria-label="关闭提示"><X size={15} /></button></div>}
    {syncing ? <div className="center-loading"><Spinner /><span>正在读取你的公开收藏…</span></div> : items.length === 0 ?
      <EmptyState icon={<Search size={24} />} title={cache ? '这个分类还没有条目' : '未能读取收藏'} description={cache ? '切换一个类型或收藏状态试试。' : '重新进入收藏库时会再次实时加载。'} /> : <>
        <div className="collection-grid">{pagedItems.map((item) => <CollectionCard key={item.subjectId} item={item} onClick={() => setSelected(item)} />)}</div>
        <LibraryPagination page={page} pageCount={pageCount} onPageChange={setPage} />
      </>}
    {cache && <div className="sync-caption">本次加载：{formatDate(cache.syncedAt, true)} · 仅包含公开收藏</div>}

    {selected && <Sheet open onOpenChange={(open) => { if (!open) setSelected(null) }}><SheetContent className="detail-drawer" showCloseButton>
      <div className="drawer-cover">{selected.cover ? <img src={selected.cover} alt="" /> : <div className="cover-placeholder"><Sparkles /></div>}</div>
      <div className="drawer-content"><div className="badge-row"><span className="badge">{SUBJECT_LABELS[selected.subjectType]}</span><span className="badge accent">{COLLECTION_LABELS[selected.collectionType]}</span></div>
        <SheetTitle asChild><h2>{selected.nameCn || selected.name}</h2></SheetTitle><SheetDescription asChild><div className="original-title">{selected.nameCn && selected.name !== selected.nameCn ? selected.name : '收藏条目详情'}</div></SheetDescription>
        <div className="stat-row"><div><span>站点评分</span><strong>{selected.score || '—'}</strong></div><div><span>我的评分</span><strong>{selected.rate || '—'}</strong></div><div><span>排名</span><strong>{selected.rank ? `#${selected.rank}` : '—'}</strong></div></div>
        {selected.summary && <p className="summary">{selected.summary}</p>}
        {selected.comment && <blockquote>{selected.comment}</blockquote>}
        {selected.tags.length > 0 && <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <dl><dt>平台</dt><dd>{selected.platform || '—'}</dd><dt>首发日期</dt><dd>{selected.airDate || '—'}</dd><dt>收藏更新</dt><dd>{formatDate(selected.updatedAt, true)}</dd></dl>
        <Button className="button primary full" onClick={() => void openExternal(selected.url)}>在 Bangumi 中查看 <ExternalLink size={15} /></Button>
      </div>
    </SheetContent></Sheet>}
  </section>
}

function CollectionCard({ item, onClick }: { item: BangumiCollectionItem; onClick: () => void }) {
  const shownTags = item.tags.slice(0, 3)
  const hiddenTagCount = item.tags.length - shownTags.length
  const year = item.airDate.match(/^\d{4}/)?.[0]

  return <button className="collection-card" onClick={onClick} aria-label={`查看 ${item.nameCn || item.name}`}>
    <div className="collection-cover">
      {item.cover ? <img src={item.cover} alt="" loading="lazy" decoding="async" /> : <div className="cover-placeholder"><Sparkles /></div>}
      <span className={`collection-state state-${item.collectionType}`}>{COLLECTION_LABELS[item.collectionType]}</span>
      <span className="collection-score"><Star size={13} fill="currentColor" />{formatScore(item.score)}</span>
      <div className="collection-title"><h3>{item.nameCn || item.name}</h3>{year && <span>{year}</span>}</div>
    </div>
    <div className="collection-tags">
      {shownTags.map((tag) => <span key={tag}>{tag}</span>)}
      {hiddenTagCount > 0 && <span>+{hiddenTagCount}</span>}
      {item.tags.length === 0 && item.platform && <span>{item.platform}</span>}
    </div>
  </button>
}

function LibraryPagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  const pages = paginationItems(page, pageCount)
  const selectPage = (event: MouseEvent, nextPage: number) => {
    event.preventDefault()
    onPageChange(nextPage)
  }

  return <Pagination className="library-pagination">
    <PaginationContent>
      <PaginationItem><PaginationPrevious href="#" text="上一页" aria-disabled={page === 1} className={page === 1 ? 'disabled' : ''} onClick={(event) => { if (page > 1) selectPage(event, page - 1); else event.preventDefault() }} /></PaginationItem>
      {pages.map((item) => typeof item === 'number' ? <PaginationItem key={item}><PaginationLink href="#" isActive={item === page} onClick={(event) => selectPage(event, item)}>{item}</PaginationLink></PaginationItem> : <PaginationItem key={item}><PaginationEllipsis /></PaginationItem>)}
      <PaginationItem><PaginationNext href="#" text="下一页" aria-disabled={page === pageCount} className={page === pageCount ? 'disabled' : ''} onClick={(event) => { if (page < pageCount) selectPage(event, page + 1); else event.preventDefault() }} /></PaginationItem>
    </PaginationContent>
  </Pagination>
}

function paginationItems(current: number, total: number): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'end', total]
  if (current >= total - 3) return [1, 'start', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'start', current - 1, current, current + 1, 'end', total]
}

function formatScore(score: number): string {
  if (!score) return '—'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
