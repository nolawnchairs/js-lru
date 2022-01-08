
import { ByteLengthAware } from './LRUMap'

/**
 * Wrapper around the standard JS array where the length
 * property properly reports the actual byte size of its
 * elements
 *
 * @export
 * @class LRUArray
 * @template T
 */
export class LRUSizedArray<T extends ByteLengthAware>  {

  private readonly array: Array<T>

  /**
   * Creates an instance of LRUArray.
   * @param {Iterable<T>} [items]
   * @memberof LRUArray
   */
  constructor(items?: Iterable<T>) {
    this.array = Array.from(items)
  }

  /**
   * Get the underlying array
   *
   * @readonly
   * @type {Array<T>}
   * @memberof LRUArray
   */
  get items(): Array<T> {
    return this.array
  }

  /**
   * Get the actual byte length of the array's items
   *
   * @readonly
   * @type {number}
   * @memberof LRUArray
   */
  get length(): number {
    let result = 0
    for (const item of this.items)
      result += item.length
    return result
  }
}
