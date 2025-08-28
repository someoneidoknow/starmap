export function setCookie(name: string, value: string, days = 30): void {
	const expires = new Date(Date.now() + days * 864e5).toUTCString();
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
	const cookies = document.cookie.split('; ').reduce(
		(acc, pair) => {
			const [key, val] = pair.split('=');
			acc[key] = decodeURIComponent(val);
			return acc;
		},
		{} as Record<string, string>
	);
	return cookies[name] || null;
}

export function deleteCookie(name: string): void {
	document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
