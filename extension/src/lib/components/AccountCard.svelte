<script lang="ts">
  import type { AccountDisplay, CodeResponse } from "$lib/stores/accounts.svelte";
  import CountdownRing from "./CountdownRing.svelte";
  import { toast } from "$lib/stores/toast";
  import { _ } from 'svelte-i18n';

  let {
    account,
    code,
    ondelete,
    onedit,
    dragging = false,
  }: {
    account: AccountDisplay;
    code: CodeResponse | undefined;
    ondelete: (id: string) => void;
    onedit: (account: AccountDisplay) => void;
    dragging?: boolean;
  } = $props();

  let showActions = $state(false);
  let showConfirm = $state(false);
  let clipboardTimer: ReturnType<typeof setTimeout> | null = null;

  function formatCode(raw: string): string {
    if (raw.length === 6) return `${raw.slice(0, 3)} ${raw.slice(3)}`;
    if (raw.length === 8) return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    return raw;
  }

  function codeChars(raw: string): Array<{ char: string; delay: number }> {
    const display = formatCode(raw);
    let digitIdx = 0;
    return [...display].map(char => {
      if (char === ' ') return { char, delay: 0 };
      return { char, delay: digitIdx++ * 30 };
    });
  }

  async function copyCode() {
    if (dragging) return;
    if (!code) return;
    try {
      const copiedCode = code.code;
      await navigator.clipboard.writeText(copiedCode);
      toast($_('accountCard.copied'));

      // Clear clipboard after 30 seconds if it still contains the code
      if (clipboardTimer) clearTimeout(clipboardTimer);
      clipboardTimer = setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === copiedCode) {
            await navigator.clipboard.writeText("");
          }
        } catch {
          // Silent fail — clipboard access may be denied
        }
      }, 30_000);
    } catch {
      // Silent fail
    }
  }

  function handleDelete() {
    if (!showConfirm) {
      showConfirm = true;
      return;
    }
    showConfirm = false;
    showActions = false;
    ondelete(account.id);
  }

  function cancelDelete() {
    showConfirm = false;
  }

  function handleCardKeydown(e: KeyboardEvent) {
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      onedit(account);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleDelete();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative py-4 group"
  onkeydown={handleCardKeydown}
  onmouseenter={() => showActions = true}
  onmouseleave={() => { showActions = false; showConfirm = false; }}
>
  <span class="sr-only">{$_('accountCard.srHint')}</span>
  <div class="flex items-center gap-3">
    <!-- Code area (clickable to copy) -->
    <button
      type="button"
      class="flex-1 min-w-0 text-start"
      onclick={copyCode}
    >
      <div class="mb-1.5">
        <span class="text-base text-fg/85 truncate block">
          {account.issuer || $_('accountCard.unknown')}
        </span>
        {#if account.label}
          <span class="text-xs text-muted truncate block mt-0.5">
            {account.label}
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[2rem] leading-none font-light tracking-[0.15em] text-fg tabular-nums">
          {#if code}
            {#key code.code}
              {#each codeChars(code.code) as { char, delay }}
                {#if char === ' '}
                  <span class="code-space"></span>
                {:else}
                  <span class="code-digit" style="animation-delay: {delay}ms">{char}</span>
                {/if}
              {/each}
            {/key}
          {:else}
            <span class="text-dim">--- ---</span>
          {/if}
        </span>
      </div>
      {#if code}
        <span class="copy-hint text-[9px] text-transparent group-hover:text-dim mt-0.5 block transition-colors duration-150 tracking-wider">
          {$_('accountCard.tapToCopy')}
        </span>
      {/if}
    </button>

    <!-- Countdown ring -->
    {#if code}
      <div class="flex-shrink-0">
        <CountdownRing remaining={code.remaining} period={account.period} />
      </div>
    {/if}
  </div>

  <!-- Hover action buttons -->
  {#if showActions}
    <div class="absolute top-1 end-0 flex gap-1">
      {#if !showConfirm}
        <button
          type="button"
          class="text-[10px] text-dim hover:text-fg px-1.5 py-0.5 transition-colors"
          onclick={() => onedit(account)}
        >
          {$_('accountCard.edit').toLowerCase()}
        </button>
        <button
          type="button"
          class="text-[10px] text-dim hover:text-error px-1.5 py-0.5 transition-colors"
          onclick={handleDelete}
        >
          {$_('accountCard.delete').toLowerCase()}
        </button>
      {:else}
        <span class="text-[10px] text-error/60 py-0.5">{$_('accountCard.confirmDelete').toLowerCase()}</span>
        <button
          type="button"
          class="text-[10px] text-error hover:text-error px-1 py-0.5 transition-colors"
          onclick={handleDelete}
        >
          {$_('accountCard.confirmYes')}
        </button>
        <button
          type="button"
          class="text-[10px] text-dim hover:text-fg px-1 py-0.5 transition-colors"
          onclick={cancelDelete}
        >
          {$_('accountCard.confirmNo')}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  @media (hover: none) {
    .copy-hint {
      display: none;
    }
  }
</style>
