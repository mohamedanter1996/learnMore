const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = process.argv.includes('--dev');
const startHidden = process.argv.includes('--hidden');
const API_BASE = 'http://localhost:5199';
const UI_URL = isDev ? 'http://localhost:4200' : API_BASE;

let mainWindow = null;
let tray = null;
let apiProcess = null;
let isQuitting = false;
let lastNotifiedAt = 0;
let lastKnownTodayStatus = null;
let updateReady = false;

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

// ---------------------------------------------------------------------------
// Motivation state (milestone dedup) — JSON file in userData
// ---------------------------------------------------------------------------
function statePath() {
  return path.join(app.getPath('userData'), 'motivation.json');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return { milestones: {}, praisedDate: null, topicNudges: {} };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state));
  } catch { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// API child process (production only — in dev, `npm run dev` starts it)
// ---------------------------------------------------------------------------
function startApi() {
  if (isDev) return;
  const apiDir = path.join(process.resourcesPath, 'api');
  const exe = path.join(apiDir, 'LearnMore.Api.exe');
  apiProcess = spawn(exe, [], {
    cwd: apiDir,
    env: {
      ...process.env,
      SeedDirectory: path.join(process.resourcesPath, 'seed'),
      ASPNETCORE_ENVIRONMENT: 'Production'
    },
    stdio: 'ignore',
    windowsHide: true
  });
  apiProcess.on('exit', code => {
    apiProcess = null;
    if (!isQuitting && code !== 0) {
      setTimeout(startApi, 3000);
    }
  });
}

function stopApi() {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
}

function apiGet(pathName) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${API_BASE}${pathName}`, { timeout: 3000 }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function waitForApi(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await apiGet('/api/health');
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: !startHidden,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // External links (lesson references, course recommendations) → default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.startsWith(API_BASE) && !url.startsWith('http://localhost:4200')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(UI_URL);

  // Close button hides to tray so the reminder scheduler keeps running.
  mainWindow.on('close', e => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow(route) {
  if (!mainWindow) return;
  if (route) mainWindow.loadURL(`${UI_URL}${route}`);
  mainWindow.show();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Auto-update (packaged builds only)
// ---------------------------------------------------------------------------
function setupAutoUpdate() {
  if (isDev) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return; // updater not bundled — skip silently
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', info => {
    updateReady = true;
    rebuildTrayMenu();
    const n = new Notification({
      title: '⬆️ LearnMore update ready',
      body: `Version ${info.version} downloaded — it installs automatically when you quit, or restart now from the tray menu.`,
      icon: path.join(__dirname, 'assets', 'icon.png')
    });
    n.show();
  });
  autoUpdater.on('error', () => { /* offline or no releases yet — fine */ });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 4 * 3600 * 1000); // every 4 hours
}

function quitAndInstall() {
  try {
    const { autoUpdater } = require('electron-updater');
    isQuitting = true;
    stopApi();
    autoUpdater.quitAndInstall();
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function rebuildTrayMenu() {
  if (!tray) return;
  const items = [
    { label: 'Open LearnMore', click: () => showWindow() },
    { label: "Today's lesson", click: () => showWindow('/today') },
    { label: 'My roadmap', click: () => showWindow('/roadmap') },
    { type: 'separator' }
  ];
  if (updateReady) {
    items.push({ label: '⬆️ Restart to update', click: quitAndInstall });
    items.push({ type: 'separator' });
  }
  items.push({ label: 'Quit', click: () => { isQuitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('LearnMore — daily tech skills');
  rebuildTrayMenu();
  tray.on('double-click', () => showWindow());
}

function updateTrayStatus(done) {
  if (!tray) return;
  tray.setToolTip(done
    ? 'LearnMore — done for today ✅'
    : "LearnMore — today's lesson is waiting 📖");
}

// ---------------------------------------------------------------------------
// Notifications: reminders + motivation
// ---------------------------------------------------------------------------
const REMINDER_MESSAGES = [
  t => `${t.item.topicIcon} ${t.item.title} — about ${t.item.estimatedMinutes} minutes. Keep the streak alive!`,
  t => `Your daily lesson is waiting: ${t.item.title}. Small step today, senior title tomorrow 💪`,
  t => `${t.item.estimatedMinutes} minutes of ${t.item.topicName} — that's all today asks. يلا بينا 🚀`,
  t => `Don't break the chain! ${t.item.topicIcon} ${t.item.title} is ready when you are.`,
  t => `Future-you says thanks in advance: ${t.item.title} (${t.item.estimatedMinutes} min).`
];

const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function notify(title, body, route) {
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  if (route) n.on('click', () => showWindow(route));
  n.show();
}

async function checkReminder() {
  let today, settings, stats;
  try {
    [today, settings, stats] = await Promise.all([
      apiGet('/api/today'),
      apiGet('/api/settings'),
      apiGet('/api/stats')
    ]);
  } catch {
    return; // API not reachable right now — try again next tick
  }

  const done = today.status === 'completed';
  updateTrayStatus(done);
  const state = loadState();
  const todayKey = new Date().toISOString().slice(0, 10);

  // --- Completion praise: today flipped pending → completed while we watched
  if (done && lastKnownTodayStatus === 'pending' && state.praisedDate !== todayKey) {
    state.praisedDate = todayKey;
    saveState(state);
    notify('🎉 Done for today!',
      `${today.item.topicName} +1. Streak: ${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'} 🔥 — see you tomorrow!`);
  }
  lastKnownTodayStatus = today.status;

  // --- Streak milestones (once each)
  if (done && MILESTONES.includes(stats.currentStreak) && !state.milestones[stats.currentStreak]) {
    state.milestones[stats.currentStreak] = true;
    saveState(state);
    notify(`🔥 ${stats.currentStreak}-day streak!`,
      stats.currentStreak >= 30
        ? `${stats.currentStreak} days straight — عاش يا وحش! That's real discipline.`
        : `${stats.currentStreak} days in a row — عاش يا بطل! Keep it going.`,
      '/stats');
  }

  // --- Near-finish nudges: ≤3 lessons left in a track (once per remaining-count per topic)
  if (done && stats.perTopic) {
    for (const t of stats.perTopic) {
      const remaining = t.total - t.completed;
      if (remaining > 0 && remaining <= 3) {
        const key = `${t.name}`;
        if (state.topicNudges[key] !== remaining) {
          state.topicNudges[key] = remaining;
          saveState(state);
          notify(`🏁 Almost there: ${t.name}`,
            `Only ${remaining} lesson${remaining === 1 ? '' : 's'} left to finish the whole track!`,
            '/roadmap');
          break; // one nudge per tick is enough
        }
      }
    }
  }

  // --- Nag reminder (pending only)
  if (done || !settings.notificationsEnabled) return;

  const [h, m] = (settings.reminderTime || '09:00').split(':').map(Number);
  const now = new Date();
  const reminderStart = new Date(now);
  reminderStart.setHours(h, m, 0, 0);
  if (now < reminderStart) return;

  const repeatMs = Math.max(1, settings.reminderRepeatHours || 2) * 3600 * 1000;
  if (Date.now() - lastNotifiedAt < repeatMs) return;

  lastNotifiedAt = Date.now();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const message = REMINDER_MESSAGES[dayOfYear % REMINDER_MESSAGES.length](today);
  notify("📖 Today's lesson is waiting", message, '/today');
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  app.setAppUserModelId('com.anter.learnmore'); // Windows toast identity

  startApi();
  const apiUp = await waitForApi();

  createWindow();
  createTray();
  setupAutoUpdate();

  if (!apiUp && !isDev) {
    mainWindow.loadURL(`data:text/html,<body style="background:%230f172a;color:%23e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><h2>LearnMore API failed to start. Check that SQL Server LocalDB is installed.</h2></body>`);
  }

  if (!isDev) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  }

  checkReminder();
  setInterval(checkReminder, 60 * 1000);
});

app.on('before-quit', () => {
  isQuitting = true;
  stopApi();
});

app.on('window-all-closed', e => {
  // Keep running in the tray; explicit Quit only.
  e.preventDefault();
});
