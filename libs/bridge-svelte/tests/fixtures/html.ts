// Native Svelte 5.57.2 SSR fixtures; ssr.test.ts verifies these against compiled SFC output.
export const counterHtml =
  '<!--[--><!--$i0-s1--><article id="i0-s1" class="svelte-z5ju3q"><span class="count">1</span><span class="label">fallback</span><span class="local">0</span> <button class="increment">increment</button> <!----> <!----></article><!--]-->';
export const slotsHtml =
  '<!--[--><!--$i0-s1--><article id="i0-s1" class="svelte-z5ju3q"><span class="count">1</span><span class="label">fallback</span><span class="local">0</span> <button class="increment">increment</button> <rivet-slot name="title" style="display:contents"></rivet-slot><!----> <rivet-slot style="display:contents"></rivet-slot><!----></article><!--]-->';
export const headBodyHtml = "<!--[--><p>body</p><!--]-->";
export const rawHeadHtml =
  '<!--1k019os--><meta name="description" content="Svelte &amp; Rivet"/><link rel="canonical" href="https://example.com/"/><!----><title>Svelte &amp; Rivet</title>';
export const metadataoneHtml = "<!--[--><p>one</p><!--]-->";
export const metadataoneHead = '<!--1tjb25n--><meta name="svelte-island" content="one"/><!---->';
export const metadatatwoHtml = "<!--[--><p>two</p><!--]-->";
export const metadatatwoHead = '<!--1tjb25n--><meta name="svelte-island" content="two"/><!---->';
export const asyncBodyHtml = '<!--[--><!--[--><!--[0--><button class="async-body">ready</button><!--]--><!--]--><!--]-->';
