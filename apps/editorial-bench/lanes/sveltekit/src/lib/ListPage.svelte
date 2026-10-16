<script>
	import Teasers from "./Teasers.svelte";
	let { n, pages, items } = $props();
	const title = $derived(n === 1 ? "Latest" : `Latest, page ${n}`);
</script>

<svelte:head><title>{title} | The Daily Fixture</title><meta name="description" content="Latest stories from The Daily Fixture." /></svelte:head>
<main class="list"><h1>{title}</h1><Teasers {items} /><nav class="pager">{#if n > 1}<a href={n === 2 ? "/" : `/page/${n - 1}/`}>Newer</a>{/if}<span>Page {n} of {pages}</span>{#if n < pages}<a href="/page/{n + 1}/">Older</a>{/if}</nav></main>
