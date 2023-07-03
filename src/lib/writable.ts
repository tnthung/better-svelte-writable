import type {
  Updater,
  Invalidator,
  Unsubscriber,
} from "svelte/store";


type QuantifiedTuple<T, N extends number, A extends T[] = []> =
  A["length"] extends N ? A : QuantifiedTuple<T, N, [...A, T]>;


type Subscriber<T, N extends number> =
  (value: T, oldValues: QuantifiedTuple<T, N>) => void;


type StartStopNotifier<T> = (
  set   : (v: T         ) => void,
  update: (f: Updater<T>) => void
) => (void | (() => void))


// stolen from svelte/store's private types "SubscribeInvalidateTuple<T>" :D
type SITuple<T, N extends number> = [Subscriber<T, N>, Invalidator<T>];


type WritableConfig<T, N extends number> = {
  start       ?: StartStopNotifier<T>,    // start/stop notifier, default: () => {}
  isEqual     ?: (a: T, b: T) => boolean; // custom equality function, default: (a, b) => a === b
  forceFire   ?: boolean;                 // force fire on set and update, regardless of value change, default: false
  trackerCount?: N;                       // number of previous values to track, default: 0
};


interface BetterReadable<T, N extends number> {
  subscribe: (this: void, run: Subscriber<T, N>, invalidate?: Invalidator<T>) => Unsubscriber;
};


interface BetterWritable<T, N extends number> extends BetterReadable<T, N> {
  get     : () => T;
  set     : (value: T) => void;
  update  : (updater: Updater<T>) => void;
  previous: QuantifiedTuple<BetterReadable<T, N>, N>;
};


const noop = () => {};

const subCallbackQueue: [Subscriber<any, any>, any, any[]][] = [];


export const writable = <T, N extends number = 0> (
  initialValue: T,
  config: WritableConfig<T, N> = {}
): BetterWritable<T, N> => {
  const {
    start        = noop,
    isEqual      = (a: T, b: T) => a === b,
    forceFire    = false,
    trackerCount = 0,
  } = config;


  let stop: (() => void) | null = null;


  let values     : T[]                    = [];
  let trackers   : BetterReadable<T, N>[] = [];
  let subscribers: Set<SITuple<T, N>>[]   = [];
  let subCount   : number                 = 0;


  function set(v: T) {
    if (!forceFire && isEqual(values[0], v))
      return;

    values.unshift(v);
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

  return {
    get      : () => values[0],
    previous : trackers.slice(1) as QuantifiedTuple<BetterReadable<T, N>, N>,
    subscribe: trackers[0].subscribe,

    set,
    update,
  };
};
