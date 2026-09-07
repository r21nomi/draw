// Type declarations for the host contract, mirroring types/drawing.ts in
// myaf2026-elililly-art-web (docs/drawing-engine.md there).

export declare const ParameterId: { readonly HUE: 'hue'; readonly TOOL: 'tool' };
export type ParameterId = (typeof ParameterId)[keyof typeof ParameterId];

export interface DrawingRecording {
  format: string;
  version: number;
  data: Blob;
}

export interface DrawingLiveEvent {
  format: string;
  version: number;
  data: unknown;
}

export interface DrawingEngine {
  mount(container: HTMLElement): void;
  clear(): void;
  setParameter(id: ParameterId, value: number): void;
  exportImage(): Promise<Blob>;
  exportRecording(): Promise<DrawingRecording>;
  onLiveEvent(listener: (event: DrawingLiveEvent) => void): () => void;
  destroy(): void;
}

export interface DrawingLiveView {
  mount(container: HTMLElement): void;
  reset(): void;
  apply(event: DrawingLiveEvent): void;
  destroy(): void;
}

export interface PlayOptions {
  speed?: number;
  loop?: boolean;
}

export interface DrawingPlayer {
  mount(container: HTMLElement): void;
  load(recording: DrawingRecording): Promise<void>;
  play(options?: PlayOptions): void;
  pause(): void;
  seek(progress: number): void;
  onEnded(listener: () => void): () => void;
  destroy(): void;
}

export interface ToolRegistryEntry {
  id: string;
  kind: 'stroke' | 'blob';
}

export interface EngineOptions {
  registry?: ToolRegistryEntry[];
  scatterMarks?: number;
}

export interface ViewOptions {
  registry?: ToolRegistryEntry[];
}

export declare const LIVE_FORMAT: string;
export declare const LIVE_VERSION: number;
export declare const RECORDING_FORMAT: string;
export declare const RECORDING_VERSION: number;

export declare function createDrawingEngine(options?: EngineOptions): DrawingEngine;
export declare function createDrawingLiveView(options?: ViewOptions): DrawingLiveView;
export declare function createDrawingPlayer(options?: ViewOptions): DrawingPlayer;
