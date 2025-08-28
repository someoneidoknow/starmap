import {
	PlanetType,
	PlanetMaterial,
	Resource,
	RingType,
	StarType,
	type RGBColor,
	type PlanetCoordinate
} from '$lib/util/types';

export function string_to_planet_type(str: string): PlanetType | null {
	if (str === 'Terra') {
		return PlanetType.Terra;
	} else if (str === 'EarthLike') {
		return PlanetType.EarthLike;
	} else if (str === 'Desert') {
		return PlanetType.Desert;
	} else if (str === 'Ocean') {
		return PlanetType.Ocean;
	} else if (str === 'Tundra') {
		return PlanetType.Tundra;
	} else if (str === 'Forest') {
		return PlanetType.Forest;
	} else if (str === 'Exotic') {
		return PlanetType.Exotic;
	} else if (str === 'Barren') {
		return PlanetType.Barren;
	} else if (str === 'Gas') {
		return PlanetType.Gas;
	} else if (str === 'RobotDepot') {
		return PlanetType.RobotDepot;
	} else if (str === 'RobotFactory') {
		return PlanetType.RobotFactory;
	}

	return null;
}

export function string_to_planet_material(str: string): PlanetMaterial | null {
	if (str === 'Grass') {
		return PlanetMaterial.Grass;
	} else if (str === 'Sand') {
		return PlanetMaterial.Sand;
	} else if (str === 'Snow') {
		return PlanetMaterial.Snow;
	} else if (str === 'Rock1') {
		return PlanetMaterial.Rock1;
	} else if (str === 'Rock2') {
		return PlanetMaterial.Rock2;
	}

	return null;
}

export function string_to_resource(str: string): Resource | null {
	if (str === 'Iron') {
		return Resource.Iron;
	} else if (str === 'Copper') {
		return Resource.Copper;
	} else if (str === 'Coal') {
		return Resource.Coal;
	} else if (str === 'Lead') {
		return Resource.Lead;
	} else if (str === 'Titanium') {
		return Resource.Titanium;
	} else if (str === 'Uranium') {
		return Resource.Uranium;
	} else if (str === 'Jade') {
		return Resource.Jade;
	} else if (str === 'Gold') {
		return Resource.Gold;
	} else if (str === 'Diamond') {
		return Resource.Diamond;
	} else if (str === 'Beryllium') {
		return Resource.Beryllium;
	} else if (str === 'Aluminum') {
		return Resource.Aluminum;
	}

	return null;
}

export function string_to_ring_type(str: string): RingType | null {
	if (str === 'Ice') {
		return RingType.Ice;
	} else if (str === 'Stone') {
		return RingType.Stone;
	}

	return null;
}

export function string_to_star_type(str: string): StarType | null {
	if (str === 'Red') {
		return StarType.Red;
	} else if (str === 'Orange') {
		return StarType.Orange;
	} else if (str === 'Yellow') {
		return StarType.Yellow;
	} else if (str === 'Blue') {
		return StarType.Blue;
	} else if (str === 'Neutron') {
		return StarType.Neutron;
	} else if (str === 'BlackHole') {
		return StarType.BlackHole;
	} else if (str === 'AsteroidField') {
		return StarType.AsteroidField;
	}
	else if (str === 'RoguePlanet') {
		return StarType.RoguePlanet;
	}

	return null;
}

export function star_type_to_star_color(type: StarType): RGBColor {
	switch (type) {
		case StarType.Red:
			return { r: 255, g: 68, b: 68 };
		case StarType.Orange:
			return { r: 255, g: 136, b: 68 };
		case StarType.Yellow:
			return { r: 255, g: 255, b: 102 };
		case StarType.Blue:
			return { r: 50, g: 50, b: 255 };
		case StarType.Neutron:
			return { r: 187, g: 204, b: 255 };
		case StarType.BlackHole:
			return { r: 255, g: 93, b: 0 };
		case StarType.AsteroidField:
			return { r: 136, g: 136, b: 136 };
		case StarType.RoguePlanet:
			return { r: 100, g: 100, b: 100 };
		default:
			const _exhaustive: never = type;
			throw new Error(`Unhandled star type: ${type}`);
	}
}
