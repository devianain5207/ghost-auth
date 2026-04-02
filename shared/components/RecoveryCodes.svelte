<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { toast } from "$shared/stores/toast";

  let {
    codes,
    ondone,
    copyToClipboard,
  }: {
    codes: string[];
    ondone: () => void;
    copyToClipboard: (text: string) => Promise<void>;
  } = $props();

  async function copyAll() {
    try {
      await copyToClipboard(codes.join("\n"));
      toast($_('recoveryCodes.copied'));
    } catch {
      toast($_('accountCard.copyFailed'));
    }
  }

  function downloadAsFile() {
    try {
      const text = codes.join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ghost-auth-recovery-codes.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast($_('recoveryCodes.downloaded'));
    } catch {
      toast($_('accountCard.copyFailed'));
    }
  }
</script>

<div class="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center select-none pt-safe pb-safe">
  <span class="text-base text-muted tracking-wide mb-3">{$_('recoveryCodes.title')}</span>

  <p class="text-sm text-dim max-w-xs text-center mb-8 px-4 leading-relaxed">
    {$_('recoveryCodes.description')}
  </p>

  <ol class="grid grid-cols-2 gap-x-8 gap-y-3 mb-8 list-none p-0 m-0" role="list">
    {#each codes as code, i}
      <li class="flex items-center gap-2">
        <span class="text-sm text-dim w-4 text-end" aria-hidden="true">{i + 1}.</span>
        <span class="text-xl text-fg tracking-widest">{code}</span>
      </li>
    {/each}
  </ol>

  <div class="flex gap-3 mb-4">
    <button
      type="button"
      class="text-sm text-dim border border-dotted border-border px-5 py-3 hover:text-fg hover:border-fg/30 transition-colors"
      onclick={copyAll}
    >
      {$_('recoveryCodes.copyAll')}
    </button>
    <button
      type="button"
      class="text-sm text-dim border border-dotted border-border px-5 py-3 hover:text-fg hover:border-fg/30 transition-colors"
      onclick={downloadAsFile}
    >
      {$_('recoveryCodes.download')}
    </button>
  </div>

  <button
    type="button"
    class="text-sm text-fg border border-fg/80 px-8 py-3 hover:bg-fg hover:text-bg transition-colors"
    onclick={ondone}
  >
    {$_('recoveryCodes.saved')}
  </button>
</div>
