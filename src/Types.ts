
/**
 * Discriminator function that is used to get an
 * element by property
 */
export type Discriminator<T, U> = (value: T) => U

export type Nullable<T> = T

export type ScalarType = string | number | symbol
