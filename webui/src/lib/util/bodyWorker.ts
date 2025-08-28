export type BodyInfo = Record<string, any>;

const textureMap = new Map<string, ImageBitmap>();

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
			const img = textureMap.get(texName);
			if (img) {
				const size = Math.min(canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0, size, size);
			}
			return;
		}

		if (info.Type === 'Planet') {
			const subtype: string = info.SubType;
			let baseTextureName: string;
			let overlayTextureName: string | null = null;
			let ringTextureName: string | null = null;

			if (subtype === 'EarthLike') {
				baseTextureName = 'earthlike';
			} else if (subtype === 'RobotFactory' || subtype === 'RobotDepot') {
				return;
			} else {
				baseTextureName = `${subtype.toLowerCase()}1`;
				overlayTextureName = `${subtype.toLowerCase()}2`;
			}

			if (info.Rings && info.Rings.Type) {
				const ringType = String(info.Rings.Type).toLowerCase();
				ringTextureName = `${ringType}ring`;
			}

			const baseImg = textureMap.get(baseTextureName);
			if (!baseImg) return;

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

			if (overlayTextureName && Array.isArray(info.SecondaryColor)) {
				const overlayImg = textureMap.get(overlayTextureName);
				if (overlayImg) {
					const overlayCanvas = tintImage(overlayImg, info.SecondaryColor as [number, number, number]);
					ctx.drawImage(overlayCanvas, 0, 0, size, size);
				}
			}

			if (ringTextureName) {
				const ringImg = textureMap.get(ringTextureName);
				if (ringImg) {
					ctx.drawImage(ringImg, 0, 0, size, size);
				}
			}
		}
	} catch {}
}

onmessage = async (e) => {
	const data = e.data;

	if (data.type === 'init') {
		const { textures } = data;
		for (const [name, texture] of Object.entries(textures)) {
			textureMap.set(name, texture as ImageBitmap);
		}
		postMessage({ initialized: true });
		return;
	}

	const { canvas, info } = data;
	await renderBodyOffscreen(canvas, info);
	postMessage({ done: true });
};
