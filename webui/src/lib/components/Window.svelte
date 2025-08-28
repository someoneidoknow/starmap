<script lang="ts">
	import { onMount } from 'svelte';
	export let left = 200;
	export let top = 200;
	export let collapsible = false;
	export let collapsed = false;
	export let width: number | undefined = undefined;
	export let minWidth: number | undefined = undefined;
	export let maxWidth: number | undefined = undefined;
	export let height: number | undefined = undefined;
	export let minHeight: number | undefined = undefined;
	export let maxHeight: number | undefined = undefined;

	let startX = 0;
	let startY = 0;
	let baseL = 0;
	let baseT = 0;
	let startW = 0;
	let startH = 0;
	let dir = '';
	let panelEl: HTMLDivElement;
	let headerEl: HTMLDivElement;
	let effMinW = 0,
		effMinH = 0,
		effMaxW: number | undefined,
		effMaxH: number | undefined;
	let savedHeight = 0;
	let headerHeight = 0;

	function dragStart(e: MouseEvent) {
		startX = e.clientX;
		startY = e.clientY;
		baseL = left;
		baseT = top;
		window.addEventListener('mousemove', dragMove);
		window.addEventListener('mouseup', dragEnd);
		e.preventDefault();
	}
	function dragMove(e: MouseEvent) {
		left = baseL + e.clientX - startX;
		top = baseT + e.clientY - startY;
	}
	function dragEnd() {
		window.removeEventListener('mousemove', dragMove);
		window.removeEventListener('mouseup', dragEnd);
	}
	function toggle() {
		if (!collapsible) return;
		if (!collapsed) {
			savedHeight = height ?? panelEl?.offsetHeight ?? 0;
			if (width === undefined && panelEl) {
				width = panelEl.offsetWidth;
			}
		} else {
			if (savedHeight) height = savedHeight;
		}
		collapsed = !collapsed;
	}

	function resizeStart(e: MouseEvent, d: string) {
		if (collapsed && (d.includes('n') || d.includes('s'))) return;
		e.stopPropagation();
		dir = d;
		startX = e.clientX;
		startY = e.clientY;
		baseL = left;
		baseT = top;
		startW = (width ?? panelEl?.offsetWidth) || 0;
		startH = (height ?? panelEl?.offsetHeight) || 0;
		effMinW = minWidth ?? 180;
		effMinH = minHeight ?? 120;
		if (maxWidth !== undefined) effMaxW = maxWidth;
		else {
			const mwStr = panelEl ? getComputedStyle(panelEl).maxWidth : '';
			if (mwStr && mwStr !== 'none') {
				const v = parseInt(mwStr);
				if (!isNaN(v)) effMaxW = v;
			}
		}
		effMaxH = maxHeight ?? (typeof window !== 'undefined' ? window.innerHeight - 40 : undefined);
		window.addEventListener('mousemove', resizeMove);
		window.addEventListener('mouseup', resizeEnd);
		bypassSelection(true);
		e.preventDefault();
	}

	function clamp(v: number, min: number | undefined, max: number | undefined) {
		if (min !== undefined && v < min) v = min;
		if (max !== undefined && v > max) v = max;
		return v;
	}

	function resizeMove(e: MouseEvent) {
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		let newW = startW;
		let newH = startH;
		let newL = baseL;
		let newT = baseT;
		if (dir.includes('e')) newW = clamp(startW + dx, effMinW, effMaxW);
		if (dir.includes('s')) newH = clamp(startH + dy, effMinH, effMaxH);
		if (dir.includes('w')) {
			const desired = startW - dx;
			if (effMaxW !== undefined && desired >= effMaxW) {
				newW = effMaxW;
				newL = baseL + (startW - effMaxW);
			} else {
				newW = clamp(desired, effMinW, effMaxW);
				newL = baseL + (startW - newW);
				if (newW === effMinW && desired < effMinW) newL = baseL + (startW - effMinW);
			}
		}
		if (dir.includes('n')) {
			const raw = startH - dy;
			newH = clamp(raw, effMinH, effMaxH);
			newT = baseT + (startH - newH);
			if (newH === effMinH && raw < effMinH) newT = baseT + (startH - effMinH);
		}
		left = newL;
		top = newT;
		width = newW;
		height = newH;
	}

	function resizeEnd() {
		window.removeEventListener('mousemove', resizeMove);
		window.removeEventListener('mouseup', resizeEnd);
		bypassSelection(false);
	}

	function bypassSelection(active: boolean) {
		if (active) document.body.classList.add('resizing');
		else document.body.classList.remove('resizing');
	}

	onMount(() => {
		if (minWidth === undefined) minWidth = 180;
		if (minHeight === undefined) minHeight = 120;
		if (maxHeight === undefined && typeof window !== 'undefined')
			maxHeight = window.innerHeight - 40;
		if (headerEl) headerHeight = headerEl.offsetHeight;
	});

	$: if (headerEl) headerHeight = headerEl.offsetHeight;
</script>

<div
	bind:this={panelEl}
	class="panel"
	style:left={`${left}px`}
	style:top={`${top}px`}
	style:width={width ? width + 'px' : undefined}
	style:min-width={minWidth ? minWidth + 'px' : undefined}
	style:max-width={maxWidth ? maxWidth + 'px' : undefined}
	style:height={collapsed ? headerHeight + 'px' : height ? height + 'px' : undefined}
	style:min-height={collapsed ? headerHeight + 'px' : minHeight ? minHeight + 'px' : undefined}
	style:max-height={collapsed ? headerHeight + 'px' : maxHeight ? maxHeight + 'px' : undefined}
>
	<div bind:this={headerEl} class="header" role="toolbar" tabindex="0" on:mousedown={dragStart}>
		<slot name="title"></slot>
		{#if collapsible}
			<button class="arrow" on:click|stopPropagation={toggle}>{collapsed ? '▸' : '▾'}</button>
		{/if}
	</div>
	{#if !collapsed}
		<div class="body"><slot /></div>
	{/if}
	<div class="resizer edge n" role="presentation" on:mousedown={(e) => resizeStart(e, 'n')}></div>
	<div class="resizer edge s" role="presentation" on:mousedown={(e) => resizeStart(e, 's')}></div>
	<div class="resizer edge e" role="presentation" on:mousedown={(e) => resizeStart(e, 'e')}></div>
	<div class="resizer edge w" role="presentation" on:mousedown={(e) => resizeStart(e, 'w')}></div>
	<div
		class="resizer corner ne"
		role="presentation"
		on:mousedown={(e) => resizeStart(e, 'ne')}
	></div>
	<div
		class="resizer corner nw"
		role="presentation"
		on:mousedown={(e) => resizeStart(e, 'nw')}
	></div>
	<div
		class="resizer corner se"
		role="presentation"
		on:mousedown={(e) => resizeStart(e, 'se')}
	></div>
	<div
		class="resizer corner sw"
		role="presentation"
		on:mousedown={(e) => resizeStart(e, 'sw')}
	></div>
</div>

<style>
	.panel {
		position: fixed;
		min-width: calc(180px * var(--ui-scale));
		max-width: calc(640px * var(--ui-scale));
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--green-4);
		border-radius: calc(0.5rem * var(--ui-scale));
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
		overflow: hidden;
		z-index: 900;
		font-family: system-ui, sans-serif;
		transform: scale(var(--ui-scale));
		transform-origin: top left;
	}
	.panel .body {
		overflow: auto;
		height: 100%;
		box-sizing: border-box;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: move;
		padding: calc(0.6rem * var(--ui-scale)) calc(1rem * var(--ui-scale))
			calc(0.5rem * var(--ui-scale));
		background: var(--green-1);
		border-bottom: 1px solid var(--green-4);
		border-radius: calc(0.5rem * var(--ui-scale)) calc(0.5rem * var(--ui-scale)) 0 0;
		user-select: none;
	}
	.arrow {
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 1rem;
		cursor: pointer;
		padding: 0;
	}
	.body {
		padding: calc(0.5rem * var(--ui-scale)) calc(1rem * var(--ui-scale))
			calc(0.8rem * var(--ui-scale)) calc(1.8rem * var(--ui-scale));
	}
	.resizer {
		position: absolute;
		z-index: 20;
	}
	.edge {
		background: transparent;
	}
	.edge.n {
		top: -3px;
		left: 6px;
		right: 6px;
		height: 6px;
		cursor: ns-resize;
	}
	.edge.s {
		bottom: -3px;
		left: 6px;
		right: 6px;
		height: 6px;
		cursor: ns-resize;
	}
	.edge.e {
		top: 6px;
		bottom: 6px;
		right: -3px;
		width: 6px;
		cursor: ew-resize;
	}
	.edge.w {
		top: 6px;
		bottom: 6px;
		left: -3px;
		width: 6px;
		cursor: ew-resize;
	}
	.corner {
		width: 12px;
		height: 12px;
	}
	.corner.ne {
		top: -4px;
		right: -4px;
		cursor: nesw-resize;
	}
	.corner.nw {
		top: -4px;
		left: -4px;
		cursor: nwse-resize;
	}
	.corner.se {
		bottom: -4px;
		right: -4px;
		cursor: nwse-resize;
	}
	.corner.sw {
		bottom: -4px;
		left: -4px;
		cursor: nesw-resize;
	}
	:global(body.resizing) {
		user-select: none;
	}
</style>
