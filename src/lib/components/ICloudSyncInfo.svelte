<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();
</script>

<Modal onclose={onclose} title={$_('icloudSync.title')} titleId="icloud-sync-info-title">
  {#snippet children(_ctx)}
    <!-- Description -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-sm text-muted leading-relaxed">{$_('icloudSync.description')}</p>
    </div>

    <!-- How it works -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('icloudSync.howItWorks')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('icloudSync.howItWorksDesc')}</p>
    </div>

    <!-- What iCloud sees -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('icloudSync.whatIcloudSees')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('icloudSync.whatIcloudSeesDesc')}</p>
    </div>

    <!-- Trade-off -->
    <div class="border border-dotted border-border px-4 py-3">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('icloudSync.tradeoff')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('icloudSync.tradeoffDesc')}</p>
    </div>
  {/snippet}
</Modal>
