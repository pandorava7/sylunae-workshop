import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ExternalLink, Grid2X2, LayoutList, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import { COLLECTION_LABELS, fetchBangumiCollection, SUBJECT_LABELS } from '../data/bangumi'
import type { BangumiCollectionItem, BangumiCollectionType, BangumiSubjectType } from '../shared/types'
import { formatDate } from '../utils'
import { EmptyState, Spinner } from '../components/Icons'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'

type ViewMode = 'grid' | 'list'
type SortMode = 'updated' | 'score' | 'rate'

export function LibraryPage() {
  const { snapshot, update } = useAppStore()
  const [query, setQuery] = useState('')
  const [subjectType, setSubjectType] = useState<number>(0)
  const [collectionType, setCollectionType] = useState<number>(0)
  const [sort, setSort] = useState<SortMode>('updated')
  const [view, setView] = useState<ViewMode>('grid')
  const [selected, setSelected] = useState<BangumiCollectionItem | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const didAutoSync = useRef('')
  const username = snapshot?.settings.bangumiUsername.trim() || ''
  const cache = snapshot?.bangumi

  const sync = async () => {
    if (!username || syncing) return
    setSyncing(true)
    setSyncError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      const result = await fetchBangumiCollection(username, controller.signal)
      update((state) => ({ ...state, bangumi: result }))
    } catch (error) {
      setSyncError((error as Error).name === 'AbortError' ? '同步超时，请稍后重试' : (error as Error).message)
    } finally {
      clearTimeout(timeout)
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (username && (!cache || cache.username !== username) && didAutoSync.current !== username) {
      didAutoSync.current = username
      void sync()
    }
  }, [username, cache?.username])

  const items = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase()
    const result = (cache?.items || []).filter((item) => {
      const matchesQuery = !clean || `${item.name} ${item.nameCn} ${item.tags.join(' ')} ${item.platform}`.toLocaleLowerCase().includes(clean)
      return matchesQuery && (!subjectType || item.subjectType === subjectType) && (!collectionType || item.collectionType === collectionType)
    })
    return result.sort((a, b) => {
      if (sort === 'score') return b.score - a.score
      if (sort === 'rate') return b.rate - a.rate
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [cache?.items, query, subjectType, collectionType, sort])

  const openExternal = (url: string) => window.siyue?.system.openExternal(url) ?? window.open(url, '_blank', 'noopener,noreferrer')

  return <section className="page library-page">
    <header className="page-header">
      <div><span className="eyebrow">COLLECTION</span><h1>收藏库</h1><p>{cache ? `${cache.items.length} 个条目 · ${cache.username}` : '连接你的 Bangumi 公开收藏'}</p></div>
      {username && <Button variant="outline" className="button secondary" onClick={() => void sync()} disabled={syncing}><RefreshCw size={16} className={syncing ? 'spin' : ''} />{syncing ? '同步中' : '刷新'}</Button>}
    </header>

    {!username ? <EmptyState icon={<Sparkles size={26} />} title="从 Bangumi 开始" description="前往设置填写一个公开的 Bangumi 用户名，五类收藏会安静地汇聚在这里。" /> : <>
      <div className="toolbar library-toolbar">
        <label className="search-box"><Search size={17} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、标签或平台" /></label>
        <Select value={String(subjectType)} onValueChange={(value) => setSubjectType(Number(value))}><SelectTrigger className="select-control"><SlidersHorizontal size={16} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">全部类型</SelectItem>{Object.entries(SUBJECT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={String(collectionType)} onValueChange={(value) => setCollectionType(Number(value))}><SelectTrigger className="select-control"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">全部状态</SelectItem>{Object.entries(COLLECTION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}><SelectTrigger className="select-control"><ArrowUpDown size={15} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated">最近更新</SelectItem><SelectItem value="score">站点评分</SelectItem><SelectItem value="rate">我的评分</SelectItem></SelectContent></Select>
        <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as ViewMode) }} className="segmented icon-segmented" spacing={0}><ToggleGroupItem value="grid" aria-label="卡片视图"><Grid2X2 size={16} /></ToggleGroupItem><ToggleGroupItem value="list" aria-label="列表视图"><LayoutList size={17} /></ToggleGroupItem></ToggleGroup>
      </div>
      {syncError && <div className="notice error"><span>{syncError}。已保留上次同步的数据。</span><button onClick={() => setSyncError('')}><X size={15} /></button></div>}
      {syncing && !cache ? <div className="center-loading"><Spinner /><span>正在读取公开收藏…</span></div> : items.length === 0 ? <EmptyState icon={<Search size={24} />} title={cache ? '没有匹配的条目' : '收藏尚未同步'} description={cache ? '换一个关键词或筛选条件试试。' : '点击刷新，从 Bangumi 拉取你的公开收藏。'} action={!cache ? <Button className="button primary" onClick={() => void sync()}>开始同步</Button> : undefined} /> :
        <div className={`collection-${view}`}>{items.map((item) => <CollectionCard key={item.subjectId} item={item} view={view} onClick={() => setSelected(item)} />)}</div>}
      {cache && <div className="sync-caption">上次同步：{formatDate(cache.syncedAt, true)} · 仅包含公开收藏</div>}
    </>}

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

function CollectionCard({ item, view, onClick }: { item: BangumiCollectionItem; view: ViewMode; onClick: () => void }) {
  return <button className="collection-card" onClick={onClick}>
    <div className="collection-cover">{item.cover ? <img src={item.cover} alt="" loading="lazy" /> : <div className="cover-placeholder"><Sparkles /></div>}<span className="type-chip">{SUBJECT_LABELS[item.subjectType]}</span></div>
    <div className="collection-info"><h3>{item.nameCn || item.name}</h3>{view === 'list' && <p>{item.summary || item.name}</p>}<div className="collection-meta"><span>{COLLECTION_LABELS[item.collectionType]}</span><span>{item.score ? `★ ${item.score}` : '暂无评分'}</span></div></div>
  </button>
}
