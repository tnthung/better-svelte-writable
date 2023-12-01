# Changelog

## 0.4.2

### Breaking Changes

1. `trackers` no longer exists. Use `previous` instead.
1. `previous` now returns the tuple of readable stores instead of the tuple of previous value.

### Changes

1. Some internal type refactoring.


## 0.4.1

### New Features

1. `on` method is added for subscribing to the store with specific value.


## 0.4.0

### Changes

1. Rewrite using factory functions instead of classes. (Should have no breaking changes)
1. Using the recursive function to create trackers.


## 0.3.4

### New Features

1. `initiator` option is added that will be called when the store finished initialization.


## 0.3.1

### Breaking Changes

1. `previous` now returns the tuple of previous value instead of the readable store.
1. `Writable` class is created to minimize the overhead.
1. `start` option is now renamed to `notifier`.
1. `forceFire` option is now renamed to `forceEmit`.

### New Features

1. `trackers` returns the tuple of readable stores, just like old `previous`.
1. `toComputed` to create a readable store with given function that computes the value.

### Changes

1. `writable` is now a simple factory function wrapping around `BetterWritable` class.
1. `BetterWritable` is now a interface instead of a type alias.
1. `BetterReadable` is now a interface instead of a type alias.


## 0.2.4

### New Features

1. `toReadable` to convert a `BetterWritable` to a `BetterReadable` store.

### Changes

1. `get` method is now moved to `BetterReadable` object.

## 0.2.3

### Fixes

1. The `Zod` is not correctly installed as dependency.


## 0.2.2

### Changes

1. Split the `ChangeLog` part into a separate file.
1. Use different default `isEqual` function matching the `safe_not_equal` in `svelte/store`.


## 0.2.1

### Fixes

1. The documentations typos.


## 0.2.0

### Fixes

1. The documentations typos.
1. Add table of contents in README.
1. Do some formatting.
1. Test route typo.

### Breaking Changes

1. The `subscribe` function signature is changed. Spread arguments is now
   used to replace the old values tuple.
1. The `previous` field will only be available when `trackerCount` is
   greater than 0.

## 0.1.2

### Changes

1. Add `Highlight` section in doc.
1. Enhance the type inference.

### New Features

1. `persist` can accept a zod schema for verifying the old value in storage.
1. `type T` can be inferred from the zod schema provided in `persist`.


## 0.1.1

### Fixes

1. The note `The 'initialValue' will be the fallback...` is moved to the `key` option below.


## 0.1.0

### New Features

1. Now the writable value can be synced across multiple `writable` according to `key`. \
   And even across tabs with `persist` been set.
