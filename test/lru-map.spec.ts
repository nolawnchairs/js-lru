import { LRUMap } from '../src/LRUMap'

describe('Check functionality of LRU Map', () => {

  let map: LRUMap<string, string>

  beforeEach(() => {
    map = new LRUMap<string, string>(5, [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
      ['e', 'E'],
    ])
  })

  it('respects capacity', () => {
    map.set('f', 'F')
    map.set('g', 'G')
    map.set('h', 'H')
    expect(map.size).toEqual(5)
  })

  it('reports correct head and tail', () => {
    map.set('f', 'F')
    map.set('g', 'G')
    map.set('h', 'H')
    expect(map.head.value).toBe('H')
    expect(map.tail.value).toBe('D')
  })

  it('moves a value that was read to the head', () => {
    expect(map.head.value).toBe('E')
    map.get('e')
    expect(map.head.value).toBe('E')
    map.get('a')
    expect(map.head.value).toBe('A')
  })

  it('should not alter order on peek', () => {
    expect(map.head.value).toBe('E')
    map.peek('e')
    expect(map.head.value).toBe('E')
    map.peek('a')
    expect(map.head.value).toBe('E')
  })

  it('updates items and moves to the head', () => {
    expect(map.head.value).toBe('E')
    map.set('e', 'EEE')
    expect(map.head.value).toBe('EEE')
    map.set('q', 'QQQ')
    expect(map.head.value).toBe('QQQ')
  })

  it('clears the map', () => {
    map.clear()
    expect(map.size).toEqual(0)
  })

  it('can handle 10000 entries', () => {
    const e = []
    for (let i = 0; i < 10000; i++)
      e.push([i.toString(10), Math.random().toString()])
    const map = new LRUMap<string, string>(10000, e)
    expect(map.get('4999')).not.toBeNull()
    expect(map.get('12')).not.toBeNull()
    expect(map.get('223')).not.toBeNull()
    expect(map.get('9007')).not.toBeNull()
    expect(map.get('6345')).not.toBeNull()
    expect(map.get('1')).not.toBeNull()
    expect(map.get('1180')).not.toBeNull()
    expect(map.get('812')).not.toBeNull()
    expect(map.get('356')).not.toBeNull()
  })

  it('maintains proper mappings throughout permutations', () => {
    // E, D, C, B, A
    map.set('h', 'H') // H, E, D, C, B
    map.set('g', 'G') // G, H, E, D, C
    map.get('e') // E, G, H, D, C
    map.delete('c') // E, G, H, D
    map.set('i', 'I') // I, E, G, H, D
    map.delete('h') // I, E, G, D
    map.get('b') // I, E, G, D
    const frames = map['frames']
    const items = map['items']
    expect(items.length).toEqual(Object.entries(frames).length)
    for (const [k, i] of Object.entries(frames)) {
      expect(items[i].key).toBe(k)
    }
  })

  it('should iterate properly', () => {
    const entries = [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
      ['e', 'E'],
    ]
    let i = entries.length - 1
    map.forEach((v, k) => {
      expect(k).toBe(entries[i][0])
      expect(v).toBe(entries[i][1])
      i--
    })

    // Reverse order by getting in reverse order
    map.get('e')
    map.get('d')
    map.get('c')
    map.get('b')
    map.get('a')

    let j = 0
    for (const [key, value] of map) {
      expect(key).toBe(entries[j][0])
      expect(value).toBe(entries[j][1])
      j++
    }
  })

  it('should create a working unbounded map', () => {
    const map = LRUMap.unbounded<string, string>([
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
      ['e', 'E'],
    ])
    for (let i = 0; i < 100; i++) {
      map.set(i.toString(), Math.random().toString())
    }
    expect(map.size).toEqual(105)
    expect(map.head.key).toBe('99')
    expect(map.tail.key).toBe('a')
  })

  it('should throw on invalid capacity', () => {
    expect(() => new LRUMap(0)).toThrowError(/^Invalid capacity/)
    expect(() => new LRUMap(1)).toThrowError(/^Invalid capacity/)
    expect(() => new LRUMap(11)).not.toThrowError(/^Invalid capacity/)
  })
})
