<script context="module" lang="ts">
  import { writable } from "$lib/writable.js";


  const count = writable(0, { "trackerCount": 2 });
  const { previous: [prev1] } = count;


  count.subscribe((n, [o1, o2]) =>
    console.log(`${o2} -> ${o1} -> ${n}`));
</script>


<div>new {$count}</div>
<div>old {$prev1}</div>

<button on:click={() => $count++}>  +  </button>
<button on:click={() => $count=0}>reset</button>
<button on:click={() => $count--}>  -  </button>
