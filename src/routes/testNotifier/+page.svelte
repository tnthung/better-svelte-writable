<script lang="ts">
  import { onMount  } from "svelte";
  import { writable } from "$lib/index.js";


  const states = writable([] as string[]);

  const count = writable(0, {
    notifier: () => {
      $states.push("notified");
      $states = $states;


      return () => {
        $states.push("unsubscribed");
        $states = $states;
      };
    }
  });


  onMount(() => {
    // Constantly subscribe and unsubscribe
    // will not trigger notifier
    const id = setInterval(() => {
      // Sub 2
      count.subscribe(() => {})();
    }, 1000);

    return () => clearInterval(id);
  });
</script>


<!-- Sub 1, Remove these to see changes-->
<div>new {$count}</div>
<button on:click={() => $count++}>  +  </button>
<button on:click={() => $count=0}>reset</button>
<button on:click={() => $count--}>  -  </button>


{#each $states as state}
  <div>{ state }</div>
{/each}