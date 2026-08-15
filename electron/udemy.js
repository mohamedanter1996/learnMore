// ---------------------------------------------------------------------------
// Udemy connection
//
// Udemy publishes no API for personal-account progress, so this reads the same
// internal endpoint the Udemy web app calls, authenticated with the session you
// create by logging in through Udemy's own page in a window of its own. The app
// never sees a password: it only ever reads the `access_token` cookie that login
// leaves behind, and calls go out through Chromium's network stack so they look
// like the browser requests they are.
//
// Everything lives in its own `persist:udemy` partition — never defaultSession,
// which main.js clears on version change. That cookie jar is also the single
// source of truth for "connected": no token, not connected.
//
// The API is a sink for what we fetch here. Progress is display-only and never
// touches the course-plan rules (artifact gate, streak, sessions).
// ---------------------------------------------------------------------------
const { BrowserWindow, session, net } = require('electron');

const PARTITION = 'persist:udemy';
const ORIGIN = 'https://www.udemy.com';
const LOGIN_URL = `${ORIGIN}/join/login-popup/?locale=en_US`;
const COURSE_FIELDS = 'id,title,url,completion_ratio,num_published_lectures,last_accessed_time';
const MAX_PAGES = 5;
const AUTO_SYNC_MS = 6 * 3600 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

let deps = { apiGet: null, apiPost: null, getParent: () => null };
let loginWindow = null;
let lastAttemptAt = 0;

function init(d) {
  deps = { ...deps, ...d };
}

function udemySession() {
  return session.fromPartition(PARTITION);
}

async function readToken() {
  try {
    const cookies = await udemySession().cookies.get({ url: ORIGIN, name: 'access_token' });
    return cookies.length ? cookies[0].value : null;
  } catch {
    return null;
  }
}

async function udemyFetch(url, token) {
  const res = await net.fetch(url, {
    session: udemySession(),
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${token}`,
      'X-Udemy-Authorization': `Bearer ${token}`
    }
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Udemy rejected the session — sign in again.');
  }
  if (!res.ok) {
    throw new Error(`Udemy returned HTTP ${res.status}.`);
  }
  return res.json();
}

async function fetchCourses(token) {
  let url = `${ORIGIN}/api-2.0/users/me/subscribed-courses/`
    + `?page_size=100&ordering=-last_accessed&fields[course]=${COURSE_FIELDS}`;
  const courses = [];

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const data = await udemyFetch(url, token);
    for (const c of data.results || []) {
      courses.push({
        id: c.id,
        title: c.title || '',
        url: c.url || '',
        completionRatio: typeof c.completion_ratio === 'number' ? c.completion_ratio : 0,
        lectureCount: typeof c.num_published_lectures === 'number' ? c.num_published_lectures : null,
        lastAccessed: c.last_accessed_time || null
      });
    }
    url = data.next || null;
  }
  return courses;
}

/** Display name for the Settings card — nice to have, never worth failing a sync over. */
async function fetchAccountName(token) {
  try {
    const data = await udemyFetch(`${ORIGIN}/api-2.0/contexts/me/?header=True`, token);
    return data?.header?.user?.display_name || null;
  } catch {
    return null;
  }
}

function status() {
  return deps.apiGet('/api/udemy/status');
}

/** Fetches from Udemy and pushes the result (or the failure) to the API. */
async function sync() {
  lastAttemptAt = Date.now();

  const token = await readToken();
  if (!token) {
    return deps.apiPost('/api/udemy/progress', { error: 'Not signed in to Udemy.' });
  }

  try {
    const courses = await fetchCourses(token);
    const account = await fetchAccountName(token);
    return await deps.apiPost('/api/udemy/progress', { account, courses });
  } catch (err) {
    // Offline or an expired session: the API keeps the last known percentages.
    return deps.apiPost('/api/udemy/progress', { error: String(err && err.message ? err.message : err) });
  }
}

/** Opens Udemy's own login page and waits for the session cookie it leaves behind. */
async function connect() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return status();
  }

  // Already signed in from a previous run — nothing to log in to.
  if (await readToken()) return sync();

  const parent = deps.getParent();
  const win = new BrowserWindow({
    parent: parent || undefined,
    width: 520,
    height: 760,
    autoHideMenuBar: true,
    title: 'Sign in to Udemy',
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  loginWindow = win;

  // SSO popups (Google/Facebook/Apple) must stay inside this session, otherwise
  // they open in the system browser and the login never completes here.
  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      parent: win,
      width: 520,
      height: 760,
      autoHideMenuBar: true,
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false }
    }
  }));

  win.loadURL(LOGIN_URL);

  const token = await new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(deadline);
      resolve(value);
    };
    const timer = setInterval(async () => {
      const t = await readToken();
      if (t) finish(t);
    }, 1000);
    const deadline = setTimeout(() => finish(null), LOGIN_TIMEOUT_MS);
    win.on('closed', () => finish(null)); // user gave up
  });

  loginWindow = null;
  if (!win.isDestroyed()) win.destroy();

  return token ? sync() : status();
}

async function disconnect() {
  try {
    await udemySession().clearStorageData();
  } catch { /* jar already gone */ }
  lastAttemptAt = 0;
  return deps.apiPost('/api/udemy/disconnect', {});
}

/** Called from the shell's minute tick: refresh at most every 6h, only while connected. */
async function maybeAutoSync() {
  if (Date.now() - lastAttemptAt < AUTO_SYNC_MS) return;
  if (!(await readToken())) return;
  try {
    await sync();
  } catch { /* next tick */ }
}

module.exports = { init, connect, sync, disconnect, maybeAutoSync };
