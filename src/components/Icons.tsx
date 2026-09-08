import { MoonStar } from 'lucide-react'

export function BrandMark({ small = false }: { small?: boolean }) {
  return <div className={small ? 'brand-mark small' : 'brand-mark'}><MoonStar size={small ? 15 : 20} strokeWidth={1.8} /></div>
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
}

export function Spinner() { return <span className="spinner" aria-label="加载中" /> }
