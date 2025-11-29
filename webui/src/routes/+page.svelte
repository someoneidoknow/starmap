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
					if (!initialSelected) {
						const pname = u.searchParams.get('pname');
						if (pname && raw_data) {
							const pfx2 = pname.toLowerCase();
							for (const [coordKey, entry] of Object.entries(raw_data as any)) {
								if ((entry as any)?.Type === 'Planet' && typeof (entry as any).Name === 'string') {
									if ((entry as any).Name.toLowerCase().startsWith(pfx2)) {
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

	let bottomBannerText = 'Welcome to the Gab\'s Starmap. I will not be rejoining Eggs D Studios unless Mawesome decides to ban 12pink and issue an apology to the community. Mawesome is ruining his credibility (which there was barely any to begin with) by unbanning 12pink (who is a really weird individual) and refusing to listen to any of the proof against 12pink. I will not support a developer that allows people like 12pink to get unbanned. By the same logic, people like nyx, 50keys, atlas, tci, etc should be unbanned, which is clearly incorrect. https://discord.gg/gdpExmMyDf for a better server. 12pink should also hold accountability for her actions instead of arguing she was immature at that age (a 17 year old is not immature and shouldnt be dating a 14 year old).';

	let marqueeContentEl: HTMLDivElement | null = null;
	let marqueeTrackEl: HTMLDivElement | null = null;
	let marqueeRepeatCount = 2;
	let marqueeUpdateQueued = false;

	if (typeof window !== 'undefined') {
		(window as any).setBottomBannerText = (s: string) => {
			bottomBannerText = s ?? '';
			queueMarqueeDurationUpdate();
		};
	}

	async function updateMarqueeDuration() {
		if (typeof window === 'undefined') return;
		if (!marqueeContentEl) return;
		const trackWidth = marqueeTrackEl?.clientWidth ?? window.innerWidth;
		const firstItem = marqueeContentEl.querySelector('.marquee-item') as HTMLSpanElement | null;
		const itemWidth = firstItem?.scrollWidth ?? 0;

		if (trackWidth > 0 && itemWidth > 0) {
			const neededRepeats = Math.max(2, Math.ceil((trackWidth * 2) / itemWidth));
			if (neededRepeats !== marqueeRepeatCount) {
				marqueeRepeatCount = neededRepeats;
				await tick();
			}
		}

		const distance = marqueeContentEl.scrollWidth / 2;
		if (distance <= 0) return;
		const speed = 200; // pixels per second
		const duration = Math.max(3, distance / speed);
		marqueeContentEl.style.setProperty('--marquee-duration', `${duration}s`);
	}

	async function queueMarqueeDurationUpdate() {
		if (typeof window === 'undefined') return;
		if (marqueeUpdateQueued) return;
		marqueeUpdateQueued = true;
		await tick();
		try {
			await updateMarqueeDuration();
		} catch (err) {
			console.error('Failed to update marquee duration', err);
		} finally {
			marqueeUpdateQueued = false;
		}
	}

	let ro: ResizeObserver | null = null;
	onMount(() => {
		queueMarqueeDurationUpdate();
		ro = new ResizeObserver(() => queueMarqueeDurationUpdate());
		if (marqueeContentEl) ro.observe(marqueeContentEl);
		if (marqueeTrackEl) ro.observe(marqueeTrackEl);
		window.addEventListener('resize', queueMarqueeDurationUpdate);
	});
	onDestroy(() => {
		if (ro) ro.disconnect();
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', queueMarqueeDurationUpdate);
		}
	});
	$: if (marqueeContentEl && marqueeTrackEl) queueMarqueeDurationUpdate();
	$: if (bottomBannerText !== undefined) queueMarqueeDurationUpdate();

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

<div class="bottom-banner" aria-hidden={bottomBannerText === ''} bind:this={marqueeTrackEl}>
	<div class="marquee-track">
		<div class="marquee-content" bind:this={marqueeContentEl} style="--marquee-duration: 18s;">
			{#each Array.from({ length: marqueeRepeatCount }) as _, idx (idx)}
				<span class="marquee-item">{bottomBannerText}&nbsp;&nbsp;&nbsp;</span>
			{/each}
		</div>
	</div>
</div>

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

	.bottom-banner {
		position: fixed;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 36px;
		pointer-events: none;
		z-index: 900;
		display: flex;
		align-items: center;
		background: linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.18));
	}
	.marquee-track {
		overflow: hidden;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
	}
	.marquee-content {
		display: inline-flex;
		white-space: nowrap;
		will-change: transform;
		animation: marquee-scroll var(--marquee-duration, 18s) linear infinite;
	}
	.marquee-item {
		display: inline-block;
		color: #ddd;
		font: 13px/14px system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
		padding-right: 2rem;
	}

	@keyframes marquee-scroll {
		from { transform: translateX(0%); }
		to { transform: translateX(-50%); }
	}
</style>
