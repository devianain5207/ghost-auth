<script lang="ts">
  import CheckIcon from "$shared/components/CheckIcon.svelte";
  let {
    color = 'currentColor',
    size = 24,
    strokeWidth = 2,
    animate = false,
    class: className = ''
  }: {
    color?: string;
    size?: number;
    strokeWidth?: number;
    animate?: boolean;
    class?: string;
  } = $props();
</script>
<CheckIcon {color} {size} {strokeWidth} {animate} class={className} />
