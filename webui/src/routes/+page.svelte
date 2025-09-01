<script lang="ts">
	import Universe from '$lib/Universe.svelte';
	import { viewMatrix } from '$lib/Universe.svelte';
	import CoordinateJump from '$lib/components/CoordinateJump.svelte';
	import InfoPanel from '$lib/components/InfoPanel.svelte';
	import SearchPanel from '$lib/components/SearchPanel.svelte';
	import SearchResults from '$lib/components/SearchResults.svelte';
	import { onDestroy, onMount, tick } from 'svelte';
	import { parseUniverse } from '$lib/util/universe';
	import type { Coordinate, SearchResult, SolarSystem } from '$lib/util/types';
	import { loadUniverse } from '$lib/util/assets';
	let universe_data: any = null;
	let raw_data: any = null;
	let internalUpdate = false;

	function parseCoordString(str: string | null): Coordinate | null {
		if (!str) return null;
		const parts = str.split(',').map(s => parseInt(s.trim()));
		if (parts.length !== 4 || parts.some(isNaN)) return null;
		return clampCoord({ x: parts[0], y: parts[1], z: parts[2], w: parts[3] });
	}

	function clampCoord(c: Coordinate): Coordinate {
		return {
			x: Math.min(100, Math.max(-100, c.x)),
			y: Math.min(100, Math.max(-100, c.y)),
			z: Math.min(10, Math.max(-10, c.z)),
			w: Math.min(10, Math.max(-10, c.w))
		};
	}

	let initialSelected: Coordinate | null = null;
	if (typeof window !== 'undefined') {
		const u = new URL(window.location.href);
		initialSelected = parseCoordString(u.searchParams.get('c')) || parseCoordString(u.hash ? u.hash.slice(1) : null);
	}

	function focusFromEntry(c: Coordinate) {
		c = clampCoord(c);
		const entry: any = raw_data ? (raw_data as any)[key(c)] : null;
		let zoom = 100;
		let z = c.z;
		let w = c.w;
		if (entry) {
			if (entry.Type === 'Planet') zoom = 700;
			else if (entry.Type === 'Star' || entry.Type === 'BlackHole' || entry.Type === 'AsteroidField') {
				zoom = 80;
			}
		}
		selected = c;
		placed = false;
		(window as any).focusOnWorldCoords?.(c.x, c.y, z, w, zoom);
	}

	async function applyInitialSelection() {
		if (!initialSelected) return;
		await tick();
		await (window as any).waitForFirstFrame();
		focusFromEntry(initialSelected);
	}

	onMount(async () => {
		try {
			raw_data = await loadUniverse();
			universe_data = await parseUniverse(raw_data);
			if (typeof window !== 'undefined') {
				const u = new URL(window.location.href);
				if (!u.searchParams.get('c')) {
					const ranmat = u.searchParams.get('ranmat');
					if (ranmat && raw_data) {
						const pfx = ranmat.toLowerCase();
						for (const [coordKey, entry] of Object.entries(raw_data as any)) {
							if ((entry as any)?.Type === 'Planet' && typeof (entry as any).RandomMaterial === 'string') {
								if ((entry as any).RandomMaterial.toLowerCase().startsWith(pfx)) {
									const parts = coordKey.split(',').map(s => parseInt(s.trim()));
									if (parts.length === 4 && parts.every(n => !isNaN(n))) {
										initialSelected = { x: parts[0], y: parts[1], z: parts[2], w: parts[3] };
									}
									break;
								}
							}
						}
					}
				}
			}
			await applyInitialSelection();
			const handleLocation = () => {
				if (internalUpdate) { internalUpdate = false; return; }
				const u = new URL(window.location.href);
				const next = parseCoordString(u.searchParams.get('c')) || (!u.searchParams.get('c') ? parseCoordString(u.hash ? u.hash.slice(1) : null) : null);
				if (next && key(next) !== key(selected)) focusFromEntry(next);
			};
			window.addEventListener('hashchange', handleLocation);
			window.addEventListener('popstate', handleLocation);
		} catch (error) {
			console.error('Failed to load universe data:', error);
		}
	});

	const SUB = 21;
	const planetShowAt = 96;

	let universe: any;
	let selected: Coordinate = initialSelected ?? { x: 0, y: 0, z: 0, w: 0 };

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
	function hashKey({ x, y, z, w }: { x: number; y: number; z: number; w: number }) {
		return `${x},${y},${z},${w}`;
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
	$: if (typeof window !== 'undefined') {
		const coordStr = hashKey(selected);
		if (coordStr !== '0,0,0,0') {
			const current = new URL(window.location.href);
			if (current.searchParams.get('c') !== coordStr) {
				const params = current.searchParams;
				params.delete('c');
				let other = '';
				params.forEach((v, k) => { other += (other ? '&' : '') + encodeURIComponent(k) + '=' + encodeURIComponent(v); });
				const base = current.origin + current.pathname;
				const newUrl = base + '?' + (other ? other + '&' : '') + 'c=' + coordStr + (current.hash || '');
				internalUpdate = true;
				history.replaceState(history.state, '', newUrl);
			}
		} else {
			const current = new URL(window.location.href);
			if (current.searchParams.get('c')) {
				current.searchParams.delete('c');
				let other = '';
				current.searchParams.forEach((v, k) => { other += (other ? '&' : '') + encodeURIComponent(k) + '=' + encodeURIComponent(v); });
				const base = current.origin + current.pathname;
				const newUrl = other ? base + '?' + other + (current.hash || '') : base + (current.hash || '');
				internalUpdate = true;
				history.replaceState(history.state, '', newUrl);
			}
		}
	}

	function jump(e: CustomEvent<{ x: number; y: number; z: number; w: number }>) {
		selected = clampCoord(e.detail);
		universe?.focusOnWorldCoords(selected.x, selected.y, selected.z, selected.w, 1000);
	}

	function pick(e: CustomEvent<{ x: number; y: number; z: number; w: number }>) {
		const c = e.detail;
		selected = clampCoord(scale < planetShowAt ? { x: c.x, y: c.y, z: 0, w: 0 } : c);
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
		universe?.focusOnWorldCoords(selected.x, selected.y, selected.z, selected.w, 1000);
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
