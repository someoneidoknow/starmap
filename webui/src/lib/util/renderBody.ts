import type { BodyInfo } from './bodyWorker.ts';
import type { AtlasData } from './types.ts';
import { browser } from '$app/environment';

let workers: Worker[] = [];
let nextWorker = 0;
let textureMap: Map<string, ImageBitmap> | null = null;
let textureLoadingPromise: Promise<Map<string, ImageBitmap>> | null = null;
let workersInitialized = false;

if (browser) {
	workers = [
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' }),
		new Worker(new URL('./bodyWorker.ts', import.meta.url), { type: 'module' })
	];
}

async function initializeWorkers() {
	if (workersInitialized) return;

	const textures = await loadAtlasTextures();
	const textureObject = Object.fromEntries(textures);

	await Promise.all(workers.map(worker => 
		new Promise<void>((resolve) => {
			const messageHandler = (e: MessageEvent) => {
				if (e.data.initialized) {
					worker.removeEventListener('message', messageHandler);
					resolve();
				}
			};
			worker.addEventListener('message', messageHandler);
			worker.postMessage({ type: 'init', textures: textureObject });
		})
	));

	workersInitialized = true;
}

async function loadAtlasTextures(): Promise<Map<string, ImageBitmap>> {
	if (textureMap) return textureMap;

	if (textureLoadingPromise) return textureLoadingPromise;

	textureLoadingPromise = (async () => {
		try {
			const [atlasResponse, imageResponse] = await Promise.all([
				fetch('/assets/textures.msgpack.zst'),
				fetch('/assets/textures.png')
			]);

			const compressedData = new Uint8Array(await atlasResponse.arrayBuffer());
			const decoder = new (await import('zstddec')).ZSTDDecoder();
			await decoder.init();
			const decompressed = decoder.decode(compressedData, 16384);
			const atlasData = (await import('@msgpack/msgpack')).decode(decompressed) as AtlasData;

			const imageBlob = await imageResponse.blob();
			const atlasImage = await createImageBitmap(imageBlob);

			textureMap = new Map();
			for (const [textureName, frameData] of Object.entries(atlasData.frames)) {
				const { x, y, w, h } = frameData.frame;
				const canvas = new OffscreenCanvas(w, h);
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(atlasImage, x, y, w, h, 0, 0, w, h);
				const texture = await createImageBitmap(canvas);
				textureMap.set(textureName, texture);
			}

			return textureMap;
		} catch (error) {
			textureLoadingPromise = null;
			throw new Error(`Failed to load texture atlas: ${error}`);
		} finally {
			textureLoadingPromise = null;
		}
	})();

	return textureLoadingPromise;
}

let lastReset = performance.now();
let sentThisSecond = 0;
const MAX_PER_SECOND = 100;

export async function renderBody(canvas: HTMLCanvasElement, info: BodyInfo) {
	if (!browser) return;
	if (!canvas || !info || !info.Type) return;

	await initializeWorkers();

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
