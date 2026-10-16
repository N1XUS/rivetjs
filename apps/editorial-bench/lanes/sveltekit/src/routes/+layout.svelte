<script>
	let { children } = $props();
	const nav = ["politics", "economy", "climate", "science", "health"];
</script>

<header class="site"><a class="brand" href="/">The Daily Fixture</a><nav>{#each nav as t}<a href="/tags/{t}/">{t}</a>{/each}</nav></header>{@render children()}<footer class="site"><p>The Daily Fixture · benchmark fixture content</p></footer>
