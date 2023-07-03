# better-svelte-writable

This package provides a writable which provides some advanced control over the container.

The writable is designed for you to painlessly replace with the native writable when you are ready to do so.

## Installation

```bash
$ npm i -D better-svelte-writable
```

## Usage

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


## Options

`writable<T>` provides an optional second argument which is an object of options.

### `start`

start function is a function which is will be called when the **first** subscriber is **added** *(not necessarily the first time)*.

which may return a function which will be called when the **last** subscriber is **removed** *(not necessarily the last time)*.

```typescript
type setter  = (value: T) => void;
type updater = (fn: (value: T) => T) => T;

type startFunction = (set: setter, update: updater) => (void | () => void);
```
