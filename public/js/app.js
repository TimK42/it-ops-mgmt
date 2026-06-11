// Guard pattern: supports test reloads via vm.runInThisContext
// eslint-disable-next-line no-var
var state = state || {
  page: 'qa',
  qaEntries: [],
  categories: [],
  qaTotal: 0,
  qaTotalCount: null,
  qaPage: 1,
  qaFilters: { status: 'Published', search: '' },
  qaStatuses: [],
  qaSort: 'popular',
  user: null,
  sessionExpired: false,
  users: [],
  usersPage: 1,
  usersPerPage: 20,
  usersSearch: '',
};

// Restore sort preference from localStorage
(function restoreQASort() {
  try {
    const stored = localStorage.getItem('qaSort');
    if (stored === 'popular' || stored === 'newest') state.qaSort = stored;
  } catch {
    /* ignore */
  }
})();

function updateThemeColor(theme) {
  const color = theme === 'dark' ? '#0f0f1a' : '#4f46e5';
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta) => {
    if (meta.getAttribute('content') !== color) {
      meta.setAttribute('content', color);
    }
  });
}

function initTheme() {
  let theme = null;
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
  } catch {
    /* ignore */
  }
  if (!theme) {
    if (typeof window.matchMedia === 'function') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      theme = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeColor(theme);

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      let stored = null;
      try {
        stored = localStorage.getItem('theme');
      } catch {
        /* ignore */
      }
      if (!stored || (stored !== 'dark' && stored !== 'light')) {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        updateThemeColor(isDark ? 'dark' : 'light');
        const btn = document.getElementById('theme-toggle');
        if (btn) {
          btn.textContent = isDark ? '☀️' : '🌙';
          btn.setAttribute('aria-pressed', String(isDark));
        }
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handler);
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateThemeColor(next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* ignore */
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(next === 'dark'));
  }
}

function restoreTheme() {
  let theme = null;
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
  } catch {
    /* localStorage unavailable (private mode etc.) — preserve current in-memory theme */
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') theme = current;
  }
  if (!theme) {
    if (typeof window.matchMedia === 'function') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      theme = 'light';
    }
  }
  if (document.documentElement.getAttribute('data-theme') !== theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeColor(theme);
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}

initTheme();

// ===== PWA INSTALL PROMPT =====
var deferredInstallPrompt = deferredInstallPrompt || null;

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS Safari in "Request Desktop Website" mode uses a macOS-like UA
  // but still has touch support — check maxTouchPoints to catch it
  return (
    (/iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 0 && /Mac/.test(ua))) &&
    !window.MSStream
  );
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (typeof window.navigator.standalone !== 'undefined' && window.navigator.standalone)
    return true;
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(display-mode: standalone)');
    return mq && mq.matches;
  }
  return false;
}

function initPWA() {
  // Already running as a PWA — hide all prompts
  if (typeof document === 'undefined') return;
  if (isStandalone()) return;

  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  // iOS Safari: show Add to Home Screen guide
  if (isIOS()) {
    try {
      if (localStorage.getItem('pwa-ios-dismissed')) return;
    } catch {
      /* ignore */
    }
    banner.innerHTML =
      '<div class="pwa-ios-banner" id="pwa-ios-banner">' +
      '<div class="pwa-banner-content">' +
      '<div class="pwa-banner-icon">📲</div>' +
      '<div class="pwa-banner-text">' +
      '<strong>Install this app</strong>' +
      '<span>Tap <strong>Share</strong> <span class="pwa-share-icon">⎙</span> then <strong>Add to Home Screen</strong>.</span>' +
      '</div>' +
      '<button class="pwa-banner-close" id="pwa-dismiss-ios" aria-label="Dismiss">✕</button>' +
      '</div>' +
      '</div>';
    const dismissBtn = document.getElementById('pwa-dismiss-ios');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        banner.innerHTML = '';
        try {
          localStorage.setItem('pwa-ios-dismissed', '1');
        } catch {
          /* ignore */
        }
      });
    }
    return;
  }

  // Android / Chrome: listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', function (e) {
    // Only prevent default when the user hasn't dismissed our banner
    // Otherwise let Chrome's native prompt handle it
    try {
      if (localStorage.getItem('pwa-android-dismissed')) return;
    } catch {
      /* ignore */
    }
    e.preventDefault();
    deferredInstallPrompt = e;
    showAndroidInstallButton(banner);
  });
}

function showAndroidInstallButton(banner) {
  banner.innerHTML =
    '<div class="pwa-android-banner" id="pwa-android-banner">' +
    '<div class="pwa-banner-content">' +
    '<div class="pwa-banner-icon">📲</div>' +
    '<div class="pwa-banner-text">' +
    '<strong>Install IT Operations KB</strong>' +
    '<span>Add to your home screen for quick access.</span>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" id="pwa-install-btn">Install</button>' +
    '<button class="pwa-banner-close" id="pwa-dismiss-android" aria-label="Dismiss">✕</button>' +
    '</div>' +
    '</div>';

  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      promptEvent.prompt();
      // Hide banner after prompt is shown, regardless of outcome
      // The prompt event can only be used once
      banner.innerHTML = '';
    });
  }

  const dismissBtn = document.getElementById('pwa-dismiss-android');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      banner.innerHTML = '';
      try {
        localStorage.setItem('pwa-android-dismissed', '1');
      } catch {
        /* ignore */
      }
    });
  }
}

window.addEventListener('appinstalled', function () {
  deferredInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.innerHTML = '';
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}

// Centralized click delegation — replaces all inline onclick handlers
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (btn.hasAttribute('data-allow-nav')) {
    // For links (<a>): only intercept without Ctrl/Cmd/Shift
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  }
  e.preventDefault();
  const id = btn.dataset.id ? Number(btn.dataset.id) : null;
  const page = btn.dataset.page;
  const modal = btn.dataset.modal;
  switch (action) {
    case 'navigate':
      navigate(page || id);
      break;
    case 'sidebar-toggle':
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('open');
      break;
    case 'close-sidebar':
      closeSidebar();
      break;
    case 'theme-toggle':
      toggleTheme();
      break;
    case 'logout':
      logout();
      break;
    case 'close-modal':
      closeModal(modal);
      // If closing form-modal while editing a QA entry, reopen detail
      if (modal === 'form-modal') {
        const fm = document.getElementById('form-modal');
        const editId = fm.dataset.editQaId;
        if (editId) {
          delete fm.dataset.editQaId;
          showQADetail(Number(editId));
        }
      }
      break;
    case 'close-confirm':
      closeConfirm();
      break;
    case 'stay-logged-in':
      stayLoggedIn();
      break;
    case 'login-link':
      renderLogin(page || undefined);
      break;
    case 'export-csv':
      exportCSV();
      break;
    case 'create-qa':
      showCreateQA();
      break;
    case 'edit-qa':
      editQA(id);
      break;
    case 'archive-qa':
      archiveQA(id);
      break;
    case 'unarchive-qa':
      unarchiveQA(id);
      break;
    case 'publish-qa':
      publishQA(id);
      break;
    case 'delete-qa':
      deleteQA(id);
      break;
    case 'create-category':
      showCreateCategory();
      break;
    case 'delete-cat':
      deleteCat(id);
      break;
    case 'change-password':
      showChangePassword();
      break;
    case 'create-user':
      showCreateUser();
      break;
    case 'approve-user':
      approveUser(id);
      break;
    case 'reject-user':
      rejectUser(id);
      break;
    case 'toggle-user':
      toggleUser(id);
      break;
    case 'reset-user-password':
      showResetUserPassword(id);
      break;
    case 'qa-card': {
      history.pushState(null, '', '/qa/' + id);
      showQADetail(id);
      break;
    }
    case 'close-detail': {
      closeModal('detail-modal');
      history.replaceState(null, '', '/qa');
      navigate('qa');
      break;
    }
    case 'users-prev':
      if (state.usersPage > 1) {
        state.usersPage--;
        renderUsers(document.getElementById('page-content'));
      }
      break;
    case 'users-next':
      if (state.usersPage < Math.ceil((state.users || []).length / (state.usersPerPage || 1))) {
        state.usersPage++;
        renderUsers(document.getElementById('page-content'));
      }
      break;
  }
});

window.addEventListener('popstate', () => {
  if (state.user) return;
  const path = window.location.pathname;
  if (path === '/register' || path === '/register/') renderLogin('register');
  else if (path === '/' || path === '') renderLogin();
});

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof window === 'undefined') return;
  const initPath = window.location.pathname;
  if (initPath === '/register' || initPath === '/register/') {
    try {
      const u = await api('/api/auth/me');
      if (u && u.id) {
        history.replaceState(null, '', '/qa');
        window.location.reload();
        return;
      }
    } catch {
      /* not authenticated, continue to register */
    }
    renderLogin('register');
    return;
  }
  try {
    const u = await api('/api/auth/me');
    state.user = u;
    await Promise.all([loadCategories(), loadQATotalCount(), loadQAStatuses()]);
    startActivityTracking();
    renderShell();
    const path = window.location.pathname;
    if (path === '/' || path === '') navigate('qa');
    else if (path === '/qa') navigate('qa');
    else if (path === '/categories') navigate('categories');
    else if (path === '/users') navigate('users');
    else if (path === '/dashboard') navigate('dashboard');
    else if (path.startsWith('/qa/')) {
      const parts = path.split('/').filter(Boolean);
      const id = parts.length === 2 && /^\d+$/.test(parts[1]) ? parseInt(parts[1]) : 0;
      if (id > 0) {
        state.page = 'qa';
        showQADetail(id);
      } else navigate('404');
    } else navigate('404');
  } catch {
    renderLogin();
  }
});

// ===== HELPERS =====
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 401 && state.user) {
    logout();
    return Promise.reject(new Error('Session expired'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Track explicit modal close to prevent stale showQADetail from re-opening after navigate
  if (id === 'detail-modal') closeDetailBtn = performance.now();
  // Clear tag chip state on form-modal close (Issue #111)
  if (id === 'form-modal') resetTags();
}
function resetTags() {
  var cc = document.getElementById('tags-chips');
  if (cc) cc.innerHTML = '';
  var ss = document.getElementById('tags-suggestions');
  if (ss) ss.innerHTML = '';
}
// ===== PASSWORD VALIDATION =====
// Mirrors server lib/password.js validatePassword — must stay in sync
var PASSWORD_SPECIAL = PASSWORD_SPECIAL || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
function validatePw(p) {
  if (typeof p !== 'string') return PASSWORD_MSG;
  if (p.length < 8) return PASSWORD_MSG;
  if (!/[A-Z]/.test(p)) return PASSWORD_MSG;
  if (!/[a-z]/.test(p)) return PASSWORD_MSG;
  if (!/[0-9]/.test(p)) return PASSWORD_MSG;
  if (!PASSWORD_SPECIAL.test(p)) return PASSWORD_MSG;
  return null;
}

var PASSWORD_MSG =
  PASSWORD_MSG ||
  'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character';

var PASSWORD_RULES = PASSWORD_RULES || [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One digit' },
  { test: (p) => PASSWORD_SPECIAL.test(p), label: 'One special character' },
];

function renderPasswordHints(password, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = PASSWORD_RULES.map(
    (r) =>
      `<div class="pw-hint ${r.test(password) ? 'pw-hint-ok' : ''}">${
        r.test(password) ? '\u2713' : '\u25CB'
      } ${r.label}</div>`,
  ).join('');
}

function initPasswordHints(inputId, containerId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    renderPasswordHints(input.value, containerId);
  });
  renderPasswordHints(input.value, containerId);
}

function esc(s) {
  return s
    ? String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : '';
}
function safeColor(c) {
  return /^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : '#6366f1';
}

function statusClass(s) {
  return (
    {
      Open: 'status-open',
      'In Progress': 'status-in-progress',
      Resolved: 'status-resolved',
      Closed: 'status-closed',
      Published: 'status-resolved',
      Draft: 'status-open',
      Archived: 'status-closed',
    }[s] || 'status-closed'
  );
}
function fmtDate(d) {
  if (!d) return '';
  return d.slice(0, 10);
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
async function loadCategories() {
  try {
    state.categories = await api('/api/categories');
  } catch {
    /* ignore */
  }
}
async function loadQATotalCount() {
  try {
    const s = await api('/api/stats');
    state.qaTotalCount = s && s.qa && typeof s.qa.total === 'number' ? s.qa.total : 0;
  } catch {
    state.qaTotalCount = 0;
  }
}
async function loadQAStatuses() {
  try {
    const data = await api('/api/qa/statuses');
    state.qaStatuses = data.statuses;
  } catch {
    state.qaStatuses = ['Draft', 'Published', 'Archived'];
  }
}
async function loadUsers() {
  try {
    const data = await api('/api/users');
    state.users = data;
    state.usersPage = 1;
  } catch {
    state.users = [];
    toast('Failed to load users');
  }
}

// Session idle tracking
var SESSION_MAX_AGE = SESSION_MAX_AGE || 16 * 60 * 60 * 1000; // 16h
var WARNING_BEFORE = WARNING_BEFORE || 30 * 60 * 1000; // 30 min before
var lastActivity = lastActivity || Date.now();
var sessionMonitorId = sessionMonitorId || null;
var sessionWarned = sessionWarned || false;

var activityEvents = activityEvents || ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
var activityHandler = activityHandler || null;

function startActivityTracking() {
  lastActivity = Date.now();
  sessionWarned = false;
  const handler = () => {
    lastActivity = Date.now();
  };
  if (activityHandler) {
    activityEvents.forEach((e) => document.removeEventListener(e, activityHandler));
  }
  activityEvents.forEach((e) => document.addEventListener(e, handler, { passive: true }));
  activityHandler = handler;
  clearInterval(sessionMonitorId);
  sessionMonitorId = setInterval(checkSessionIdle, 30000);
}

function stopActivityTracking() {
  if (activityHandler) {
    activityEvents.forEach((e) => document.removeEventListener(e, activityHandler));
    activityHandler = null;
  }
  clearInterval(sessionMonitorId);
  sessionMonitorId = null;
  sessionWarned = false;
}

function checkSessionIdle() {
  if (!state.user) return;
  const idle = Date.now() - lastActivity;
  if (idle >= SESSION_MAX_AGE - WARNING_BEFORE && !sessionWarned) {
    sessionWarned = true;
    openModal('session-warning-modal');
    toast('Your session is about to expire due to inactivity');
  }
  if (idle >= SESSION_MAX_AGE) {
    stopActivityTracking();
    state.sessionExpired = true;
    logout();
  }
}

async function stayLoggedIn() {
  try {
    await api('/api/auth/me');
    lastActivity = Date.now();
    sessionWarned = false;
    closeModal('session-warning-modal');
    toast('Session refreshed');
  } catch {
    state.sessionExpired = true;
    closeModal('session-warning-modal');
    logout();
  }
}

// ===== CONFIRM MODAL =====
var confirmCallback = confirmCallback || null;
function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  document.getElementById('confirm-ok').onclick = () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  };
  openModal('confirm-modal');
}
function closeConfirm() {
  confirmCallback = null;
  closeModal('confirm-modal');
}

// ===== AUTH =====
function renderLogin(mode) {
  const isRegister = mode === 'register';
  const targetPath = isRegister ? '/register' : '/';
  if (window.location.pathname !== targetPath) {
    history.pushState(null, '', targetPath);
  }
  const params = new URLSearchParams(window.location.search);
  const errMap = {
    invalid: 'Invalid username or password',
    pending: 'Account pending approval',
    disabled: 'Account disabled',
    missing: 'Fill in all fields',
  };
  const urlErr = params.get('error');
  const fallbackError =
    urlErr && errMap[urlErr] ? `<div class="login-error show">${errMap[urlErr]}</div>` : '';
  if (urlErr) history.replaceState(null, '', targetPath);
  const expiredMsg = state.sessionExpired
    ? '<div class="login-session-expired"><span class="sess-icon">⏰</span> Your session has expired. Please sign in again.</div>'
    : '';
  state.sessionExpired = false;
  document.getElementById('app').innerHTML = `
    <a href="#main-content" class="skip-link">Skip to content</a>
    <main id="main-content" class="main" tabindex="-1">
    <form class="login-page${isRegister ? ' register-mode' : ''}" id="login-form">
      <div class="login-card">
        <h1>${isRegister ? 'Create Account' : 'IT Operations'}</h1>
        <div class="login-sub">${isRegister ? 'Register for access' : 'Knowledge Base'}</div>
        ${fallbackError}${expiredMsg}
        <div class="login-error" id="login-error"></div>
        <div class="login-success" id="login-success"></div>
        <div class="form-group"><label for="auth-user" class="sr-only">Username</label><input class="form-input" id="auth-user" placeholder="Username" autocomplete="username"></div>
        <div class="form-group"><label for="auth-pass" class="sr-only">Password</label><input class="form-input" type="password" id="auth-pass" placeholder="Password" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></div>
        ${isRegister ? '<div class="pw-hints" id="auth-pass-hints"></div>' : ''}
        ${isRegister ? '<div class="form-group"><label for="auth-pass-confirm" class="sr-only">Confirm Password</label><input class="form-input" type="password" id="auth-pass-confirm" placeholder="Confirm Password" autocomplete="new-password"><div class="form-error" id="auth-pass-confirm-error"></div></div>' : ''}
        ${isRegister ? `<div class="form-group"><label for="auth-role" class="sr-only">Role</label><select class="form-select" id="auth-role"><option value="Viewer">Viewer</option><option value="Editor">Editor</option></select></div>` : `<div style="margin-bottom:14px"><label for="auth-remember" style="font-size:12px;color:#888;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="auth-remember"> Remember me</label></div>`}
        <button class="btn btn-primary" id="auth-submit">${isRegister ? 'Register' : 'Sign In'}</button>
        <div class="login-link">${isRegister ? '<a href="/" data-action="login-link" data-allow-nav>← Back to sign in</a>' : '<a href="/register" data-action="login-link" data-page="register" data-allow-nav>Create account</a>'}</div>
      </div>
    </form>
    </main>`;
  const err = document.getElementById('login-error');
  const suc = document.getElementById('login-success');
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-user').value.trim();
    const password = document.getElementById('auth-pass').value;
    err.classList.remove('show');
    suc.classList.remove('show');
    if (!username || !password) {
      err.textContent = 'Fill in all fields';
      err.classList.add('show');
      return;
    }
    try {
      if (isRegister) {
        const confirmPass = document.getElementById('auth-pass-confirm').value;
        const confirmErr = document.getElementById('auth-pass-confirm-error');
        confirmErr.textContent = '';
        if (password !== confirmPass) {
          confirmErr.textContent = 'Passwords do not match';
          return;
        }
        const role = document.getElementById('auth-role').value;
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, password, role }),
        });
        suc.textContent = 'Registration submitted. An admin will approve your account.';
        suc.classList.add('show');
      } else {
        const remember = document.getElementById('auth-remember')?.checked || false;
        const u = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password, remember }),
        });
        state.user = u;
        if (u.must_change_password) {
          renderShell();
          startActivityTracking();
          showChangePassword(true);
          return;
        }
        await loadCategories();
        await loadQATotalCount();
        renderShell();
        startActivityTracking();
        navigate('qa');
      }
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('show');
    }
  });
  if (isRegister) initPasswordHints('auth-pass', 'auth-pass-hints');
  document.getElementById('auth-user').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('auth-pass').focus();
    }
  });
  // Password Enter submits natively via <form> — no manual handler needed
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  state.user = null;
  state.qaEntries = [];
  state.categories = [];
  stopActivityTracking();
  renderLogin();
}

// ===== SHELL =====
function renderShell() {
  const u = state.user;
  const isAdmin = u.role === 'Admin';
  const userName = u.username;
  const appVersion = '1.1.0';
  document.getElementById('app').innerHTML = `
    <div class="app-body">
      <nav class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="sidebar-header">
          <div class="sidebar-logo">IT Operations</div>
          <div class="sidebar-title">Knowledge Base</div>
        </div>
        <div class="sidebar-nav">
          <div class="nav-section">Main</div>
          <button class="nav-item active" data-nav="qa" data-action="navigate" data-page="qa"><span class="nav-icon">❓</span> QA Library <span class="nav-badge" id="qa-count">${esc(String(state.qaTotalCount ?? '…'))}</span></button>
          ${isAdmin ? `<button class="nav-item" data-nav="categories" data-action="navigate" data-page="categories"><span class="nav-icon">📋</span> Sub-Systems</button><button class="nav-item" data-nav="users" data-action="navigate" data-page="users"><span class="nav-icon">👥</span> Users</button>` : ''}
          <div class="nav-section">Workspace</div>
          <button class="nav-item" data-nav="dashboard" data-action="navigate" data-page="dashboard"><span class="nav-icon">📊</span> Dashboard</button>
        </div>
        <div class="sidebar-footer">
          <div class="sidebar-footer-user">${esc(userName)} (${esc(u.role)}) &#x2022; IT Operations KB v${appVersion}</div>
          <button class="nav-item" data-action="change-password" style="color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer"><span class="nav-icon" style="font-size:12px">🔑</span> Change Password</button>
          <button class="nav-item" data-action="logout" style="color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer"><span class="nav-icon" style="font-size:12px">🚪</span> Sign Out</button>
        </div>
      </nav>
      <div class="sidebar-overlay" id="sidebar-overlay" data-action="close-sidebar"></div>
      <a href="#main-content" class="skip-link">Skip to content</a>
      <main id="main-content" class="main" tabindex="-1">
      <header class="topbar">
        <div class="topbar-left">
          <button class="sidebar-toggle" data-action="sidebar-toggle" aria-label="Toggle sidebar">☰</button>
          <div><h1 class="topbar-title" id="page-title">QA Library</h1><div class="topbar-breadcrumb">IT Operations / <span>Knowledge Base</span></div></div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-ghost" id="theme-toggle" data-action="theme-toggle" aria-label="Toggle theme" aria-pressed="${document.documentElement.getAttribute('data-theme') === 'dark'}">${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'}</button>

        </div>
      </header>
      <div class="content" id="page-content"><div class="loading">Loading...</div></div>
    </main>
    </div>
    <footer role="contentinfo" class="page-footer"><span class="footer-version">IT Operations KB v${appVersion}</span></footer>`;
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function navigate(page) {
  restoreTheme();
  closeModal('detail-modal');
  closeSidebar();
  state.page = page;
  document.querySelectorAll('.nav-item').forEach((e) => e.classList.remove('active'));
  const n = document.querySelector(`[data-nav="${page}"]`);
  if (n) n.classList.add('active');
  const titles = {
    qa: 'QA Library',
    categories: 'Categories',
    users: 'Users',
    dashboard: 'Dashboard',
    404: 'Page Not Found',
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
  const el = document.getElementById('page-content');
  if (page === 'qa') {
    loadQATotalCount().then(() => {
      const badge = document.getElementById('qa-count');
      if (badge) badge.textContent = state.qaTotalCount;
    });
    renderQA(el);
  } else if (page === 'categories') renderCategories(el);
  else if (page === 'users') {
    state.users = [];
    renderUsers(el);
  } else if (page === 'dashboard') renderDashboard(el);
  else if (page === '404') render404(el);
  else render404(el);
}

function render404(el) {
  document.getElementById('page-title').textContent = 'Page Not Found';
  el.innerHTML =
    '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Page not found</div><button class="btn btn-primary" data-action="navigate" data-page="qa">Go to QA Library</button></div>';
}

// ===== QA =====
var qaAbortController = qaAbortController || null;
var qaDetailFetchSeq = qaDetailFetchSeq || 0; // increments on each showQADetail call to detect stale fetches
var closeDetailBtn = 0; // timestamp of most recent closeModal('detail-modal')

async function renderQA(el) {
  // Cancel stale in-flight fetch before starting a new one
  if (qaAbortController) qaAbortController.abort();
  qaAbortController = new AbortController();
  const signal = qaAbortController.signal;
  const main = el.parentNode;

  const isFirstRender = !el.querySelector('#qa-list');

  if (isFirstRender) {
    el.innerHTML = '<div class="loading">Loading...</div>';
  } else {
    // Subsequent render: show loading state in results list (preserves toolbar DOM)
    const list = document.getElementById('qa-list');
    if (list) list.innerHTML = '<div class="loading">Loading...</div>';
  }
  try {
    const res = await loadQA(signal);
    // Guard against stale fetch: abort or page changed while waiting
    if (signal.aborted || state.page !== 'qa') return;
    state.qaEntries = res.data;
    state.qaTotal = res.total;
    state.qaPage = res.page;
  } catch (e) {
    if (e.name === 'AbortError' || state.page !== 'qa') return;
    if (isFirstRender) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Error loading entries</div></div>`;
    } else {
      const list = document.getElementById('qa-list');
      if (list)
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Error loading entries</div></div>`;
    }
    return;
  }
  const canEdit = ['Admin', 'Editor'].includes(state.user.role);
  const statuses = [null, ...state.qaStatuses];

  if (isFirstRender) {
    // First render: build the full toolbar + empty list container once
    // Remove any existing table-toolbar (from previous page) before inserting new one
    const oldToolbar = main.querySelector('.table-toolbar');
    if (oldToolbar) oldToolbar.remove();

    // Insert toolbar as sibling BEFORE .content
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    toolbar.innerHTML = `<h2 class="sr-only">Filters</h2><div class="filter-group">${statuses.map((s) => `<button class="filter-tab ${state.qaFilters.status === s ? 'active' : ''}" data-qf="${s || ''}">${s || 'All'}</button>`).join('')}</div><div class="filter-group"><div class="search-box"><span class="search-icon">🔍</span><label for="global-search" class="sr-only">Search QA entries</label><input type="search" placeholder="Search..." id="global-search" inputmode="search"><button class="search-clear" id="search-clear" style="display:none" aria-label="Clear search">×</button></div><select id="qa-sort" class="sort-select" aria-label="Sort order"><option value="popular"${state.qaSort === 'popular' ? ' selected' : ''}>By Popularity</option><option value="newest"${state.qaSort === 'newest' ? ' selected' : ''}>By Newest</option></select></div><div class="filter-group">${canEdit ? '<button class="btn btn-ghost btn-sm" data-action="export-csv">📥 Export</button>' : ''}${canEdit ? `<button class="btn btn-primary btn-sm" data-action="create-qa">＋ New Entry</button>` : ''}</div>`;
    main.insertBefore(toolbar, el);

    // Only list content inside .content
    el.innerHTML = `<h2 class="sr-only">QA Entries</h2><div class="qa-list" id="qa-list"></div>`;

    // Restore search input value after first render
    const s = document.getElementById('global-search');
    if (s && state.qaFilters.search) s.value = state.qaFilters.search;

    // Bind filter tabs (once)
    main.querySelectorAll('[data-qf]').forEach((b) => {
      b.onclick = () => {
        state.qaFilters.status = b.dataset.qf || null;
        state.qaPage = 1;
        renderQA(el);
      };
    });

    // Bind search and clear button (once)
    const search = document.getElementById('global-search');
    const clearBtn = document.getElementById('search-clear');
    if (search) {
      const toggleClear = () => {
        if (clearBtn) clearBtn.style.display = search.value ? '' : 'none';
      };
      toggleClear();
      search.addEventListener(
        'input',
        debounce(() => {
          if (state.page !== 'qa') return;
          state.qaFilters.search = search.value;
          state.qaPage = 1;
          if (clearBtn) clearBtn.style.display = search.value ? '' : 'none';
          renderQA(el);
        }, 300),
      );
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          search.value = '';
          state.qaFilters.search = '';
          state.qaPage = 1;
          if (clearBtn) clearBtn.style.display = 'none';
          renderQA(el);
        });
      }
    }

    // Bind sort selector (once)
    const sortSelect = document.getElementById('qa-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.qaSort = sortSelect.value;
        state.qaPage = 1;
        try {
          localStorage.setItem('qaSort', state.qaSort);
        } catch {
          /* ignore */
        }
        renderQA(el);
      });
    }
  } else {
    // Subsequent render: update filter tab active state without destroying the input
    main.querySelectorAll('[data-qf]').forEach((b) => {
      b.classList.toggle('active', (b.dataset.qf || null) === state.qaFilters.status);
    });
    const search = document.getElementById('global-search');
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.style.display = search && search.value ? '' : 'none';
  }

  const list = document.getElementById('qa-list');
  if (!state.qaEntries.length) {
    const emptyText = state.qaFilters.search ? 'No results found' : 'No QA entries';
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">${emptyText}</div></div>`;
    return;
  }
  list.innerHTML = state.qaEntries
    .map(
      (q) =>
        `<a href="/qa/${q.id}" class="qa-card" data-action="qa-card" data-id="${q.id}" data-allow-nav><div class="qa-card-title"><span class="issue-id">${esc(q.qa_number)}</span> ${esc(q.title)}</div><div class="qa-card-question">${esc(q.question)}</div><div class="qa-card-meta">${q.category_name ? `<span class="tag" style="background:${safeColor(q.category_color)}15;color:${safeColor(q.category_color)}">${esc(q.category_icon)} ${esc(q.category_name)}</span>` : ''}<span class="badge ${statusClass(q.status)}">● ${q.status}</span>${
          q.tags && q.tags.length
            ? q.tags.map((t) => `<span class="tag">#${esc(t.trim())}</span>`).join('')
            : ''
        }</div></a>`,
    )
    .join('');
  const totalPages = Math.ceil(state.qaTotal / 20);
  list.innerHTML += `<div class="pagination"><div class="pagination-info">Showing ${(state.qaPage - 1) * 20 + 1}–${Math.min(state.qaPage * 20, state.qaTotal)} of ${state.qaTotal}</div><div class="filter-group"><button class="pagination-btn" id="qa-prev" ${state.qaPage <= 1 ? 'disabled' : ''}>‹ Prev</button><span style="font-size:12px;color:#888;padding:0 8px">${state.qaPage} / ${totalPages}</span><button class="pagination-btn" id="qa-next" ${state.qaPage >= totalPages ? 'disabled' : ''}>Next ›</button></div></div>`;

  const prev = document.getElementById('qa-prev');
  if (prev && !prev.disabled)
    prev.onclick = () => {
      state.qaPage--;
      renderQA(el);
    };
  const next = document.getElementById('qa-next');
  if (next && !next.disabled)
    next.onclick = () => {
      state.qaPage++;
      renderQA(el);
    };
}
async function loadQA(signal) {
  const p = new URLSearchParams();
  if (state.qaFilters.status) p.set('status', state.qaFilters.status);
  if (state.qaFilters.search) p.set('search', state.qaFilters.search);
  if (state.qaSort) p.set('sort', state.qaSort);
  p.set('_page', state.qaPage);
  p.set('_per_page', '20');
  return api(`/api/qa?${p}`, { signal });
}

async function showQADetail(id) {
  document.getElementById('page-content').innerHTML = '';
  // Populate modal content BEFORE opening (prevents flash)
  document.getElementById('detail-modal').innerHTML =
    '<div class="modal"><div class="modal-header"><div class="detail-banner"><div class="modal-title">Loading…</div></div><button class="modal-close" data-action="close-detail" aria-label="Close">✕</button></div><div class="modal-body"><div class="loading">Loading...</div></div></div>';
  const fetchSeq = ++qaDetailFetchSeq;
  const beforeFetch = closeDetailBtn;
  let q;
  try {
    q = await api(`/api/qa/${id}`);
  } catch {
    if (!state.user) {
      closeModal('detail-modal');
    } else {
      document.getElementById('detail-modal').querySelector('.modal-body').innerHTML =
        '<p class="text-danger">Failed to load QA entry.</p>';
      openModal('detail-modal');
    }
    return;
  }
  // Guard 1: if another showQADetail call happened during fetch, skip update
  if (fetchSeq !== qaDetailFetchSeq) return;
  // Guard 2: if closeModal('detail-modal') was called during fetch, skip update
  if (closeDetailBtn > beforeFetch) return;
  // Ensure entry is in qaEntries so editQA works for deep links
  if (!state.qaEntries.find((e) => e.id === q.id)) {
    state.qaEntries.push(q);
  }
  const canEdit = ['Admin', 'Editor'].includes(state.user.role);
  const canDelete = state.user.role === 'Admin';
  document.getElementById('page-title').textContent = q.question;
  document.getElementById('detail-modal').innerHTML = `<div class="modal">
    <div class="modal-header"><div class="detail-banner"><div class="modal-title">${esc(q.title)}</div><div class="detail-id">${q.qa_number}</div></div><button class="modal-close" data-action="close-detail" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="detail-section"><div class="detail-section-title">Question</div><div class="detail-section-content">${esc(q.question)}</div></div>
      ${q.answer ? `<div class="detail-section"><div class="detail-section-title">Answer</div><div class="detail-section-content">${esc(q.answer)}</div></div>` : ''}
      <div class="detail-meta"><div><div class="detail-meta-label">Status</div><span class="badge ${statusClass(q.status)}">● ${q.status}</span></div><div><div class="detail-meta-label">Sub-System</div>${q.category_name ? `<span class="tag" style="background:${safeColor(q.category_color)}15;color:${safeColor(q.category_color)}">${esc(q.category_icon)} ${esc(q.category_name)}</span>` : '-'}</div><div><div class="detail-meta-label">Tags</div>${
        q.tags && q.tags.length
          ? q.tags.map((t) => `<span class="tag">#${esc(t.trim())}</span>`).join(' ')
          : '-'
      }</div><div><div class="detail-meta-label">Created</div>${fmtDate(q.created_at)}</div><div><div class="detail-meta-label">Modified</div>${fmtDate(q.updated_at)}</div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost btn-sm" data-action="close-detail">Close</button>${state.user.role === 'Admin' && q.status === 'Draft' ? `<button class="btn btn-sm btn-primary" data-action="publish-qa" data-id="${q.id}">Publish</button>` : ''}${canEdit ? `<button class="btn btn-sm btn-edit" data-action="edit-qa" data-id="${q.id}">Edit</button>` : ''}${state.user.role === 'Admin' && q.status === 'Archived' ? `<button class="btn btn-sm btn-unarchive" data-action="unarchive-qa" data-id="${q.id}">Unarchive</button>` : ''}${canEdit && q.status !== 'Archived' ? `<button class="btn btn-sm btn-archive" data-action="archive-qa" data-id="${q.id}">Archive</button>` : ''}${canDelete ? `<button class="btn btn-sm btn-danger" data-action="delete-qa" data-id="${q.id}">Delete</button>` : ''}</div>
  </div>`;
  openModal('detail-modal');
}

async function showCreateQA(data) {
  const isEdit = !!data;
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit QA Entry' : 'New QA Entry';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="f-q-title" value="${isEdit ? esc(data.title) : ''}"><div class="form-error" id="f-q-title-error"></div></div>
    <div class="form-group"><label class="form-label">Question *</label><textarea class="form-textarea" id="f-question">${isEdit ? esc(data.question) : ''}</textarea><div class="form-error" id="f-q-question-error"></div></div>
    <div class="form-group"><label class="form-label">Answer</label><textarea class="form-textarea" id="f-answer" rows="5">${isEdit ? esc(data.answer || '') : ''}</textarea></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Sub-System</label><select class="form-select" id="f-q-cat"><option value="">None</option>${state.categories.map((c) => `<option value="${c.id}" ${isEdit && data.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label" for="f-tags-input">Tags</label><div class="chip-input-wrapper" id="tags-chip-wrapper"><div class="chip-container" id="tags-chips"></div><input type="text" class="chip-input" id="f-tags-input" aria-label="Add tags" placeholder="Type tag and press Enter or comma..." autocomplete="off"><div class="suggestions-area" id="tags-suggestions"></div></div></div>`;
  // Track edit ID on modal so the global close-modal handler can
  // reopen detail when the X button (which goes through delegation) is clicked
  modal.dataset.editQaId = isEdit ? String(data.id) : '';
  modal.querySelector('.modal-footer').innerHTML =
    `<button class="btn btn-ghost btn-sm" id="f-q-cancel">Cancel</button><button class="btn btn-primary btn-sm" id="f-q-submit">${isEdit ? 'Update' : 'Create'}</button>`;
  document.getElementById('f-q-cancel').onclick = () => {
    delete modal.dataset.editQaId;
    closeModal('form-modal');
    if (isEdit) showQADetail(data.id);
  };
  document.getElementById('f-q-submit').onclick = async () => {
    const body = {
      title: document.getElementById('f-q-title').value,
      question: document.getElementById('f-question').value,
      answer: document.getElementById('f-answer').value,
      category_id: document.getElementById('f-q-cat').value || null,
      tags: getChipValues('tags-chips'),
    };
    // Status is preserved during edit; only Publish/Archive/Unarchive actions change status
    const titleErr = document.getElementById('f-q-title-error');
    const questionErr = document.getElementById('f-q-question-error');
    titleErr.textContent = '';
    questionErr.textContent = '';
    body.title = body.title.trim();
    body.question = body.question.trim();
    if (!body.title) titleErr.textContent = 'Title is required';
    if (!body.question) questionErr.textContent = 'Question is required';
    if (!body.title || !body.question) return;
    try {
      if (isEdit) {
        await api(`/api/qa/${data.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast('Updated');
      } else {
        await api('/api/qa', { method: 'POST', body: JSON.stringify(body) });
        toast('Created');
      }
      delete modal.dataset.editQaId;
      closeModal('form-modal');
      navigate('qa');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };
  openModal('form-modal');
  // Pre-populate chips on edit
  const existingTags = isEdit && data.tags ? (Array.isArray(data.tags) ? data.tags : []) : [];
  initChips('tags-chips', 'f-tags-input', 'tags-suggestions', existingTags);
}

// ===== CHIP INPUT HELPERS =====
function getChipValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.chip')).map(function (c) {
    return c.dataset.tag;
  });
}

function initChips(containerId, inputId, suggestionsId, existingTags) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  if (!container || !input || !suggestions) return;

  // Clear existing chips
  container.innerHTML = '';

  // Pre-populate
  if (existingTags && existingTags.length) {
    existingTags.forEach(function (t) {
      addChip(t.trim());
    });
  }

  function addChip(tag) {
    tag = tag.trim();
    if (!tag) return;
    // Dedup
    var existing = container.querySelectorAll('.chip');
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].dataset.tag === tag) return;
    }
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.tag = tag;
    chip.innerHTML =
      esc(tag) +
      '<button class="chip-remove" type="button" aria-label="Remove ' +
      esc(tag) +
      '">\u2715</button>';
    chip.querySelector('.chip-remove').onclick = function (e) {
      e.stopPropagation();
      chip.remove();
    };
    container.appendChild(chip);
  }

  // On mobile (coarse pointer), ensure the tag input and suggestions are scrolled into view (Issue #111)
  if (
    typeof input.scrollIntoView === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  ) {
    input.onfocus = function () {
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        var el = suggestions.querySelector('.suggestion-chip') ? suggestions : input;
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
      }, 300);
    };
  }

  function getSelectedTags() {
    return Array.from(container.querySelectorAll('.chip')).map(function (c) {
      return c.dataset.tag;
    });
  }

  // Cache tags with 60s TTL to reduce network calls
  var tagsCache = { data: null, ts: 0 };
  var TAGS_CACHE_TTL = 60000;

  async function fetchTags() {
    var now = Date.now();
    if (tagsCache.data && now - tagsCache.ts < TAGS_CACHE_TTL) {
      return tagsCache.data;
    }
    tagsCache.data = await api('/api/tags');
    tagsCache.ts = now;
    return tagsCache.data;
  }

  function renderSuggestions(tags) {
    var selected = getSelectedTags();
    // Exclude already-selected tags
    var filtered = tags.filter(function (t) {
      return !selected.some(function (s) {
        return s.toLowerCase() === t.name.toLowerCase();
      });
    });
    if (!filtered.length) {
      suggestions.innerHTML = '';
      return;
    }
    suggestions.innerHTML = filtered
      .map(function (t) {
        return (
          '<button type="button" class="suggestion-chip" data-tag="' +
          esc(t.name) +
          '" aria-label="Add tag: ' +
          esc(t.name) +
          '">#' +
          esc(t.name) +
          ' <span class="suggestion-count" aria-hidden="true">(' +
          t.count +
          ')</span></button>'
        );
      })
      .join('');
  }

  // Input handler: fetch and render inline suggestion chips
  input.oninput = debounce(async function () {
    var val = input.value.trim();
    try {
      var tags = await fetchTags();
      if (!val) {
        suggestions.innerHTML = '';
        return;
      }
      // Filter by substring (case-insensitive)
      var matched = tags.filter(function (t) {
        return t.name.toLowerCase().includes(val.toLowerCase());
      });
      renderSuggestions(matched);
    } catch {
      suggestions.innerHTML = '';
    }
  }, 200);

  // Keyboard handlers
  input.onkeydown = function (e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      var val = this.value.trim().replace(/,/g, '');
      if (val) addChip(val);
      this.value = '';
      suggestions.innerHTML = '';
    }
    if (e.key === 'Escape') {
      suggestions.innerHTML = '';
    }
  };

  // Click suggestion chip
  suggestions.onclick = function (e) {
    var btn = e.target.closest('.suggestion-chip');
    if (btn) {
      var tag = btn.dataset.tag;
      addChip(tag);
      input.value = '';
      input.focus();
      // Re-render suggestions with the just-added tag removed
      var val = input.value.trim();
      fetchTags()
        .then(function (tags) {
          if (!val) {
            suggestions.innerHTML = '';
          } else {
            var matched = tags.filter(function (t) {
              return t.name.toLowerCase().includes(val.toLowerCase());
            });
            renderSuggestions(matched);
          }
        })
        .catch(function () {
          suggestions.innerHTML = '';
        });
    }
  };

  // Focus input when wrapper container is clicked
  var wrapper = container.parentElement;
  if (wrapper) {
    wrapper.addEventListener('click', function (e) {
      if (!e.target.closest('.chip-remove')) {
        input.focus();
      }
    });
  }
}

function editQA(id) {
  closeModal('detail-modal');
  const d = state.qaEntries.find((q) => q.id === id);
  if (d) showCreateQA(d);
}
async function deleteQA(id) {
  showConfirm('Delete', 'Are you sure you want to delete this entry?', async () => {
    await api(`/api/qa/${id}`, { method: 'DELETE' });
    toast('Deleted');
    navigate('qa');
  });
}

async function archiveQA(id) {
  showConfirm('Archive', 'Archive this entry? It will be hidden from default views.', async () => {
    try {
      await api(`/api/qa/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Archived' }) });
      toast('Archived');
      history.replaceState(null, '', '/qa');
      navigate('qa');
    } catch (e) {
      toast('Failed to archive: ' + (e.message || 'Unknown error'));
    }
  });
}

async function unarchiveQA(id) {
  if (!state.user || state.user.role !== 'Admin') return toast('Only Admin can unarchive');
  try {
    await api(`/api/qa/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Draft' }) });
    toast('Unarchived');
    history.replaceState(null, '', '/qa');
    navigate('qa');
  } catch (e) {
    toast('Failed to unarchive: ' + (e.message || 'Unknown error'));
  }
}

async function publishQA(id) {
  if (!state.user || state.user.role !== 'Admin') return toast('Only Admin can publish');
  try {
    await api(`/api/qa/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Published' }) });
    toast('Published');
    // Refresh the detail view (QA list behind modal will re-render on navigation close)
    await showQADetail(id);
  } catch (e) {
    toast('Failed to publish: ' + (e.message || 'Unknown error'));
  }
}

function exportCSV() {
  if (!state.qaEntries.length) return toast('Nothing to export');
  const keys = Object.keys(state.qaEntries[0]);
  const csv = [
    keys.join(','),
    ...state.qaEntries.map((r) =>
      keys.map((k) => `"${(r[k] || '').toString().replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `it-ops-qa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ===== CATEGORIES =====
async function renderCategories(el) {
  await loadCategories();
  const main = el.parentNode;
  const oldToolbar = main.querySelector('.table-toolbar');
  if (oldToolbar) oldToolbar.remove();

  // Insert toolbar as sibling BEFORE .content
  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.innerHTML = `<div style="font-size:13px;color:#888">${state.categories.length} sub-systems</div><button class="btn btn-primary btn-sm" data-action="create-category">＋ Add Sub-System</button>`;
  main.insertBefore(toolbar, el);

  // Only table inside .content
  el.innerHTML = `<h2 class="sr-only">Sub-Systems List</h2><div class="table-container admin-table"><table><thead><tr><th>Icon</th><th>Name</th><th>Color</th><th>QA</th><th></th></tr></thead><tbody>${state.categories.map((c) => `<tr><td data-label="Icon" style="font-size:18px">${esc(c.icon)}</td><td data-label="Name"><strong>${esc(c.name)}</strong></td><td data-label="Color"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${safeColor(c.color)};vertical-align:middle"></span><span class="color-hex-label"> ${esc(c.color)}</span></td><td data-label="QA">${c.qa_count || 0}</td><td data-label=""><button class="btn btn-ghost btn-sm" data-action="delete-cat" data-id="${c.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function showCreateCategory() {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = 'New Sub-System';
  modal.querySelector('.modal-body').innerHTML =
    `<div class="form-group"><label class="form-label">Name *</label><input class="form-input" id="f-cat-name"></div><div class="form-row"><div class="form-group"><label class="form-label">Color</label><input class="form-input" id="f-cat-color" type="color" value="#6366f1"></div><div class="form-group"><label class="form-label">Icon</label><input class="form-input" id="f-cat-icon" value="📋"></div></div>`;
  modal.querySelector('.modal-footer').innerHTML =
    `<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button><button class="btn btn-primary btn-sm" id="f-cat-submit">Create</button>`;
  document.getElementById('f-cat-submit').onclick = async () => {
    const body = {
      name: document.getElementById('f-cat-name').value,
      color: document.getElementById('f-cat-color').value,
      icon: document.getElementById('f-cat-icon').value,
    };
    if (!body.name) return toast('Name required');
    await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    closeModal('form-modal');
    navigate('categories');
    toast('Created');
  };
  openModal('form-modal');
}
async function deleteCat(id) {
  showConfirm('Remove', 'Are you sure you want to remove this category?', async () => {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    navigate('categories');
  });
}

// ===== USERS =====
async function renderUsers(el) {
  const main = el.parentNode;
  const isFirstRender = !document.querySelector('#users-search');

  if (!state.users || state.users.length === 0) {
    if (isFirstRender) {
      el.innerHTML = '<div class="loading">Loading...</div>';
    } else {
      // Subsequent render: show loading row in tbody (preserves toolbar/search DOM)
      const tbody = document.querySelector('#users-results-container tbody');
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="5"><div class="loading" style="padding:24px;text-align:center;color:#888">Loading...</div></td></tr>';
      }
    }
    await loadUsers();
    if (!state.users || state.users.length === 0) {
      if (isFirstRender) {
        el.innerHTML =
          '<div class="error-msg">Failed to load users. <button class="btn btn-sm btn-ghost" style="margin-left:8px;text-decoration:underline" data-action="navigate" data-page="users">Retry</button></div>';
      } else {
        // Subsequent render: show error inside tbody (preserves table structure for future renders)
        const tbody = document.querySelector('#users-results-container tbody');
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="5"><div class="error-msg" style="padding:24px;text-align:center;color:#888">Failed to load users. <button class="btn btn-sm btn-ghost" style="margin-left:8px;text-decoration:underline" data-action="navigate" data-page="users">Retry</button></div></td></tr>';
        }
      }
      return;
    }
  }
  const users = state.users;
  const filteredUsers = state.usersSearch
    ? users.filter((u) => u.username.toLowerCase().includes(state.usersSearch.toLowerCase()))
    : users;
  const totalPages = Math.ceil(filteredUsers.length / state.usersPerPage);
  if (state.usersPage > totalPages && totalPages > 0) state.usersPage = totalPages;
  const start = (state.usersPage - 1) * state.usersPerPage;
  const end = Math.min(start + state.usersPerPage, filteredUsers.length);
  const pageUsers = filteredUsers.slice(start, end);

  if (isFirstRender) {
    // First render: build the full toolbar + table structure + pagination once
    // Remove any existing table-toolbar (from previous page)
    const oldToolbar = main.querySelector('.table-toolbar');
    if (oldToolbar) oldToolbar.remove();

    // Insert toolbar as sibling BEFORE .content
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    toolbar.innerHTML = `<div style="font-size:13px;color:#888">${users.length} users${state.usersSearch ? ` (filtered: ${filteredUsers.length})` : ''}</div><div class="filter-group"><div class="search-box" style="width:200px"><label for="users-search" class="sr-only">Search users</label><input type="search" placeholder="Search users..." id="users-search" value="${esc(state.usersSearch)}"></div></div><button class="btn btn-primary btn-sm" data-action="create-user">＋ New User</button>`;
    main.insertBefore(toolbar, el);

    // Only results container inside .content
    el.innerHTML = `<div id="users-results-container">
      <h2 class="sr-only">Users List</h2><div class="table-container admin-table"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody></tbody></table></div>
      ${
        totalPages > 1
          ? `<div class="pagination-bar" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;padding:12px">
        <button class="pagination-btn" data-action="users-prev" ${state.usersPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
        <span class="pagination-info" style="font-size:13px;color:#888">${state.usersPage} / ${totalPages}</span>
        <button class="pagination-btn" data-action="users-next" ${state.usersPage >= totalPages ? 'disabled' : ''}>Next ›</button>
      </div>`
          : ''
      }
    </div>`;

    // Bind users search (once)
    const us = document.getElementById('users-search');
    if (us) {
      us.addEventListener(
        'input',
        debounce(() => {
          if (state.page !== 'users') return;
          state.usersSearch = us.value;
          state.usersPage = 1;
          renderUsers(el);
        }, 300),
      );
    }
  } else {
    // Subsequent render: update toolbar info text without destroying the search input
    const infoEl = main.querySelector('.table-toolbar > div:first-child');
    if (infoEl) {
      infoEl.textContent = `${users.length} users${state.usersSearch ? ` (filtered: ${filteredUsers.length})` : ''}`;
    }
    // Input is the source of truth — state follows the input via debounced handler
  }

  // Always update the results container (tbody + pagination)
  const rc = document.getElementById('users-results-container');
  if (!rc) return;
  const tbody = rc.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = pageUsers
      .map(
        (u) => `<tr>
      <td data-label="Username"><strong>${esc(u.username)}</strong>${u.id === state.user.id ? ' <span style="font-size:10px;color:#888">(you)</span>' : ''}</td>
      <td data-label="Role"><span class="badge" style="background:#f0f0f5;color:#555">${u.role}</span></td>
      <td data-label="Status"><span class="badge ${u.status === 'active' ? 'status-resolved' : u.status === 'pending' ? 'status-open' : 'status-closed'}">${u.status}</span></td>
      <td data-label="Created" style="font-size:12px;color:#888">${fmtDate(u.created_at)}</td>
      <td data-label="" style="text-align:right">${u.id === state.user.id ? '' : u.status === 'pending' ? `<button class="btn btn-sm" style="background:#ecfdf5;color:#16a34a" data-action="approve-user" data-id="${u.id}">Approve</button> <button class="btn btn-sm" style="background:#fef2f2;color:#dc2626" data-action="reject-user" data-id="${u.id}">Reject</button>` : `<button class="btn btn-sm btn-ghost" data-action="toggle-user" data-id="${u.id}">${u.status === 'disabled' ? 'Enable' : 'Disable'}</button> ${u.status === 'active' ? `<button class="btn btn-sm btn-ghost" data-action="reset-user-password" data-id="${u.id}">Reset</button>` : ''}`}</td>
    </tr>`,
      )
      .join('');
  }
  // Update pagination bar
  const existingPagination = rc.querySelector('.pagination-bar');
  if (totalPages > 1) {
    const barHtml = `<div class="pagination-bar" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;padding:12px">
      <button class="pagination-btn" data-action="users-prev" ${state.usersPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span class="pagination-info" style="font-size:13px;color:#888">${state.usersPage} / ${totalPages}</span>
      <button class="pagination-btn" data-action="users-next" ${state.usersPage >= totalPages ? 'disabled' : ''}>Next ›</button>
    </div>`;
    if (existingPagination) {
      existingPagination.outerHTML = barHtml;
    } else {
      rc.insertAdjacentHTML('beforeend', barHtml);
    }
  } else if (existingPagination) {
    existingPagination.remove();
  }
}
function showCreateUser() {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = 'Create User';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group"><label class="form-label">Username *</label><input class="form-input" id="f-u-name" placeholder="e.g. john" autofocus></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Password *</label><input class="form-input" type="password" id="f-u-pass" placeholder="Min 8 characters"></div>
      <div class="form-group"><label class="form-label">Confirm Password *</label><input class="form-input" type="password" id="f-u-pass-confirm" placeholder="Re-enter password"></div>
    </div>
    <div class="pw-hints" id="cu-pass-hints"></div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="f-u-role"><option value="Viewer">Viewer</option><option value="Editor">Editor</option><option value="Admin">Admin</option></select></div>`;
  modal.querySelector('.modal-footer').innerHTML =
    `<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button><button class="btn btn-primary btn-sm" id="f-u-submit">Create</button>`;
  document.getElementById('f-u-submit').onclick = async () => {
    const username = document.getElementById('f-u-name').value.trim();
    const password = document.getElementById('f-u-pass').value;
    const confirm = document.getElementById('f-u-pass-confirm').value;
    const role = document.getElementById('f-u-role').value;
    if (!username || !password || !confirm) return toast('All fields required');
    if (password !== confirm) return toast('Passwords do not match');
    const pwErr = validatePw(password);
    if (pwErr) return toast(pwErr);
    try {
      await api('/api/users/create', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      });
      closeModal('form-modal');
      state.usersPage = 1;
      navigate('users');
      toast('User created');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };
  // Password hints for create user
  initPasswordHints('f-u-pass', 'cu-pass-hints');
  openModal('form-modal');
}

function showChangePassword(forced) {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = forced ? 'Set New Password' : 'Change Password';
  modal.querySelector('.modal-body').innerHTML = `
    ${forced ? '<div class="form-group" style="background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:12px">Your admin has reset your password. Please set a new password to continue.</div>' : `<div class="form-group"><label class="form-label">Current Password</label><input class="form-input" type="password" id="cp-current" placeholder="Current password" autocomplete="current-password"></div>`}
    <div class="form-group"><label class="form-label">New Password</label><input class="form-input" type="password" id="cp-new" placeholder="New password" autocomplete="new-password"></div>
    <div class="pw-hints" id="cp-pass-hints"></div>
    <div class="form-group"><label class="form-label">Confirm New Password</label><input class="form-input" type="password" id="cp-confirm" placeholder="Confirm new password" autocomplete="new-password"></div>
    <div class="form-error" id="cp-error"></div>
    <div class="form-success" id="cp-success"></div>
  `;
  modal.querySelector('.modal-footer').innerHTML =
    (forced
      ? `<button class="btn btn-ghost btn-sm" id="cp-cancel-logout">Log Out</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button>`) +
    `<button class="btn btn-primary btn-sm" id="cp-submit">${forced ? 'Set Password' : 'Change Password'}</button>`;
  openModal('form-modal');
  initPasswordHints('cp-new', 'cp-pass-hints');
  if (forced) {
    document.getElementById('cp-cancel-logout').onclick = async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' });
      } catch {
        /* ignore */
      }
      state.user = null;
      stopActivityTracking();
      closeModal('form-modal');
      renderShell();
    };
  }
  document.getElementById('cp-submit').onclick = async () => {
    const currentPassword = forced ? null : document.getElementById('cp-current').value;
    const newPassword = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    const err = document.getElementById('cp-error');
    const suc = document.getElementById('cp-success');
    err.textContent = '';
    suc.textContent = '';
    if (!newPassword || !confirm) {
      err.textContent = 'Fill in all fields';
      return;
    }
    if (newPassword !== confirm) {
      err.textContent = 'Passwords do not match';
      return;
    }
    try {
      const body = { newPassword };
      if (!forced) body.currentPassword = currentPassword;
      const res = await api('/api/user/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.error) {
        err.textContent = res.error;
        return;
      }
      suc.textContent = 'Password changed successfully';
      if (forced) {
        setTimeout(() => {
          closeModal('form-modal');
          navigate('qa');
        }, 1500);
      } else {
        setTimeout(() => closeModal('form-modal'), 2000);
      }
    } catch (e) {
      err.textContent = e.message || 'Failed to change password';
    }
  };
}
async function approveUser(id) {
  await api(`/api/users/${id}/approve`, { method: 'POST' });
  navigate('users');
  toast('Approved');
}
async function rejectUser(id) {
  showConfirm('Reject User', 'This will delete the pending user account. Continue?', async () => {
    await api(`/api/users/${id}/reject`, { method: 'POST' });
    navigate('users');
    toast('Rejected');
  });
}
async function toggleUser(id) {
  const r = await api(`/api/users/${id}/toggle`, { method: 'POST' });
  navigate('users');
  toast(r.status === 'disabled' ? 'Disabled' : 'Enabled');
}

function showResetUserPassword(id) {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = 'Reset Password';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group" style="background:#e8f4fd;color:#00529b;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:12px">This will force the user to change their password on next login.</div>
    <div class="form-group"><label class="form-label">New Password</label><input class="form-input" type="password" id="ru-new" placeholder="Min 8 chars, uppercase, lowercase, digit, special char" autocomplete="new-password"></div>
    <div class="pw-hints" id="ru-pass-hints"></div>
    <div class="form-group"><label class="form-label">Confirm New Password</label><input class="form-input" type="password" id="ru-confirm" placeholder="Confirm new password"></div>
    <div class="form-error" id="ru-error"></div>
  `;
  modal.querySelector('.modal-footer').innerHTML =
    '<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button><button class="btn btn-primary btn-sm" id="ru-submit">Set New Password</button>';
  openModal('form-modal');
  initPasswordHints('ru-new', 'ru-pass-hints');
  document.getElementById('ru-submit').onclick = async () => {
    const newPassword = document.getElementById('ru-new').value;
    const confirm = document.getElementById('ru-confirm').value;
    const err = document.getElementById('ru-error');
    err.textContent = '';
    if (!newPassword || !confirm) {
      err.textContent = 'Fill in all fields';
      return;
    }
    if (newPassword !== confirm) {
      err.textContent = 'Passwords do not match';
      return;
    }
    const pwErr = validatePw(newPassword);
    if (pwErr) {
      err.textContent = pwErr;
      return;
    }
    try {
      const res = await api('/api/users/' + id + '/password', {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.error) {
        err.textContent = res.error;
        return;
      }
      closeModal('form-modal');
      toast('Password reset - user will need to change on next login');
    } catch (e) {
      err.textContent = e.message || 'Failed to reset password';
    }
  };
}

// ===== DASHBOARD =====
async function renderDashboard(el) {
  // Remove any existing table-toolbar (from QA Library page)
  const main = el.parentNode;
  const oldToolbar = main.querySelector('.table-toolbar');
  if (oldToolbar) oldToolbar.remove();

  el.innerHTML =
    '<h2 class="sr-only">Dashboard</h2><div id="dash-stats" class="loading">Loading...</div>';

  // --- Stats cards ---
  api('/api/stats')
    .then((s) => {
      const ds = document.getElementById('dash-stats');
      if (!ds) return;
      ds.className = '';
      const total = s.qa.total || 0;
      const published = s.qa.published || 0;
      const draft = s.qa.draft || 0;
      const archived = s.qa.archived || 0;
      const publishedPct = total > 0 ? Math.round((published / total) * 100) : 0;
      const draftPct = total > 0 ? Math.round((draft / total) * 100) : 0;
      const archivedPct = total > 0 ? Math.round((archived / total) * 100) : 0;
      ds.className = '';
      ds.innerHTML = `<div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${esc(String(total))}</div><div class="stat-label">Total QA Entries</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--success)">${esc(String(published))}</div><div class="stat-label">Published</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--warning)">${esc(String(draft))}</div><div class="stat-label">Draft</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--text-secondary)">${esc(String(archived))}</div><div class="stat-label">Archived</div></div>
      <div class="stat-card"><div class="stat-number">${esc(String(s.categories ?? 0))}</div><div class="stat-label">Sub-Systems</div></div>
    </div><div class="status-distribution"><div class="section-title" style="margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px">Status Distribution</div><div class="distribution-bar"><div class="dist-segment dist-published" style="flex:${publishedPct};background:var(--success)" title="Published: ${publishedPct}%"></div><div class="dist-segment dist-draft" style="flex:${draftPct};background:var(--warning)" title="Draft: ${draftPct}%"></div><div class="dist-segment dist-archived" style="flex:${archivedPct};background:var(--text-secondary)" title="Archived: ${archivedPct}%"></div></div><div class="distribution-labels"><span>● Published ${publishedPct}%</span><span>● Draft ${draftPct}%</span><span>● Archived ${archivedPct}%</span></div></div>`;
    })
    .catch(() => {
      const el2 = document.getElementById('dash-stats');
      if (el2) {
        el2.innerHTML = '<div class="error-msg">Failed to load stats</div>';
        el2.className = '';
      }
    });

  // --- Recent Entries ---
  const recentSection = document.createElement('div');
  recentSection.id = 'dash-recent';
  recentSection.innerHTML =
    '<div class="section-title">Recent Entries<a href="/qa" data-action="navigate" data-page="qa" data-allow-nav>View All →</a></div><div class="loading">Loading...</div>';
  el.appendChild(recentSection);

  api('/api/qa?_per_page=5&sort=newest')
    .then((data) => {
      const entries = data.data || data.entries || data || [];
      const rs = document.getElementById('dash-recent');
      if (!rs) return;
      if (!entries.length) {
        rs.innerHTML =
          '<div class="section-title">Recent Entries<a href="/qa" data-action="navigate" data-page="qa" data-allow-nav>View All →</a></div><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No entries yet</div></div>';
        return;
      }
      rs.innerHTML = `<div class="section-title">Recent Entries<a href="/qa" data-action="navigate" data-page="qa" data-allow-nav>View All →</a></div><div class="recent-list">${entries.map((q) => `<div class="recent-entry"><div class="recent-entry-row"><a href="/qa/${esc(q.id)}" class="recent-entry-title" data-action="qa-card" data-id="${esc(q.id)}" data-allow-nav>${esc(q.title || q.question || '')}</a><div class="recent-entry-meta">${q.category_name ? `<span class="tag" style="background:${safeColor(q.category_color)}15;color:${safeColor(q.category_color)}">${esc(q.category_icon)} ${esc(q.category_name)}</span>` : ''}<span class="badge ${statusClass(q.status)}">● ${esc(q.status)}</span></div></div>${q.question ? `<div class="recent-entry-question">${esc(q.question.slice(0, 80))}${q.question.length > 80 ? '…' : ''}</div>` : ''}</div>`).join('')}</div>`;
    })
    .catch(() => {
      const rs = document.getElementById('dash-recent');
      if (rs) {
        rs.innerHTML =
          '<div class="section-title">Recent Entries<a href="/qa" data-action="navigate" data-page="qa" data-allow-nav>View All →</a></div><div class="error-msg">Failed to load recent entries</div>';
      }
    });

  // --- Most Viewed ---
  const popSection = document.createElement('div');
  popSection.id = 'dash-popular';
  popSection.innerHTML =
    '<div class="section-title">Most Viewed</div><div class="loading">Loading...</div>';
  el.appendChild(popSection);

  api('/api/qa?_per_page=5&sort=popular')
    .then((data) => {
      const entries = data.data || data.entries || data || [];
      const ps = document.getElementById('dash-popular');
      if (!ps) return;
      if (!entries.length) {
        ps.innerHTML =
          '<div class="section-title">Most Viewed</div><div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No entries yet</div></div>';
        return;
      }
      ps.innerHTML = `<div class="section-title">Most Viewed</div><div class="recent-list">${entries.map((q) => `<div class="recent-entry"><div class="recent-entry-row"><a href="/qa/${esc(q.id)}" class="recent-entry-title" data-action="qa-card" data-id="${esc(q.id)}" data-allow-nav>${esc(q.title || q.question || '')}</a><div class="recent-entry-meta">${q.category_name ? `<span class="tag" style="background:${safeColor(q.category_color)}15;color:${safeColor(q.category_color)}">${esc(q.category_icon)} ${esc(q.category_name)}</span>` : ''}<span class="badge ${statusClass(q.status)}">● ${esc(q.status)}</span><span class="badge">👁 ${esc(String(q.usage_count ?? 0))}</span></div></div>${q.question ? `<div class="recent-entry-question">${esc(q.question.slice(0, 80))}${q.question.length > 80 ? '…' : ''}</div>` : ''}</div>`).join('')}</div>`;
    })
    .catch(() => {
      const ps = document.getElementById('dash-popular');
      if (ps) {
        ps.innerHTML =
          '<div class="section-title">Most Viewed</div><div class="error-msg">Failed to load popular entries</div>';
      }
    });

  // --- Sub-System Coverage ---
  const barSection = document.createElement('div');
  barSection.id = 'dash-bars';
  barSection.innerHTML =
    '<div class="section-title">Sub-System Coverage</div><div class="loading">Loading...</div>';
  el.appendChild(barSection);

  api('/api/categories')
    .then((cats) => {
      const bs = document.getElementById('dash-bars');
      if (!bs) return;
      if (!cats || !cats.length) {
        bs.innerHTML =
          '<div class="section-title">Sub-System Coverage</div><div class="empty-state"><div class="empty-state-text">No sub-systems configured</div></div>';
        return;
      }
      const max = Math.max(...cats.map((c) => c.qa_count || 0), 1);
      bs.innerHTML = `<div class="section-title">Sub-System Coverage</div><div class="bar-chart">${cats.map((c) => `<div class="bar-row"><span class="bar-label">${esc(c.icon)} ${esc(c.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(((c.qa_count || 0) / max) * 100)}%;background:${safeColor(c.color)}"></div></div><span class="bar-count">${c.qa_count || 0}</span></div>`).join('')}</div>`;
    })
    .catch(() => {
      const bs = document.getElementById('dash-bars');
      if (bs) {
        bs.innerHTML =
          '<div class="section-title">Sub-System Coverage</div><div class="error-msg">Failed to load coverage data</div>';
      }
    });
}
