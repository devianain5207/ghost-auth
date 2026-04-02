<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Scanner } from "$lib/utils/scanner.svelte";
  import WebScanner from "./WebScanner.svelte";
  import iconImportFile from "$lib/assets/icons/import-file.svg";

  let { scanner, showImagePicker = true }: {
    scanner: Scanner;
    showImagePicker?: boolean;
  } = $props();

  let qrImageInput: HTMLInputElement | undefined = $state(undefined);

  $effect(() => {
    scanner.qrImageInput = qrImageInput;
  });
</script>

{#if scanner.showWebScanner}
  <WebScanner
    onscan={(content) => scanner.handleWebScanResult(content)}
    oncancel={() => { scanner.showWebScanner = false; }}
  />
{/if}

{#if showImagePicker}
  <input
    bind:this={qrImageInput}
    type="file"
    accept="image/*"
    class="hidden"
    onchange={(e) => scanner.handleQrImageSelect(e)}
  />
{/if}

{#if scanner.scanning}
  <div class="fixed inset-0 z-[100] pointer-events-none scan-overlay">
    <button
      type="button"
      class="pointer-events-auto absolute end-5 w-10 h-10 flex items-center justify-center bg-bg/50 backdrop-blur-sm rounded-full"
      style="top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 56px)) + 0.75rem)"
      onclick={() => scanner.cancelScan()}
      aria-label={$_('scanner.closeCamera')}
    >
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-4 h-4 text-fg">
        <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
      </svg>
    </button>
    {#if showImagePicker}
      <button
        type="button"
        class="pointer-events-auto absolute start-5 w-10 h-10 flex items-center justify-center bg-bg/50 backdrop-blur-sm rounded-full"
        style="bottom: calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 1.25rem)"
        onclick={() => scanner.openQrImagePicker()}
        aria-label={$_('importExternal.chooseFile')}
      >
        <img src={iconImportFile} alt="" class="w-4 h-4 icon-adapt opacity-90" />
      </button>
    {/if}
    <div class="absolute inset-x-20 top-1/2 -translate-y-1/2 aspect-square">
      <div class="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-fg/80"></div>
      <div class="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-fg/80"></div>
      <div class="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-fg/80"></div>
      <div class="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-fg/80"></div>
    </div>
    {#if scanner.scanHint}
      <p class="pointer-events-none absolute left-0 right-0 bottom-[20%] text-center text-xs text-fg/70 px-8">
        {$_('scanner.scanHint')}
      </p>
    {/if}
  </div>
{/if}

{#if scanner.imageProcessing}
  <div class="fixed inset-0 z-[110] bg-bg/70 backdrop-blur-[1px] flex items-center justify-center">
    <div class="border border-dotted border-border bg-bg px-4 py-3 flex items-center gap-3 text-sm text-fg">
      <span class="inline-block w-4 h-4 border-2 border-fg/25 border-t-fg rounded-full animate-spin"></span>
      <span>{$_('scanner.scanning')}</span>
    </div>
  </div>
{/if}
