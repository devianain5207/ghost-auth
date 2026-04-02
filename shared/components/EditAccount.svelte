<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { toast } from "$shared/stores/toast";
  import { inputClass, btnPrimary, btnSecondary } from "$shared/styles";
  import { getErrorMessage } from "$shared/utils/error";
  import Modal from "./Modal.svelte";

  let {
    account,
    onclose,
    onsuccess,
    editAccount,
  }: {
    account: { id: string; issuer: string; label: string };
    onclose: () => void;
    onsuccess: () => void;
    editAccount: (id: string, issuer: string, label: string) => Promise<void>;
  } = $props();

  // svelte-ignore state_referenced_locally — intentional: editable copies of prop values
  let issuer = $state(account.issuer);
  // svelte-ignore state_referenced_locally
  let label = $state(account.label);
  let error = $state("");
  let loading = $state(false);

  async function handleSave() {
    error = "";
    loading = true;
    try {
      await editAccount(account.id, issuer.trim(), label.trim());
      toast($_('editAccount.updated'));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }
</script>

<Modal onclose={onclose} title={$_('editAccount.title')} titleId="edit-account-title">
  {#snippet children({ close })}
    {#if error}
      <div role="alert" class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-xs">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => { e.preventDefault(); handleSave(); }}
    >
      <div>
        <label for="edit-issuer" class="block text-xs text-dim tracking-wide mb-1.5">{$_('editAccount.serviceLabel')}</label>
        <input
          id="edit-issuer"
          type="text"
          bind:value={issuer}
          maxlength={255}
          placeholder={$_('editAccount.servicePlaceholder')}
          class={inputClass}
        />
      </div>
      <div>
        <label for="edit-label" class="block text-xs text-dim tracking-wide mb-1.5">{$_('editAccount.accountLabel')}</label>
        <input
          id="edit-label"
          type="text"
          bind:value={label}
          maxlength={255}
          placeholder={$_('editAccount.accountPlaceholder')}
          class={inputClass}
        />
      </div>

      <div class="flex gap-2 mt-3">
        <button type="button" class={btnSecondary} onclick={close}>
          {$_('common.cancel')}
        </button>
        <button type="submit" disabled={loading} class="{btnPrimary} disabled:opacity-30">
          {loading ? $_('common.loading') : $_('common.save')}
        </button>
      </div>
    </form>
  {/snippet}
</Modal>
