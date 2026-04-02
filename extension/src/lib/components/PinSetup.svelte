<script lang="ts">
  import SharedPinSetup from "$shared/components/PinSetup.svelte";
  import { setPin } from "$core/pin";

  let {
    onclose,
    ondone,
    onwrapdek,
  }: {
    onclose: () => void;
    ondone: () => void;
    onwrapdek?: (pin: string) => Promise<void>;
  } = $props();
</script>
<SharedPinSetup
  {onclose}
  {ondone}
  {setPin}
  {onwrapdek}
  copyToClipboard={(text) => navigator.clipboard.writeText(text)}
  compact
/>
