import { decode } from '@msgpack/msgpack';
import { loadUniverse as loadUniverseRaw } from './assets';
import {
	type UniverseData,
	type Coordinate,
	type Planet,
	type Star,
	type RGBColor,
	type PlanetResource,
	type PlanetRing,
	StarType,
	type SolarSystem,
	type UniverseCoordinate
} from '$lib/util/types';

import {
	star_type_to_star_color,
	string_to_planet_material,
	string_to_planet_type,
	string_to_resource,
	string_to_ring_type,
	string_to_star_type
} from '$lib/util/parse';

async function loadUniverseData(): Promise<any> { return loadUniverseRaw(); }

function rgbToHex([r, g, b]: [number, number, number]): number {
	return (r << 16) + (g << 8) + b;
}

function colorForStarSubType(subtype?: string): number {
	switch (subtype) {
		case 'Red':
			return 0xff4444;
		case 'Orange':
			return 0xff8844;
		case 'Yellow':
			return 0xffff66;
		case 'Blue':
			return 0x3232ff;
		case 'Neutron':
			return 0xbbccff;
		default:
			return 0xffffff;
	}
}

export async function parseUniverse(rawData?: any): Promise<UniverseData> {
	const planets: Planet[] = [];
	const stars: Star[] = [];
	const systems: Map<string, SolarSystem> = new Map();

	const data = rawData || await loadUniverseData();

	Object.entries(data).forEach(([coordinate_string, entry]: [string, any]) => {
		const coord_arr = coordinate_string.split(',').map((s) => parseInt(s.trim()));
		if (coord_arr.length !== 4) {
			console.warn(`Malformed coordinate: ${coordinate_string}`);
			return;
		}
		const coordinate: Coordinate = {
			x: coord_arr[0],
			y: coord_arr[1],
			z: coord_arr[2],
			w: coord_arr[3]
		};

		if (entry.Type === 'Planet') {
			const name = entry.Name;

			const type = string_to_planet_type(entry.SubType);
			if (type === null) {
				console.warn('Malformed planet type');
				return;
			}
			const material = string_to_planet_material(entry.Material);
			if (material === null) {
				console.warn('Malformed planet material');
				return;
			}

			const primary_color: RGBColor = {
				r: entry.PrimaryColor[0],
				g: entry.PrimaryColor[1],
				b: entry.PrimaryColor[2]
			};
			const secondary_color: RGBColor = {
				r: entry.SecondaryColor[0],
				g: entry.SecondaryColor[1],
				b: entry.SecondaryColor[2]
			};
			const atmosphere = entry.Atmosphere;
			const temperature = entry.Temperature;
			const gravity = entry.Gravity;
			const daycycle_increment = entry.DayCycleIncrement;
			const random_material = entry.RandomMaterial;

			const resources: PlanetResource[] = [];
			Object.entries(entry.Resources).forEach(([resource_string, amount]: [string, any]) => {
				const resource = string_to_resource(resource_string);
				if (resource === null) {
					console.warn(`Malformed resource: ${resource_string}`);
					return;
				}

				const res: PlanetResource = {
					resource,
					amount
				};

				resources.push(res);
			});

			let ring: PlanetRing | undefined = undefined;
			if ('Rings' in entry) {
				const rings = entry.Rings;
				const type = string_to_ring_type(rings.Type);
				if (type === null) {
					console.warn('Malformed ring type');
					return;
				}

				ring = {
					amount: 0,
					start: 0,
					end: 0,
					type
				};
			}

			const planet: Planet = {
				coordinate,
				name,
				type,
				primary_color,
				secondary_color,
				material,
				generation_height_scale: 0,
				water_level: 0,
				atmosphere,
				temperature,
				gravity,
				starting_time: 0,
				daycycle_increment,
				random_material,
				resources,
				ring
			};

			planets.push(planet);

			// construct solar system
			const system_coords = JSON.stringify({ x: coordinate.x, y: coordinate.y });
			const system = systems.get(system_coords);

			if (system === undefined) {
				const solar_system: SolarSystem = {
					stars: [],
					planets: [planet],
					resources: [...resources]
				};

				systems.set(system_coords, solar_system);
			} else {
				system.planets.push(planet);
				system.resources.push(...resources);
			}
		} else if (entry.Type === 'Star' || entry.Type === 'AsteroidField' || entry.Type === 'BlackHole') {
			const size = entry.Size ? entry.Size : 1000;
			let type: StarType | null;
			if (entry.Type === 'AsteroidField') {
				type = StarType.AsteroidField;
			} else if (entry.Type == 'BlackHole') {
				type = StarType.BlackHole;
			} else {
				type = string_to_star_type(entry.SubType);
			}

			if (type === null) {
				console.warn('Malformed star type');
				return;
			}

			const color = star_type_to_star_color(type);

			const star: Star = {
				coordinate,
				type,
				size,
				color
			};

			stars.push(star);

			// construct solar system
			const system_coords = JSON.stringify({ x: coordinate.x, y: coordinate.y });
			const system = systems.get(system_coords);

			if (system === undefined) {
				const solar_system: SolarSystem = {
					stars: [star],
					planets: [],
					resources: []
				};

				systems.set(system_coords, solar_system);
			} else {
				system.stars.push(star);
			}
		} else {
			console.warn(`Unknown type: ${entry.Type}`);
		}
	});

	const universe_data: UniverseData = {
		stars,
		planets,
		solar_systems: Array.from(systems.values()).map(sys => {
			if (sys.stars.length === 0) {
				const rp = sys.planets.find(p => p.coordinate.z === 0 && p.coordinate.w === 0);
				if (rp) {
					const star = { coordinate: rp.coordinate, type: StarType.RoguePlanet, size: 0, color: { r: 100, g: 100, b: 100 } } as Star;
					sys.stars.push(star);
					stars.push(star);
				}
			}
			return sys;
		})
	};

	return universe_data;
}
