<script context="module" lang="ts">
  import { writable } from "$lib/index.js";


  const count1 = writable(0, { key: "count", persist: true });
  const count2 = writable(0, { key: "count" });
</script>


<div>Count1: {$count1}</div>
<div>Count2: {$count2}</div>

<button on:click={() => $count1++}>  +  </button>
<button on:click={() => $count1=0}>reset</button>
<button on:click={() => $count1--}>  -  </button>
