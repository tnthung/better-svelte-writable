import type {
  Updater,
  Invalidator,
  Unsubscriber,
} from "svelte/store";


type Subscriber<T> = (value: T, oldValues: T[]) => void;


type StartStopNotifier<T> = (
  set   : (v: T         ) => void,
  update: (f: Updater<T>) => void
) => (void | (() => void))


// stolen from svelte/store's private types "SubscribeInvalidateTuple<T>" :D
type SITuple<T> = [Subscriber<T>, Invalidator<T>];


type WritableConfig<T> = {
  start?: StartStopNotifier<T>,           // start/stop notifier, default: () => {}
  isEqual?: (a: T, b: T) => boolean;      // custom equality function, default: (a, b) => a === b
  forceFire?: boolean;                    // force fire on set and update, regardless of value change, default: false
  trackerCount?: number;                  // number of previous values to track, default: 0
};


interface BetterReadable<T> {
  subscribe: (this: void, run: Subscriber<T>, invalidate?: Invalidator<T>) => Unsubscriber;
};


interface BetterWritable<T> extends BetterReadable<T> {
  get      : () => T;
  set      : (value: T) => void;
  update   : (updater: Updater<T>) => void;
  previous : BetterReadable<T>[];
};


const noop = () => {};

const subCallbackQueue: [Subscriber<any>, any, any[]][] = [];


export const writable = <T> (
  initialValue: T,
  config: WritableConfig<T> = {}
): BetterWritable<T> => {
  const {
    start        = noop,
    isEqual      = (a: T, b: T) => a === b,
    forceFire    = false,
    trackerCount = 0,
  } = config;


  let stop: (() => void) | null = null;


  let values     : T[]                 = [];
  let trackers   : BetterReadable<T>[] = [];
  let subscribers: Set<SITuple<T>>[]   = [];
  let subCount   : number              = 0;


  function set(v: T) {
    if (isEqual(values[0], v) && !forceFire)
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
        ([run, n, o]) => run(n, o));
      subCallbackQueue.length = 0;
    }
  };

  function update(fn: Updater<T>) { set(fn(values[0])); };


  for (let i=0; i<=trackerCount; i++) {
    values     .push(initialValue);
    subscribers.push(new Set());
    trackers   .push({
      subscribe: (run, invalidate = noop) => {
        const sub: SITuple<T> = [run, invalidate];
        subscribers[i].add(sub);
        subCount++;

        if (subCount === 1)
          stop = start(set, update) || noop;

        run(values[i], values.slice(1));

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
    previous : trackers.slice(1),
    subscribe: trackers[0].subscribe,

    set,
    update,
  };
};
