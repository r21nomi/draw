import { setupDrawCycle } from '../demo/drawCycle.js';
import { StrokeRecorder } from '../demo/strokeRecorder.js';
import { makeMarkBuilder } from '../demo/markBuilder.js';
import { DrawingInstrument, DialStepper } from '../demo/instrument.js';
import { toolRegistry } from '../demo/toolRegistry.js';
import { serializeDrawing } from '../demo/drawingLog.js';
import { createSurface, mountSurface, disposeSurface, surfaceToBlob, viewOf } from './surface.js';
import { encodeLiveEvent, plainPoint } from './liveEvents.js';
import { RECORDING_FORMAT, RECORDING_MIME, RECORDING_VERSION } from './recording.js';

export const ParameterId = Object.freeze({ HUE: 'hue', TOOL: 'tool' });

/** A parameter is a dial position in 0..1; the instrument steps in buckets of a 0..127 dial. */
const DIAL_MAX = 127;
const DIAL_STEP = 6;

/**
 * The host contract's `DrawingEngine` over the instrument: the drawing cycle, the
 * recorder, and the palette and tool logic, with no interface of its own. The
 * host feeds the two dials through `setParameter` and clears through `clear`;
 * every gesture is recorded for `exportRecording` and emitted live for the LED.
 */
export class ContractDrawingEngine {
    constructor({ registry = toolRegistry, scatterMarks = 3 } = {}) {
        this.registry = registry;
        this.scatterMarks = scatterMarks;
        this.surface = null;
        this.listeners = new Set();
        this.steppers = { [ParameterId.HUE]: new DialStepper(DIAL_STEP), [ParameterId.TOOL]: new DialStepper(DIAL_STEP) };
        this.sentPoints = 0;
        this.clearPending = false;
    }

    // The first mount clears to a fresh canvas (or waits for the first layout
    // when the container has no size yet). Every mount replays the current
    // state live, so a mirror that started listening late catches up.
    mount(container) {
        if (!this.surface) this.surface = createSurface();
        if (!mountSurface(this.surface, container)) { this._emitSnapshot(); return; }
        this._attach();
        if (this.surface.stage.extentX > 0.01) this.clear();
        else this.clearPending = true;
    }

    clear() {
        if (!this.surface?.stage) return;
        this.clearPending = false;
        this.sentPoints = 0;
        this._emit({ type: 'view', ...viewOf(this.surface.stage) });
        this.instrument.clearCanvas({
            cycle: this.cycle, board: this.surface.board, stage: this.surface.stage,
            recorder: this.recorder, marks: this.scatterMarks,
            onClear: background => this._emit({ type: 'clear', background }),
        });
        this.surface.stage.draw();
    }

    setParameter(id, value) {
        const stepper = this.steppers[id];
        if (!stepper) return;
        const steps = stepper.feed(Math.round(Math.min(Math.max(value, 0), 1) * DIAL_MAX));
        if (!steps) return;
        if (id === ParameterId.HUE) this.instrument.paletteStep(steps);
        else { this.instrument.stepTrail(steps); this.instrument.rerollPalette(); }
    }

    async exportImage() {
        if (!this.surface?.stage) throw new Error('Drawing engine is not mounted');
        return surfaceToBlob(this.surface);
    }

    async exportRecording() {
        const json = serializeDrawing({
            background: this.recorder.background, records: this.recorder.records,
            view: this.surface?.stage ? viewOf(this.surface.stage) : null,
        });
        return { format: RECORDING_FORMAT, version: RECORDING_VERSION, data: new Blob([json], { type: RECORDING_MIME }) };
    }

    onLiveEvent(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    destroy() {
        this.listeners.clear();
        if (this.surface) disposeSurface(this.surface);
        this.surface = null;
    }

    _attach() {
        const { stage, board, canvas } = this.surface;
        this.instrument = new DrawingInstrument({ registry: this.registry });
        this.recorder = new StrokeRecorder();
        this.cycle = setupDrawCycle({
            stage, board, canvas,
            build: makeMarkBuilder({ state: this.instrument.state, board }),
            pointerTrace: false,
            onCommit: (points, seed) => this.recorder.add({ ...this.instrument.snapshot(), seed }, points),
            onRelease: () => this.instrument.release(false),
            onFeed: (points, done, seed) => this._feed(points, done, seed),
        });
        stage.onResize(() => {
            if (this.clearPending) { this.clear(); return; }
            this._emit({ type: 'view', ...viewOf(stage) });
        });
    }

    // A gesture starts when the point count restarts; the mirror gets the state
    // it is drawn with, then only the points added since the last feed.
    _feed(points, done, seed) {
        if (this.sentPoints === 0 || points.length < this.sentPoints) {
            this.sentPoints = 0;
            this._emit({ type: 'stroke', record: this.instrument.snapshot(), seed });
        }
        const fresh = points.slice(this.sentPoints).map(plainPoint);
        if (fresh.length > 0 || done) this._emit({ type: 'points', points: fresh, done });
        this.sentPoints = done ? 0 : points.length;
    }

    // The whole surface as live events: the view, the background, and every
    // recorded mark as a completed gesture with its own seed.
    _emitSnapshot() {
        if (this.listeners.size === 0) return;
        this._emit({ type: 'view', ...viewOf(this.surface.stage) });
        this._emit({ type: 'clear', background: this.recorder.background });
        for (const { points, seed, ...record } of this.recorder.records) {
            this._emit({ type: 'stroke', record, seed });
            this._emit({ type: 'points', points, done: true });
        }
    }

    _emit(data) {
        if (this.listeners.size === 0) return;
        const event = encodeLiveEvent(data);
        this.listeners.forEach(listener => listener(event));
    }
}

export const createDrawingEngine = options => new ContractDrawingEngine(options);
