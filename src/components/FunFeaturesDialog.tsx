import { useEffect, useRef, useState, type RefObject } from 'react'
import { Check, ImagePlus, MessageCircleMore, Play, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { DeskCompanionCharacter } from '../shared/types'
import { DESK_COMPANION_PRESETS, createDeskCompanionPreset } from '../shared/deskCompanionPresets'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Textarea } from './ui/textarea'
import { ConfirmDialog } from './ConfirmDialog'

const defaultImage = 'resources/fun/desk-companion/companion.png'
const defaultPressSound = 'resources/fun/desk-companion/press.mp3'
const defaultReleaseSound = 'resources/fun/desk-companion/release.mp3'
const effect1PressSound = 'resources/fun/desk-companion/effect1-press.mp3'
const effect1ReleaseSound = 'resources/fun/desk-companion/effect1-release.mp3'
const metalPipeSound = 'resources/fun/desk-companion/metal-pipe.wav'

type SoundPreset = 'duck' | 'effect1' | 'metal-pipe' | 'silent' | 'custom'

function currentSoundPreset(character: DeskCompanionCharacter): SoundPreset {
  if (character.pressSound === defaultPressSound && character.releaseSound === defaultReleaseSound) return 'duck'
  if (character.pressSound === effect1PressSound && character.releaseSound === effect1ReleaseSound) return 'effect1'
  if (character.pressSound === metalPipeSound && !character.releaseSound) return 'metal-pipe'
  if (!character.pressSound && !character.releaseSound) return 'silent'
  return 'custom'
}

export function FunFeaturesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { snapshot, update } = useAppStore()
  const companion = snapshot?.settings.deskCompanion
  const activeCharacter = companion?.characters.find((item) => item.id === companion.activeCharacterId) ?? companion?.characters[0]
  const activePreset = activeCharacter && DESK_COMPANION_PRESETS.find((item) => item.id === activeCharacter.id)
  const customCharacterName = Boolean(activeCharacter && (!activePreset || activeCharacter.name !== activePreset.name))
  const customCharacterImage = Boolean(activeCharacter && (!activePreset || activeCharacter.image !== activePreset.image))
  const [nameDraft, setNameDraft] = useState('')
  const [dialogueDraft, setDialogueDraft] = useState('')
  const [assetError, setAssetError] = useState('')
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const feedbackTimer = useRef<number | null>(null)
  const characterInputRef = useRef<HTMLInputElement>(null)
  const pressInputRef = useRef<HTMLInputElement>(null)
  const releaseInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !activeCharacter) return
    setNameDraft(activeCharacter.name)
    setDialogueDraft(activeCharacter.dialogues.join('\n'))
    setAssetError('')
    setSaved(false)
  }, [open, activeCharacter?.id])

  useEffect(() => () => { if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current) }, [])

  if (!companion || !activeCharacter) return null
  const availableCharacters = [
    ...companion.characters,
    ...DESK_COMPANION_PRESETS.filter((preset) => !companion.characters.some((character) => character.id === preset.id)),
  ]

  const patchCompanion = (patch: Partial<typeof companion>) => update((state) => ({
    ...state,
    settings: {
      ...state.settings,
      deskCompanion: { ...state.settings.deskCompanion, ...patch },
      updatedAt: new Date().toISOString(),
    },
  }))

  const patchCharacter = (patch: Partial<DeskCompanionCharacter>) => patchCompanion({
    characters: companion.characters.map((item) => item.id === activeCharacter.id ? { ...item, ...patch } : item),
  })

  const applySoundPreset = (preset: SoundPreset) => {
    if (preset === 'custom') return
    const patch: Partial<DeskCompanionCharacter> = preset === 'duck'
      ? { pressSound: defaultPressSound, pressSoundName: '小黄鸭·按下', releaseSound: defaultReleaseSound, releaseSoundName: '小黄鸭·松开' }
      : preset === 'effect1'
        ? { pressSound: effect1PressSound, pressSoundName: '原插件音效1·按下', releaseSound: effect1ReleaseSound, releaseSoundName: '原插件音效1·松开' }
        : preset === 'metal-pipe'
          ? { pressSound: metalPipeSound, pressSoundName: '钢管落地', releaseSound: '', releaseSoundName: '' }
          : { pressSound: '', pressSoundName: '', releaseSound: '', releaseSoundName: '' }
    patchCharacter(patch)
  }

  const addCharacter = () => {
    const character: DeskCompanionCharacter = {
      id: crypto.randomUUID(),
      name: `小伙伴 ${companion.characters.length + 1}`,
      image: defaultImage,
      dialogues: [],
      pressSound: '',
      pressSoundName: '',
      releaseSound: '',
      releaseSoundName: '',
    }
    patchCompanion({ characters: [...companion.characters, character], activeCharacterId: character.id })
  }

  const selectCharacter = (characterId: string) => {
    const existing = companion.characters.find((item) => item.id === characterId)
    if (existing) {
      patchCompanion({ activeCharacterId: existing.id })
      return
    }
    const character = createDeskCompanionPreset(characterId)
    if (!character || companion.characters.length >= 12) return
    patchCompanion({ characters: [...companion.characters, character], activeCharacterId: character.id })
  }

  const deleteCharacter = () => {
    const characters = companion.characters.filter((item) => item.id !== activeCharacter.id)
    if (!characters.length) return
    patchCompanion({ characters, activeCharacterId: characters[0].id })
  }

  const saveCharacter = () => {
    const dialogues = dialogueDraft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 30)
    const name = nameDraft.trim() || activeCharacter.name
    patchCharacter({ name, dialogues })
    setNameDraft(name)
    setDialogueDraft(dialogues.join('\n'))
    setSaved(true)
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setSaved(false), 1_600)
  }

  const uploadCharacter = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setAssetError('请选择图片文件'); return }
    if (file.size > 8 * 1024 * 1024) { setAssetError('小人图片请勿超过 8 MB'); return }
    try { patchCharacter({ image: await readFile(file) }); setAssetError('') }
    catch { setAssetError('无法读取选中的图片') }
  }

  const uploadSound = async (kind: 'press' | 'release', file?: File) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) { setAssetError('请选择音频文件'); return }
    if (file.size > 5 * 1024 * 1024) { setAssetError('单个音效请勿超过 5 MB'); return }
    try {
      const source = await readFile(file)
      patchCharacter(kind === 'press'
        ? { pressSound: source, pressSoundName: file.name }
        : { releaseSound: source, releaseSoundName: file.name })
      setAssetError('')
    } catch { setAssetError('无法读取选中的音效') }
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" mobileSize="fullscreen" className="fun-features-dialog">
        <DialogHeader>
          <DialogTitle>趣味功能</DialogTitle>
          <DialogDescription>管理你的桌面小伙伴，每个角色都有自己的对话和音效。</DialogDescription>
        </DialogHeader>

        <section className="fun-feature-card">
          <div className="fun-feature-hero">
            <span className="fun-feature-preview"><img className={customCharacterImage ? 'private-media' : undefined} src={activeCharacter.image} alt={`${activeCharacter.name}预览`} /></span>
            <div>
              <span className="fun-feature-kicker"><Sparkles size={13} /> 桌面小伙伴</span>
              <h3 className={customCharacterName ? 'user-content' : undefined}>{activeCharacter.name}</h3>
              <p>拖动贴边，点击后会弹出这个角色的专属台词。</p>
            </div>
            <Button variant={companion.enabled ? 'secondary' : 'default'} onClick={() => patchCompanion({ enabled: !companion.enabled })}>
              {companion.enabled ? '停用' : '激活'}
            </Button>
          </div>

          <div className="fun-feature-settings">
            <div className="fun-character-toolbar">
              <Select value={activeCharacter.id} onValueChange={selectCharacter}>
                <SelectTrigger aria-label="选择小伙伴"><SelectValue className={customCharacterName ? 'user-content' : undefined} /></SelectTrigger>
                <SelectContent>{availableCharacters.map((item) => <SelectItem key={item.id} value={item.id} disabled={companion.characters.length >= 12 && !companion.characters.some((character) => character.id === item.id)}><span className={DESK_COMPANION_PRESETS.some((preset) => preset.id === item.id && preset.name === item.name) ? undefined : 'user-content'}>{item.name}</span></SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addCharacter}><Plus />新增角色</Button>
              <Button type="button" variant="destructive" size="icon" disabled={companion.characters.length <= 1} aria-label="删除当前角色" onClick={() => setDeleteOpen(true)}><Trash2 /></Button>
            </div>

            <label className="fun-feature-field" htmlFor="companion-name"><span>角色名称</span></label>
            <Input id="companion-name" value={nameDraft} maxLength={30} onChange={(event) => { setNameDraft(event.target.value); setSaved(false) }} />

            <label className="fun-feature-field" htmlFor="companion-dialogues">
              <span><MessageCircleMore size={15} /> 专属对话</span>
              <small>每行一句，最多 30 句。留空时点击只播放音效。</small>
            </label>
            <Textarea id="companion-dialogues" value={dialogueDraft} rows={5} placeholder="写下这个角色想说的话…" onChange={(event) => { setDialogueDraft(event.target.value); setSaved(false) }} />

            <div className="fun-feature-control-row">
              <label htmlFor="companion-scale">挂件大小 <strong>{Math.round(companion.scale * 100)}%</strong></label>
              <Slider id="companion-scale" min={0.7} max={1.4} step={0.1} value={[companion.scale]} onValueChange={([scale]) => patchCompanion({ scale })} />
            </div>
            <div className="fun-feature-control-row">
              <label htmlFor="companion-dialogue-mode">对话顺序</label>
              <Select value={companion.dialogueMode} onValueChange={(dialogueMode: 'sequential' | 'random') => patchCompanion({ dialogueMode })}>
                <SelectTrigger id="companion-dialogue-mode"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sequential">依次显示</SelectItem><SelectItem value="random">随机显示</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="fun-feature-control-row">
              <label htmlFor="companion-sound-preset">音效预设</label>
              <Select value={currentSoundPreset(activeCharacter)} onValueChange={(preset: SoundPreset) => applySoundPreset(preset)}>
                <SelectTrigger id="companion-sound-preset"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="duck">小黄鸭（原插件）</SelectItem>
                  <SelectItem value="effect1">音效1（原插件）</SelectItem>
                  <SelectItem value="metal-pipe">钢管落地（仅按下）</SelectItem>
                  <SelectItem value="silent">静音</SelectItem>
                  {currentSoundPreset(activeCharacter) === 'custom' && <SelectItem value="custom">自定义</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="fun-feature-assets">
              <div className="fun-feature-asset-row">
                <span className="fun-feature-asset-icon"><ImagePlus size={16} /></span>
                <div><strong>小人图片</strong><small>{DESK_COMPANION_PRESETS.some((preset) => preset.image === activeCharacter.image) ? '预设角色图片' : '自定义图片'}</small></div>
                <input ref={characterInputRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={(event) => { void uploadCharacter(event.target.files?.[0]); event.currentTarget.value = '' }} />
                <Button type="button" variant="outline" size="sm" onClick={() => characterInputRef.current?.click()}><Upload />上传</Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="恢复默认小人" title="恢复默认" onClick={() => patchCharacter({ image: defaultImage })}><RotateCcw /></Button>
              </div>
              <SoundAssetRow label="按下音效" name={activeCharacter.pressSoundName} source={activeCharacter.pressSound} inputRef={pressInputRef} onUpload={(file) => uploadSound('press', file)} onClear={() => patchCharacter({ pressSound: '', pressSoundName: '' })} onRestore={() => patchCharacter({ pressSound: defaultPressSound, pressSoundName: '默认按下音' })} />
              <SoundAssetRow label="松开音效" name={activeCharacter.releaseSoundName} source={activeCharacter.releaseSound} inputRef={releaseInputRef} onUpload={(file) => uploadSound('release', file)} onClear={() => patchCharacter({ releaseSound: '', releaseSoundName: '' })} onRestore={() => patchCharacter({ releaseSound: defaultReleaseSound, releaseSoundName: '默认松开音' })} />
            </div>

            {assetError && <p className="fun-feature-error">{assetError}</p>}
            <div className="fun-feature-actions">
              <span>{companion.characters.length} 个角色 · {companion.enabled ? '已激活' : '未激活'}</span>
              <Button onClick={saveCharacter} className={saved ? 'fun-feature-saved' : ''}>{saved ? <><Check />已保存</> : '保存当前角色'}</Button>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={deleteOpen} title={<><span>删除“</span><span className={customCharacterName ? 'user-content' : undefined}>{activeCharacter.name}</span><span>”？</span></>} description="该角色的图片、音效和对话将一起删除。" confirmLabel="删除角色" destructive icon={<Trash2 size={20} />} onConfirm={deleteCharacter} onOpenChange={setDeleteOpen} />
  </>
}

function SoundAssetRow({ label, name, source, inputRef, onUpload, onClear, onRestore }: { label: string; name: string; source: string; inputRef: RefObject<HTMLInputElement | null>; onUpload: (file?: File) => void | Promise<void>; onClear: () => void; onRestore: () => void }) {
  return <div className="fun-feature-asset-row">
    <span className="fun-feature-asset-icon"><Play size={15} /></span>
    <div><strong>{label}</strong><small className={source.startsWith('data:') || source.startsWith('blob:') ? 'user-content' : undefined}>{name || '未设置（保持静音）'}</small></div>
    <input ref={inputRef} type="file" accept="audio/*" hidden onChange={(event) => { void onUpload(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <Button type="button" variant="ghost" size="icon-sm" disabled={!source} aria-label={`试听${label}`} title="试听" onClick={() => previewSound(source)}><Play /></Button>
    <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}><Upload />上传</Button>
    <Button type="button" variant="ghost" size="icon-sm" disabled={!source} aria-label={`清空${label}`} title="清空" onClick={onClear}><Trash2 /></Button>
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`恢复默认${label}`} title="恢复默认" onClick={onRestore}><RotateCcw /></Button>
  </div>
}

function previewSound(source: string) { if (source) { const audio = new Audio(source); audio.volume = .34; void audio.play().catch(() => undefined) } }
function readFile(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
