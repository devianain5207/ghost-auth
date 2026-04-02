<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();
</script>

<Modal onclose={onclose} title={$_('crashReportingInfo.title')} titleId="crash-info-title">
  {#snippet children(_ctx)}
    <!-- Why -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.whyTitle')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('crashReportingInfo.whyDesc')}</p>
    </div>

    <!-- Included -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.includedTitle')}</p>
      <ul class="text-sm text-muted leading-relaxed space-y-1">
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.included1')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.included2')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.included3')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.included4')}</li>
      </ul>
    </div>

    <!-- Never included -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.neverIncludedTitle')}</p>
      <ul class="text-sm text-muted leading-relaxed space-y-1">
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded1')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded2')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded3')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded4')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded5')}</li>
        <li class="flex items-start gap-2"><span class="text-dim/50 mt-0.5">-</span>{$_('crashReportingInfo.neverIncluded6')}</li>
      </ul>
    </div>

    <!-- Destination -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.destinationTitle')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('crashReportingInfo.destinationDesc')}</p>
    </div>

    <!-- Retention -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.retentionTitle')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('crashReportingInfo.retentionDesc')}</p>
    </div>

    <!-- How to disable -->
    <div class="border border-dotted border-border px-4 py-3">
      <p class="text-xs text-dim tracking-wide mb-2">{$_('crashReportingInfo.disableTitle')}</p>
      <p class="text-sm text-muted leading-relaxed">{$_('crashReportingInfo.disableDesc')}</p>
    </div>
  {/snippet}
</Modal>
