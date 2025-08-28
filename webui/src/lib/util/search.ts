import {
	SearchType,
	type Coordinate,
	type NullableCoordinate,
	type Planet,
	type PlanetResource,
	type SearchResult,
	type SolarSystem
} from './types';

export function search_by_name(data: SearchResult, str: string, type: SearchType): SearchResult {
	const systems: SolarSystem[] = [];
	const map = new Map();
	const name = str.toLowerCase();

	for (const system of data.solar_systems) {
		const planets: Planet[] = [];
		let contains = false;

		for (const planet of system.planets) {
			let planet_name = planet.name.toLowerCase();
			switch (type) {
				case SearchType.StartsWith:
					if (!planet_name.startsWith(name)) continue;
					break;
				case SearchType.Contains:
					if (!planet_name.includes(name)) continue;
					break;
				case SearchType.EndsWith:
					if (!planet_name.endsWith(name)) continue;
					break;
			}

			planets.push(planet);
			map.set(JSON.stringify(planet.coordinate), planet);
			contains = true;
		}

		if (contains) {
			for (const star of system.stars) {
				map.set(JSON.stringify(star.coordinate), star);
			}

			const resources: PlanetResource[] = [];
			for (const planet of planets) {
				resources.push(...planet.resources);
			}

			let solar_system: SolarSystem = {
				planets,
				stars: system.stars,
				resources
			};

			systems.push(solar_system);
		}
	}

	return {
		solar_systems: systems,
		universe_map: map
	};
}

export function search_by_ranmat(data: SearchResult, str: string, type: SearchType): SearchResult {
	const systems: SolarSystem[] = [];
	const map = new Map();
	const ranmat = str.toLowerCase();

	for (const system of data.solar_systems) {
		const planets: Planet[] = [];
		let contains = false;

		for (const planet of system.planets) {
			if (planet.random_material === undefined) continue;

			let planet_ranmat = planet.random_material.toLowerCase();
			switch (type) {
				case SearchType.StartsWith:
					if (!planet_ranmat.startsWith(ranmat)) continue;
					break;
				case SearchType.Contains:
					if (!planet_ranmat.includes(ranmat)) continue;
					break;
				case SearchType.EndsWith:
					if (!planet_ranmat.endsWith(ranmat)) continue;
					break;
			}

			planets.push(planet);
			map.set(JSON.stringify(planet.coordinate), planet);
			contains = true;
		}

		if (contains) {
			for (const star of system.stars) {
				map.set(JSON.stringify(star.coordinate), star);
			}

			const resources: PlanetResource[] = [];
			for (const planet of planets) {
				resources.push(...planet.resources);
			}

			let solar_system: SolarSystem = {
				planets,
				stars: system.stars,
				resources
			};

			systems.push(solar_system);
		}
	}

	return {
		solar_systems: systems,
		universe_map: map
	};
}

export function search_by_coordinate(data: SearchResult, coords: NullableCoordinate): SearchResult {
	const systems: SolarSystem[] = [];
	const map = new Map();

	for (const system of data.solar_systems) {
		const planets: Planet[] = [];
		let contains = false;

		for (const planet of system.planets) {
			if (coord_contains(planet.coordinate, coords)) {
				planets.push(planet);
				map.set(JSON.stringify(planet.coordinate), planet);
				contains = true;
			}
		}

		if (contains) {
			for (const star of system.stars) {
				map.set(JSON.stringify(star.coordinate), star);
			}

			const resources: PlanetResource[] = [];
			for (const planet of planets) {
				resources.push(...planet.resources);
			}

			let solar_system: SolarSystem = {
				planets,
				stars: system.stars,
				resources
			};

			systems.push(solar_system);
		}
	}

	return {
		solar_systems: systems,
		universe_map: map
	};
}

export function search_by_resources(data: SearchResult, resources: PlanetResource[]): SearchResult {
	const systems: SolarSystem[] = [];
	const map = new Map();

	for (const system of data.solar_systems) {
		const planets: Planet[] = [];
		let contains = false;

		for (const planet of system.planets) {
			if (resource_contains(planet.resources, resources)) {
				planets.push(planet);
				map.set(JSON.stringify(planet.coordinate), planet);
				contains = true;
			}
		}

		if (contains) {
			for (const star of system.stars) {
				map.set(JSON.stringify(star.coordinate), star);
			}

			const resources: PlanetResource[] = [];
			for (const planet of planets) {
				resources.push(...planet.resources);
			}

			let solar_system: SolarSystem = {
				planets,
				stars: system.stars,
				resources
			};

			systems.push(solar_system);
		}
	}

	return {
		solar_systems: systems,
		universe_map: map
	};
}

function coord_contains(coord: NullableCoordinate, contains: NullableCoordinate): boolean {
	const dimensions: (keyof NullableCoordinate)[] = ['x', 'y', 'z', 'w'];

	for (const dim of dimensions) {
		if (contains[dim] === undefined) {
			continue;
		}

		if (coord[dim] === undefined || coord[dim] !== contains[dim]) {
			return false;
		}
	}

	return true;
}

function resource_contains(data: PlanetResource[], query: PlanetResource[]): boolean {
	for (const query_resource of query) {
		let contains = false;
		for (const planet_resource of data) {
			if (query_resource.resource === planet_resource.resource) {
				if (query_resource.amount > planet_resource.amount) return false;

				contains = true;
			}
		}

		if (!contains) return false;
	}

	return true;
}
