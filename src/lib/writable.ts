import type {
  z,
  ZodType,
} from "zod";

import type {
  Updater,
  Invalidator,
  Unsubscriber,
} from "svelte/store";


type CapPositive<N extends number> =
  `${N}` extends `-${string}` ? 0 : N;


type QuantifiedTuple<T, N extends number, A extends T[] = []> =
  CapPositive<N> extends infer U
    ? U extends number
      ? A["length"] extends U
        ? A
        : QuantifiedTuple<T, N, [T, ...A]>
      : never
    : never;


export type Subscriber<T, N extends number = 0> =
  QuantifiedTuple<T, N> extends []
    ? (value: T                                     ) => void
    : (value: T, ...oldValues: QuantifiedTuple<T, N>) => void;


export type StartStopNotifier<T> = (
  set   : (v: T         ) => void,
  update: (f: Updater<T>) => void
) => (void | (() => void))


// stolen from svelte/store's private types "SubscribeInvalidateTuple<T>" :D
type SITuple<T, N extends number> = [Subscriber<T, N>, Invalidator<T>];


// key           : key for syncing,                                           default: undefined
// start         : start/stop notifier,                                       default: () => {}
// isEqual       : custom equality function,                                  default: (a, b) => a === b
// forceFire     : force fire on set and update, regardless of value change,  default: false
// trackerCount  : number of previous values to track,                        default: 0
// persist       : persist to storage,                                        default: false
//     schema    : storage type,                                              default: localStorage
//     storage   : for verifying the value from storage,                      default: undefined
//     overwrite : if overwrite when initial sync failed verification,        default: false
//     serializer: serializer for syncing,                                    default: JSON
export type WritableConfig<
  T,
  S extends ZodType = never,
  N extends number  = 0

> = {
  start       ?: StartStopNotifier<T>;
  isEqual     ?: (a: T, b: T) => boolean;
  forceFire   ?: boolean;
  trackerCount?: N;

} & ({
  key    ?: string;
  persist?: false;

} | {
  key     : string;
  persist?:
    | true
    | {
      schema    ?: S;
      storage   ?: Storage;
      overwrite ?: "always" | "initial" | "never";
      serializer?: Serializer<T>;
    };
});


export type BetterReadable<T, N extends number = 0> = {
  subscribe: (this: void, run: Subscriber<T, N>, invalidate?: Invalidator<T>) => Unsubscriber;
};


export type BetterWritable<T, N extends number = 0> =
  BetterReadable<T, N> & {
    get         : () => T;
    set         : (value: T) => void;
    update      : (updater: Updater<T>) => void;
    isPersistent: boolean;
  } & (QuantifiedTuple<any, N> extends [] ? {} : {
    previous    : QuantifiedTuple<BetterReadable<T, N>, N>;
  });


export interface Serializer<T> {
  parse    : (v: string) => T;
  stringify: (v: T     ) => string;
};


const eq  = (a: any, b: any) => !(a != a ? b == b : a !== b || (a && typeof a === "object") || typeof a === "function");
const nop = () => {};


type Queue = [((v: any) => void) | ((v: any, ...o: any[]) => void), any, any[]][]
type Keyed = Map<string, BetterWritable<any, any>>

const subCallbackQueue: Queue = [];
const keyedWritableMap: Keyed = new Map();


export const writable = <
  T,
  N extends number  = 0,
  S extends ZodType = never,
> (
  initialValue: z.infer<S> extends never ? T : z.infer<S>,
  config      : WritableConfig<z.infer<S> extends never ? T : z.infer<S>, S, N> = {},

): BetterWritable<z.infer<S> extends never ? T : z.infer<S>, N> => {
  // Actual type of the value
  type AT = z.infer<S> extends never ? T : z.infer<S>;


  const {
    key,

    start        = nop,
    isEqual      = eq,
    forceFire    = false,
    trackerCount = 0,
  } = config;

  let {
    persist = false,
  } = config;


  // if key is provided, check if it's already in the map
  if (key && keyedWritableMap.has(key))
    return keyedWritableMap.get(key) as BetterWritable<AT, N>;


  // if persist is true, set default serializer and storage type
  if (typeof persist === "boolean" && persist) {
    // check if key is provided
    if (key == null) throw new Error(
      "key must be provided when persist is true");

    // check if localStorage is available
    if (typeof localStorage === "undefined")
      throw new Error("localStorage is not available");

    persist = {};
  }


  // check if storage is available
  if (persist) {
    persist.storage    ??= localStorage;
    persist.overwrite  ??= "never";
    persist.serializer ??= JSON;

    InitialSync: { // check if value is already in storage
      const { schema, storage, overwrite, serializer } = persist;

      // try getting the initial value from storage
      const value = storage.getItem(key!);

      // publish the fallback value in storage if not present
      if (value == null) {
        storage.setItem(key!, serializer.stringify(initialValue));
        break InitialSync;
      }

      // try parsing the value from storage
      const parsed = serializer.parse(value);

      // if validating the value with zod failed
      if (schema != null && !schema.safeParse(parsed).success) {
        // throw error if overwrite is false
        if (overwrite === "never")
          throw new Error(`Old value of key: '${key}' in storage is invalid`);

        // overwrite the value in storage and log warning
        storage.setItem(key!, serializer.stringify(initialValue));
        console.warn(`Old value of key: '${key}' in storage is invalid and overwritten`);
        break InitialSync;
      }

      // set the initial value
      initialValue = <any>parsed;
    }

    // listen to storage change in other tabs
    addEventListener("storage", e => {
      const {
        key     : k,
        newValue: v,
        storageArea,
      } = e;

      // should not be happening
      if (typeof persist === "boolean") return;

      const {
        schema,
        storage,
        overwrite,
        serializer,
      } = persist;

      // check if key and storage is the correct
      if (k !== key || storageArea !== storage) return;

      // check if key been removed
      if (v == null) throw new Error(
        `key: '${key}' must not be removed from storage`);

      // try parsing the value from storage
      const value = serializer!.parse(v);

      // try validate the value with zod
      if (schema != null && !schema.safeParse(value).success) {
        if (overwrite !== "always")
          throw new Error(`Value of key: '${key}' has been polluted.`);

        // overwrite the value in storage and log warning
        storage!.setItem(key!, serializer!.stringify(values[0]));
        console.warn(`Value of key: '${key}' has been polluted and overwritten`);
      }

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


  let values     : AT[]                    = [];
  let trackers   : BetterReadable<AT, N>[] = [];
  let subscribers: Set<SITuple<AT, N>>[]   = [];
  let subCount   : number                  = 0;


  function set(v: AT) {
    // check if value is changed
    if (!isEqual(values[0], v)) {
      // only set to storage if value is changed
      if (typeof persist === "object") {
        const { storage, serializer } = persist;
        storage!.setItem(key!, serializer!.stringify(v));
      }
    }

    // early return if not changed and not forceFire
    else if (!forceFire) return;

    // unshift the value into the window
    values.unshift(copy(v));
    values = values.slice(0, trackerCount+1);

    // store not ready
    if (!stop) return;

    // check if the there's queue to run
    let runQueue = !subCallbackQueue.length;

    subscribers.forEach((sub, i) =>
      sub.forEach(([run, inv]) => {
        // invalidate the tracker
        inv(values[i])

        // push the callback into the queue
        subCallbackQueue.push([
          run as any,
          values[i],
          values.slice(1)
        ]);
      }));

    // i really don't know the reason for this
    // i just stole it from svelte/store :D
    if (runQueue) {
      subCallbackQueue.forEach(
        ([run, n, o]) => run(n, ...o));
      subCallbackQueue.length = 0;
    }
  };


  function update(fn: Updater<AT>) { set(fn(values[0])); };


  // create the all the trackers
  for (let i=0; i<=trackerCount; i++) {
    values     .push(initialValue);
    subscribers.push(new Set());
    trackers   .push({
      subscribe: (run, invalidate=nop) => {
        const sub: SITuple<AT, N> = [run, invalidate];

        // add the subscriber and increment the count
        subscribers[i].add(sub);
        subCount++;

        // set the stop function and call start
        if (subCount === 1)
          stop = start(set, update) || nop;

        // run the callback once
        run(values[i], ...values.slice(1) as QuantifiedTuple<T, N>);

        return () => {
          // remove the subscriber and decrement the count
          subscribers[i].delete(sub);
          subCount--;

          // call stop if there's no more subscriber
          if (subCount === 0) {
            stop?.();
            stop = null;
          }
        };
      }
    });
  }


  const store: BetterWritable<AT, N> = {
    get         : () => values[0],
    subscribe   : trackers[0].subscribe,
    isPersistent: persist !== false,

    set,
    update,

    ...(trackerCount <= 0 ? {} : {
      previous  : trackers.slice(1),
    }),
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
