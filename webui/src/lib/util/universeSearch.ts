import type {
	NullableCoordinate,
	PlanetResource,
	SearchResult,
	SearchType,
	UniverseData,
	Planet,
	Resource,
	Star
} from './types';
import { PlanetType, StarType, coordToString } from './types';

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
	const name = (opts.name?.query ?? '').trim().toLowerCase();
	const ranmat = (opts.ranmat?.query ?? '').trim().toLowerCase();
	const coords = string_to_coordinate((opts.coords ?? '').trim());

	const planetTypeFilters = opts.planetTypeFilters ?? {};
	const rings = opts.rings ?? 'any';
	const atmosphere = opts.atmosphere ?? 'any';
	const tidallyLocked = opts.tidallyLocked ?? 'any';
	const temperatureRange: [number, number] = opts.temperatureRange ?? [-350, 350];
	const gravityRange: [number, number] = opts.gravityRange ?? [0, 350];
	const resources = opts.resources ?? [];
	const resourcesTri = opts.resourcesTri ?? {};
	const color = (opts.color ?? '').trim();
	const colorSimilarity = typeof opts.colorSimilarity === 'number' ? Math.max(0, Math.min(100, opts.colorSimilarity)) : 0;
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
		temperatureRange[0] === -350 &&
		temperatureRange[1] === 350 &&
		gravityRange[0] === 0 &&
		gravityRange[1] === 350 &&
		color === '' &&
		colorSimilarity === 0 &&
		earthlikesInSystem === 'any' &&
		Object.values(starTypeFilters).every((v) => v === 0);

	if (nothingSelected) return null;

	const targetColor = color !== '' && colorSimilarity > 0 ? hexToRgb(color) : null;
	const colorTolerance = targetColor ? Math.max(1, (colorSimilarity / 100) * 255) : 0;

	const hasNameFilter = name !== '';
	const hasRanmatFilter = ranmat !== '';
	const hasCoordsFilter = (opts.coords ?? '') !== '';
	const hasResourcesFilter = resources.length > 0;
	const hasPlanetTypeFilter = Object.values(planetTypeFilters).some((v) => v !== 0);
	const hasStarTypeFilter = Object.values(starTypeFilters).some((v) => v !== 0);
	const hasColorFilter = targetColor !== null;

	const resourcesMap = new Map<Resource, number>();
	for (const res of resources) {
		resourcesMap.set(res.resource, res.amount);
	}

	const filtered_systems = [];
	const universeMap = new Map<string, Planet | Star>();

	for (const system of universe.solar_systems) {
		if (earthlikesInSystem !== 'any') {
			const hasEarthlike = system.planets.some(p => p.type === PlanetType.EarthLike);
			if (earthlikesInSystem === 'yes' && !hasEarthlike) continue;
			if (earthlikesInSystem === 'no' && hasEarthlike) continue;
		}

		if (hasStarTypeFilter) {
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

		const matchingPlanets = [];
		const colorDistMap = hasColorFilter ? new Map<Planet, number>() : null;

		for (const planet of system.planets) {
			if (hasPlanetTypeFilter) {
				const typeState = planetTypeFilters[planet.type] ?? 0;
				if (typeState === -1) continue;
				if (typeState === 0 && Object.values(planetTypeFilters).some((v) => v === 1)) continue;
			}

			if (hasNameFilter) {
				const planetName = planet.name.toLowerCase();
				let nameMatches = false;
				switch (opts.name.mode) {
					case 0:
						nameMatches = planetName.startsWith(name);
						break;
					case 1:
						nameMatches = planetName.includes(name);
						break;
					case 2:
						nameMatches = planetName.endsWith(name);
						break;
				}
				if (!nameMatches) continue;
			}

			if (hasRanmatFilter) {
				if (!planet.random_material) continue;
				const planetRanmat = planet.random_material.toLowerCase();
				let ranmatMatches = false;
				switch (opts.ranmat.mode) {
					case 0:
						ranmatMatches = planetRanmat.startsWith(ranmat);
						break;
					case 1:
						ranmatMatches = planetRanmat.includes(ranmat);
						break;
					case 2:
						ranmatMatches = planetRanmat.endsWith(ranmat);
						break;
				}
				if (!ranmatMatches) continue;
			}

			if (hasCoordsFilter) {
				if (!coordMatches(planet.coordinate, coords)) continue;
			}

			if (hasResourcesFilter) {
				if (!planetHasResources(planet.resources, resourcesMap)) continue;
			}

			if (rings === 'has' && !planet.ring) continue;
			if (rings === 'no' && planet.ring) continue;

			if (atmosphere === 'yes' && !planet.atmosphere) continue;
			if (atmosphere === 'no' && planet.atmosphere) continue;

			if (tidallyLocked === 'yes' && planet.daycycle_increment !== 0) continue;
			if (tidallyLocked === 'no' && planet.daycycle_increment === 0) continue;

			if (planet.temperature < temperatureRange[0] || planet.temperature > temperatureRange[1]) continue;
			if (planet.gravity < gravityRange[0] || planet.gravity > gravityRange[1]) continue;

			if (anyTriResources) {
				let triResourcesMatch = true;
				for (const key of activeTriKeys) {
					const r = Number(key);
					const want = resourcesTri[r];
					const hit = planet.resources.find(pr => pr.resource === r);
					const amount = hit?.amount ?? 0;
					if (want === 'yes' && amount <= 0) {
						triResourcesMatch = false;
						break;
					}
					if (want === 'no' && amount > 0) {
						triResourcesMatch = false;
						break;
					}
				}
				if (!triResourcesMatch) continue;
			}

			if (hasColorFilter) {
				const pcol = planet.primary_color;
				const dr = pcol.r - targetColor.r;
				const dg = pcol.g - targetColor.g;
				const db = pcol.b - targetColor.b;
				const dist = Math.sqrt(dr*dr + dg*dg + db*db);
				colorDistMap!.set(planet, dist);
			}

			matchingPlanets.push(planet);
		}

		if (matchingPlanets.length > 0) {
			let finalPlanets = matchingPlanets;

			if (hasColorFilter) {
				finalPlanets = matchingPlanets
					.map(p => ({ p, d: colorDistMap!.get(p)! }))
					.sort((a, b) => a.d - b.d)
					.map(x => x.p);
				if (colorTolerance > 0) {
					finalPlanets = finalPlanets.filter(p => colorDistMap!.get(p)! <= colorTolerance);
				}
				if (finalPlanets.length === 0) continue;
			}

			for (const planet of finalPlanets) {
				universeMap.set(coordToString(planet.coordinate), planet);
			}
			for (const star of system.stars) {
				universeMap.set(coordToString(star.coordinate), star);
			}

			const systemResources: PlanetResource[] = [];
			for (const planet of finalPlanets) {
				systemResources.push(...planet.resources);
			}

			filtered_systems.push({
				planets: finalPlanets,
				stars: system.stars,
				resources: systemResources
			});
		}
	}

	return {
		solar_systems: filtered_systems,
		universe_map: universeMap
	};
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

function coordMatches(coord: NullableCoordinate, target: NullableCoordinate): boolean {
	const dimensions: (keyof NullableCoordinate)[] = ['x', 'y', 'z', 'w'];
	for (const dim of dimensions) {
		if (target[dim] === undefined) continue;
		if (coord[dim] === undefined || coord[dim] !== target[dim]) return false;
	}
	return true;
}

function planetHasResources(planetResources: PlanetResource[], requiredMap: Map<Resource, number>): boolean {
	for (const [resource, amount] of requiredMap) {
		const planetResource = planetResources.find(pr => pr.resource === resource);
		if (!planetResource || planetResource.amount < amount) return false;
	}
	return true;
}
