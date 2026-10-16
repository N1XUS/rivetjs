<script>
	import ListPage from "../lib/ListPage.svelte";
	let { data } = $props();
</script>

<ListPage n={data.n} pages={data.pages} items={data.items} />
