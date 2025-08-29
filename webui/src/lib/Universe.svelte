<script lang="ts" context="module">
	import { writable, type Writable } from 'svelte/store';
	export const viewMatrix = writable({ x: 0, y: 0, scale: 4 });
</script>

<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as PIXI from 'pixi.js';
	import {
		PlanetType,
		RingType,
		StarType,
		type Coordinate,
		type Planet,
		type SearchResult,
		type SolarSystem,
		type Star,
		type UniverseData,
		type AtlasData
	} from '$lib/util/types';
	import { dev } from '$app/environment';
	import { loadTextureAtlas } from '$lib/util/assets';
	import { getCookie, setCookie } from '$lib/util/cookie';

	const SUBCELLS = 21;
	let DETAIL = 30;

	const planetTextures: Record<string, PIXI.Texture> = {};
	const starTextures: Record<string, PIXI.Texture> = {};
	const ringTextures: Record<string, PIXI.Texture> = {};
	let atmosphereTexture: PIXI.Texture;
	let starTexture: PIXI.Texture;

	const dispatch = createEventDispatcher();

	export let universe_data: UniverseData;

	type Warp = { x1: number; y1: number; x2: number; y2: number; progress: number };
	type Rect = { x: number; y: number; w: number; h: number };

	export let initialScale = 4;
	export let minZoom = 1;
	export let maxZoom = 1000;
	export let zoomLerp = 0.2;
	export let starRadius = 0.05;
	export let planetRadius = 0.02;
	export const orbitMax = 0.45;
	export let planetShowAt = 96;
	export let gridAlpha = 0.2;
	export let planetGridAlpha = 0.12;
	export let gridSteps = { small: 10, medium: 5, fine: 1 };
	export let select_distance_threshold = 10;
	export let universe_size: Rect = { x: -100, y: -100, w: 201, h: 201 };
	export let search_results: SearchResult | null = null;
	export const warps: Warp[] = [];
	let container: HTMLDivElement;
	let fpsText: HTMLDivElement;
	let coordText: HTMLDivElement;

	let app: PIXI.Application;
	let universe: PIXI.Container;
	let scale = initialScale;
	let targetScale = initialScale;

	const resLevels = [2, 1, 0.5];
	let resIndex = 0;
	let resButtonText = 'res x2';
	function applyResolution() {
		if (!app) return;
		const mult = resLevels[resIndex];
		app.renderer.resolution = window.devicePixelRatio * mult;
		app.renderer.resize(app.renderer.width, app.renderer.height);
		resButtonText = `res x${mult}`;
		setCookie('universe_res_mult', String(mult), 365);
	}
	function cycleResolution() {
		resIndex = (resIndex + 1) % resLevels.length;
		applyResolution();
	}

	// true after search query
	let should_rebuild = false;

	function gridStep(s: number) {
		if (s > 24) return gridSteps.fine;
		if (s > 8) return gridSteps.medium;
		return gridSteps.small;
	}

	function starFactor(s: number, step: number) {
		if (s > planetShowAt) return 1;
		if (step === gridSteps.small) return 16;
		if (step === gridSteps.medium) return 8;
		return 4;
	}

	export function toUniverseCoords(screenX: number, screenY: number) {
		if (!universe) return null;
		const wx = (screenX - universe.x) / scale;
		const wy = (screenY - universe.y) / scale;
		const x = Math.floor(wx);
		const y = Math.floor(wy);
		const dx = wx - x - 0.5;
		const dy = wy - y - 0.5;
		const z = Math.floor((dx + 0.5) * SUBCELLS) - 10;
		const w = Math.floor((dy + 0.5) * SUBCELLS) - 10;
		return { x, y, z, w };
	}

	export function focusOnWorldCoords(x: number, y: number, z = 0, w = 0, newScale?: number) {
		if (!universe || !app) return null;

		if (newScale !== undefined) {
			scale = Math.max(minZoom, Math.min(maxZoom, newScale));
			targetScale = scale;
			universe.scale.set(scale);
		}

		const dx = (z + 10 + 0.5) / SUBCELLS - 0.5;
		const dy = (w + 10 + 0.5) / SUBCELLS - 0.5;
		const wx = x + 0.5 + dx;
		const wy = y + 0.5 + dy;

		universe.x = app.screen.width / 2 - wx * scale;
		universe.y = app.screen.height / 2 - wy * scale;

		viewMatrix.set({ x: universe.x, y: universe.y, scale });

		return { screenX: app.screen.width / 2, screenY: app.screen.height / 2 };
	}

	if (typeof window !== 'undefined') {
		(window as any).focusOnWorldCoords = focusOnWorldCoords;
	}

	/**
	 * Clips a line segment to a rectangular viewport using the Liang-Barsky algorithm.
	 *
	 * @param {number} sx1 - X coordinate of the line segment's start point
	 * @param {number} sy1 - Y coordinate of the line segment's start point
	 * @param {number} sx2 - X coordinate of the line segment's end point
	 * @param {number} sy2 - Y coordinate of the line segment's end point
	 * @param {number} w - Width of the clipping rectangle (right boundary)
	 * @param {number} h - Height of the clipping rectangle (bottom boundary)
	 * @returns {{start: number, end: number} | null} Returns parametric values for the clipped segment endpoints,
	 *   where start and end are values between 0 and 1 representing positions along the original line.
	 *   Returns null if the line segment is completely outside the clipping rectangle.
	 */
	function clipSegment(sx1: number, sy1: number, sx2: number, sy2: number, w: number, h: number) {
		let dx = sx2 - sx1,
			dy = sy2 - sy1,
			t0 = 0,
			t1 = 1;
		const clip = (p: number, q: number) => {
			if (p === 0) return q >= 0;
			const r = q / p;
			if (p < 0) {
				if (r > t1) return false;
				if (r > t0) t0 = r;
			} else {
				if (r < t0) return false;
				if (r < t1) t1 = r;
			}
			return true;
		};
		return clip(-dx, sx1) && clip(dx, w - sx1) && clip(-dy, sy1) && clip(dy, h - sy1) && t0 <= t1
			? { start: t0, end: t1 }
			: null;
	}

	$: if (search_results) {
		should_rebuild = true;
	} else if (search_results === null) {
		should_rebuild = true;
	}

	onMount(async () => {
		if (!container) return;

		const savedMult = parseFloat(getCookie('universe_res_mult') ?? '1');
		if (resLevels.includes(savedMult)) {
			resIndex = resLevels.indexOf(savedMult as (typeof resLevels)[number]);
		}
		app = new PIXI.Application();
		await app.init({
			resizeTo: container,
			backgroundColor: 0x000000,
			antialias: false,
			resolution: window.devicePixelRatio * resLevels[resIndex],
			autoDensity: true
		});
		container.appendChild(app.canvas);
		resButtonText = `res x${resLevels[resIndex]}`;

		const gradCanvas = document.createElement('canvas');
		gradCanvas.width = gradCanvas.height = 64;
		{
			const ctx = gradCanvas.getContext('2d')!;
			const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
			g.addColorStop(0, 'rgba(255,255,255,1)');
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 64, 64);
		}
		atmosphereTexture = PIXI.Texture.from(gradCanvas);

		const baseSize = 96;
		const canvas = document.createElement('canvas');
		canvas.width = baseSize;
		canvas.height = baseSize;
		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, baseSize, baseSize);
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(baseSize / 2, baseSize / 2, baseSize / 2 - 1, 0, Math.PI * 2);
		ctx.fill();
		starTexture = PIXI.Texture.from(canvas);

		const placeholderCanvas = document.createElement('canvas');
		placeholderCanvas.width = placeholderCanvas.height = 1;
		const placeholderTexture = PIXI.Texture.from(placeholderCanvas);
		const backgroundSprite = new PIXI.Sprite(placeholderTexture);
		backgroundSprite.position.set(universe_size.x, universe_size.y);
		backgroundSprite.width = universe_size.w;
		backgroundSprite.height = universe_size.h;

		const allPlanetTextureNames = [
			'Barren1',
			'Barren2',
			'Desert1',
			'Desert2',
			'Exotic1',
			'Exotic2',
			'Forest1',
			'Forest2',
			'Gas1',
			'Gas2',
			'Ocean1',
			'Ocean2',
			'Terra1',
			'Terra2',
			'Tundra1',
			'Tundra2',
			'EarthLike',
			'Icering',
			'Stonering'
		];
		const allStarTextureNames = ['Red', 'Orange', 'Yellow', 'BlackHole', 'Blue', 'Neutron'];
		for (const name of allPlanetTextureNames) {
			planetTextures[name] = placeholderTexture;
		}
		for (const name of allStarTextureNames) {
			starTextures[name] = placeholderTexture;
		}
		ringTextures['Ice'] = placeholderTexture;
		ringTextures['Stone'] = placeholderTexture;

		const atlasPromise = loadTextureAtlas()
			.then(({ atlasData, image }) => {
				const atlasTexture = PIXI.Texture.from(image);
				for (const textureName of [...allPlanetTextureNames, ...allStarTextureNames]) {
					const frameKey = textureName.toLowerCase();
					if (atlasData.frames[frameKey]) {
						const frame = atlasData.frames[frameKey].frame;
						const texture = new PIXI.Texture({ source: atlasTexture.source, frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h) });
						texture.baseTexture.scaleMode = 'nearest';
						if (allPlanetTextureNames.includes(textureName)) {
							planetTextures[textureName] = texture;
							if (textureName === 'Icering') ringTextures['Ice'] = texture;
							if (textureName === 'Stonering') ringTextures['Stone'] = texture;
						} else {
							starTextures[textureName] = texture;
						}
					}
				}
				should_rebuild = true;
			})
			.catch((err) => {
				console.error('Error loading texture atlas:', err);
			});
		const backgroundPromise = PIXI.Assets.load('assets/background.avif')
			.then((tex) => {
				backgroundSprite.texture = tex;
				backgroundSprite.scale.set(1);
				backgroundSprite.width = universe_size.w;
				backgroundSprite.height = universe_size.h;
			})
			.catch(() => {});

		Promise.allSettled([atlasPromise, backgroundPromise]).then(() => {
			should_rebuild = true;
		});

		universe = new PIXI.Container();
		universe.scale.set(scale);
		universe.addChild(backgroundSprite);
		app.stage.addChild(universe);

		const gStarGrid = new PIXI.Graphics();
		const gPlanetGrid = new PIXI.Graphics();
		app.stage.addChild(gStarGrid);
		universe.addChild(gPlanetGrid);

		const bodies = new PIXI.Container();
		universe.addChild(bodies);

		const gStars = new PIXI.Graphics();
		gStars.scale.set(1 / DETAIL);
		bodies.addChild(gStars);

		const gPlanets = new PIXI.Container();
		gPlanets.scale.set(1 / DETAIL);
		bodies.addChild(gPlanets);

		const gWarps = new PIXI.Graphics();
		app.stage.addChild(gWarps);

		// build universe hashmap for fast lookup idk
		let universe_map: Map<string, Planet | Star> = new Map();
		
		function buildUniverseMap() {
			universe_map.clear();
			if (!universe_data || !universe_data.solar_systems || !universe_data.stars) return;
			
			for (const system of universe_data.solar_systems) {
				for (const star of universe_data.stars) {
					universe_map.set(JSON.stringify(star.coordinate), star);
				}

				for (const planet of system.planets) {
					universe_map.set(JSON.stringify(planet.coordinate), planet);
				}
			}
		}
		
		buildUniverseMap();

		let dragging = false;
		let last = { x: 0, y: 0 };
		let anchorScr = { x: 0, y: 0 };
		let anchorWorld = { x: 0, y: 0 };
		let select = true;
		let select_last = { x: 0, y: 0 };
		let mouse_pos = { x: 0, y: 0 };

		function centerView() {
			universe.x = app.screen.width / 2;
			universe.y = app.screen.height / 2;
		}
		centerView();

		const onResize = () => centerView();
		window.addEventListener('resize', onResize);

		const onMouseDown = (e: MouseEvent) => {
			dragging = true;
			last = { x: e.clientX, y: e.clientY };
			select = true;
			select_last = { x: e.clientX, y: e.clientY };
		};
		let rafMove = false
		const onMouseMove = (e: MouseEvent) => {
			if (rafMove) return
			rafMove = true
			requestAnimationFrame(() => {
				rafMove = false
				if (dragging) {
					universe.x += e.clientX - last.x
					universe.y += e.clientY - last.y
					anchorScr.x += e.clientX - last.x
					anchorScr.y += e.clientY - last.y
					last = { x: e.clientX, y: e.clientY }
				}
				const c = toUniverseCoords(e.clientX, e.clientY)
				mouse_pos = { x: e.clientX, y: e.clientY }
				if (c) {
					if (scale < planetShowAt) {
						c.z = 0
						c.w = 0
					}
					coordText.textContent = `${c.x}, ${c.y}, ${c.z}, ${c.w}`
				}
				let diff = Math.abs(select_last.x - e.clientX) + Math.abs(select_last.y - e.clientY)
				if (diff >= select_distance_threshold) {
					select = false
				}
			})
		}
		const onMouseUp = (e: MouseEvent) => {
			dragging = false;

			if (select) {
				const c = toUniverseCoords(e.clientX, e.clientY);
				if (c) dispatch('worldclick', c);
			}

			select = true;
		};
		const onMouseLeave = () => {
			dragging = false;
			select = true;
		};
		let rafWheel = false
		const onWheel = (e: WheelEvent) => {
			if (rafWheel) return
			rafWheel = true
			requestAnimationFrame(() => {
				rafWheel = false
				if (e.ctrlKey) e.preventDefault()
				let modeScale = 1
				if (e.deltaMode === 1) modeScale = 16
				else if (e.deltaMode === 2) modeScale = window.innerHeight
				const speed = Math.abs(e.deltaY)
				const accel = Math.min(4, 1 + speed / 480)
				const base = e.ctrlKey ? 0.0008 : 0.0012
				const isTrackpad = e.deltaMode === 0 && Math.abs(e.deltaY) < 60
				const factor = Math.exp(-e.deltaY * base * modeScale * accel * (isTrackpad ? 3 : 1))
				const clamped = factor > 1 ? Math.min(1.5, factor) : Math.max(0.666, factor)
				targetScale = Math.max(minZoom, Math.min(maxZoom, targetScale * clamped))
				anchorScr = { x: e.clientX, y: e.clientY }
				anchorWorld = {
					x: (anchorScr.x - universe.x) / scale,
					y: (anchorScr.y - universe.y) / scale
				}
			})
		}

		let current_coordinates: Coordinate = { x: -100, y: -100, z: 0, w: 0 };
		let shift_held = false;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') {
				shift_held = true;
				return;
			}
			if (e.key !== 'Tab') return;
			e.preventDefault();

			if (shift_held) {
				// search backward
				for (let y = current_coordinates.y; y >= -100; y--) {
					for (
						let x = y === current_coordinates.y ? current_coordinates.x - 1 : 100;
						x >= -100;
						x--
					) {
						let coords: Coordinate = { x, y, z: 0, w: 0 };

						// use search results, otherwise universe map
						let str = JSON.stringify(coords);
						let has = search_results ? search_results.universe_map.has(str) : universe_map.has(str);
						if (has) {
							current_coordinates = coords;

							// update view then update coord display
							focusOnWorldCoords(coords.x, coords.y, undefined, undefined, 500);
							const c = toUniverseCoords(mouse_pos.x, mouse_pos.y);
							if (c) coordText.textContent = `${c.x}, ${c.y}, ${c.z}, ${c.w}`;
							return;
						}
					}
				}
			} else {
				// search forward
				for (let y = current_coordinates.y; y <= 100; y++) {
					for (
						let x = y === current_coordinates.y ? current_coordinates.x + 1 : -100;
						x <= 100;
						x++
					) {
						let coords: Coordinate = { x, y, z: 0, w: 0 };

						let str = JSON.stringify(coords);
						let has = search_results ? search_results.universe_map.has(str) : universe_map.has(str);
						if (has) {
							current_coordinates = coords;

							focusOnWorldCoords(coords.x, coords.y, undefined, undefined, 500);
							const c = toUniverseCoords(mouse_pos.x, mouse_pos.y);
							if (c) coordText.textContent = `${c.x}, ${c.y}, ${c.z}, ${c.w}`;
							return;
						}
					}
				}
			}
		};

		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shift_held = false;
		};

		app.canvas.addEventListener('mousedown', onMouseDown);
		app.canvas.addEventListener('mousemove', onMouseMove);
		app.canvas.addEventListener('mouseup', onMouseUp);
		app.canvas.addEventListener('mouseleave', onMouseLeave);
		app.canvas.addEventListener('wheel', onWheel, { passive: false });

		let pinchDist = 0;
		let pinchStartScale = scale;
		function touchInfo(e: TouchEvent) {
			const t = Array.from(e.touches);
			return t.map((p) => ({ x: p.clientX, y: p.clientY }));
		}
		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length) e.preventDefault();
			if (e.touches.length === 1) {
				dragging = true;
				last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
				select_last = { ...last };
			} else if (e.touches.length === 2) {
				dragging = false;
				const [a, b] = touchInfo(e);
				pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
				pinchStartScale = targetScale = scale;
				anchorScr = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
				anchorWorld = {
					x: (anchorScr.x - universe.x) / scale,
					y: (anchorScr.y - universe.y) / scale
				};
			}
		};
		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length) e.preventDefault();
			if (e.touches.length === 1 && dragging) {
				const t = e.touches[0];
				universe.x += t.clientX - last.x;
				universe.y += t.clientY - last.y;
				anchorScr.x += t.clientX - last.x;
				anchorScr.y += t.clientY - last.y;
				last = { x: t.clientX, y: t.clientY };
			} else if (e.touches.length === 2) {
				const [a, b] = touchInfo(e);
				const d = Math.hypot(a.x - b.x, a.y - b.y);
				if (pinchDist) {
					const raw = d / pinchDist;
					const change = raw > 1 ? 1 + (raw - 1) * 20 : 1 - (1 - raw) * 40;
					const scaled = Math.max(0.1, Math.min(10, change));
					targetScale = Math.max(minZoom, Math.min(maxZoom, pinchStartScale * scaled));
				}
				anchorScr = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
				anchorWorld = {
					x: (anchorScr.x - universe.x) / scale,
					y: (anchorScr.y - universe.y) / scale
				};
			}
		};
		const onTouchEnd = () => {
			if (pinchDist && scale !== pinchStartScale) select = false;
			if (pinchDist && (dragging || true)) {
				dragging = false;
				pinchDist = 0;
			}
		};
		app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
		app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
		app.canvas.addEventListener('touchend', onTouchEnd, { passive: true });
		app.canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup', onKeyUp);

		const WARP_STEP = 0.05;
		const WARP_ARROWS = 10;

		let fpsFrames = 0;
		let fpsLast = performance.now();

		let previous_time = performance.now();

		let starViewKey = '';
		let planetViewKey = '';
		let gridViewKey = '';

		function pickStarTextureName(star: Star): string | null {
			const key = StarType[star.type] as string;
			return starTextures[key] ? key : null;
		}

		function rebuildStars(
			visMinX: number,
			visMinY: number,
			visMaxX: number,
			visMaxY: number,
			sFactor: number
		) {
			const children = gStars.children as PIXI.Sprite[];
			let i = 0;
			if (!universe_data || !universe_data.stars) {
				for (; i < children.length; i++) children[i].visible = false;
				return;
			}
			for (const star of universe_data.stars) {
				if (star.type === StarType.RoguePlanet) { // rogue planet
					if (scale > planetShowAt) continue;
					const planet = universe_data.planets.find(p => p.coordinate.x === star.coordinate.x && p.coordinate.y === star.coordinate.y && p.coordinate.z === 0 && p.coordinate.w === 0);
					if (!planet) continue;
					const sx = planet.coordinate.x + 0.5;
					const sy = planet.coordinate.y + 0.5;
					if (sx < visMinX || sx > visMaxX || sy < visMinY || sy > visMaxY) continue;
					const cx = sx * DETAIL;
					const cy = sy * DETAIL;
					const diameter = starRadius * DETAIL * sFactor * 2;
					const visible = search_results === null ? true : search_results.universe_map.has(JSON.stringify(planet.coordinate));
					if (planet.atmosphere) {
						let glow: PIXI.Sprite;
						if (i < children.length) glow = children[i]; else { glow = new PIXI.Sprite(); glow.anchor.set(0.5); gStars.addChild(glow); }
						glow.visible = visible;
						glow.texture = atmosphereTexture;
						glow.position.set(cx, cy);
						glow.width = diameter * 1.6;
						glow.height = diameter * 1.6;
						glow.alpha = 0.6;
						glow.tint = (planet.primary_color.r << 16) | (planet.primary_color.g << 8) | planet.primary_color.b;
						i++;
					}
					let baseSprite: PIXI.Sprite;
					if (i < children.length) baseSprite = children[i]; else { baseSprite = new PIXI.Sprite(); baseSprite.anchor.set(0.5); gStars.addChild(baseSprite); }
					baseSprite.visible = visible;
					const baseTexName = PlanetType[planet.type] + '1';
					const baseTex = planetTextures[baseTexName] ?? starTexture;
					baseSprite.texture = baseTex;
					baseSprite.tint = (planet.primary_color.r << 16) | (planet.primary_color.g << 8) | planet.primary_color.b;
					baseSprite.alpha = 1;
					baseSprite.position.set(cx, cy);
					baseSprite.width = diameter;
					baseSprite.height = diameter;
					i++;
					if (planet.secondary_color) {
						let overlay: PIXI.Sprite;
						if (i < children.length) overlay = children[i]; else { overlay = new PIXI.Sprite(); overlay.anchor.set(0.5); gStars.addChild(overlay); }
						overlay.visible = visible;
						const overlayTexName = PlanetType[planet.type] + '2';
						const overlayTex = planetTextures[overlayTexName] ?? planetTextures['Barren2'];
						overlay.texture = overlayTex;
						overlay.tint = (planet.secondary_color.r << 16) | (planet.secondary_color.g << 8) | planet.secondary_color.b;
						overlay.alpha = 1;
						overlay.position.set(cx, cy);
						overlay.width = diameter;
						overlay.height = diameter;
						i++;
					}
					if (planet.ring) {
						let ring: PIXI.Sprite;
						if (i < children.length) ring = children[i]; else { ring = new PIXI.Sprite(); ring.anchor.set(0.5); gStars.addChild(ring); }
						ring.visible = visible;
						ring.texture = ringTextures[RingType[planet.ring.type]];
						ring.tint = 0xffffff;
						ring.alpha = 1;
						ring.position.set(cx, cy);
						ring.width = diameter;
						ring.height = diameter;
						i++;
					}
					continue;
				}
				let sx = star.coordinate.x + 0.5;
				let sy = star.coordinate.y + 0.5;
				sx += (star.coordinate.z ?? 0) / SUBCELLS;
				sy += (star.coordinate.w ?? 0) / SUBCELLS;
				if (sx < visMinX || sx > visMaxX || sy < visMinY || sy > visMaxY) continue;

				const cx = sx * DETAIL;
				const cy = sy * DETAIL;
				const starColor = (star.color.r << 16) | (star.color.g << 8) | star.color.b;
				const diameter = starRadius * DETAIL * sFactor * 2;

				const visible =
					search_results === null
						? true
						: search_results.universe_map.has(JSON.stringify(star.coordinate));

				let glow: PIXI.Sprite;
				if (i < children.length) {
					glow = children[i];
				} else {
					glow = new PIXI.Sprite();
					glow.anchor.set(0.5);
					gStars.addChild(glow);
				}
				glow.visible = visible;
				glow.texture = atmosphereTexture;
				glow.position.set(cx, cy);
				glow.width = diameter * 1.6;
				glow.height = diameter * 1.6;
				glow.alpha = 0.6;
				glow.tint = starColor;
				i++;

				let sprite: PIXI.Sprite;
				if (i < children.length) {
					sprite = children[i];
				} else {
					sprite = new PIXI.Sprite(starTexture);
					sprite.anchor.set(0.5);
					gStars.addChild(sprite);
				}
				sprite.visible = visible;

				const texName = pickStarTextureName(star);
				const tex = texName ? starTextures[texName] : null;
				if (tex) {
					sprite.texture = tex;
					sprite.tint = 0xffffff;
				} else {
					sprite.texture = starTexture;
					sprite.tint = starColor;
				}

				sprite.position.set(cx, cy);
				sprite.width = diameter;
				sprite.height = diameter;
				i++;
			}

			for (; i < children.length; i++) {
				children[i].visible = false;
			}
		}

		function rebuildPlanets(visMinX: number, visMinY: number, visMaxX: number, visMaxY: number) {
			const children = gPlanets.children as PIXI.Sprite[];
			let i = 0;
			if (!universe_data || !universe_data.planets) {
				for (; i < children.length; i++) children[i].visible = false;
				return;
			}
			if (scale <= planetShowAt) {
				for (; i < children.length; i++) children[i].visible = false;
				return;
			}
			for (const planet of universe_data.planets) {
				const coords = planet.coordinate;
				const wx = coords.x + 0.5;
				const wy = coords.y + 0.5;
				if (wx < visMinX || wx > visMaxX || wy < visMinY || wy > visMaxY) continue;
				const px = wx * DETAIL + coords.z * (DETAIL / SUBCELLS);
				const py = wy * DETAIL + coords.w * (DETAIL / SUBCELLS);
				const diameter = planetRadius * DETAIL * 2;

				let has = false;
				if (search_results !== null) {
					if (search_results.universe_map.has(JSON.stringify(planet.coordinate))) {
						has = true;
					} else {
						has = false;
					}
				} else {
					has = true;
				}

				if (planet.atmosphere) {
					let atmosphereSprite: PIXI.Sprite;
					if (i < children.length) {
						atmosphereSprite = children[i];
					} else {
						atmosphereSprite = new PIXI.Sprite();
						atmosphereSprite.anchor.set(0.5);
						gPlanets.addChild(atmosphereSprite);
					}
					atmosphereSprite.visible = has;
					atmosphereSprite.texture = atmosphereTexture;
					atmosphereSprite.position.set(px, py);
					atmosphereSprite.width = diameter * 1.6;
					atmosphereSprite.height = diameter * 1.6;
					atmosphereSprite.alpha = 0.6;
					atmosphereSprite.tint =
						(planet.primary_color.r << 16) | (planet.primary_color.g << 8) | planet.primary_color.b;
					i++;
				}

				let sprite: PIXI.Sprite;
				if (i < children.length) {
					sprite = children[i];
				} else {
					sprite = new PIXI.Sprite();
					sprite.anchor.set(0.5);
					gPlanets.addChild(sprite);
				}

				sprite.visible = has;
				sprite.position.set(px, py);
				sprite.width = diameter;
				sprite.height = diameter;
				if (planet.type === PlanetType.EarthLike) {
					sprite.texture = planetTextures['EarthLike'];
					sprite.alpha = 1;
					sprite.tint = 0xffffff;
				} else {
					sprite.texture =
						planetTextures[`${PlanetType[planet.type]}1`] ?? planetTextures['Barren1'];
					sprite.alpha = 1;
					sprite.tint =
						(planet.primary_color.r << 16) | (planet.primary_color.g << 8) | planet.primary_color.b;
				}
				i++;

				if (planet.secondary_color !== undefined) {
					let overlay: PIXI.Sprite;
					if (i < children.length) {
						overlay = children[i];
					} else {
						overlay = new PIXI.Sprite();
						overlay.anchor.set(0.5);
						gPlanets.addChild(overlay);
					}
					overlay.visible = has;
					overlay.texture =
						planetTextures[`${PlanetType[planet.type]}2`] ?? planetTextures['Barren2'];
					overlay.position.set(px, py);
					overlay.width = diameter;
					overlay.height = diameter;
					overlay.tint =
						(planet.secondary_color.r << 16) |
						(planet.secondary_color.g << 8) |
						planet.secondary_color.b;
					overlay.alpha = 1;
					i++;
				}

				if (planet.ring) {
					let ring: PIXI.Sprite;
					if (i < children.length) {
						ring = children[i];
					} else {
						ring = new PIXI.Sprite();
						ring.anchor.set(0.5);
						gPlanets.addChild(ring);
					}
					ring.visible = has;
					ring.texture = ringTextures[RingType[planet.ring.type]];
					ring.position.set(px, py);
					ring.width = diameter;
					ring.height = diameter;
					ring.tint = 0xffffff;
					ring.alpha = 1;
					i++;
				}
			}
			for (; i < children.length; i++) {
				children[i].visible = false;
			}
		}

		function rebuildGrid(step: number) {
			gStarGrid.clear();
			gStarGrid.alpha = gridAlpha;
			for (let x = universe_size.x; x <= universe_size.w + universe_size.x; x += step) {
				const gx = x * scale + universe.x;
				gStarGrid.moveTo(gx, universe_size.y * scale + universe.y);
				gStarGrid.lineTo(gx, (universe_size.h + universe_size.y) * scale + universe.y);
			}
			for (let y = universe_size.y; y <= universe_size.h + universe_size.y; y += step) {
				const gy = y * scale + universe.y;
				gStarGrid.moveTo(universe_size.x * scale + universe.x, gy);
				gStarGrid.lineTo((universe_size.w + universe_size.x) * scale + universe.x, gy);
			}
			gStarGrid.stroke({ width: 1, color: 0xffffff, pixelLine: true });
		}

		function rebuildPlanetGrid(visMinX: number, visMinY: number, visMaxX: number, visMaxY: number) {
			gPlanetGrid.clear();
			gPlanetGrid.alpha = planetGridAlpha;
			if (scale <= planetShowAt) return;
			const substeps = SUBCELLS;
			const pMinX = Math.floor(visMinX * substeps);
			const pMaxX = Math.ceil(visMaxX * substeps);
			const pMinY = Math.floor(visMinY * substeps);
			const pMaxY = Math.ceil(visMaxY * substeps);
			for (let xi = pMinX; xi <= pMaxX; xi++) {
				const px = xi / substeps;
				gPlanetGrid.moveTo(px, visMinY).lineTo(px, visMaxY);
			}
			for (let yi = pMinY; yi <= pMaxY; yi++) {
				const py = yi / substeps;
				gPlanetGrid.moveTo(visMinX, py).lineTo(visMaxX, py);
			}
			gPlanetGrid.stroke({ width: 1 / scale, color: 0xffffff, pixelLine: true });
		}

		app.ticker.add(() => {
			const now = performance.now();
			const delta_time = (now - previous_time) / 1000;
			previous_time = now;

			if (Math.abs(scale - targetScale) > 1e-4) {
				scale += (targetScale - scale) * (1 - Math.pow(zoomLerp, delta_time * 30));
				universe.scale.set(scale);
				universe.x = anchorScr.x - anchorWorld.x * scale;
				universe.y = anchorScr.y - anchorWorld.y * scale;
			}

			gPlanets.visible = scale > planetShowAt;
			viewMatrix.set({ x: universe.x, y: universe.y, scale });

			const step = gridStep(scale);
			const sFactor = starFactor(scale, step);
			DETAIL = scale > planetShowAt ? 30 : 3;
			gStars.scale.set(1 / DETAIL);
			gPlanets.scale.set(1 / DETAIL);
			const visMinX = -universe.x / scale - 1;
			const visMaxX = (app.screen.width - universe.x) / scale + 1;
			const visMinY = -universe.y / scale - 1;
			const visMaxY = (app.screen.height - universe.y) / scale + 1;

			const newStarKey = `${step}:${Math.floor(visMinX)}:${Math.floor(visMinY)}:${Math.floor(visMaxX)}:${Math.floor(visMaxY)}:${DETAIL}`;
			if (newStarKey !== starViewKey || should_rebuild) {
				starViewKey = newStarKey;
				rebuildStars(visMinX, visMinY, visMaxX, visMaxY, sFactor);
			}

			const planetKey = `${DETAIL}:${Math.floor(visMinX * 2)}:${Math.floor(visMinY * 2)}:${Math.floor(visMaxX * 2)}:${Math.floor(visMaxY * 2)}`;
			if (planetKey !== planetViewKey || should_rebuild) {
				planetViewKey = planetKey;
				rebuildPlanets(visMinX, visMinY, visMaxX, visMaxY);
				should_rebuild = false; // possible race condition?
			}

			const gridKey = `${step}:${scale.toFixed(2)}:${universe.x.toFixed(1)}:${universe.y.toFixed(1)}`;
			if (gridKey !== gridViewKey) {
				gridViewKey = gridKey;
				rebuildGrid(step);
				rebuildPlanetGrid(visMinX, visMinY, visMaxX, visMaxY);
			}

			gWarps.clear();
			const screenW = app.screen.width,
				screenH = app.screen.height;
			for (const w of warps) {
				w.progress = (w.progress + WARP_STEP * delta_time) % 1;

				const sx1 = universe.x + (w.x1 + 0.5) * scale;
				const sy1 = universe.y + (w.y1 + 0.5) * scale;
				const sx2 = universe.x + (w.x2 + 0.5) * scale;
				const sy2 = universe.y + (w.y2 + 0.5) * scale;
				gWarps.moveTo(sx1, sy1).lineTo(sx2, sy2);
				const clip = clipSegment(sx1, sy1, sx2, sy2, screenW, screenH);
				if (!clip) continue;
				const dx = sx2 - sx1,
					dy = sy2 - sy1,
					len = Math.hypot(dx, dy);
				if (!len) continue;
				// haha goodbye comment
				for (let i = 1; i <= WARP_ARROWS; i++) {
					const spacing = (clip.end - clip.start) / WARP_ARROWS;
					const basePosition = clip.start + spacing * i;

					const animatedPosition = basePosition + (clip.end - clip.start) * w.progress;
					const wrappedPosition =
						((animatedPosition - clip.start) % (clip.end - clip.start)) + clip.start;

					const arrowX = sx1 + dx * wrappedPosition;
					const arrowY = sy1 + dy * wrappedPosition;

					const normalizedX = dx / len;
					const normalizedY = dy / len;
					const arrowheadSize = 8;

					gWarps
						.moveTo(arrowX, arrowY)
						.lineTo(
							arrowX - normalizedY * arrowheadSize - normalizedX * arrowheadSize * 0.5,
							arrowY + normalizedX * arrowheadSize - normalizedY * arrowheadSize * 0.5
						);

					gWarps
						.moveTo(arrowX, arrowY)
						.lineTo(
							arrowX + normalizedY * arrowheadSize - normalizedX * arrowheadSize * 0.5,
							arrowY - normalizedX * arrowheadSize - normalizedY * arrowheadSize * 0.5
						);
				}
			}
			gWarps.stroke({ width: 2, color: 0xff3333, pixelLine: true });

			fpsFrames++;
			if (now - fpsLast >= 1000) {
				const avg = (fpsFrames * 1000) / (now - fpsLast);
				fpsText.textContent = `fps ${Math.round(avg)}`;
				fpsFrames = 0;
				fpsLast = now;
			}
		});

		onDestroy(() => {
			window.removeEventListener('resize', onResize);
			app.canvas.removeEventListener('mousedown', onMouseDown);
			app.canvas.removeEventListener('mousemove', onMouseMove);
			app.canvas.removeEventListener('mouseup', onMouseUp);
			app.canvas.removeEventListener('mouseleave', onMouseLeave);
			app.canvas.removeEventListener('wheel', onWheel);
			app.canvas.removeEventListener('touchstart', onTouchStart);
			app.canvas.removeEventListener('touchmove', onTouchMove);
			app.canvas.removeEventListener('touchend', onTouchEnd);
			app.canvas.removeEventListener('touchcancel', onTouchEnd);

			app.destroy(true, { children: true });
		});
	});
</script>

<div class="universe-container noselect" bind:this={container}>
	<button class="overlay resbtn" on:click={cycleResolution}>{resButtonText}</button>
	<div class="overlay fps" bind:this={fpsText}>fps 0</div>
	<div class="overlay coord" bind:this={coordText}>0, 0, 0, 0</div>
</div>

<style>
	.universe-container {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: #000;
	}
	.overlay {
		position: absolute;
		color: #0f0;
		font: 14px/16px monospace;
		pointer-events: none;
	}
	.fps {
		top: 8px;
		left: 10px;
	}
	.resbtn {
		top: 8px;
		left: 70px;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #0f0;
		color: #0f0;
		padding: 2px 6px;
		font: 12px/14px monospace;
		cursor: pointer;
		pointer-events: auto;
	}
	.resbtn:hover {
		background: rgba(0, 0, 0, 0.7);
	}
	.coord {
		top: 8px;
		right: 10px;
	}
</style>
