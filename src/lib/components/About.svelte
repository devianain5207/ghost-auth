<script lang="ts">
  import SharedAbout from "$shared/components/About.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { getVersion } from "@tauri-apps/api/app";

  let { onclose }: { onclose: () => void } = $props();

  let version = $state("");

  $effect(() => {
    getVersion().then((v) => { version = v; }).catch(() => {});
  });
</script>
<SharedAbout
  {onclose}
  {version}
  openLink={(url) => { openUrl(url).catch(() => {}); }}
/>
