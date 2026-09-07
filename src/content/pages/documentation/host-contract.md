---
title: Host Contract
---

<div class="prose">

The library as a component for another application. `myaf2026-elililly-art-web` (the MEET YOUR ART FESTIVAL 2026 installation) defines three interfaces, `DrawingEngine`, `DrawingLiveView`, and `DrawingPlayer`, and this group implements them over the instrument, the draw cycle, and the player. The package is published as `@r21nomi/draw`; its entry exports `createDrawingEngine`, `createDrawingLiveView`, `createDrawingPlayer`, and `ParameterId`.
<div class="jp">ライブラリを、別のアプリケーションから使うコンポーネントにしたものです。`myaf2026-elililly-art-web`（MEET YOUR ART FESTIVAL 2026のインスタレーション）は`DrawingEngine`、`DrawingLiveView`、`DrawingPlayer`の3つのインターフェースを定めており、このグループはそれらを楽器、描画サイクル、プレイヤーの上に実装します。パッケージは`@r21nomi/draw`として公開され、入口から`createDrawingEngine`、`createDrawingLiveView`、`createDrawingPlayer`、`ParameterId`をエクスポートします。</div>

<div class="page-note">
<p><code>public/lib/contract/</code>: <code>ContractDrawingEngine.js</code>, <code>ContractLiveView.js</code>, <code>ContractPlayer.js</code>, <code>surface.js</code>, <code>liveEvents.js</code>, <code>recording.js</code>, <code>index.d.ts</code></p>
</div>

## Common features

Each implementation owns one surface: a wrapper that fills the container it is mounted in, a canvas, a stage, and a board. `mount` may be called again with another container; the surface moves and keeps its drawing. None of the three renders any control, so the host owns the interface.
<div class="jp">3つの実装はそれぞれひとつの面を持ちます。マウント先のコンテナいっぱいに広がるラッパー、canvas、ステージ、ボードです。`mount`は別のコンテナで再度呼べます。面は移動し、絵はそのまま残ります。3つとも操作部品を描かないので、インターフェースはホストが持ちます。</div>

The engine keeps the library's fixed scale (`PIXELS_PER_UNIT`), so the drawing area is the container itself, and the view it shows is the pair of world half-extents `{ extentX, extentY }`. The live view and the player receive that view and frame it inside their own container with `fit`, so a smaller screen shows the same rectangle, smaller.
<div class="jp">エンジンはライブラリの固定スケール（`PIXELS_PER_UNIT`）を保つため、描画領域はコンテナそのもので、表示している範囲はワールドの半径の組`{ extentX, extentY }`です。ライブビューとプレイヤーはその範囲を受け取り、`fit`で自身のコンテナ内に収めます。小さい画面には同じ矩形が小さく映ります。</div>

## ContractDrawingEngine

`createDrawingEngine({ registry, scatterMarks })` builds the tablet side over a `DrawingInstrument`. The first `mount` clears to a fresh background with the scattered marks (or waits for the first layout when the container has no size yet); every later `mount` keeps the drawing and emits the current state as live events (the view, the background, and every recorded mark), so a mirror that started listening late catches up. `clear` clears on demand. `setParameter(id, value)` takes a dial position in 0..1 for `ParameterId.HUE` or `ParameterId.TOOL`, quantizes it into the same six-unit buckets as the floating dials, and steps the palette hue or the tool trail by the buckets crossed.
<div class="jp">`createDrawingEngine({ registry, scatterMarks })`は`DrawingInstrument`の上にタブレット側を組み立てます。最初の`mount`は新しい背景と散らした印にクリアします（コンテナにまだサイズがなければ、最初のレイアウトを待ちます）。以降の`mount`は絵を保ったまま、現在の状態（範囲、背景、記録済みのすべての印）をライブイベントとして送るので、遅れて購読を始めたミラーも追いつけます。`clear`は任意の時点でクリアします。`setParameter(id, value)`は`ParameterId.HUE`か`ParameterId.TOOL`について0..1のダイヤル位置を受け取り、浮かんでいるダイヤルと同じ6単位のバケットに量子化し、越えたバケットの数だけパレットの色相かツールの列を進めます。</div>

Every pen release rerolls the palette's jitter, as the drawing tool does without auto mode. `exportImage` renders the frame and returns it as a PNG; `exportRecording` returns the drawing log (`{ version, view, background, records }`) as JSON with format `kynd-draw-log`. `onLiveEvent` subscribes to the events below.
<div class="jp">ペンを離すたびに、autoモードでない描画ツールと同じく、パレットの揺らぎが引き直されます。`exportImage`はフレームを描画してPNGとして返します。`exportRecording`は描画のログ（`{ version, view, background, records }`）を、形式`kynd-draw-log`のJSONとして返します。`onLiveEvent`は下のイベントを購読します。</div>

## Live events

An event is `{ format: 'kynd-draw-live', version: 1, data }`; the host forwards it unread.
<div class="jp">イベントは`{ format: 'kynd-draw-live', version: 1, data }`で、ホストは中身を読まずに転送します。</div>

- **view:** `{ extentX, extentY }`, the engine's world half-extents, on mount and on every resize.<br /><span class="jp">**view：**`{ extentX, extentY }`、エンジンのワールドの半径。マウント時とリサイズのたびに送られます。</span>
- **clear:** `{ background }`, a fresh canvas with its background spec.<br /><span class="jp">**clear：**`{ background }`、背景の指定を伴う新しいキャンバス。</span>
- **stroke:** `{ record, seed }`, the start of a gesture: the instrument's snapshot (tool, parameter values, width, sensitivity, colors) and the cycle's gesture seed.<br /><span class="jp">**stroke：**`{ record, seed }`、ジェスチャの開始。楽器のスナップショット（ツール、パラメータ値、幅、感度、色）と、サイクルのジェスチャシード。</span>
- **points:** `{ points, done }`, the points added since the last event as `{ x, y, pressure }` in world units; `done` marks the release.<br /><span class="jp">**points：**`{ points, done }`、前のイベント以降に増えた点。ワールド単位の`{ x, y, pressure }`で、`done`が離した合図です。</span>

## ContractLiveView

`createDrawingLiveView({ registry })` mirrors an engine. `apply` takes the events in order: `view` reframes the stage, `clear` clears the board to the spec, `stroke` restores the record into its state and sets the cycle's seed, and `points` feeds the gesture's accumulated points through the cycle. The same draw cycle, state, and seed rebuild the same marks, splitting and smoothing included. `reset` returns to blank paper.
<div class="jp">`createDrawingLiveView({ registry })`はエンジンを映します。`apply`はイベントを順に受け取ります。`view`はステージを組み直し、`clear`はボードを指定にクリアし、`stroke`は記録を状態に戻してサイクルのシードを合わせ、`points`はジェスチャの累積した点をサイクルに流します。同じ描画サイクル、状態、シードが、分割と平滑化も含めて同じ印を作り直します。`reset`は白紙に戻します。</div>

## ContractPlayer

`createDrawingPlayer({ registry })` replays a recording. `load` decodes the log and frames its view. `play({ speed, loop })` feeds each record a few points per frame (four at speed 1), `pause` stops, and `seek(progress)` shows the state at a fraction of all recorded points, committing the records before it whole. `onEnded` fires at the end of every pass.
<div class="jp">`createDrawingPlayer({ registry })`は記録を再生します。`load`はログを読み取り、その範囲を組みます。`play({ speed, loop })`は各記録の点を1フレームに数点ずつ（速度1で4点）流し、`pause`は止め、`seek(progress)`は全記録点の割合の位置の状態を、その前の記録を丸ごと確定したうえで表示します。`onEnded`は各回の終わりに呼ばれます。</div>

</div>
