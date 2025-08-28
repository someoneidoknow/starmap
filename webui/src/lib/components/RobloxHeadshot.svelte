<script lang="ts">
	import { onMount } from 'svelte';
	export let userId: number;
	export let size: number = 150;
	let url: string = '';

	async function fetchHeadshot(id: number) {
		const res = await fetch(`/wapi/headshot?userId=${userId}&size=${size}`);
		const data = await res.json();
		url = data.data[0]?.imageUrl || '';
	}

	onMount(() => {
		if (userId) fetchHeadshot(userId);
	});

	$: if (userId) fetchHeadshot(userId);
</script>

{#if url}
	<img src={url} alt="Roblox Headshot" width={size} height={size} />
{/if}
