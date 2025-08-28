import type { BodyInfo } from './bodyWorker.ts';
import { browser } from '$app/environment';

let workers: Worker[] = [];
let nextWorker = 0;

if (browser) {
	workers = [
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' })
	];
}

let lastReset = performance.now();
let sentThisSecond = 0;
const MAX_PER_SECOND = 100;

export async function renderBody(canvas: HTMLCanvasElement, info: BodyInfo) {
	if (!browser) return;
	if (!canvas || !info || !info.Type) return;

	const now = performance.now();
	if (now - lastReset > 1000) {
		lastReset = now;
		sentThisSecond = 0;
	}
	if (sentThisSecond >= MAX_PER_SECOND) {
		const wait = 1000 - (now - lastReset);
		await new Promise((resolve) => setTimeout(resolve, wait));
		lastReset = performance.now();
		sentThisSecond = 0;
	}

	sentThisSecond++;

	const offscreen = canvas.transferControlToOffscreen();
	const worker = workers[nextWorker];
	nextWorker = (nextWorker + 1) % workers.length;
	worker.postMessage({ canvas: offscreen, info }, [offscreen]);
}
