<script>
	let { data } = $props();
</script>

<svelte:head><title>{data.title} | The Daily Fixture</title><meta name="description" content={data.description} /></svelte:head>
<main class="layout"><article><h1>{data.title}</h1><p class="meta">By <a href="/authors/{data.authorSlug}/">{data.author}</a> · <time datetime={data.date}>{data.day}</time></p><ul class="tags">{#each data.tags as t}<li><a href="/tags/{t}/">{t}</a></li>{/each}</ul><div class="body">{@html data.html}</div></article><aside class="related"><h2>Related</h2><ul>{#each data.related as r (r.slug)}<li><a href="/articles/{r.slug}/">{r.title}</a><time datetime={r.date}>{r.day}</time></li>{/each}</ul></aside></main>
