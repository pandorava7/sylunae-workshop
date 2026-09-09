import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface AudioWaveformProps {
  media: HTMLAudioElement | null
  src: string
}

function waveformColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    cursorColor: styles.getPropertyValue('--brand').trim(),
    progressColor: styles.getPropertyValue('--brand').trim(),
    waveColor: styles.getPropertyValue('--faint').trim(),
  }
}

export function AudioWaveform({ media, src }: AudioWaveformProps) {
  const container = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const loadedSrc = useRef('')
  const loadVersion = useRef(0)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!container.current || !media) return

    const version = ++loadVersion.current
    loadedSrc.current = src
    setLoading(true)
    setUnavailable(false)

    const instance = WaveSurfer.create({
      container: container.current,
      media,
      height: 64,
      cursorWidth: 1,
      dragToSeek: true,
      fillParent: true,
      hideScrollbar: true,
      normalize: true,
      ...waveformColors(),
    })
    wavesurfer.current = instance

    const stopReadyListener = instance.once('ready', () => {
      if (loadVersion.current === version) setLoading(false)
    })
    const stopErrorListener = instance.once('error', () => {
      if (loadVersion.current === version) {
        setLoading(false)
        setUnavailable(true)
      }
    })

    const themeObserver = new MutationObserver(() => instance.setOptions(waveformColors()))
    themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'], attributes: true })

    return () => {
      themeObserver.disconnect()
      stopReadyListener()
      stopErrorListener()
      instance.destroy()
      wavesurfer.current = null
      loadedSrc.current = ''
    }
  }, [media])

  useEffect(() => {
    const instance = wavesurfer.current
    if (!instance || !src || loadedSrc.current === src) return

    const version = ++loadVersion.current
    loadedSrc.current = src
    setLoading(true)
    setUnavailable(false)
    void instance.load(src).then(() => {
      if (loadVersion.current === version) setLoading(false)
    }).catch(() => {
      if (loadVersion.current === version) {
        setLoading(false)
        setUnavailable(true)
      }
    })
  }, [media, src])

  return <div className={`audio-waveform ${loading ? 'loading' : ''} ${unavailable ? 'unavailable' : ''}`} aria-label="当前歌曲波形，可点击跳转播放位置">
    <div ref={container} className="audio-waveform-canvas" />
    {loading && <span className="audio-waveform-status">正在生成波形</span>}
    {unavailable && <span className="audio-waveform-status">波形暂不可用</span>}
  </div>
}
