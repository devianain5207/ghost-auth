<script lang="ts">
  import SharedPinSetup from "$shared/components/PinSetup.svelte";
  import { setPin } from "$lib/stores/accounts";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";

  let { onclose, ondone }: { onclose: () => void; ondone: () => void } = $props();
</script>
<SharedPinSetup
  {onclose}
  {ondone}
  {setPin}
  copyToClipboard={(text) => writeText(text)}
/>
