<script lang="ts">
  import SharedAbout from "$shared/components/About.svelte";

  let { onclose }: { onclose: () => void } = $props();

  const version = ((globalThis as any).browser?.runtime ?? (globalThis as any).chrome?.runtime)?.getManifest?.()?.version ?? "";
</script>
<SharedAbout
  {onclose}
  {version}
  openLink={(url) => window.open(url, "_blank")}
/>
