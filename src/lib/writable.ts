import type {
  Updater,
  Invalidator,
  Unsubscriber,
} from "svelte/store";


type QuantifiedTuple<T, N extends number, A extends T[] = []> =
  A["length"] extends N ? A : QuantifiedTuple<T, N, [...A, T]>;


export type Subscriber<T, N extends number = 0> =
  (value: T, oldValues: QuantifiedTuple<T, N>) => void;


export type StartStopNotifier<T> = (
  set   : (v: T         ) => void,
  update: (f: Updater<T>) => void
) => (void | (() => void))


// stolen from svelte/store's private types "SubscribeInvalidateTuple<T>" :D
type SITuple<T, N extends number> = [Subscriber<T, N>, Invalidator<T>];


export type WritableConfig<T, N extends number = 0> = {
  key         ?: string;                  // key for syncing,                                           default: undefined
  start       ?: StartStopNotifier<T>;    // start/stop notifier,                                       default: () => {}
  isEqual     ?: (a: T, b: T) => boolean; // custom equality function,                                  default: (a, b) => a === b
  forceFire   ?: boolean;                 // force fire on set and update, regardless of value change,  default: false
  trackerCount?: N;                       // number of previous values to track,                        default: 0

  persist?: boolean | {                   // persist to storage,                                        default: false
    storage   ?: Storage;                 //     storage type,                                          default: localStorage
    serializer?: Serializer<T>;           //     serializer for syncing,                                default: JSON
  };
};


export interface BetterReadable<T, N extends number = 0> {
  subscribe: (this: void, run: Subscriber<T, N>, invalidate?: Invalidator<T>) => Unsubscriber;
};


export interface BetterWritable<T, N extends number = 0> extends BetterReadable<T, N> {
  get         : () => T;
  set         : (value: T) => void;
  update      : (updater: Updater<T>) => void;
  previous    : QuantifiedTuple<BetterReadable<T, N>, N>;
  isPersistent: boolean;
};


export interface Serializer<T> {
  parse    : (v: string) => T;
  stringify: (v: T     ) => string;
};


const noop = () => {};

const subCallbackQueue: [Subscriber<any, any>, any, any[]][] = [];

const keyedWritableMap = new Map<string, BetterWritable<any, any>>();


export const writable = <T, N extends number = 0> (
  initialValue: T,
  config: WritableConfig<T, N> = {}
): BetterWritable<T, N> => {
  const {
    key,

    start        = noop,
    isEqual      = (a: T, b: T) => a === b,
    forceFire    = false,
    trackerCount = 0,
  } = config;

  let {
    persist = false,
  } = config;


  // if key is provided, check if it's already in the map
  if (key && keyedWritableMap.has(key))
    return keyedWritableMap.get(key) as BetterWritable<T, N>;


  // if persist is true, set default serializer and storage type
  if (typeof persist === "boolean" && persist) {
    // check if key is provided
    if (key == null) throw new Error(
      "key must be provided when persist is true");

    // check if localStorage is available
    if (typeof window.localStorage === "undefined")
      throw new Error("localStorage is not available");

    persist = {
      storage   : window.localStorage,
      serializer: JSON,
    };
  }


  // check if storage is available
  if (persist) {
    persist.storage    ??= window.localStorage;
    persist.serializer ??= JSON;

    InitialSync: { // check if value is already in storage
      const { storage, serializer } = persist;

      const value = storage.getItem(key!);

      if (value == null) {
        storage.setItem(key!, serializer.stringify(initialValue));
        break InitialSync;
      }

      initialValue = serializer.parse(value);
    }

    addEventListener("storage", e => {
      const {
        key     : k,
        newValue: v,
        storageArea,
      } = e;

      if (typeof persist === "boolean")
        return;

      if (k !== key || storageArea !== persist.storage) return;

      if (v == null) throw new Error(
        "key must not be removed from storage");

      const value = persist.serializer!.parse(v);
      set(value);
    });
  }


  // stop notifier
  let stop: (() => void) | null = null;


  // deep clone
  const copy = <T> (v: T) => (
    typeof v === "object" &&
    trackerCount > 0
  ) ? structuredClone(v) : v;


  let values     : T[]                    = [];
  let trackers   : BetterReadable<T, N>[] = [];
  let subscribers: Set<SITuple<T, N>>[]   = [];
  let subCount   : number                 = 0;


  function set(v: T) {
    if (!isEqual(values[0], v)) {
      // only set to storage if value is changed
      if (typeof persist === "object") {
        const { storage, serializer } = persist;
        storage!.setItem(key!, serializer!.stringify(v));
      }
    }

    else if (!forceFire) return;

    values.unshift(copy(v));
    values = values.slice(0, trackerCount+1);

    // store not ready
    if (!stop) return;

    let runQueue = !subCallbackQueue.length;

    subscribers.forEach((sub, i) =>
      sub.forEach(([run, inv]) => {
        inv(values[i])
        subCallbackQueue.push([run, values[i], values.slice(1)]);
      }));

    // i really don't know the reason for this
    // i just stole it from svelte/store :D
    if (runQueue) {
      subCallbackQueue.forEach(
        ([run, n, o]) => run(n, o as any));
      subCallbackQueue.length = 0;
    }
  };


  function update(fn: Updater<T>) { set(fn(values[0])); };


  for (let i=0; i<=trackerCount; i++) {
    values     .push(initialValue);
    subscribers.push(new Set());
    trackers   .push({
      subscribe: (run, invalidate = noop) => {
        const sub: SITuple<T, N> = [run, invalidate];
        subscribers[i].add(sub);
        subCount++;

        if (subCount === 1)
          stop = start(set, update) || noop;

        run(values[i], values.slice(1) as QuantifiedTuple<T, N>);

        return () => {
          subscribers[i].delete(sub);
          subCount--;

          if (subCount === 0) {
            stop?.();
            stop = null;
          }
        };
      }
    });
  }


  const store: BetterWritable<T, N> = {
    get         : () => values[0],
    previous    : trackers.slice(1) as QuantifiedTuple<BetterReadable<T, N>, N>,
    subscribe   : trackers[0].subscribe,
    isPersistent: persist !== false,

    set,
    update,
  };


  // make store.isPersistent read-only
  Object.defineProperty(store, "isPersistent", {
    writable    : false,
    configurable: false,
  });


  // add to map if key is provided
  if (key) keyedWritableMap.set(key, store as BetterWritable<any, any>);

  return store;
};
