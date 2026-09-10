import { bangumiCoverCache } from './repository'

/**
 * Returns a locally cached object URL when possible. Network or CORS failures
 * deliberately fall back to the Bangumi URL, so a cover never blocks the page.
 */
export async function loadBangumiCover(url: string): Promise<string> {
  try {
    const cached = await bangumiCoverCache.get(url)
    if (cached) return URL.createObjectURL(cached)

    const response = await fetch(url)
    if (!response.ok) return url
    const blob = await response.blob()
    if (!blob.size) return url
    await bangumiCoverCache.put(url, blob)
    return URL.createObjectURL(blob)
  } catch {
    return url
  }
}

export async function clearBangumiCoverCache(): Promise<void> {
  await bangumiCoverCache.clear()
}
