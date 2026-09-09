import { useEffect, useRef, useState } from 'react'
import { BookOpen, Images, Rss, Sparkles } from 'lucide-react'
import { LibraryPage } from './LibraryPage'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

type CollectionView = 'bangumi' | 'images' | 'rss'

export function CollectionPage() {
  const [view, setView] = useState<CollectionView>('bangumi')
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }) }, [view])
  return <section ref={pageRef} className="page collection-hub-page">
    <header className="page-header"><div><span className="eyebrow">COLLECTION</span><h1>收藏馆</h1><p>收拢喜欢的作品、画面与持续关注的内容</p></div></header>
    <Tabs value={view} onValueChange={(value) => setView(value as CollectionView)} className="workspace-tabs">
      <TabsList className="workspace-tab-list"><TabsTrigger value="bangumi"><BookOpen size={16} />Bangumi</TabsTrigger><TabsTrigger value="images"><Images size={16} />精选图片<span className="soon-badge">即将推出</span></TabsTrigger><TabsTrigger value="rss"><Rss size={16} />RSS 订阅<span className="soon-badge">即将推出</span></TabsTrigger></TabsList>
    </Tabs>
    {view === 'bangumi' ? <LibraryPage embedded /> : <CollectionPlaceholder type={view} />}
  </section>
}

function CollectionPlaceholder({ type }: { type: Exclude<CollectionView, 'bangumi'> }) {
  const images = type === 'images'
  return <div className="collection-placeholder"><div className="placeholder-visual" aria-hidden>{images ? <><span /><span /><span /></> : <><i /><i /><i /></>}</div><div><span className="soon-badge large">即将推出</span><h2>{images ? '精选图片' : 'RSS 订阅'}</h2><p>{images ? '把一眼心动的画面收进私人展厅，之后可以按主题浏览与整理。' : '订阅喜欢的站点与作者，在一个安静的阅读空间里跟进新内容。'}</p><div className="placeholder-note"><Sparkles size={16} />入口已经为它留好位置，功能会在后续版本中开放。</div></div></div>
}
