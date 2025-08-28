<script lang="ts">
	import { onMount } from 'svelte';
	import { string_to_star_type, star_type_to_star_color } from '$lib/util/parse';
	import { StarType } from '$lib/util/types';
	import { renderBody } from '$lib/util/renderBody';

	export let info: Record<string, any>;
	export let size = 24;

	let iconCanvas: HTMLCanvasElement | null = null;
	let glow = false;
	let glowColor: number[] = [255, 255, 255];

	function initAppearance() {
		if (!info) return;
		if (info.Type === 'Planet' && info.Atmosphere) {
			glow = true;
			if (Array.isArray(info.PrimaryColor)) glowColor = info.PrimaryColor;
			return;
		}
		if (
			['Star', 'BlackHole', 'AsteroidField'].includes(info.Type) ||
			['Red', 'Orange', 'Yellow', 'Blue', 'Neutron', 'BlackHole', 'AsteroidField'].includes(
				info.SubType
			)
		) {
			glow = true;
			if (Array.isArray(info.PrimaryColor)) glowColor = info.PrimaryColor;
			else {
				const sType = string_to_star_type(info.SubType || info.Type);
				if (sType !== null) {
					const c = star_type_to_star_color(sType as StarType);
					glowColor = [c.r, c.g, c.b];
				}
			}
		}
	}

	onMount(async () => {
		initAppearance();
		if (iconCanvas) await renderBody(iconCanvas, info);
	});
</script>

<span class="icon-wrap {glow ? 'glow' : ''}" style="--pc: {glowColor.join(',')}; --sz: {size}px;">
	<canvas class="icon" width={size} height={size} bind:this={iconCanvas}></canvas>
</span>

<style>
	.icon-wrap {
		position: relative;
		display: inline-block;
		width: 2rem;
		height: 2rem;
		margin-right: 0.4rem;
		vertical-align: middle;
	}
	.icon-wrap.glow::before {
		content: '';
		position: absolute;
		inset: -40%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(var(--pc), 0.6) 0%,
			rgba(var(--pc), 0.05) 55%,
			rgba(var(--pc), 0) 75%
		);
		filter: blur(4px);
		pointer-events: none;
		z-index: 0;
	}
	.icon-wrap .icon {
		position: relative;
		z-index: 1;
	}
	.icon {
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
		display: block;
	}
</style>
