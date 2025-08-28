<script lang="ts">
	export let items: any[] = [];
	export let rowHeight = 32;
	export let height = 400;
	let scrollTop = 0;
	let container: HTMLDivElement;
	$: totalHeight = items.length * rowHeight;
	$: rawStart = Math.floor(scrollTop / rowHeight);
	$: viewportCount = Math.ceil(height / rowHeight);
	$: bufferAbove = Math.floor(viewportCount / 2);
	$: bufferBelow = Math.floor(viewportCount / 4);
	$: start = Math.max(0, rawStart - bufferAbove);
	$: end = Math.min(items.length, rawStart + viewportCount + bufferBelow);
	$: slice = items.slice(start, end);
	let ticking = false;
	function onScroll() {
		if (!ticking) {
			ticking = true;
			requestAnimationFrame(() => {
				scrollTop = container.scrollTop;
				ticking = false;
			});
		}
	}
</script>

<div class="virt" bind:this={container} style={`height:${height}px`} on:scroll={onScroll}>
	<div style={`height:${totalHeight}px; position:relative;`}>
		<div style={`position:absolute; top:${start * rowHeight}px; left:0; right:0;`}>
			{#each slice as item, i (start + i)}
				<div style={`height:${rowHeight}px;`} class="row-wrap">
					<slot {item} index={start + i}></slot>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.virt {
		overflow-y: auto;
		overflow-x: hidden;
		width: 100%;
		box-sizing: border-box;
		will-change: transform;
		contain: strict;
	}
	.row-wrap {
		display: contents;
	}
</style>
