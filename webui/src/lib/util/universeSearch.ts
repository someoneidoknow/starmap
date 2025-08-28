import {
	search_by_coordinate,
	search_by_name,
	search_by_ranmat,
	search_by_resources
} from './search';
import type {
	NullableCoordinate,
	PlanetResource,
	SearchResult,
	SearchType,
	UniverseData
} from './types';
import { PlanetType, StarType } from './types';

export type Tri = 'any' | 'yes' | 'no';

export interface SearchOptions {
	name: { query: string; mode: SearchType };
	ranmat: { query: string; mode: SearchType };
	coords: string;
	resources?: PlanetResource[];
	planetTypeFilters?: Record<number, number>;
	rings?: 'any' | 'has' | 'no';
	atmosphere?: Tri;
	tidallyLocked?: Tri;
	temperatureRange?: [number, number];
	gravityRange?: [number, number];
	resourcesTri?: Record<number, Tri>;
	color?: string;
	colorSimilarity?: number;
	earthlikesInSystem?: Tri;
	starTypeFilters?: Record<number, number>;
}

export function searchUniverse(universe: UniverseData, opts: SearchOptions): SearchResult | null {
	const name = (opts.name?.query ?? '').trim();
	const ranmat = (opts.ranmat?.query ?? '').trim();
	const coords = string_to_coordinate((opts.coords ?? '').trim());

	const planetTypeFilters = opts.planetTypeFilters ?? {};
	const rings = opts.rings ?? 'any';
	const atmosphere = opts.atmosphere ?? 'any';
	const tidallyLocked = opts.tidallyLocked ?? 'any';
	const temperatureRange: [number, number] = opts.temperatureRange ?? [-300, 300];
	const gravityRange: [number, number] = opts.gravityRange ?? [0, 300];
	const resources = opts.resources ?? [];
	const resourcesTri = opts.resourcesTri ?? {};
	const color = (opts.color ?? '').trim();
	const colorSimilarity =
		typeof opts.colorSimilarity === 'number' ? Math.max(0, Math.min(100, opts.colorSimilarity)) : 0;
	const earthlikesInSystem = opts.earthlikesInSystem ?? 'any';
	const starTypeFilters = opts.starTypeFilters ?? {};

	const activeTriKeys = Object.keys(resourcesTri).filter((k) => resourcesTri[Number(k)] !== 'any');
	const anyTriResources = activeTriKeys.length > 0;

	const nothingSelected =
		name === '' &&
		ranmat === '' &&
		(opts.coords ?? '') === '' &&
		resources.length === 0 &&
		!anyTriResources &&
		Object.values(planetTypeFilters).every((v) => v === 0) &&
		rings === 'any' &&
		atmosphere === 'any' &&
		tidallyLocked === 'any' &&
		temperatureRange[0] === -300 &&
		temperatureRange[1] === 300 &&
		gravityRange[0] === 0 &&
		gravityRange[1] === 300 &&
		color === '' &&
		colorSimilarity === 0 &&
		earthlikesInSystem === 'any' &&
		Object.values(starTypeFilters).every((v) => v === 0);

	if (nothingSelected) return null;

	let res: SearchResult = {
		solar_systems: universe.solar_systems,
		universe_map: new Map()
	};

	if (name !== '') res = search_by_name(res, name, opts.name.mode);
	if (ranmat !== '') res = search_by_ranmat(res, ranmat, opts.ranmat.mode);
	if ((opts.coords ?? '') !== '') res = search_by_coordinate(res, coords);
	if (resources.length !== 0) res = search_by_resources(res, resources);

	const needFilter =
		Object.values(planetTypeFilters).some((v) => v !== 0) ||
		rings !== 'any' ||
		atmosphere !== 'any' ||
		tidallyLocked !== 'any' ||
		anyTriResources ||
		temperatureRange[0] !== -300 ||
		temperatureRange[1] !== 300 ||
		gravityRange[0] !== 0 ||
		gravityRange[1] !== 300 ||
		color !== '' ||
		colorSimilarity !== 0 ||
		earthlikesInSystem !== 'any' ||
		Object.values(starTypeFilters).some((v) => v !== 0);

	if (needFilter) {
		const filtered_systems = [];

		for (const system of res.solar_systems) {
			if (earthlikesInSystem !== 'any') {
				const hasEarthlike = system.planets.some(p => p.type === PlanetType.EarthLike);
				if (earthlikesInSystem === 'yes' && !hasEarthlike) continue;
				if (earthlikesInSystem === 'no' && hasEarthlike) continue;
			}

			if (Object.values(starTypeFilters).some((v) => v !== 0)) {
				const hasMatchingStar = system.stars.some(star => {
					const starState = starTypeFilters[star.type] ?? 0;
					return starState === 1;
				});
				const hasExcludedStar = system.stars.some(star => {
					const starState = starTypeFilters[star.type] ?? 0;
					return starState === -1;
				});
				if (hasExcludedStar) continue;
				if (Object.values(starTypeFilters).some((v) => v === 1) && !hasMatchingStar) continue;
			}

			var planets = system.planets.filter((p) => {
				const typeState = planetTypeFilters[p.type] ?? 0;
				if (typeState === -1) return false;
				if (typeState === 0 && Object.values(planetTypeFilters).some((v) => v === 1)) return false;

				if (rings === 'has' && !p.ring) return false;
				if (rings === 'no' && p.ring) return false;

				if (atmosphere === 'yes' && !p.atmosphere) return false;
				if (atmosphere === 'no' && p.atmosphere) return false;

				// because arvid is not my ♥ we have to check the daycycle increment
				if (tidallyLocked === 'yes' && p.daycycle_increment !== 0) return false;
				if (tidallyLocked === 'no' && p.daycycle_increment === 0) return false;

				if (p.temperature < temperatureRange[0] || p.temperature > temperatureRange[1])
					return false;
				if (p.gravity < gravityRange[0] || p.gravity > gravityRange[1]) return false;

				if (anyTriResources) {
					for (const key of activeTriKeys) {
						const r = Number(key);
						const want = resourcesTri[r];
						const hit = p.resources.find(
							(pr) =>
								pr.resource === (r as any) ||
								String(pr.resource) === String(r) ||
								Number(pr.resource as any) === r
						);
						const amount = hit?.amount ?? 0;
						if (want === 'yes' && amount <= 0) {
							return false;
						}
						if (want === 'no' && amount > 0) {
							return false;
						}
					}
				}
				if (color !== '' && colorSimilarity > 0) {
					const target = hexToRgb(color);
					if (target) {
						const tol = Math.max(1, (colorSimilarity / 100) * 255);
						const pcol = p.primary_color;
						if (Math.abs(pcol.r - target.r) > tol) return false;
						if (Math.abs(pcol.g - target.g) > tol) return false;
						if (Math.abs(pcol.b - target.b) > tol) return false;
					}
				}
				return true;
			});

			if (color !== '' && colorSimilarity > 0) {
				const target = hexToRgb(color);
				if (target) {
					planets = planets.sort((a, b) => {
						const da = Math.sqrt(
							(a.primary_color.r - target.r) ** 2 +
								(a.primary_color.g - target.g) ** 2 +
								(a.primary_color.b - target.b) ** 2
						);
						const db = Math.sqrt(
							(b.primary_color.r - target.r) ** 2 +
								(b.primary_color.g - target.g) ** 2 +
								(b.primary_color.b - target.b) ** 2
						);
						return da - db;
					});
				}
			}

			if (planets.length > 0) filtered_systems.push({ ...system, planets });
		}

		const map = new Map();
		for (const system of filtered_systems) {
			for (const planet of system.planets) map.set(JSON.stringify(planet.coordinate), planet);
			for (const star of system.stars) map.set(JSON.stringify(star.coordinate), star);
		}
		res = { solar_systems: filtered_systems, universe_map: map };
	}

	return res;
}

function string_to_coordinate(str: string): NullableCoordinate {
	// split string at: "," ", " OR " "; then map to number | undefined
	const arr = str.split(/,\s|,|\s/).map((e) => {
		// user can put wildcards in coord as "-10, 5, ?, 2"
		if (e === '?') {
			return undefined;
		}

		const res = parseInt(e);
		if (isNaN(res)) {
			return undefined;
		}
		return res;
	});

	const coords: NullableCoordinate = {
		x: arr[0],
		y: arr[1],
		z: arr[2],
		w: arr[3]
	};

	return coords;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const m = hex.replace('#', '').match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
	if (!m) return null;
	let h = m[1];
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	const num = parseInt(h, 16);
	return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
