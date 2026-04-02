<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ghostLogo from "$lib/assets/ghost.svg";
  import type { AccountDisplay, CodeResponse } from "$lib/stores/accounts.svelte";
  import AccountCard from "./AccountCard.svelte";

  let {
    accounts,
    codes,
    ondelete,
    onedit,
    onreorder,
    search = "",
  }: {
    accounts: AccountDisplay[];
    codes: Map<string, CodeResponse>;
    ondelete: (id: string) => void;
    onedit: (account: AccountDisplay) => void;
    onreorder: (ids: string[]) => void;
    search?: string;
  } = $props();

  let filtered = $derived(
    search.trim()
      ? accounts.filter((a) => {
          const q = search.toLowerCase();
          return (
            a.issuer.toLowerCase().includes(q) ||
            a.label.toLowerCase().includes(q)
          );
        })
      : accounts,
  );

  // ARIA live announcement for keyboard reorder
  let reorderAnnouncement = $state("");

  // Drag reorder state
  let draggingId: string | null = $state(null);
  let dropTargetIndex: number | null = $state(null);
  let dragActive = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressStartPos = { x: 0, y: 0 };
  let pressStartAt = 0;
  let pendingDragAccountId: string | null = null;
  let activePointerId: number | null = null;
  let activePointerType: string | null = null;
  let pointerClientY = 0;
  let scrollParentEl: HTMLElement | null = null;
  let autoScrollRaf: number | null = null;
  let containerEl: HTMLUListElement | undefined = $state(undefined);

  const LONG_PRESS_MS = 320;
  const MOVE_THRESHOLD_MOUSE = 8;
  const MOVE_THRESHOLD_TOUCH = 26;
  const AUTO_SCROLL_EDGE_PX = 84;
  const AUTO_SCROLL_MAX_STEP = 18;

  // Passive pointermove listener
  $effect(() => {
    if (!containerEl) return;
    containerEl.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => containerEl!.removeEventListener('pointermove', handlePointerMove);
  });

  function handlePointerDown(e: PointerEvent, accountId: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (search.trim()) return;
    if (filtered.length < 2) return;

    cancelLongPress();

    activePointerId = e.pointerId;
    activePointerType = e.pointerType || null;
    pressStartPos = { x: e.clientX, y: e.clientY };
    pressStartAt = performance.now();
    pointerClientY = e.clientY;
    pendingDragAccountId = accountId;

    longPressTimer = setTimeout(() => {
      activateDrag(accountId);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: PointerEvent) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    if (longPressTimer) {
      const heldMs = performance.now() - pressStartAt;
      const pendingId = pendingDragAccountId;
      if (pendingId !== null && heldMs >= LONG_PRESS_MS) {
        activateDrag(pendingId);
        pointerClientY = e.clientY;
        updateDropTarget(e.clientY);
        return;
      }

      const dx = Math.abs(e.clientX - pressStartPos.x);
      const dy = Math.abs(e.clientY - pressStartPos.y);
      const threshold = activePointerType === "touch" ? MOVE_THRESHOLD_TOUCH : MOVE_THRESHOLD_MOUSE;
      if (dx > threshold || dy > threshold) {
        cancelLongPress(true);
      }
      return;
    }

    if (!dragActive) return;

    pointerClientY = e.clientY;
    updateDropTarget(e.clientY);
  }

  function handlePointerUp(e: PointerEvent) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    const heldMs = performance.now() - pressStartAt;
    const hadPendingTimer = longPressTimer !== null;
    const pendingId = pendingDragAccountId;
    if (!dragActive && hadPendingTimer && pendingId !== null && heldMs >= LONG_PRESS_MS) {
      activateDrag(pendingId);
      pointerClientY = e.clientY;
      updateDropTarget(e.clientY);
    }
    cancelLongPress();
    if (dragActive) {
      commitDrag();
    }
    pressStartAt = 0;
    pendingDragAccountId = null;
    activePointerId = null;
    activePointerType = null;
  }

  function cancelLongPress(clearPending = false) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (clearPending) {
      pendingDragAccountId = null;
      pressStartAt = 0;
    }
  }

  function activateDrag(accountId: string) {
    longPressTimer = null;
    draggingId = accountId;
    dragActive = true;
    scrollParentEl = getScrollParent(containerEl);
    startAutoScroll();
    if (containerEl && activePointerId !== null) {
      try { containerEl.setPointerCapture(activePointerId); } catch {}
    }

    const sourceIndex = filtered.findIndex((a) => a.id === accountId);
    dropTargetIndex = sourceIndex;

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  function updateDropTarget(clientY: number) {
    if (!containerEl) return;
    const items = containerEl.querySelectorAll("[data-drag-item]");

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        dropTargetIndex = i;
        return;
      }
    }
    dropTargetIndex = items.length;
  }

  function getScrollParent(el: HTMLElement | undefined): HTMLElement | null {
    if (!el) return null;
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const canScrollY = /(auto|scroll)/.test(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight;
      if (canScrollY) return parent;
      parent = parent.parentElement;
    }
    return document.scrollingElement instanceof HTMLElement
      ? document.scrollingElement
      : null;
  }

  function computeAutoScrollStep(clientY: number): number {
    if (!scrollParentEl) return 0;
    const rect = scrollParentEl.getBoundingClientRect();
    const topEdge = rect.top + AUTO_SCROLL_EDGE_PX;
    const bottomEdge = rect.bottom - AUTO_SCROLL_EDGE_PX;

    if (clientY < topEdge && scrollParentEl.scrollTop > 0) {
      const ratio = Math.min(1, (topEdge - clientY) / AUTO_SCROLL_EDGE_PX);
      return -Math.max(1, Math.round(AUTO_SCROLL_MAX_STEP * ratio));
    }

    const maxScrollTop = scrollParentEl.scrollHeight - scrollParentEl.clientHeight;
    if (clientY > bottomEdge && scrollParentEl.scrollTop < maxScrollTop) {
      const ratio = Math.min(1, (clientY - bottomEdge) / AUTO_SCROLL_EDGE_PX);
      return Math.max(1, Math.round(AUTO_SCROLL_MAX_STEP * ratio));
    }

    return 0;
  }

  function autoScrollTick() {
    if (!dragActive) {
      stopAutoScroll();
      return;
    }
    const step = computeAutoScrollStep(pointerClientY);
    if (step !== 0 && scrollParentEl) {
      scrollParentEl.scrollTop += step;
      updateDropTarget(pointerClientY);
    }
    autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function startAutoScroll() {
    if (autoScrollRaf !== null) return;
    autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function stopAutoScroll() {
    if (autoScrollRaf !== null) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  }

  function handleKeyboardReorder(e: KeyboardEvent, accountId: string) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    if (search.trim()) return;
    if (accounts.length < 2) return;

    e.preventDefault();
    const ids = accounts.map((a) => a.id);
    const index = ids.indexOf(accountId);
    if (index === -1) return;

    const targetIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const [moved] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, moved);
    onreorder(ids);

    const name = accounts.find(a => a.id === moved)?.issuer || $_('accountList.accountFallback');
    reorderAnnouncement = `${name}, ${targetIndex + 1} / ${ids.length}`;

    // Re-focus the moved item after DOM update
    requestAnimationFrame(() => {
      containerEl?.querySelectorAll<HTMLElement>("[data-drag-item]")[targetIndex]?.focus();
    });
  }

  async function commitDrag() {
    if (draggingId !== null && dropTargetIndex !== null) {
      const ids = accounts.map((a) => a.id);
      const fromIndex = ids.indexOf(draggingId);
      let toIndex = Math.max(0, Math.min(dropTargetIndex, ids.length));

      if (fromIndex !== -1) {
        if (fromIndex < toIndex) {
          toIndex -= 1;
        }

        if (fromIndex !== toIndex) {
          const [moved] = ids.splice(fromIndex, 1);
          ids.splice(toIndex, 0, moved);
          onreorder(ids);
        }
      }
    }

    draggingId = null;
    dropTargetIndex = null;
    dragActive = false;
    if (containerEl && activePointerId !== null) {
      try { containerEl.releasePointerCapture(activePointerId); } catch {}
    }
    stopAutoScroll();
    scrollParentEl = null;
  }
</script>

{#if accounts.length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-dim">
    <img src={ghostLogo} alt="" class="w-16 h-16 icon-adapt opacity-15 mb-6" />
    <p class="text-sm text-muted">{$_('accountList.emptyTitle')}</p>
    <p class="text-sm text-dim mt-1">{$_('ext.accountList.emptyHint')}</p>
  </div>
{:else if filtered.length === 0}
  <div class="flex flex-col items-center justify-center py-12 text-dim">
    <p class="text-xs text-muted">{$_('accountList.noMatches', { values: { search } })}</p>
  </div>
{:else}
  <ul
    bind:this={containerEl}
    class="list-none p-0 m-0"
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each filtered as account, i (account.id)}
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <li
        data-drag-item
        role="button"
        tabindex="0"
        aria-label="{account.issuer || $_('accountList.accountFallback')}{account.label ? ` - ${account.label}` : ''}"
        class="select-none transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-accent
          {i > 0 ? 'border-dotted-t' : ''}
          {dragActive && draggingId === account.id ? 'drag-active-item' : ''}
          {dragActive && draggingId !== account.id && dropTargetIndex === i ? 'drag-drop-target' : ''}"
        onpointerdown={(e) => handlePointerDown(e, account.id)}
        onkeydown={(e) => handleKeyboardReorder(e, account.id)}
      >
        <AccountCard {account} code={codes.get(account.id)} {ondelete} {onedit} dragging={dragActive} />
      </li>
    {/each}
    {#if dragActive && dropTargetIndex === filtered.length}
      <div class="drag-drop-target-end" aria-hidden="true"></div>
    {/if}
  </ul>
  <div class="sr-only" aria-live="assertive" aria-atomic="true">{reorderAnnouncement}</div>
{/if}

<style>
  .drag-active-item {
    transform: scale(1.02);
    opacity: 0.7;
    z-index: 10;
    position: relative;
  }

  .drag-drop-target {
    border-top: 2px solid var(--color-accent);
  }

  .drag-drop-target-end {
    border-top: 2px solid var(--color-accent);
  }
</style>
