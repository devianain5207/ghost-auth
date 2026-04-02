<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getExportAccounts, hasPin, type ExportBatch } from "$lib/stores/accounts";
  import { getTheme } from "$lib/stores/theme.svelte";
  import { getErrorMessage } from "$lib/utils/error";
  import QRCode from "qrcode";
  import ghostLogo from "$lib/assets/ghost.svg";
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let batches: ExportBatch[] = $state([]);
  let currentIndex = $state(0);
  let qrSvg = $state("");
  let error = $state("");
  let loading = $state(false);
  let exportReady = $state(false);
  let acknowledgeRisk = $state(false);
  let pinEnabled = $state(false);
  let currentPin = $state("");

  let current = $derived(batches[currentIndex]);

  $effect(() => {
    checkPinStatus();
  });

  $effect(() => {
    if (batches.length > 0) {
      generateQr(batches[currentIndex].migration_uri);
    }
  });

  async function checkPinStatus() {
    try {
      pinEnabled = await hasPin();
    } catch {
      pinEnabled = false;
    }
  }

  async function loadBatches() {
    if (!acknowledgeRisk) {
      error = $_('exportQr.acknowledgeRequired');
      return;
    }
    if (pinEnabled && !currentPin) {
      error = $_('exportQr.currentPinRequired');
      return;
    }
    error = "";
    loading = true;
    try {
      batches = await getExportAccounts(true, pinEnabled ? currentPin : null);
      currentIndex = 0;
      exportReady = true;
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
      currentPin = "";
    }
  }

  async function generateQr(uri: string) {
    try {
      qrSvg = await QRCode.toString(uri, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: getTheme() === "dark" ? "#ffffff" : "#1a1a1a", light: "#00000000" },
      });
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  function prev() {
    if (currentIndex > 0) currentIndex--;
  }

  function next() {
    if (currentIndex < batches.length - 1) currentIndex++;
  }
</script>

<Modal onclose={onclose} title={$_('exportQr.title')} titleId="export-qr-title">
  {#snippet children()}
    {#if error}
      <div role="alert" class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    {#if !exportReady}
      <div class="flex flex-col gap-4">
        <div class="border border-dotted border-error/30 px-4 py-3 text-sm text-muted leading-relaxed">
          {$_('exportQr.riskWarning')}
        </div>

        <label class="flex items-start gap-3 border border-dotted border-border px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={acknowledgeRisk}
            class="mt-0.5"
          />
          <span class="text-sm text-muted">{$_('exportQr.riskAcknowledge')}</span>
        </label>

        {#if pinEnabled}
          <div>
            <label for="export-current-pin" class="block text-xs text-dim tracking-wide mb-1.5">{$_('exportQr.currentPinLabel')}</label>
            <input
              id="export-current-pin"
              type="password"
              bind:value={currentPin}
              inputmode="numeric"
              autocomplete="one-time-code"
              class="w-full bg-transparent border border-dotted border-border text-fg px-3 py-2 outline-none focus:border-fg/40 transition-colors"
            />
          </div>
        {/if}

        <button
          type="button"
          class="text-sm px-4 py-2 transition-colors border {acknowledgeRisk && (!pinEnabled || !!currentPin) ? 'text-fg border-fg/80 hover:bg-fg hover:text-bg' : 'text-dim/50 border-border cursor-default'}"
          onclick={loadBatches}
          disabled={loading || !acknowledgeRisk || (pinEnabled && !currentPin)}
        >
          {loading ? $_('common.loading') : $_('common.export')}
        </button>
      </div>
    {:else if batches.length === 0}
      <div class="text-center py-8">
        <p class="text-dim text-sm">{$_('exportQr.noAccounts')}</p>
      </div>
    {:else if current}
      <div class="flex flex-col items-center gap-4">
        <!-- QR Code -->
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

        <!-- Accounts in this batch -->
        <div class="w-full border border-dotted border-border px-4 py-3">
          <div class="text-xs text-dim tracking-wide mb-2">
            {$_('exportQr.accountsInBatch', { values: { count: current.accounts.length } })}
          </div>
          {#each current.accounts as account}
            <div class="py-1">
              <span class="text-sm text-fg">{account.issuer || account.label}</span>
              {#if account.issuer && account.label}
                <span class="text-xs text-dim"> — {account.label}</span>
              {/if}
            </div>
          {/each}
        </div>

        <p class="text-xs text-dim text-center">{$_('exportQr.description')}</p>

        <!-- Navigation (only show if multiple batches) -->
        {#if batches.length > 1}
          <div class="w-full flex items-center justify-between mt-2">
            <button
              type="button"
              class="border border-dotted border-border text-dim text-sm px-4 py-2 hover:text-fg hover:border-fg/30 transition-colors disabled:opacity-20 disabled:pointer-events-none"
              disabled={currentIndex === 0}
              onclick={prev}
              aria-label={$_('common.back')}
            >
              <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 2 4 7 9 12" />
              </svg>
            </button>
            <span class="text-sm text-dim">
              {$_('exportQr.counter', { values: { current: currentIndex + 1, total: batches.length } })}
            </span>
            <button
              type="button"
              class="border border-dotted border-border text-dim text-sm px-4 py-2 hover:text-fg hover:border-fg/30 transition-colors disabled:opacity-20 disabled:pointer-events-none"
              disabled={currentIndex === batches.length - 1}
              onclick={next}
              aria-label={$_('exportQr.nextAriaLabel')}
            >
              <svg class="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 2 10 7 5 12" />
              </svg>
            </button>
          </div>
        {/if}
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
