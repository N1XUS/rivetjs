<script lang="ts">
  import { onMount } from 'svelte';
  let { count = 0, label = 'fallback', onIncrement, onReady, onDispose, children, title } = $props();
  let local = $state(0);
  const id = $props.id();
  onMount(() => { onReady?.(); return () => onDispose?.(); });
</script>
<article id={id}>
  <span class="count">{count}</span><span class="label">{label}</span><span class="local">{local}</span>
  <button class="increment" onclick={() => { local++; onIncrement?.(1); }}>increment</button>
  {@render title?.()}
  {@render children?.()}
</article>
<style>article { color: rgb(20, 30, 40); }</style>
