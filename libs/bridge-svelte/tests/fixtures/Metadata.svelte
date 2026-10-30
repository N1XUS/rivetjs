<script>let { label = 'one' } = $props();</script>
<svelte:head><meta name="svelte-island" content={label} /></svelte:head>
<p>{label}</p>
