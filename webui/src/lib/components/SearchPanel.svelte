<script lang="ts">
	import { searchUniverse } from '$lib/util/universeSearch';
	import Window from './Window.svelte';
	import TriStateFilter from './TriStateFilter.svelte';
	import RangeSlider from 'svelte-range-slider-pips';
	import 'svelte-range-slider-pips/dist/svelte-range-slider-pips.css';
	import {
		Resource,
		SearchType,
		PlanetType,
		StarType,
		type SearchResult,
		type UniverseData
	} from '$lib/util/types';
	import { onMount, onDestroy } from 'svelte';

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

	let star_type_filters: Record<number, number> = {};
	for (const key in StarType) if (!isNaN(Number(key))) star_type_filters[Number(key)] = 0;

	let ring_filter: number = 0; // 0 = any, 1 = has, -1 = no
	let atmosphere_filter: number = 0; // 0 = any, 1 = yes, -1 = no
	let tidal_filter: number = 0; // 0 = any, 1 = yes, -1 = no
	let earthlikes_filter: number = 0; // 0 = any, 1 = yes, -1 = no

	let temperature_range: [number, number] = [-400, 400];
	let gravity_range: [number, number] = [0, 400];

	let resource_tri: Record<number, number> = {};
	for (const r of allResources) resource_tri[r] = 0;

	let color_hex = '';
	let color_similarity = 0;
	let secondary_color_hex = '';
	let secondary_color_similarity = 0;
	let colorPickerReady = false;
	let color_input = '';
	let secondary_color_input = '';
	let hexPickerEl: any;
	let hexPickerSecondaryEl: any;
	let sizeClass = '';
	let formEl: HTMLDivElement;
	let ro: ResizeObserver | null = null;
	let spMaxHeight: number | undefined;
	const spMinWidth = 360;
	function normalizeColor(v: string): string | '' {
		if (!v) return '';
		v = v.trim();
		const hexMatch = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
		if (hexMatch.test(v)) {
			let h = v.replace('#', '').toLowerCase();
			if (h.length === 3)
				h = h
					.split('')
					.map((c) => c + c)
					.join('');
			return '#' + h;
		}
		const rgbMatch = /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
		const m = v.match(rgbMatch);
		if (m) {
			const r = Math.min(255, parseInt(m[1]));
			const g = Math.min(255, parseInt(m[2]));
			const b = Math.min(255, parseInt(m[3]));
			const toHex = (n: number) => n.toString(16).padStart(2, '0');
			return '#' + toHex(r) + toHex(g) + toHex(b);
		}
		return '';
	}
	function color_text_oninput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		color_input = e.currentTarget.value;
		const n = normalizeColor(color_input);
		if (n) {
			color_hex = n;
			if (hexPickerEl) hexPickerEl.color = n;
			run();
		}
	}

	function secondary_color_text_oninput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		secondary_color_input = e.currentTarget.value;
		const n = normalizeColor(secondary_color_input);
		if (n) {
			secondary_color_hex = n;
			if (hexPickerSecondaryEl) hexPickerSecondaryEl.color = n;
			run();
		}
	}
	onMount(async () => {
		if (typeof window !== 'undefined') {
			await import('vanilla-colorful/hex-color-picker.js');
			colorPickerReady = true;
			const updateMaxH = () => {
				spMaxHeight = window.innerHeight - 16;
			};
			updateMaxH();
			window.addEventListener('resize', updateMaxH);
			if (formEl) {
				ro = new ResizeObserver((entries) => {
					const w = entries[0].contentRect.width;
					sizeClass = w < 420 ? 'xs' : w < 500 ? 'sm' : w < 660 ? 'md' : '';
				});
				ro.observe(formEl);
			}
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', () => {
				spMaxHeight = window.innerHeight - 16;
			});
		}
		if (ro && formEl) ro.disconnect();
		if (searchTimeoutId !== null) {
			clearTimeout(searchTimeoutId);
		}
	});
	onDestroy(() => {
		if (ro && formEl) ro.disconnect();
	});

	let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastSearchTime = 0;
	const SEARCH_RATE_LIMIT = 100;

	function runSearch() {
		const convertTriState = (value: number): 'any' | 'yes' | 'no' => {
			if (value === 1) return 'yes';
			if (value === -1) return 'no';
			return 'any';
		};

		const convertRingState = (value: number): 'any' | 'has' | 'no' => {
			if (value === 1) return 'has';
			if (value === -1) return 'no';
			return 'any';
		};

		const convertedResourceTri: Record<number, 'any' | 'yes' | 'no'> = {};
		for (const r of allResources) {
			convertedResourceTri[r] = convertTriState(resource_tri[r]);
		}

		search_results = searchUniverse(universe_data, {
			name: { query: name_box, mode: name_selected_type },
			ranmat: { query: ranmat_box, mode: ranmat_selected_type },
			coords: coord_box,
			resources: [],
			planetTypeFilters: planet_type_filters,
			starTypeFilters: star_type_filters,
			rings: convertRingState(ring_filter),
			atmosphere: convertTriState(atmosphere_filter),
			tidallyLocked: convertTriState(tidal_filter),
			temperatureRange: temperature_range,
			gravityRange: gravity_range,
			...({ resourcesTri: convertedResourceTri } as any),
			color: color_hex,
			colorSimilarity: color_similarity,
			secondaryColor: secondary_color_hex,
			secondaryColorSimilarity: secondary_color_similarity,
			earthlikesInSystem: convertTriState(earthlikes_filter)
		} as any);
	}

	function run() {
		const now = Date.now();
		
		if (searchTimeoutId !== null) {
			clearTimeout(searchTimeoutId);
		}

		if (now - lastSearchTime >= SEARCH_RATE_LIMIT) {
			lastSearchTime = now;
			runSearch();
		} else {
			searchTimeoutId = setTimeout(() => {
				lastSearchTime = Date.now();
				runSearch();
				searchTimeoutId = null;
			}, SEARCH_RATE_LIMIT - (now - lastSearchTime));
		}
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

<Window bind:left bind:top collapsible={true} minWidth={spMinWidth} maxHeight={spMaxHeight}>
	<span slot="title">Search</span>

	<div class="form {sizeClass}" bind:this={formEl}>
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
						bind:this={hexPickerEl}
						color={color_hex}
						on:color-changed={(e: any) => {
							color_hex = e.detail.value;
							color_input = color_hex;
							run();
						}}
					></hex-color-picker>
				{/if}
				<div class="color-sim">
					<label class="field">
						<span class="label">Manual color</span>
						<input
							class="input"
							bind:value={color_input}
							on:input={color_text_oninput}
							placeholder="#ff8800 or rgb(255,136,0)"
						/>
					</label>
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
							color_input = '';
							color_similarity = 0;
							run();
						}}>Clear</button
					>
				</div>
			</div>
			<h3>Secondary Color</h3>
			<div class="color-row">
				{#if colorPickerReady}
					<hex-color-picker
						bind:this={hexPickerSecondaryEl}
						color={secondary_color_hex}
						on:color-changed={(e: any) => {
							secondary_color_hex = e.detail.value;
							secondary_color_input = secondary_color_hex;
							run();
						}}
					></hex-color-picker>
				{/if}
				<div class="color-sim">
					<label class="field">
						<span class="label">Manual color</span>
						<input
							class="input"
							bind:value={secondary_color_input}
							on:input={secondary_color_text_oninput}
							placeholder="#ff8800 or rgb(255,136,0)"
						/>
					</label>
					<label class="field">
						<span class="label"
							>Color tolerance {secondary_color_similarity}% {secondary_color_similarity === 0 ? '(off)' : ''}</span
						>
						<input
							type="range"
							min="0"
							max="100"
							bind:value={secondary_color_similarity}
							on:input={() => run()}
						/>
					</label>
					<button
						type="button"
						class="clear"
						on:click={() => {
							secondary_color_hex = '';
							secondary_color_input = '';
							secondary_color_similarity = 0;
							run();
						}}>Clear</button
					>
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
							<span class="tri-pill-check">
								{#if planet_type_filters[Number(key)] === 1}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
										/>
									</svg>
								{:else if planet_type_filters[Number(key)] === -1}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<circle cx="12" cy="12" r="10" />
									</svg>
								{/if}
							</span>
							{PlanetType[Number(key)]}
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<section class="section">
			<h3>Star Type</h3>
			<div class="star-grid">
				{#each Object.keys(StarType).filter((k) => !isNaN(Number(k))) as key (key)}
					{#if !isNaN(Number(key))}
						<button
							type="button"
							class="tri-pill sm {star_type_filters[Number(key)] === 1
								? 'on'
								: ''} {star_type_filters[Number(key)] === -1 ? 'off' : ''}"
							on:click={() => {
								const n = Number(key);
								star_type_filters[n] = ((star_type_filters[n] + 2) % 3) - 1;
								run();
							}}
							aria-pressed={star_type_filters[Number(key)] !== 0}
						>
							<span class="tri-pill-check">
								{#if star_type_filters[Number(key)] === 1}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
										/>
									</svg>
								{:else if star_type_filters[Number(key)] === -1}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-6"
									>
										<circle cx="12" cy="12" r="10" />
									</svg>
								{/if}
							</span>
							{StarType[Number(key)]}
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<section class="section compact2">
			<div class="sub">
				<h3>Temperature ({temperature_range[0]} to {temperature_range[1]})</h3>
				<div class="unscaled">
					<RangeSlider
						min={-400}
						max={400}
						values={temperature_range}
						range
						on:change={(e) => {
							temperature_range = e.detail.values;
							run();
						}}
						class="rs"
					/>
				</div>
			</div>
			<div class="sub">
				<h3>Gravity ({gravity_range[0]}g to {gravity_range[1]}g)</h3>
				<div class="unscaled">
					<RangeSlider
						min={0}
						max={400}
						values={gravity_range}
						range
						on:change={(e) => {
							gravity_range = e.detail.values;
							run();
						}}
						class="rs"
					/>
				</div>
			</div>
		</section>

		<section class="section compact4">
			<div class="sub">
				<h3>Atmosphere</h3>
				<TriStateFilter
					value={atmosphere_filter}
					onChange={(newValue) => {
						atmosphere_filter = newValue;
						run();
					}}
					className="sm"
				/>
			</div>
			<div class="sub">
				<h3>Rings</h3>
				<TriStateFilter
					value={ring_filter}
					onChange={(newValue) => {
						ring_filter = newValue;
						run();
					}}
					yesLabel="Has"
					className="sm"
				/>
			</div>
			<div class="sub">
				<h3>Tidally Locked</h3>
				<TriStateFilter
					value={tidal_filter}
					onChange={(newValue) => {
						tidal_filter = newValue;
						run();
					}}
					className="sm"
				/>
			</div>
			<div class="sub">
				<h3>Earthlikes in System</h3>
				<TriStateFilter
					value={earthlikes_filter}
					onChange={(newValue) => {
						earthlikes_filter = newValue;
						run();
					}}
					className="sm"
				/>
			</div>
		</section>

		<section class="section">
			<h3>Resources</h3>
			<div class="res-grid">
				{#each allResources as r}
					<div class="res-tri">
						<div class="res-name">{Resource[r]}</div>
						<TriStateFilter
							value={resource_tri[r]}
							onChange={(newValue) => {
								resource_tri[r] = newValue;
								run();
							}}
							className="xs"
						/>
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
		gap: calc(0.75rem * var(--ui-scale));
		padding-bottom: 40px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr minmax(8rem, 30%);
		gap: calc(0.5rem * var(--ui-scale));
		align-items: end;
	}
	.form.md .row {
		grid-template-columns: 1fr minmax(9rem, 34%);
	}
	.form.sm .row {
		grid-template-columns: 1fr 42%;
	}
	.form.xs .row {
		grid-template-columns: 1fr;
	}
	.form.xs .field.narrow {
		width: 100%;
	}
	.form.sm .section.compact4,
	.form.md .section.compact4 {
		grid-template-columns: repeat(2, 1fr);
	}
	.form.xs .section.compact4 {
		grid-template-columns: repeat(2, 1fr);
	}
	.form.xs .section.compact2,
	.form.sm .section.compact2 {
		grid-template-columns: 1fr;
	}
	.form.md .star-grid {
		grid-template-columns: repeat(2, 1fr);
	}
	.form.sm .star-grid {
		grid-template-columns: repeat(2, 1fr);
	}
	.form.xs .star-grid {
		grid-template-columns: 1fr;
	}
	.form.xs .res-grid {
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
	}
	.form.sm .res-grid {
		grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
	}
	.form.md .res-grid {
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}
	.form.sm .res-tri {
		grid-template-columns: minmax(0, 5.5rem) 1fr;
	}
	.form.sm .res-name {
		white-space: nowrap;
	}
	.form.xs .res-tri {
		grid-template-columns: 1fr;
	}
	.form.xs .res-name {
		font-size: 0.78rem;
		white-space: normal;
	}
	.field {
		display: grid;
		gap: calc(0.35rem * var(--ui-scale));
	}
	.field.narrow {
		width: 100%;
	}
	.label {
		font-size: calc(0.78rem * var(--ui-scale));
		opacity: 0.8;
	}
	.input,
	.select {
		appearance: none;
		border: 1px solid var(--green-3);
		border-radius: 0.5rem;
		background: var(--bg);
		color: var(--text);
		padding: calc(0.45rem * var(--ui-scale)) calc(0.6rem * var(--ui-scale));
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
		gap: calc(0.5rem * var(--ui-scale));
	}
	.section.compact2 {
		grid-template-columns: 1fr 1fr;
		gap: calc(0.5rem * var(--ui-scale));
	}
	.section.compact4 {
		grid-template-columns: repeat(4, 1fr);
		gap: calc(0.5rem * var(--ui-scale));
	}
	.sub {
		display: grid;
		gap: calc(0.4rem * var(--ui-scale));
	}
	h3 {
		margin: 0;
		font-size: calc(0.9rem * var(--ui-scale));
	}

	.pill-wrap {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.4rem;
	}
	.pill-wrap .tri-pill {
		width: 100%;
		justify-content: flex-start;
	}
	.form.md .pill-wrap {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.form.sm .pill-wrap {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.form.xs .pill-wrap {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.star-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.3rem;
	}
	.form.md .star-grid {
		grid-template-columns: repeat(3, 1fr);
	}
	.form.sm .star-grid {
		grid-template-columns: repeat(3, 1fr);
	}
	.form.xs .star-grid {
		grid-template-columns: repeat(2, 1fr);
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
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.9;
	}
	.tri-pill-check svg {
		width: 0.9rem;
		height: 0.9rem;
		flex-shrink: 0;
	}

	.res-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.6rem 0.8rem;
	}
	.res-tri {
		display: grid;
		grid-template-columns: minmax(0, 5.8rem) 1fr;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}
	.res-name {
		opacity: 0.9;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
