import { parseDrawing } from '../demo/drawingLog.js';

/** The recording handed to the host: the drawing log as JSON in a Blob. */
export const RECORDING_FORMAT = 'kynd-draw-log';
export const RECORDING_VERSION = 1;
export const RECORDING_MIME = 'application/json';

export async function decodeRecording(recording) {
    if (recording.format !== RECORDING_FORMAT) throw new Error(`Unsupported recording format: ${recording.format}`);
    if (recording.version !== RECORDING_VERSION) throw new Error(`Unsupported recording version: ${recording.version}`);
    return parseDrawing(await recording.data.text());
}
