import type { DeskCompanionCharacter } from './types'

export const DESK_COMPANION_PRESETS: readonly DeskCompanionCharacter[] = [
  {
    id: 'default-companion',
    name: '蓝色大肥鱼',
    image: 'resources/fun/desk-companion/companion.png',
    dialogues: [
      'Token……吃饱了。',
      '我不是大肥鱼！',
      '今天是梁文峰……少吃一点 Token 好了。',
      '今天是梁文谷……可以大吃特吃。',
      '不准看鱼片……',
      'DeepSleep……',
      '深度睡眠……',
      'Token……',
      'Token……',
    ],
    pressSound: 'resources/fun/desk-companion/press.mp3',
    pressSoundName: '默认按下音',
    releaseSound: 'resources/fun/desk-companion/release.mp3',
    releaseSoundName: '默认松开音',
  },
  {
    id: 'companion-columbina',
    name: '哥伦比娅',
    image: 'resources/fun/desk-companion/companion-columbina.png',
    dialogues: [
      '嘘……听，月光正在唱歌。',
      '累了吗？那就和我一起稍微休息一下吧。',
      '不用着急，我会陪着你的。',
      '嘘……桑多涅要哈气了。',
      '今晚的月亮很好看……陪我待一会儿吧。',
      '旅行者，刚才是在想我吗？',
      '要陪我玩一会儿吗？'
    ],
    pressSound: 'resources/fun/desk-companion/press.mp3',
    pressSoundName: '默认按下音',
    releaseSound: 'resources/fun/desk-companion/release.mp3',
    releaseSoundName: '默认松开音',
  },
  {
    id: 'companion-pandora',
    name: '潘多拉',
    image: 'resources/fun/desk-companion/pandora-companion.png',
    dialogues: [
      '嘘……听，月光正在唱歌。',
      '累了吗？那就和我一起稍微休息一下吧。',
      '不用着急，我会陪着你的。',
      '嘘……桑多涅要哈气了。',
      '今晚的月亮很好看……陪我待一会儿吧。',
      '旅行者，刚才是在想我吗？',
      '要陪我玩一会儿吗？'
    ],
    pressSound: 'resources/fun/desk-companion/press.mp3',
    pressSoundName: '默认按下音',
    releaseSound: 'resources/fun/desk-companion/release.mp3',
    releaseSoundName: '默认松开音',
  },
]

export function createDeskCompanionPreset(id: string): DeskCompanionCharacter | undefined {
  const preset = DESK_COMPANION_PRESETS.find((item) => item.id === id)
  return preset && { ...preset, dialogues: [...preset.dialogues] }
}
