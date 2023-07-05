<script context="module" lang="ts">
  import { writable } from "$lib/writable.js";


  const count1 = writable(0, { key: "count", persist: true });
  const count2 = writable(0, { key: "count" });
</script>


<div>Count1: {$count1}</div>
<div>Count2: {$count1}</div>

<button on:click={() => $count1++}>  +  </button>
<button on:click={() => $count1=0}>reset</button>
<button on:click={() => $count1--}>  -  </button>
