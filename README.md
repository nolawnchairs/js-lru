
# LRU (Least-Recently Used) Map

A full implementation of an ES6 `Map` interface that curates an LRU (least recently used) ordering to the entries.

* [Table of Contents](#)
  * [Installation](#Installation)
  * [LRUMap](#LRUMap)
  * [LRUSizedMap](#LRUSizedMap)
  * [LRUSizedArray](#LRUSizedArray)


## Installation

```sh
npm i @nolawnchairs/lru
yarn add @nolawnchairs/lru
```

## LRUMap

```ts
class LRUMap<K extends KeyScalar, V>
```

| TypeParameter | Description |
|--|--|
| `K` | The type of key. Must be `string`, `number` or `symbol` |
| `T` | The type of value |

### Constructor

```ts
constructor(capacity: number, entries?: Iterable<[K, V]>)
```

| Parameter | Type | Description |
|--|--|--|
| capacity | `number` | The entry capacity. Must be greater than 1 or -1 for an unbounded capacity |
| entries | `Iterable<[K,V]>` | An optional iterable list of key-value tuples to initiate data. Elements are added through the LRU system at point of entry, so the 0th item in the iterator becomes the least recently used entry (**tail**) |

```ts
const map = new LRUMap<string, string>(5, [
    ['a', 'A'],
    ['b', 'B'],
    ['c', 'C'],
    ['d', 'D'],
    ['e', 'E'],
])
```    

### Unbounded Capacity

To create a collection with unlimited capacity, use the static factory method `unbounded` and just provide an optional iterable of initial values.

```ts
static unbounded<K extends KeyScalar, V>(entries?: Iterable<[K,V]>): LRUMap<K, V>
```

### Properties

| Property | Description |
|--|--|
| `size` | The total number of entries in the map |
| `head` | The newest (last used) entry in the map |
| `tail` | The oldest (least recently used) entry in the map |

### Methods

```ts
get(key: K): Nullable<V>
```
Gets the value of type `V` using its key and registers the use. Returns `null` if no entry was found

```ts
peek(key: K): Nullable<V>
```
Gets the value of type `V` using its key without registering the use. Returns `null` if no entry was found

```ts
set(key: K, value: V): this
```
Sets a value with a key of type `K` and a value of type `V` and registers use with this new entry being the most recent. Returns the instance of the map for chaining

```ts
remove(key: K): Nullable<V>
```
Removes the entry by key and returns the removed value of type `V`, or null if no key was found

```ts
delete(key: K): boolean
```
Analog of the `remove` method, but returns a `boolean` value upon successful removal of the entry

```ts
has(key: K): boolean
```
Determine if an entry with the key exists

```ts
clear(): void
```
Clears all entries from the map

### ES6 Map Methods & Iterators

This LRUMap implementation is interchangeable with the ES6 map, and as such the following methods are implemented:

```ts
forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void
entryIterator(): IterableIterator<MapEntry<K, V>>
entries(): IterableIterator<[K,V]>
keys(): IterableIterator<K>
values(): IterableIterator<V>
```

Since the `entries()` method in the native ES6 `Map` interface must return an iterator of map entries in tuple form (`[key, value]`), the `entryIterator()` method is provided to get the actual `MapEntry` object instead:

```ts
const map = new LRUMap<string, string>(5, [
    ['a', 'A'],
    ['b', 'B'],
])

for (const entry of map.entryIterator()) {
    console.log(entry.key, entry.value) // 'a', 'A' ... 'b', 'B'
}
```

The LRUMap itself is iterable and uses the same iterator as the `entries()` method.

```ts
const map = new LRUMap<string, string>(5, [
    ['a', 'A'],
    ['b', 'B'],
    ['c', 'C'],
    ['d', 'D'],
    ['e', 'E'],
])

for (const [key, value] of map) {
    console.log(`Map Entry: ${key}: ${value}`)
}
```

## LRUSizedMap

```ts
class LRUSizedMap<K extends KeyScalar, V extends ByteLengthAware>
```

The `ByteLengthAware` type is an alias for the following:
```ts
type ByteLengthAware = string | Buffer | LRUSizedArray<ByteLengthAware>
```

The standard `LRUMap` class keeps and evicts its entries based on the **count** of entries. While useful when most entry values are of similar size, the `LRUSizedMap` gives finer-grained control over the memory footprint by using the actual size, or **length** of the values to determine the eviction of entries. This is especially useful when dealing with larger quantities of binary data, or when using items with great variations in size which makes predicting overall memory usage difficult.

the `LRUSizedMap` will only accept `String`, `Buffer` and [LRUSizedArray](#LRUSizedArray) types, as these report the actual byte length they consume, which facilitates the map keeping track of its memory footprint.

The `LRUSizedMap` class constructor takes the same arguments as the standard `LRUMap`, but the first argument is the limit on **byte length** as opposed to the actual count of entries to hold.


```ts
import { randomBytes } from 'crypto'

// Create a sized LRU map that will hold one megabyte
const map = new LRUSizedMap<string, Buffer>(1_000_000, [
    ['a', randomBytes(0x10000)],
    ['b', randomBytes(0x20000)],
    ['c', randomBytes(0x10000)],
    ['d', randomBytes(0x7ffff)],
    ['e', randomBytes(0x10000)],
])
```

The `LRUSizedMap` comes with the additional property `used` which reports exactly how many bytes the map's values occupy.

```ts
get used(): number
```

One important thing to note is that the memory footprint's affinity is tied to that of the accumulated size of each **value** in the map's entries. The size of the keys and the map structure itself bears no impact when calculating the size of the data set.

### Enforcing Memory Footprint

Also note that when using the `set` method, the inserted (or updated) entry in the map is set before the eviction process runs, which means that the memory footprint may _exceed_ your defined capacity during the fraction of time between the new data's insert/update and the completion of the eviction process. To ensure that any least-recently-used entries are evicted prior to inserting/updating new data, the `accommodate` method can be run to guarantee that enough data from memory is freed beforehand.

```ts
accommodate(bytes: number): boolean
```

To ensure that 8KB worth of data is cleared before setting:

```ts
map.accommodate(8192)
map.set('f', randomBytes(8192))
```

Note that the `accommodate` method forces the eviction of the amount of bytes passed to it, regardless of whether the data you're setting will actually increase the footprint. This can happen if a value already exists for the key and consists of the same or more bytes than you're attempting to accommodate. This will cause some LRU entries to be prematurely evicted when they needn't be. Therefore it's recommended to omit the use of `accommodate` unless you must be absolutely certain your memory capacity is not exceeded (even for the insignificant frame of time it takes eviction to run).

The `LRUSizedMap` class does not allow an `unbounded` version, as this defeats its purpose.

### LRUSizedArray

Arrays cannot be used directly with the `LRUSizedMap`, as their length properties report the number of items in the collection, and not the actual byte size that the LRU expects.

Therefore, this library includes a simple wrapper around the native Javascript Array type.

It's only limitation is that the types it can hold are constrained by the same `ByteLengthAware` type that the `LRUSizedMap` does.

```ts
export class LRUSizedArray<T extends ByteLengthAware> 
```

Wrap a native JS array with `LRUSizedArray`

```ts
const standardOldJsArray = ['foo', 'bar']
const array = new LRUSizedArray<string>(standardOldJsArray)

// Find the byte size of it's elements
console.log(array.length) // 6 instead of 2

// access the underlying native array
const originalArray = array.items
```

