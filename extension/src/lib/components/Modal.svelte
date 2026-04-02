<script lang="ts">
  import type { Snippet } from 'svelte';
  import Modal from "$shared/components/Modal.svelte";

  let {
    onclose,
    title,
    titleId,
    children,
  }: {
    onclose: () => void;
    title: string;
    titleId: string;
    children: Snippet<[{ close: () => void }]>;
  } = $props();
</script>
<Modal {onclose} {title} {titleId} {children} />
