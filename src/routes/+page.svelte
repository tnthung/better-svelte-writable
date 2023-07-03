<script context="module" lang="ts">
  import { writable } from "$lib/writable.js";
  const count = writable(0, {
    "trackerCount": 3,
  });

  const {
    previous: [prev1],
  } = count;


  count.subscribe((n, [o1, o2, o3]) => {
    console.log(`count: ${o3} -> ${o2} -> ${o1} -> ${n}`);
  });
</script>


<div>new {$count}</div>
<div>old {$prev1}</div>

<button on:click={() => $count++}>+</button>
<button on:click={() => count.set(0)}>reset</button>
<button on:click={() => $count--}>-</button>
