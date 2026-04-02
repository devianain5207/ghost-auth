<script lang="ts">
  import CountdownRing from "$shared/components/CountdownRing.svelte";
  let { remaining, period = 30 }: { remaining: number; period?: number } = $props();
</script>
<CountdownRing {remaining} {period} />
