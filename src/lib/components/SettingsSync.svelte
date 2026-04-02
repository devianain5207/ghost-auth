<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getLocale } from "$lib/stores/locale.svelte";
  import SettingsToggle from "./SettingsToggle.svelte";
  import iconDevices from "$lib/assets/icons/devices-2.svg";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconIcloud from "$lib/assets/icons/icloud.svg";

  let {
    icloudSyncEnabled = false,
    icloudSyncAvailable = false,
    icloudSyncBusy = false,
    icloudLastSyncedAt = 0,
    onicloudsynctoggle,
    onicloudsyncinfo,
    onsyncdevices,
    onsynctoextension,
  }: {
    icloudSyncEnabled?: boolean;
    icloudSyncAvailable?: boolean;
    icloudSyncBusy?: boolean;
    icloudLastSyncedAt?: number;
    onicloudsynctoggle?: () => void;
    onicloudsyncinfo?: () => void;
    onsyncdevices: () => void;
    onsynctoextension: () => void;
  } = $props();

  function formatLastSynced(unixSecs: number): string {
    if (!unixSecs) return '';
    const now = Date.now();
    const ms = unixSecs * 1000;
    const diffSec = Math.floor((now - ms) / 1000);
    const locale = getLocale() || undefined;
    if (diffSec < 60) return $_('icloudSync.lastSynced', { values: { time: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second') } });
    if (diffSec < 3600) return $_('icloudSync.lastSynced', { values: { time: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-Math.floor(diffSec / 60), 'minute') } });
    if (diffSec < 86400) {
      const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const days = Math.floor(diffSec / 86400);
      return $_('icloudSync.lastSynced', { values: { time: days === 0 ? fmt.format(ms) : `${rtf.format(-days, 'day')}, ${fmt.format(ms)}` } });
    }
    if (diffSec < 604800) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
      return $_('icloudSync.lastSynced', { values: { time: `${rtf.format(-Math.floor(diffSec / 86400), 'day')}, ${timeFmt.format(ms)}` } });
    }
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return $_('icloudSync.lastSynced', { values: { time: fmt.format(ms) } });
  }
</script>

<div>
  <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.sync')}</p>
  <div class="flex flex-col gap-1.5">
    {#if icloudSyncAvailable}
      <div class="border border-dotted border-border px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-3 text-sm text-muted">
            <img src={iconIcloud} alt="" class="w-5 h-5 icon-adapt opacity-50" />
            {$_('settings.icloudSync')}
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-dim hover:text-fg transition-colors w-5 h-5 text-xs rounded-full border border-border flex items-center justify-center"
              onclick={onicloudsyncinfo}
              aria-label={$_('icloudSync.title')}
            >?</button>
            {#if icloudSyncBusy}
              <span class="inline-block w-4 h-4 border-2 border-fg/25 border-t-fg rounded-full animate-spin"></span>
            {:else}
              <SettingsToggle
                checked={icloudSyncEnabled}
                onclick={() => onicloudsynctoggle?.()}
                ariaLabel={$_('settings.toggleIcloudSync')}
              />
            {/if}
          </div>
        </div>
        {#if icloudSyncEnabled && icloudLastSyncedAt}
          <p class="text-xs text-dim/60 mt-1.5">{formatLastSynced(icloudLastSyncedAt)}</p>
        {/if}
      </div>
    {/if}
    <button
      type="button"
      class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
      onclick={onsyncdevices}
    >
      <img src={iconDevices} alt="" class="w-5 h-5 icon-adapt opacity-50" />
      {$_('settings.syncDevices')}
    </button>
    <button
      type="button"
      class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
      onclick={onsynctoextension}
    >
      <img src={iconQr} alt="" class="w-5 h-5 icon-adapt opacity-50" />
      {$_('settings.syncToExtension')}
    </button>
  </div>
</div>
