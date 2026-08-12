# Daily routine: one Arabic lesson page

This is the procedure the scheduled cloud agent follows. One lesson per run — never more.

1. Read `seed/ar-html/QUEUE.md`. Take the **first unchecked** `- [ ]` entry; it gives the topic, the
   exact lesson title, and the target file path. If nothing is unchecked: change nothing, push
   nothing, and report that the queue is empty.
2. Read `seed/ar-html/AUTHORING.md` in full — it is the binding contract for the page.
3. Read both reference pages before writing anything: `seed/ar-html/1-dsa/arrays-memory-layout.html`
   and `seed/ar-html/3-sql-optimization/clustered-indexes.html`. Match their structure, their use of
   the shared classes, and their depth.
4. Read the lesson's English source in `seed/<topic-file>.json` and its Arabic markdown in
   `seed/ar/<topic-file>.json` (match on `title`). The page teaches the same material, much deeper —
   it must not contradict it.
5. Write the page at the exact path from the queue entry.
6. Register it: add one entry to `seed/ar-html/index.json` with `topic` and `title` copied
   byte-for-byte from the seed file (`&`, `<TKey,TValue>`, punctuation included).
7. Tick the queue entry and move that line into the Done section of `QUEUE.md`.
8. Self-check, all three must pass before committing:
   - `node -e "JSON.parse(require('fs').readFileSync('seed/ar-html/index.json','utf8'))"`
   - every id used by the page's JS exists in its own markup (typos here are the usual failure)
   - the only `http(s)` URLs in the file are the two stylesheet links from `AUTHORING.md`
9. Commit as `content: Arabic explanation page for <lesson title>` (only the page, `index.json` and
   `QUEUE.md` — touch nothing else). Then `git pull --rebase origin main` and `git push origin main`.
   If the push is rejected, rebase again and retry once; if it still fails, report it and stop.

Do **not** build, package, or publish a release — the installer is built on the user's Windows
machine. Pages only reach the desktop app when a new version ships from there.

Report at the end: which lesson was written, the file path, and how many entries remain in the queue.
