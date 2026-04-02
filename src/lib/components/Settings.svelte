<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { sendTestCrashReport } from "$lib/stores/accounts";
  import { trapFocus } from "$lib/utils/focusTrap";
  import { swipeBack } from "$lib/utils/swipeBack";
  import { getTheme, toggleTheme } from "$lib/stores/theme.svelte";
  import { getLocale, getIsSystemDefault } from "$lib/stores/locale.svelte";
  import { LANGUAGES } from "$lib/i18n";
  import SettingsToggle from "./SettingsToggle.svelte";
  import SettingsTextSize from "./SettingsTextSize.svelte";
  import SettingsSync from "./SettingsSync.svelte";
  import iconLock from "$lib/assets/icons/lock.svg";
  import iconUnlock from "$lib/assets/icons/unlock.svg";
  import iconExport from "$lib/assets/icons/export.svg";
  import iconImport from "$lib/assets/icons/import.svg";
  import iconArrow from "$lib/assets/icons/right-arrow.svg";
  import iconApp from "$lib/assets/icons/app.svg";
  import iconAbout from "$lib/assets/icons/about.svg";
  import iconQr from "$lib/assets/icons/qr.svg";
  import iconShield from "$lib/assets/icons/shield.svg";

  let {
    onclose,
    pinEnabled,
    biometricEnabled,
    biometricHardwareAvailable,
    onbiometrictoggle,
    onpintoggle,
    onexport,
    onimport,
    onimportexternal,
    onexportqr,
    onsyncdevices,
    onsynctoextension,
    onabout,
    onhelp,
    onlanguage,
    crashReportingEnabled,
    oncrashreportingtoggle,
    oncrashreportinginfo,
    icloudSyncEnabled = false,
    icloudSyncAvailable = false,
    icloudSyncBusy = false,
    icloudLastSyncedAt = 0,
    onicloudsynctoggle,
    onicloudsyncinfo,
  }: {
    onclose: () => void;
    pinEnabled: boolean;
    biometricEnabled: boolean;
    biometricHardwareAvailable: boolean;
    onbiometrictoggle: () => void;
    onpintoggle: () => void;
    onexport: () => void;
    onimport: () => void;
    onimportexternal: () => void;
    onexportqr: () => void;
    onsyncdevices: () => void;
    onsynctoextension: () => void;
    onabout: () => void;
    onhelp: () => void;
    onlanguage: () => void;
    crashReportingEnabled: boolean;
    oncrashreportingtoggle: () => void;
    oncrashreportinginfo: () => void;
    icloudSyncEnabled?: boolean;
    icloudSyncAvailable?: boolean;
    icloudSyncBusy?: boolean;
    icloudLastSyncedAt?: number;
    onicloudsynctoggle?: () => void;
    onicloudsyncinfo?: () => void;
  } = $props();

  let theme = $derived(getTheme());
  let currentLocale = $derived(getLocale());
  let isSystemLang = $derived(getIsSystemDefault());
  let currentLangName = $derived(
    isSystemLang
      ? $_('settings.systemDefault')
      : LANGUAGES.find((l) => l.code === currentLocale)?.name ?? currentLocale,
  );
  let mounted = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let testCrashStatus: 'idle' | 'sending' | 'ok' | 'fail' = $state('idle');
  let testCrashError = $state('');

  $effect(() => () => { clearTimeout(closeTimer); });

  $effect(() => {
    requestAnimationFrame(() => { mounted = true; });
  });

  function close() {
    mounted = false;
    closeTimer = setTimeout(onclose, 300);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 z-40 settings-backdrop {mounted ? 'open' : ''}"
  onclick={close}
  onkeydown={(e) => e.key === "Escape" && close()}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-bg settings-slide {mounted ? 'open' : ''} flex flex-col pt-safe pb-safe"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
    use:trapFocus
    use:swipeBack={{ onclose: () => setTimeout(onclose, 0) }}
  >
    <!-- Header -->
    <div class="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto w-full px-5 py-4 flex items-center gap-3 border-dotted-b">
      <button
        type="button"
        class="text-dim hover:text-fg transition-colors p-1"
        onclick={close}
        aria-label={$_('common.back')}
      >
        <svg class="w-5 h-5 rtl-flip" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4l-6 6 6 6" />
        </svg>
      </button>
      <span id="settings-title" class="text-lg tracking-wide text-muted">{$_('settings.title')}</span>
    </div>

    <!-- Content -->
    <div class="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto w-full px-5 py-6 flex flex-col gap-6 flex-1 overflow-y-auto">
      <!-- Appearance -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.appearance')}</p>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
            <span class="flex items-center gap-3 text-sm text-muted">
              {#if theme === 'dark'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-50">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              {:else}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-50">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              {/if}
              {theme === 'dark' ? $_('settings.darkMode') : $_('settings.lightMode')}
            </span>
            <SettingsToggle checked={theme === 'light'} onclick={toggleTheme} ariaLabel={$_('settings.toggleLight')} />
          </div>
        </div>
      </div>

      <SettingsTextSize />

      <!-- Language -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.language')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center justify-between"
          onclick={onlanguage}
        >
          <span class="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-50">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {currentLangName}
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 opacity-40">
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
      </div>

      <!-- Security -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.security')}</p>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
            <span class="flex items-center gap-3 text-sm text-muted">
              <img src={pinEnabled ? iconLock : iconUnlock} alt="" class="w-5 h-5 icon-adapt opacity-50" />
              {$_('settings.pinLock')}
            </span>
            <SettingsToggle checked={pinEnabled} onclick={onpintoggle} ariaLabel={$_('settings.togglePin')} />
          </div>
          {#if pinEnabled && biometricHardwareAvailable}
            <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
              <span class="flex items-center gap-3 text-sm text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-50">
                  <path d="M7.5 11c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
                  <path d="M12 12v4" />
                  <path d="M5 10c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                  <path d="M3 9c0-5 4-9 9-9s9 4 9 9" />
                  <path d="M10 12c0-1.1.9-2 2-2s2 .9 2 2v3c0 1.1-.9 2-2 2" />
                  <path d="M7.5 15c0 2.5 2 4.5 4.5 4.5 1.4 0 2.6-.6 3.4-1.6" />
                  <path d="M5 14c0 3.9 3.1 7 7 7 2.8 0 5.2-1.6 6.3-4" />
                </svg>
                {$_('settings.biometricUnlock')}
              </span>
              <SettingsToggle checked={biometricEnabled} onclick={onbiometrictoggle} ariaLabel={$_('settings.toggleBiometric')} />
            </div>
          {/if}
        </div>
      </div>

      <!-- Privacy -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.privacy')}</p>
        <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
          <span class="flex items-center gap-3 text-sm text-muted">
            <img src={iconShield} alt="" class="w-5 h-5 icon-adapt opacity-50" />
            {$_('settings.crashReporting')}
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-dim hover:text-fg transition-colors w-5 h-5 text-xs rounded-full border border-border flex items-center justify-center"
              onclick={oncrashreportinginfo}
              aria-label={$_('settings.crashReportingLearnMore')}
            >?</button>
            <SettingsToggle checked={crashReportingEnabled} onclick={oncrashreportingtoggle} ariaLabel={$_('settings.toggleCrashReporting')} />
          </div>
        </div>
        {#if import.meta.env.DEV}
          <button
            type="button"
            class="mt-1.5 w-full border border-dotted border-border px-4 py-2.5 text-xs text-dim hover:text-fg transition-colors text-left"
            disabled={testCrashStatus === 'sending'}
            onclick={async () => {
              testCrashStatus = 'sending';
              testCrashError = '';
              try {
                await sendTestCrashReport();
                testCrashStatus = 'ok';
              } catch (e: unknown) {
                testCrashStatus = 'fail';
                testCrashError = String(e);
              }
              setTimeout(() => { testCrashStatus = 'idle'; }, 3000);
            }}
          >
            {#if testCrashStatus === 'sending'}
              Sending…
            {:else if testCrashStatus === 'ok'}
              Sent ✓
            {:else if testCrashStatus === 'fail'}
              Failed: {testCrashError}
            {:else}
              Send Test Crash Report
            {/if}
          </button>
        {/if}
      </div>

      <SettingsSync
        {icloudSyncEnabled}
        {icloudSyncAvailable}
        {icloudSyncBusy}
        {icloudLastSyncedAt}
        {onicloudsynctoggle}
        {onicloudsyncinfo}
        {onsyncdevices}
        {onsynctoextension}
      />

      <!-- Import -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.import')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={onimportexternal}
        >
          <span class="flex items-center gap-1">
            <img src={iconApp} alt="" class="w-4 h-4 icon-adapt opacity-50" />
            <img src={iconArrow} alt="" class="w-3 h-3 icon-adapt opacity-35 rtl-flip" />
          </span>
          {$_('settings.importFromApp')}
        </button>
      </div>

      <!-- Export -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.export')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={onexportqr}
        >
          <img src={iconQr} alt="" class="w-5 h-5 icon-adapt opacity-50" />
          {$_('settings.exportQr')}
        </button>
      </div>

      <!-- Backup -->
      <div>
        <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.backup')}</p>
        <div class="flex flex-col gap-1.5">
          <button
            type="button"
            class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
            onclick={onimport}
          >
            <img src={iconImport} alt="" class="w-5 h-5 icon-adapt opacity-50" />
            {$_('settings.importBackup')}
          </button>
          <button
            type="button"
            class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
            onclick={onexport}
          >
            <img src={iconExport} alt="" class="w-5 h-5 icon-adapt opacity-50" />
            {$_('settings.exportBackup')}
          </button>
        </div>
      </div>

      <!-- Help & About — pushed to bottom -->
      <div class="mt-auto pt-4 flex flex-col gap-1">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 text-dim text-sm tracking-wide py-3 hover:text-fg transition-colors"
          onclick={onhelp}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-60">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {$_('settings.help')}
        </button>
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 text-dim text-sm tracking-wide py-3 hover:text-fg transition-colors"
          onclick={onabout}
        >
          <img src={iconAbout} alt="" class="w-5 h-5 icon-adapt opacity-60" />
          {$_('settings.about')}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-backdrop {
    background: var(--color-backdrop-light);
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .settings-backdrop.open {
    opacity: 1;
  }
  .settings-slide {
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .settings-slide.open {
    transform: translateX(0);
  }
</style>
