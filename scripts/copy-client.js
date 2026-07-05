// Copies the Angular production build into the published API's wwwroot,
// so the self-contained API exe serves the UI in the packaged app.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'client', 'dist', 'client', 'browser');
const dest = path.join(__dirname, '..', 'build', 'api', 'wwwroot');

if (!fs.existsSync(src)) {
  console.error(`Angular build not found at ${src} — run "npm run build:client" first.`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied Angular build → ${dest}`);
