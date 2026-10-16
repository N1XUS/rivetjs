<script>
	import Teasers from "../../../lib/Teasers.svelte";
	let { data } = $props();
</script>

<svelte:head><title>{data.name} | The Daily Fixture</title><meta name="description" content="Stories by {data.name}." /></svelte:head>
<main class="list"><h1>{data.name}</h1><Teasers items={data.items} /></main>
