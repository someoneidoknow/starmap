<script lang="ts">
	import Window from './Window.svelte';
	import VirtualList from './VirtualList.svelte';
	import PlanetIcon from './Planet.svelte';
	import { createEventDispatcher } from 'svelte';
	import {
		PlanetType,
		StarType,
		type SearchResult,
		type Planet,
		type Star,
		type Coordinate
	} from '$lib/util/types';

	export let left = 880;
	export let top = 200;
	export let width = 620;
	export let height = 600;
	export let search_results: SearchResult | null = null;

	let showStars = false;

	function planets(): Planet[] {
		if (!search_results) return [];
		const arr: Planet[] = [];
		for (const system of search_results.solar_systems) {
			for (const planet of system.planets) {
				arr.push(planet);
			}
		}
		return arr;
	}

	function stars(): Star[] {
		if (!search_results) return [];
		const arr: Star[] = [];
		for (const system of search_results.solar_systems) {
			for (const star of system.stars) {
				arr.push(star);
			}
		}
		return arr;
	}

	function fmtCoord(c: { x: number; y: number; z: number; w: number }) {
		return `${c.x},${c.y},${c.z},${c.w}`;
	}

	const dispatch = createEventDispatcher<{ select: Coordinate }>();

	function focusPlanet(p: Planet) {
		(window as any).focusOnWorldCoords?.(
			p.coordinate.x,
			p.coordinate.y,
			p.coordinate.z,
			p.coordinate.w,
			700
		);
	}

	function selectPlanet(p: Planet) {
		focusPlanet(p);
		dispatch('select', p.coordinate);
	}

	function focusStar(s: Star) {
		(window as any).focusOnWorldCoords?.(s.coordinate.x, s.coordinate.y, 0, 0, 80);
	}

	$: listPlanets = search_results ? planets() : [];
	$: listStars = search_results ? stars() : [];

	const rowHeight = 32;
	let containerHeight = 400;

	import { browser } from '$app/environment';

	function updateContainerHeight() {
		if (!browser) return;
		const reservedSpace = 120;
		containerHeight = Math.max(50, height - reservedSpace);
	}

	$: if (search_results) {
		if (listPlanets.length === 0 && listStars.length > 0 && !showStars) showStars = true;
		else if (listStars.length === 0 && listPlanets.length > 0 && showStars) showStars = false;
	}

	$: if (browser && height) updateContainerHeight();

	import { onMount } from 'svelte';

	onMount(() => {
		if (!browser) return;
		updateContainerHeight();
	});

	const planetInfoCache = new WeakMap<Planet, any>();
	function planetToInfo(p: Planet) {
		if (planetInfoCache.has(p)) return planetInfoCache.get(p);
		const subtype = PlanetType[p.type];
		const info: any = {
			Type: 'Planet',
			SubType: subtype,
			Name: p.name,
			Atmosphere: p.atmosphere,
			PrimaryColor: p.primary_color
				? [p.primary_color.r, p.primary_color.g, p.primary_color.b]
				: undefined,
			SecondaryColor: p.secondary_color
				? [p.secondary_color.r, p.secondary_color.g, p.secondary_color.b]
				: undefined
		};
		if (p.ring) {
			info.Rings = { Type: p.ring.type === 0 ? 'Ice' : 'Stone' };
		}
		planetInfoCache.set(p, info);
		return info;
	}

	const starInfoCache = new WeakMap<Star, any>();
	function starToInfo(s: Star) {
		if (starInfoCache.has(s)) return starInfoCache.get(s);
		let info: any;
		if (s.type === StarType.RoguePlanet && search_results) {
			let planet = null;
			for (const sys of search_results.solar_systems) {
				planet = sys.planets.find(p => p.coordinate.x === s.coordinate.x && p.coordinate.y === s.coordinate.y && p.coordinate.z === 0 && p.coordinate.w === 0);
				if (planet) break;
			}
			if (planet) {
				const subtype = PlanetType[planet.type];
				info = {
					Type: 'Planet',
					SubType: subtype,
					Name: planet.name,
					Atmosphere: planet.atmosphere,
					PrimaryColor: planet.primary_color ? [planet.primary_color.r, planet.primary_color.g, planet.primary_color.b] : undefined,
					SecondaryColor: planet.secondary_color ? [planet.secondary_color.r, planet.secondary_color.g, planet.secondary_color.b] : undefined,
					Rings: planet.ring ? { Type: planet.ring.type === 0 ? 'Ice' : 'Stone' } : undefined
				};
			}
		}
		if (!info) {
			const subtype = StarType[s.type];
			info = {
				Type: 'Star',
				SubType: subtype,
				PrimaryColor: s.color ? [s.color.r, s.color.g, s.color.b] : undefined
			};
		}
		starInfoCache.set(s, info);
		return info;
	}

	var copiedSet = new Set<string>();
	function copyCoords(coordText: string, e: Event) {
		e.stopPropagation();
		navigator.clipboard.writeText(coordText);
		copiedSet.add(coordText);
		copiedSet = new Set(copiedSet);
		setTimeout(() => {
			copiedSet.delete(coordText);
			copiedSet = new Set(copiedSet);
		}, 1200);
	}
</script>

<Window bind:left bind:top bind:width bind:height collapsible={true} minWidth={480} maxWidth={900}>
	<span slot="title">Results</span>

	<div class="toolbar">
		<button class:selected={!showStars} on:click={() => (showStars = false)}>Planets</button>
		<button class:selected={showStars} on:click={() => (showStars = true)}>Stars</button>
	</div>

	<div class="counts">
		<span>{listPlanets.length} planets</span>
		<span>{listStars.length} stars</span>
	</div>

	{#if !search_results}
		<div class="empty">No query</div>
	{:else if !showStars}
		{#if listPlanets.length === 0}
			<div class="empty">No planets matched</div>
		{:else}
			<VirtualList items={listPlanets} {rowHeight} height={containerHeight} let:item>
				<div
					role="button"
					tabindex="0"
					class="row planet-row"
					on:click={() => selectPlanet(item)}
					on:keydown={(e: KeyboardEvent) =>
						(e.key === 'Enter' || e.key === ' ') && selectPlanet(item)}
				>
					{#key JSON.stringify(planetToInfo(item))}
						<PlanetIcon info={planetToInfo(item)} size={48} />
					{/key}
					<div class="name">{item.name}</div>
					<div class="type">{PlanetType[item.type] ?? item.type}</div>
					<div class="coord">{fmtCoord(item.coordinate)}</div>
					{#if copiedSet.has(fmtCoord(item.coordinate))}
						<button
							class="copy-btn"
							on:click={(e) => copyCoords(fmtCoord(item.coordinate), e)}
							aria-label="Copied"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="ic fade"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="m4.5 12.75 6 6 9-13.5"
								/></svg
							>
						</button>
					{:else}
						<button
							class="copy-btn"
							on:click={(e) => copyCoords(fmtCoord(item.coordinate), e)}
							aria-label="Copy coordinates"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="ic"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
								/></svg
							>
						</button>
					{/if}
				</div>
			</VirtualList>
		{/if}
	{:else if listStars.length === 0}
		<div class="empty">No stars matched</div>
	{:else}
		<VirtualList items={listStars} {rowHeight} height={containerHeight} let:item>
			<div
				role="button"
				tabindex="0"
				class="row star-row"
				on:click={() => focusStar(item)}
				on:keydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && focusStar(item)}
			>
				{#key JSON.stringify(starToInfo(item))}
					<PlanetIcon info={starToInfo(item)} size={32} />
				{/key}
				<div class="name">{StarType[item.type] ?? item.type}</div>
				<div class="coord">{fmtCoord(item.coordinate)}</div>
				<div class="size">{item.size}</div>
				{#if copiedSet.has(fmtCoord(item.coordinate))}
					<button
						class="copy-btn"
						on:click={(e) => copyCoords(fmtCoord(item.coordinate), e)}
						aria-label="Copied"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="ic fade"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="m4.5 12.75 6 6 9-13.5"
							/></svg
						>
					</button>
				{:else}
					<button
						class="copy-btn"
						on:click={(e) => copyCoords(fmtCoord(item.coordinate), e)}
						aria-label="Copy coordinates"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="ic"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
							/></svg
						>
					</button>
				{/if}
			</div>
		</VirtualList>
	{/if}
</Window>

<style>
	.toolbar {
		display: inline-grid;
		grid-auto-flow: column;
		gap: 0.4rem;
		margin: 0 0 0.6rem;
	}
	.toolbar button {
		border: 1px solid var(--green-3);
		background: var(--bg);
		color: var(--text);
		padding: 0.25rem 0.55rem;
		border-radius: 0.4rem;
		font-size: 0.8rem;
	}
	.toolbar button.selected {
		background: var(--green-2);
		border-color: var(--green-4);
	}
	.counts {
		display: flex;
		gap: 0.8rem;
		font-size: 0.72rem;
		opacity: 0.8;
		margin: -0.3rem 0 0.4rem;
	}
	.empty {
		font-size: 0.8rem;
		opacity: 0.7;
		padding: 0.25rem 0;
	}
	.row {
		cursor: pointer;
		display: grid;
		align-items: center;
		gap: 0.9rem;
		padding: 0.2rem 0.35rem;
		border-radius: 0.35rem;
		border: 1px solid transparent;
		background: color-mix(in oklab, var(--surface) 85%, black);
		width: 100%;
		text-align: left;
	}
	.row {
		box-sizing: border-box;
	}
	.planet-row {
		grid-template-columns: 2rem 7rem 3.4rem 1fr auto;
	}
	.star-row {
		grid-template-columns: 2rem 6.8rem 1fr 2.2rem auto;
	}
	.row:hover {
		border-color: var(--green-4);
		background: color-mix(in oklab, var(--green-2) 25%, var(--surface));
	}
	.row .name {
		font-size: 0.8rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row .type,
	.row .size {
		font-size: 0.7rem;
		opacity: 0.85;
	}
	.row .coord {
		font-size: 0.75rem;
		font-family: monospace;
		opacity: 0.8;
		margin-right: 0.35rem;
	}
	.row .size {
		text-align: right;
	}
	.copy-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		color: var(--green-3);
		display: flex;
		align-items: center;
	}
	.copy-btn .ic {
		width: 1.5em;
		height: 1.5em;
		color: var(--green-3);
		transition: opacity 0.3s ease;
	}
	.copy-btn:hover .ic {
		color: var(--text);
	}
	.fade {
		animation: fadeInOut 1.2s ease forwards;
	}
	@keyframes fadeInOut {
		0% {
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>
