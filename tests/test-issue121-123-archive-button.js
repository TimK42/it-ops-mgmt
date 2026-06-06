// Test: Archive button visibility by role
// Admin sees "Delete" button, Editor sees "Archive" button, Viewer sees neither

const assert = require('assert');

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(c) {
  if (!c) return '#6366f1';
  return c;
}

function statusClass(s) {
  if (s === 'Published') return 'status-open';
  if (s === 'Draft') return 'status-draft';
  return 'status-closed';
}

function renderDetailModal(state, q) {
  var canEdit = ['Admin', 'Editor'].includes(state.user.role);
  var canDelete = state.user.role === 'Admin';
  return `<div class="modal">
    <div class="modal-header"><div class="detail-banner"><div class="modal-title">${esc(q.title)}</div><div class="detail-id">${q.qa_number}</div></div><button class="modal-close" data-action="close-detail" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="detail-section"><div class="detail-section-title">Question</div><div class="detail-section-content">${esc(q.question)}</div></div>
      <div class="detail-meta"><div><div class="detail-meta-label">Status</div><span class="badge ${statusClass(q.status)}">● ${q.status}</span></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost btn-sm" data-action="close-detail">Close</button>${canEdit ? `<button class="btn btn-sm btn-edit" data-action="edit-qa" data-id="${q.id}">Edit</button>` : ''}${canDelete ? `<button class="btn btn-sm btn-danger" data-action="delete-qa" data-id="${q.id}">Delete</button>` : canEdit ? `<button class="btn btn-sm btn-archive" data-action="archive-qa" data-id="${q.id}">Archive</button>` : ''}</div>
  </div>`;
}

var entry = {
  id: 1,
  qa_number: 'QA-0001',
  title: 'Test Entry',
  question: 'Test question?',
  answer: 'Test answer',
  status: 'Published',
  category_name: 'CAD',
  tags: ['test'],
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('Archive button visibility by role', function () {
  it('Admin sees Delete button, no Archive button', function () {
    var html = renderDetailModal({ user: { role: 'Admin' } }, entry);
    assert.ok(html.indexOf('data-action="delete-qa"') !== -1, 'Admin should see Delete button');
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Admin should NOT see Archive button',
    );
  });

  it('Editor sees Archive button, no Delete button', function () {
    var html = renderDetailModal({ user: { role: 'Editor' } }, entry);
    assert.ok(
      html.indexOf('data-action="archive-qa"') !== -1,
      'Editor should see Archive button',
    );
    assert.ok(
      html.indexOf('data-action="delete-qa"') === -1,
      'Editor should NOT see Delete button',
    );
  });

  it('Viewer sees neither Archive nor Delete button', function () {
    var html = renderDetailModal({ user: { role: 'Viewer' } }, entry);
    assert.ok(html.indexOf('data-action="delete-qa"') === -1, 'Viewer should NOT see Delete button');
    assert.ok(
      html.indexOf('data-action="archive-qa"') === -1,
      'Viewer should NOT see Archive button',
    );
    assert.ok(
      html.indexOf('data-action="edit-qa"') === -1,
      'Viewer should NOT see Edit button',
    );
  });

  it('Editor still sees Edit button', function () {
    var html = renderDetailModal({ user: { role: 'Editor' } }, entry);
    assert.ok(html.indexOf('data-action="edit-qa"') !== -1, 'Editor should see Edit button');
  });
});
