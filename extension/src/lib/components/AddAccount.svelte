<script lang="ts">
  import { addAccountFromUri, addAccountManual } from "$lib/stores/accounts.svelte";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import { _ } from 'svelte-i18n';
  import jsQR from "jsqr";
  import Modal from "./Modal.svelte";
  import iconManualEntry from "$lib/assets/icons/manual-entry.svg";
  import iconPaste from "$lib/assets/icons/paste.svg";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconImportFile from "$lib/assets/icons/import-file.svg";

  let { onclose, onsuccess }: {
    onclose: () => void;
    onsuccess: () => void;
  } = $props();

  const browserRuntime = (globalThis as any).browser?.runtime ?? (globalThis as any).chrome?.runtime;

  let mode: "choose" | "manual" | "uri" = $state("choose");
  let error = $state("");
  let loading = $state(false);
  let imageProcessing = $state(false);
  let qrImageInput: HTMLInputElement | undefined = $state(undefined);

  // Manual entry fields
  let issuer = $state("");
  let label = $state("");
  let secret = $state("");
  // URI entry
  let uri = $state("");

  function openQrImagePicker() {
    qrImageInput?.click();
  }

  async function handleQrImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    error = "";
    imageProcessing = true;
    try {
      const content = await decodeQrFromImage(file);
      if (!content) {
        error = $_('scanner.noQrDetected');
        return;
      }
      if (!content.startsWith("otpauth://")) {
        error = $_('addAccount.invalidQr');
        return;
      }
      await addAccountFromUri(content);
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      imageProcessing = false;
    }
  }

  async function decodeQrFromImage(file: File): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const maxDim = 1024;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(imageData.data, canvas.width, canvas.height);
            resolve(result?.data || null);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

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
      await addAccountFromUri(uri.trim());
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
  onchange={handleQrImageSelect}
/>

{#if imageProcessing}
  <div class="fixed inset-0 z-[110] bg-bg/70 backdrop-blur-[1px] flex items-center justify-center">
    <div class="border border-dotted border-border bg-bg px-4 py-3 flex items-center gap-3 text-sm text-fg">
      <span class="inline-block w-4 h-4 border-2 border-fg/25 border-t-fg rounded-full animate-spin"></span>
      <span>{$_('scanner.scanning')}</span>
    </div>
  </div>
{/if}

<Modal onclose={onclose} title={$_('addAccount.title')} titleId="add-account-title">
  {#snippet children(_ctx)}
    {#if error}
      <div class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    {#if mode === "choose"}
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="text-left border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => (mode = "manual")}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconManualEntry} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.manualEntry')}
          </div>
          <div class="text-sm text-dim mt-1 ml-6">{$_('addAccount.manualEntryDesc')}</div>
        </button>
        <button
          type="button"
          class="text-left border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => (mode = "uri")}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconPaste} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.pasteUri')}
          </div>
          <div class="text-sm text-dim mt-1 ml-6">{$_('addAccount.pasteUriDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          onclick={() => {
            browserRuntime?.sendMessage({ type: "start-qr-scan" });
            window.close();
          }}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {$_('addAccount.scanFromPage')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.scanFromPageDesc')}</div>
        </button>
        <button
          type="button"
          class="text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors group"
          disabled={imageProcessing}
          onclick={openQrImagePicker}
        >
          <div class="text-base text-fg group-hover:text-fg flex items-center gap-2">
            <img src={iconImportFile} alt="" class="w-4 h-4 icon-adapt opacity-60" />
            {imageProcessing ? $_('scanner.scanning') : $_('addAccount.uploadQrImage')}
          </div>
          <div class="text-sm text-dim mt-1 ms-6">{$_('addAccount.uploadQrImageDesc')}</div>
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
