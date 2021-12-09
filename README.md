
# LRU Map

A full implementation of an ES6 `Map` interface that curates an LRU (least recently used) ordering to the entries.


## Installation

```sh
npm i @nolawnchairs/lru
yarn add @nolawnchairs/lru
```

## Usage

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

## ES6 Map Methods & Iterators

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