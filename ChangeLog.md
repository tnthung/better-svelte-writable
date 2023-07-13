# Changelog

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