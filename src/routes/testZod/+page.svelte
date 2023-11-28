<script context="module" lang="ts">
  import { z        } from "zod";
  import { writable } from "$lib/index.js";


  const count1 = writable(0, {
    key: "count",
    trackerCount: 1,
    persist: {
      schema: z.number(),
      overwrite: "initial",
    },
    isEqual(a, b) {
      return a === b;
    },
  });
</script>


<div>Count1: {$count1}</div>

<button on:click={() => $count1++}>  +  </button>
<button on:click={() => $count1=0}>reset</button>
<button on:click={() => $count1--}>  -  </button>
