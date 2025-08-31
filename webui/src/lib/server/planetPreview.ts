import { ZSTDDecoder } from 'zstddec';
import { decode } from '@msgpack/msgpack';
import { createCanvas, loadImage } from '@napi-rs/canvas';

type UniverseEntry = any;
type AtlasFrame = { x: number; y: number; w: number; h: number };
type AtlasData = { frames: Record<string, { frame: AtlasFrame }>; meta: any };

let universeCache: Record<string, UniverseEntry> | null = null;
let atlasCache: AtlasData | null = null;
let atlasImageCache: any = null;

const ASSET_BASE = 'http://127.0.0.1:3000/assets';

function decodeCString(buf: Uint8Array, offset: number): [string, number] {
    let end = offset;
    while (buf[end] !== 0) end++;
    const s = new TextDecoder().decode(buf.subarray(offset, end));
    return [s, end + 1];
}

function decodeUniverseGab(buf: Uint8Array): Record<string, UniverseEntry> {
    const STAR_TYPES = ["Red", "Orange", "Yellow", "Blue", "Neutron", "BlackHole", "AsteroidField", "RoguePlanet"];
    const PLANET_TYPES = ["Terra", "EarthLike", "Desert", "Ocean", "Tundra", "Forest", "Exotic", "Barren", "Gas", "RobotDepot", "RobotFactory"];
    const PLANET_MATERIALS = ["Grass", "Sand", "Snow", "Rock1", "Rock2"];
    const RESOURCES = ["Iron", "Copper", "Coal", "Lead", "Titanium", "Uranium", "Jade", "Gold", "Diamond", "Beryllium", "Aluminum"];
    let offset = 0;
    const result: any = {};
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    while (offset < buf.length) {
        const coord = [dv.getInt8(offset), dv.getInt8(offset + 1), dv.getInt8(offset + 2), dv.getInt8(offset + 3)];
        offset += 4;
        const kind = buf[offset]; offset += 1;
        if (kind === 0) {
            const subtypeVal = buf[offset]; const size = dv.getUint16(offset + 1, true); offset += 3;
            const subtype = STAR_TYPES[subtypeVal];
            let entry: any;
            if (subtype === 'AsteroidField') entry = { Type: 'AsteroidField' };
            else if (subtype === 'BlackHole') entry = { Type: 'BlackHole', Size: size };
            else if (subtype === 'RoguePlanet') entry = { Type: 'Star', SubType: 'RoguePlanet', Size: size };
            else entry = { Type: 'Star', SubType: subtype, Size: size };
            result[coord.join(', ')] = entry;
        } else {
            const subtypeVal = buf[offset]; offset += 1;
            const subtype = PLANET_TYPES[subtypeVal];
            const [name, o1] = decodeCString(buf, offset); offset = o1;
            const [randmat, o2] = decodeCString(buf, offset); offset = o2;
            const primary = [buf[offset], buf[offset + 1], buf[offset + 2]]; offset += 3;
            const secondary = [buf[offset], buf[offset + 1], buf[offset + 2]]; offset += 3;
            const mat_atmo = buf[offset]; offset += 1;
            const material = PLANET_MATERIALS[mat_atmo & 0x7];
            const atmo = (mat_atmo >> 3) & 1;
            const dayCycle = (mat_atmo >> 4) & 1;
            const ringBits = (mat_atmo >> 5) & 0x3;
            let rings: any = null;
            if (ringBits === 1) rings = { Type: 'Stone' };
            else if (ringBits === 2) rings = { Type: 'Ice' };
            const temp = dv.getInt16(offset, true); offset += 2;
            const grav = dv.getFloat32(offset, true); offset += 4;
            const resBits = dv.getUint16(offset, true); offset += 2;
            const resources: Record<string, number> = {};
            for (let i = 0; i < RESOURCES.length; i++) if (resBits & (1 << i)) resources[RESOURCES[i]] = 1;
            const entry: any = {
                Type: 'Planet', SubType: subtype, Name: name, RandomMaterial: randmat,
                PrimaryColor: primary, SecondaryColor: secondary, Material: material,
                Atmosphere: !!atmo, DayCycleIncrement: dayCycle ? 1 : 0,
                Temperature: temp, Gravity: subtype === 'EarthLike' ? 196.2 : grav,
                Resources: resources
            };
            if (rings) entry.Rings = rings;
            result[coord.join(', ')] = entry;
        }
    }
    return result;
}

async function loadUniverseServer() {
    if (universeCache) return universeCache;
    const res = await fetch(`${ASSET_BASE}/Universe.gab.zst`);
    if (!res.ok) throw new Error('universe fetch failed');
    const file = new Uint8Array(await res.arrayBuffer());
    const dec = new ZSTDDecoder();
    await dec.init();
    const raw = dec.decode(file, 16384 * 1024);
    universeCache = decodeUniverseGab(raw);
    return universeCache;
}

async function loadAtlasServer() {
    if (atlasCache && atlasImageCache) return { atlas: atlasCache, image: atlasImageCache };
    const [atlasRes, pngRes] = await Promise.all([
        fetch(`${ASSET_BASE}/textures.msgpack.zst`),
        fetch(`${ASSET_BASE}/textures.png`)
    ]);
    if (!atlasRes.ok || !pngRes.ok) throw new Error('atlas fetch failed');
    const [atlasBufU8, pngBufU8] = await Promise.all([atlasRes.arrayBuffer(), pngRes.arrayBuffer()]);
    const dec = new ZSTDDecoder();
    await dec.init();
    const decoded = dec.decode(new Uint8Array(atlasBufU8), 16384);
    atlasCache = decode(decoded) as AtlasData;
    const b64 = Buffer.from(pngBufU8).toString('base64');
    atlasImageCache = await loadImage('data:image/png;base64,' + b64);
    return { atlas: atlasCache, image: atlasImageCache };
}

function tintImageData(data: { data: Uint8ClampedArray }, tint: [number, number, number]) {
    const [tr, tg, tb] = tint;
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = (d[i] * tr) / 255;
        d[i + 1] = (d[i + 1] * tg) / 255;
        d[i + 2] = (d[i + 2] * tb) / 255;
    }
    return data;
}

function normalizeCoordKey(coordStr: string): { key: string; parts: number[] } | null {
    const parts = coordStr.split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return null;
    return { key: parts.join(', '), parts };
}

export async function generatePlanetTexture(coordStr: string, _size = 96): Promise<Buffer | null> {
    const universe = await loadUniverseServer();
    const norm = normalizeCoordKey(coordStr);
    if (!norm) { return null; }
    const { key, parts } = norm;
    const entry = universe[key];
    if (!entry || entry.Type !== 'Planet') return null;
    const { atlas, image } = await loadAtlasServer();

    const subtypeRaw: string = entry.SubType || '';
    const subtypeLower = subtypeRaw.toLowerCase();
    let baseFrameName: string | null = null;
    let overlayFrameName: string | null = null;
    if (subtypeRaw === 'EarthLike') {
        baseFrameName = 'earthlike';
    } else if (subtypeRaw === 'RobotFactory' || subtypeRaw === 'RobotDepot') {
        return null;
    } else if (subtypeLower) {
        baseFrameName = `${subtypeLower}1`;
        overlayFrameName = `${subtypeLower}2`;
    }
    const baseFrame = baseFrameName ? atlas.frames[baseFrameName]?.frame : null;
    const overlayFrame = overlayFrameName ? atlas.frames[overlayFrameName]?.frame : null;

    const workingSize = baseFrame ? Math.max(baseFrame.w, baseFrame.h) : 48;
    const workCanvas = createCanvas(workingSize, workingSize);
    const wctx = workCanvas.getContext('2d');
    (wctx as any).imageSmoothingEnabled = false;
    wctx.clearRect(0, 0, workingSize, workingSize);

    if (baseFrame) {
        wctx.drawImage(
            image,
            baseFrame.x,
            baseFrame.y,
            baseFrame.w,
            baseFrame.h,
            0,
            0,
            workingSize,
            workingSize
        );
        const img = wctx.getImageData(0, 0, workingSize, workingSize);
        tintImageData(img, entry.PrimaryColor || entry.Primary || entry.PrimaryColor || [255, 255, 255]);
        wctx.putImageData(img, 0, 0);
    } else {
        wctx.fillStyle = `rgb(${entry.PrimaryColor[0]},${entry.PrimaryColor[1]},${entry.PrimaryColor[2]})`;
        wctx.beginPath(); wctx.arc(workingSize / 2, workingSize / 2, workingSize / 2 - 2, 0, Math.PI * 2); wctx.fill();
    }

    if (overlayFrame) {
        const tmp = createCanvas(workingSize, workingSize); const tctx = tmp.getContext('2d');
        (tctx as any).imageSmoothingEnabled = false;
        tctx.drawImage(image, overlayFrame.x, overlayFrame.y, overlayFrame.w, overlayFrame.h, 0, 0, workingSize, workingSize);
        const img2 = tctx.getImageData(0, 0, workingSize, workingSize);
        if (entry.SecondaryColor) tintImageData(img2, entry.SecondaryColor);
        tctx.putImageData(img2, 0, 0);
        wctx.globalAlpha = 1;
        wctx.drawImage(tmp, 0, 0);
    }

    if (entry.Rings && entry.Rings.Type) {
        const ringFrameName = `${String(entry.Rings.Type).toLowerCase()}ring`;
        const ringFrame = atlas.frames[ringFrameName]?.frame;
        if (ringFrame) {
            wctx.drawImage(
                image,
                ringFrame.x,
                ringFrame.y,
                ringFrame.w,
                ringFrame.h,
                0,
                0,
                workingSize,
                workingSize
            );
        }
    }

    const FINAL = 96;
    const outCanvas = createCanvas(FINAL, FINAL);
    const octx = outCanvas.getContext('2d');
    (octx as any).imageSmoothingEnabled = false;
    octx.clearRect(0, 0, FINAL, FINAL);
    octx.drawImage(workCanvas, 0, 0, FINAL, FINAL);

    if (entry.Atmosphere) {
        const grad = octx.createRadialGradient(FINAL / 2, FINAL / 2, FINAL * 0.55, FINAL / 2, FINAL / 2, FINAL * 0.85);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,0.4)');
        octx.fillStyle = grad;
        octx.beginPath(); octx.arc(FINAL / 2, FINAL / 2, FINAL / 2 - 2, 0, Math.PI * 2); octx.fill();
    }


    return outCanvas.toBuffer('image/png');
}

export async function getUniverseEntry(coordStr: string) {
    const u = await loadUniverseServer();
    const parts = coordStr.split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return null;
    return u[parts.join(', ')];
}
