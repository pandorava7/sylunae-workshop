import { describe, expect, it } from 'vitest'
import { normalizeImageLibrary } from '../images/library'

const timestamp = '2026-01-01T00:00:00.000Z'

describe('image library migration', () => {
  it('turns legacy folder roots into internal collections without losing assets', () => {
    const library = normalizeImageLibrary({
      roots: [{
        id: 'root-one', path: 'C:\\Pictures\\Moon', name: '月色', recursive: true,
        identity: '1:2', missing: false, createdAt: timestamp, updatedAt: timestamp, lastScannedAt: timestamp,
      }],
      assets: [{
        id: 'image-one', rootId: 'root-one', path: 'C:\\Pictures\\Moon\\one.png', relativePath: 'one.png',
        name: 'one.png', extension: '.png', size: 100, mtimeMs: 1, width: 100, height: 100,
        aspectType: 'square', identity: '1:3', hash: 'sample-v1:test', missing: false, metadata: {},
        createdAt: timestamp, updatedAt: timestamp,
      }],
    })

    expect(library.collections).toEqual([expect.objectContaining({ id: 'legacy-root:root-one', name: '月色' })])
    expect(library.roots[0].collectionId).toBe('legacy-root:root-one')
    expect(library.assets[0].collectionIds).toEqual(['legacy-root:root-one'])
  })

  it('preserves explicit many-to-many collection membership', () => {
    const library = normalizeImageLibrary({
      collections: [
        { id: 'a', name: 'A', createdAt: timestamp, updatedAt: timestamp },
        { id: 'b', name: 'B', createdAt: timestamp, updatedAt: timestamp },
      ],
      assets: [{
        id: 'image-one', rootId: null, collectionIds: ['a', 'b'], path: 'C:\\Pictures\\one.png', relativePath: 'one.png',
        name: 'one.png', extension: '.png', size: 100, mtimeMs: 1, width: 100, height: 100,
        aspectType: 'square', identity: '1:3', hash: 'sample-v1:test', missing: false, metadata: {},
        createdAt: timestamp, updatedAt: timestamp,
      }],
    })

    expect(library.assets[0].collectionIds).toEqual(['a', 'b'])
  })

  it('does not recreate a deleted legacy collection', () => {
    const library = normalizeImageLibrary({
      roots: [{
        id: 'root-one', path: 'C:\\Pictures\\Moon', name: '月色', recursive: true, collectionId: null,
        identity: '1:2', missing: false, createdAt: timestamp, updatedAt: timestamp, lastScannedAt: timestamp,
      }],
      collections: [],
      assets: [],
    })

    expect(library.collections).toEqual([])
    expect(library.roots[0].collectionId).toBeNull()
  })
})
