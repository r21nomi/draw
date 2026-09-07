import { setupDrawCycle } from '../demo/drawCycle.js';
import { makeMarkBuilder, applyRecordTo } from '../demo/markBuilder.js';
import { toolRegistry } from '../demo/toolRegistry.js';
import { createSurface, mountSurface, disposeSurface, setSurfaceView, DEFAULT_VIEW, PAPER } from './surface.js';
import { toVectors } from './liveEvents.js';
import { decodeRecording } from './recording.js';

const POINTS_PER_FRAME = 4;

/**
 * The host contract's `DrawingPlayer`: replays a recording through the draw
 * cycle a few points per frame, with pause, seek by progress, and loop. The
 * stage frames the recording's view inside its container.
 */
export class ContractPlayer {
    constructor({ registry = toolRegistry } = {}) {
        this.registry = registry;
        this.surface = null;
        this.data = null;
        this.endedListeners = new Set();
        this.frameId = null;
        this.options = { speed: 1, loop: false };
        this.position = { record: 0, point: 0 };
    }

    mount(container) {
        if (!this.surface) this.surface = createSurface({ fit: this.data?.view ?? DEFAULT_VIEW });
        if (mountSurface(this.surface, container)) this._attach();
    }

    async load(recording) {
        this.pause();
        this.data = await decodeRecording(recording);
        if (this.surface?.stage) {
            setSurfaceView(this.surface, this.data.view ?? DEFAULT_VIEW);
            this._reset();
        }
    }

    play(options = {}) {
        if (!this.data) throw new Error('No recording loaded');
        this.options = { speed: options.speed ?? 1, loop: options.loop ?? false };
        if (this._atEnd()) this._reset();
        this.pause();
        this.frameId = requestAnimationFrame(this._tick);
    }

    pause() {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    /** Shows the state at `progress` (0..1 of all recorded points), committing whole records before it. */
    seek(progress) {
        if (!this.data || !this.surface?.stage) return;
        this.pause();
        this._reset();
        const total = this.data.records.reduce((n, r) => n + r.points.length, 0);
        let remaining = Math.round(Math.min(Math.max(progress, 0), 1) * total);
        for (let i = 0; i < this.data.records.length; i++) {
            const record = this.data.records[i];
            if (remaining >= record.points.length) {
                this._feedRecord(record, record.points.length, true);
                remaining -= record.points.length;
                this.position = { record: i + 1, point: 0 };
                continue;
            }
            if (remaining > 0) this._feedRecord(record, remaining, false);
            this.position = { record: i, point: remaining };
            return;
        }
    }

    onEnded(listener) {
        this.endedListeners.add(listener);
        return () => this.endedListeners.delete(listener);
    }

    destroy() {
        this.pause();
        this.endedListeners.clear();
        if (this.surface) disposeSurface(this.surface);
        this.surface = null;
        this.data = null;
    }

    _attach() {
        const { stage, board, canvas } = this.surface;
        this.state = {
            tool: this.registry[0], values: {}, widthPx: 24, sens: 1,
            colorA: '#333333', colorB: '#666666', colors: ['#333333'],
            palette: null, seedOverride: null,
        };
        this.cycle = setupDrawCycle({
            stage, board, canvas,
            build: makeMarkBuilder({ state: this.state, board }),
            pointerTrace: false,
        });
        this.cycle.input.enabled = false;
        board.clear(PAPER);
        if (this.data) this._reset();
    }

    _reset() {
        this.position = { record: 0, point: 0 };
        this.cycle.disposeGhost();
        this.surface.board.clear(this.data.background);
        this.surface.stage.draw();
    }

    _atEnd() {
        return this.position.record >= this.data.records.length;
    }

    _feedRecord(record, count, done) {
        applyRecordTo(this.state, record, this.registry);
        this.cycle.feed(toVectors(record.points.slice(0, count)), done);
    }

    _tick = () => {
        if (!this.data || this._atEnd()) { this._end(); return; }
        const record = this.data.records[this.position.record];
        const step = Math.max(1, Math.round(POINTS_PER_FRAME * this.options.speed));
        const point = Math.min(this.position.point + step, record.points.length);
        const done = point >= record.points.length;
        this._feedRecord(record, point, done);
        this.position = done ? { record: this.position.record + 1, point: 0 } : { record: this.position.record, point };
        if (this._atEnd()) { this._end(); return; }
        this.frameId = requestAnimationFrame(this._tick);
    };

    _end() {
        this.frameId = null;
        this.endedListeners.forEach(listener => listener());
        if (this.options.loop) this.play(this.options);
    }
}

export const createDrawingPlayer = options => new ContractPlayer(options);
