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


type Queue = [((v: any) => void) | ((v: any, ...o: any[]) => void), any, any[]][]
type Keyed = Map<string, Writable<any, any>>


// Utils
function NOP() {};
function EQ(a: any, b: any) {
  return !(a != a ? b == b : a !== b ||
    (a && typeof a === "object") ||
    typeof a === "function")
};


// Main
const subCallbackQueue: Queue = [];

class Writable<T, N extends number=0>
  implements BetterWritable<T, N>
{
  #initialValue: T;

  #values      : T[]                    = [];
  #trackers    : BetterReadable<T, N>[] = [];
  #subscribers : Set<SITuple<T, N>>[]   = [];

  #isEqual     : (a: T, b: T) => boolean;
  #notifier    : StartStopNotifier<T>   ;
  #forceEmit   : boolean                ;
  #trackerCount: N                      ;
  #isPersistent: boolean                ;

  #key        ?: string       ;
  #schema     ?: any          ;
  #overwrite  ?: OWOptions    ;
  #serializer ?: Serializer<T>;
  #storageArea?: Storage      ;

  #stop?: () => void;


  constructor(
    initial: T,
    configs: WritableConfig<T, any, N> = {},
  ) {
    // set the initial value
    this.#initialValue = initial;

    // set the configs
    this.#key          = configs.key;
    this.#isEqual      = configs.isEqual      ?? EQ;
    this.#notifier     = configs.notifier     ?? NOP;
    this.#forceEmit    = configs.forceEmit    ?? false;
    this.#trackerCount = configs.trackerCount ?? 0 as N;
    this.#isPersistent = !!configs.persist;

    // initial setup
    this.setupPersist(initial, configs.persist ?? false);
    this.setupTracker();

    // call the initiator
    configs.initiator?.(initial);
  }


  public get(): T {
    return this.#values[0];
  }

  public set(v: T): void {
    // check if value is changed
    if (!this.#isEqual(this.#values[0], v)) {
      // only set to storage if value is changed
      if (this.#isPersistent) this.#storageArea!
        .setItem(this.#key!, this.#serializer!.stringify(v));
    }

    // early return if not changed and not forceFire
    else if (!this.#forceEmit) return;

    // unshift the value into the window
    this.#values.unshift(this.copy(v));
    this.#values = this.#values.slice(0, this.#trackerCount+1);

    // store not ready
    if (!stop) return;

    // check if the there's queue to run
    let runQueueLen = !subCallbackQueue.length;

    this.#subscribers.forEach((sub, i) =>
      sub.forEach(([run, inv]) => {
        // invalidate the tracker
        inv(this.#values[i])

        // push the callback into the queue
        subCallbackQueue.push([
          run as any,
          this.#values[i],
          this.#values.slice(1)
        ]);
      }));

    // i really don't know the reason for this
    // i just stole it from svelte/store :D
    if (runQueueLen) {
      subCallbackQueue.forEach(
        ([run, n, o]) => run(n, ...o));
      subCallbackQueue.length = 0;
    }
  }

  public update(updater: Updater<T>): void {
    this.set(updater(this.get()));
  }

  public subscribe(
    run        : Subscriber<T, N>,
    invalidate?: Invalidator<T>,
  ): Unsubscriber {
    return this.#trackers[0].subscribe(run, invalidate);
  }

  public toReadable(): BetterReadable<T, N> {
    return Writable.createComputed(this.bounded());
  }

  public toComputed<S>(f: (v: T) => S): BetterReadable<S, N> {
    return Writable.createComputed(this.bounded(), f);
  }

  public get isPersistent(): boolean {
    return this.#isPersistent;
  }

  public get key(): string | undefined {
    return this.#key;
  }

  public get schema(): any | undefined {
    return this.#schema;
  }

  public get overwrite(): OWOptions | undefined {
    return this.#overwrite;
  }

  public get serializer(): Serializer<T> | undefined {
    return this.#serializer;
  }

  public get trackers(): QuantifiedTuple<BetterReadable<T, N>, N> {
    return [...this.#trackers.slice(1)] as QuantifiedTuple<BetterReadable<T, N>, N>;
  }

  public get previous(): QuantifiedTuple<T, N> {
    return this.#values.slice(1) as QuantifiedTuple<T, N>;
  }


  private setupPersist(
    initial: T,
    persist: WritableConfig<T, any, N>["persist"],
  ) {
    // return if persist is falsy
    if (!persist) return;

    // if persist is true, set default serializer and storage type
    if (typeof persist === "boolean") {
      // check if key is provided
      if (this.#key == null) throw new Error(
        "key must be provided when persist is true");

      // check if localStorage is available
      if (typeof localStorage === "undefined")
        throw new Error("localStorage is not available");

      persist = {};
    }

    const schema     = persist.schema     ?? null;
    const storage    = persist.storage    ?? localStorage;
    const overwrite  = persist.overwrite  ?? "never";
    const serializer = persist.serializer ?? JSON;

    this.#schema      = schema;
    this.#overwrite   = overwrite;
    this.#serializer  = serializer;
    this.#storageArea = storage;

    this.initialSync(initial);

    // listen to storage change in other tabs
    addEventListener("storage", e => this.onStorage(e));
  }

  private initialSync(initial: T) {
    const schema     = this.#schema     !;
    const storage    = this.#storageArea!;
    const overwrite  = this.#overwrite  !;
    const serializer = this.#serializer !;

    // try getting the initial value from storage
    const value = storage.getItem(this.#key!);

    // publish the fallback value in storage if not present
    if (value == null) {
      storage.setItem(this.#key!, serializer.stringify(initial));
      return;
    }

    // try parsing the value from storage
    const parsed = serializer.parse(value);

    // if validating the value with zod failed
    if (schema != null && !schema.safeParse(parsed).success) {
      // throw error if overwrite is false
      if (overwrite === "never")
        throw new Error(`Old value of key: '${this.#key}' in storage is invalid`);

      // overwrite the value in storage and log warning
      storage.setItem(this.#key!, serializer.stringify(initial));
      console.warn(`Old value of key: '${this.#key}' in storage is invalid and overwritten`);
      return;
    }

    // set the initial value
    this.#initialValue = parsed;
  }

  private onStorage(e: StorageEvent) {
    const {
      key     : k,
      newValue: v,
      storageArea,
    } = e;

    // check if key and storage is the correct
    if (k !== this.#key || storageArea !== this.#storageArea) return;

    // check if key been removed
    if (v == null) throw new Error(
      `key: '${this.#key}' must not be removed from storage`);

    // try parsing the value from storage
    const value = this.#serializer!.parse(v);

    // try validate the value with zod
    if (this.#schema != null && !this.#schema.safeParse(value).success) {
      if (this.#overwrite !== "always") throw new Error(
        `Value of key: '${this.#key}' has been polluted.`);

      // overwrite the value in storage and log warning
      this.#storageArea!.setItem(this.#key!, this.#serializer!.stringify(this.#values[0]));
      console.warn(`Value of key: '${this.#key}' has been polluted and overwritten`);
    }

    this.set(value);
  }

  private copy<T>(v: T) {
    return (
      typeof v === "object" &&
      this.#trackerCount > 0
    ) ? structuredClone(v) : v;
  }

  private setupTracker() {
    // just for reference
    const self = this;

    // create the all the trackers
    for (let i=0; i<=this.#trackerCount; i++) {
      this.#subscribers.push(new Set());
      this.#values     .push(this.#initialValue);
      this.#trackers   .push({
        get key         () { return self.key;          },
        get schema      () { return self.schema;       },
        get previous    () { return self.#values.slice(1) as QuantifiedTuple<T, N>; },
        get overwrite   () { return self.overwrite;    },
        get serializer  () { return self.serializer;   },
        get isPersistent() { return self.isPersistent; },

        get      : () => this.#values[i],
        subscribe: (run, inv=NOP) => {
          const sub: SITuple<T, N> = [run, inv];

          // add the subscriber and increment the count
          this.#subscribers[i].add(sub);

          // set the stop function and call start
          if (this.#subscribers.length === 1)
            this.#stop = this.#notifier(
              (v) => this.set(v),
              (u) => this.update(u)
            ) || NOP;

          // run the callback once
          run(this.#values[i], ...this.#values
            .slice(1) as QuantifiedTuple<T, N>);

          return () => {
            // remove the subscriber and decrement the count
            this.#subscribers[i].delete(sub);

            // call stop if there's no more subscriber
            if (this.#subscribers.length === 0) {
              this.#stop?.();
              this.#stop = undefined;
            }
          };
        },

        toComputed<U>(f: (v: T) => U) {
          return Writable.createComputed(this, v => f(v));
        }
      });
    }
  }

  private static createComputed<T, N extends number, S=T>(
    r: BetterReadable<T, N>,
    f?: (v: T) => S,
  ): BetterReadable<S, N> {
    if (f) return {
      get key         () { return r.key;          },
      get schema      () { return r.schema;       },
      get overwrite   () { return r.overwrite;    },
      get isPersistent() { return r.isPersistent; },

      get previous    () { return r.previous.map(f) as QuantifiedTuple<S, N>; },
      get serializer  () { return r.serializer      as Serializer<S> | undefined; },

      get      : () => f(r.get()),
      subscribe: (run, inv=NOP) => r.subscribe(
        (v : T, ...a: any) => run(f(v), ...a.map(f)),
        (v?: T           ) => inv(v && f(v))),

      toComputed<U>(g: (v: S) => U) {
        return Writable.createComputed(this, g);
      }
    };

    return {
      ...r,

      set       : undefined,
      update    : undefined,
      trackers  : undefined,
      toReadable: undefined,
    } as any;
  }


  public bounded(): BetterWritable<T, N> {
    const self = this;

    return {
      get key         () { return self.key;          },
      get schema      () { return self.schema;       },
      get trackers    () { return self.trackers;     },
      get previous    () { return self.previous;     },
      get overwrite   () { return self.overwrite;    },
      get serializer  () { return self.serializer;   },
      get isPersistent() { return self.isPersistent; },

      get       : self.get       .bind(self),
      set       : self.set       .bind(self),
      update    : self.update    .bind(self),
      subscribe : self.subscribe .bind(self),
      toComputed: self.toComputed.bind(self),
      toReadable: self.toReadable.bind(self),
    }
  }
}


export interface BetterReadable<T, N extends number = 0> {
  get       : () => T;
  toComputed: <S>(f: (v: T) => S) => BetterReadable<S, N>;
  subscribe : (
    this       : void,
    run        : Subscriber<T, N>,
    invalidate?: Invalidator<T>
  ) => Unsubscriber;

  get key         (): string | undefined;
  get schema      (): any    | undefined;
  get previous    (): QuantifiedTuple<T, N>;
  get overwrite   (): OWOptions | undefined;
  get serializer  (): Serializer<T> | undefined;
  get isPersistent(): boolean;
}


export interface BetterWritable<T, N extends number = 0>
  extends BetterReadable<T, N>
{
  set       : (v: T) => void;
  update    : (f: Updater<T>) => void;
  toReadable: () => BetterReadable<T, N>;

  get trackers(): QuantifiedTuple<BetterReadable<T, N>, N>;
}


// Factory
const keyedWritableMap: Keyed = new Map();

export function writable<
  T,
  N extends number  = 0,
  S extends ZodType = never,
> (
  initial: z.infer<S> extends never ? T : z.infer<S>,
  configs: WritableConfig<z.infer<S> extends never ? T : z.infer<S>, S, N> = {},
): BetterWritable<z.infer<S> extends never ? T : z.infer<S>, N> {
  type AT = z.infer<S> extends never ? T : z.infer<S>;

  // if key is provided, check if it's already in the map
  const { key } = configs;

  const writable: Writable<AT, N> =
    (key && keyedWritableMap.get(key)) ||
    new Writable<AT, N>(initial, configs);

  if (key && !keyedWritableMap.has(key))
    keyedWritableMap.set(key, writable);

  return writable.bounded();
}
