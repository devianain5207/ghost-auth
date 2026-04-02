<script lang="ts">
  let { checked, onclick, ariaLabel }: {
    checked: boolean;
    onclick: () => void;
    ariaLabel: string;
  } = $props();
</script>

<button
  type="button"
  class="w-11 h-6 rounded-full border transition-all duration-200 relative {checked ? 'bg-accent/15 border-accent/40' : 'bg-transparent border-dim/50'}"
  {onclick}
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
>
  <div class="w-4 h-4 rounded-full absolute top-0.5 transition-all duration-200 {checked ? 'left-[1.375rem] bg-accent' : 'left-[0.1875rem] bg-dim'}"></div>
</button>
