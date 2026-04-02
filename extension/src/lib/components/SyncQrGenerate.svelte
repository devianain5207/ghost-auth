<script lang="ts">
  import { generateQrSyncData, parseQrSyncUri } from "$core/sync-qr";
  import { storage, loadAccounts } from "$lib/stores/accounts.svelte";
  import { buildPayload, decryptAccount, merge } from "$core/sync-protocol";
  import { syncViaWebSocketAnyHost } from "$core/sync-ws-client";
  import { toast } from "$lib/stores/toast";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import type { Account, MergeResult } from "$core/types";
  import { _ } from 'svelte-i18n';
  import Modal from "./Modal.svelte";
  import QRCode from "qrcode";
  import { getTheme } from "$lib/stores/theme.svelte";

  let { onclose, onsuccess }: { onclose: () => void; onsuccess: () => void } = $props();

  let qrSvg: string = $state("");
  let syncKey: Uint8Array | null = $state(null);
  let address = $state("");
  let error = $state("");
  let loading = $state(false);
  let mergeResult: MergeResult | null = $state(null);
  let decisions: Map<string, string> = $state(new Map());

  // Hosts parsed from URI (for multi-host connect)
  let pastedHosts: string[] = [];

  $effect(() => {
    generateQr();
  });

  async function generateQr() {
    try {
      const { key, uri } = generateQrSyncData();
      syncKey = key;
      const theme = getTheme();
      qrSvg = await QRCode.toString(uri, {
        type: "svg",
        margin: 2,
        color: { dark: theme === "dark" ? "#ffffff" : "#000000", light: "#00000000" },
      });
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  async function handlePaste() {
    error = "";
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith("ghost-auth://qr-sync")) {
        const parsed = parseQrSyncUri(text);
        if (parsed.hosts && parsed.port) {
          pastedHosts = parsed.hosts;
          address = `${parsed.hosts[0]}:${parsed.port}`;
          toast($_('ext.qrSync.uriPasted'));
        } else {
          error = $_('ext.qrSync.uriMissingHost');
        }
      } else {
        error = $_('ext.qrSync.uriInvalid');
      }
    } catch {
      error = $_('ext.qrSync.clipboardFailed');
    }
  }

  async function handleConnect() {
    error = "";
    if (!address.trim()) {
      error = $_('ext.qrSync.addressRequired');
      return;
    }

    // Parse address — host:port format
    const parts = address.trim().split(":");
    if (parts.length !== 2) {
      error = $_('ext.sync.addressFormatError');
      return;
    }
    const host = parts[0];
    const port = parseInt(parts[1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      error = $_('ext.sync.invalidPort');
      return;
    }

    // Use pasted hosts if available (multi-host), otherwise manual single host
    const hosts = pastedHosts.length > 0 ? pastedHosts : [host];
    await connectToDevice(hosts, port);
  }

  async function connectToDevice(hosts: string[], wsPort: number) {
    loading = true;
    try {
      const key = syncKey!;

      // Build local payload
      const accounts = await storage.getAccounts();
      const tombstones = await storage.getTombstones();
      const deviceId = await storage.getDeviceId();
      const localPayload = await buildPayload(deviceId, accounts, tombstones, key);

      // Connect, handshake, exchange payloads (tries all hosts)
      const remotePayload = await syncViaWebSocketAnyHost(hosts, wsPort, key, localPayload);

      // Decrypt remote accounts
      const remoteAccounts: Account[] = [];
      for (const enc of remotePayload.accounts) {
        remoteAccounts.push(await decryptAccount(enc, key));
      }

      // Load sync history for this peer
      const syncHistory = await storage.getSyncHistory();
      const lastSync = syncHistory[remotePayload.device_id] ?? null;

      // Compute merge
      mergeResult = merge(
        accounts,
        tombstones,
        remoteAccounts,
        remotePayload.tombstones,
        lastSync,
      );

      // Store remote info for applying later
      (mergeResult as any)._remoteDeviceId = remotePayload.device_id;
      (mergeResult as any)._remoteTimestamp = remotePayload.timestamp;

      // Auto-confirm if no conflicts or deletions
      if (mergeResult.conflicts.length === 0 && mergeResult.remote_deletions.length === 0) {
        await applyMerge();
      }
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  async function applyMerge() {
    if (!mergeResult) return;
    loading = true;
    try {
      const accounts = await storage.getAccounts();
      const tombstones = await storage.getTombstones();
      const accountMap = new Map(accounts.map((a) => [a.id, a]));

      // Apply additions
      for (const account of mergeResult.to_add) {
        if (!accountMap.has(account.id)) {
          accounts.push(account);
          accountMap.set(account.id, account);
        }
      }

      // Apply auto-updates
      for (const updated of mergeResult.auto_updated) {
        const idx = accounts.findIndex((a) => a.id === updated.id);
        if (idx !== -1) {
          accounts[idx] = updated;
        }
      }

      // Apply conflict decisions
      for (const conflict of mergeResult.conflicts) {
        const decision = decisions.get(conflict.local.id) || "keep_local";
        if (decision === "keep_remote") {
          const idx = accounts.findIndex((a) => a.id === conflict.remote.id);
          if (idx !== -1) {
            accounts[idx] = conflict.remote;
          }
        }
      }

      // Apply remote deletions (only if user chose to delete)
      const newTombstones = [...tombstones];
      for (const del of mergeResult.remote_deletions) {
        const decision = decisions.get(del.id) || "keep_local";
        if (decision === "delete") {
          const idx = accounts.findIndex((a) => a.id === del.id);
          if (idx !== -1) {
            accounts.splice(idx, 1);
            newTombstones.push({ id: del.id, deleted_at: Math.floor(Date.now() / 1000) });
          }
        }
      }

      await storage.saveAccounts(accounts, newTombstones);

      // Record sync timestamp
      const remoteDeviceId = (mergeResult as any)._remoteDeviceId;
      const remoteTimestamp = (mergeResult as any)._remoteTimestamp;
      if (remoteDeviceId) {
        const syncHistory = await storage.getSyncHistory();
        syncHistory[remoteDeviceId] = remoteTimestamp || Math.floor(Date.now() / 1000);
        await storage.saveSyncHistory(syncHistory);
      }

      await loadAccounts();

      const parts = [];
      if (mergeResult.to_add.length > 0) parts.push($_('sync.toastAdded', { values: { count: mergeResult.to_add.length } }));
      if (mergeResult.auto_updated.length > 0) parts.push($_('sync.toastUpdated', { values: { count: mergeResult.auto_updated.length } }));
      toast($_('sync.toastSynced', { values: { summary: parts.join(", ") || $_('sync.toastNoChanges') } }));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  function setDecision(id: string, action: string) {
    decisions = new Map(decisions);
    decisions.set(id, action);
  }
</script>

<Modal onclose={onclose} title={$_('ext.qrSync.title')} titleId="qr-sync-title">
  {#snippet children({ close })}
    {#if error}
      <div class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    {#if !mergeResult}
      {#if qrSvg}
        <div class="max-w-48 mx-auto mb-4 qr-container">
          {@html qrSvg}
        </div>
      {/if}

      <p class="text-sm text-dim mb-4">{$_('ext.qrSync.instructions')}</p>

      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); handleConnect(); }}
      >
        <div>
          <label for="qr-sync-address" class="block text-sm text-dim tracking-wide mb-1.5">{$_('ext.qrSync.addressLabel')}</label>
          <input
            id="qr-sync-address"
            type="text"
            bind:value={address}
            placeholder={$_('ext.sync.addressPlaceholder')}
            class={inputClass}
          />
        </div>

        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={close}>
            {$_('common.cancel')}
          </button>
          <button type="button" class={btnSecondary} onclick={handlePaste}>
            {$_('ext.qrSync.pasteUri')}
          </button>
          <button
            type="submit"
            disabled={loading}
            class="{btnPrimary} disabled:opacity-30"
          >
            {loading ? $_('ext.sync.connecting') : $_('ext.sync.connect')}
          </button>
        </div>
      </form>
    {:else}
      <!-- Merge Preview -->
      <div class="flex flex-col gap-4">
        {#if mergeResult.to_add.length > 0}
          <div>
            <p class="text-sm text-dim tracking-wide mb-2">
              {$_('sync.newAccounts', { values: { count: mergeResult.to_add.length } })}
            </p>
            <div class="flex flex-col gap-1">
              {#each mergeResult.to_add as account}
                <div class="border border-dotted border-border px-4 py-2.5">
                  <div class="text-sm text-fg">{account.issuer}</div>
                  <div class="text-xs text-dim">{account.label}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if mergeResult.auto_updated.length > 0}
          <div>
            <p class="text-sm text-dim tracking-wide mb-2">
              {$_('sync.autoUpdated', { values: { count: mergeResult.auto_updated.length } })}
            </p>
            <div class="flex flex-col gap-1">
              {#each mergeResult.auto_updated as account}
                <div class="border border-dotted border-border px-4 py-2.5">
                  <div class="text-sm text-fg">{account.issuer}</div>
                  <div class="text-xs text-dim">{account.label}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if mergeResult.conflicts.length > 0}
          <div>
            <p class="text-sm text-dim tracking-wide mb-2">
              {$_('sync.conflicts', { values: { count: mergeResult.conflicts.length } })}
            </p>
            <div class="flex flex-col gap-2">
              {#each mergeResult.conflicts as conflict}
                <div class="border border-dotted border-border px-4 py-3">
                  <div class="flex gap-3 mb-2">
                    <div class="flex-1">
                      <div class="text-xs text-dim mb-1">{$_('sync.thisDevice')}</div>
                      <div class="text-sm text-fg">{conflict.local.issuer}</div>
                      <div class="text-xs text-dim">{conflict.local.label}</div>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs text-dim mb-1">{$_('sync.otherDevice')}</div>
                      <div class="text-sm text-fg">{conflict.remote.issuer}</div>
                      <div class="text-xs text-dim">{conflict.remote.label}</div>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(conflict.local.id) === 'keep_local' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                      onclick={() => setDecision(conflict.local.id, "keep_local")}
                    >
                      {$_('sync.keepThis')}
                    </button>
                    <button
                      type="button"
                      class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(conflict.local.id) === 'keep_remote' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                      onclick={() => setDecision(conflict.local.id, "keep_remote")}
                    >
                      {$_('sync.keepOther')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if mergeResult.remote_deletions.length > 0}
          <div>
            <p class="text-sm text-dim tracking-wide mb-2">
              {$_('sync.deletedOnOther', { values: { count: mergeResult.remote_deletions.length } })}
            </p>
            <div class="flex flex-col gap-2">
              {#each mergeResult.remote_deletions as account}
                <div class="border border-dotted border-border px-4 py-3">
                  <div class="text-sm text-fg mb-2">
                    {account.issuer}
                    <span class="text-dim">/ {account.label}</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(account.id) !== 'delete' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                      onclick={() => setDecision(account.id, "keep_local")}
                    >
                      {$_('sync.keep')}
                    </button>
                    <button
                      type="button"
                      class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(account.id) === 'delete' ? 'border-error/80 text-error' : 'border-dotted border-border text-dim hover:text-error'}"
                      onclick={() => setDecision(account.id, "delete")}
                    >
                      {$_('common.delete')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if mergeResult.unchanged > 0}
          <p class="text-sm text-dim">
            {$_('sync.unchanged', { values: { count: mergeResult.unchanged } })}
          </p>
        {/if}

        <div class="flex gap-2 mt-2">
          <button type="button" class={btnSecondary} onclick={close}>
            {$_('common.cancel')}
          </button>
          <button
            type="button"
            disabled={loading}
            class="{btnPrimary} disabled:opacity-30"
            onclick={applyMerge}
          >
            {loading ? $_('common.loading') : $_('sync.applySync')}
          </button>
        </div>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .qr-container :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
