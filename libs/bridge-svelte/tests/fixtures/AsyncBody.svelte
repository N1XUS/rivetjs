<script>
  let { wait, onClick } = $props();
  const shown = await wait();
</script>
{#if shown}<button class="async-body" onclick={onClick}>ready</button>{/if}
