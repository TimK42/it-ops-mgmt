let state = { page:'qa', qaEntries:[], categories:[], qaTotal:0, qaPage:1, qaFilters:{status:'Published',search:''} };

document.addEventListener('DOMContentLoaded', async () => { await loadCategories(); navigate('qa'); });

function navigate(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
  const n = document.querySelector(`[data-nav="${page}"]`);
  if (n) n.classList.add('active');
  const titles = {qa:'QA Library', categories:'Categories', dashboard:'Dashboard'};
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
  const el = document.getElementById('page-content');
  if (page === 'qa') renderQA(el);
  else if (page === 'categories') renderCategories(el);
  else if (page === 'dashboard') renderDashboard(el);
}

async function api(path, opts={}) {
  const res = await fetch(path, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
function toast(msg) { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function statusClass(s) { return ({'Open':'status-open','In Progress':'status-in-progress','Resolved':'status-resolved','Closed':'status-closed','Published':'status-resolved','Draft':'status-open','Archived':'status-closed'})[s]||'status-closed'; }
function severityClass(p) { return `sev-${p}`; }
function timeAgo(d) { if(!d) return ''; const t=(new Date()-new Date(d))/1000; return t<60?'just now':t<3600?Math.floor(t/60)+'m ago':t<86400?Math.floor(t/3600)+'h ago':Math.floor(t/86400)+'d ago'; }
function debounce(fn,ms) { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}; }

async function loadCategories() { try { state.categories = await api('/api/categories'); } catch(e){} }

function exportCSV() {
  if (!state.qaEntries.length) return toast('Nothing to export');
  const keys = Object.keys(state.qaEntries[0]);
  const csv = [keys.join(','), ...state.qaEntries.map(r=>keys.map(k=>`"${(r[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `it-ops-qa-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// ===== QA =====
async function renderQA(el) {
  el.innerHTML = '<div class="loading">Loading...</div>';
  try { const res = await loadQA(); state.qaEntries = res.data; state.qaTotal = res.total; state.qaPage = res.page; } catch(e) {}
  const statuses = [null,'Published','Draft','Archived'];
  el.innerHTML = `<div class="table-toolbar"><div class="filter-group">${statuses.map(s=>`<button class="filter-tab ${state.qaFilters.status===s?'active':''}" data-qf="${s||''}">${s||'All'}</button>`).join('')}</div><button class="btn btn-primary btn-sm" onclick="showCreateQA()">＋ New Entry</button></div><div class="qa-list" id="qa-list"></div>`;
  el.querySelectorAll('[data-qf]').forEach(b=>{b.onclick=()=>{state.qaFilters.status=b.dataset.qf||null;state.qaPage=1;renderQA(el);};});
  const list = document.getElementById('qa-list');
  if (!state.qaEntries.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No QA entries</div></div>'; return; }
  list.innerHTML = state.qaEntries.map(q => `<div class="qa-card" onclick="showQADetail(${q.id})"><div class="qa-card-title"><span class="issue-id">${esc(q.qa_number)}</span> ${esc(q.title)}</div><div class="qa-card-question">${esc(q.question)}</div><div class="qa-card-meta">${q.category_name?`<span class="tag" style="background:${q.category_color}15;color:${q.category_color}">${q.category_icon} ${esc(q.category_name)}</span>`:''}<span class="badge ${statusClass(q.status)}">● ${q.status}</span>${q.tags?q.tags.split(',').map(t=>`<span class="tag">#${t.trim()}</span>`).join(''):''}<span style="font-size:11px;color:#888;margin-left:auto">${timeAgo(q.updated_at)}</span></div></div>`).join('');
  const totalPages = Math.ceil(state.qaTotal / 20);
  list.innerHTML += `<div class="pagination"><div class="pagination-info">Showing ${(state.qaPage-1)*20+1}–${Math.min(state.qaPage*20, state.qaTotal)} of ${state.qaTotal}</div><div class="filter-group"><button class="filter-tab" id="qa-prev" ${state.qaPage<=1?'disabled':''}>‹ Prev</button><span style="font-size:12px;color:#888;padding:0 8px">${state.qaPage} / ${totalPages}</span><button class="filter-tab" id="qa-next" ${state.qaPage>=totalPages?'disabled':''}>Next ›</button></div></div>`;
  document.getElementById('qa-count').textContent = state.qaTotal;
  const prev = document.getElementById('qa-prev'); if (prev && !prev.disabled) prev.onclick = ()=>{ state.qaPage--; renderQA(el); };
  const next = document.getElementById('qa-next'); if (next && !next.disabled) next.onclick = ()=>{ state.qaPage++; renderQA(el); };
}
async function loadQA() {
  const p = new URLSearchParams();
  if (state.qaFilters.status) p.set('status',state.qaFilters.status);
  if (state.qaFilters.search) p.set('search',state.qaFilters.search);
  p.set('_page', state.qaPage);
  p.set('_per_page', '20');
  return api(`/api/qa?${p}`);
}

async function showQADetail(id) {
  const q = await api(`/api/qa/${id}`);
  document.getElementById('detail-modal').innerHTML = `<div class="modal">
    <div class="modal-header"><div class="detail-banner"><div class="modal-title">${esc(q.title)}</div><div class="detail-id">${q.qa_number}</div></div><button class="modal-close" onclick="closeModal('detail-modal')">✕</button></div>
    <div class="modal-body">
      <div class="detail-section"><div class="detail-section-title">Question</div><div class="detail-section-content">${esc(q.question)}</div></div>
      ${q.answer?`<div class="detail-section"><div class="detail-section-title">Answer</div><div class="detail-section-content">${esc(q.answer)}</div></div>`:''}
      <div class="detail-meta"><div><div class="detail-meta-label">Status</div><span class="badge ${statusClass(q.status)}">● ${q.status}</span></div><div><div class="detail-meta-label">Sub-System</div>${q.category_name?`<span class="tag" style="background:${q.category_color}15;color:${q.category_color}">${q.category_icon} ${esc(q.category_name)}</span>`:'-'}</div><div><div class="detail-meta-label">Tags</div>${q.tags?q.tags.split(',').map(t=>`<span class="tag">#${t.trim()}</span>`).join(' '):'-'}</div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost btn-sm" onclick="closeModal('detail-modal')">Close</button><button class="btn btn-sm" style="background:#f0f0f5" onclick="editQA(${q.id})">Edit</button><button class="btn btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca" onclick="deleteQA(${q.id})">Delete</button></div>
  </div>`;
  openModal('detail-modal');
}

async function showCreateQA(data) {
  const isEdit = !!data;
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit QA Entry' : 'New QA Entry';
  modal.querySelector('.modal-body').innerHTML = `
    <div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="f-q-title" value="${isEdit?esc(data.title):''}"></div>
    <div class="form-group"><label class="form-label">Question *</label><textarea class="form-textarea" id="f-question">${isEdit?esc(data.question):''}</textarea></div>
    <div class="form-group"><label class="form-label">Answer</label><textarea class="form-textarea" id="f-answer" rows="5">${isEdit?esc(data.answer||''):''}</textarea></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Sub-System</label><select class="form-select" id="f-q-cat"><option value="">None</option>${state.categories.map(c=>`<option value="${c.id}" ${isEdit&&data.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="f-q-status">${['Published','Draft','Archived'].map(s=>`<option value="${s}" ${isEdit&&data.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Tags (comma separated)</label><input class="form-input" id="f-tags" value="${isEdit?esc(data.tags||''):''}" placeholder="e.g., password,account"></div>`;
  modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-ghost btn-sm" onclick="closeModal('form-modal')">Cancel</button><button class="btn btn-primary btn-sm" id="f-q-submit">${isEdit?'Update':'Create'}</button>`;
  document.getElementById('f-q-submit').onclick = async ()=>{
    const body = {title:document.getElementById('f-q-title').value, question:document.getElementById('f-question').value, answer:document.getElementById('f-answer').value, category_id:document.getElementById('f-q-cat').value||null, status:document.getElementById('f-q-status').value, tags:document.getElementById('f-tags').value};
    if (!body.title||!body.question) return toast('Title and question required');
    try {
      if (isEdit) { await api(`/api/qa/${data.id}`,{method:'PUT',body:JSON.stringify(body)}); toast('Updated'); }
      else { await api('/api/qa',{method:'POST',body:JSON.stringify(body)}); toast('Created'); }
      closeModal('form-modal'); navigate('qa');
    } catch(e) { toast('Error: '+e.message); }
  };
  openModal('form-modal');
}
function editQA(id) { closeModal('detail-modal'); const d=state.qaEntries.find(q=>q.id===id); if(d) showCreateQA(d); }
async function deleteQA(id) { if(!confirm('Delete?')) return; await api(`/api/qa/${id}`,{method:'DELETE'}); toast('Deleted'); navigate('qa'); }

// ===== CATEGORIES =====
async function renderCategories(el) {
  await loadCategories();
  el.innerHTML = `<div class="table-toolbar"><div style="font-size:13px;color:#888">${state.categories.length} sub-systems</div><button class="btn btn-primary btn-sm" onclick="showCreateCategory()">＋ Add Sub-System</button></div>
    <div class="table-container"><table><thead><tr><th>Icon</th><th>Name</th><th>Color</th><th>QA</th><th></th></tr></thead><tbody>${state.categories.map(c=>`<tr><td style="font-size:18px">${c.icon}</td><td><strong>${esc(c.name)}</strong></td><td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${c.color};vertical-align:middle"></span> ${c.color}</td><td>${c.qa_count||0}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteCat(${c.id})">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function showCreateCategory() {
  const modal = document.getElementById('form-modal');
  modal.querySelector('.modal-title').textContent = 'New Sub-System';
  modal.querySelector('.modal-body').innerHTML = `<div class="form-group"><label class="form-label">Name *</label><input class="form-input" id="f-cat-name"></div><div class="form-row"><div class="form-group"><label class="form-label">Color</label><input class="form-input" id="f-cat-color" type="color" value="#6366f1"></div><div class="form-group"><label class="form-label">Icon</label><input class="form-input" id="f-cat-icon" value="📋"></div></div>`;
  modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-ghost btn-sm" onclick="closeModal('form-modal')">Cancel</button><button class="btn btn-primary btn-sm" id="f-cat-submit">Create</button>`;
  document.getElementById('f-cat-submit').onclick = async ()=>{
    const body = {name:document.getElementById('f-cat-name').value, color:document.getElementById('f-cat-color').value, icon:document.getElementById('f-cat-icon').value};
    if (!body.name) return toast('Name required');
    await api('/api/categories',{method:'POST',body:JSON.stringify(body)}); closeModal('form-modal'); navigate('categories'); toast('Created');
  };
  openModal('form-modal');
}
async function deleteCat(id) { if(!confirm('Remove?')) return; await api(`/api/categories/${id}`,{method:'DELETE'}); navigate('categories'); }

// ===== DASHBOARD =====
async function renderDashboard(el) {
  el.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const s = await api('/api/stats');
    el.innerHTML = `<div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
      <div class="stat-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px"><div class="stat-number" style="font-size:32px;font-weight:700">${s.qa.total}</div><div class="stat-label" style="font-size:12px;color:#888;margin-top:4px">QA Entries</div></div>
      <div class="stat-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px"><div class="stat-number" style="font-size:32px;font-weight:700">${s.categories}</div><div class="stat-label" style="font-size:12px;color:#888;margin-top:4px">Sub-Systems</div></div>
    </div>`;
  } catch(e) { el.innerHTML = '<div class="error-msg">Failed to load dashboard</div>'; }
}

// Global search binding
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('global-search');
  if (search) {
    search.addEventListener('input', debounce(() => {
      if (state.page === 'qa') { state.qaFilters.search = search.value; state.qaPage = 1; navigate('qa'); }
    }, 300));
  }
});
