<script lang="ts">
  import { toggleTheme, getTheme } from "$lib/stores/theme.svelte";
  import { storage } from "$lib/stores/accounts.svelte";
  import { trapFocus } from "$lib/utils/focusTrap";
  import { _ } from 'svelte-i18n';
  import { getLocale, getIsSystemDefault } from '$lib/stores/locale.svelte';
  import { LANGUAGES } from '$lib/i18n';
  import iconLock from "$lib/assets/icons/lock.svg";
  import iconUnlock from "$lib/assets/icons/unlock.svg";
  import iconExport from "$lib/assets/icons/export.svg";
  import iconImport from "$lib/assets/icons/import.svg";
  import iconAbout from "$lib/assets/icons/about.svg";
  import iconPhone from "$lib/assets/icons/iphone.svg";
  import iconArrow from "$lib/assets/icons/right-arrow.svg";
  import iconApp from "$lib/assets/icons/app.svg";
  import iconQr from "$lib/assets/icons/qr.svg";

  let {
    onclose,
    onlock,
    onexport,
    onimport,
    onimportexternal,
    onexportqr,
    onpintoggle,
    onsync,
    onqrsync,
    onhelp,
    onabout,
    onlanguage,
    pinEnabled,
    autoLockMinutes,
    onautolockchange,
    passwordlessEnabled,
    onpasswordlesstoggle,
    crashReportingEnabled,
    oncrashreportingtoggle,
    oncrashreportinginfo,
  }: {
    onclose: () => void;
    onlock: () => void;
    onexport: () => void;
    onimport: () => void;
    onimportexternal: () => void;
    onexportqr: () => void;
    onpintoggle: () => void;
    onsync: () => void;
    onqrsync: () => void;
    onhelp: () => void;
    onabout: () => void;
    onlanguage: () => void;
    pinEnabled: boolean;
    autoLockMinutes: number;
    onautolockchange: (minutes: number) => void;
    passwordlessEnabled: boolean;
    onpasswordlesstoggle: (enabled: boolean) => void;
    crashReportingEnabled: boolean;
    oncrashreportingtoggle: () => void;
    oncrashreportinginfo: () => void;
  } = $props();

  let theme = $derived(getTheme());
  let currentLanguageName = $derived(
    getIsSystemDefault()
      ? $_('settings.systemDefault')
      : (LANGUAGES.find(l => l.code === getLocale())?.name ?? getLocale())
  );

  let mounted = $state(false);
  let showPasswordlessWarning = $state(false);

  let autoLockOptions = $derived([
    { label: $_('ext.settings.autoLock1'), value: 1 },
    { label: $_('ext.settings.autoLock5'), value: 5 },
    { label: $_('ext.settings.autoLock15'), value: 15 },
    { label: $_('ext.settings.autoLock30'), value: 30 },
    { label: $_('ext.settings.autoLockNever'), value: 0 },
  ]);

  $effect(() => {
    requestAnimationFrame(() => { mounted = true; });
  });

  function close() {
    mounted = false;
    setTimeout(onclose, 300);
  }

  function handleLock() {
    storage.lock();
    close();
    setTimeout(onlock, 300);
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
    class="fixed inset-0 bg-bg settings-slide {mounted ? 'open' : ''} flex flex-col"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
    use:trapFocus
  >
    <!-- Header with back button -->
    <div class="w-full px-5 py-3 flex items-center gap-3 border-dotted-b">
      <button type="button" class="text-dim hover:text-fg transition-colors p-1" onclick={close} aria-label={$_('common.back')}>
        <svg class="rtl-flip" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4l-6 6 6 6" />
        </svg>
      </button>
      <span id="settings-title" class="text-lg tracking-wide text-muted">{$_('settings.title')}</span>
    </div>

    <!-- Scrollable content -->
    <div class="w-full px-5 py-6 flex flex-col gap-6 flex-1 overflow-y-auto">
      <!-- Appearance -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('settings.appearance')}</p>
        <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
          <span class="flex items-center gap-3 text-sm text-muted">
            {#if theme === 'dark'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            {/if}
            {theme === 'dark' ? $_('settings.darkMode') : $_('settings.lightMode')}
          </span>
          <button
            type="button"
            class="w-11 h-6 rounded-full border transition-all duration-200 relative {theme === 'light' ? 'bg-accent/15 border-accent/40' : 'bg-transparent border-dim/50'}"
            onclick={toggleTheme}
            role="switch"
            aria-checked={theme === 'light'}
            aria-label={$_('settings.toggleLight')}
          >
            <div class="w-4 h-4 rounded-full absolute top-0.5 transition-all duration-200 {theme === 'light' ? 'left-[22px] bg-accent' : 'left-[3px] bg-dim'}"></div>
          </button>
        </div>
      </div>

      <!-- Language -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('settings.language')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center justify-between"
          onclick={onlanguage}
        >
          <span class="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {currentLanguageName}
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-40">
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
      </div>

      <!-- Security -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('ext.settings.sectionSecurity')}</p>
        <div class="flex flex-col gap-1.5">
          <!-- PIN lock toggle -->
          <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
            <span class="flex items-center gap-3 text-sm text-muted">
              <img src={pinEnabled ? iconLock : iconUnlock} alt="" class="w-4 h-4 icon-adapt opacity-50" />
              {$_('settings.pinLock')}
            </span>
            <button
              type="button"
              class="w-11 h-6 rounded-full border transition-all duration-200 relative {pinEnabled ? 'bg-accent/15 border-accent/40' : 'bg-transparent border-dim/50'}"
              onclick={() => { close(); setTimeout(onpintoggle, 300); }}
              role="switch"
              aria-checked={pinEnabled}
              aria-label={$_('settings.togglePin')}
            >
              <div class="w-4 h-4 rounded-full absolute top-0.5 transition-all duration-200 {pinEnabled ? 'left-[22px] bg-accent' : 'left-[3px] bg-dim'}"></div>
            </button>
          </div>

          <!-- Auto-lock timeout (only visible when PIN is enabled) -->
          {#if pinEnabled}
            <div class="border border-dotted border-border px-4 py-3">
              <div class="text-sm text-muted mb-2">{$_('ext.settings.autoLockLabel')}</div>
              <div class="flex flex-wrap gap-1.5">
                {#each autoLockOptions as opt}
                  <button
                    type="button"
                    class="text-xs px-2.5 py-1 border border-dotted transition-colors {autoLockMinutes === opt.value ? 'border-fg/60 text-fg' : 'border-border text-dim hover:border-fg/30 hover:text-fg'}"
                    onclick={() => onautolockchange(opt.value)}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
              <div class="text-xs text-dim mt-2">
                {autoLockMinutes === 0 ? $_('ext.settings.autoLockNeverDesc') : $_('ext.settings.autoLockDesc', { values: { minutes: autoLockMinutes } })}
              </div>
            </div>
          {/if}

          <!-- Passwordless toggle -->
          <div class="flex items-center justify-between border border-dotted border-border px-4 py-3">
            <span class="flex items-center gap-3 text-sm text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {$_('ext.settings.passwordlessLabel')}
            </span>
            <button
              type="button"
              class="w-11 h-6 rounded-full border transition-all duration-200 relative {passwordlessEnabled ? 'bg-accent/15 border-accent/40' : 'bg-transparent border-dim/50'}"
              onclick={() => {
                if (passwordlessEnabled) {
                  onpasswordlesstoggle(false);
                } else {
                  showPasswordlessWarning = !showPasswordlessWarning;
                }
              }}
              role="switch"
              aria-checked={passwordlessEnabled}
              aria-label={$_('ext.settings.passwordlessLabel')}
            >
              <div class="w-4 h-4 rounded-full absolute top-0.5 transition-all duration-200 {passwordlessEnabled ? 'left-[22px] bg-accent' : 'left-[3px] bg-dim'}"></div>
            </button>
          </div>

          {#if showPasswordlessWarning}
            <div class="border border-dotted border-error/30 px-4 py-3">
              <div class="text-xs text-error/80 mb-2">{$_('ext.settings.passwordlessWarning')}</div>
              <div class="text-xs text-dim leading-relaxed">
                {$_('ext.settings.passwordlessWarningDesc')}
              </div>
              <button
                type="button"
                class="mt-3 w-full border border-dotted border-error/40 text-error text-xs py-2 hover:border-error/60 transition-colors"
                onclick={() => {
                  showPasswordlessWarning = false;
                  onpasswordlesstoggle(true);
                }}
              >
                {$_('ext.settings.passwordlessConfirm')}
              </button>
            </div>
          {/if}

          <!-- Lock vault -->
          {#if !passwordlessEnabled}
            <button
              type="button"
              class="w-full text-start border border-dotted border-border px-4 py-3 hover:border-fg/30 transition-colors flex items-center gap-3 text-sm text-dim hover:text-fg"
              onclick={handleLock}
            >
              <img src={iconLock} alt="" class="w-4 h-4 icon-adapt opacity-50" />
              {$_('ext.settings.lockVault')}
            </button>
          {/if}
        </div>
      </div>

      <!-- Privacy -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('settings.privacy')}</p>
        <div class="flex items-center justify-between gap-3 border border-dotted border-border px-4 py-3">
          <span class="flex items-center gap-3 text-sm text-muted min-w-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span class="truncate">{$_('settings.crashReporting')}</span>
          </span>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="text-dim hover:text-fg transition-colors w-5 h-5 text-xs rounded-full border border-border flex items-center justify-center"
              onclick={() => { close(); setTimeout(oncrashreportinginfo, 300); }}
              aria-label={$_('settings.crashReportingLearnMore')}
            >?</button>
            <button
              type="button"
              class="w-11 h-6 rounded-full border transition-all duration-200 relative {crashReportingEnabled ? 'bg-accent/15 border-accent/40' : 'bg-transparent border-dim/50'}"
              onclick={oncrashreportingtoggle}
              role="switch"
              aria-checked={crashReportingEnabled}
              aria-label={$_('settings.toggleCrashReporting')}
            >
              <div class="w-4 h-4 rounded-full absolute top-0.5 transition-all duration-200 {crashReportingEnabled ? 'left-[22px] bg-accent' : 'left-[3px] bg-dim'}"></div>
            </button>
          </div>
        </div>
      </div>

      <!-- Sync -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('ext.settings.sectionSync')}</p>
        <div class="flex flex-col gap-1.5">
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={() => { close(); setTimeout(onqrsync, 300); }}
        >
          <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-50" />
          {$_('ext.qrSync.syncFromPhone')}
        </button>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={() => { close(); setTimeout(onsync, 300); }}
        >
          <span class="flex items-center gap-1">
            <img src={iconArrow} alt="" class="w-2.5 h-2.5 icon-adapt opacity-35 rtl-flip" style="transform: scaleX(-1)" />
            <img src={iconPhone} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
          </span>
          {$_('ext.settings.syncFromDevice')}
        </button>
        </div>
      </div>

      <!-- Import -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('settings.import')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={() => { close(); setTimeout(onimportexternal, 300); }}
        >
          <span class="flex items-center gap-1">
            <img src={iconApp} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
            <img src={iconArrow} alt="" class="w-2.5 h-2.5 icon-adapt opacity-35 rtl-flip" />
          </span>
          {$_('settings.importFromApp')}
        </button>
      </div>

      <!-- Export -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('settings.export')}</p>
        <button
          type="button"
          class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
          onclick={() => { close(); setTimeout(onexportqr, 300); }}
        >
          <img src={iconQr} alt="" class="w-4 h-4 icon-adapt opacity-50" />
          {$_('settings.exportQr')}
        </button>
      </div>

      <!-- Backup -->
      <div>
        <p class="text-sm font-semibold text-dim tracking-wide mb-3">{$_('ext.settings.sectionBackup')}</p>
        <div class="flex flex-col gap-1.5">
          <button
            type="button"
            class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
            onclick={() => { close(); setTimeout(onimport, 300); }}
          >
            <img src={iconImport} alt="" class="w-4 h-4 icon-adapt opacity-50" />
            {$_('settings.importBackup')}
          </button>
          <button
            type="button"
            class="w-full text-start border border-dotted border-border px-4 py-3 text-sm text-dim hover:text-fg hover:border-fg/30 transition-colors flex items-center gap-3"
            onclick={() => { close(); setTimeout(onexport, 300); }}
          >
            <img src={iconExport} alt="" class="w-4 h-4 icon-adapt opacity-50" />
            {$_('settings.exportBackup')}
          </button>
        </div>
      </div>

      <!-- Help & About pushed to bottom -->
      <div class="mt-auto pt-4 flex flex-col gap-1">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 text-dim text-xs tracking-wide py-3 hover:text-fg transition-colors"
          onclick={() => { close(); setTimeout(onhelp, 300); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {$_('settings.help')}
        </button>
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 text-dim text-xs tracking-wide py-3 hover:text-fg transition-colors"
          onclick={() => { close(); setTimeout(onabout, 300); }}
        >
          <img src={iconAbout} alt="" class="w-4 h-4 icon-adapt opacity-50" />
          {$_('settings.about')}
        </button>
      </div>
    </div>
  </div>
</div>
