<script lang="ts">
  import "$lib/styles/app.css";
  import ghostLogo from "$lib/assets/ghost.svg";
  import {
    storage,
    getAccounts,
    getCodes,
    loadAccounts,
    refreshCodes,
    deleteAccount,
    reorderAccounts,
    type AccountDisplay,
    getCrashReportingPreference,
    setCrashReportingPreference,
    addAccountFromUri,
  } from "$lib/stores/accounts.svelte";
  import { getBrowserStorage } from "$core/browser";
  import AccountList from "$lib/components/AccountList.svelte";
  import AddAccount from "$lib/components/AddAccount.svelte";
  import EditAccount from "$lib/components/EditAccount.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import BackupExport from "$lib/components/BackupExport.svelte";
  import BackupImport from "$lib/components/BackupImport.svelte";
  import LockScreen from "$lib/components/LockScreen.svelte";
  import PinSetup from "$lib/components/PinSetup.svelte";
  import PinRemove from "$lib/components/PinRemove.svelte";
  import SyncConnect from "$lib/components/SyncConnect.svelte";
  import SyncQrGenerate from "$lib/components/SyncQrGenerate.svelte";
  import Help from "$lib/components/Help.svelte";
  import About from "$lib/components/About.svelte";
  import ExportQr from "$lib/components/ExportQr.svelte";
  import ImportExternal from "$lib/components/ImportExternal.svelte";
  import CrashReportingInfo from "$lib/components/CrashReportingInfo.svelte";
  import LanguageSelect from "$lib/components/LanguageSelect.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { hasPin, verifyPin } from "$core/pin";
  import { STORAGE_KEYS } from "$core/constants";
  import { inputClass } from "$lib/styles/styles";
  import { _ } from 'svelte-i18n';

  // App state machine: loading → setup (first use) → locked → pinLocked → main
  type AppState = "loading" | "setup" | "locked" | "main";
  let appState: AppState = $state("loading");

  // PIN lock (on top of master password unlock)
  let pinEnabled = $state(false);
  let pinLocked = $state(false);
  let pinColdLock = $state(false); // true when PIN needs to unwrap DEK (cold unlock)

  // Passwordless
  let passwordlessEnabled = $state(false);

  // Auto-lock
  let autoLockMinutes = $state(5);

  // Crash reporting
  let crashReportingEnabled = $state(false);

  // Overlay state
  let showAdd = $state(false);
  let showSettings = $state(false);
  let showBackupExport = $state(false);
  let showBackupImport = $state(false);
  let showPinSetup = $state(false);
  let showPinRemove = $state(false);
  let showSync = $state(false);
  let showQrSync = $state(false);
  let showHelp = $state(false);
  let showAbout = $state(false);
  let showLanguageSelect = $state(false);
  let showExportQr = $state(false);
  let showImportExternal = $state(false);
  let showCrashReportingInfo = $state(false);
  let editingAccount: AccountDisplay | null = $state(null);

  // Search
  let search = $state("");
  let searchInput: HTMLInputElement | undefined = $state(undefined);

  $effect(() => {
    if (searchInput && !pinLocked) {
      searchInput.focus();
    }
  });

  // Password fields
  let password = $state("");
  let confirmPassword = $state("");
  let passwordError = $state("");
  let passwordLoading = $state(false);

  // Code refresh interval
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  let accounts = $derived(getAccounts());
  let codes = $derived(getCodes());

  const browserRuntime = (globalThis as any).browser?.runtime ?? (globalThis as any).chrome?.runtime;

  // Initialize on mount
  $effect(() => {
    init();
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });

  $effect(() => {
    getCrashReportingPreference().then(v => { crashReportingEnabled = v; }).catch(() => {});
  });

  // Check for pending QR scan result (from content script)
  $effect(() => {
    if (appState !== "main" || pinLocked) return;
    const bs = getBrowserStorage();
    bs.session?.get("ghost_pending_qr").then(async (result: { [key: string]: unknown }) => {
      const uri = result?.ghost_pending_qr as string | undefined;
      if (!uri) return;
      await bs.session!.remove("ghost_pending_qr");
      try {
        await addAccountFromUri(uri);
        refreshCodes();
      } catch { /* invalid URI — silently ignore */ }
    }).catch(() => {});
  });

  async function init() {
    try {
      const initialized = await storage.isInitialized();
      if (!initialized) {
        appState = "setup";
        return;
      }

      // Try to restore session (DEK cached in chrome.storage.session)
      const restored = await storage.tryRestoreSession();
      if (restored) {
        await loadAccounts();
        pinEnabled = await hasPin();
        passwordlessEnabled = await storage.isPasswordless();
        // Session still active — auto-lock hasn't fired yet.
        // Go straight to main view regardless of PIN setting.
        appState = "main";
        startRefresh();
        resetAutoLock();
        loadAutoLockSetting();
        return;
      }

      // Session expired — check alternative unlock methods

      // Passwordless: auto-restore DEK without credentials
      if (await storage.isPasswordless()) {
        const ok = await storage.tryPasswordlessRestore();
        if (ok) {
          await loadAccounts();
          passwordlessEnabled = true;
          pinEnabled = false;
          appState = "main";
          startRefresh();
          resetAutoLock();
          loadAutoLockSetting();
          return;
        }
      }

      // PIN-wrapped DEK: show PIN screen for cold unlock
      if (await storage.hasPinWrappedDek()) {
        pinEnabled = true;
        pinLocked = true;
        pinColdLock = true;
        appState = "main";
        loadAutoLockSetting();
        return;
      }

      // Fallback: master password
      appState = "locked";
    } catch (e) {
      console.error("Init failed:", e);
      appState = "setup";
    }
  }

  async function loadAutoLockSetting() {
    try {
      if (browserRuntime) {
        const resp = await browserRuntime.sendMessage({ type: "get-auto-lock-timeout" });
        if (resp?.minutes !== undefined) autoLockMinutes = resp.minutes;
      }
    } catch {
      // Service worker might not be available
    }
  }

  async function handleSetup() {
    passwordError = "";
    if (password.length < 8) {
      passwordError = $_('ext.setup.passwordTooShort');
      return;
    }
    if (!/\d/.test(password)) {
      passwordError = $_('ext.setup.passwordNeedsNumber');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      passwordError = $_('ext.setup.passwordNeedsSpecial');
      return;
    }
    if (password !== confirmPassword) {
      passwordError = $_('ext.setup.passwordMismatch');
      return;
    }
    passwordLoading = true;
    try {
      await storage.initialize(password);
      await loadAccounts();
      password = "";
      confirmPassword = "";
      appState = "main";
      startRefresh();
      resetAutoLock();
    } catch (e) {
      passwordError = String(e);
    } finally {
      passwordLoading = false;
    }
  }

  async function handleUnlock() {
    passwordError = "";
    if (!password) {
      passwordError = $_('ext.unlock.enterPassword');
      return;
    }
    passwordLoading = true;
    try {
      const ok = await storage.unlock(password);
      if (!ok) {
        passwordError = $_('ext.unlock.wrongPassword');
        passwordLoading = false;
        return;
      }
      await loadAccounts();
      password = "";
      pinEnabled = await hasPin();
      passwordlessEnabled = await storage.isPasswordless();
      appState = "main";
      startRefresh();
      resetAutoLock();
      loadAutoLockSetting();
    } catch (e) {
      passwordError = String(e);
    } finally {
      passwordLoading = false;
    }
  }

  function handlePinUnlock() {
    pinLocked = false;
    pinColdLock = false;
    startRefresh();
    resetAutoLock();
  }

  async function handlePinColdUnlock(pin: string): Promise<boolean> {
    // Verify PIN hash first (enforces rate limiting)
    const pinOk = await verifyPin(pin);
    if (!pinOk) return false;
    // Unwrap DEK using PIN-derived key
    const dekOk = await storage.unwrapDekWithPin(pin);
    if (dekOk) {
      await loadAccounts();
      passwordlessEnabled = await storage.isPasswordless();
    }
    return dekOk;
  }

  function handlePasswordFallback() {
    pinLocked = false;
    pinColdLock = false;
    appState = "locked";
  }

  function handleLock() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    storage.lock();
    clearAutoLock();
    closeAllOverlays();
    appState = "locked";
    password = "";
    passwordError = "";
    pinLocked = false;
    pinColdLock = false;
    // Re-init to route to correct unlock screen (PIN/passwordless/password)
    init();
  }

  function startRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      refreshCodes();
    }, 1000);
  }

  // ── Auto-lock ──

  function resetAutoLock() {
    try {
      browserRuntime?.sendMessage({ type: "reset-auto-lock" });
    } catch {
      // Ignore if service worker not available
    }
  }

  function clearAutoLock() {
    try {
      browserRuntime?.sendMessage({ type: "clear-auto-lock" });
    } catch {
      // Ignore
    }
  }

  async function handleAutoLockChange(minutes: number) {
    autoLockMinutes = minutes;
    try {
      if (browserRuntime) {
        await browserRuntime.sendMessage({ type: "set-auto-lock-timeout", minutes });
      }
    } catch {
      // Ignore
    }
  }

  // ── Overlay helpers ──

  function closeAllOverlays() {
    showAdd = false;
    showSettings = false;
    showBackupExport = false;
    showBackupImport = false;
    showPinSetup = false;
    showPinRemove = false;
    showSync = false;
    showQrSync = false;
    showHelp = false;
    showAbout = false;
    showLanguageSelect = false;
    showExportQr = false;
    showImportExternal = false;
    showCrashReportingInfo = false;
    editingAccount = null;
  }

  // ── Account handlers ──

  async function handleDelete(id: string) {
    await deleteAccount(id);
  }

  function handleEdit(account: AccountDisplay) {
    editingAccount = account;
  }

  async function handleReorder(ids: string[]) {
    await reorderAccounts(ids);
  }

  function handleAddSuccess() {
    showAdd = false;
    refreshCodes();
  }

  function handleEditSuccess() {
    editingAccount = null;
  }

  // ── PIN handlers ──

  function handlePinToggle() {
    if (pinEnabled) {
      showPinRemove = true;
    } else {
      showPinSetup = true;
    }
  }

  async function handlePinSetupDone() {
    showPinSetup = false;
    pinEnabled = true;
    // PIN and passwordless are mutually exclusive
    if (passwordlessEnabled) {
      await storage.setPasswordless(false);
      passwordlessEnabled = false;
    }
    showSettings = false;
  }

  function handlePinRemoved() {
    showPinRemove = false;
    pinEnabled = false;
    showSettings = false;
  }

  // ── Passwordless handler ──

  function handleCrashReportingToggle() {
    crashReportingEnabled = !crashReportingEnabled;
    setCrashReportingPreference(crashReportingEnabled).catch(() => {});
  }

  async function handlePasswordlessToggle(enabled: boolean) {
    if (enabled) {
      await storage.setPasswordless(true);
      passwordlessEnabled = true;
      // Passwordless and PIN are mutually exclusive
      if (pinEnabled) {
        try {
          const bs = (globalThis as any).browser?.storage ?? chrome.storage;
          await bs.local.remove([STORAGE_KEYS.pinHash, STORAGE_KEYS.pinRateLimit, "ghost_pin_recovery"]);
          await storage.clearPinWrappedDek();
        } catch { /* ignore */ }
        pinEnabled = false;
      }
    } else {
      await storage.setPasswordless(false);
      passwordlessEnabled = false;
    }
  }
</script>

<div class="min-h-[760px] flex flex-col">
  {#if appState === "loading"}
    <!-- Loading splash -->
    <div class="flex-1 flex flex-col items-center justify-center splash-fade-in">
      <img src={ghostLogo} alt="Ghost Auth" class="w-16 h-16 icon-adapt opacity-40 mb-6" />
      <h1 class="text-xs uppercase tracking-[0.25em] text-fg/80 mb-1.5">{$_('ext.header.title')}</h1>
      <p class="text-[9px] uppercase tracking-[0.2em] text-dim">{$_('ext.header.subtitle')}</p>
    </div>

  {:else if appState === "setup"}
    <!-- First-time setup -->
    <div class="fixed inset-0 flex flex-col items-center justify-center px-6">
      <img src={ghostLogo} alt="Ghost Auth" class="w-12 h-12 icon-adapt opacity-40 mb-6" />
      <h1 class="text-base text-muted tracking-wide mb-1">{$_('ext.setup.heading')}</h1>
      <p class="text-xs text-dim mb-6">{$_('ext.setup.description')}</p>

      {#if passwordError}
        <div class="w-full border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-xs animate-shake">
          <span class="text-error/60">{$_('common.errorPrefix')}</span> {passwordError}
        </div>
      {/if}

      <form
        class="w-full flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); handleSetup(); }}
      >
        <input
          type="password"
          bind:value={password}
          placeholder={$_('ext.setup.passwordPlaceholder')}
          class={inputClass}
          autocomplete="new-password"
        />
        <input
          type="password"
          bind:value={confirmPassword}
          placeholder={$_('ext.setup.confirmPlaceholder')}
          class={inputClass}
          autocomplete="new-password"
        />
        <button
          type="submit"
          disabled={passwordLoading}
          class="w-full border border-fg/80 text-fg text-sm py-2.5 hover:bg-fg hover:text-bg transition-colors disabled:opacity-30 mt-2"
        >
          {passwordLoading ? $_('ext.setup.encrypting') : $_('ext.setup.createVault')}
        </button>
      </form>
    </div>

  {:else if appState === "locked"}
    <!-- Unlock screen -->
    <div class="fixed inset-0 flex flex-col items-center justify-center px-6">
      <img src={ghostLogo} alt="Ghost Auth" class="w-12 h-12 icon-adapt opacity-40 mb-6" />
      <h1 class="text-base text-muted tracking-wide mb-6">{$_('ext.unlock.title')}</h1>

      {#if passwordError}
        <div class="w-full border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-xs animate-shake">
          <span class="text-error/60">{$_('common.errorPrefix')}</span> {passwordError}
        </div>
      {/if}

      <form
        class="w-full flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); handleUnlock(); }}
      >
        <input
          type="password"
          bind:value={password}
          placeholder={$_('ext.unlock.placeholder')}
          class={inputClass}
          autocomplete="current-password"
        />
        <button
          type="submit"
          disabled={passwordLoading}
          class="w-full border border-fg/80 text-fg text-sm py-2.5 hover:bg-fg hover:text-bg transition-colors disabled:opacity-30"
        >
          {passwordLoading ? $_('ext.unlock.decrypting') : $_('ext.unlock.unlock')}
        </button>
      </form>
    </div>

  {:else}
    <!-- Main view (may have PIN lock overlay on top) -->
    {#if pinLocked}
      <LockScreen
        onunlock={handlePinUnlock}
        onsubmitpin={pinColdLock ? handlePinColdUnlock : undefined}
        onpasswordfallback={pinColdLock ? handlePasswordFallback : undefined}
        onrecoveryused={pinColdLock ? handlePasswordFallback : undefined}
      />
    {:else}
      <main class="bg-bg text-fg fixed inset-0 flex flex-col">
        <!-- Header -->
        <header class="bg-bg/90 backdrop-blur-sm border-dotted-b z-10">
          <div class="flex items-center justify-between px-4 py-3.5">
            <div class="flex items-center gap-2.5">
              <img src={ghostLogo} alt="" class="w-6 h-6 icon-adapt opacity-80" />
              <div class="flex flex-col">
                <span class="text-sm uppercase tracking-[0.2em] text-muted leading-none">{$_('ext.header.title')}</span>
                <span class="text-[8px] uppercase tracking-[0.2em] text-dim leading-none mt-0.5">{$_('ext.header.subtitle')}</span>
              </div>
            </div>
            <button
              type="button"
              class="text-dim hover:text-fg transition-colors p-1"
              onclick={() => showSettings = true}
              aria-label={$_('app.settingsAriaLabel')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </header>

        <!-- Scrollable content area -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div class="px-4" style="padding-bottom: 6rem;">
            <AccountList
              {accounts}
              {codes}
              ondelete={handleDelete}
              onedit={handleEdit}
              onreorder={handleReorder}
              {search}
            />
          </div>
        </div>

        <!-- Bottom fade -->
        <div class="fixed inset-x-0 bottom-0 z-10 pointer-events-none bottom-fade" aria-hidden="true"></div>

        <!-- Search bar (shown when > 3 accounts) -->
        {#if accounts.length > 3}
          <div class="fixed start-5 z-20 h-10 flex items-center search-bottom" style="inset-inline-end: calc(1.25rem + 3rem + 1.25rem + 0.5rem);">
            <input
              bind:this={searchInput}
              type="text"
              enterkeyhint="done"
              bind:value={search}
              placeholder={$_('app.searchPlaceholder')}
              aria-label={$_('app.searchPlaceholder')}
              class="w-full bg-bg/40 backdrop-blur-xl shadow-xl text-fg border border-border rounded-2xl px-4 py-2 text-sm outline-none focus:border-fg/40 transition-colors placeholder:text-dim"
            />
          </div>
        {/if}

        <!-- FAB -->
        <button
          type="button"
          class="fixed end-5 w-12 h-12 rounded-full border border-dim bg-bg/60 backdrop-blur-md shadow-lg text-fg flex items-center justify-center text-xl font-semibold z-20 hover:border-fg/30 active:scale-95 transition-all cursor-pointer fab-bottom"
          onclick={() => showAdd = true}
          aria-label={$_('app.addAccountAriaLabel')}
        >+</button>
      </main>
    {/if}
  {/if}

  <!-- Overlays -->
  {#if showAdd}
    <AddAccount onclose={() => showAdd = false} onsuccess={handleAddSuccess} />
  {/if}

  {#if editingAccount}
    <EditAccount
      account={editingAccount}
      onclose={() => editingAccount = null}
      onsuccess={handleEditSuccess}
    />
  {/if}

  {#if showSettings}
    <Settings
      onclose={() => showSettings = false}
      onlock={handleLock}
      onexport={() => showBackupExport = true}
      onimport={() => showBackupImport = true}
      onimportexternal={() => showImportExternal = true}
      onexportqr={() => showExportQr = true}
      onpintoggle={handlePinToggle}
      onsync={() => showSync = true}
      onqrsync={() => showQrSync = true}
      onhelp={() => showHelp = true}
      onabout={() => showAbout = true}
      onlanguage={() => showLanguageSelect = true}
      {pinEnabled}
      {autoLockMinutes}
      onautolockchange={handleAutoLockChange}
      {passwordlessEnabled}
      onpasswordlesstoggle={handlePasswordlessToggle}
      {crashReportingEnabled}
      oncrashreportingtoggle={handleCrashReportingToggle}
      oncrashreportinginfo={() => showCrashReportingInfo = true}
    />
  {/if}

  {#if showBackupExport}
    <BackupExport onclose={() => showBackupExport = false} />
  {/if}

  {#if showBackupImport}
    <BackupImport
      onclose={() => showBackupImport = false}
      onsuccess={() => { showBackupImport = false; refreshCodes(); }}
    />
  {/if}

  {#if showPinSetup}
    <PinSetup
      onclose={() => showPinSetup = false}
      ondone={handlePinSetupDone}
      onwrapdek={(pin: string) => storage.wrapDekWithPin(pin)}
    />
  {/if}

  {#if showPinRemove}
    <PinRemove onclose={() => showPinRemove = false} ondone={handlePinRemoved} />
  {/if}

  {#if showSync}
    <SyncConnect
      onclose={() => showSync = false}
      onsuccess={() => { showSync = false; refreshCodes(); }}
    />
  {/if}

  {#if showQrSync}
    <SyncQrGenerate
      onclose={() => showQrSync = false}
      onsuccess={() => { showQrSync = false; refreshCodes(); }}
    />
  {/if}

  {#if showHelp}
    <Help onclose={() => showHelp = false} />
  {/if}

  {#if showAbout}
    <About onclose={() => showAbout = false} />
  {/if}

  {#if showLanguageSelect}
    <LanguageSelect onclose={() => showLanguageSelect = false} />
  {/if}

  {#if showExportQr}
    <ExportQr onclose={() => showExportQr = false} />
  {/if}

  {#if showCrashReportingInfo}
    <CrashReportingInfo onclose={() => showCrashReportingInfo = false} />
  {/if}

  {#if showImportExternal}
    <ImportExternal
      onclose={() => showImportExternal = false}
      onsuccess={() => { showImportExternal = false; refreshCodes(); }}
    />
  {/if}

  <Toast />
</div>
