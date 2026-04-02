<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { importExternalPreview, importExternalConfirm, type ImportPreview } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import { btnPrimary, btnSecondary } from "$lib/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import { Scanner } from "$lib/utils/scanner.svelte";
  import Modal from "./Modal.svelte";
  import ScanOverlay from "./ScanOverlay.svelte";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconImportFile from "$lib/assets/icons/import-file.svg";

  let { onclose, onsuccess, onback, initialData, onscanstart, onscanend }: {
    onclose: () => void;
    onsuccess: () => void;
    onback?: () => void;
    initialData?: number[];
    onscanstart?: () => void;
    onscanend?: () => void;
  } = $props();

  type ImportSource = "file" | "scan";
  // svelte-ignore state_referenced_locally — intentional: capture initial prop value at mount
  let mode: "choose" | "file" = $state(initialData ? "file" : "choose");
  let importSource: ImportSource = $state("file");
  // svelte-ignore state_referenced_locally
  let fileData: number[] | null = $state(initialData ?? null);
  let fileName = $state("");
  let error = $state("");
  let loading = $state(false);
  let permissionDenied = $state(false);
  let preview: ImportPreview | null = $state(null);

  const scanner = new Scanner({
    onContent: handleScannedContent,
    setError: (msg) => { error = msg; },
    setPermissionDenied: (v) => { permissionDenied = v; },
    t: (key) => $_(key),
    onscanstart: () => onscanstart?.(),
    onscanend: () => onscanend?.(),
  });

  // Auto-preview when opened with pre-loaded data (e.g. from QR scan)
  $effect(() => {
    if (initialData && !preview && !loading && !error) {
      importSource = "scan";
      handlePreview();
    }
  });

  async function handleScannedContent(content: string) {
    if (!content.startsWith("otpauth-migration://") && !content.startsWith("otpauth://")) {
      error = $_('importExternal.invalidQr');
      return;
    }

    importSource = "scan";
    fileData = Array.from(new TextEncoder().encode(content));
    mode = "file";
    await handlePreview();
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importSource = "file";
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      fileData = Array.from(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(file);
  }

  async function handlePreview() {
    if (!fileData) return;
    error = "";
    loading = true;
    try {
      preview = await importExternalPreview(fileData);
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!fileData) return;
    loading = true;
    error = "";
    try {
      const added = await importExternalConfirm(fileData);
      if (importSource === "scan") {
        toast($_('backupImport.imported', { values: { count: added.length } }));
      } else {
        toast($_('importExternal.imported', { values: { count: added.length, format: preview?.format ?? 'file' } }));
      }
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

</script>

<Modal onclose={onclose} title={$_('importExternal.title')} titleId="import-external-title">
  {#snippet children()}
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
        <div role="alert" class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
          <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
        </div>
      {/if}
    {/if}

    {#if !preview && mode === "choose"}
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={scanner.scanning || scanner.imageProcessing}
          onclick={() => scanner.scanQr()}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {scanner.scanning ? $_('scanner.scanning') : $_('scanner.scanQrCode')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('importExternal.scanQrDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => { importSource = "file"; mode = "file"; }}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconImportFile} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('importExternal.importFile')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('importExternal.importFileDesc')}</div>
        </button>
      </div>
      {#if onback}
        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={onback}>
            {$_('common.back')}
          </button>
        </div>
      {/if}
    {:else if !preview && mode === "file"}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); handlePreview(); }}
      >
        <div>
          <label for="import-file" class="block text-sm text-dim tracking-wide mb-1.5">{$_('importExternal.exportFileLabel')}</label>
          <label class="block border border-dotted border-border px-3 py-2.5 text-base text-dim hover:border-fg/30 transition-colors cursor-pointer">
            {fileName || $_('importExternal.chooseFile')}
            <input
              id="import-file"
              type="file"
              accept=".json,.txt,.2fas,.csv"
              class="hidden"
              onchange={handleFileSelect}
            />
          </label>
        </div>

        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={() => (mode = "choose")}>
            {$_('common.back')}
          </button>
          <button type="submit" disabled={loading || !fileData} class="{btnPrimary} disabled:opacity-30">
            {loading ? $_('common.loading') : $_('importExternal.scan')}
          </button>
        </div>
      </form>
    {:else if preview}
      <div class="mb-4">
        <p class="text-sm text-muted mb-1">
          {$_('importExternal.detected', { values: { format: preview.format.toLowerCase() } })}
        </p>
        <p class="text-sm text-muted mb-3">
          {$_('importExternal.accountsFound', { values: { total: preview.accounts.length + preview.duplicates } })}{#if preview.duplicates > 0}{$_('importExternal.duplicatesExist', { values: { count: preview.duplicates } })}{/if}.
        </p>
        {#if preview.skipped > 0}
          <div role="alert" class="border border-dotted border-error/30 text-error/80 px-3 py-2 mb-3 text-sm">
            {$_('importExternal.nonTotpSkipped', { values: { count: preview.skipped } })}
          </div>
        {/if}
        {#if preview.accounts.length === 0}
          <p class="text-sm text-dim">{$_('importExternal.allExist')}</p>
        {:else}
          <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {#each preview.accounts as account}
              <div class="border border-dotted border-border px-4 py-2.5">
                <div class="text-sm text-fg">{account.issuer}</div>
                <div class="text-xs text-dim">{account.label}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex gap-2">
        <button type="button" class={btnSecondary} onclick={() => {
          if (initialData) {
            onclose();
          } else {
            preview = null;
            error = "";
          }
        }}>
          {initialData ? $_('common.close') : $_('common.back')}
        </button>
        <button type="button" disabled={loading || preview.accounts.length === 0} class="{btnPrimary} disabled:opacity-30" onclick={handleConfirm}>
          {loading ? $_('common.loading') : $_('common.import')}
        </button>
      </div>
    {/if}
  {/snippet}
</Modal>

<ScanOverlay {scanner} />
