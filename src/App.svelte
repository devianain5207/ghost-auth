<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ghostLogo from "$lib/assets/ghost.svg";
  import AccountList from "$lib/components/AccountList.svelte";
  import AddAccount from "$lib/components/AddAccount.svelte";
  import LockScreen from "$lib/components/LockScreen.svelte";
  import PinSetup from "$lib/components/PinSetup.svelte";
  import PinRemove from "$lib/components/PinRemove.svelte";
  import BackupExport from "$lib/components/BackupExport.svelte";
  import BackupImport from "$lib/components/BackupImport.svelte";
  import ImportExternal from "$lib/components/ImportExternal.svelte";
  import SyncInitiate from "$lib/components/SyncInitiate.svelte";
  import SyncJoin from "$lib/components/SyncJoin.svelte";
  import SyncChoice from "$lib/components/SyncChoice.svelte";
  import SyncFromQr from "$lib/components/SyncFromQr.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import EditAccount from "$lib/components/EditAccount.svelte";
  import About from "$lib/components/About.svelte";
  import CrashReportingInfo from "$lib/components/CrashReportingInfo.svelte";
  import ICloudSyncInfo from "$lib/components/ICloudSyncInfo.svelte";
  import Help from "$lib/components/Help.svelte";
  import LanguageSelect from "$lib/components/LanguageSelect.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import ExportQr from "$lib/components/ExportQr.svelte";
  import BiometricPrompt from "$lib/components/BiometricPrompt.svelte";
  import NetworkPermission from "$lib/components/NetworkPermission.svelte";
  import { setupIosKeyboardHandling } from "$lib/utils/iosKeyboard";
  import { setupSafeAreaGuard } from "$lib/utils/safeAreaGuard";
  import { getErrorMessage } from "$lib/utils/error";
  import {
    getAccounts,
    generateAllCodes,
    deleteAccount,
    reorderAccounts,
    getCrashReportingPreference,
    setCrashReportingPreference,
    getICloudSyncStatus,
    enableICloudSync,
    disableICloudSync,
    pullICloudSync,
    resumeICloudSync,
    type AccountDisplay,
    type CodeResponse,
  } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import * as overlays from "$lib/stores/overlays.svelte";
  import * as auth from "$lib/stores/auth.svelte";

  // --- Local view-model state ---
  let accounts: AccountDisplay[] = $state([]);
  let codes: Map<string, CodeResponse> = $state(new Map());
  let error = $state("");
  let search = $state("");
  let codeRefreshFailures = $state(0);
  let crashReportingEnabled = $state(false);
  let icloudSyncEnabled = $state(false);
  let icloudSyncAvailable = $state(false);
  let icloudSyncBusy = $state(false);
  let icloudPullPending = $state(false);
  let icloudLastSyncedAt = $state(0);
  let importExternalFromAdd = $state(false);
  let pendingSyncTarget = '';

  function openSyncWithPermissionCheck(target: string) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isIOS || localStorage.getItem('ghost-auth-lan-permission') === 'granted') {
      overlays.open(target);
    } else {
      pendingSyncTarget = target;
      overlays.open('networkPermission');
    }
  }

  let filtered = $derived.by(() => {
    const s = search.trim().toLowerCase();
    return s
      ? accounts.filter((a) =>
          a.issuer.toLowerCase().includes(s) ||
          a.label.toLowerCase().includes(s)
        )
      : accounts;
  });

  // --- Helper: clear overlays using current auth visibility ---
  function clearOverlays() {
    overlays.clearAll(auth.isAppVisible());
  }

  // --- Data operations ---

  async function loadAccounts() {
    try {
      accounts = await getAccounts();
      error = "";
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  async function refreshCodes() {
    if (accounts.length === 0) return;
    try {
      const allCodes = await generateAllCodes();
      const map = new Map<string, CodeResponse>();
      for (const c of allCodes) {
        map.set(c.id, c);
      }
      codes = map;
      codeRefreshFailures = 0;
    } catch {
      codeRefreshFailures++;
      if (codeRefreshFailures >= 3) {
        error = $_('app.refreshCodesFailed');
      }
    }
  }

  /** Tick remaining counters down locally; only call the backend when a code expires. */
  function tickCodes() {
    let needsRefresh = false;
    const updated = new Map<string, CodeResponse>();
    for (const [id, c] of codes) {
      const remaining = c.remaining - 1;
      if (remaining <= 0) {
        needsRefresh = true;
        break;
      }
      updated.set(id, { ...c, remaining });
    }
    if (needsRefresh || codes.size === 0) {
      refreshCodes();
    } else {
      codes = updated;
    }
  }

  async function reloadData() {
    await loadAccounts();
    await refreshCodes();
  }

  // --- Event handlers ---

  async function handleDelete(id: string) {
    try {
      await deleteAccount(id);
      await reloadData();
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  async function handleAddSuccess() {
    overlays.close('add');
    await reloadData();
  }

  async function handleEditSuccess() {
    overlays.close('editAccount');
    await reloadData();
  }

  async function handleReorder(ids: string[]) {
    try {
      await reorderAccounts(ids);
      await reloadData();
    } catch (e) {
      error = getErrorMessage(e, $_);
    }
  }

  async function handleImportSuccess() {
    overlays.close('import');
    await reloadData();
  }

  async function handleImportExternalSuccess() {
    overlays.close('importExternal');
    await reloadData();
  }

  async function handleSyncSuccess(name: string) {
    overlays.close(name);
    await reloadData();
  }

  function handleEdit(account: AccountDisplay) {
    overlays.setEditingAccount(account);
    overlays.open('editAccount');
  }

  function handlePinRemoved() {
    auth.handlePinRemoved();
    overlays.closeMultiple('pinRemove', 'settings');
  }

  async function handlePinSetupDone() {
    const promptBiometric = await auth.handlePinSetupDone();
    if (promptBiometric) {
      overlays.swap('pinSetup', 'biometricPrompt');
    } else {
      overlays.closeMultiple('pinSetup', 'settings');
    }
  }

  function handleBiometricEnable() {
    auth.handleBiometricEnable();
    overlays.closeMultiple('biometricPrompt', 'settings');
  }

  function handleBiometricSkip() {
    auth.handleBiometricSkip();
    overlays.closeMultiple('biometricPrompt', 'settings');
  }

  function handleCrashReportingToggle() {
    crashReportingEnabled = !crashReportingEnabled;
    setCrashReportingPreference(crashReportingEnabled).catch(() => {});
  }

  async function handleUnlockWithPendingPull() {
    await auth.handleUnlock();
    if (icloudPullPending && icloudSyncEnabled) {
      try {
        const result = await pullICloudSync();
        icloudPullPending = false; // clear only on success
        const changed = result.added + result.updated + result.deleted;
        if (changed > 0) {
          await loadAccounts();
          icloudLastSyncedAt = Date.now() / 1000;
          toast($_('icloudSync.syncedToast', { values: { count: changed } }));
        }
      } catch {
        // Pull still failing — flag stays true, will retry on next unlock.
      }
    }
  }

  async function handleICloudSyncToggle() {
    if (icloudSyncBusy) return;
    icloudSyncBusy = true;
    try {
      if (icloudSyncEnabled) {
        await disableICloudSync();
        icloudSyncEnabled = false;
        icloudLastSyncedAt = 0;
        toast($_('icloudSync.disabledToast'));
      } else {
        const result = await enableICloudSync();
        icloudSyncEnabled = true;
        icloudLastSyncedAt = Date.now() / 1000;
        toast($_('icloudSync.enabledToast'));
        const restored = result.added + result.updated;
        if (restored > 0) {
          await loadAccounts();
          toast($_('icloudSync.restoredToast', { values: { count: restored } }));
        }
      }
    } catch (e) {
      toast(getErrorMessage(e));
    } finally {
      icloudSyncBusy = false;
    }
  }

  // --- Effects ---

  // Init: check PIN / auth status
  $effect(() => {
    auth.checkPin().then((dataRecovered) => {
      if (dataRecovered) {
        toast($_('app.dataRecoveredWarning'));
      }
    });
  });

  // Load crash reporting preference
  $effect(() => {
    getCrashReportingPreference().then(v => { crashReportingEnabled = v; }).catch(() => {});
  });

  // Load iCloud sync status and listen for remote changes
  $effect(() => {
    getICloudSyncStatus().then(async (status) => {
      icloudSyncAvailable = status.available;
      icloudSyncEnabled = status.enabled;
      icloudLastSyncedAt = status.last_synced_at;
      // Restart watcher + pull on mount (handles cold start / app resume).
      if (status.enabled) {
        try {
          const result = await resumeICloudSync();
          if (result.added > 0 || result.updated > 0 || result.deleted > 0) {
            await loadAccounts();
          } else if (auth.isLocked()) {
            // Resume skipped the pull because vault is locked — retry after unlock.
            icloudPullPending = true;
          }
        } catch (e) {
          icloudPullPending = true;
          console.warn("iCloud resume failed:", e);
        }
      }
    }).catch(() => {});

    // Listen for iCloud remote change events from the Swift plugin.
    // The event fires when another device pushes a new vault blob.
    let unlisten: (() => void) | undefined;
    let disposed = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (disposed) return; // effect cleaned up before listen resolved
      let debounceTimer: ReturnType<typeof setTimeout> | undefined;
      listen("plugin:icloud-sync://icloud-change", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          try {
            const result = await pullICloudSync();
            const changed = result.added + result.updated + result.deleted;
            if (changed > 0) {
              await loadAccounts();
              icloudLastSyncedAt = Date.now() / 1000;
              toast($_('icloudSync.syncedToast', { values: { count: changed } }));
            }
          } catch (e) {
            // If pull failed because vault is locked, flag for retry after unlock.
            icloudPullPending = true;
            console.warn("iCloud sync pull failed:", e);
          }
        }, 500);
      }).then(fn => {
        if (disposed) { fn(); } // effect already cleaned up — detach immediately
        else { unlisten = fn; }
      });
    }).catch(() => {});

    return () => { disposed = true; unlisten?.(); };
  });

  // Lock when the app goes to background (iOS / Android).
  // A short delay avoids false locks when a native file picker briefly
  // hides the document. If the app becomes visible again within the
  // grace period the lock is cancelled.
  $effect(() => {
    let lockTimer: ReturnType<typeof setTimeout> | null = null;

    function handleVisibilityChange() {
      if (document.hidden) {
        auth.setAppVisible(false);
        document.documentElement.style.setProperty('--keyboard-inset-bottom', '0px');
        if (auth.isPinEnabled() && !auth.isLocked() && !auth.isLoading()) {
          lockTimer = setTimeout(() => {
            if (document.hidden) {
              auth.lockApp(clearOverlays);
            }
          }, 800);
        }
      } else {
        if (lockTimer) {
          clearTimeout(lockTimer);
          lockTimer = null;
        }
        setTimeout(() => {
          auth.setAppVisible(true);
        }, 500);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (lockTimer) clearTimeout(lockTimer);
    };
  });

  // Android back button: close topmost overlay on popstate
  $effect(() => {
    function handlePopstate() {
      overlays.handlePopstate();
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  });

  // Lock body scroll when any overlay is open
  $effect(() => {
    document.documentElement.style.overflow = overlays.hasAny() ? 'hidden' : '';
  });

  // iOS keyboard handling
  $effect(() => {
    return setupIosKeyboardHandling();
  });

  // Android safe-area guard (prevents double-counted insets)
  $effect(() => {
    return setupSafeAreaGuard();
  });

  // Data loading, code refresh interval, and auto-lock
  $effect(() => {
    if (auth.isLocked() || auth.isLoading()) return;
    loadAccounts().then(() => refreshCodes());

    const interval = setInterval(() => {
      if (!auth.isAppVisible()) return;
      tickCodes();
    }, 1000);

    const onActivity = () => auth.resetAutoLock(clearOverlays);
    onActivity();
    const activityEvents = ["pointerdown", "keydown"] as const;
    for (const evt of activityEvents) {
      window.addEventListener(evt, onActivity);
    }

    return () => {
      clearInterval(interval);
      auth.stopAutoLock();
      for (const evt of activityEvents) {
        window.removeEventListener(evt, onActivity);
      }
    };
  });
</script>

{#if auth.isLoading()}
  <div class="min-h-screen bg-bg flex flex-col items-center justify-center select-none splash-fade-in">
    <img src={ghostLogo} alt="" class="w-16 h-16 icon-adapt opacity-40 mb-6" />
    <h1 class="text-sm uppercase tracking-[0.25em] text-fg/80 mb-2">{$_('app.title')}</h1>
    <p class="text-[0.625rem] uppercase tracking-[0.2em] text-dim">{$_('app.subtitle')}</p>
  </div>
{:else if auth.isLocked() && auth.isPinEnabled()}
  <LockScreen onunlock={handleUnlockWithPendingPull} biometricEnabled={auth.isBiometricEnabled()} />
{:else}
  <main class="bg-bg text-fg fixed inset-0 flex flex-col">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-10 bg-bg/90 backdrop-blur-sm border-dotted-b pt-safe">
      <div class="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src={ghostLogo} alt="" class="w-8 h-8 icon-adapt opacity-80" />
          <div class="flex flex-col">
            <span class="text-lg uppercase tracking-[0.2em] text-muted leading-none">{$_('app.headerTitle')}</span>
            <span class="text-[0.5625rem] uppercase tracking-[0.25em] text-dim leading-none mt-0.5">{$_('app.headerSubtitle')}</span>
          </div>
        </div>
        <button
          type="button"
          class="text-dim hover:text-fg transition-colors p-1"
          onclick={() => overlays.open('settings')}
          aria-label={$_('app.settingsAriaLabel')}
        >
          <svg class="w-5.5 h-5.5" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Scrollable content area -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <div class="pt-header"></div>
      <div class="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-5 pb-6 pt-2" style="padding-bottom: calc(var(--ga-safe-bottom, 0px) + 6rem);">
        {#if error}
          <div role="alert" class="border border-dotted border-error/30 text-error px-4 py-3 mb-5 text-xs">
            <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
          </div>
        {/if}
        {#if accounts.length === 0}
          <div class="flex flex-col items-center justify-center py-24 text-dim">
            <img src={ghostLogo} alt="" class="w-20 h-20 icon-adapt opacity-15 mb-8" />
            <p class="text-base text-muted">{$_('accountList.emptyTitle')}</p>
            <p class="text-base text-dim mt-1">{$_('accountList.emptyHint')}</p>
          </div>
        {:else if filtered.length === 0}
          <div class="flex flex-col items-center justify-center py-16 text-dim">
            <p class="text-xs text-muted">{$_('accountList.noMatches', { values: { search } })}</p>
          </div>
        {:else}
          <AccountList {accounts} {filtered} {codes} ondelete={handleDelete} onedit={handleEdit} onreorder={handleReorder} {search} />
        {/if}
      </div>
    </div>

    <!-- Bottom fade -->
    <div class="fixed inset-x-0 z-10 pointer-events-none bottom-fade" aria-hidden="true"></div>

    <!-- Search bar -->
    {#if accounts.length > 3}
      <div class="fixed start-6 z-20 h-12 flex items-center search-bottom" style="inset-inline-end: calc(1.5rem + 3rem + 1.5rem + 0.75rem);">
        <input
          type="text"
          enterkeyhint="done"
          bind:value={search}
          placeholder={$_('app.searchPlaceholder')}
          class="w-full bg-bg/40 backdrop-blur-xl shadow-xl text-fg border border-border rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-fg/40 transition-colors placeholder:text-dim"
        />
      </div>
    {/if}

    <!-- FAB: Add Account -->
    <button
      type="button"
      class="fixed end-6 w-12 h-12 rounded-full border border-dim bg-bg/60 backdrop-blur-md shadow-lg text-fg flex items-center justify-center text-xl font-semibold z-20 hover:border-fg/30 active:scale-95 transition-all cursor-pointer fab-bottom"
      onclick={() => overlays.open('add')}
      ontouchstart={() => {}}
      aria-label={$_('app.addAccountAriaLabel')}
    >
      +
    </button>

    {#if overlays.has('settings')}
      <Settings
        onclose={() => overlays.close('settings')}
        pinEnabled={auth.isPinEnabled()}
        biometricEnabled={auth.isBiometricEnabled()}
        biometricHardwareAvailable={auth.isBiometricHardwareAvailable()}
        onbiometrictoggle={auth.handleBiometricToggle}
        onpintoggle={() => { if (auth.isPinEnabled()) { overlays.open('pinRemove'); } else { overlays.open('pinSetup'); } }}
        onexport={() => overlays.open('export')}
        onimport={() => overlays.open('import')}
        onimportexternal={() => overlays.open('importExternal')}
        onexportqr={() => overlays.open('exportQr')}
        onsyncdevices={() => openSyncWithPermissionCheck('syncChoice')}
        onsynctoextension={() => openSyncWithPermissionCheck('syncToExtension')}
        onabout={() => overlays.open('about')}
        onhelp={() => overlays.open('help')}
        onlanguage={() => overlays.open('languageSelect')}
        crashReportingEnabled={crashReportingEnabled}
        oncrashreportingtoggle={handleCrashReportingToggle}
        oncrashreportinginfo={() => overlays.open('crashReportingInfo')}
        icloudSyncEnabled={icloudSyncEnabled}
        icloudSyncAvailable={icloudSyncAvailable}
        icloudSyncBusy={icloudSyncBusy}
        icloudLastSyncedAt={icloudLastSyncedAt}
        onicloudsynctoggle={handleICloudSyncToggle}
        onicloudsyncinfo={() => overlays.open('icloudSyncInfo')}
      />
    {/if}

    {#if overlays.has('add')}
      <AddAccount onclose={() => overlays.close('add')} onsuccess={handleAddSuccess} onmigration={(data) => { overlays.setMigrationData(data); importExternalFromAdd = true; overlays.swap('add', 'importExternal'); }} onimportexternal={() => { importExternalFromAdd = true; overlays.swap('add', 'importExternal'); }} onscanstart={() => overlays.open('scanning')} onscanend={() => overlays.close('scanning')} />
    {/if}

    {#if overlays.getEditingAccount()}
      <EditAccount
        account={overlays.getEditingAccount()!}
        onclose={() => overlays.close('editAccount')}
        onsuccess={handleEditSuccess}
      />
    {/if}

    {#if overlays.has('pinSetup')}
      <PinSetup onclose={() => overlays.close('pinSetup')} ondone={handlePinSetupDone} />
    {/if}

    {#if overlays.has('pinRemove')}
      <PinRemove onclose={() => overlays.close('pinRemove')} ondone={handlePinRemoved} />
    {/if}

    {#if overlays.has('export')}
      <BackupExport onclose={() => overlays.close('export')} />
    {/if}

    {#if overlays.has('import')}
      <BackupImport onclose={() => overlays.close('import')} onsuccess={handleImportSuccess} />
    {/if}

    {#if overlays.has('importExternal')}
      <ImportExternal initialData={overlays.getMigrationData()} onclose={() => { importExternalFromAdd = false; overlays.close('importExternal'); }} onback={importExternalFromAdd ? () => { importExternalFromAdd = false; overlays.swap('importExternal', 'add'); } : undefined} onsuccess={handleImportExternalSuccess} onscanstart={() => overlays.open('scanning')} onscanend={() => overlays.close('scanning')} />
    {/if}

    {#if overlays.has('networkPermission')}
      <NetworkPermission
        onclose={() => { pendingSyncTarget = ''; overlays.close('networkPermission'); }}
        ongranted={() => {
          const target = pendingSyncTarget;
          pendingSyncTarget = '';
          overlays.swap('networkPermission', target);
        }}
      />
    {/if}

    {#if overlays.has('syncChoice')}
      <SyncChoice
        onclose={() => overlays.close('syncChoice')}
        onsyncto={() => overlays.open('syncJoin')}
        onsyncfrom={() => overlays.open('syncInitiate')}
      />
    {/if}

    {#if overlays.has('syncInitiate')}
      <SyncInitiate onclose={() => overlays.close('syncInitiate')} onsuccess={() => handleSyncSuccess('syncInitiate')} onscanstart={() => overlays.open('scanning')} onscanend={() => overlays.close('scanning')} />
    {/if}

    {#if overlays.has('syncJoin')}
      <SyncJoin onclose={() => overlays.close('syncJoin')} onsuccess={() => handleSyncSuccess('syncJoin')} onscanstart={() => overlays.open('scanning')} onscanend={() => overlays.close('scanning')} />
    {/if}

    {#if overlays.has('syncToExtension')}
      <SyncFromQr onclose={() => overlays.close('syncToExtension')} onsuccess={() => handleSyncSuccess('syncToExtension')} onscanstart={() => overlays.open('scanning')} onscanend={() => overlays.close('scanning')} />
    {/if}

    {#if overlays.has('exportQr')}
      <ExportQr onclose={() => overlays.close('exportQr')} />
    {/if}

    {#if overlays.has('about')}
      <About onclose={() => overlays.close('about')} />
    {/if}

    {#if overlays.has('help')}
      <Help onclose={() => overlays.close('help')} />
    {/if}

    {#if overlays.has('crashReportingInfo')}
      <CrashReportingInfo onclose={() => overlays.close('crashReportingInfo')} />
    {/if}

    {#if overlays.has('icloudSyncInfo')}
      <ICloudSyncInfo onclose={() => overlays.close('icloudSyncInfo')} />
    {/if}

    {#if overlays.has('languageSelect')}
      <LanguageSelect onclose={() => overlays.close('languageSelect')} />
    {/if}

    {#if overlays.has('biometricPrompt')}
      <BiometricPrompt
        onenable={handleBiometricEnable}
        onskip={handleBiometricSkip}
      />
    {/if}
  </main>
{/if}

<Toast />
