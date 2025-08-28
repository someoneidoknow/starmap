const validSizes = [48, 50, 60, 75, 100, 110, 150, 180, 352, 420, 720];
const cache = new Map();
const ttl = 1000 * 60 * 30;

export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	let size = parseInt(url.searchParams.get('size') || '150', 10);

	if (!userId || !/^\d+$/.test(userId)) {
		return new Response(JSON.stringify({ error: 'Invalid userId' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (isNaN(size) || size < 1 || size > 1000) {
		size = 150;
	}

	let apiSize = validSizes.reduce((prev, curr) =>
		Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
	);

	const key = `${userId}:${apiSize}`;
	const now = Date.now();
	const cached = cache.get(key);
	if (cached && cached.expires > now) {
		return new Response(JSON.stringify(cached.data), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const res = await fetch(
		`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${apiSize}x${apiSize}&format=Png&isCircular=false`
	);
	const data = await res.json();

	cache.set(key, { data, expires: now + ttl });

	return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json' }
	});
}
