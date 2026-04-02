<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { syncConfirm, type MergePreview, type MergeDecision } from "$lib/stores/accounts";
  import { toast } from "$lib/stores/toast";
  import { btnPrimary, btnSecondary } from "$lib/styles";
  import { getErrorMessage } from "$lib/utils/error";

  let {
    mergePreview,
    oncancel,
    onsuccess,
  }: {
    mergePreview: MergePreview;
    oncancel: () => void;
    onsuccess: () => void;
  } = $props();

  let decisions: Map<string, string> = $state(new Map());
  let loading = $state(false);
  let error = $state("");

  function setDecision(id: string, action: string) {
    decisions = new Map(decisions);
    decisions.set(id, action);
  }

  async function handleConfirm() {
    loading = true;
    error = "";
    try {
      const decs: MergeDecision[] = [];
      for (const [id, action] of decisions) {
        decs.push({ account_id: id, action });
      }
      const result = await syncConfirm(decs);
      const parts = [];
      if (result.added > 0) parts.push($_('sync.toastAdded', { values: { count: result.added } }));
      if (result.updated > 0) parts.push($_('sync.toastUpdated', { values: { count: result.updated } }));
      if (result.deleted > 0) parts.push($_('sync.toastDeleted', { values: { count: result.deleted } }));
      toast($_('sync.toastSynced', { values: { summary: parts.join(", ") || $_('sync.toastNoChanges') } }));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if error}
    <div class="border border-dotted border-error/30 text-error px-3 py-2 text-sm">
      <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
    </div>
  {/if}

  {#if mergePreview.to_add.length > 0}
    <div>
      <p class="text-sm text-dim tracking-wide mb-2">
        {$_('sync.newAccounts', { values: { count: mergePreview.to_add.length } })}
      </p>
      <div class="flex flex-col gap-1">
        {#each mergePreview.to_add as account}
          <div class="border border-dotted border-border px-4 py-2.5">
            <div class="text-sm text-fg">{account.issuer}</div>
            <div class="text-xs text-dim">{account.label}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if mergePreview.auto_updated.length > 0}
    <div>
      <p class="text-sm text-dim tracking-wide mb-2">
        {$_('sync.autoUpdated', { values: { count: mergePreview.auto_updated.length } })}
      </p>
      <div class="flex flex-col gap-1">
        {#each mergePreview.auto_updated as account}
          <div class="border border-dotted border-border px-4 py-2.5">
            <div class="text-sm text-fg">{account.issuer}</div>
            <div class="text-xs text-dim">{account.label}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if mergePreview.conflicts.length > 0}
    <div>
      <p class="text-sm text-dim tracking-wide mb-2">
        {$_('sync.conflicts', { values: { count: mergePreview.conflicts.length } })}
      </p>
      <div class="flex flex-col gap-2">
        {#each mergePreview.conflicts as conflict}
          <div class="border border-dotted border-border px-4 py-3">
            <div class="flex gap-3 mb-2">
              <div class="flex-1">
                <div class="text-xs text-dim mb-1">{$_('sync.thisDevice')}</div>
                <div class="text-sm text-fg">{conflict.local.issuer}</div>
                <div class="text-xs text-dim">{conflict.local.label}</div>
              </div>
              <div class="flex-1">
                <div class="text-xs text-dim mb-1">{$_('sync.otherDevice')}</div>
                <div class="text-sm text-fg">{conflict.remote.issuer}</div>
                <div class="text-xs text-dim">{conflict.remote.label}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(conflict.account_id) === 'keep_local' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                onclick={() => setDecision(conflict.account_id, "keep_local")}
              >
                {$_('sync.keepThis')}
              </button>
              <button
                type="button"
                class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(conflict.account_id) === 'keep_remote' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                onclick={() => setDecision(conflict.account_id, "keep_remote")}
              >
                {$_('sync.keepOther')}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if mergePreview.to_delete.length > 0}
    <div>
      <p class="text-sm text-dim tracking-wide mb-2">
        {$_('sync.deletedOnOther', { values: { count: mergePreview.to_delete.length } })}
      </p>
      <div class="flex flex-col gap-2">
        {#each mergePreview.to_delete as account}
          <div class="border border-dotted border-border px-4 py-3">
            <div class="text-sm text-fg mb-2">
              {account.issuer}
              <span class="text-dim">/ {account.label}</span>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(account.id) !== 'delete' ? 'border-fg/80 text-fg' : 'border-dotted border-border text-dim hover:text-fg'}"
                onclick={() => setDecision(account.id, "keep_local")}
              >
                {$_('sync.keep')}
              </button>
              <button
                type="button"
                class="flex-1 text-xs py-1.5 border transition-colors {decisions.get(account.id) === 'delete' ? 'border-error/80 text-error' : 'border-dotted border-border text-dim hover:text-error'}"
                onclick={() => setDecision(account.id, "delete")}
              >
                {$_('common.delete')}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if mergePreview.unchanged > 0}
    <p class="text-sm text-dim">
      {$_('sync.unchanged', { values: { count: mergePreview.unchanged } })}
    </p>
  {/if}

  <div class="flex gap-2 mt-2">
    <button type="button" class={btnSecondary} onclick={oncancel}>
      {$_('common.cancel')}
    </button>
    <button
      type="button"
      disabled={loading}
      class="{btnPrimary} disabled:opacity-30"
      onclick={handleConfirm}
    >
      {loading ? $_('common.loading') : $_('sync.applySync')}
    </button>
  </div>
</div>
