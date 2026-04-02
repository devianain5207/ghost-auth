<script lang="ts">
  import SharedEditAccount from "$shared/components/EditAccount.svelte";
  import { editAccount as doEditAccount, type AccountDisplay } from "$lib/stores/accounts.svelte";

  let {
    account,
    onclose,
    onsuccess,
  }: {
    account: AccountDisplay;
    onclose: () => void;
    onsuccess: () => void;
  } = $props();
</script>
<SharedEditAccount
  {account}
  {onclose}
  {onsuccess}
  editAccount={(id, issuer, label) => doEditAccount(id, issuer, label)}
/>
