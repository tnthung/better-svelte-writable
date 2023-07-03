# better-svelte-writable

This package provides a type-safe writable which gives you more control over the container.

The writable is designed for you to painlessly replace with the native writable when you are ready to do so.

## Installation

```bash
$ npm i -D better-svelte-writable
```

## Usage

The `writable` from this package is a drop-in replacement for the native writable. It provides some additional features which are listed below.

```typescript
import { writable } from 'better-svelte-writable';


const store = writable(0);

const {
  set,          // a  set       function just like the native writable
  update,       // an update    function just like the native writable
  subscribe,    // a  subscribe function just like the native writable

  get,          // a method for getting the current value without invoking the update
  previous,     // an array which contains tracked previous values that can be used a store
} = writable(0);
```

The new members are `get`, `previous`, and the `subscribe` method is modified.
Others are staying the same as the native writable.

### `get`

The pain with the native `writable` is when you just need to peek the current value, the best you can do is through the `update` function and return the old value, or by using the provided `get` method in `svelte/store`.This is not only verbose but also not intuitive.

The solution we provide is a native `get` method inside the return `BetterWritable<T>` object which is much straight forward.

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

### `start`

`start` function is a function which is will be called when the **first subscriber is added** *(not necessarily the first time)*.\
Which may return a function which will be called when the **last subscriber is removed** *(not necessarily the last time)*.

The default value of `start` is `() => {}`.

```typescript
type setter  = (value: T) => void;
type updater = (fn: (value: T) => T) => T;

type startFunction = (set: setter, update: updater) => (void | () => void);
```

### `isEqual`

`isEqual` is the function which been used to compare the previous value with the new value, which
can be customized to fit your needs. This function will only be invoked when `forceFire` is `false`.

The default value of `isEqual` is `(currentValue, newValue) => currentValue === newValue`.

```typescript
type isEqualFunction = (currentValue: T, newValue: T) => boolean;
```

### `forceFire`

`forceFire` indicates whether the callbacks will be called even if the value is not changed. If this option is set to `true`, the equality check will be skipped.

The default value of `forceFire` is `false`.

```typescript
type forceFireOption = boolean;
```

### `trackerCount`

`trackerCount` decides how many previous values will be tracked. If this option is set to `0`, the previous values will not be tracked.

The default value of `trackerCount` is `0`.

```typescript
type trackerCountOption = number;
```
