import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { DeskCompanionSettings } from '../shared/types'

const POSITION_KEY = 'fun.deskCompanion.position'
const BUBBLE_DURATION = 5_000
const MOVE_THRESHOLD = 4

type HorizontalAnchor = 'left' | 'right' | 'free'
type VerticalAnchor = 'top' | 'bottom' | 'free'
interface Position { x: number; y: number; horizontal: HorizontalAnchor; vertical: VerticalAnchor }
interface DragState { pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean }
interface SoundBuffers { press: AudioBuffer | null; release: AudioBuffer | null }

function widgetSize(scale: number) { return Math.round(250 * scale) }

function clampPosition(position: Position, size: number): Position {
  return {
    ...position,
    x: Math.min(Math.max(0, position.x), Math.max(0, window.innerWidth - size)),
    y: Math.min(Math.max(0, position.y), Math.max(0, window.innerHeight - size)),
  }
}

function applyAnchors(position: Position, size: number): Position {
  const clamped = clampPosition(position, size)
  const maxX = Math.max(0, window.innerWidth - size)
  const maxY = Math.max(0, window.innerHeight - size)
  return {
    ...clamped,
    x: clamped.horizontal === 'left' ? 0 : clamped.horizontal === 'right' ? maxX : clamped.x,
    y: clamped.vertical === 'top' ? 0 : clamped.vertical === 'bottom' ? maxY : clamped.y,
  }
}

function initialPosition(size: number): Position {
  try {
    const stored = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? 'null') as Partial<Position> | null
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      const maxX = Math.max(0, window.innerWidth - size)
      const maxY = Math.max(0, window.innerHeight - size)
      const horizontal: HorizontalAnchor = stored.horizontal === 'left' || stored.horizontal === 'right' || stored.horizontal === 'free'
        ? stored.horizontal
        : stored.x! <= 12 ? 'left' : maxX - stored.x! <= 12 ? 'right' : 'free'
      const vertical: VerticalAnchor = stored.vertical === 'top' || stored.vertical === 'bottom' || stored.vertical === 'free'
        ? stored.vertical
        : stored.y! <= 12 ? 'top' : maxY - stored.y! <= 12 ? 'bottom' : 'free'
      return applyAnchors({ x: stored.x!, y: stored.y!, horizontal, vertical }, size)
    }
  } catch { /* Ignore an invalid legacy position. */ }
  return { x: Math.max(0, window.innerWidth - size), y: Math.max(0, window.innerHeight - size), horizontal: 'right', vertical: 'bottom' }
}

async function decodeSound(context: AudioContext, source: string): Promise<AudioBuffer | null> {
  if (!source) return null
  const response = await fetch(source)
  if (!response.ok) throw new Error(`Unable to load sound: ${response.status}`)
  return context.decodeAudioData(await response.arrayBuffer())
}

export function DeskCompanion({ settings }: { settings: DeskCompanionSettings }) {
  const character = settings.characters.find((item) => item.id === settings.activeCharacterId) ?? settings.characters[0]
  const size = widgetSize(settings.scale)
  const [position, setPosition] = useState<Position>(() => initialPosition(size))
  const [pressed, setPressed] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const drag = useRef<DragState | null>(null)
  const bubbleTimer = useRef<number | null>(null)
  const wasEnabled = useRef(false)
  const hasShownLine = useRef(false)
  const audioContext = useRef<AudioContext | null>(null)
  const soundBuffers = useRef<SoundBuffers>({ press: null, release: null })
  const playingSources = useRef(new Set<AudioBufferSourceNode>())
  const pressEndsAt = useRef(0)

  useEffect(() => {
    const context = new AudioContext({ latencyHint: 'interactive' })
    let cancelled = false
    audioContext.current = context
    soundBuffers.current = { press: null, release: null }
    void Promise.all([
      decodeSound(context, character?.pressSound ?? '').catch(() => null),
      decodeSound(context, character?.releaseSound ?? '').catch(() => null),
    ]).then(([press, release]) => {
      if (!cancelled) soundBuffers.current = { press, release }
    })
    return () => {
      cancelled = true
      for (const source of playingSources.current) {
        try { source.stop() } catch { /* The source may already have ended. */ }
      }
      playingSources.current.clear()
      soundBuffers.current = { press: null, release: null }
      if (audioContext.current === context) audioContext.current = null
      void context.close()
    }
  }, [character?.id, character?.pressSound, character?.releaseSound])

  const startSound = (kind: keyof SoundBuffers, when: number) => {
    const context = audioContext.current
    const buffer = soundBuffers.current[kind]
    if (!context || !buffer) return
    if (context.state === 'suspended') void context.resume()
    const source = context.createBufferSource()
    const gain = context.createGain()
    gain.gain.value = 0.34
    source.buffer = buffer
    source.connect(gain).connect(context.destination)
    playingSources.current.add(source)
    source.onended = () => playingSources.current.delete(source)
    source.start(when)
  }

  const playPress = () => {
    const context = audioContext.current
    if (!context) return
    for (const source of playingSources.current) {
      try { source.stop() } catch { /* The source may already have ended. */ }
    }
    playingSources.current.clear()
    const buffer = soundBuffers.current.press
    pressEndsAt.current = buffer ? context.currentTime + buffer.duration : context.currentTime
    startSound('press', context.currentTime)
  }

  const playReleaseAfterPress = () => {
    const context = audioContext.current
    if (!context) return
    startSound('release', Math.max(context.currentTime, pressEndsAt.current))
  }

  const showNextLine = () => {
    if (!character?.dialogues.length) return
    setLineIndex((current) => {
      if (!hasShownLine.current) {
        hasShownLine.current = true
        return 0
      }
      if (settings.dialogueMode === 'random' && character.dialogues.length > 1) {
        return (current + 1 + Math.floor(Math.random() * (character.dialogues.length - 1))) % character.dialogues.length
      }
      return (current + 1) % character.dialogues.length
    })
    setBubbleOpen(true)
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubbleOpen(false), BUBBLE_DURATION)
  }

  useEffect(() => {
    if (settings.enabled && !wasEnabled.current && character?.dialogues.length) {
      const timer = window.setTimeout(showNextLine, 450)
      wasEnabled.current = true
      return () => window.clearTimeout(timer)
    }
    wasEnabled.current = settings.enabled
  }, [settings.enabled])

  useEffect(() => {
    hasShownLine.current = false
    setLineIndex(0)
    setBubbleOpen(false)
  }, [character?.id])

  useEffect(() => {
    const onResize = () => setPosition((current) => applyAnchors(current, size))
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [size])

  useEffect(() => () => { if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current) }, [])

  if (!settings.enabled || !character) return null

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false }
    setPressed(true)
    playPress()
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const completed = drag.current
    drag.current = null
    setPressed(false)
    playReleaseAfterPress()
    if (!completed.moved) {
      showNextLine()
      return
    }
    setPosition((current) => {
      const centerX = current.x + size / 2
      const centerY = current.y + size / 2
      const horizontal = centerX < window.innerWidth / 4
        ? 0
        : centerX > window.innerWidth * .75 ? Math.max(0, window.innerWidth - size) : current.x
      const vertical = centerY < window.innerHeight / 4
        ? 0
        : centerY > window.innerHeight * .75 ? Math.max(0, window.innerHeight - size) : current.y
      const horizontalAnchor: HorizontalAnchor = centerX < window.innerWidth / 4 ? 'left' : centerX > window.innerWidth * .75 ? 'right' : 'free'
      const verticalAnchor: VerticalAnchor = centerY < window.innerHeight / 4 ? 'top' : centerY > window.innerHeight * .75 ? 'bottom' : 'free'
      const snapped = applyAnchors({ x: horizontal, y: vertical, horizontal: horizontalAnchor, vertical: verticalAnchor }, size)
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(snapped))
      return snapped
    })
  }

  const side = position.x + size / 2 < window.innerWidth / 2 ? 'left' : 'right'
  const line = character.dialogues[lineIndex % Math.max(1, character.dialogues.length)]

  return <aside
    className="desk-companion"
    data-side={side}
    data-pressed={pressed || undefined}
    style={{ left: position.x, top: position.y, width: size, height: size, '--companion-u': `${size / 1026}px` } as CSSProperties}
    aria-label="桌面小伙伴"
  >
    <button
      type="button"
      className="desk-companion-character"
      aria-label="拖动小伙伴，或点击听听它想说什么"
      onPointerDown={onPointerDown}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const dx = event.clientX - current.startX
        const dy = event.clientY - current.startY
        if (Math.hypot(dx, dy) >= MOVE_THRESHOLD) current.moved = true
        setPosition(clampPosition({ x: current.originX + dx, y: current.originY + dy, horizontal: 'free', vertical: 'free' }, size))
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <img src={character.image} alt="" draggable={false} />
    </button>
    {line && <button
      type="button"
      className="desk-companion-bubble"
      data-open={bubbleOpen || undefined}
      aria-hidden={!bubbleOpen}
      tabIndex={bubbleOpen ? 0 : -1}
      onClick={showNextLine}
      title="点击切换下一句"
    >
      <svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path className="desk-companion-bubble-shape" fill="#fff" stroke="#203170" strokeWidth="18" strokeLinejoin="round" strokeLinecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z" />
        <ellipse className="desk-companion-bubble-one" cx="352" cy="561" rx="37.5" ry="26" fill="#fff" stroke="#203170" strokeWidth="18" />
        <ellipse className="desk-companion-bubble-two" cx="442" cy="646" rx="24.5" ry="18" fill="#fff" stroke="#203170" strokeWidth="18" />
      </svg>
      <span className="desk-companion-text">{line}</span>
    </button>}
  </aside>
}
