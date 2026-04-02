<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    syncPoll,
    syncConfirm,
    syncCancel,
    type SyncSessionInfo,
    type MergePreview,
  } from "$lib/stores/accounts";
  import { invoke } from "@tauri-apps/api/core";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import { toast } from "$lib/stores/toast";
  import { getErrorMessage } from "$lib/utils/error";
  import { Scanner } from "$lib/utils/scanner.svelte";
  import ScanOverlay from "./ScanOverlay.svelte";
  import SyncMergePreview from "./SyncMergePreview.svelte";
  import Modal from "./Modal.svelte";
  import iconQr from "$lib/assets/icons/qr.svg";

  let { onclose, onsuccess, onscanstart, onscanend }: {
    onclose: () => void;
    onsuccess: () => void;
    onscanstart?: () => void;
    onscanend?: () => void;
  } = $props();

  let phase: "scan" | "waiting" | "syncing" | "done" | "error" = $state("scan");
  let sessionInfo: SyncSessionInfo | null = $state(null);
  let mergePreview: MergePreview | null = $state(null);
  let error = $state("");
  let permissionDenied = $state(false);

  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pollErrorCount = 0;
  const MAX_POLL_ERRORS = 3;

  function base64UrlToBytes(b64url: string): number[] {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64.length % 4)) % 4;
    const binary = atob(b64 + '='.repeat(pad));
    return [...binary].map(c => c.charCodeAt(0));
  }

  const scanner = new Scanner({
    onContent: async (content) => {
      if (!content.startsWith("ghost-auth://qr-sync")) {
        error = $_('syncToExtension.invalidQr');
        return;
      }
      try {
        const url = new URL(content);
        const keyParam = url.searchParams.get("key");
        if (!keyParam) {
          error = $_('syncToExtension.invalidQr');
          return;
        }
        const keyBytes = base64UrlToBytes(keyParam);
        phase = "waiting";
        error = "";

        sessionInfo = await invoke<SyncSessionInfo>("sync_start_with_key", {
          key: Array.from(keyBytes),
        });

        try {
          await writeText(sessionInfo.qr_data);
          toast($_('syncToExtension.addressCopied'));
        } catch {
          toast($_('accountCard.copyFailed'));
        }

        startPolling();
      } catch (e) {
        error = getErrorMessage(e, $_);
        phase = "error";
      }
    },
    setError: (msg) => { error = msg; },
    setPermissionDenied: (v) => { permissionDenied = v; },
    t: (key) => $_(key),
    onscanstart: () => onscanstart?.(),
    onscanend: () => onscanend?.(),
  });

  function startPolling() {
    pollInterval = setInterval(async () => {
      try {
        const result = await syncPoll();
        if (result.status === "merge_ready" && result.merge_preview) {
          mergePreview = result.merge_preview;
          stopPolling();
          if (
            mergePreview.conflicts.length === 0 &&
            mergePreview.to_delete.length === 0
          ) {
            await handleAutoConfirm();
          }
        } else if (result.status === "exchanging") {
          phase = "syncing";
        } else if (result.status === "error") {
          error = result.error || $_('syncToExtension.syncFailed');
          phase = "error";
          stopPolling();
        }
      } catch (e) {
        pollErrorCount++;
        if (pollErrorCount >= MAX_POLL_ERRORS) {
          error = getErrorMessage(e, $_);
          phase = "error";
          stopPolling();
        }
      }
    }, 500);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function handleAutoConfirm() {
    phase = "syncing";
    try {
      const result = await syncConfirm([]);
      const parts = [];
      if (result.added > 0) parts.push($_('sync.toastAdded', { values: { count: result.added } }));
      if (result.updated > 0) parts.push($_('sync.toastUpdated', { values: { count: result.updated } }));
      toast($_('sync.toastSynced', { values: { summary: parts.join(", ") || $_('sync.toastNoChanges') } }));
      phase = "done";
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
      phase = "error";
    }
  }

  function wrappedClose() {
    stopPolling();
    syncCancel().catch(() => {});
    onclose();
  }

  async function copyText(text: string) {
    try {
      await writeText(text);
      toast($_('syncInitiate.copied'));
    } catch {
      toast($_('accountCard.copyFailed'));
    }
  }
</script>

<Modal onclose={wrappedClose} title={$_('syncToExtension.title')} titleId="sync-from-qr-title">
  {#snippet children({ close })}
    {#if error}
      {#if permissionDenied}
        <button
          type="button"
          class="w-full text-start border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm hover:border-error/50 transition-colors"
          onclick={() => scanner.handleOpenSettings()}
        >
          <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
        </button>
      {:else}
        <div
          role="alert"
          class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm"
        >
          <span class="text-error/60">{$_('common.errorPrefix')}</span>
          {error}
        </div>
      {/if}
    {/if}

    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {#if phase === "waiting"}
        {$_('syncToExtension.waiting')}
      {:else if phase === "syncing"}
        {$_('syncToExtension.syncing')}
      {/if}
    </div>

    {#if phase === "scan"}
      <div class="flex flex-col gap-4">
        <p class="text-sm text-dim">{$_('syncToExtension.instructions')}</p>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={scanner.scanning}
          onclick={() => scanner.scanQr()}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {scanner.scanning ? $_('syncToExtension.scanning') : $_('scanner.scanQrCode')}
          </div>
        </button>
      </div>

      <div class="mt-6">
        <button
          type="button"
          class="w-full border border-dotted border-border text-dim text-sm py-2.5 hover:text-fg hover:border-fg/30 transition-colors"
          onclick={close}
        >
          {$_('common.cancel')}
        </button>
      </div>
    {:else if phase === "waiting" && sessionInfo}
      <div class="flex flex-col items-center gap-4">
        {#if sessionInfo.all_hosts.length > 0}
          <div class="w-full border border-dotted border-border px-4 py-3">
            <div class="text-sm text-dim tracking-wide mb-2">
              {$_('syncInitiate.connection')}
            </div>
            {#each sessionInfo.all_hosts as ip}
              <button
                type="button"
                class="w-full text-center hover:bg-fg/5 transition-colors py-1.5"
                onclick={() => copyText(`${ip}:${sessionInfo!.port}`)}
              >
                <div class="text-base text-muted font-mono">
                  {ip}:{sessionInfo.port}
                </div>
              </button>
            {/each}
            <div class="text-xs text-dim mt-2 text-center">{$_('syncInitiate.tapAddressToCopy')}</div>
          </div>
        {/if}

        <div class="flex items-center gap-2 text-dim text-sm">
          <span
            class="inline-block w-2 h-2 rounded-full bg-accent/60 animate-pulse"
          ></span>
          {$_('syncToExtension.waiting')}
        </div>
      </div>

      <div class="mt-6">
        <button
          type="button"
          class="w-full border border-dotted border-border text-dim text-sm py-2.5 hover:text-fg hover:border-fg/30 transition-colors"
          onclick={close}
        >
          {$_('common.cancel')}
        </button>
      </div>
    {:else if phase === "syncing"}
      <div class="text-center py-8">
        <div class="flex items-center justify-center gap-2 text-muted text-sm">
          <span
            class="inline-block w-2 h-2 rounded-full bg-accent animate-pulse"
          ></span>
          {$_('syncToExtension.syncing')}
        </div>
      </div>
    {:else if mergePreview}
      <SyncMergePreview {mergePreview} oncancel={close} {onsuccess} />
    {/if}
  {/snippet}
</Modal>

<ScanOverlay {scanner} showImagePicker={false} />
