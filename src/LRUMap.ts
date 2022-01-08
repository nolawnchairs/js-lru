
import { LRUSizedArray } from '.'
import { Nullable, KeyScalar } from './Types'

enum LRUMemoryStrategy {
  /**
   * LRU affinity will be tied to entry count
   */
  ITEMS,
  /**
   * LRU affinity will be tied to entry value byte length
   */
  BYTES,
}

export interface MapEntry<K, V> {
  key: K
  value: V
}

export type ByteLengthAware = string | Buffer | LRUSizedArray<ByteLengthAware>

class Entry<K extends KeyScalar, V> implements MapEntry<K, V> {
  constructor(readonly key: K, readonly value: V) { }
  static of<K extends KeyScalar, V>([key, value]: [K, V]) {
    return new Entry(key, value)
  }
}

abstract class LRUAbstractMap<K extends KeyScalar, V> {

  protected items: Entry<K, V>[] = []
  protected frames: Map<K, number> = new Map()

  /**
   * Creates an instance of LRUAbstractMap.
   *
   * @param {number} capacity the maximum number of entries to hold
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @throws {Error} if the capacity for a standard LRUMap is 0 or 1
   * @memberof LRUAbstractMap
   */
  constructor(readonly strategy: LRUMemoryStrategy, readonly capacity: number, entries?: Iterable<[K, V]>) {
    if (strategy == LRUMemoryStrategy.ITEMS && (capacity === 0 || capacity === 1))
      throw new Error(`Invalid capacity (${capacity}). LRU capacity must be > 1 or unbounded (-1)`)
    if (entries) {
      const all = [...entries].reverse()
      const items = capacity > -1 ? all.slice(0, capacity) : all
      for (let i = 0; i < items.length; i++) {
        this.items.push(Entry.of(items[i]))
        this.frames.set(items[i][0], i)
      }
    }
  }

  /**
   * Gets the size of the collection O(1)
   *
   * @readonly
   * @type {number}
   * @memberof LRUAbstractMap
   */
  get size(): number {
    return this.items.length
  }

  /**
   * Gets an entry value from the map and registers recent use O(1)
   *
   * @param {K} key the key
   * @return {*}  {Nullable<V>} the value, which could be null
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
   */
  delete(key: K): boolean {
    return !!this.remove(key)
  }

  /**
   * The oldest entry in the map (access foes not register recent use) O(1)
   *
   * @return {*}  {MapEntry<K, V>} the entry
   * @memberof LRUAbstractMap
   */
  get tail(): MapEntry<K, V> {
    return this.items[this.items.length - 1]
  }

  /**
   * The newest entry in the map (access foes not register recent use) O(1)
   *
   * @return {*}  {MapEntry<K, V>} the entry
   * @memberof LRUAbstractMap
   */
  get head(): MapEntry<K, V> {
    return this.items[0]
  }

  /**
   * Check if a key is present in the map O(1)
   *
   * @param {K} key
   * @return {*}  {boolean}
   * @memberof LRUAbstractMap
   */
  has(key: K): boolean {
    return this.frames.has(key)
  }

  /**
   * Clears all entries from the map
   *
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
   */
  *keys(): IterableIterator<K> {
    const indicies = [...this.frames.values()].sort((a, b) => a - b)
    for (const i of indicies) {
      yield this.items[i].key
    }
  }

  /**
   * Get an iterator of all entry values without registering any
   * recent uses
   *
   * @return {*}  {IterableIterator<V>}
   * @memberof LRUAbstractMap
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
   * @memberof LRUAbstractMap
   */
  toArray(): V[] {
    return Array.from(this.values())
  }

  /**
   * Removes an item from the frame index and
   * reorders the indexing
   *
   * @protected
   * @param {K} key
   * @memberof LRUAbstractMap
   */
  protected dropFrame(key: K) {
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
   * @protected
   * @param {K} key
   * @memberof LRUAbstractMap
   */
  protected promoteFrame(key: K) {
    const keys = [...this.frames.keys()]
    const index = keys.indexOf(key)
    if (index > -1)
      keys.splice(index, 1)
    keys.unshift(key)
    this.frames.clear()
    const length = this.capacity > -1 && this.strategy == LRUMemoryStrategy.ITEMS
      ? Math.min(keys.length, this.capacity)
      : keys.length
    for (let i = 0; i < length; i++) {
      this.frames.set(keys[i], i)
    }
  }

  /**
   * Evict all oldest references that do not fit into the capacity
   *
   * @protected
   * @memberof LRUAbstractMap
   */
  protected evictOverflow() {
    if (this.capacity > -1)
      this.items.splice(this.frames.size)
  }

  /**
   * Returns a string representation of the map
   *
   * @return {*} string
   * @memberof LRUAbstractMap
   */
  toString(): string {
    let s = 'LRUAbstractMap {'
    let i = this.size - 1
    for (const { key, value: value } of this.entryIterator())
      s += `\n  Entry { ord: ${i--}, key: '${key}', value: '${value}' }`
    return `${s}\n}`
  }
}

/**
 * Implementation of the ES6 Map interface that maintains a LRU
 * (least recently used) ordering to its entries that are mutated
 * with the get and set methods.
 *
 * LRU affinity is based on the total item count stored, and least-used
 * items are evicted once the defined item capacity is surpassed
 *
 * @export
 * @class LRUStandardMap
 * @template K the type of the map keys, constrained to string, number or symbol
 * @template V the type of the map values
 */
export class LRUMap<K extends KeyScalar, V> extends LRUAbstractMap<K, V> {
  /**
   * Creates an instance of an LRUAbstractMap that manages its size by the number
   * of entries
   *
   * @param {number} itemCapacity the maximum number of entries to hold
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @memberof LRUMap
   */
  constructor(itemCapacity: number, entries?: Iterable<[K, V]>) {
    super(LRUMemoryStrategy.ITEMS, itemCapacity, entries)
  }

  /**
   * Creates an unbounded LURMap instance that can hold an
   * infinite number of entries. Note that items therefore will
   * never be evicted, but will still reside in the LRU sorting,
   * so be aware of possible memory and performance implications
   *
   * @static
   * @template K the type of the map keys, constrained to string, number or symbol
   * @template V the type of the map values
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @return {*}  {LRUAbstractMap<K,V>}
   * @memberof LRUMap
   */
  static unbounded<K extends KeyScalar, V>(entries?: Iterable<[K, V]>): LRUMap<K, V> {
    return new LRUMap<K, V>(-1, entries)
  }
}

/**
 * Implementation of the ES6 Map interface that maintains a LRU
 * (least recently used) ordering to its entries that are mutated
 * with the get and set methods
 *
 * LRU affinity is based on the total bytes stored. Oldest item(s) are
 * evicted once the defined max byte capacity is surpassed. Max byte
 * capacity only registers the size of the entry's _value_. Actual byte sizes
 * of the keys and the map structure itself have no bearing on the
 * calculated memory footprint of the data set as a whole.
 *
 * Since this LRU implementation must keep track of the byte size consumed
 * by the entry values, values types are constrained to String and Buffer types,
 * as well as LRUSizedArray which wraps a native Javascript array, which is also
 * constrained by those same types.
 *
 * @export
 * @class LRUSizedMap
 * @template K the type of the map keys, constrained to string, number or symbol
 * @template V the type of the map values
 */
export class LRUSizedMap<K extends KeyScalar, V extends ByteLengthAware> extends LRUAbstractMap<K, V> {

  // Current tally of bytes used
  private bytesUsed: number = 0

  /**
   * Creates an instance of an LRUMap that manages its size by the accumulated
   * byte size of all entities. All entries must be String, Buffer or LRUSizedArray.
   *
   * @param {number} maxBytes the maximum number of entries to hold
   * @param {Iterable<[K, V]>} [entries] optional iterable of key-value tuples to initiate the map. LRU ordering is applied immediately to initial entries
   * @throws {Error} if a zero or negative value is supplied for the maxBytes parameter
   * @throws {Error} if an invalid type is detected as an item in the optional entries parameter
   * @memberof LRUSizedMap
   */
  constructor(maxBytes: number, entries?: Iterable<[K, V]>) {
    super(LRUMemoryStrategy.BYTES, maxBytes)
    if (maxBytes < 1)
      throw new Error(`Invalid maxBytes capacity (${maxBytes}). LRU byte capacity must be > 1`)
    if (entries) {
      this.bytesUsed = [...this.values()].reduce((a, c) => a += c.length, 0)
      const all = [...entries].reverse()
      for (let i = 0; i < all.length; i++) {
        const [key, value] = all[i]
        this.assertValueIsValid(value)
        this.accommodate(value.length)
        this.items.push(Entry.of([key, value]))
        this.frames.set(key, i)
      }
    }
  }

  /**
   * Gets the current byte size of the data set
   *
   * @readonly
   * @type {number}
   * @memberof LRUSizedMap
   */
  get used(): number {
    return this.bytesUsed
  }

  /**
   * Sets or replaces an entry in the map with key and
   * registers recent use O(N)
   *
   * Note that this method may cause the overall memory footprint
   * to exceed the max bytes capacity momentarily, as the eviction process
   * will occur _after_ the new entry's insertion. To ensure eviction will
   * occur prior to insertion, run the 'accommodate' method before calling 'set'.
   *
   * @override
   * @param {K} key the key
   * @param {V} value the value
   * @return {*}  {this}
   * @memberof LRUSizedMap
   * @throws {Error} if an invalid type is provided as the value
   */
  set(key: K, value: V): this {
    this.assertValueIsValid(value)
    if (this.has(key))
      this.bytesUsed -= this.peek(key).length
    this.bytesUsed += value.length
    return super.set(key, value)
  }

  /**
   * Ensures the memory capacity will not overflow prior to inserting
   * or updating an entry with 'set' by removing the least recently used
   * items until the LRU map can accommodate the new value's size
   *
   * @param {number} bytes the byte size to clear
   * @return {*}  {this}
   * @memberof LRUSizedMap
   */
  accommodate(bytes: number): this {
    while (this.bytesUsed + bytes > this.capacity) {
      this.delete(this.tail.key)
    }
    return this
  }

  /**
   * Removes an entry from the map and returns the removed entry's value O(N)
   *
   * @override
   * @param {K} key the key
   * @return {*}  {Nullable<V>} the removed item, which could be null
   * @memberof LRUSizedMap
   */
  remove(key: K): Nullable<V> {
    this.bytesUsed -= this.peek(key)?.length ?? 0
    return super.remove(key)
  }

  /**
   * Clears all entries from the map
   *
   * @override
   * @memberof LRUSizedMap
   */
  clear(): void {
    this.bytesUsed = 0
    return super.clear()
  }

  /**
   * Evict all oldest references that do not fit into the capacity
   *
   * @override
   * @protected
   * @memberof LRUSizedMap
   */
  protected evictOverflow() {
    while (this.bytesUsed > this.capacity) {
      this.delete(this.tail.key)
    }
  }

  /**
   * Asserts the value is of an acceptable type
   *
   * @private
   * @param {V} value
   * @memberof LRUSizedMap
   */
  private assertValueIsValid(value: V) {
    if (Array.isArray(value))
      throw new Error('LRUSizedMap does not accept native JS arrays. Consider using the LRUSizedArray wrapper instead')
    if (typeof value !== 'string' && !(value as any instanceof Buffer) && !(value as any instanceof LRUSizedArray))
      throw new Error(`LRUSizedMap can only accept string, Buffer or LRUSizedArray types. Provided '${typeof value}'`)
  }
}
