import type { CountdownEvent, ImageAsset } from '../shared/types'

type LegacyCountdownEvent = Omit<CountdownEvent, 'coverImagePath'> & { coverImageId?: string; coverImagePath?: string }

export function normalizeCountdowns(events: LegacyCountdownEvent[], imageAssets: ImageAsset[] = []): CountdownEvent[] {
  const assetPaths = new Map(imageAssets.map((asset) => [asset.id, asset.path]))
  return events.map((event) => {
    const { coverImageId, ...current } = event
    return {
      ...current,
      targetTime: event.targetTime ?? '09:00',
      precise: event.precise ?? false,
      repeat: event.repeat ?? (event.yearly ? 'yearly' : 'none'),
      mode: event.mode ?? 'auto',
      includeStartDay: event.includeStartDay ?? false,
      accent: event.accent ?? 'neutral',
      coverImagePath: event.coverImagePath || (coverImageId ? assetPaths.get(coverImageId) ?? '' : ''),
    }
  })
}
