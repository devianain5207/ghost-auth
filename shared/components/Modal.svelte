<script lang="ts">
  import type { Snippet } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { trapFocus } from "$shared/utils/focusTrap";

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

  let mounted = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    requestAnimationFrame(() => { mounted = true; });
    return () => { clearTimeout(closeTimer); };
  });

  function close() {
    mounted = false;
    closeTimer = setTimeout(onclose, 250);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop {mounted ? 'open' : ''}"
  onkeydown={(e) => e.key === "Escape" && close()}
  onclick={close}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="bg-bg border-t border-dotted border-border sm:border w-full max-w-md p-5 max-h-[85vh] overflow-y-auto modal-panel {mounted ? 'open' : ''}"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    use:trapFocus
  >
    <div class="flex items-center justify-between mb-6">
      <span id={titleId} class="text-base tracking-wide text-muted">{title}</span>
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

    {@render children({ close })}
  </div>
</div>
