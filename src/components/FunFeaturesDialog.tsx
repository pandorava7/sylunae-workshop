import { Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

export function FunFeaturesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="sm" className="fun-features-dialog">
      <DialogHeader>
        <DialogTitle>趣味功能</DialogTitle>
        <DialogDescription>为丝月工坊留一点轻松、有趣的小角落。</DialogDescription>
      </DialogHeader>
      <div className="fun-features-coming-soon">
        <span><Sparkles size={23} strokeWidth={1.7} /></span>
        <strong>即将开放</strong>
      </div>
    </DialogContent>
  </Dialog>
}
