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
	secondaryColor?: string;
	secondaryColorSimilarity?: number;
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
	const secondaryColor = (opts.secondaryColor ?? '').trim();
	const secondaryColorSimilarity = typeof opts.secondaryColorSimilarity === 'number' ? Math.max(0, Math.min(100, opts.secondaryColorSimilarity)) : 0;
	const earthlikesInSystem = opts.earthlikesInSystem ?? 'any';
	const starTypeFilters = opts.starTypeFilters ?? {};

	const activeTriKeys = Object.keys(resourcesTri).filter((k) => resourcesTri[Number(k)] !== 'any');
	const anyTriResources = activeTriKeys.length > 0;
	const activeTriKeysNum = activeTriKeys.map(k => Number(k));
	
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
	const colorToleranceSq = targetColor ? Math.pow(Math.max(1, (colorSimilarity / 100) * 255), 2) : 0;
	const targetSecondaryColor = secondaryColor !== '' && secondaryColorSimilarity > 0 ? hexToRgb(secondaryColor) : null;
	const secondaryColorToleranceSq = targetSecondaryColor ? Math.pow(Math.max(1, (secondaryColorSimilarity / 100) * 255), 2) : 0;

	const hasNameFilter = name !== '';
	const hasRanmatFilter = ranmat !== '';
	const hasCoordsFilter = (opts.coords ?? '') !== '';
	const hasResourcesFilter = resources.length > 0;
	const hasPlanetTypeFilter = Object.values(planetTypeFilters).some((v) => v !== 0);
	const hasStarTypeFilter = Object.values(starTypeFilters).some((v) => v !== 0);
	const hasColorFilter = targetColor !== null;
	const hasSecondaryColorFilter = targetSecondaryColor !== null;
	const hasPlanetTypeIncludes = hasPlanetTypeFilter && Object.values(planetTypeFilters).some((v) => v === 1);
	const hasStarTypeIncludes = hasStarTypeFilter && Object.values(starTypeFilters).some((v) => v === 1);

	const resourcesMap = new Map<Resource, number>();
	for (const res of resources) {
		resourcesMap.set(res.resource, res.amount);
	}

	const filtered_systems = [];
	const universeMap = new Map<string, Planet | Star>();
	const allMatchingPlanets: Planet[] = [];
	const globalColorDistMap = hasColorFilter ? new Map<Planet, number>() : null;
	const globalSecondaryColorDistMap = hasSecondaryColorFilter ? new Map<Planet, number>() : null;

	for (const system of universe.solar_systems) {
		if (earthlikesInSystem !== 'any') {
			const hasEarthlike = system.planets.some(p => p.type === PlanetType.EarthLike);
			if (earthlikesInSystem === 'yes' && !hasEarthlike) continue;
			if (earthlikesInSystem === 'no' && hasEarthlike) continue;
		}

		if (hasStarTypeFilter) {
			let hasExcludedStar = false;
			let hasMatchingStar = false;
			
			for (const star of system.stars) {
				const starState = starTypeFilters[star.type] ?? 0;
				if (starState === -1) {
					hasExcludedStar = true;
					break;
				}
				if (starState === 1) {
					hasMatchingStar = true;
				}
			}
			
			if (hasExcludedStar) continue;
			if (hasStarTypeIncludes && !hasMatchingStar) continue;
		}

		const matchingPlanets = [];

		planetLoop: for (const planet of system.planets) {
			if (hasPlanetTypeFilter) {
				const typeState = planetTypeFilters[planet.type] ?? 0;
				if (typeState === -1) continue;
				if (typeState === 0 && hasPlanetTypeIncludes) continue;
			}

			if (rings === 'has' && !planet.ring) continue;
			if (rings === 'no' && planet.ring) continue;

			if (atmosphere === 'yes' && !planet.atmosphere) continue;
			if (atmosphere === 'no' && planet.atmosphere) continue;

			if (tidallyLocked === 'yes' && planet.daycycle_increment !== 0) continue;
			if (tidallyLocked === 'no' && planet.daycycle_increment === 0) continue;

			if (planet.temperature < temperatureRange[0] || planet.temperature > temperatureRange[1]) continue;
			if (planet.gravity < gravityRange[0] || planet.gravity > gravityRange[1]) continue;

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

			if (anyTriResources) {
				for (const r of activeTriKeysNum) {
					const want = resourcesTri[r];
					const hit = planet.resources.find(pr => pr.resource === r);
					const amount = hit?.amount ?? 0;
					if ((want === 'yes' && amount <= 0) || (want === 'no' && amount > 0)) {
						continue planetLoop;
					}
				}
			}

			if (hasColorFilter) {
				const pcol = planet.primary_color;
				const dr = pcol.r - targetColor.r;
				const dg = pcol.g - targetColor.g;
				const db = pcol.b - targetColor.b;
				const distSq = dr*dr + dg*dg + db*db;
				if (colorToleranceSq > 0 && distSq > colorToleranceSq) continue;
				globalColorDistMap!.set(planet, distSq);
			}
			if (hasSecondaryColorFilter) {
				const scol = planet.secondary_color;
				const dr = scol.r - targetSecondaryColor.r;
				const dg = scol.g - targetSecondaryColor.g;
				const db = scol.b - targetSecondaryColor.b;
				const distSq = dr*dr + dg*dg + db*db;
				if (secondaryColorToleranceSq > 0 && distSq > secondaryColorToleranceSq) continue;
				globalSecondaryColorDistMap!.set(planet, distSq);
			}

			matchingPlanets.push(planet);
			allMatchingPlanets.push(planet);
		}

		if (matchingPlanets.length > 0) {
			for (const star of system.stars) {
				universeMap.set(coordToString(star.coordinate), star);
			}

			const systemResources: PlanetResource[] = [];
			for (const planet of matchingPlanets) {
				systemResources.push(...planet.resources);
			}

			filtered_systems.push({
				planets: matchingPlanets,
				stars: system.stars,
				resources: systemResources
			});
		}
	}

	if (hasColorFilter || hasSecondaryColorFilter) {
		allMatchingPlanets.sort((a, b) => {
			const aDist = (globalColorDistMap?.get(a) ?? 0) + (globalSecondaryColorDistMap?.get(a) ?? 0);
			const bDist = (globalColorDistMap?.get(b) ?? 0) + (globalSecondaryColorDistMap?.get(b) ?? 0);
			return aDist - bDist;
		});

		const planetToSortIndex = new Map<Planet, number>();
		allMatchingPlanets.forEach((planet, index) => {
			planetToSortIndex.set(planet, index);
		});

		for (const system of filtered_systems) {
			system.planets.sort((a, b) => {
				const aIndex = planetToSortIndex.get(a) ?? 0;
				const bIndex = planetToSortIndex.get(b) ?? 0;
				return aIndex - bIndex;
			});
		}

		filtered_systems.sort((a, b) => {
			const aBestIndex = Math.min(...a.planets.map(p => planetToSortIndex.get(p) ?? Infinity));
			const bBestIndex = Math.min(...b.planets.map(p => planetToSortIndex.get(p) ?? Infinity));
			return aBestIndex - bBestIndex;
		});
	}

	for (const planet of allMatchingPlanets) {
		universeMap.set(coordToString(planet.coordinate), planet);
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
