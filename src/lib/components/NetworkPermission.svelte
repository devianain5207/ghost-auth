<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { invoke } from '@tauri-apps/api/core';
  import { openAppSettings } from '@tauri-apps/plugin-barcode-scanner';
  import Modal from './Modal.svelte';

  let { onclose, ongranted }: {
    onclose: () => void;
    ongranted: () => void;
  } = $props();

  let phase: "ask" | "probing" | "denied" | "no_network" = $state("ask");

  async function handleGrant() {
    phase = "probing";

    // On iOS the first probe triggers the Local Network permission dialog.
    // The dialog may cause this call to fail while it is on-screen.  We poll
    // until the user responds (grant → Ok, deny → keeps failing).
    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await invoke<string>("probe_local_network");
        localStorage.setItem("ghost-auth-lan-permission", "granted");
        ongranted();
        return;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("no_network")) {
          phase = "no_network";
          return;
        }
        // Permission denied or dialog still pending — wait and retry.
        if (i < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    phase = "denied";
  }

  async function handleOpenSettings() {
    try { await openAppSettings(); } catch { /* silent */ }
  }

  const btnPrimary = "w-full border border-fg/80 text-fg text-sm py-3 hover:bg-fg hover:text-bg transition-colors disabled:opacity-30";
  const btnSecondary = "w-full border border-dotted border-border text-dim text-sm py-3 hover:text-fg hover:border-fg/30 transition-colors";
</script>

<Modal onclose={onclose} title={$_('networkPermission.title')} titleId="network-permission-title">
  {#snippet children({ close })}
    {#if phase === "ask" || phase === "probing"}
      <div class="flex flex-col items-center text-center mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-fg/40 mb-5">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
        <p class="text-sm text-dim leading-relaxed max-w-xs">
          {$_('networkPermission.description')}
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <button type="button" class={btnPrimary} disabled={phase === "probing"} onclick={handleGrant}>
          {$_('networkPermission.grantAccess')}
        </button>
        <button type="button" class={btnSecondary} disabled={phase === "probing"} onclick={close}>
          {$_('common.cancel')}
        </button>
      </div>

    {:else if phase === "denied"}
      <div class="flex flex-col items-center text-center mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-fg/40 mb-5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 class="text-base tracking-wider text-fg/80 mb-2">{$_('networkPermission.permissionRequired')}</h2>
        <p class="text-sm text-dim leading-relaxed max-w-xs">
          {$_('networkPermission.deniedDesc')}
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <button type="button" class={btnPrimary} onclick={handleOpenSettings}>
          {$_('networkPermission.openSettings')}
        </button>
        <button type="button" class={btnSecondary} onclick={() => { phase = "ask"; }}>
          {$_('networkPermission.tryAgain')}
        </button>
        <button type="button" class={btnSecondary} onclick={close}>
          {$_('common.cancel')}
        </button>
      </div>

    {:else if phase === "no_network"}
      <div class="flex flex-col items-center text-center mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 text-fg/40 mb-5">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" opacity="0.3" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" opacity="0.3" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity="0.3" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
        <h2 class="text-base tracking-wider text-fg/80 mb-2">{$_('networkPermission.noNetworkTitle')}</h2>
        <p class="text-sm text-dim leading-relaxed max-w-xs">
          {$_('networkPermission.noNetworkDesc')}
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <button type="button" class={btnSecondary} onclick={close}>
          {$_('common.close')}
        </button>
      </div>
    {/if}
  {/snippet}
</Modal>
