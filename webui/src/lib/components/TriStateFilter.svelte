<script lang="ts">
	export let value: number = 0; // 0 = any, 1 = yes/has, -1 = no
	export let onChange: (newValue: number) => void = () => {};
	export let yesLabel: string = 'Yes';
	export let noLabel: string = 'No';
	export let anyLabel: string = 'Any';
	export let className: string = '';
</script>

<div class="seg {className}">
	<button
		type="button"
		class:selected={value === 0}
		on:click={() => onChange(0)}
	>{anyLabel}</button>
	<button
		type="button"
		class:selected={value === 1}
		on:click={() => onChange(1)}
	>{yesLabel}</button>
	<button
		type="button"
		class:selected={value === -1}
		on:click={() => onChange(-1)}
	>{noLabel}</button>
</div>

<style>
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
</style>
