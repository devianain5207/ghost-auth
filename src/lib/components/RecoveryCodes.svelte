<script lang="ts">
  import SharedRecoveryCodes from "$shared/components/RecoveryCodes.svelte";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";

  let { codes, ondone }: { codes: string[]; ondone: () => void } = $props();
</script>
<SharedRecoveryCodes
  {codes}
  {ondone}
  copyToClipboard={(text) => writeText(text)}
/>
