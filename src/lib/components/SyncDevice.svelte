<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    syncStart,
    syncPoll,
    syncJoin,
    syncConfirm,
    syncCancel,
    type SyncSessionInfo,
    type MergePreview,
  } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import { Scanner } from "$lib/utils/scanner.svelte";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import QRCode from "qrcode";
  import ghostLogo from "$lib/assets/ghost.svg";
  import { getTheme } from "$lib/stores/theme.svelte";
  import ScanOverlay from "./ScanOverlay.svelte";
  import Modal from "./Modal.svelte";
  import SyncMergePreview from "./SyncMergePreview.svelte";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconManualEntry from "$lib/assets/icons/manual-entry.svg";

  let { role, onclose, onsuccess, onscanstart, onscanend }: {
    role: "initiate" | "join";
    onclose: () => void;
    onsuccess: () => void;
    onscanstart?: () => void;
    onscanend?: () => void;
  } = $props();

  // --- Shared state ---
  let mode: "choose" | "generate" | "manual" = $state("choose");
  let rawCode = $state("");
  let address = $state("");
  let error = $state("");
  let loading = $state(false);
  let permissionDenied = $state(false);
  let mergePreview: MergePreview | null = $state(null);
  let scannedCandidate: { code: string; hosts: string[]; port: number } | null = $state(null);
  let allowPublicHost = $state(false);
  let scrollLeft = $state(0);

  // --- Code formatting ---
  const CODE_SEGMENTS = 6;
  const SEGMENT_LEN = 4;
  const TOTAL_CHARS = CODE_SEGMENTS * SEGMENT_LEN;

  let code = $derived(formatCodeWithDashes(rawCode));

  function formatCodeWithDashes(raw: string): string {
    const clean = raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, TOTAL_CHARS);
    const segments: string[] = [];
    for (let i = 0; i < clean.length; i += SEGMENT_LEN) {
      segments.push(clean.slice(i, i + SEGMENT_LEN));
    }
    return segments.join("-");
  }

  function handleCodeInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const raw = input.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, TOTAL_CHARS);
    rawCode = raw;
    requestAnimationFrame(() => {
      const formatted = formatCodeWithDashes(raw);
      input.value = formatted;
      const charCount = raw.length;
      const dashCount = charCount > 0 ? Math.floor((charCount - 1) / SEGMENT_LEN) : 0;
      const pos = charCount + dashCount;
      input.setSelectionRange(pos, pos);
      scrollLeft = input.scrollLeft;
    });
  }

  let codeDisplay = $derived.by(() => {
    const clean = rawCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, TOTAL_CHARS).toUpperCase();
    const segments: Array<{ typed: string; placeholder: string }> = [];
    for (let i = 0; i < CODE_SEGMENTS; i++) {
      const start = i * SEGMENT_LEN;
      const chunk = clean.slice(start, start + SEGMENT_LEN);
      segments.push({
        typed: chunk,
        placeholder: "X".repeat(SEGMENT_LEN - chunk.length),
      });
    }
    return segments;
  });

  // --- Scanner ---
  const scanner = new Scanner({
    onContent: async (content) => {
      if (!content.startsWith("ghost-auth://sync")) {
        error = $_('syncJoin.invalidSyncQr');
        return;
      }
      const url = new URL(content);
      const scannedCode = url.searchParams.get("code");
      const scannedPort = url.searchParams.get("port");
      const hostsParam = url.searchParams.get("hosts");
      const hostParam = url.searchParams.get("host");
      const scannedHosts = hostsParam
        ? hostsParam.split(",").filter(Boolean)
        : hostParam ? [hostParam] : [];
      if (!scannedCode || scannedHosts.length === 0 || !scannedPort) {
        error = $_('syncJoin.missingSyncData');
        return;
      }
      const port = parseInt(scannedPort, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        error = $_('syncJoin.badPort');
        return;
      }
      setScannedCandidate(scannedCode, scannedHosts, port);
    },
    setError: (msg) => { error = msg; },
    setPermissionDenied: (v) => { permissionDenied = v; },
    t: (key) => $_(key),
    onscanstart: () => onscanstart?.(),
    onscanend: () => onscanend?.(),
  });

  // --- Generate QR mode ---
  let session: SyncSessionInfo | null = $state(null);
  let genStatus: "idle" | "starting" | "waiting" | "exchanging" = $state("idle");
  let qrSvg = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pollErrorCount = 0;
  const MAX_POLL_ERRORS = 3;

  async function startGenerate() {
    try {
      pollErrorCount = 0;
      genStatus = "starting";
      session = await syncStart();
      qrSvg = await QRCode.toString(session.qr_data, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 1,
        color: { dark: getTheme() === "dark" ? "#ffffff" : "#1a1a1a", light: "#00000000" },
      });
      genStatus = "waiting";
      startPolling();
    } catch (e) {
      error = getErrorMessage(e, $_);
      genStatus = "idle";
    }
  }

  // --- Polling ---
  function startPolling() {
    stopPolling();
    pollErrorCount = 0;
    pollInterval = setInterval(async () => {
      try {
        const result = await syncPoll();
        if (mode === "generate") {
          genStatus = result.status as typeof genStatus;
        }
        if (result.status === "merge_ready" && result.merge_preview) {
          mergePreview = result.merge_preview;
          stopPolling();
          loading = false;
          if (mergePreview.conflicts.length === 0 && mergePreview.to_delete.length === 0) {
            await handleAutoConfirm();
          }
        } else if (result.status === "error") {
          error = result.error || $_('syncInitiate.syncFailed');
          stopPolling();
          loading = false;
          syncCancel().catch(() => {});
        }
      } catch (e) {
        pollErrorCount++;
        if (pollErrorCount >= MAX_POLL_ERRORS) {
          error = getErrorMessage(e, $_);
          stopPolling();
          loading = false;
          syncCancel().catch(() => {});
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

  function resetGenerate() {
    stopPolling();
    syncCancel().catch(() => {});
    session = null;
    qrSvg = "";
    genStatus = "idle";
    pollErrorCount = 0;
    error = "";
    mode = "choose";
  }

  // --- Scanned candidate ---
  function setScannedCandidate(syncCode: string, hosts: string[], port: number) {
    scannedCandidate = { code: syncCode, hosts, port };
    rawCode = syncCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, TOTAL_CHARS);
    address = `${hosts[0]}:${port}`;
    allowPublicHost = false;
  }

  function clearScannedCandidate() {
    scannedCandidate = null;
    allowPublicHost = false;
  }

  async function handleScannedConnect() {
    if (!scannedCandidate) return;
    await connectToDeviceMulti(
      scannedCandidate.code,
      scannedCandidate.hosts,
      scannedCandidate.port,
      allowPublicHost,
    );
  }

  // --- Connect ---
  async function connectToDeviceMulti(
    syncCode: string,
    hosts: string[],
    port: number,
    publicHost = false,
  ) {
    loading = true;
    error = "";
    try {
      await syncJoin(syncCode, hosts, port, publicHost);
      startPolling();
    } catch (e) {
      error = getErrorMessage(e, $_);
      loading = false;
    }
  }

  async function handleConnect() {
    error = "";
    if (!rawCode.trim()) {
      error = $_('syncJoin.syncCodeRequired');
      return;
    }
    if (!address.trim()) {
      error = $_('syncJoin.addressRequired');
      return;
    }
    const parts = address.trim().split(":");
    if (parts.length !== 2) {
      error = $_('syncJoin.addressFormat');
      return;
    }
    const host = parts[0];
    const port = parseInt(parts[1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      error = $_('syncJoin.invalidPort');
      return;
    }
    await connectToDeviceMulti(code.trim(), [host], port, allowPublicHost);
  }

  // --- Confirm ---
  async function handleAutoConfirm() {
    loading = true;
    try {
      const result = await syncConfirm([]);
      const parts = [];
      if (result.added > 0) parts.push($_('sync.toastAdded', { values: { count: result.added } }));
      if (result.updated > 0) parts.push($_('sync.toastUpdated', { values: { count: result.updated } }));
      toast($_('sync.toastSynced', { values: { summary: parts.join(", ") || $_('sync.toastNoChanges') } }));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  // --- Helpers ---
  async function copyText(text: string) {
    try {
      await writeText(text);
      toast($_('syncInitiate.copied'));
    } catch {
      toast($_('accountCard.copyFailed'));
    }
  }

  function wrappedClose() {
    stopPolling();
    syncCancel().catch(() => {});
    onclose();
  }

  let title = $derived($_(role === "initiate" ? 'syncInitiate.title' : 'syncJoin.title'));
  let titleId = $derived(role === "initiate" ? "sync-initiate-title" : "sync-join-title");
  let ns = $derived(role === "initiate" ? "syncInitiate" : "syncJoin");
</script>

<Modal onclose={wrappedClose} {title} {titleId}>
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
      {#if loading}
        {$_('syncJoin.connecting')}
      {:else if genStatus === "starting"}
        {$_('syncInitiate.starting')}
      {:else if genStatus === "waiting"}
        {$_('syncInitiate.waiting')}
      {:else if genStatus === "exchanging"}
        {$_('syncInitiate.syncing')}
      {/if}
    </div>

    {#if mergePreview}
      <SyncMergePreview {mergePreview} oncancel={close} {onsuccess} />

    {:else if mode === "choose"}
      <div class="flex flex-col gap-2">
        {#if scannedCandidate}
          <div class="border border-dotted border-border px-4 py-3 mb-1">
            <div class="text-sm text-fg mb-1">{$_('syncJoin.scannedReady')}</div>
            <div class="text-xs text-dim break-words">
              {scannedCandidate.hosts.join(", ")}:{scannedCandidate.port}
            </div>
            <label class="flex items-start gap-2 mt-3 text-xs text-dim cursor-pointer">
              <input type="checkbox" bind:checked={allowPublicHost} class="mt-0.5" />
              <span>{$_('syncJoin.allowPublicHost')}</span>
            </label>
            <div class="flex gap-2 mt-3">
              <button type="button" class={btnSecondary} onclick={() => { if (loading) { stopPolling(); syncCancel().catch(() => {}); loading = false; } clearScannedCandidate(); }}>
                {loading ? $_('common.cancel') : $_('common.back')}
              </button>
              <button
                type="button"
                disabled={loading}
                class="{btnPrimary} disabled:opacity-30"
                onclick={handleScannedConnect}
              >
                {loading ? $_('syncJoin.connecting') : $_('syncJoin.connect')}
              </button>
            </div>
          </div>
        {/if}
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={loading || scanner.scanning}
          onclick={() => scanner.scanQr()}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {scanner.scanning ? $_('scanner.scanning') : $_('scanner.scanQrCode')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_(`${ns}.scanQrDesc`)}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={loading}
          onclick={() => { mode = "generate"; startGenerate(); }}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_(`${ns}.generateQr`)}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_(`${ns}.generateQrDesc`)}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={loading}
          onclick={() => (mode = "manual")}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconManualEntry} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_(`${ns}.enterManually`)}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_(`${ns}.enterManuallyDesc`)}</div>
        </button>
      </div>

    {:else if mode === "generate"}
      {#if genStatus === "starting"}
        <div class="text-center py-8">
          <p class="text-dim text-sm">{$_('syncInitiate.starting')}</p>
        </div>
      {:else if genStatus === "waiting" && session}
        <div class="flex flex-col items-center gap-4">
          {#if qrSvg}
            <div class="relative w-52 h-52">
              <div class="w-full h-full qr-container">
                {@html qrSvg}
              </div>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-11 h-11 bg-bg rounded-sm flex items-center justify-center p-1.5">
                  <img src={ghostLogo} alt="" class="w-full h-full icon-adapt opacity-60" />
                </div>
              </div>
            </div>
          {/if}

          <p class="text-sm text-dim">{$_('syncInitiate.manualCodeHint')}</p>

          <button
            type="button"
            class="w-full text-center border border-dotted border-border px-4 py-6 hover:border-fg/30 transition-colors"
            onclick={() => copyText(session!.text_code)}
          >
            <div class="text-xl tracking-[0.3em] text-fg font-mono leading-relaxed">
              {session.text_code}
            </div>
            <div class="text-xs text-dim mt-2">{$_('syncInitiate.tapToCopy')}</div>
          </button>

          {#if session.all_hosts.length > 0}
            <div class="w-full border border-dotted border-border px-4 py-3">
              <div class="text-sm text-dim tracking-wide mb-2">
                {$_('syncInitiate.connection')}
              </div>
              {#each session.all_hosts as ip}
                <button
                  type="button"
                  class="w-full text-center hover:bg-fg/5 transition-colors py-1.5"
                  onclick={() => copyText(`${ip}:${session!.port}`)}
                >
                  <div class="text-base text-muted font-mono">
                    {ip}:{session.port}
                  </div>
                </button>
              {/each}
              <div class="text-xs text-dim mt-2 text-center">{$_('syncInitiate.tapAddressToCopy')}</div>
            </div>
          {/if}

          <div class="flex items-center gap-2 text-dim text-sm">
            <span class="inline-block w-2 h-2 rounded-full bg-accent/60 animate-pulse"></span>
            {$_('syncInitiate.waiting')}
          </div>
        </div>

        <div class="mt-6">
          <button
            type="button"
            class="w-full border border-dotted border-border text-dim text-sm py-2.5 hover:text-fg hover:border-fg/30 transition-colors"
            onclick={resetGenerate}
          >
            {$_('common.back')}
          </button>
        </div>
      {:else if genStatus === "exchanging"}
        <div class="text-center py-8">
          <div class="flex items-center justify-center gap-2 text-muted text-sm">
            <span class="inline-block w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            {$_('syncInitiate.syncing')}
          </div>
        </div>
      {/if}

    {:else if mode === "manual"}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          handleConnect();
        }}
      >
        <div>
          <label
            for="sync-code-{role}"
            class="block text-sm text-dim tracking-wide mb-1.5"
            >{$_('syncJoin.syncCodeLabel')}</label
          >
          <div class="relative overflow-hidden">
            <input
              id="sync-code-{role}"
              type="text"
              value={code}
              oninput={handleCodeInput}
              onscroll={(e) => { scrollLeft = (e.target as HTMLInputElement).scrollLeft; }}
              maxlength={29}
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              class="{inputClass} uppercase tracking-[0.18em] font-mono !text-transparent !caret-fg"
            />
            <div
              class="absolute inset-0 pointer-events-none flex items-center px-3 tracking-[0.18em] font-mono text-base"
              aria-hidden="true"
            >
              <span class="flex items-center" style="transform: translateX(-{scrollLeft}px)">
                {#each codeDisplay as seg, i}
                  {#if i > 0}<span class="text-dim/30">-</span>{/if}
                  <span class="text-fg uppercase">{seg.typed}</span>
                  <span class="text-dim/30">{seg.placeholder}</span>
                {/each}
              </span>
            </div>
          </div>
        </div>
        <div>
          <label
            for="sync-address-{role}"
            class="block text-sm text-dim tracking-wide mb-1.5"
            >{$_('syncJoin.addressLabel')}</label
          >
          <input
            id="sync-address-{role}"
            type="text"
            bind:value={address}
            placeholder={$_('syncJoin.addressPlaceholder')}
            class={inputClass}
          />
        </div>
        <label class="flex items-start gap-2 text-xs text-dim cursor-pointer border border-dotted border-border px-3 py-2">
          <input type="checkbox" bind:checked={allowPublicHost} class="mt-0.5" />
          <span>
            {$_('syncJoin.allowPublicHostFull')}
          </span>
        </label>

        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={() => { if (loading) { stopPolling(); syncCancel().catch(() => {}); loading = false; } mode = "choose"; clearScannedCandidate(); error = ""; }}>
            {loading ? $_('common.cancel') : $_('common.back')}
          </button>
          <button
            type="submit"
            disabled={loading}
            class="{btnPrimary} disabled:opacity-30"
          >
            {loading ? $_('syncJoin.connecting') : $_('syncJoin.connect')}
          </button>
        </div>
      </form>
    {/if}
  {/snippet}
</Modal>

<ScanOverlay {scanner} showImagePicker={false} />

<style>
  .qr-container :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
