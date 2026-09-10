import type { ImageAsset, ImageCollection, ImageLibraryRoot, ImageLibraryState } from '../shared/types'

type LegacyImageRoot = Omit<ImageLibraryRoot, 'collectionId'> & { collectionId?: string | null }
type LegacyImageAsset = Omit<ImageAsset, 'rootId' | 'collectionIds'> & { rootId?: string | null; collectionIds?: string[] }
type LegacyImageLibrary = Partial<Omit<ImageLibraryState, 'roots' | 'assets'>> & {
  roots?: LegacyImageRoot[]
  assets?: LegacyImageAsset[]
}

function legacyCollectionId(rootId: string): string {
  return `legacy-root:${rootId}`
}

export function normalizeImageLibrary(input?: LegacyImageLibrary | null): ImageLibraryState {
  const sourceRoots = input?.roots ?? []
  const suppliedCollections = input?.collections ?? []
  const collectionById = new Map<string, ImageCollection>(suppliedCollections.map((collection) => [collection.id, { ...collection }]))

  const roots: ImageLibraryRoot[] = sourceRoots.map((root) => {
    const collectionId = root.collectionId === undefined ? legacyCollectionId(root.id) : root.collectionId
    if (collectionId && !collectionById.has(collectionId)) {
      collectionById.set(collectionId, {
        id: collectionId,
        name: root.name,
        createdAt: root.createdAt,
        updatedAt: root.updatedAt,
      })
    }
    return { ...root, collectionId }
  })

  const validCollectionIds = new Set(collectionById.keys())
  const assets: ImageAsset[] = (input?.assets ?? []).map((asset) => {
    const migratedIds = asset.collectionIds ?? (asset.rootId ? [legacyCollectionId(asset.rootId)] : [])
    return {
      ...asset,
      rootId: asset.rootId ?? null,
      collectionIds: [...new Set(migratedIds.filter((id) => validCollectionIds.has(id)))],
    }
  })

  return { roots, collections: [...collectionById.values()], assets }
}
