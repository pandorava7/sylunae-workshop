import type { ThemePalette, ThemePalettes } from './types'

export const themeColorFields: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'bg', label: '页面背景' },
  { key: 'surface', label: '主要容器' },
  { key: 'surface2', label: '次级容器' },
  { key: 'surface3', label: '强调容器' },
  { key: 'sidebarBg', label: '侧边栏' },
  { key: 'text', label: '主要文字' },
  { key: 'mutedText', label: '次要文字' },
  { key: 'faint', label: '弱化文字' },
  { key: 'line', label: '边框分隔线' },
  { key: 'brand', label: '品牌主色' },
  { key: 'accentSoft', label: '浅强调色' },
  { key: 'accentDeep', label: '深强调色' },
  { key: 'danger', label: '危险状态' },
  { key: 'dangerSoft', label: '危险背景' },
  { key: 'success', label: '成功状态' },
  { key: 'successSoft', label: '成功背景' },
]

export const themeCssVariables: Record<keyof ThemePalette, string> = {
  bg: '--bg', surface: '--surface', surface2: '--surface-2', surface3: '--surface-3', sidebarBg: '--sidebar-bg',
  text: '--text', mutedText: '--muted-text', faint: '--faint', line: '--line', brand: '--brand',
  accentSoft: '--accent-soft', accentDeep: '--accent-deep', danger: '--danger', dangerSoft: '--danger-soft',
  success: '--success', successSoft: '--success-soft',
}

export const themeDerivedCssVariables = {
  primaryForeground: '--primary-foreground',
  destructiveForeground: '--destructive-foreground',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
} as const

export interface ThemeContrastIssue {
  mode: 'light' | 'dark'
  foreground: string
  background: string
  ratio: number
  minimum: number
}

export const defaultThemePalettes: ThemePalettes = {
  light: {
    bg: '#f7f7f7', surface: '#ffffff', surface2: '#f3f3f3', surface3: '#e9e9e9', sidebarBg: '#f7f7f7',
    text: '#202020', mutedText: '#6f6f6f', faint: '#9b9b9b', line: '#e5e5e5', brand: '#2f2f2f',
    accentSoft: '#eeeeee', accentDeep: '#171717', danger: '#c94a4a', dangerSoft: '#f9eaea',
    success: '#4f8060', successSoft: '#eaf3ed',
  },
  dark: {
    bg: '#171717', surface: '#1f1f1f', surface2: '#292929', surface3: '#333333', sidebarBg: '#1b1b1b',
    text: '#ededed', mutedText: '#a1a1a1', faint: '#6f6f6f', line: '#333333', brand: '#ededed',
    accentSoft: '#2c2c2c', accentDeep: '#ffffff', danger: '#df7070', dangerSoft: '#382323',
    success: '#76a985', successSoft: '#233128',
  },
}

const legacyDefaultThemePalettes: ThemePalettes = {
  light: {
    bg: '#f6f4f0', surface: '#fbfaf8', surface2: '#f0ede8', surface3: '#e9e5df', sidebarBg: '#eeebe6',
    text: '#292724', mutedText: '#817c75', faint: '#aaa49c', line: '#dfdbd4', brand: '#83749d',
    accentSoft: '#e9e3ef', accentDeep: '#655678', danger: '#b65d5d', dangerSoft: '#f5e6e4',
    success: '#5f826b', successSoft: '#e4eee6',
  },
  dark: {
    bg: '#171716', surface: '#1e1d1c', surface2: '#272523', surface3: '#302e2b', sidebarBg: '#1b1a19',
    text: '#e9e6e1', mutedText: '#a6a099', faint: '#77716b', line: '#373430', brand: '#a99abd',
    accentSoft: '#332d3b', accentDeep: '#c4b5d4', danger: '#d47d79', dangerSoft: '#3c2928',
    success: '#83ad90', successSoft: '#26352a',
  },
}

const colorPattern = /^#[0-9a-f]{6}$/i

function rgb(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function luminance(color: string) {
  return rgb(color).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0)
}

export function contrastRatio(foreground: string, background: string) {
  const [first, second] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (first + 0.05) / (second + 0.05)
}

export function accessibleForeground(...backgrounds: string[]) {
  const candidateScore = (foreground: string) => Math.min(...backgrounds.map((background) => contrastRatio(foreground, background)))
  return candidateScore('#ffffff') >= candidateScore('#202020') ? '#ffffff' : '#202020'
}

export function getThemeContrastIssues(palettes: ThemePalettes): ThemeContrastIssue[] {
  const issues: ThemeContrastIssue[] = []
  const checks: Array<{ foreground: keyof ThemePalette; backgrounds: Array<keyof ThemePalette>; minimum: number }> = [
    { foreground: 'text', backgrounds: ['bg', 'surface', 'surface2', 'surface3', 'sidebarBg'], minimum: 4.5 },
    { foreground: 'mutedText', backgrounds: ['bg', 'surface', 'surface2', 'surface3', 'sidebarBg'], minimum: 3 },
    { foreground: 'faint', backgrounds: ['bg', 'surface', 'surface2', 'surface3', 'sidebarBg'], minimum: 1.8 },
    { foreground: 'brand', backgrounds: ['bg', 'surface', 'accentSoft'], minimum: 3 },
    { foreground: 'accentDeep', backgrounds: ['accentSoft'], minimum: 3 },
    { foreground: 'danger', backgrounds: ['dangerSoft', 'surface'], minimum: 3 },
    { foreground: 'success', backgrounds: ['successSoft'], minimum: 3 },
  ]
  for (const mode of ['light', 'dark'] as const) {
    const palette = palettes[mode]
    for (const check of checks) {
      for (const background of check.backgrounds) {
        const ratio = contrastRatio(palette[check.foreground], palette[background])
        if (ratio < check.minimum) issues.push({ mode, foreground: check.foreground, background, ratio, minimum: check.minimum })
      }
    }
    const primaryForeground = accessibleForeground(palette.brand, palette.accentDeep)
    for (const background of ['brand', 'accentDeep'] as const) {
      const ratio = contrastRatio(primaryForeground, palette[background])
      if (ratio < 4.2) issues.push({ mode, foreground: 'primaryForeground', background, ratio, minimum: 4.2 })
    }
  }
  return issues
}

export function themeContrastMessage(issues: ThemeContrastIssue[]) {
  const first = issues[0]
  const derivedLabels: Record<string, string> = { primaryForeground: '主按钮文字' }
  const field = themeColorFields.find(({ key }) => key === first.foreground)?.label ?? derivedLabels[first.foreground] ?? first.foreground
  const background = themeColorFields.find(({ key }) => key === first.background)?.label ?? first.background
  const mode = first.mode === 'light' ? '浅色' : '深色'
  const suffix = issues.length > 1 ? `，另有 ${issues.length - 1} 项` : ''
  return `${mode}配色的「${field} / ${background}」对比度仅 ${first.ratio.toFixed(1)}:1，需至少 ${first.minimum}:1${suffix}。`
}

export function normalizeThemePalettes(value?: Partial<Record<'light' | 'dark', Partial<ThemePalette>>>): ThemePalettes {
  return {
    light: { ...defaultThemePalettes.light, ...value?.light },
    dark: { ...defaultThemePalettes.dark, ...value?.dark },
  }
}

export function migrateDefaultThemePalettes(value?: Partial<Record<'light' | 'dark', Partial<ThemePalette>>>): ThemePalettes {
  const palettes = normalizeThemePalettes(value)
  const isLegacyDefault = (['light', 'dark'] as const).every((mode) =>
    themeColorFields.every(({ key }) => palettes[mode][key] === legacyDefaultThemePalettes[mode][key]))
  return isLegacyDefault ? defaultThemePalettes : palettes
}

export function serializeThemePalettes(palettes: ThemePalettes): string {
  const block = (selector: string, palette: ThemePalette) => `${selector} {\n${themeColorFields.map(({ key }) => `  ${themeCssVariables[key]}: ${palette[key]};`).join('\n')}\n}`
  return `/* 丝月工坊全局配色：只修改 #RRGGBB 色码；不要添加 --primary-foreground 或 --destructive-foreground，按钮文字由系统自动计算。 */\n\n${block(':root', palettes.light)}\n\n${block(":root[data-theme='dark']", palettes.dark)}`
}

export function parseThemePalettes(css: string, current: ThemePalettes): ThemePalettes {
  const next = normalizeThemePalettes(current)
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  if (!blocks.length) throw new Error('没有找到可用的 CSS 色板代码。')

  let changed = 0
  for (const [, selector, declarations] of blocks) {
    const mode = selector.includes('dark') ? 'dark' : selector.includes(':root') ? 'light' : null
    if (!mode) continue
    for (const { key } of themeColorFields) {
      const variable = themeCssVariables[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = declarations.match(new RegExp(`${variable}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;?`))
      if (match && colorPattern.test(match[1])) {
        next[mode][key] = match[1].toLowerCase()
        changed += 1
      }
    }
  }
  if (!changed) throw new Error('没有识别到支持的颜色变量，请保留变量名并使用六位十六进制色码。')
  return next
}
