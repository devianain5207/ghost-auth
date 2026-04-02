<script lang="ts">
  import SyncDevice from "./SyncDevice.svelte";

  let { onclose, onsuccess, onscanstart, onscanend }: {
    onclose: () => void;
    onsuccess: () => void;
    onscanstart?: () => void;
    onscanend?: () => void;
  } = $props();
</script>

<SyncDevice role="join" {onclose} {onsuccess} {onscanstart} {onscanend} />
