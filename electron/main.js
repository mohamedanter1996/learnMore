const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, session } = require('electron');
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
    return { milestones: {}, praisedDate: null, topicNudges: {}, morningDate: null, eveningDate: null };
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
// ~30 rotating bilingual (Egyptian Arabic 🇪🇬 / English) motivational reminders.
const REMINDER_MESSAGES = [
  t => `${t.item.topicIcon} ${t.item.title} — about ${t.item.estimatedMinutes} minutes. Keep the streak alive!`,
  t => `Your daily lesson is waiting: ${t.item.title}. Small step today, senior title tomorrow 💪`,
  t => `${t.item.estimatedMinutes} minutes of ${t.item.topicName} — that's all today asks. يلا بينا 🚀`,
  t => `Don't break the chain! ${t.item.topicIcon} ${t.item.title} is ready when you are.`,
  t => `Future-you says thanks in advance: ${t.item.title} (${t.item.estimatedMinutes} min).`,
  t => `متنساش درس النهاردة: ${t.item.title}. ${t.item.estimatedMinutes} دقيقة وتبقى أحسن من إمبارح.`,
  t => `الطريق للسينيور بيبدأ بخطوة صغيرة — ${t.item.title} مستنياك ✨`,
  t => `${t.item.topicName}: مذاكرة النهاردة استثمار في نفسك. يلا نكسّر! 🔥`,
  t => `10-15 minutes now beats 3 hours of cramming later. ${t.item.title} 📖`,
  t => `اللي بيتعلم كل يوم بيسبق اللي بيتعلم مرة كل شهر. ${t.item.estimatedMinutes} دقيقة بس.`,
  t => `Consistency > intensity. Today's ${t.item.topicName} lesson keeps the momentum 🌱`,
  t => `عايز تفرق عن باقي الـ developers؟ ${t.item.title} هي فرقك النهاردة.`,
  t => `${t.item.topicIcon} One lesson. One day. One level up. ${t.item.title}`,
  t => `مفيش حاجة اسمها 'مش فاضي' لـ ${t.item.estimatedMinutes} دقيقة. ${t.item.title} 💪`,
  t => `Compound interest works on skills too. Invest ${t.item.estimatedMinutes} min today 📈`,
  t => `${t.item.topicName} النهاردة — كل درس لبنة في اللي هتبنيه. 🧱`,
  t => `Your streak is watching you 👀 Don't let it down — ${t.item.title}`,
  t => `اقفل الـ social media وافتح ${t.item.title}. مكسبك هيبان. 🎯`,
  t => `Small daily wins → big career leaps. ${t.item.title} awaits 🚀`,
  t => `النهاردة ${t.item.topicName}. بكرة إنت اللي بتشرحها لغيرك. يلا! 🎓`,
  t => `Deep work beats doomscrolling. ${t.item.estimatedMinutes} focused minutes on ${t.item.title}.`,
  t => `كل سينيور كان يوم زيك — الفرق إنه ما وقفش. ${t.item.title} 🔥`,
  t => `${t.item.topicIcon} Ready to get 1% better today? ${t.item.title}`,
  t => `المذاكرة دلوقتي أسهل من الندم بعدين. ${t.item.title} في ${t.item.estimatedMinutes} دقيقة.`,
  t => `Interviews reward the prepared. Today's ${t.item.topicName} lesson is prep 💼`,
  t => `يلا يا بطل، ${t.item.estimatedMinutes} دقيقة وتقفل يومك صح ✅`,
  t => `The best time to learn was yesterday. The second best is now — ${t.item.title} ⏰`,
  t => `${t.item.topicName} مش هتذاكر نفسها 😄 يلا نخلّص ${t.item.title}.`,
  t => `Skills you build today are the raise you negotiate next year 💰 ${t.item.title}`,
  t => `خليك أحسن developer النهاردة عن إمبارح. ${t.item.title} 🌟`
];

// Time-anchored daily encouragers (bilingual), chosen by day of year.
const MORNING_MESSAGES = [
  "New day, new skill — يلا نتعلم حاجة جديدة النهاردة 🌅",
  "Good morning! Your lesson is ready — ابدأ يومك صح ☕",
  "صباح الكود ☀️ Today's lesson is the best start to your day.",
  "Rise and grind, developer! خلي أول إنجاز النهاردة يكون درسك 💪",
  "صباح الفل! 10 دقايق تعلّم دلوقتي = يوم كله طاقة 🚀"
];
const EVENING_MESSAGES = streak => [
  `Don't lose your 🔥 ${streak}-day streak — بقى في اليوم ساعات قليلة!`,
  `آخر فرصة النهاردة! درس واحد يحافظ على الـ streak بتاعك 🔥 (${streak} يوم)`,
  `Evening check-in: today's lesson still waiting. متسيبش الـ ${streak}-day streak يضيع ⏳`,
  `الليل بيخلص — احمي إنجازك! ${streak} يوم متتكسرش النهاردة 💪`
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

  const now = new Date();
  const [h, m] = (settings.reminderTime || '09:00').split(':').map(Number);
  const reminderStart = new Date(now);
  reminderStart.setHours(h, m, 0, 0);
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  // --- Morning kickoff: once/day at/after reminder time
  if (now >= reminderStart && state.morningDate !== todayKey) {
    state.morningDate = todayKey;
    saveState(state);
    notify('🌅 Good morning!', MORNING_MESSAGES[dayOfYear % MORNING_MESSAGES.length], '/today');
    lastNotifiedAt = Date.now();
    return;
  }

  // --- Evening streak-saver: once/day after 20:00 if still pending
  if (now.getHours() >= 20 && state.eveningDate !== todayKey) {
    state.eveningDate = todayKey;
    saveState(state);
    const opts = EVENING_MESSAGES(stats.currentStreak);
    notify('⏳ Streak in danger!', opts[dayOfYear % opts.length], '/today');
    lastNotifiedAt = Date.now();
    return;
  }

  if (now < reminderStart) return;

  const repeatMs = Math.max(1, settings.reminderRepeatHours || 2) * 3600 * 1000;
  if (Date.now() - lastNotifiedAt < repeatMs) return;

  lastNotifiedAt = Date.now();
  // Rotate by day + hour so repeats within a day still feel fresh.
  const idx = (dayOfYear + now.getHours()) % REMINDER_MESSAGES.length;
  notify("📖 Today's lesson is waiting", REMINDER_MESSAGES[idx](today), '/today');
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  app.setAppUserModelId('com.anter.learnmore'); // Windows toast identity

  // After an update the version changes; wipe the Chromium HTTP cache so the
  // renderer doesn't keep serving a stale index.html that points at old JS
  // hashes (which makes new features look "missing" until the cache clears).
  try {
    const verFile = path.join(app.getPath('userData'), 'app-version.txt');
    let prev = null;
    try { prev = fs.readFileSync(verFile, 'utf8').trim(); } catch { /* first run */ }
    if (prev !== app.getVersion()) {
      await session.defaultSession.clearCache();
      fs.writeFileSync(verFile, app.getVersion());
    }
  } catch { /* non-critical */ }

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
