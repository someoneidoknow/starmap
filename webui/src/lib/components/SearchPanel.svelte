<script lang="ts">
	import { searchUniverse } from '$lib/util/universeSearch';
	import Window from './Window.svelte';
	import RangeSlider from 'svelte-range-slider-pips';
	import 'svelte-range-slider-pips/dist/svelte-range-slider-pips.css';
	import {
		Resource,
		SearchType,
		PlanetType,
		type SearchResult,
		type UniverseData
	} from '$lib/util/types';
	import { onMount } from 'svelte';

	export let left = 200;
	export let top = 200;
	export let search_results: SearchResult | null = null;
	export let universe_data: UniverseData;

	const types = ['Starts with', 'Contains', 'Ends with'];

	const allResources = [
		Resource.Iron,
		Resource.Copper,
		Resource.Coal,
		Resource.Lead,
		Resource.Titanium,
		Resource.Uranium,
		Resource.Jade,
		Resource.Gold,
		Resource.Diamond,
		Resource.Beryllium,
		Resource.Aluminum
	];

	let name_box = '';
	let name_selected_type = SearchType.StartsWith;
	let ranmat_box = '';
	let ranmat_selected_type = SearchType.StartsWith;
	let coord_box = '';

	let planet_type_filters: Record<number, number> = {};
	for (const key in PlanetType) if (!isNaN(Number(key))) planet_type_filters[Number(key)] = 0;

	let ring_filter: 'any' | 'has' | 'no' = 'any';
	let atmosphere_filter: 'any' | 'yes' | 'no' = 'any';
	let tidal_filter: 'any' | 'yes' | 'no' = 'any';

	let temperature_range: [number, number] = [-300, 300];
	let gravity_range: [number, number] = [0, 300];

	let resource_tri: Record<number, 'any' | 'yes' | 'no'> = {};
	for (const r of allResources) resource_tri[r] = 'any';

	let color_hex = '';
	let color_similarity = 0;
	let colorPickerReady = false;
	onMount(async () => {
		if (typeof window !== 'undefined') {
			await import('vanilla-colorful/hex-color-picker.js');
			colorPickerReady = true;
		}
	});

	function run() {
		search_results = searchUniverse(universe_data, {
			name: { query: name_box, mode: name_selected_type },
			ranmat: { query: ranmat_box, mode: ranmat_selected_type },
			coords: coord_box,
			resources: [],
			planetTypeFilters: planet_type_filters,
			rings: ring_filter,
			atmosphere: atmosphere_filter,
			tidallyLocked: tidal_filter,
			temperatureRange: temperature_range,
			gravityRange: gravity_range,
			...({ resourcesTri: resource_tri } as any),
			color: color_hex,
			colorSimilarity: color_similarity
		} as any);
	}

	function name_oninput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		name_box = e.currentTarget.value;
		run();
	}
	function name_type_oninput(e: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const v = e.currentTarget.value;
		name_selected_type =
			v === 'Starts with'
				? SearchType.StartsWith
				: v === 'Contains'
					? SearchType.Contains
					: SearchType.EndsWith;
		run();
	}
	function ranmat_oninput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		ranmat_box = e.currentTarget.value;
		run();
	}
	function ranmat_type_oninput(e: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const v = e.currentTarget.value;
		ranmat_selected_type =
			v === 'Starts with'
				? SearchType.StartsWith
				: v === 'Contains'
					? SearchType.Contains
					: SearchType.EndsWith;
		run();
	}
	function coord_oninput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		coord_box = e.currentTarget.value;
		run();
	}
</script>

<Window bind:left bind:top collapsible={true}>
	<span slot="title">Search</span>

	<div class="form">
		<div class="row">
			<label class="field">
				<span class="label">Name</span>
				<input class="input" on:input={name_oninput} placeholder="Search by name..." type="text" />
			</label>
			<label class="field narrow">
				<span class="label">Match</span>
				<select class="select" on:input={name_type_oninput}>
					{#each types as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="row">
			<label class="field">
				<span class="label">Random material</span>
				<input class="input" on:input={ranmat_oninput} placeholder="e.g. Lodire" type="text" />
			</label>
			<label class="field narrow">
				<span class="label">Match</span>
				<select class="select" on:input={ranmat_type_oninput}>
					{#each types as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</label>
		</div>

		<label class="field">
			<span class="label">Coordinates</span>
			<input class="input" on:input={coord_oninput} placeholder="x, y, z, w" type="text" />
		</label>

		<section class="section">
			<h3>Primary Color</h3>
			<div class="color-row">
				{#if colorPickerReady}
					<hex-color-picker
						value={color_hex}
						on:color-changed={(e: any) => {
							color_hex = e.detail.value;
							run();
						}}
					></hex-color-picker>
				{/if}
				<div class="color-sim">
					<label class="field">
						<span class="label"
							>Color tolerance {color_similarity}% {color_similarity === 0 ? '(off)' : ''}</span
						>
						<input
							type="range"
							min="0"
							max="100"
							bind:value={color_similarity}
							on:input={() => run()}
						/>
					</label>
					<button
						type="button"
						class="clear"
						on:click={() => {
							color_hex = '';
							color_similarity = 0;
							run();
						}}>Clear</button
					>
				</div>
			</div>
		</section>

		<section class="section">
			<h3>Planet Type</h3>
			<div class="pill-wrap">
				{#each Object.keys(PlanetType).filter((k) => !isNaN(Number(k))) as key (key)}
					{#if !isNaN(Number(key))}
						<button
							type="button"
							class="tri-pill sm {planet_type_filters[Number(key)] === 1
								? 'on'
								: ''} {planet_type_filters[Number(key)] === -1 ? 'off' : ''}"
							on:click={() => {
								const n = Number(key);
								planet_type_filters[n] = ((planet_type_filters[n] + 2) % 3) - 1;
								run();
							}}
							aria-pressed={planet_type_filters[Number(key)] !== 0}
						>
							<span class="tri-pill-check"
								>{planet_type_filters[Number(key)] === 1
									? '✔'
									: planet_type_filters[Number(key)] === -1
										? '✖'
										: '○'}</span
							>
							{PlanetType[Number(key)]}
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<section class="section compact2">
			<div class="sub">
				<h3>Temperature (−300 to 300)</h3>
				<RangeSlider
					min={-300}
					max={300}
					values={temperature_range}
					range
					on:change={(e) => {
						temperature_range = e.detail.values;
						run();
					}}
					class="rs"
				/>
			</div>
			<div class="sub">
				<h3>Gravity (0g to 300g)</h3>
				<RangeSlider
					min={0}
					max={300}
					values={gravity_range}
					range
					on:change={(e) => {
						gravity_range = e.detail.values;
						run();
					}}
					class="rs"
				/>
			</div>
		</section>

		<section class="section compact3">
			<div class="sub">
				<h3>Atmosphere</h3>
				<div class="seg sm">
					<button
						type="button"
						class:selected={atmosphere_filter === 'any'}
						on:click={() => {
							atmosphere_filter = 'any';
							run();
						}}>Any</button
					>
					<button
						type="button"
						class:selected={atmosphere_filter === 'yes'}
						on:click={() => {
							atmosphere_filter = 'yes';
							run();
						}}>Yes</button
					>
					<button
						type="button"
						class:selected={atmosphere_filter === 'no'}
						on:click={() => {
							atmosphere_filter = 'no';
							run();
						}}>No</button
					>
				</div>
			</div>
			<div class="sub">
				<h3>Rings</h3>
				<div class="seg sm">
					<button
						type="button"
						class:selected={ring_filter === 'any'}
						on:click={() => {
							ring_filter = 'any';
							run();
						}}>Any</button
					>
					<button
						type="button"
						class:selected={ring_filter === 'has'}
						on:click={() => {
							ring_filter = 'has';
							run();
						}}>Has</button
					>
					<button
						type="button"
						class:selected={ring_filter === 'no'}
						on:click={() => {
							ring_filter = 'no';
							run();
						}}>No</button
					>
				</div>
			</div>
			<div class="sub">
				<h3>Tidally Locked</h3>
				<div class="seg sm">
					<button
						type="button"
						class:selected={tidal_filter === 'any'}
						on:click={() => {
							tidal_filter = 'any';
							run();
						}}>Any</button
					>
					<button
						type="button"
						class:selected={tidal_filter === 'yes'}
						on:click={() => {
							tidal_filter = 'yes';
							run();
						}}>Yes</button
					>
					<button
						type="button"
						class:selected={tidal_filter === 'no'}
						on:click={() => {
							tidal_filter = 'no';
							run();
						}}>No</button
					>
				</div>
			</div>
		</section>

		<section class="section">
			<h3>Resources</h3>
			<div class="res-grid">
				{#each allResources as r}
					<div class="res-tri">
						<div class="res-name">{Resource[r]}</div>
						<div class="seg xs">
							<button
								type="button"
								class:selected={resource_tri[r] === 'any'}
								on:click={() => {
									resource_tri[r] = 'any';
									run();
								}}>Any</button
							>
							<button
								type="button"
								class:selected={resource_tri[r] === 'yes'}
								on:click={() => {
									resource_tri[r] = 'yes';
									run();
								}}>Yes</button
							>
							<button
								type="button"
								class:selected={resource_tri[r] === 'no'}
								on:click={() => {
									resource_tri[r] = 'no';
									run();
								}}>No</button
							>
						</div>
					</div>
				{/each}
			</div>
		</section>
	</div>
</Window>

<style>
	:global(.window) {
		--radius: 0.6rem;
	}
	.form {
		display: grid;
		gap: 0.75rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 12rem;
		gap: 0.5rem;
	}
	.field {
		display: grid;
		gap: 0.35rem;
	}
	.field.narrow {
		width: 100%;
	}
	.label {
		font-size: 0.78rem;
		opacity: 0.8;
	}
	.input,
	.select {
		appearance: none;
		border: 1px solid var(--green-3);
		border-radius: 0.5rem;
		background: var(--bg);
		color: var(--text);
		padding: 0.45rem 0.6rem;
		line-height: 1.1;
	}
	.input::placeholder {
		color: var(--text);
		opacity: 0.55;
	}
	.input:hover,
	.select:hover {
		border-color: var(--green-4);
	}
	.input:focus-visible,
	.select:focus-visible {
		background: var(--surface);
		border-color: var(--green-4);
		outline-color: var(--green-4);
		box-shadow: 0 0 0 2px rgb(0 0 0 / 0.03);
	}

	.section {
		display: grid;
		gap: 0.5rem;
	}
	.section.compact2 {
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.section.compact3 {
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.sub {
		display: grid;
		gap: 0.4rem;
	}
	h3 {
		margin: 0;
		font-size: 0.9rem;
	}

	.pill-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.tri-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--green-3);
		background: var(--bg);
		color: var(--text);
		border-radius: 0.5rem;
		padding: 0.28rem 0.45rem;
		flex: 0 0 auto;
	}
	.tri-pill.sm {
		font-size: 0.82rem;
	}
	.tri-pill:hover {
		border-color: var(--green-4);
	}
	.tri-pill.on {
		background: color-mix(in oklab, var(--green-2) 35%, var(--bg));
		border-color: var(--green-4);
	}
	.tri-pill.off {
		background: color-mix(in oklab, #ff3b30 20%, var(--bg));
		border-color: #a64a4a;
	}
	.tri-pill-check {
		width: 0.9rem;
		text-align: center;
		opacity: 0.9;
	}

	.seg {
		display: inline-grid;
		grid-auto-flow: column;
	}
	.seg button {
		border: 1px solid var(--green-3);
		background: var(--bg);
		color: var(--text);
		padding: 0.32rem 0.6rem;
		line-height: 1;
	}
	.seg.sm button {
		padding: 0.32rem 0.5rem;
		font-size: 0.88rem;
	}
	.seg.xs button {
		padding: 0.26rem 0.45rem;
		font-size: 0.82rem;
	}
	.seg button:first-child {
		border-radius: 0.5rem 0 0 0.5rem;
	}
	.seg button:last-child {
		border-radius: 0 0.5rem 0.5rem 0;
	}
	.seg button:not(:first-child) {
		border-left: none;
	}
	.seg button:hover {
		border-color: var(--green-4);
	}
	.seg button.selected {
		background: var(--green-2);
		border-color: var(--green-4);
	}

	.res-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.4rem 0.6rem;
	}
	.res-tri {
		display: grid;
		grid-template-columns: 7rem 1fr;
		align-items: center;
		gap: 0.4rem;
	}
	.res-name {
		opacity: 0.9;
		font-size: 0.9rem;
	}

	:global(.rs .range-slider__track) {
		background: color-mix(in oklab, var(--green-3) 25%, var(--bg)) !important;
		height: 0.35rem;
		border-radius: 0.35rem;
	}
	:global(.rs .range-slider__range) {
		background: color-mix(in oklab, var(--green-3) 45%, var(--bg)) !important;
	}
	:global(.rs .range-slider__thumb) {
		background: var(--green-4) !important;
		border: 2px solid var(--surface) !important;
		width: 0.95rem;
		height: 0.95rem;
	}
	:global(.rs .range-slider__pips) {
		display: none;
	}

	.color-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	hex-color-picker {
		width: 130px;
		height: 130px;
	}
	.color-sim {
		display: grid;
		gap: 0.5rem;
		align-items: start;
	}
	.color-sim input[type='range'] {
		width: 160px;
	}
	button.clear {
		border: 1px solid var(--green-3);
		background: var(--bg);
		color: var(--text);
		padding: 0.35rem 0.6rem;
		border-radius: 0.5rem;
	}
	button.clear:hover {
		border-color: var(--green-4);
	}
</style>
