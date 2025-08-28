<script lang="ts">
	import Universe from '$lib/Universe.svelte';
	import { viewMatrix } from '$lib/Universe.svelte';
	import CoordinateJump from '$lib/components/CoordinateJump.svelte';
	import InfoPanel from '$lib/components/InfoPanel.svelte';
	import SearchPanel from '$lib/components/SearchPanel.svelte';
	import SearchResults from '$lib/components/SearchResults.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { parseUniverse } from '$lib/util/universe';
	import { decode } from '@msgpack/msgpack';
	import type { Coordinate, SearchResult, SolarSystem } from '$lib/util/types';
	import { ZSTDDecoder } from 'zstddec';
	let universe_data: any = null;
	let raw_data: any = null;

	onMount(async () => {
		try {
			const response = await fetch('/assets/Universe.msgpack.zst');
			const compressedData = new Uint8Array(await response.arrayBuffer());

			const decoder = new ZSTDDecoder();
			await decoder.init();
		
			const decompressed = decoder.decode(compressedData, 16384*1024); // 16 MB
			raw_data = decode(decompressed);
		
			universe_data = await parseUniverse(raw_data);
		} catch (error) {
			console.error('Failed to load universe data:', error);
		}
	});

	const SUB = 21;
	const planetShowAt = 96;

	let universe: any;
	let selected: Coordinate = { x: 0, y: 0, z: 0, w: 0 };

	let screenX = 0,
		screenY = 0,
		scale = 1;
	let panelX = 0,
		panelY = 0;
	let placed = false;

	let search_results: SearchResult | null = null;

	function key({ x, y, z, w }: { x: number; y: number; z: number; w: number }) {
		return `${x}, ${y}, ${z}, ${w}`;
	}
	$: info = raw_data ? (raw_data as any)[key(selected)] ?? {} : {};
	$: hasInfo = Object.keys(info).length > 0;

	function toScreen(
		c: { x: number; y: number; z: number; w: number },
		v: { x: number; y: number; scale: number }
	) {
		const wx = c.x + 0.5 + c.z / SUB;
		const wy = c.y + 0.5 + c.w / SUB;
		return { x: wx * v.scale + v.x, y: wy * v.scale + v.y };
	}

	function place(v: { x: number; y: number; scale: number }) {
		if (placed) return;
		const p = toScreen(selected, v);
		panelX = Math.max(0, p.x + 24);
		panelY = Math.max(0, p.y);
		placed = true;
	}

	function path(px: number, py: number, lx: number, ly: number) {
		const a = (n: number) => Math.round(n);
		return `${a(px)},${a(py)} ${a(px)},${a(ly)} ${a(lx)},${a(ly)}`;
	}

	const unsub = viewMatrix.subscribe((v) => {
		const p = toScreen(selected, v);
		screenX = p.x;
		screenY = p.y;
		scale = v.scale;
		place(v);
	});
	onDestroy(unsub);

	function jump(e: CustomEvent<{ x: number; y: number; z: number; w: number }>) {
		selected = e.detail;
		universe?.focusOnWorldCoords(selected.x, selected.y, selected.z, selected.w, 1000);
	}

	function pick(e: CustomEvent<{ x: number; y: number; z: number; w: number }>) {
		const c = e.detail;
		selected = scale < planetShowAt ? { x: c.x, y: c.y, z: 0, w: 0 } : c;
	}
	$: selectorTune =
		info.Type === 'Star' || info.Type === 'BlackHole' || info.Type === 'AsteroidField' ? 0.2 : 0.07;
</script>

<CoordinateJump on:jump={jump} />

{#if universe_data}
	<Universe bind:this={universe} {universe_data} {search_results} on:worldclick={pick} />
{:else}
	<div class="loading">Loading universe data...</div>
{/if}

<svg
	viewBox="0 0 200 200"
	class="selector spinning"
	style="
		position: fixed;
		left: {screenX - (scale * selectorTune) / 2}px;
		top: {screenY - (scale * selectorTune) / 2}px;
		width: {scale * selectorTune}px;
		height: {scale * selectorTune}px;
		pointer-events: none;
		z-index: 800;
	"
>
	<circle
		cx="100"
		cy="100"
		r="90"
		fill="none"
		stroke="white"
		stroke-width="4"
		stroke-dasharray="10 13.56"
		stroke-linecap="butt"
	/>
</svg>

{#if hasInfo}
	<InfoPanel bind:left={panelX} bind:top={panelY} {info} {selected} />

	<svg class="overlay" width="100%" height="100%">
		<polyline
			points={path(screenX, screenY, panelX, panelY)}
			fill="none"
			stroke="white"
			stroke-width="1.2"
			vector-effect="non-scaling-stroke"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</svg>
{/if}

<SearchPanel bind:search_results {universe_data} />
<SearchResults
	{search_results}
	on:select={(e) => {
		selected = e.detail;
		placed = false;
	}}
/>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 850;
	}
	.spinning {
		animation: spin 4s linear infinite;
		transform-origin: center;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
