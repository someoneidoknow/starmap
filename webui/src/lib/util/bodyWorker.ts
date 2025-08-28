export type BodyInfo = Record<string, any>;

const imageCache = new Map<string, ImageBitmap>();

async function loadImage(src: string): Promise<ImageBitmap> {
	if (imageCache.has(src)) return imageCache.get(src)!;
	const resp = await fetch(src);
	const blob = await resp.blob();
	const bmp = await createImageBitmap(blob);
	imageCache.set(src, bmp);
	return bmp;
}

function tintImage(img: ImageBitmap, color: [number, number, number]): OffscreenCanvas {
	const c = new OffscreenCanvas(img.width, img.height);
	const ctx = c.getContext('2d')!;
	(ctx as any).imageSmoothingEnabled = false;
	ctx.drawImage(img, 0, 0);
	const imgData = ctx.getImageData(0, 0, c.width, c.height);
	const d = imgData.data;
	for (let i = 0; i < d.length; i += 4) {
		d[i] = d[i] * (color[0] / 255);
		d[i + 1] = d[i + 1] * (color[1] / 255);
		d[i + 2] = d[i + 2] * (color[2] / 255);
	}
	ctx.putImageData(imgData, 0, 0);
	return c;
}

async function renderBodyOffscreen(canvas: OffscreenCanvas, info: BodyInfo) {
	if (!canvas || !info || !info.Type) return;
	const ctx = canvas.getContext('2d')!;
	(ctx as any).imageSmoothingEnabled = false;
	try {
		(ctx as any).imageSmoothingQuality = 'low';
	} catch {}
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	try {
		const validStarSubTypes = ['Red', 'Orange', 'Yellow', 'Blue', 'Neutron', 'BlackHole'];
		const isStar =
			(info.Type === 'Star' && validStarSubTypes.includes(info.SubType)) ||
			info.Type === 'BlackHole';
		if (isStar) {
			const sub = info.SubType || info.Type;
			const texName = sub.toLowerCase();
			const src = `/assets/startexture/${texName}.png`;
			const img = await loadImage(src);
			const size = Math.min(canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0, size, size);
			return;
		}

		if (info.Type === 'Planet') {
			const subtype: string = info.SubType;
			let baseSrc: string;
			let overlaySrc: string | null = null;
			if (subtype === 'EarthLike') {
				baseSrc = '/assets/planettexture/earthlike.png';
			} else if (subtype === 'RobotFactory' || subtype === 'RobotDepot') {
				return;
			} else {
				baseSrc = `/assets/planettexture/${subtype.toLowerCase()}1.png`;
				overlaySrc = `/assets/planettexture/${subtype.toLowerCase()}2.png`;
			}
			const baseImg = await loadImage(baseSrc);
			let baseCanvas: OffscreenCanvas;
			if (subtype === 'EarthLike') {
				baseCanvas = new OffscreenCanvas(baseImg.width, baseImg.height);
				baseCanvas.getContext('2d')!.drawImage(baseImg, 0, 0);
			} else if (Array.isArray(info.PrimaryColor)) {
				baseCanvas = tintImage(baseImg, info.PrimaryColor as [number, number, number]);
			} else {
				baseCanvas = new OffscreenCanvas(baseImg.width, baseImg.height);
				baseCanvas.getContext('2d')!.drawImage(baseImg, 0, 0);
			}
			const size = Math.min(canvas.width, canvas.height);
			ctx.drawImage(baseCanvas, 0, 0, size, size);
			if (overlaySrc && Array.isArray(info.SecondaryColor)) {
				try {
					const overlayImg = await loadImage(overlaySrc);
					const overlayCanvas = tintImage(
						overlayImg,
						info.SecondaryColor as [number, number, number]
					);
					ctx.drawImage(overlayCanvas, 0, 0, size, size);
				} catch {}
			}
			if (info.Rings && info.Rings.Type) {
				const ringType = String(info.Rings.Type).toLowerCase();
				const ringSrc = `/assets/planettexture/${ringType}ring.png`;
				try {
					const ringImg = await loadImage(ringSrc);
					ctx.drawImage(ringImg, 0, 0, size, size);
				} catch {}
			}
		}
	} catch {}
}

onmessage = async (e) => {
	const { canvas, info } = e.data;
	await renderBodyOffscreen(canvas, info);
	postMessage({ done: true });
};
