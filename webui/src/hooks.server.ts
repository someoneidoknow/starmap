import type { Handle } from '@sveltejs/kit';
import { generatePlanetTexture, getUniverseEntry, findPlanetByRandomMaterialPrefix } from '$lib/server/planetPreview';

const DISCORD_MATCHERS = ['discordbot', 'discord'];

function isDiscord(ua: string) { return DISCORD_MATCHERS.some((m) => ua.includes(m)); }

export const handle: Handle = async ({ event, resolve }) => {
	const url = new URL(event.request.url);
	const ua = (event.request.headers.get('user-agent') || '').toLowerCase();

	if (url.pathname === '/planet-preview.png') {
		let coord = url.searchParams.get('c');
		if (!coord) {
			const ranmat = url.searchParams.get('ranmat');
			if (ranmat) {
				const found = await findPlanetByRandomMaterialPrefix(ranmat);
				if (found) coord = found.coord;
			}
		}
		if (!coord) return new Response('coord or ranmat query required', { status: 400 });
		try {
			const size = Math.min(1024, Math.max(64, parseInt(url.searchParams.get('size') || '512')));
			const buf = await generatePlanetTexture(coord, size);
			if (!buf) return new Response('not found', { status: 404 });
			return new Response(new Uint8Array(buf), {
				headers: {
					'Content-Type': 'image/png',
					'Cache-Control': 'public, max-age=300'
				}
			});
		} catch (e: any) {
			return new Response('error generating image', { status: 500 });
		}
	}

	if (isDiscord(ua)) {
		const coord = url.searchParams.get('c');
        let resolvedCoord = coord;
        if (!resolvedCoord) {
            const ranmat = url.searchParams.get('ranmat');
            if (ranmat) {
                const found = await findPlanetByRandomMaterialPrefix(ranmat);
                if (found) resolvedCoord = found.coord;
            }
        }
        let title = 'Starmap';
        let desc = 'Empty sector';
        let image = url.origin + '/favicon.svg';
		if (resolvedCoord) {
			const entry = await getUniverseEntry(resolvedCoord.replace(/\s+/g, ''));
			if (entry) {
				if (entry.Type === 'Planet') title = entry.Name || `${entry.SubType} Planet`;
				else if (entry.Type === 'Star') title = `${entry.SubType} Star`;
				const escape = (s: string) => s.replace(/["&<>]/g, c => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
				if (entry.Type === 'Planet') {
					desc = escape(`${resolvedCoord} • ${entry.SubType || 'Planet'} • ${entry.RandomMaterial || 'None'}`);
				} else if (entry.Type === 'Star') {
					desc = escape(`${resolvedCoord} • ${entry.SubType || 'Star'}`);
				} else {
					desc = escape(`${resolvedCoord} • ${entry.Type}`);
				}
				image = `${url.origin}/planet-preview.png?c=${encodeURIComponent(resolvedCoord)}`;
			}
		}
		const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url.origin + url.pathname + (url.search || '')}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="96">
<meta property="og:image:height" content="96">
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />
</head><body></body></html>`;
		return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
	}

	return resolve(event);
};
