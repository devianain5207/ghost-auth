<script lang="ts">
  import SharedRecoveryCodes from "$shared/components/RecoveryCodes.svelte";

  let { codes, ondone }: { codes: string[]; ondone: () => void } = $props();
</script>
<SharedRecoveryCodes
  {codes}
  {ondone}
  copyToClipboard={(text) => navigator.clipboard.writeText(text)}
/>
