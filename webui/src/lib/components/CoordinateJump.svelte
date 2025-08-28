<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
	let entry = '';

	function jump() {
		const m = entry.match(/^\s*(-?\d+)\s*,?\s*(-?\d+)\s*,?\s*(-?\d+)?\s*,?\s*(-?\d+)?\s*$/);
		if (!m) return;
		const [, xs, ys, zs, ws] = m;
		dispatch('jump', {
			x: +xs,
			y: +ys,
			z: zs ? +zs : 0,
			w: ws ? +ws : 0
		});
	}
</script>

<div class="jump">
	<input bind:value={entry} placeholder="x,y,z,w" />
	<button on:click={jump}>Go</button>
</div>

<style>
	.jump {
		position: fixed;
		left: 16px;
		bottom: 16px;
		display: flex;
		gap: 8px;
		z-index: 1000;
	}
	input {
		width: 120px;
		padding: 4px;
	}
	button {
		padding: 4px 8px;
	}
</style>
