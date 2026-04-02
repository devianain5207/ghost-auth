<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { addAccount, addAccountManual } from "$lib/stores/accounts";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles";
  import { Scanner } from "$lib/utils/scanner.svelte";
  import { getErrorMessage } from "$lib/utils/error";
  import Modal from "./Modal.svelte";
  import ScanOverlay from "./ScanOverlay.svelte";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconImportFile from "$lib/assets/icons/import-file.svg";
  import iconManualEntry from "$lib/assets/icons/manual-entry.svg";
  import iconPaste from "$lib/assets/icons/paste.svg";
  import iconApp from "$lib/assets/icons/app.svg";

  let { onclose, onsuccess, onmigration, onimportexternal, onscanstart, onscanend }: {
    onclose: () => void;
    onsuccess: () => void;
    onmigration: (data: number[]) => void;
    onimportexternal: () => void;
    onscanstart?: () => void;
    onscanend?: () => void;
  } = $props();

  let mode: "choose" | "manual" | "uri" = $state("choose");
  let error = $state("");
  let loading = $state(false);
  let permissionDenied = $state(false);

  // Manual entry fields
  let issuer = $state("");
  let label = $state("");
  let secret = $state("");
  // URI entry
  let uri = $state("");

  async function handleScannedContent(content: string) {
    if (content.startsWith("otpauth-migration://")) {
      const data = Array.from(new TextEncoder().encode(content));
      onmigration(data);
      return;
    }

    if (!content.startsWith("otpauth://")) {
      error = $_('addAccount.invalidQr');
      return;
    }

    try {
      await addAccount(content);
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  const scanner = new Scanner({
    onContent: handleScannedContent,
    setError: (msg) => { error = msg; },
    setPermissionDenied: (v) => { permissionDenied = v; },
    t: (key) => $_(key),
    onscanstart: () => onscanstart?.(),
    onscanend: () => onscanend?.(),
  });

  let qrImageInput: HTMLInputElement | undefined = $state(undefined);

  $effect(() => {
    scanner.qrImageInput = qrImageInput;
  });

  async function submitManual() {
    error = "";
    if (!secret.trim()) {
      error = $_('addAccount.secretRequired');
      return;
    }
    loading = true;
    try {
      await addAccountManual(
        issuer.trim(),
        label.trim(),
        secret.trim(),
        "SHA1",
        6,
        30,
      );
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  async function submitUri() {
    error = "";
    if (!uri.trim()) {
      error = $_('addAccount.uriRequired');
      return;
    }
    loading = true;
    try {
      await addAccount(uri.trim());
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

</script>

<input
  bind:this={qrImageInput}
  type="file"
  accept="image/*"
  class="hidden"
  onchange={(e) => scanner.handleQrImageSelect(e)}
/>

<Modal onclose={onclose} title={$_('addAccount.title')} titleId="add-account-title">
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

    {#if mode === "choose"}
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
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.scanQrDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={scanner.scanning || scanner.imageProcessing}
          onclick={() => scanner.openQrImagePicker()}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconImportFile} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {scanner.imageProcessing ? $_('scanner.scanning') : $_('addAccount.uploadQrImage')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.uploadQrImageDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => (mode = "manual")}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconManualEntry} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.manualEntry')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.manualEntryDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => (mode = "uri")}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconPaste} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.pasteUri')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.pasteUriDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={onimportexternal}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconApp} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.importFromApp')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.importFromAppDesc')}</div>
        </button>
      </div>

    {:else if mode === "manual"}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); submitManual(); }}
      >
        <div>
          <label for="issuer" class="block text-sm text-dim tracking-wide mb-1.5">{$_('addAccount.serviceLabel')}</label>
          <input
            id="issuer"
            type="text"
            bind:value={issuer}
            maxlength={255}
            placeholder={$_('addAccount.servicePlaceholder')}
            class={inputClass}
          />
        </div>
        <div>
          <label for="label" class="block text-sm text-dim tracking-wide mb-1.5">{$_('addAccount.accountLabel')}</label>
          <input
            id="label"
            type="text"
            bind:value={label}
            maxlength={255}
            placeholder={$_('addAccount.accountPlaceholder')}
            class={inputClass}
          />
        </div>
        <div>
          <label for="secret" class="block text-sm text-dim tracking-wide mb-1.5">{$_('addAccount.secretKeyLabel')} <span class="text-dim">{$_('addAccount.secretKeyRequired')}</span></label>
          <input
            id="secret"
            type="text"
            bind:value={secret}
            placeholder={$_('addAccount.secretKeyPlaceholder')}
            class="{inputClass} uppercase"
          />
        </div>

        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={() => (mode = "choose")}>
            {$_('common.back')}
          </button>
          <button type="submit" disabled={loading} class="{btnPrimary} disabled:opacity-30">
            {loading ? $_('common.loading') : $_('common.add')}
          </button>
        </div>
      </form>

    {:else if mode === "uri"}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); submitUri(); }}
      >
        <div>
          <label for="uri" class="block text-sm text-dim tracking-wide mb-1.5">{$_('addAccount.uriLabel')}</label>
          <textarea
            id="uri"
            bind:value={uri}
            placeholder={$_('addAccount.uriPlaceholder')}
            rows="3"
            class="{inputClass} resize-none"
          ></textarea>
        </div>
        <div class="flex gap-2 mt-1">
          <button type="button" class={btnSecondary} onclick={() => (mode = "choose")}>
            {$_('common.back')}
          </button>
          <button type="submit" disabled={loading} class="{btnPrimary} disabled:opacity-30">
            {loading ? $_('common.loading') : $_('common.add')}
          </button>
        </div>
      </form>
    {/if}
  {/snippet}
</Modal>

<ScanOverlay {scanner} showImagePicker={false} />
