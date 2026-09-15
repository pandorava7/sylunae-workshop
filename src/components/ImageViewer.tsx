import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RefreshCcw, X } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

interface ImageViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src?: string
  originalSrc?: string
  alt: string
}

const MIN_SCALE = 1
const MAX_SCALE = 5
const SCALE_STEP = 0.25

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function ImageViewer({ open, onOpenChange, src, originalSrc, alt }: ImageViewerProps) {
  const [scale, setScale] = useState(MIN_SCALE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    if (!open) return
    setScale(MIN_SCALE)
    setOffset({ x: 0, y: 0 })
    setDragging(false)
    dragStartRef.current = null
  }, [open, src])

  useEffect(() => {
    if (!open || !originalSrc || originalSrc === src) return
    const image = new Image()
    image.src = originalSrc
  }, [open, originalSrc, src])

  const updateScale = (nextValue: number) => {
    const nextScale = clampScale(nextValue)
    setScale(nextScale)
    if (nextScale === MIN_SCALE) setOffset({ x: 0, y: 0 })
  }

  const displayedSrc = scale > MIN_SCALE && originalSrc ? originalSrc : src

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="image-viewer-dialog" size="xl" mobileSize="fullscreen" showCloseButton={false}>
        <div className="image-viewer-toolbar">
          <DialogTitle title={alt}>{alt}</DialogTitle>
          <DialogDescription className="sr-only">可缩放并拖动查看图片细节。</DialogDescription>
          <div className="image-viewer-controls">
            <span aria-live="polite">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" aria-label="缩小图片" title="缩小" disabled={scale <= MIN_SCALE} onClick={() => updateScale(scale - SCALE_STEP)}><Minus /></Button>
            <Button variant="ghost" size="icon" aria-label="恢复原始缩放" title="恢复至 100%" disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0} onClick={() => updateScale(MIN_SCALE)}><RefreshCcw /></Button>
            <Button variant="ghost" size="icon" aria-label="放大图片" title="放大" disabled={scale >= MAX_SCALE} onClick={() => updateScale(scale + SCALE_STEP)}><Plus /></Button>
            <Button variant="ghost" size="icon" aria-label="关闭图片查看器" title="关闭" onClick={() => onOpenChange(false)}><X /></Button>
          </div>
        </div>
        <div
          className={`image-viewer-stage ${scale > MIN_SCALE ? 'zoomed' : ''} ${dragging ? 'dragging' : ''}`}
          onWheel={(event) => {
            event.preventDefault()
            updateScale(scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
          }}
          onDoubleClick={() => updateScale(scale === MIN_SCALE ? 2 : MIN_SCALE)}
          onPointerDown={(event) => {
            if (scale === MIN_SCALE) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const start = dragStartRef.current
            if (!start || start.pointerId !== event.pointerId) return
            setOffset({ x: start.offsetX + event.clientX - start.x, y: start.offsetY + event.clientY - start.y })
          }}
          onPointerUp={(event) => {
            if (dragStartRef.current?.pointerId !== event.pointerId) return
            dragStartRef.current = null
            setDragging(false)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => {
            dragStartRef.current = null
            setDragging(false)
          }}
        >
          {displayedSrc
            ? <img src={displayedSrc} alt={alt} draggable={false} style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }} />
            : <span className="image-viewer-loading"><RefreshCcw className="spin" />正在生成清晰预览…</span>}
        </div>
        <p className="image-viewer-help">滚轮缩放 · 双击切换 · 放大后拖动</p>
      </DialogContent>
    </Dialog>
  )
}
