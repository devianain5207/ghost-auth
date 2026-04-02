<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { exportBackup, exportBackupFile } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import iconPassword from "$lib/assets/icons/password.svg";
  import Modal from "./Modal.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let password = $state("");
  let confirm = $state("");
  let error = $state("");
  let loading = $state(false);

  function isMobile(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isIOS(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  async function handleExport(close: () => void) {
    error = "";
    if (password.length < 8) {
      error = $_('backupExport.passwordTooShort');
      return;
    }
    if (!/\d/.test(password)) {
      error = $_('backupExport.passwordNeedsNumber');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      error = $_('backupExport.passwordNeedsSpecial');
      return;
    }
    if (password !== confirm) {
      error = $_('backupExport.passwordMismatch');
      return;
    }
    loading = true;
    try {
      if (isMobile()) {
        // Mobile: export and save/share entirely in Rust to avoid JS byte-array roundtrip.
        await exportBackupFile(password);
        if (!isIOS()) toast($_('backupExport.savedToDownloads'));
      } else {
        // Desktop: trigger browser download
        const bytes = await exportBackup(password);
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ghost-auth-backup-${Date.now()}.ghostauth`;
        a.click();
        URL.revokeObjectURL(url);
        toast($_('backupExport.exported'));
      }
      close();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

</script>

<Modal onclose={onclose} title={$_('backupExport.title')} titleId="export-backup-title">
  {#snippet children({ close })}
    {#if error}
      <div role="alert" class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    <p class="text-sm text-muted mb-4">
      {$_('backupExport.description')}
    </p>

    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => { e.preventDefault(); handleExport(close); }}
    >
      <div>
        <label for="backup-password" class="flex items-center gap-1.5 text-sm text-dim tracking-wide mb-1.5">
          <img src={iconPassword} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
          {$_('backupExport.passwordLabel')}
        </label>
        <input
          id="backup-password"
          type="password"
          bind:value={password}
          placeholder={$_('backupExport.passwordPlaceholder')}
          class={inputClass}
        />
      </div>
      <div>
        <label for="backup-confirm" class="flex items-center gap-1.5 text-sm text-dim tracking-wide mb-1.5">
          <img src={iconPassword} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
          {$_('backupExport.confirmLabel')}
        </label>
        <input
          id="backup-confirm"
          type="password"
          bind:value={confirm}
          placeholder={$_('backupExport.confirmPlaceholder')}
          class={inputClass}
        />
      </div>

      <div class="flex gap-2 mt-3">
        <button type="button" class={btnSecondary} onclick={close}>
          {$_('common.cancel')}
        </button>
        <button type="submit" disabled={loading} class="{btnPrimary} disabled:opacity-30">
          {loading ? $_('common.loading') : $_('common.export')}
        </button>
      </div>
    </form>
  {/snippet}
</Modal>
