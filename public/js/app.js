let state = {
  page: 'qa',
  qaEntries: [],
  categories: [],
  qaTotal: 0,
  qaTotalCount: null,
  qaPage: 1,
  qaFilters: { status: 'Published', search: '' },
  user: null,
  sessionExpired: false,
  users: [],
  usersPage: 1,
  usersPerPage: 20,
};

function initTheme() {
  let theme = null;
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
  } catch {}
  if (!theme) {
    if (typeof window.matchMedia === 'function') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      theme = 'light';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      let stored = null;
      try {
        stored = localStorage.getItem('theme');
      } catch {}
      if (!stored || (stored !== 'dark' && stored !== 'light')) {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
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
  try {
    localStorage.setItem('theme', next);
  } catch {}
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(next === 'dark'));
  }
}

initTheme();

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
      break;
    case 'theme-toggle':
      toggleTheme();
      break;
    case 'logout':
      logout();
      break;
    case 'close-modal':
      closeModal(modal);
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
    case 'delete-qa':
      deleteQA(id);
      break;
    case 'create-category':
      showCreateCategory();
      break;
    case 'delete-cat':
      deleteCat(id);
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
  const initPath = window.location.pathname;
  if (initPath === '/register' || initPath === '/register/') {
    try {
      const u = await api('/api/auth/me');
      if (u && u.id) {
        history.replaceState(null, '', '/qa');
        window.location.reload();
        return;
      }
    } catch (e) {
      /* not authenticated, continue to register */
    }
    renderLogin('register');
    return;
  }
  try {
    const u = await api('/api/auth/me');
    state.user = u;
    await Promise.all([loadCategories(), loadQATotalCount()]);
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
  } catch (e) {
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
  } catch (e) {}
}
async function loadQATotalCount() {
  try {
    const s = await api('/api/stats');
    state.qaTotalCount = s && s.qa && typeof s.qa.total === 'number' ? s.qa.total : 0;
  } catch (e) {
    state.qaTotalCount = 0;
  }
}
async function loadUsers() {
  try {
    const data = await api('/api/users');
    state.users = data;
    state.usersPage = 1;
  } catch (e) {
    state.users = [];
    toast('Failed to load users');
  }
}

// Session idle tracking
const SESSION_MAX_AGE = 16 * 60 * 60 * 1000; // 16h
const WARNING_BEFORE = 30 * 60 * 1000; // 30 min before
let lastActivity = Date.now();
let sessionMonitorId = null;
let sessionWarned = false;

const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
let activityHandler;

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
  } catch (e) {
    state.sessionExpired = true;
    closeModal('session-warning-modal');
    logout();
  }
}

// ===== CONFIRM MODAL =====
let confirmCallback = null;
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
    <div class="login-page">
      <div class="login-card">
        <h1>${isRegister ? 'Create Account' : 'IT Operations'}</h1>
        <div class="login-sub">${isRegister ? 'Register for access' : 'Knowledge Base'}</div>
        ${fallbackError}${expiredMsg}
        <div class="login-error" id="login-error"></div>
        <div class="login-success" id="login-success"></div>
        <div class="form-group"><label for="auth-user" class="sr-only">Username</label><input class="form-input" id="auth-user" placeholder="Username" autocomplete="username" autofocus></div>
        <div class="form-group"><label for="auth-pass" class="sr-only">Password</label><input class="form-input" type="password" id="auth-pass" placeholder="Password" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></div>
        ${isRegister ? `<div class="form-group"><label for="auth-role" class="sr-only">Role</label><select class="form-select" id="auth-role"><option value="Viewer">Viewer</option><option value="Contributor">Contributor</option></select></div>` : `<div style="margin-bottom:14px"><label style="font-size:12px;color:#888;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="auth-remember"> Remember me</label></div>`}
        <button class="btn btn-primary" id="auth-submit">${isRegister ? 'Register' : 'Sign In'}</button>
        <div class="login-link">${isRegister ? '<a href="/" data-action="login-link" data-allow-nav>← Back to sign in</a>' : '<a href="/register" data-action="login-link" data-page="register" data-allow-nav>Create account</a>'}</div>
      </div>
    </div>`;
  const err = document.getElementById('login-error');
  const suc = document.getElementById('login-success');
  document.getElementById('auth-submit').onclick = async () => {
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
  };
  document.getElementById('auth-user').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('auth-pass').focus();
  });
  document.getElementById('auth-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('auth-submit').click();
  });
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
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
        <div class="nav-item" style="color:rgba(255,255,255,0.5);font-size:12px"><span class="nav-icon" style="font-size:12px"><span class="admin-user-icon">${esc(userName)[0].toUpperCase()}</span></span> ${esc(userName)} (${u.role})</div>
        <button class="nav-item" data-action="logout" style="color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer"><span class="nav-icon" style="font-size:12px">🚪</span> Sign Out</button>
      </div>
      <div class="footer"><span class="footer-version">IT Operations KB v${appVersion}</span></div>
    </nav>
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
    </main>`;
}

function navigate(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach((e) => e.classList.remove('active'));
  const n = document.querySelector(`[data-nav="${page}"]`);
  if (n) n.classList.add('active');
  const titles = {
    qa: 'QA Library',
    categories: 'Categories',
    users: 'Users',
    dashboard: 'Dashboard',
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
let qaAbortController = null;

async function renderQA(el) {
  // Cancel stale in-flight fetch before starting a new one
  if (qaAbortController) qaAbortController.abort();
  qaAbortController = new AbortController();
  const signal = qaAbortController.signal;

  el.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const res = await loadQA(signal);
    // Guard against stale fetch: abort or page changed while waiting
    if (signal.aborted || state.page !== 'qa') return;
    state.qaEntries = res.data;
    state.qaTotal = res.total;
    state.qaPage = res.page;
  } catch (e) {
    if (e.name === 'AbortError' || state.page !== 'qa') return;
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Error loading entries</div></div>`;
    return;
  }
  const canEdit = ['Admin', 'Contributor'].includes(state.user.role);
  const statuses = [null, 'Published', 'Draft', 'Archived'];
  el.innerHTML = `<div class="table-toolbar"><div class="filter-group">${statuses.map((s) => `<button class="filter-tab ${state.qaFilters.status === s ? 'active' : ''}" data-qf="${s || ''}">${s || 'All'}</button>`).join('')}</div><div class="filter-group"><div class="search-box"><span class="search-icon">🔍</span><label for="global-search" class="sr-only">Search QA entries</label><input type="search" placeholder="Search..." id="global-search" inputmode="search"></div><button class="btn btn-ghost btn-sm" data-action="export-csv">📥 Export</button>${canEdit ? `<button class="btn btn-primary btn-sm" data-action="create-qa">＋ New Entry</button>` : ''}</div></div><div class="qa-list" id="qa-list"></div>`;
  // Restore search input value after re-render
  const s = document.getElementById('global-search');
  if (s && state.qaFilters.search) s.value = state.qaFilters.search;
  el.querySelectorAll('[data-qf]').forEach((b) => {
    b.onclick = () => {
      state.qaFilters.status = b.dataset.qf || null;
      state.qaPage = 1;
      renderQA(el);
    };
  });

  // Bind search
  const search = document.getElementById('global-search');
  if (search) {
    search.addEventListener(
      'input',
      debounce(() => {
        if (state.page !== 'qa') return;
        state.qaFilters.search = search.value;
        state.qaPage = 1;
        renderQA(el);
      }, 300),
    );
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
        `<a href="/qa/${q.id}" class="qa-card" data-action="qa-card" data-id="${q.id}" data-allow-nav><div class="qa-card-title"><span class="issue-id">${esc(q.qa_number)}</span> ${esc(q.title)}</div><div class="qa-card-question">${esc(q.question)}</div><div class="qa-card-meta">${q.category_name ? `<span class="tag" style="background:${q.category_color}15;color:${q.category_color}">${q.category_icon} ${esc(q.category_name)}</span>` : ''}<span class="badge ${statusClass(q.status)}">● ${q.status}</span>${
          q.tags
            ? q.tags
                .split(',')
                .map((t) => `<span class="tag">#${esc(t.trim())}</span>`)
                .join('')
            : ''
        }<span style="font-size:11px;color:#888;margin-left:auto;text-align:right;line-height:1.5"><div>🆕 ${fmtDate(q.created_at)}</div><div>✎ ${fmtDate(q.updated_at)}</div></span></div></a>`,
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
  p.set('_page', state.qaPage);
  p.set('_per_page', '20');
  return api(`/api/qa?${p}`, { signal });
}

async function showQADetail(id) {
  const q = await api(`/api/qa/${id}`);
  // Ensure entry is in qaEntries so editQA works for deep links
  if (!state.qaEntries.find((e) => e.id === q.id)) {
    state.qaEntries.push(q);
  }
  const canEdit = ['Admin', 'Contributor'].includes(state.user.role);
  document.getElementById('detail-modal').innerHTML = `<div class="modal">
    <div class="modal-header"><div class="detail-banner"><div class="modal-title">${esc(q.title)}</div><div class="detail-id">${q.qa_number}</div></div><button class="modal-close" data-action="close-detail" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="detail-section"><div class="detail-section-title">Question</div><div class="detail-section-content">${esc(q.question)}</div></div>
      ${q.answer ? `<div class="detail-section"><div class="detail-section-title">Answer</div><div class="detail-section-content">${esc(q.answer)}</div></div>` : ''}
      <div class="detail-meta"><div><div class="detail-meta-label">Status</div><span class="badge ${statusClass(q.status)}">● ${q.status}</span></div><div><div class="detail-meta-label">Sub-System</div>${q.category_name ? `<span class="tag" style="background:${q.category_color}15;color:${q.category_color}">${q.category_icon} ${esc(q.category_name)}</span>` : '-'}</div><div><div class="detail-meta-label">Tags</div>${
        q.tags
          ? q.tags
              .split(',')
              .map((t) => `<span class="tag">#${esc(t.trim())}</span>`)
              .join(' ')
          : '-'
      }</div><div><div class="detail-meta-label">Created</div>${fmtDate(q.created_at)}</div><div><div class="detail-meta-label">Modified</div>${fmtDate(q.updated_at)}</div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost btn-sm" data-action="close-detail">Close</button>${canEdit ? `<button class="btn btn-sm btn-edit" data-action="edit-qa" data-id="${q.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="delete-qa" data-id="${q.id}">Delete</button>` : ''}</div>
  </div>`;
  openModal('detail-modal');
}

async function showCreateQA(data) {
  const isEdit = !!data;
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit QA Entry' : 'New QA Entry';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="f-q-title" value="${isEdit ? esc(data.title) : ''}"></div>
    <div class="form-group"><label class="form-label">Question *</label><textarea class="form-textarea" id="f-question">${isEdit ? esc(data.question) : ''}</textarea></div>
    <div class="form-group"><label class="form-label">Answer</label><textarea class="form-textarea" id="f-answer" rows="5">${isEdit ? esc(data.answer || '') : ''}</textarea></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Sub-System</label><select class="form-select" id="f-q-cat"><option value="">None</option>${state.categories.map((c) => `<option value="${c.id}" ${isEdit && data.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="f-q-status">${['Published', 'Draft', 'Archived'].map((s) => `<option value="${s}" ${isEdit && data.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Tags (comma separated)</label><input class="form-input" id="f-tags" value="${isEdit ? esc(data.tags || '') : ''}" placeholder="e.g., password,account"></div>`;
  modal.querySelector('.modal-footer').innerHTML =
    `<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button><button class="btn btn-primary btn-sm" id="f-q-submit">${isEdit ? 'Update' : 'Create'}</button>`;
  document.getElementById('f-q-submit').onclick = async () => {
    const body = {
      title: document.getElementById('f-q-title').value,
      question: document.getElementById('f-question').value,
      answer: document.getElementById('f-answer').value,
      category_id: document.getElementById('f-q-cat').value || null,
      status: document.getElementById('f-q-status').value,
      tags: document.getElementById('f-tags').value,
    };
    if (!body.title || !body.question) return toast('Title and question required');
    try {
      if (isEdit) {
        await api(`/api/qa/${data.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast('Updated');
        await loadQATotalCount();
        const badgeEdit = document.getElementById('qa-count');
        if (badgeEdit) badgeEdit.textContent = state.qaTotalCount;
      } else {
        await api('/api/qa', { method: 'POST', body: JSON.stringify(body) });
        toast('Created');
        await loadQATotalCount();
        const badgeCreate = document.getElementById('qa-count');
        if (badgeCreate) badgeCreate.textContent = state.qaTotalCount;
      }
      closeModal('form-modal');
      navigate('qa');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };
  openModal('form-modal');
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
    await loadQATotalCount();
    const badge = document.getElementById('qa-count');
    if (badge) badge.textContent = state.qaTotalCount;
    navigate('qa');
  });
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
  el.innerHTML = `<div class="table-toolbar"><div style="font-size:13px;color:#888">${state.categories.length} sub-systems</div><button class="btn btn-primary btn-sm" data-action="create-category">＋ Add Sub-System</button></div>
    <div class="table-container"><table><thead><tr><th>Icon</th><th>Name</th><th>Color</th><th>QA</th><th></th></tr></thead><tbody>${state.categories.map((c) => `<tr><td style="font-size:18px">${c.icon}</td><td><strong>${esc(c.name)}</strong></td><td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${c.color};vertical-align:middle"></span> ${c.color}</td><td>${c.qa_count || 0}</td><td><button class="btn btn-ghost btn-sm" data-action="delete-cat" data-id="${c.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
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
  if (!state.users || state.users.length === 0) {
    el.innerHTML = '<div class="loading">Loading...</div>';
    await loadUsers();
    if (!state.users || state.users.length === 0) {
      el.innerHTML =
        '<div class="error-msg">Failed to load users. <button class="btn btn-sm btn-ghost" style="margin-left:8px;text-decoration:underline" data-action="navigate" data-page="users">Retry</button></div>';
      return;
    }
  }
  const users = state.users;
  const totalPages = Math.ceil(users.length / state.usersPerPage);
  if (state.usersPage > totalPages && totalPages > 0) state.usersPage = totalPages;
  const start = (state.usersPage - 1) * state.usersPerPage;
  const end = Math.min(start + state.usersPerPage, users.length);
  const pageUsers = users.slice(start, end);
  el.innerHTML = `<div class="table-toolbar"><div style="font-size:13px;color:#888">${users.length} users</div><button class="btn btn-primary btn-sm" data-action="create-user">＋ New User</button></div>
    <div class="table-container"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${pageUsers
      .map(
        (u) => `<tr>
      <td><strong>${esc(u.username)}</strong>${u.id === state.user.id ? ' <span style="font-size:10px;color:#888">(you)</span>' : ''}</td>
      <td><span class="badge" style="background:#f0f0f5;color:#555">${u.role}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'status-resolved' : u.status === 'pending' ? 'status-open' : 'status-closed'}">${u.status}</span></td>
      <td style="font-size:12px;color:#888">${fmtDate(u.created_at)}</td>
      <td style="text-align:right">${u.id === state.user.id ? '' : u.status === 'pending' ? `<button class="btn btn-sm" style="background:#ecfdf5;color:#16a34a" data-action="approve-user" data-id="${u.id}">Approve</button> <button class="btn btn-sm" style="background:#fef2f2;color:#dc2626" data-action="reject-user" data-id="${u.id}">Reject</button>` : `<button class="btn btn-sm btn-ghost" data-action="toggle-user" data-id="${u.id}">${u.status === 'disabled' ? 'Enable' : 'Disable'}</button>`}</td>
    </tr>`,
      )
      .join('')}</tbody></table></div>
    ${
      totalPages > 1
        ? `<div class="pagination-bar" style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px;padding:12px">
      <button class="pagination-btn" data-action="users-prev" ${state.usersPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span class="pagination-info" style="font-size:13px;color:#888">${state.usersPage} / ${totalPages}</span>
      <button class="pagination-btn" data-action="users-next" ${state.usersPage >= totalPages ? 'disabled' : ''}>Next ›</button>
    </div>`
        : ''
    }`;
}
function showCreateUser() {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = 'Create User';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group"><label class="form-label">Username *</label><input class="form-input" id="f-u-name" placeholder="e.g. john" autofocus></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Password *</label><input class="form-input" type="password" id="f-u-pass" placeholder="Min 4 characters"></div>
      <div class="form-group"><label class="form-label">Confirm Password *</label><input class="form-input" type="password" id="f-u-pass-confirm" placeholder="Re-enter password"></div>
    </div>
    <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="f-u-role"><option value="Viewer">Viewer</option><option value="Contributor">Contributor</option><option value="Admin">Admin</option></select></div>`;
  modal.querySelector('.modal-footer').innerHTML =
    `<button class="btn btn-ghost btn-sm" data-action="close-modal" data-modal="form-modal">Cancel</button><button class="btn btn-primary btn-sm" id="f-u-submit">Create</button>`;
  document.getElementById('f-u-submit').onclick = async () => {
    const username = document.getElementById('f-u-name').value.trim();
    const password = document.getElementById('f-u-pass').value;
    const confirm = document.getElementById('f-u-pass-confirm').value;
    const role = document.getElementById('f-u-role').value;
    if (!username || !password || !confirm) return toast('All fields required');
    if (password.length < 4) return toast('Password too short (min 4)');
    if (password !== confirm) return toast('Passwords do not match');
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
  openModal('form-modal');
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

// ===== DASHBOARD =====
async function renderDashboard(el) {
  el.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const s = await api('/api/stats');
    el.innerHTML = `<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
      <div class="stat-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px"><div class="stat-number" style="font-size:32px;font-weight:700">${s.qa.total}</div><div class="stat-label" style="font-size:12px;color:#888;margin-top:4px">QA Entries</div></div>
      <div class="stat-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px"><div class="stat-number" style="font-size:32px;font-weight:700">${s.categories}</div><div class="stat-label" style="font-size:12px;color:#888;margin-top:4px">Sub-Systems</div></div>
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="error-msg">Failed to load dashboard</div>';
  }
}
