import { Nullable, KeyScalar } from './Types'

export interface MapEntry<K, V> {
  key: K
  value: V
}

class Entry<K extends KeyScalar, V> implements MapEntry<K, V> {
  constructor(readonly key: K, readonly value: V) { }
  static from<K extends KeyScalar, V>([key, value]: [K, V]) {
    return new Entry(key, value)
  }
}

type FrameObject = { [key: KeyScalar]: number }

/**
 * Implementation of the ES6 Map interface that maintains a LRU
 * (least recently used) ordering to its entries that are mutated
 * with the get and set methods
 *
 * @export
 * @class LRUMap
 * @template K the type of the map keys, constrained to string, number or symbol
 * @template V the type of the map values
 */
export class LRUMap<K extends KeyScalar, V> {

  private items: Entry<K, V>[] = []
  private frames: Map<K, number> = new Map() // FrameObject = {}

  /**
   * Creates an instance of LRUMap.
   *
   * @param {number} capacity the maximum number of entries to hold
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @memberof LRUMap
   */
  constructor(readonly capacity: number, entries?: Iterable<[K, V]>) {
    if (capacity === 0 || capacity === 1)
      throw new Error(`Invalid capacity (${capacity}). LRU capacity must be > 1 or unbounded (-1)`)
    if (entries) {
      const all = [...entries].reverse()
      const items = capacity > -1 ? all.slice(0, capacity) : all
      for (let i = 0; i < items.length; i++) {
        this.items.push(Entry.from(items[i]))
        this.frames.set(items[i][0], i)
      }
    }
  }

  /**
   * Creates an unbounded LURMap instance that can hold an
   * infinite number of entries
   *
   * @static
   * @template K the type of the map keys, constrained to string, number or symbol
   * @template V the type of the map values
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @return {*}  {LRUMap<K,V>}
   * @memberof LRUMap
   */
  static unbounded<K extends KeyScalar, V>(entries?: Iterable<[K, V]>): LRUMap<K, V> {
    return new LRUMap<K, V>(-1, entries)
  }

  /**
   * Gets the size of the collection O(1)
   *
   * @readonly
   * @type {number}
   * @memberof LRUMap
   */
  get size(): number {
    return this.items.length
  }

  /**
   * Gets an entry value from the map and registers recent use O(1)
   *
   * @param {K} key the key
   * @return {*}  {Nullable<V>} the value, which could be null
   * @memberof LRUMap
   */
  get(key: K): Nullable<V> {
    const index = this.frames.get(key)
    if (index === undefined)
      return null
    const entry = this.items[index]
    this.items.splice(index, 1)
    this.items.unshift(entry)
    this.promoteFrame(key)
    return entry.value
  }

  /**
   * Peeks at an entry value without registering recent use O(1)
   *
   * @param {K} key the key
   * @return {*}  {Nullable<V>} the value which could be null
   * @memberof LRUMap
   */
  peek(key: K): Nullable<V> {
    const index = this.frames.get(key)
    if (index === undefined)
      return null
    const { value } = this.items[index]
    return value ?? null
  }

  /**
   * Sets or replaces an entry in the map with key and
   * registers recent use O(N)
   *
   * @param {K} key the key
   * @param {V} value the value
   * @memberof LRUMap
   */
  set(key: K, value: V): this {
    if (this.has(key)) {
      const index = this.frames.get(key)
      this.items[index] = new Entry(key, value)
    } else {
      this.items.unshift(new Entry(key, value))
    }
    this.promoteFrame(key)
    this.evictOverflow()
    return this
  }

  /**
   * Removes an entry from the map and returns the removed entry's value O(N)
   *
   * @param {K} key the key
   * @return {*}  {Nullable<V>} the removed item, which could be null
   * @memberof LRUMap
   */
  remove(key: K): Nullable<V> {
    if (!this.has(key))
      return null
    const index = this.frames.get(key)
    const { value } = this.items[index]
    this.items.splice(index, 1)
    this.dropFrame(key)
    return value ?? null
  }

  /**
   * Removes an entry from the map O(N)
   *
   * @param {K} key
   * @return {*}  {boolean}
   * @memberof LRUMap
   */
  delete(key: K): boolean {
    return !!this.remove(key)
  }

  /**
   * The oldest entry in the map (access foes not register recent use) O(1)
   *
   * @return {*}  {MapEntry<K, V>} the entry
   * @memberof LRUMap
   */
  get tail(): MapEntry<K, V> {
    return this.items[this.items.length - 1]
  }

  /**
   * The newest entry in the map (access foes not register recent use) O(1)
   *
   * @return {*}  {MapEntry<K, V>} the entry
   * @memberof LRUMap
   */
  get head(): MapEntry<K, V> {
    return this.items[0]
  }

  /**
   * Check if a key is present in the map O(1)
   *
   * @param {K} key
   * @return {*}  {boolean}
   * @memberof LRUMap
   */
  has(key: K): boolean {
    return this.frames.has(key)
  }

  /**
   * Clears all entries from the map
   *
   * @memberof LRUMap
   */
  clear() {
    this.items = []
    this.frames.clear()
  }

  /**
   * Iterates over each entry and applies a callback function to each
   * entry without registering recent uses
   *
   * @param {(value: V, key: K, map: Map<K, V>) => void} callbackfn
   * @param {*} [thisArg]
   * @memberof LRUMap
   */
  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any) {
    if (typeof thisArg !== 'object') {
      thisArg = this
    }
    for (const [k, v] of this.entries())
      callbackfn.call(thisArg, v, k, this)
  }

  /**
   * Iterates over all entries in the map without
   * registering recent uses
   *
   * @memberof LRUMap
   */
  *[Symbol.iterator]() {
    for (const e of this.entries())
      yield e
  }

  /**
   * Get an iterator of all map entries in tuple form without registering
   * recent uses
   *
   * @return {*}  {IterableIterator<[K, V]>}
   * @memberof LRUMap
   */
  *entries(): IterableIterator<[K, V]> {
    for (const i of this.entryIterator()) {
      yield [i.key, i.value]
    }
  }

  /**
   * Gets an iterator of all map entries without registering recent uses
   *
   * @return {*}  {IterableIterator<MapEntry<K, V>>}
   * @memberof LRUMap
   */
  *entryIterator(): IterableIterator<MapEntry<K, V>> {
    const indicies = Object.values(this.frames).sort((a, b) => a - b)
    for (const i of indicies) {
      yield this.items[i]
    }
  }

  /**
   * Get an iterator of all entry keys without registering any
   * recent uses
   *
   * @return {*}  {IterableIterator<K>}
   * @memberof LRUMap
   */
  *keys(): IterableIterator<K> {
    const indicies = Object.values(this.frames).sort((a, b) => a - b)
    for (const i of indicies) {
      yield this.items[i].key
    }
  }

  /**
   * Get an iterator of all entry values without registering any
   * recent uses
   *
   * @return {*}  {IterableIterator<V>}
   * @memberof LRUMap
   */
  *values(): IterableIterator<V> {
    const indicies = Object.values(this.frames).sort((a, b) => a - b)
    for (const i of indicies) {
      yield this.items[i].value
    }
  }

  /**
   * Converts the map to an array of entry values, returned in the
   * order of least recently used items first. Does not register any
   * recent uses
   *
   * @return {*}  {V[]}
   * @memberof LRUMap
   */
  toArray(): V[] {
    return Array.from(this.values())
  }

  /**
   * Removes an item from the frame index and
   * reorders the indexing
   *
   * @private
   * @param {K} key
   * @memberof LRUMap
   */
  private dropFrame(key: K) {
    const keys = [...this.frames.keys()]
    const index = keys.indexOf(key)
    keys.splice(index, 1)
    this.frames.clear()
    const length = this.capacity > -1
      ? Math.min(keys.length, this.capacity)
      : keys.length
    for (let i = 0; i < length; i++)
      this.frames.set(keys[i], i)
  }

  /**
   * Promotes a key to first frame index and
   * reorders the indexing
   *
   * @private
   * @param {K} key
   * @memberof LRUMap
   */
  private promoteFrame(key: K) {
    const keys = [...this.frames.keys()]
    const index = keys.indexOf(key)
    if (index > -1)
      keys.splice(index, 1)
    keys.unshift(key)
    this.frames.clear()
    const length = this.capacity > -1
      ? Math.min(keys.length, this.capacity)
      : keys.length
    for (let i = 0; i < length; i++) {
      this.frames.set(keys[i], i)
    }
  }

  /**
   * Evict all oldest references that do not fit into the capacity
   *
   * @private
   * @memberof LRUMap
   */
  private evictOverflow() {
    if (this.capacity > -1)
      this.items.splice(this.frames.size)
  }

  /**
   * Returns a string representation of the map
   *
   * @return {*} string
   * @memberof LRUMap
   */
  toString(): string {
    let s = 'LRUMap {'
    let i = this.size - 1
    for (const { key, value } of this.entryIterator())
      s += `\n  Entry { ord: ${i--}, key: '${key}', value: '${value}' }`
    return `${s}\n}`
  }
}
