<script lang="ts">
  import SharedPinRemove from "$shared/components/PinRemove.svelte";
  import { removePin } from "$core/pin";
  import { storage } from "$lib/stores/accounts.svelte";

  let { onclose, ondone }: { onclose: () => void; ondone: () => void } = $props();

  async function handleRemovePin(pin: string) {
    await removePin(pin);
    await storage.clearPinWrappedDek();
  }
</script>
<SharedPinRemove
  {onclose}
  {ondone}
  removePin={handleRemovePin}
/>
