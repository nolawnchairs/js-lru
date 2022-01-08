
import { randomBytes } from 'crypto'
import { LRUSizedMap } from '../src/LRUMap'
import { LRUSizedArray } from '../src/LRUArray'

describe('Check functionality of LRU Memory-Limited Map', () => {

  it('should fit 5 items of 1024 bytes each', () => {
    const map: LRUSizedMap<string, Buffer> = new LRUSizedMap(4096)
    for (let i = 0; i < 4; i++) {
      const bytes = randomBytes(1024)
      map.set(i.toString(), bytes)
    }
    expect(map.size).toEqual(4)
  })

  it('should not exceed 8192 bytes in size', () => {
    const map: LRUSizedMap<string, Buffer> = new LRUSizedMap(4096)
    for (let i = 0; i < 10; i++) {
      const bytes = randomBytes(1024)
      map.set(i.toString(), bytes)
    }
    expect(map.used).toBeLessThanOrEqual(4096)
    expect(map.size).toBe(4)
  })

  it('should evict properly', () => {
    const map: LRUSizedMap<string, Buffer> = new LRUSizedMap(4096)
    for (let i = 0; i < 10; i++) {
      const bytes = randomBytes(1024)
      map.set(i.toString(), bytes)
    }
    expect(map.tail.key).toBe('6')
    expect(map.size).toBe(4)
  })

  it('should accept items of different sizes and stay within bounds', () => {
    const map: LRUSizedMap<string, string> = new LRUSizedMap(65536)
    for (let i = 0; i < 1000; i++) {
      const buffer = randomBytes(1)
      const bytes = randomBytes(buffer.readUIntBE(0, 1))
      if (bytes.length)
        map.set(i.toString(), bytes.toString('hex'))
    }
    expect(map.used).toBeLessThanOrEqual(65536)
  })

  it('should reject insertion of any value greater than limit', () => {
    const map: LRUSizedMap<string, Buffer> = new LRUSizedMap(8192)
    map.set('A', randomBytes(8193))
    expect(map.size).toBe(0)
    expect(map.used).toBe(0)

    map.set('B', randomBytes(8192))
    expect(map.size).toBe(1)
    expect(map.used).toBe(8192)

    map.set('C', randomBytes(6144))
    expect(map.size).toBe(1)
    expect(map.used).toBe(6144)

    map.set('D', randomBytes(1024))
    expect(map.size).toBe(2)
    expect(map.used).toBe(7168)

    map.set('E', randomBytes(2048))
    expect(map.size).toBe(2)
    expect(map.used).toBe(3072)
  })

  it('should accommodate properly', () => {
    const map: LRUSizedMap<string, Buffer> = new LRUSizedMap(8192)
    map.set('A', randomBytes(4096))
    map.set('B', randomBytes(2048))
    map.set('C', randomBytes(1024))
    expect(map.used).toBe(7168)
    map.accommodate(2048)
    expect(map.used).toBe(3072)
    map.set('D', randomBytes(2048))
    expect(map.used).toBe(5120)
    map.accommodate(8192)
    expect(map.used).toBe(0)
    map.set('E', randomBytes(8192))
    expect(map.used).toBe(8192)
  })

  it('should accept LRUArray as a value', () => {
    const map = new LRUSizedMap<string, LRUSizedArray<string>>(8192)
    map.set('A', new LRUSizedArray(['foo', 'bar', 'baz']))
    expect(map.used).toBe(9)
  })
})
