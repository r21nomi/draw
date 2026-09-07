/**
 * The drawing log as JSON. `serializeDrawing` writes `{ version, view, background,
 * records }`: `view` is the world half-extents of the surface the log was drawn
 * on (`{ extentX, extentY }`), so a player can frame the same rectangle, and is
 * omitted when the caller does not know it. `parseDrawing` reads a log back and
 * checks its shape.
 */
export const LOG_VERSION = 1;

export function serializeDrawing({ background, records, view = null }) {
    return JSON.stringify({ version: LOG_VERSION, ...(view ? { view } : {}), background, records });
}

export function parseDrawing(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !Array.isArray(data.records)) {
        throw new Error('the drawing log has no records');
    }
    return {
        version: data.version ?? 1,
        view: isView(data.view) ? data.view : null,
        background: data.background ?? '#ffffff',
        records: data.records,
    };
}

export function isView(value) {
    return Boolean(value) && Number.isFinite(value.extentX) && Number.isFinite(value.extentY)
        && value.extentX > 0 && value.extentY > 0;
}
