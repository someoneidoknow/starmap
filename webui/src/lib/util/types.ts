/**
 * x, y: universe coordinates
 *
 * z, w: solar coordinates
 */
export type Coordinate = {
	x: number;
	y: number;
	z: number;
	w: number;
};

export type PlanetCoordinate = {
	x: number;
	y: number;
	z: number;
	w: number;
	planet: boolean;
};

export type UniverseCoordinate = {
	x: number;
	y: number;
};

export type NullableCoordinate = {
	x?: number;
	y?: number;
	z?: number;
	w?: number;
};

export type RGBColor = {
	r: number;
	g: number;
	b: number;
};

// ily arvid ❤❤❤
export enum PlanetType {
	Terra,
	EarthLike,
	Desert,
	Ocean,
	Tundra,
	Forest,
	Exotic,
	Barren,
	Gas,
	RobotDepot,
	RobotFactory
}

export enum PlanetMaterial {
	Grass,
	Sand,
	Snow,
	Rock1,
	Rock2
}

export enum Resource {
	Iron,
	Copper,
	Coal,
	Lead,
	Titanium,
	Uranium,
	Jade,
	Gold,
	Diamond,
	Beryllium,
	Aluminum
}

export type PlanetResource = {
	resource: Resource;
	amount: number;
};

export enum RingType {
	Ice,
	Stone
}
export type PlanetRing = {
	// The total amount of individual asteroids within the rings.
	amount: number;
	start: number;
	end: number;
	type: RingType;
};

export type Planet = {
	coordinate: Coordinate;
	type: PlanetType;
	name: string;
	random_material?: string;
	primary_color: RGBColor;
	secondary_color: RGBColor;
	material: PlanetMaterial;
	generation_height_scale: number;
	water_level?: number;
	atmosphere: boolean;
	temperature: number;
	gravity: number;
	starting_time: number;
	daycycle_increment: number;
	resources: PlanetResource[];
	ring?: PlanetRing;
};

export enum StarType {
	Red,
	Orange,
	Yellow,
	Blue,
	Neutron,
	BlackHole,
	AsteroidField // maweslop code
}

export type Star = {
	coordinate: Coordinate;
	type: StarType;
	size: number;
	color: RGBColor;
};

// represents a -10, -10 to 10 10 solar coordinate area
export type SolarSystem = {
	stars: Star[];
	planets: Planet[];
	resources: PlanetResource[];
};

export type SearchResult = {
	solar_systems: SolarSystem[];
	// quick lookup for search result visualization, coordinate is a string because of js object equality
	universe_map: Map<string, Planet | Star>;
};

export type UniverseData = {
	planets: Planet[];
	stars: Star[];
	solar_systems: SolarSystem[];
};

export enum SearchType {
	StartsWith,
	Contains,
	EndsWith
}

export type Player = {
	id: number;
	userid: number;
	username: string;
};

export type AtlasFrame = {
	x: number;
	y: number;
	w: number;
	h: number;
};

export type AtlasFrameData = {
	frame: AtlasFrame;
	rotated: boolean;
	trimmed: boolean;
	spriteSourceSize: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
	sourceSize: {
		w: number;
		h: number;
	};
};

export type AtlasMeta = {
	app: string;
	version: string;
	image: string;
	format: string;
	size: {
		w: number;
		h: number;
	};
	scale: number;
};

export type AtlasData = {
	frames: Record<string, AtlasFrameData>;
	meta: AtlasMeta;
};
