<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { importBackupPreview, importBackupConfirm, type BackupPreview } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import { inputClass, btnPrimary, btnSecondary } from "$lib/styles";
  import { getErrorMessage } from "$lib/utils/error";
  import iconFile from "$lib/assets/icons/file.svg";
  import iconPassword from "$lib/assets/icons/password.svg";
  import Modal from "./Modal.svelte";

  let { onclose, onsuccess }: { onclose: () => void; onsuccess: () => void } = $props();

  let fileData: number[] | null = $state(null);
  let fileName = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);
  let preview: BackupPreview | null = $state(null);

  const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50 MB

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_SIZE) {
      error = $_('errors.backupFileTooLarge');
      return;
    }
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      fileData = Array.from(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(file);
  }

  async function handlePreview() {
    if (!fileData || !password) return;
    error = "";
    loading = true;
    try {
      preview = await importBackupPreview(fileData, password);
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!fileData) return;
    loading = true;
    error = "";
    try {
      const added = await importBackupConfirm(fileData, password);
      toast($_('backupImport.imported', { values: { count: added.length } }));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

</script>

<Modal onclose={onclose} title={$_('backupImport.title')} titleId="import-backup-title">
  {#snippet children({ close })}
    {#if error}
      <div role="alert" class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    {#if !preview}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => { e.preventDefault(); handlePreview(); }}
      >
        <div>
          <label for="backup-file" class="flex items-center gap-1.5 text-sm text-dim tracking-wide mb-1.5">
            <img src={iconFile} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
            {$_('backupImport.fileLabel')}
          </label>
          <label class="block border border-dotted border-border px-3 py-2.5 text-base text-dim hover:border-fg/30 transition-colors cursor-pointer">
            {fileName || $_('backupImport.filePlaceholder')}
            <input
              id="backup-file"
              type="file"
              accept=".ghostauth"
              class="hidden"
              onchange={handleFileSelect}
            />
          </label>
        </div>
        <div>
          <label for="import-password" class="flex items-center gap-1.5 text-sm text-dim tracking-wide mb-1.5">
            <img src={iconPassword} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
            {$_('backupImport.passwordLabel')}
          </label>
          <input
            id="import-password"
            type="password"
            bind:value={password}
            placeholder={$_('backupImport.passwordPlaceholder')}
            class={inputClass}
          />
        </div>

        <div class="flex gap-2 mt-3">
          <button type="button" class={btnSecondary} onclick={close}>
            {$_('common.cancel')}
          </button>
          <button type="submit" disabled={loading || !fileData || !password} class="{btnPrimary} disabled:opacity-30">
            {loading ? $_('common.loading') : $_('backupImport.decrypt')}
          </button>
        </div>
      </form>
    {:else}
      <div class="mb-4">
        <p class="text-sm text-muted mb-3">
          {$_('backupImport.accountsFound', { values: { total: preview.accounts.length + preview.duplicates } })}{#if preview.duplicates > 0}{$_('backupImport.duplicatesExist', { values: { count: preview.duplicates } })}{/if}.
        </p>
        {#if preview.accounts.length === 0}
          <p class="text-sm text-dim">{$_('backupImport.allExist')}</p>
        {:else}
          <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {#each preview.accounts as account}
              <div class="border border-dotted border-border px-4 py-2.5">
                <div class="text-sm text-fg">{account.issuer}</div>
                <div class="text-xs text-dim">{account.label}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex gap-2">
        <button type="button" class={btnSecondary} onclick={() => { preview = null; error = ""; }}>
          {$_('common.back')}
        </button>
        <button type="button" disabled={loading || preview.accounts.length === 0} class="{btnPrimary} disabled:opacity-30" onclick={handleConfirm}>
          {loading ? $_('common.loading') : $_('common.import')}
        </button>
      </div>
    {/if}
  {/snippet}
</Modal>
