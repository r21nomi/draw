import { createDrawingEngine, createDrawingLiveView, createDrawingPlayer, ParameterId } from '../../lib/contract/index.js';

const $ = id => document.getElementById(id);
const log = message => {
    const pre = $('log');
    pre.textContent = `${new Date().toLocaleTimeString()} ${message}\n${pre.textContent}`;
};

const engine = createDrawingEngine();
const live = createDrawingLiveView();
const player = createDrawingPlayer();

// The network hop, simulated: every event goes through JSON before the mirror applies it.
let eventCount = 0;
engine.onLiveEvent(event => {
    live.apply(JSON.parse(JSON.stringify(event)));
    eventCount++;
});

live.mount($('live'));
player.mount($('player'));
engine.mount($('engine'));

$('hue').addEventListener('input', e => engine.setParameter(ParameterId.HUE, Number(e.target.value)));
$('tool').addEventListener('input', e => engine.setParameter(ParameterId.TOOL, Number(e.target.value)));
$('clear').addEventListener('click', () => engine.clear());

const setLink = (anchor, blob, fileName) => {
    if (anchor.href.startsWith('blob:')) URL.revokeObjectURL(anchor.href);
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    anchor.hidden = false;
};

$('finish').addEventListener('click', async () => {
    const [image, recording] = await Promise.all([engine.exportImage(), engine.exportRecording()]);
    setLink($('download-image'), image, 'artwork.png');
    setLink($('download-recording'), recording.data, 'recording.json');
    await player.load(recording);
    ['play', 'pause', 'seek'].forEach(id => { $(id).disabled = false; });
    log(`exported image ${Math.round(image.size / 1024)} KB, recording ${Math.round(recording.data.size / 1024)} KB, ${eventCount} live events so far`);
    player.play();
});
$('play').addEventListener('click', () => player.play());
$('pause').addEventListener('click', () => player.pause());
$('seek').addEventListener('input', e => player.seek(Number(e.target.value)));
player.onEnded(() => log('playback ended'));
