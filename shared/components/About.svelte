<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ghostLogo from "$shared/assets/ghost.svg";
  import Modal from "./Modal.svelte";

  let {
    onclose,
    version = "",
    openLink,
  }: {
    onclose: () => void;
    version?: string;
    openLink: (url: string) => void;
  } = $props();

  const REPO_URL = "https://github.com/KestrelAS/ghost-auth";
  const ISSUES_URL = "https://github.com/KestrelAS/ghost-auth/issues";
</script>

<Modal onclose={onclose} title={$_('about.title')} titleId="about-title">
  {#snippet children()}
    <!-- Logo + Name -->
    <div class="flex flex-col items-center mb-6">
      <img src={ghostLogo} alt="" class="w-14 h-14 icon-adapt opacity-40 mb-4" />
      <h2 class="text-lg tracking-wider text-fg/80">{$_('about.heading')}</h2>
      {#if version}<span class="text-xs text-dim mt-1 tracking-wider">{$_('about.version', { values: { version } })}</span>{/if}
    </div>

    <!-- Description -->
    <div class="border border-dotted border-border px-4 py-3 mb-4">
      <p class="text-sm text-muted leading-relaxed">
        {$_('about.description')}
      </p>
    </div>

    <!-- Links -->
    <div class="flex flex-col gap-2 mb-4">
      <button
        type="button"
        class="w-full text-start border border-dotted border-border px-4 py-2.5 hover:border-fg/30 transition-colors group"
        onclick={() => openLink(REPO_URL)}
      >
        <span class="text-sm text-dim group-hover:text-fg transition-colors">{$_('about.sourceCode')}</span>
        <span class="text-xs text-dim block mt-0.5 truncate">{$_('about.sourceCodeUrl')}</span>
      </button>
      <button
        type="button"
        class="w-full text-start border border-dotted border-border px-4 py-2.5 hover:border-fg/30 transition-colors group"
        onclick={() => openLink(ISSUES_URL)}
      >
        <span class="text-sm text-dim group-hover:text-fg transition-colors">{$_('about.reportIssue')}</span>
        <span class="text-xs text-dim block mt-0.5">{$_('about.reportIssueDesc')}</span>
      </button>
    </div>

    <!-- Footer -->
    <div class="text-center">
      <span class="text-xs text-dim tracking-wider">{$_('about.license')}</span>
      <span class="text-xs text-dim/60 mx-1.5">/</span>
      <span class="text-xs text-dim tracking-wider">{$_('about.madeBy')}</span>
      <div class="mt-2 flex flex-col items-center gap-1">
        <button type="button" class="text-xs text-dim/60 hover:text-dim transition-colors tracking-wider" onclick={() => openLink('https://ghostauth.org')}>
          ghostauth.org
        </button>
        <button type="button" class="text-xs text-dim/60 hover:text-dim transition-colors tracking-wider" onclick={() => openLink('mailto:ghostauth@kestrel.no')}>
          ghostauth@kestrel.no
        </button>
      </div>
    </div>
  {/snippet}
</Modal>
