<script lang="ts">
	import Window from './Window.svelte';
	import Planet from './Planet.svelte';

	export let info: Record<string, any> = {};
	export let left = 200;
	export let top = 200;
	export let selected = { x: 0, y: 0, z: 0, w: 0 };

	let copied = false;

	const translateTable: Record<string, string> = {
		Type: 'Type',
		SubType: 'Subtype',
		PrimaryColor: 'Primary Color',
		SecondaryColor: 'Secondary Color',
		RandomMaterial: 'Random Material'
	};

	$: resourceEntries = info.Resources ? Object.entries(info.Resources) : [];

	function copyCoordinates() {
		const coords = `${selected.x}, ${selected.y}, ${selected.z}, ${selected.w}`;
		navigator.clipboard.writeText(coords);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<Window bind:left bind:top>
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
				<ul>
					{#each resourceEntries as [mat, qty] (mat)}<li>{mat}: {qty}</li>{/each}
				</ul>
			</li>
		{/if}
	</ul>
</Window>

<style>
	.coords {
		font-size: 0.8em;
		color: var(--green-3);
		margin-left: 0.5em;
	}

	.copy-button {
		background: none;
		color: var(--text);
		border: none;
		padding: 0;
		margin-left: 0.5em;
		cursor: pointer;
	}
	.size-6 {
		width: 1em;
		height: 1em;
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
		line-height: 1.4em;
		word-break: break-word;
	}
	.color .swatch {
		display: inline-block;
		width: 1rem;
		height: 0.85rem;
		margin: 0 0.4rem 0 0.5rem;
		vertical-align: text-bottom;
		border: 1px solid var(--green-4);
		border-radius: 0.2rem;
	}
	.resources ul {
		list-style-type: disc;
		margin: 0.25rem 0 0 1.2rem;
		padding: 0;
	}
</style>
