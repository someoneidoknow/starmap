import { decode } from '@msgpack/msgpack';
import { ZSTDDecoder } from 'zstddec';
import type { AtlasData } from './types';

let universeData: any = null;
let universePromise: Promise<any> | null = null;
export async function loadUniverse(): Promise<any> {
	if (universeData) return universeData;
	if (!universePromise) {
		universePromise = (async () => {
			const r = await fetch('/assets/Universe.msgpack.zst');
			const u8 = new Uint8Array(await r.arrayBuffer());
			const dec = new ZSTDDecoder();
			await dec.init();
			const data = decode(dec.decode(u8, 16384 * 1024));
			universeData = data;
			return data;
		})();
	}
	return universePromise;
}

let atlasData: AtlasData | null = null;
let atlasImage: HTMLImageElement | null = null;
let atlasPromise: Promise<{ atlasData: AtlasData; image: HTMLImageElement }> | null = null;
export async function loadTextureAtlas(): Promise<{ atlasData: AtlasData; image: HTMLImageElement }> {
	if (atlasData && atlasImage) return { atlasData, image: atlasImage };
	if (!atlasPromise) {
		atlasPromise = (async () => {
			const [atlasResp, imageResp] = await Promise.all([
				fetch('/assets/textures.msgpack.zst'),
				fetch('/assets/textures.png')
			]);
			const atlasCompressed = new Uint8Array(await atlasResp.arrayBuffer());
			const dec = new ZSTDDecoder();
			await dec.init();
			const decoded = dec.decode(atlasCompressed, 16384);
			atlasData = decode(decoded) as AtlasData;
			const blob = await imageResp.blob();
			const url = URL.createObjectURL(blob);
			atlasImage = await new Promise<HTMLImageElement>((res, rej) => {
				const img = new Image();
				img.onload = () => res(img);
				img.onerror = (e) => rej(e);
				img.src = url;
			});
			return { atlasData, image: atlasImage };
		})();
	}
	return atlasPromise;
}
