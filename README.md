# better-svelte-writable

[![npm version](http://img.shields.io/npm/v/better-svelte-writable.svg)](https://www.npmjs.com/package/better-svelte-writable)
[![npm downloads](https://img.shields.io/npm/dm/better-svelte-writable.svg)](https://www.npmjs.com/package/better-svelte-writable)
![license](https://img.shields.io/npm/l/better-svelte-writable)

This package provides a type-safe writable which gives you more control over the container.\
The writable is designed for you to painlessly replace with the native writable.

There are 3 problems this package is addressing:

1. You can't get the previous value after the value is changed.
1. Peeking the current value is not intuitive and verbose.
1. Syncing the value between multiple `writable`s is not easy.

## Installation

```bash
$ npm i -D better-svelte-writable
```

## Demo

[Svelte RELP](https://svelte.dev/repl/125afbe969a7409ab940f35a293e1e44?version=4.0.1)

## Usage

The `writable` from this package is a drop-in replacement for the native writable. It provides some additional features which are listed below.

> Signature: `writable<T, N>(initialValue: T, options?: Options<T, N>): BetterWritable<T, N>`

```typescript
import { writable } from 'better-svelte-writable';


const store = writable(0);

const {
  // Remaining the same as the native writable
  set,
  update,

  // New members
  get,          // a  method for getting the current value without invoking the update
  previous,     // an tuple which contains tracked previous values that can be used a store
  isPersistent, // a  boolean value indicates whether the value is persisted in storage

  // Modified
  subscribe,    // a  method for subscribing to the value changes
} = writable(0);
```

### `get`

The pain with the native `writable` is when you just need to peek the current value, the best you can do is through the `update` function and return the old value, or by using the provided `get` method in `svelte/store`. This is not only verbose but also not intuitive.

The solution we provide is a native `get` method inside the return `BetterWritable<T>` object which is much straight forward and performance friendly.

```typescript
import { writable } from 'better-svelte-writable';


const store = writable(0);

console.log(store.get()); // 0
```

### `previous`

The `previous` is an tuple which contains the `BetterReadable<T>` objects holding the previous values.
Just like `Readable<T>` from `svelte/store`, the `BetterReadable<T>` object also has a `subscribe` method.
By prefixing `$`, you can subscribe to the value changes.

> The length of the tuple is determined by the `trackerCount` option.

```svelte
<script lang="ts">
  import { writable } from 'better-svelte-writable';


  const store = writable(0, { trackerCount: 1 });
  const prev1 = store.previous[0];
</script>

<div>Current : {$store}</div>
<div>Previous: {$prev1}</div>

<button on:click={() => $store++}>  +  </button>
<button on:click={() => $store=0}>Reset</button>
<button on:click={() => $store--}>  -  </button>
```

### `isPersistent`

This is a simple boolean value that indicates whether the writable is persistent in storage.

```typescript
import { writable } from 'better-svelte-writable';


const store1 = writable(0, { key: "test", persist: true  });
const store2 = writable(0, { key: "test", persist: false });

console.log(store1.isPersistent); // true
console.log(store2.isPersistent); // false
```

### `subscribe`

The native `subscribe` method has one major problem, which has no way to found the old value when the callback is invoked. So the `subscribe` method we provide gives you the ability to see the old value(s). The second optional argument takes in a tuple oldValues been tracked.

> The length of the tuple is determined by the `trackerCount` option.

```typescript
import { writable } from 'better-svelte-writable';

const store = writable(0, { trackerCount: 1 });

store.subscribe((newValue, [lastValue]) => {
  console.log(lastValue);
  console.log(newValue);
});
```


## Options

`writable<T>` provides an optional second argument which is an object of options.

### `trackerCount`

```typescript
type trackerCountOption = number;
```

`trackerCount` decides how many previous values will be tracked. If this option is set to `0`, the previous values will not be tracked.

The default value of `trackerCount` is `0`.


```typescript
import { writable } from 'better-svelte-writable';


const store = writable(0, { trackerCount: 1 });

store.subscribe((n, [last, penultimate]) =>
  console.log(last, penultimate));


const last        = store.previous[0];
const penultimate = store.previous[1];

last       .subscribe(n => console.log('last'       , n));
penultimate.subscribe(n => console.log('penultimate', n));
```

### `key`

```typescript
type keyOption = string | undefined;
```

`key` can be used to sync the value between multiple `writable`s.
If the `persist` option is non-falsy, the value will also be synced across tabs.

> If the `key` already exists, **ALL** the other options will be ignored.

The default value of `key` is `undefined`.

```svelte
<script lang="ts">
  import { writable } from 'better-svelte-writable';


  const count1 = writable(0, { key: "count" });
  const count2 = writable(0, { key: "count" });
</script>

<div>Count1: {$count1}</div>
<div>Count2: {$count2}</div> <!-- also update when count1 changes -->

<button on:click={() => $count1++}>  +  </button>
<button on:click={() => $count1=0}>Reset</button>
<button on:click={() => $count1--}>  -  </button>
```

### `isEqual`

```typescript
type isEqualFunction = (currentValue: T, newValue: T) => boolean;
```

`isEqual` is the function which been used to compare the previous value with the new value, which
can be customized to fit your needs. This function will only be invoked when `forceFire` is `false`.

The default value of `isEqual` is `(currentValue, newValue) => currentValue === newValue`.

### `forceFire`

```typescript
type forceFireOption = boolean;
```

`forceFire` indicates whether the callbacks will be called even if the value is not changed.
If this option is set to `true`, the equality check will be skipped.

The default value of `forceFire` is `false`.

```typescript
import { writable } from 'better-svelte-writable';


{
  const store = writable(0, { forceFire: true });

  store.subscribe(() => console.log('fire'));

  store.set(1); // console: fire
  store.set(1); // console: fire
  store.set(1); // console: fire
}

{
  const store = writable(0, { forceFire: false });

  store.subscribe(() => console.log('fire'));

  store.set(1); // console: fire
  store.set(1);
  store.set(1);
}
```

### `start`

```typescript
type setter  = (value: T) => void;
type updater = (fn: (value: T) => T) => T;

type startFunction = (set: setter, update: updater) => (void | () => void);
```

`start` is a function which is will be called when the
**first subscriber is added** *(not necessarily the first time)*.\
Which may return a function which will be called when the
**last subscriber is removed** *(not necessarily the last time)*.

The default value of `start` is `() => {}`.

```typescript
import { writable } from 'better-svelte-writable';


const store = writable(0, {
  start: (set, update) => {
    console.log('start');
    return () => console.log('end');
  },
});


let tmp1 = store.subscribe(() => {}); // console: start
let tmp2 = store.subscribe(() => {});
let tmp3 = store.subscribe(() => {});

tmp2();
tmp3();
tmp1(); // console: end


let tmp4 = store.subscribe(() => {}); // console: start

tmp4(); // console: end
```

### `persist`

```typescript
interface Serializer<T> {
  parse    : (v: string) => T;
  stringify: (v: T     ) => string;
};

type persistOption<T> = boolean | {
  storage   ?: Storage;
  serializer?: Serializer<T>;
};
```

> If `persist` is non-falsy, the `key` option must be set.

> The `initialValue` will be the fallback value when the value is not found in the storage.

> The value in the storage is not yet been verified, it's possible the value does not match the type of `T`.

`persist` indicates whether or how will the value be stored in the storage.
If this option is set to `false`, the value will only be stored in current tab.
Otherwise, the value will be stored in the storage,
which will be synced across tabs with the `writable`s with the same `key`.

2 sub-options are available:

1. `storage`: The storage to be used.\
   The default value of `storage` is `localStorage`.

2. `serializer`: The serializer to be used.\
    The default value of `serializer` is `JSON`.

The default value of `persist` is `false`.

```svelte
<!-- /+page.svelte -->
<script lang="ts">
  import { writable } from 'better-svelte-writable';
  const count = writable(0, { key: "count", persist: true });
</script>

<!-- Value been sync across tabs -->
<div>Count: {$count}</div>

<button on:click={() => $count++}>  +  </button>
<button on:click={() => $count=0}>Reset</button>
<button on:click={() => $count--}>  -  </button>
```

# Changelog

## 0.1.0

### New Features

1. Now the writable value can be synced across multiple `writable` according to `key`. \
   And even across tabs with `persist` been set.
