<script lang="ts">
	import Window from './Window.svelte';
	import Planet from './Planet.svelte';

	export let info: Record<string, any> = {};
	export let left = 200;
	export let top = 200;
	export let selected = { x: 0, y: 0, z: 0, w: 0 };

	let copied = false;
	let linkCopied = false;

	const translateTable: Record<string, string> = {
		Type: 'Type',
		SubType: 'Subtype',
		PrimaryColor: 'Primary Color',
		SecondaryColor: 'Secondary Color',
		RandomMaterial: 'Random Material'
	};

	$: resourceEntries = info.Resources ? Object.entries(info.Resources) : [];

	const resourceColors: Record<string, string> = {
		Iron: "#635F62",
		Copper: "#DA8541",
		Coal: "#1B2A35",
		Lead: "#43475A",
		Titanium: "#BBB3B2",
		Uranium: "#2BA123",
		Jade: "#55911D",
		Gold: "#EFB838",
		Diamond: "#98C2DB",
		Beryllium: "#B9C4B1",
		Aluminum: "#CACBD1"
	};

	function getTextColor(bgColor: string): string {
		const r = parseInt(bgColor.slice(1, 3), 16);
		const g = parseInt(bgColor.slice(3, 5), 16);
		const b = parseInt(bgColor.slice(5, 7), 16);
	
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	function copyCoordinates() {
		const coords = `${selected.x}, ${selected.y}, ${selected.z}, ${selected.w}`;
		navigator.clipboard.writeText(coords);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}

	function copyLink() {
		const coordStr = `${selected.x},${selected.y},${selected.z},${selected.w}`;
		const current = new URL(window.location.href);
		const params = current.searchParams;
		params.delete('c');
		let other = '';
		params.forEach((v, k) => {
			other += (other ? '&' : '') + encodeURIComponent(k) + '=' + encodeURIComponent(v);
		});
		const base = current.origin + current.pathname;
		const url = base + '?' + (other ? other + '&' : '') + 'c=' + coordStr + (current.hash || '');
		navigator.clipboard.writeText(url);
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 1200);
	}
</script>

<Window bind:left bind:top autoWidth={true}>
	<span slot="title">
		{#key JSON.stringify(info)}
			<Planet {info} />
		{/key}

		{info.Name ? info.Name : info.SubType ? `${info.SubType} ${info.Type}` : info.Type}
		<span class="coords">{selected.x}, {selected.y}, {selected.z}, {selected.w}</span>
		<button class="copy-button" on:click={copyCoordinates} aria-label="Copy coordinates">
			{#if copied}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-6 fade"
					><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg
				>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-6"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
					/></svg
				>
			{/if}
		</button>
		<button class="copy-button" on:click={copyLink} aria-label="Copy link">
			{#if linkCopied}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-6 fade"
					><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg
				>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
			{/if}
		</button>
	</span>

	<ul>
		{#each Object.entries(info) as [k, v] (k)}
			{@const translatedKey = translateTable[k] || k}
			{#if k !== 'Name' && k !== 'Resources' && k !== 'Material' && k !== 'DayCycleIncrement' && k !== 'StartingTime' && k !== 'GenerationHeightScale' && k !== 'WaterLevel' && k !== 'Rings'}
				{#if k.endsWith('Color') && Array.isArray(v)}
					<li class="color">
						<strong>{translatedKey}:</strong><span
							class="swatch"
							style="background: rgb({v.join(',')})"
						></span>{v.join(', ')}
					</li>
				{:else if k === 'Atmosphere'}
					<li><strong>Atmosphere:</strong> {v ? 'Yes' : 'No'}</li>
				{:else}
					<li><strong>{translatedKey}:</strong> {v}</li>
				{/if}
			{/if}
		{/each}
		{#if info.Type === 'Planet'}
			<li><strong>Rings:</strong> {info.Rings?.Type ?? 'None'}</li>
		{/if}
		{#if resourceEntries.length}
			<li class="resources">
				<strong>Resources:</strong>
				<div class="resource-chips">
					{#each resourceEntries as [mat, qty] (mat)}
						<span 
							class="resource-chip" 
							style="background-color: {resourceColors[mat] || '#666'}; color: {getTextColor(resourceColors[mat] || '#666')}"
						>
							{mat}
						</span>
					{/each}
				</div>
			</li>
		{/if}
	</ul>
</Window>

<style>
	.coords {
		font-size: calc(0.8em * var(--ui-scale));
		color: var(--green-3);
		margin-left: 0.5em;
	}

	.copy-button {
		background: none;
		color: var(--text);
		border: none;
		margin-left: 0.5em;
		padding: 0;
		position: relative;
  		top: 3px;
		width: calc(1.5em * var(--ui-scale));
		height: calc(1.5em * var(--ui-scale));
		cursor: pointer;
	}
	.copy-button svg {
	  	width: 100%;
	  	height: 100%;
	}

	.size-6 {
		width: calc(1em * var(--ui-scale));
		height: calc(1em * var(--ui-scale));
		color: var(--green-3);
		transition: opacity 0.3s ease;
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
	ul {
		margin: 0;
		padding: 0;
	}
	li {
		line-height: calc(1.4em * var(--ui-scale));
		word-break: break-word;
	}
	.color .swatch {
		display: inline-block;
		width: calc(1rem * var(--ui-scale));
		height: calc(0.85rem * var(--ui-scale));
		margin: 0 calc(0.4rem * var(--ui-scale)) 0 calc(0.5rem * var(--ui-scale));
		vertical-align: text-bottom;
		border: 1px solid var(--green-4);
		border-radius: calc(0.2rem * var(--ui-scale));
	}
	.resource-chips {
		display: flex;
		flex-wrap: wrap;
		gap: calc(0.35rem * var(--ui-scale));
		margin-top: calc(0.4rem * var(--ui-scale));
		max-width: calc(300px * var(--ui-scale));
	}
	.resource-chip {
		border-radius: calc(0.3rem * var(--ui-scale));
		padding: calc(0.2rem * var(--ui-scale)) calc(0.5rem * var(--ui-scale));
		font-size: calc(0.8rem * var(--ui-scale));
		font-weight: 500;
		white-space: nowrap;
		border: 1px solid rgba(0, 0, 0, 0.2);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
