<script>
  let { value = Promise.resolve('async head') } = $props();
  const resolved = await value;
</script>
<svelte:head><meta name="svelte-async-head" content={resolved} /></svelte:head>
<p>{resolved}</p>
