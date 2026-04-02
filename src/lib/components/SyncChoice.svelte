<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { trapFocus } from "$lib/utils/focusTrap";
  import iconImport from "$lib/assets/icons/import.svg";
  import iconExport from "$lib/assets/icons/export.svg";

  let { onclose, onsyncto, onsyncfrom }: {
    onclose: () => void;
    onsyncto: () => void;
    onsyncfrom: () => void;
  } = $props();

  let mounted = $state(false);
  let panelVisible = $state(false);
  let choosing = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    requestAnimationFrame(() => {
      mounted = true;
      panelVisible = true;
    });
    return () => { clearTimeout(closeTimer); };
  });

  function close() {
    panelVisible = false;
    mounted = false;
    closeTimer = setTimeout(onclose, 250);
  }

  function choose(target: "to" | "from") {
    if (choosing) return;
    choosing = true;
    // Slide panel out, keep backdrop alive during transition
    panelVisible = false;
    closeTimer = setTimeout(() => {
      // Open target modal — its backdrop starts fading in
      if (target === "to") onsyncto();
      else onsyncfrom();
      // Crossfade: start fading our backdrop out while target's fades in
      mounted = false;
      // Remove from overlay stack after both transitions settle
      setTimeout(onclose, 300);
    }, 280);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop {mounted ? 'open' : ''}"
  onkeydown={(e) => e.key === "Escape" && !choosing && close()}
  onclick={() => !choosing && close()}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="bg-bg border-t border-dotted border-border sm:border w-full max-w-md p-5 max-h-[85vh] overflow-y-auto modal-panel {panelVisible ? 'open' : ''}"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="sync-choice-title"
    tabindex="-1"
    use:trapFocus
  >
    <div class="flex items-center justify-between mb-6">
      <span id="sync-choice-title" class="text-base tracking-wide text-muted">{$_('syncChoice.title')}</span>
      <button
        type="button"
        class="text-dim hover:text-fg transition-colors p-1"
        onclick={close}
        aria-label={$_('common.close')}
      >
        <svg class="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
        </svg>
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <!-- Receive: sync TO this device -->
      <button
        type="button"
        class="flex flex-col items-center gap-3 border border-dotted border-border px-4 py-5 hover:border-fg/30 transition-colors group text-center"
        disabled={choosing}
        onclick={() => choose("to")}
      >
        <img src={iconImport} alt="" class="w-8 h-8 icon-adapt opacity-50 group-hover:opacity-80 transition-opacity" />
        <span class="text-base text-fg">{$_('syncChoice.receiveTitle')}</span>
        <span class="text-xs text-dim leading-relaxed">{$_('syncChoice.receiveDesc')}</span>
      </button>

      <!-- Send: sync FROM this device -->
      <button
        type="button"
        class="flex flex-col items-center gap-3 border border-dotted border-border px-4 py-5 hover:border-fg/30 transition-colors group text-center"
        disabled={choosing}
        onclick={() => choose("from")}
      >
        <img src={iconExport} alt="" class="w-8 h-8 icon-adapt opacity-50 group-hover:opacity-80 transition-opacity" />
        <span class="text-base text-fg">{$_('syncChoice.sendTitle')}</span>
        <span class="text-xs text-dim leading-relaxed">{$_('syncChoice.sendDesc')}</span>
      </button>
    </div>
  </div>
</div>
