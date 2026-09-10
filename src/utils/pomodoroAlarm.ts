let audioContext: AudioContext | null = null
let customAlarmPath = ''
let customAlarmBuffer: AudioBuffer | null = null

function context() {
  audioContext ??= new AudioContext()
  return audioContext
}

export function unlockPomodoroAlarm() {
  if (!window.sylunae) return
  const current = context()
  if (current.state === 'suspended') void current.resume()
}

function playDefaultAlarm(current: AudioContext) {
  const startedAt = current.currentTime + 0.04
  ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
    const at = startedAt + index * 0.46
    const gain = current.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.13, at + 0.035)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)
    gain.connect(current.destination)

    const fundamental = current.createOscillator()
    fundamental.type = 'sine'
    fundamental.frequency.setValueAtTime(frequency, at)
    fundamental.connect(gain)
    fundamental.start(at)
    fundamental.stop(at + 1.12)

    const overtone = current.createOscillator()
    const overtoneGain = current.createGain()
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(frequency * 2.01, at)
    overtoneGain.gain.setValueAtTime(0.16, at)
    overtone.connect(overtoneGain)
    overtoneGain.connect(gain)
    overtone.start(at)
    overtone.stop(at + 0.72)
  })
}

async function playCustomAlarm(current: AudioContext, path: string) {
  const url = await window.sylunae?.system.getPomodoroAlarmUrl(path)
  if (!url) throw new Error('提示音文件不可用')
  if (customAlarmPath !== path || !customAlarmBuffer) {
    customAlarmBuffer = await current.decodeAudioData(await (await fetch(url)).arrayBuffer())
    customAlarmPath = path
  }
  const gain = current.createGain()
  gain.gain.value = 0.58
  gain.connect(current.destination)
  const source = current.createBufferSource()
  source.buffer = customAlarmBuffer
  source.connect(gain)
  source.start()
}

export function playPomodoroAlarm(path = '') {
  if (!window.sylunae) return
  const current = context()
  const play = () => {
    if (!path) { playDefaultAlarm(current); return }
    void playCustomAlarm(current, path).catch(() => playDefaultAlarm(current))
  }
  if (current.state === 'suspended') void current.resume().then(play).catch(() => undefined)
  else play()
}
