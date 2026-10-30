<script>let { value = Promise.resolve('resolved') } = $props();</script>
<p>{await value}</p>
