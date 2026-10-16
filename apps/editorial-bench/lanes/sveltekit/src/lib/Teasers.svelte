<script>
	let { items } = $props();
</script>

<ul class="teasers">{#each items as a (a.slug)}<li class="teaser"><h2><a href="/articles/{a.slug}/">{a.title}</a></h2><p class="meta">{a.author} · <time datetime={a.date}>{a.day}</time></p><p>{a.description}</p></li>{/each}</ul>
