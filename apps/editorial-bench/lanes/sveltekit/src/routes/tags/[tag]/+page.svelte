<script>
	import Teasers from "../../../lib/Teasers.svelte";
	let { data } = $props();
</script>

<svelte:head><title>Tag: {data.tag} | The Daily Fixture</title><meta name="description" content="Stories tagged {data.tag}." /></svelte:head>
<main class="list"><h1>Tag: {data.tag}</h1><Teasers items={data.items} /></main>
