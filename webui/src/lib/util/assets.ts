import { decode } from '@msgpack/msgpack'
import { ZSTDDecoder } from 'zstddec'
import type { AtlasData } from './types'

let universeData: any = null
let universePromise: Promise<any> | null = null

function decodeCString(buf: Uint8Array, offset: number): [string, number] {
	let end = offset
	while (buf[end] !== 0) end++
	const s = new TextDecoder().decode(buf.subarray(offset, end))
	return [s, end + 1]
}

function decodeUniverseGab(buf: Uint8Array): any {
	const STAR_TYPES = ["Red", "Orange", "Yellow", "Blue", "Neutron", "BlackHole", "AsteroidField", "RoguePlanet"]
	const PLANET_TYPES = ["Terra", "EarthLike", "Desert", "Ocean", "Tundra", "Forest", "Exotic", "Barren", "Gas", "RobotDepot", "RobotFactory"]
	const PLANET_MATERIALS = ["Grass", "Sand", "Snow", "Rock1", "Rock2"]
	const RESOURCES = ["Iron", "Copper", "Coal", "Lead", "Titanium", "Uranium", "Jade", "Gold", "Diamond", "Beryllium", "Aluminum"]

	let offset = 0
	const result: any = {}
	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

	while (offset < buf.length) {
		const coord = [
			dv.getInt8(offset),
			dv.getInt8(offset + 1),
			dv.getInt8(offset + 2),
			dv.getInt8(offset + 3)
		]
		offset += 4

		const kind = buf[offset]; offset += 1
		if (kind === 0) {
			const subtypeVal = buf[offset]; const size = dv.getUint16(offset + 1, true); offset += 3
			const subtype = STAR_TYPES[subtypeVal]
			let entry: any
			if (subtype === "AsteroidField") {
				entry = { Type: "AsteroidField" }
			} else if (subtype === "BlackHole") {
				entry = { Type: "BlackHole", Size: size }
			} else {
				entry = { Type: "Star", SubType: subtype, Size: size }
			}
			result[coord.join(", ")] = entry
		} else {
			const subtypeVal = buf[offset]; offset += 1
			const subtype = PLANET_TYPES[subtypeVal]
			const [name, o1] = decodeCString(buf, offset); offset = o1
			const [randmat, o2] = decodeCString(buf, offset); offset = o2
			const primary = [buf[offset], buf[offset + 1], buf[offset + 2]]; offset += 3
			const secondary = [buf[offset], buf[offset + 1], buf[offset + 2]]; offset += 3
			const mat_atmo = buf[offset]; offset += 1
			const material = PLANET_MATERIALS[mat_atmo & 0x7]
			const atmo = (mat_atmo >> 3) & 1
			const dayCycle = (mat_atmo >> 4) & 1
			const ringBits = (mat_atmo >> 5) & 0x3
			let rings: any = null
			if (ringBits === 1) rings = { Type: "Stone" }
			else if (ringBits === 2) rings = { Type: "Ice" }
			const temp = dv.getInt16(offset, true); offset += 2
			const grav = dv.getFloat32(offset, true); offset += 4
			const resBits = dv.getUint16(offset, true); offset += 2
			const resources: Record<string, number> = {}
			for (let i = 0; i < RESOURCES.length; i++) {
				if (resBits & (1 << i)) resources[RESOURCES[i]] = 1
			}

			const entry: any = {
				Type: "Planet",
				SubType: subtype,
				Name: name,
				RandomMaterial: randmat,
				PrimaryColor: primary,
				SecondaryColor: secondary,
				Material: material,
				Atmosphere: !!atmo,
				DayCycleIncrement: dayCycle ? 1 : 0,
				Temperature: temp,
				Gravity: subtype === "EarthLike" ? 196.2 : grav,
				Resources: resources
			}
			if (rings) entry.Rings = rings

			result[coord.join(", ")] = entry
		}
	}
	return result
}



export async function loadUniverse(): Promise<any> {
	if (universeData) return universeData
	if (!universePromise) {
		universePromise = (async () => {
			const resp = await fetch('/assets/Universe.gab.zst').catch(() => null)
			if (resp && resp.ok) {
				const u8 = new Uint8Array(await resp.arrayBuffer())
				const dec = new ZSTDDecoder()
				await dec.init()
				const raw = dec.decode(u8, 16384 * 1024)
				universeData = decodeUniverseGab(raw)
				return universeData
			} else {
				console.error('Failed to load universe data')
			}
		})()
	}
	return universePromise
}

let atlasData: AtlasData | null = null
let atlasImage: HTMLImageElement | null = null
let atlasPromise: Promise<{ atlasData: AtlasData; image: HTMLImageElement }> | null = null

export async function loadTextureAtlas(): Promise<{ atlasData: AtlasData; image: HTMLImageElement }> {
	if (atlasData && atlasImage) return { atlasData, image: atlasImage }
	if (!atlasPromise) {
		atlasPromise = (async () => {
			const [atlasResp, imageResp] = await Promise.all([
				fetch('/assets/textures.msgpack.zst'),
				fetch('/assets/textures.png')
			])
			const atlasCompressed = new Uint8Array(await atlasResp.arrayBuffer())
			const dec = new ZSTDDecoder()
			await dec.init()
			const decoded = dec.decode(atlasCompressed, 16384)
			atlasData = decode(decoded) as AtlasData
			const blob = await imageResp.blob()
			const url = URL.createObjectURL(blob)
			atlasImage = await new Promise<HTMLImageElement>((res, rej) => {
				const img = new Image()
				img.onload = () => res(img)
				img.onerror = (e) => rej(e)
				img.src = url
			})
			return { atlasData, image: atlasImage }
		})()
	}
	return atlasPromise
}
