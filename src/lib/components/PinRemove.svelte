<script lang="ts">
  import SharedPinRemove from "$shared/components/PinRemove.svelte";
  import { removePin } from "$lib/stores/accounts";

  let { onclose, ondone }: { onclose: () => void; ondone: () => void } = $props();
</script>
<SharedPinRemove
  {onclose}
  {ondone}
  {removePin}
/>
