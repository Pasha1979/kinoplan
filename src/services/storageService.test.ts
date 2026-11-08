// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pouchStorage } from './storageService'

describe('pouchStorage', () => {
  it('getItem returns pending value before debounced write lands', async () => {
    await pouchStorage.setItem('test-pending', 'v1')
    expect(await pouchStorage.getItem('test-pending')).toBe('v1')
  })

  it('persists value to db after debounce window', async () => {
    await pouchStorage.setItem('test-flush', 'v2')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-flush')).toBe('v2')
  })

  it('last write wins within debounce window', async () => {
    await pouchStorage.setItem('test-last', 'a')
    await pouchStorage.setItem('test-last', 'b')
    await pouchStorage.setItem('test-last', 'c')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-last')).toBe('c')
  })

  it('removeItem cancels pending write and deletes doc', async () => {
    await pouchStorage.setItem('test-rm', 'x')
    await pouchStorage.removeItem('test-rm')
    await new Promise((r) => setTimeout(r, 1500))
    expect(await pouchStorage.getItem('test-rm')).toBeNull()
  })
})
