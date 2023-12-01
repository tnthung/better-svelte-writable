import type {
  z,
  ZodType,
} from "zod";

import type {
  Updater,
  Invalidator,
  Unsubscriber,
} from "svelte/store";


// Type definitions
type IsPos <N extends number> = `${N}` extends `-${string}` ? false : true;
type CapPos<N extends number> = IsPos<N> extends true ? N : 0;


type OWOptions = "always" | "initial" | "never";


type QuantifiedTuple<T, N extends number, A extends T[] = []> =
  CapPos<N> extends infer U
    ? U extends number
      ? A["length"] extends U
        ? A
        : QuantifiedTuple<T, N, [T, ...A]>
      : []
    : [];


export type Subscriber<T, N extends number = 0> = IsPos<N> extends true
  ? (value: T, ...prevs: QuantifiedTuple<T, N>) => void
  : (value: T                                 ) => void;


export type StartStopNotifier<T> = (
  set   : (v: T         ) => void,
  update: (f: Updater<T>) => void
) => (void | (() => void))


// stolen from svelte/store's private types "SubscribeInvalidateTuple<T>" :D
type SITuple<T, N extends number> = [Subscriber<T, N>, Invalidator<T>];


export type Serializer<T> = {
  parse    : (v: string) => T;
  stringify: (v: T     ) => string;
};


// key         : key for syncing,                                           default: undefined
// isEqual     : custom equality function,                                  default: (a, b) => a === b
// notifier    : start/stop notifier,                                       default: () => {}
// forceEmit   : `set` and `update` will emitting event even if no changes, default: false
// trackerCount: number of previous values to track,                        default: 0
// persist     : persist to storage,                                        default: false
//   schema    : storage type,                                              default: localStorage
//   storage   : for verifying the value from storage,                      default: undefined
//   overwrite : if overwrite when initial sync failed verification,        default: false
//   serializer: serializer for syncing,                                    default: JSON
export type WritableConfig<
  T,
  S extends ZodType = never,
  N extends number  = 0
> = {
  isEqual     ?: (a: T, b: T) => boolean;
  notifier    ?: StartStopNotifier<T>;
  initiator   ?: (v: T) => void;
  forceEmit   ?: boolean;
  trackerCount?: N;

} & ({
  key    ?: string;
  persist?: false;

} | {
  key    : string;
  persist:
    | true
    | {
      schema    ?: S;
      storage   ?: Storage;
      overwrite ?: OWOptions;
      serializer?: Serializer<T>;
    };
});


export interface BetterReadable<T, N extends number = 0> {
  on: (value: T, cb: (v: T) => void) => Unsubscriber;

  get: () => T;

  subscribe: (
    this       : void,
    run        : Subscriber<T, N>,
    invalidate?: Invalidator<T>
  ) => Unsubscriber;

  toComputed: <S>(f: (v: T) => S) => BetterReadable<S, N>;

  key         : string        | undefined;
  schema      : any           | undefined;
  storage     : Storage       | undefined;
  overwrite   : OWOptions     | undefined;
  serializer  : Serializer<T> | undefined;
  isPersistent: boolean;

  previous: QuantifiedTuple<BetterReadable<T, N>, N>;
}


export interface BetterWritable<T, N extends number = 0>
  extends BetterReadable<T, N>
{
  set       : (v: T) => void;
  update    : (f: Updater<T>) => void;
  toReadable: () => BetterReadable<T, N>;
}


type Queue = [((v: any) => void) | ((v: any, ...o: any[]) => void), any, any[]][]
type Keyed = Map<string, BetterWritable<any, any>>


// Utils
function NOP() {};
function EQ(a: any, b: any) {
  return !(a != a ? b == b : a !== b ||
    (a && typeof a === "object") ||
    typeof a === "function")
};


function createComputed<T, N extends number, S=T>(
  r : BetterReadable<T, N>,
  f?: (v: T) => S,
): BetterReadable<S, N> {
  const tmp: BetterReadable<S, N> = {
    ...r as any
  };

  if (f) {
    tmp.get        = () => f(r.get());
    tmp.toComputed = <U>(g: (v: S) => U) => createComputed(tmp, g);

    tmp.subscribe = (run, inv=NOP) => r.subscribe(
      (v : T, ...a: any) => run(f(v), ...a.map(f)),
      (v?: T           ) => inv(v && f(v)));
  }

  {
    type DEL = Partial<Omit<BetterWritable<T>, keyof BetterReadable<T>>>;

    delete (tmp as DEL).set       ;
    delete (tmp as DEL).update    ;
    delete (tmp as DEL).toReadable;
  }

  return tmp;
}


// Main
const subCallbackQueue: Queue = [];
const keyedWritableMap: Keyed = new Map();


export function writable<
  T,
  N extends number  = 0,
  S extends ZodType = never,
>(
  initial: z.infer<S> extends never ? T : z.infer<S>,
  configs: WritableConfig<z.infer<S> extends never ? T : z.infer<S>, S, N> = {},
): BetterWritable<z.infer<S> extends never ? T : z.infer<S>, N>
{
  if (configs.key && keyedWritableMap.has(configs.key))
    return keyedWritableMap.get(configs.key)!;

  type AT = z.infer<S> extends never ? T : z.infer<S>;

  let stop    = null    as null | (() => void);
  let present = initial as AT;

  const previous    = []        as BetterWritable<AT>[];
  const subscribers = new Set() as Set<SITuple<AT, 0>>;

  const key          = configs.key;
  const isEqual      = configs.isEqual      ?? EQ    as (a: AT, b: AT) => boolean;
  const notifier     = configs.notifier     ?? NOP   as StartStopNotifier<AT>;
  const forceEmit    = configs.forceEmit    ?? false as boolean;
  const trackerCount = configs.trackerCount ?? 0     as N;
  const isPersistent = !!configs.persist;


  // get all the persist configs
  const {
    schema,
    storage,
    overwrite,
    serializer,
  } = (() => {
    type Persist = Exclude<
      WritableConfig<AT, S, N>["persist"],
      boolean | undefined>;

    if (!configs.persist)
      return {} as Persist;

    if (typeof configs.persist === "boolean")
      return {
        schema    : undefined,
        storage   : localStorage,
        overwrite : "never",
        serializer: JSON,
      } as Persist;

    return {
      schema    : configs.persist.schema,
      storage   : configs.persist.storage,
      overwrite : configs.persist.overwrite  ?? "never",
      serializer: configs.persist.serializer ?? JSON,
    } as Persist;
  })();


  if (isPersistent) {
    // do the initial sync
    initialSync: {
      const value = storage?.getItem(key!);

      // publish the fallback value in storage if not present
      if (value == null) {
        storage!.setItem(key!, serializer!.stringify(initial));
        break initialSync;
      }

      // try parsing the value from storage
      const parsed = serializer!.parse(value);

      // if validating the value with zod failed
      if (schema != null && !schema.safeParse(parsed).success) {
        // throw error if overwrite is false
        if (overwrite === "never")
          throw new Error(`Old value of key: '${key}' in storage is invalid`);

        // overwrite the value in storage and log warning
        storage!.setItem(key!, serializer!.stringify(initial));
        console.warn(`Old value of key: '${key}' in storage is invalid and overwritten`);
        break initialSync;
      }

      // set the initial value
      initial = parsed;
    }

    // listen to storage change in other tabs
    addEventListener("storage", e => {
      const {
        key     : k,
        newValue: v,
        storageArea,
      } = e;

      // check if key and storage is the correct
      if (k !== key || storageArea !== storageArea) return;

      // check if key been removed
      if (v == null) throw new Error(
        `key: '${key}' must not be removed from storage`);

      // try parsing the value from storage
      const value = serializer!.parse(v);

      // try validate the value with zod
      if (schema != null && !schema.safeParse(value).success) {
        if (overwrite !== "always") throw new Error(
          `Value of key: '${key}' has been polluted.`);

        // overwrite the value in storage and log warning
        storageArea!.setItem(key!, serializer!.stringify(present));
        console.warn(`Value of key: "${key}" has been polluted and overwritten`);
      }

      set(value);
    });
  }

  // setup all trackers
  for (let i = 0; i < trackerCount; i++)
    previous.push(writable(initial, {
      isEqual,
      notifier,
      forceEmit,
    }));

  function set(v: AT) {
    // check if value is changed
    if (!isEqual(present, v)) {
      // only set to storage if value is changed
      if (isPersistent) storage!
        .setItem(key!, serializer!.stringify(v));
    }

    // early return if not changed and not forceFire
    else if (!forceEmit) return;

    // bubble the value to all trackers
    if (trackerCount) {
      for (let i = trackerCount-1; i > 0; i--)
        previous[i].set(previous[i-1].get());

      previous[0].set(present);
    }

    // set the present value
    present = (
      typeof v === "object" &&
      trackerCount > 0
    ) ? structuredClone(v) : v;

    // early return if not ready
    if (!stop) return;

    // check if there's queue to run
    const needToRun = !subCallbackQueue.length;

    // run all the callbacks
    subscribers.forEach(([run, inv]) => {
      // invalidate the tracker
      inv(present);

      // push the callback into the queue
      subCallbackQueue.push([run, present, previous.map(p => p.get())]);
    });

    // run the queue if needed
    if (needToRun) {
      subCallbackQueue.forEach(
        ([run, n, o]) => run(n, ...o));
      subCallbackQueue.length = 0;
    }
  }

  function update(f: Updater<AT>) {
    set(f(present));
  }

  function subscribe(
    run : Subscriber <AT, N>,
    inv?: Invalidator<AT>,
  ) {
    const sub: SITuple<AT, 0> = [run as any, inv ?? NOP];

    // add the subscriber
    subscribers.add(sub);

    // set the stop function and call start
    if (subscribers.size === 1)
      stop = notifier(set, update) || NOP;

    // run the callback once
    run(present, ...previous.map(p => p.get()) as QuantifiedTuple<AT, N>);

    // return the unsubscribe function
    return () => {
      // remove the subscriber
      subscribers.delete(sub);

      // call stop if there's no more subscriber
      if (subscribers.size === 0) {
        stop?.();
        stop = null;
      }
    };
  }

  function on(value: AT, cb: (v: AT) => void) {
    return subscribe((v: AT, ..._: any) =>
      isEqual(v, value) && cb(v));
  }

  configs.initiator?.(present);

  const tmp: BetterWritable<AT, N> = {
    get       : () => present,
    toReadable: () => createComputed(tmp),
    toComputed: <S>(f: (v: AT) => S) => createComputed(tmp, f),

    previous: previous.map(p => p.toReadable()) as QuantifiedTuple<BetterReadable<AT>, N>,

    on,
    set,
    update,
    subscribe,

    key,
    schema,
    storage,
    overwrite,
    serializer,
    isPersistent,
  };


  if (key) keyedWritableMap.set(key, tmp);

  return tmp;
}
