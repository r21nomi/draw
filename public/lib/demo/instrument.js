import { ThemedPaletteMaker, PALETTE_THEMES } from '../ThemedPaletteMaker.js';
import { oklchToHex, maxChromaAt } from '../color.js';
import { scatterPath } from './strokePaths.js';
import { randomValues } from './toolRegistry.js';

/** Rolled tools remembered on each side of the current one. */
export const TRAIL_SIDE = 10;

const ROLL_THEMES = PALETTE_THEMES.filter(th => th.id !== 'black').map(th => th.id);
const pick = list => list[Math.floor(Math.random() * list.length)];
const rollSeed = () => Math.floor(Math.random() * 1e9);

/**
 * The instrument's state without its interface: the current tool and everything a
 * mark needs, the palette (a key hue, a theme, and a seed), and the trail of rolled
 * tools the tool dial walks. `setupDrawingTool` builds its controls over one of
 * these; the host contract engine drives one from parameter values. Methods change
 * the state only; whoever owns the interface redraws after calling them.
 */
export class DrawingInstrument {
    constructor({ registry }) {
        this.registry = registry;
        // `seedOverride` is set while a replayed record drives the cycle, so seeded
        // looks reproduce.
        this.state = {
            tool: registry[0], values: {}, widthPx: 24, sens: 1,
            colorA: '#333333', colorB: '#666666', colors: ['#333333'],
            palette: null, seedOverride: null,
        };
        this.paletteCfg = { hue: Math.random() * 360, count: 5, theme: pick(ROLL_THEMES), seed: rollSeed() };
        this.toolValues = {};
        this.toolIndex = 0;
        this.trail = Array.from({ length: TRAIL_SIDE * 2 + 1 }, () => this.rollEntry());
        this.applyRoll(this.trail[TRAIL_SIDE]);
        this.regenPalette();
    }

    /** Regenerates the palette from its config. The key color follows the hue and theme exactly. */
    regenPalette() {
        const state = this.state;
        state.palette = new ThemedPaletteMaker(this.paletteCfg).generate();
        const entries = state.palette.entries;
        state.colorA = entries[0].hex;
        const rest = entries.slice(1);
        state.colorB = (pick(rest) ?? entries[0]).hex;
        state.colors = entries.map(e => e.hex);
    }

    /** Rerolls the jitter under the same hue, count, and theme. */
    rerollPalette() {
        this.paletteCfg.seed = rollSeed();
        this.regenPalette();
    }

    /** One hue dial step: the key hue moves by about ten degrees and the theme rerolls. */
    paletteStep(steps) {
        this.paletteCfg.hue = (this.paletteCfg.hue + steps * (7 + Math.random() * 7) + 360) % 360;
        this.paletteCfg.theme = pick(ROLL_THEMES);
        this.paletteCfg.seed = rollSeed();
        this.regenPalette();
    }

    /** A random tool with rolled parameters, width, and pressure sensitivity. */
    rollEntry() {
        const tool = pick(this.registry);
        return {
            tool,
            values: randomValues(tool),
            widthPx: 2 + Math.random() * 58,
            // Pressure can widen the stroke by up to three times at full sensitivity.
            sens: Math.random() * 2,
        };
    }

    applyRoll(entry) {
        const state = this.state;
        state.tool = entry.tool;
        state.values = entry.values;
        state.widthPx = entry.widthPx;
        state.sens = entry.sens;
        this.toolIndex = this.registry.indexOf(entry.tool);
        this.toolValues[entry.tool.id] = entry.values;
    }

    /**
     * Walks the trail: passing a tool over and dialing back finds the same one,
     * with the width, parameters, and sensitivity it was left with.
     */
    stepTrail(steps) {
        const { state, trail } = this;
        trail[TRAIL_SIDE] = { tool: state.tool, values: state.values, widthPx: state.widthPx, sens: state.sens };
        for (let i = 0; i < Math.abs(steps); i++) {
            if (steps > 0) { trail.shift(); trail.push(this.rollEntry()); }
            else { trail.pop(); trail.unshift(this.rollEntry()); }
        }
        this.applyRoll(trail[TRAIL_SIDE]);
    }

    /** Selects a tool by registry index, keeping the values it was last used with. */
    selectTool(index) {
        this.toolIndex = Math.max(0, Math.min(this.registry.length - 1, index));
        this.state.tool = this.registry[this.toolIndex];
        this.state.values = this.toolValues[this.state.tool.id] ??= randomValues(this.state.tool);
    }

    /** What happens on every pen release: the palette jitter rerolls; auto mode also rolls the tool. */
    release(autoRandom) {
        if (!autoRandom) { this.rerollPalette(); return; }
        this.paletteStep(Math.random() < 0.5 ? -1 : 1);
        this.stepTrail(1);
    }

    /** Everything a record needs to rebuild a mark, except its points and seed. */
    snapshot() {
        const state = this.state;
        return {
            toolId: state.tool.id, values: { ...state.values },
            widthPx: state.widthPx, sens: state.sens,
            colorA: state.colorA, colorB: state.colorB, colors: [...state.colors],
        };
    }

    /**
     * A background spec for a fresh canvas: a gradient between paper-light tints of
     * two palette hues, so any theme clears to a drawable ground. Plain data, so a
     * recorder can store it.
     */
    makeBackground() {
        const paperTint = entry => {
            const L = 0.86 + Math.random() * 0.08;
            return oklchToHex(L, Math.min(maxChromaAt(L, entry.H) * 0.5, 0.03 + Math.random() * 0.04), entry.H);
        };
        const entries = this.state.palette.entries;
        return {
            type: Math.random() < 0.5 ? 'linear' : 'radial',
            colorA: paperTint(pick(entries)),
            colorB: paperTint(pick(entries)),
            angle: Math.random() * Math.PI * 2,
            center: [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6],
        };
    }

    /**
     * Clears the canvas to a fresh background and scatters a few marks from rolled
     * tools, every one through the cycle so it is recorded and mirrored. `onClear`
     * runs after the clear and before the marks. Returns the background.
     */
    clearCanvas({ cycle, board, stage, recorder = null, marks = 3, onClear = null }) {
        const background = this.makeBackground();
        cycle.disposeGhost();
        board.clear(background);
        recorder?.begin(background);
        onClear?.(background);
        for (let i = 0; i < marks; i++) {
            this.applyRoll(this.rollEntry());
            this.state.colorA = pick(this.state.colors);
            this.state.colorB = pick(this.state.colors);
            cycle.feed(scatterPath(stage.extentX, stage.extentY), true);
        }
        // Back to what the interface says: the palette from its config, the tool
        // from the trail's current entry.
        this.regenPalette();
        this.applyRoll(this.trail[TRAIL_SIDE]);
        return background;
    }
}

/**
 * Turns a dial's absolute value into steps. The range is quantized into buckets of
 * `step`; crossing into a new bucket yields the difference, staying inside one
 * yields zero. The first value only sets the bucket.
 */
export class DialStepper {
    constructor(step = 6, initial = null) {
        this.step = step;
        this.bucket = initial === null ? null : Math.round(initial / step);
    }

    feed(value) {
        const bucket = Math.round(value / this.step);
        if (this.bucket === null) { this.bucket = bucket; return 0; }
        const steps = bucket - this.bucket;
        this.bucket = bucket;
        return steps;
    }
}
