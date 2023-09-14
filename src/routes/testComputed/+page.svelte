<script lang="ts">
  import { writable } from "$lib/writable.js";

  const count1 = writable(0);

  const mul2 = count1.toComputed(c => c *  2);
  const div2 = count1.toComputed(c => c /  2);
  const pow2 = count1.toComputed(c => c ** 2);
  const mul4 = mul2.toComputed(c => c *  2);
</script>


<div>Count1: {$count1}</div>
<div>------------------------</div>
<div>Count1 / 2: {$div2}</div>
<div>Count1 * 2: {$mul2}</div>
<div>Count1 * 4: {$mul4}</div>
<div>Count1 ^ 2: {$pow2}</div>

<button on:click={() => $count1++}>  +  </button>
<button on:click={() => $count1=0}>reset</button>
<button on:click={() => $count1--}>  -  </button>
