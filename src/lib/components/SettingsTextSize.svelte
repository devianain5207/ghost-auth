<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getFontSize, setFontSize, FONT_VW_MIN, FONT_VW_MAX, FONT_VW_DEFAULT } from "$lib/stores/fontSize.svelte";

  const VW_RANGE = FONT_VW_MAX - FONT_VW_MIN;
  const sizeMarks = [
    { vw: 3.8, label: "XS" },
    { vw: 4.0, label: "S" },
    { vw: 4.2, label: "M" },
    { vw: 4.4, label: "L" },
    { vw: 4.6, label: "XL" },
  ];

  let sliderPercent = $derived(((getFontSize() - FONT_VW_MIN) / VW_RANGE) * 100);
  let nearestMark = $derived(
    sizeMarks.reduce((best, m) =>
      Math.abs(m.vw - getFontSize()) < Math.abs(best.vw - getFontSize()) ? m : best
    ).label
  );
  let sliderTrack: HTMLDivElement;
  let dragging = $state(false);

  function vwFromPointer(clientX: number) {
    const rect = sliderTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setFontSize(FONT_VW_MIN + ratio * VW_RANGE);
  }

  function handleSliderDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    vwFromPointer(e.clientX);
  }

  function handleSliderMove(e: PointerEvent) {
    if (!dragging) return;
    vwFromPointer(e.clientX);
  }

  function handleSliderUp() {
    dragging = false;
  }

  function handleSliderKey(e: KeyboardEvent) {
    const cur = getFontSize();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFontSize(cur + 0.1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFontSize(cur - 0.1);
    }
  }
</script>

<div>
  <p class="text-base font-semibold text-dim tracking-wide mb-3">{$_('settings.accessibility')}</p>
  <div class="border border-dotted border-border px-4 py-3">
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-3 text-sm text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5 opacity-50">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
        {$_('settings.textSize')}
      </span>
      <button
        type="button"
        class="text-xs text-dim hover:text-fg transition-colors"
        onclick={() => setFontSize(FONT_VW_DEFAULT)}
        aria-label={$_('settings.resetTextSize')}
      >{$_('settings.reset')}</button>
    </div>
    <div class="w-[min(75%,20rem)] mx-auto mt-3" dir="ltr">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="relative h-6 mx-2.5 flex items-center touch-none select-none cursor-pointer"
        bind:this={sliderTrack}
        role="slider"
        tabindex="0"
        aria-label={$_('settings.textSize')}
        aria-valuemin={FONT_VW_MIN}
        aria-valuemax={FONT_VW_MAX}
        aria-valuenow={getFontSize()}
        aria-valuetext={nearestMark}
        onpointerdown={handleSliderDown}
        onpointermove={handleSliderMove}
        onpointerup={handleSliderUp}
        onpointercancel={handleSliderUp}
        onkeydown={handleSliderKey}
      >
        <div class="absolute inset-x-0 h-px bg-dim/25"></div>
        {#each sizeMarks as _, i}
          <div
            class="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 bg-dim/30"
            style="left: {i * 25}%"
          ></div>
        {/each}
        <div
          class="absolute w-5 h-5 rounded-full -translate-x-1/2 border-2 border-accent bg-bg pointer-events-none"
          style="left: {sliderPercent}%; transition: {dragging ? 'none' : 'left 150ms ease'}"
        ></div>
      </div>
      <div class="relative h-4 mx-2.5 mt-0.5">
        {#each sizeMarks as mark, i}
          <span
            class="absolute text-xs leading-none -translate-x-1/2 text-dim"
            style="left: {i * 25}%"
          >{mark.label}</span>
        {/each}
      </div>
    </div>
  </div>
</div>
