import { setupDrawCycle } from '../demo/drawCycle.js';
import { makeMarkBuilder, applyRecordTo } from '../demo/markBuilder.js';
import { toolRegistry } from '../demo/toolRegistry.js';
import { createSurface, mountSurface, disposeSurface, setSurfaceView, DEFAULT_VIEW, PAPER } from './surface.js';
import { decodeLiveEvent, toVectors } from './liveEvents.js';

/**
 * The host contract's `DrawingLiveView`: a surface that mirrors a tablet from its
 * live events. The stage frames the tablet's view inside whatever container it
 * has, and every gesture runs through the same draw cycle with the same state
 * and seed, so the marks match the tablet's.
 */
export class ContractLiveView {
    constructor({ registry = toolRegistry } = {}) {
        this.registry = registry;
        this.surface = null;
        this.view = DEFAULT_VIEW;
        this.points = [];
    }

    mount(container) {
        if (!this.surface) this.surface = createSurface({ fit: this.view });
        if (mountSurface(this.surface, container)) this._attach();
    }

    reset() {
        if (!this.surface?.stage) return;
        this.points = [];
        this.cycle.disposeGhost();
        this.surface.board.clear(PAPER);
        this.surface.stage.draw();
    }

    apply(event) {
        if (!this.surface?.stage) return;
        const data = decodeLiveEvent(event);
        switch (data.type) {
            case 'view':
                this.view = { extentX: data.extentX, extentY: data.extentY };
                setSurfaceView(this.surface, this.view);
                break;
            case 'clear':
                this.points = [];
                this.cycle.disposeGhost();
                this.surface.board.clear(data.background);
                this.surface.stage.draw();
                break;
            case 'stroke':
                this.points = [];
                applyRecordTo(this.state, { ...data.record, seed: null }, this.registry);
                this.state.seedOverride = null;
                this.cycle.setSeed(data.seed);
                break;
            case 'points':
                this.points = this.points.concat(data.points);
                if (this.points.length > 0) this.cycle.feed(toVectors(this.points), data.done);
                if (data.done) this.points = [];
                break;
        }
    }

    destroy() {
        if (this.surface) disposeSurface(this.surface);
        this.surface = null;
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
    }
}

export const createDrawingLiveView = options => new ContractLiveView(options);
