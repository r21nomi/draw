import { StrokeStage } from '../demo/stage.js';
import { DrawingBoard } from '../demo/drawingBoard.js';
import { PIXELS_PER_UNIT } from '../CanvasBuffer.js';

/** The paper color a surface starts with, before any background spec arrives. */
export const PAPER = '#f3efe6';

/** World half-extents of a Full HD window at the fixed scale, used until a view arrives. */
export const DEFAULT_VIEW = { extentX: 1920 / (2 * PIXELS_PER_UNIT), extentY: 1080 / (2 * PIXELS_PER_UNIT) };

/**
 * A drawing surface for a host page: an outer element that fills its container, a
 * wrapper the viewport measures, a canvas, and (once mounted) a stage and a board.
 * Inline styles stand in for the demo stylesheet, so a host needs no CSS of its
 * own. With `fit` the wrapper takes the view's aspect ratio inside the container
 * and the stage frames exactly those half-extents; without it the wrapper fills
 * the container and the stage maps it to world at the fixed scale.
 */
export function createSurface({ fit = null } = {}) {
    const outer = document.createElement('div');
    Object.assign(outer.style, {
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size',
    });
    const wrap = document.createElement('div');
    wrap.className = 'canvas-wrap';
    Object.assign(wrap.style, { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block',
        touchAction: 'none', userSelect: 'none',
    });
    wrap.appendChild(canvas);
    outer.appendChild(wrap);
    const surface = { outer, wrap, canvas, stage: null, board: null, fit };
    if (fit) setSurfaceView(surface, fit);
    return surface;
}

/** Sizes the wrapper to the view's aspect ratio, as large as fits the container. */
export function setSurfaceView(surface, view) {
    surface.fit = view;
    const aspect = view.extentX / view.extentY;
    Object.assign(surface.wrap.style, {
        width: `min(100cqw, ${aspect} * 100cqh)`,
        height: `min(100cqh, ${1 / aspect} * 100cqw)`,
    });
    surface.stage?.setFit({ width: view.extentX, height: view.extentY });
}

/**
 * Appends the surface to `container`. The stage is created on the first mount, once
 * the wrapper is in the document and has a size, so the first frame is already
 * sized to the container.
 */
export function mountSurface(surface, container) {
    if (surface.outer.parentElement !== container) container.appendChild(surface.outer);
    if (surface.stage) return false;
    const fit = surface.fit ? { width: surface.fit.extentX, height: surface.fit.extentY } : undefined;
    surface.stage = new StrokeStage(surface.canvas, { fit });
    surface.board = new DrawingBoard(surface.stage);
    return true;
}

export function disposeSurface(surface) {
    surface.outer.remove();
    surface.stage?.renderer.dispose();
}

/** The world half-extents the stage currently shows. */
export function viewOf(stage) {
    return { extentX: stage.extentX, extentY: stage.extentY };
}

/** Reads the presented frame as a PNG. Renders first, so the read happens in the same task. */
export function surfaceToBlob(surface) {
    surface.stage.drawNow();
    return new Promise((resolve, reject) => {
        surface.canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to export the canvas'));
        }, 'image/png');
    });
}
