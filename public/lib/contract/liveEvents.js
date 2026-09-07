import * as THREE from 'three';

/**
 * Live events: what a tablet emits while drawing and a mirror applies. The host
 * forwards them as `{ format, version, data }` without reading `data`.
 *
 * - `view`   `{ extentX, extentY }`: the tablet's world half-extents.
 * - `clear`  `{ background }`: a fresh canvas with a background spec.
 * - `stroke` `{ record, seed }`: a gesture begins; `record` is the instrument's
 *            snapshot (tool, values, width, sensitivity, colors), `seed` the
 *            cycle's gesture seed.
 * - `points` `{ points, done }`: the points added since the last event, as plain
 *            `{ x, y, pressure }`; `done` marks the release.
 */
export const LIVE_FORMAT = 'kynd-draw-live';
export const LIVE_VERSION = 1;

export const encodeLiveEvent = data => ({ format: LIVE_FORMAT, version: LIVE_VERSION, data });

export function decodeLiveEvent(event) {
    if (event.format !== LIVE_FORMAT) throw new Error(`Unsupported live event format: ${event.format}`);
    if (event.version !== LIVE_VERSION) throw new Error(`Unsupported live event version: ${event.version}`);
    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        throw new Error('Live event data is malformed');
    }
    return data;
}

export const plainPoint = p => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0 });

export function toVectors(points) {
    return points.map(p => {
        const v = new THREE.Vector3(p.x, p.y, 0);
        v.pressure = p.pressure ?? 0;
        return v;
    });
}
