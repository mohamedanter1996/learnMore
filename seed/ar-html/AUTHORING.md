# Authoring a rich Egyptian-Arabic lesson page

One page per lesson, standalone HTML, served by `GET /api/items/{id}/ar-html` into a sandboxed
iframe. Reference implementations (read one before writing a new page):
`1-dsa/arrays-memory-layout.html`, `3-sql-optimization/clustered-indexes.html`.

## Workflow

1. Take the **top unchecked** entry in `QUEUE.md` — that gives topic, exact lesson title, and file path.
2. Read the lesson's English source in `seed/<topic-file>.json` and its current Arabic markdown in
   `seed/ar/<topic-file>.json` (match on `title`). The page must teach the *same* material, deeper.
3. Write the page at the path from the queue.
4. Register it in `index.json` — `topic` and `title` must match the seed **byte for byte**
   (`&`, `<TKey,TValue>`, punctuation included), otherwise the lookup silently misses.
5. Tick the queue entry and move the line to the Done list.
6. Commit and push. One lesson per commit: `content: Arabic explanation page for <title>`.

## Hard requirements

- `<!doctype html><html lang="ar" dir="rtl">`, `<meta charset="utf-8">`, viewport meta, a `<title>`
  ending with `— شرح بالمصري`.
- Both stylesheet links, in this order — the first works when served, the second when the file is
  opened straight from disk:
  ```html
  <link rel="stylesheet" href="/api/ar-html/shared.css">
  <link rel="stylesheet" href="../_shared/lesson.css">
  ```
  Page-specific CSS goes in one `<style>` block after them. Never add a third stylesheet, a font, a
  script tag with a `src`, or an image URL — **no network at runtime**, the app works offline.
- End the page with the height reporter, exactly as in the reference pages: post
  `{ type: 'lm-ar-height', height: document.documentElement.scrollHeight }` to `parent` on `load`,
  on `ResizeObserver`, and ~300 ms after any click. Without it the iframe keeps its default height.
- Vanilla JS only, wrapped in one IIFE. No frameworks, no `eval`, no `fetch`.
- Arabic body text is Egyptian dialect, plain and direct. Code, identifiers and English terms stay in
  Latin script inside `<code>`/`<pre>` (they inherit `direction: ltr` from the shared CSS).
- Use the shared classes (`card`, `sec-title`, `callout`, `stage`, `controls`, `btn`, `mistakes`,
  `q`/`opt`/`feedback`, `summary`). Only add CSS for the page's own diagram.
- Colors come from the shared palette variables. Never hardcode a hex that isn't in `_shared/lesson.css`.

## Required sections, in order

1. **hero** — kicker with the topic emoji, an Arabic headline that states the insight (not the lesson
   title translated), and the English title underneath.
2. **ليه الدرس ده مهم؟** — a concrete scenario from ASP.NET Core / Angular / SQL Server work with real
   numbers, then a `callout bad` saying what breaks if you don't understand it.
3. **الفكرة في صورة** — the core mechanism as an animated SVG or CSS diagram. It must show *how the
   thing actually works*, not decoration. Any looping animation needs a ▶/⏸ button.
4. **خطوة بخطوة** — a stepper (`prev`/`next` buttons + step counter) that walks the same diagram
   through 5–6 states. Going back must rebuild state correctly, not just undo the last frame.
5. **مثال واقعي** — C#/TypeScript before-and-after with the measurable difference (ms, logical reads,
   allocations). Real APIs only; never invent a method that doesn't exist.
6. **غلطات بتحصل كتير** — 4–5 `mistakes` items, each a mistake a mid-level dev actually makes.
7. **اختبر نفسك** — 2 questions using the `q`/`data-correct`/`opt`/`feedback` markup; clicking an
   option marks right/wrong and reveals the explanation.
8. **الخلاصة في ٣ نقاط** — three sentences, each one usable on its own.

At least one interactive control beyond the stepper (a demo the reader drives: add an item, run a
scan, change a parameter). Aim for 300–450 lines total.

## Self-check before committing

- The file parses and every element the script touches exists (id typos are the usual failure).
- `index.json` stays valid JSON and its `topic`/`title` match the seed exactly.
- No `http://` or `https://` URL anywhere in the file except the two stylesheet links.
- `prefers-reduced-motion` is respected — it already is, via the shared CSS, as long as animation
  lives in CSS classes rather than JS timers that can't be stopped.
