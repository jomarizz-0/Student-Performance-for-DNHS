const API = 'api.php';
let allStudents = [];
let currentPage = 1;
const PER_PAGE  = 10;
let editingId  = null;
let deleteId    = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
fetchStats();
fetchStudents();

// ── Stats ─────────────────────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch(`${API}?action=get_stats`);
    const data = await res.json();
    document.getElementById('statTotal').textContent    = data.total    ?? '—';
    document.getElementById('statMale').textContent   = data.male   ?? '—';
    document.getElementById('statFemale').textContent  = data.female  ?? '—';
    document.getElementById('statSections').textContent = data.sections ?? '—';
  } catch (e) { console.error('Stats fetch failed', e); }
}

// ── Students list ─────────────────────────────────────────────────────────────
async function fetchStudents(search = '') {
  const url = `${API}?action=get_students${search ? '&search=' + encodeURIComponent(search) : ''}`;
  const res = await fetch(url);
  allStudents = await res.json();
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const start = (currentPage - 1) * PER_PAGE;
  const page  = allStudents.slice(start, start + PER_PAGE);

  if (!allStudents.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <p>No students found.</p>
    </div></td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = page.map(s => {
    const fullName = `${s.last_name}, ${s.first_name}${s.middle_name ? ' ' + s.middle_name[0] + '.' : ''}`;
    const bday = s.birth_date
      ? new Date(s.birth_date + 'T00:00:00').toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })
      : '—';
    const addr = [s.address_barangay, s.address_municipality].filter(Boolean).join(', ') || '—';
    const section = s.section_name
      ? `<span class="section-tag">Gr.${s.grade_level} – ${escHtml(s.section_name)}</span>`
      : '—';
    const adviser = s.adviser_fname ? `${escHtml(s.adviser_fname)} ${escHtml(s.adviser_lname)}` : '—';
    const genderBadge = s.gender === 'Male'
      ? `<span class="badge badge-m">Male</span>`
      : `<span class="badge badge-f">Female</span>`;
    // Use data-lrn attribute to avoid any escaping issues in onclick
    return `<tr>
      <td class="td-id">${escHtml(s.stud_lrn)}</td>
      <td class="td-name">${escHtml(fullName)}</td>
      <td>${genderBadge}</td>
      <td>${bday}</td>
      <td>${section}</td>
      <td class="td-adviser">${adviser}</td>
      <td class="td-addr">${escHtml(addr)}</td>

      <td>
        <div class="td-actions">
          <button class="btn btn-view" data-lrn="${escAttr(s.stud_lrn)}" onclick="openProfile(this.dataset.lrn)"
            title="View">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-edit" data-lrn="${escAttr(s.stud_lrn)}" onclick="openEditModal(this.dataset.lrn)"
            title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm" data-lrn="${escAttr(s.stud_lrn)}" data-name="${escAttr(fullName)}" onclick="openConfirm(this.dataset.lrn, this.dataset.name)"
            title="Remove">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>

      <td>
        <button class="present"
          title="Mark as Present"
          data-lrn="${escAttr(s.stud_lrn)}" 
          data-class="${escAttr(s.class_id)}" 
          onclick="quickAttendance(this.dataset.lrn,'Present',this.dataset.class)">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="absent"
          title="Mark as Absent"
          data-lrn="${escAttr(s.stud_lrn)}" 
          data-class="${escAttr(s.class_id)}" 
          onclick="quickAttendance(this.dataset.lrn,'Absent',this.dataset.class)">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <button class="excused"
          title="Mark as Excused"
          data-lrn="${escAttr(s.stud_lrn)}" 
          data-class="${escAttr(s.class_id)}" 
          onclick="quickAttendance(this.dataset.lrn,'Excused',this.dataset.class)">
          <i class="fa-solid fa-e"></i>
        </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  updatePagination();
}

function updatePagination() {
  const total = allStudents.length;
  const pages = Math.ceil(total / PER_PAGE);
  const start = total ? (currentPage - 1) * PER_PAGE + 1 : 0;
  const end  = Math.min(currentPage * PER_PAGE, total);

  document.getElementById('paginationInfo').textContent =
    total ? `Showing ${start}–${end} of ${total} records` : 'No records';

  const btns = document.getElementById('pageButtons');
  if (pages <= 1) { btns.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= pages; i++)
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
  html += `<button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage===pages?'disabled':''}>›</button>`;
  btns.innerHTML = html;
}

function changePage(p) {
  const pages = Math.ceil(allStudents.length / PER_PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderTable();
}

let searchTimer;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => fetchStudents(e.target.value.trim()), 300);
});

// ── Dropdowns ─────────────────────────────────────────────────────────────────
async function loadClasses() {
  const res = await fetch(`${API}?action=get_classes`);
  const data = await res.json();
  const sel = document.getElementById('fClass');
  sel.innerHTML = '<option value="">— Select Section —</option>' +
    data.map(c =>
      `<option value="${c.class_id}">Gr.${c.grade_level} – ${escHtml(c.section_name)} (${escHtml(c.school_year)})</option>`
    ).join('');
}

async function loadPersonnel() {
  const res = await fetch(`${API}?action=get_personnel`);
  const data = await res.json();
  const sel = document.getElementById('fAdviser');
  sel.innerHTML = '<option value="">— Select Adviser —</option>' +
    data.map(p =>
      `<option value="${p.personnel_id}">${escHtml(p.last_name)}, ${escHtml(p.first_name)} (${escHtml(p.position_type)})</option>`
    ).join('');
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add New Student';
  document.getElementById('submitBtn').textContent  = 'Save Student';
  clearForm();
  document.getElementById('lrnField').style.display = '';
  Promise.all([loadClasses(), loadPersonnel()]);
  document.getElementById('formOverlay').classList.add('open');
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
async function openEditModal(lrn) {
  editingId = lrn;
  document.getElementById('modalTitle').textContent = 'Edit Student';
  document.getElementById('submitBtn').textContent  = 'Update Student';
  clearForm();
  document.getElementById('lrnField').style.display = 'none';

  await Promise.all([loadClasses(), loadPersonnel()]);

  const res = await fetch(`${API}?action=get_student&id=${encodeURIComponent(lrn)}`);
  const data = await res.json();
  if (data.error) { showToast(data.error, 'error'); return; }

  document.getElementById('fFirstName').value  = data.first_name            || '';
  document.getElementById('fLastName').value     = data.last_name       || '';
  document.getElementById('fMiddleName').value   = data.middle_name      || '';
  document.getElementById('fBirthdate').value  = data.birth_date            || '';
  document.getElementById('fGender').value       = data.gender                || '';
  document.getElementById('fBarangay').value     = data.address_barangay      || '';
  document.getElementById('fMunicipality').value = data.address_municipality  || '';
  document.getElementById('fClass').value    = data.class_id              || '';
  document.getElementById('fAdviser').value   = data.adviser_id            || '';

  document.getElementById('formOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('formOverlay').classList.remove('open');
}

// ── Submit Student ────────────────────────────────────────────────────────────
async function submitForm() {
  if (!validateForm()) return;

  const payload = {
    stud_lrn:       editingId || document.getElementById('fStudLrn').value.trim(),
    first_name:      document.getElementById('fFirstName').value.trim(),
    middle_name:          document.getElementById('fMiddleName').value.trim(),
    last_name:            document.getElementById('fLastName').value.trim(),
    birth_date:      document.getElementById('fBirthdate').value,
    gender:        document.getElementById('fGender').value,
    address_barangay:   document.getElementById('fBarangay').value.trim(),
    address_municipality: document.getElementById('fMunicipality').value.trim(),
    class_id:       document.getElementById('fClass').value,
    adviser_id:      document.getElementById('fAdviser').value,
  };

  const method = editingId ? 'PUT' : 'POST';
  const res  = await fetch(API, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.errors) { showToast(data.errors[0], 'error'); return; }
  if (data.success) {
    closeModal();
    fetchStudents(document.getElementById('searchInput').value);
    fetchStats();
    showToast(data.message, 'success');
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm() {
  let ok = true;
  const checks = [
    { id: 'fFirstName', err: 'errFirstName', test: v => v.trim() !== '' },
    { id: 'fLastName',  err: 'errLastName', test: v => v.trim() !== '' },
    { id: 'fBirthdate', err: 'errBirthdate', test: v => v !== '' },
    { id: 'fGender',    err: 'errGender',  test: v => v !== '' },
    { id: 'fClass',   err: 'errClass',     test: v => v !== '' },
    { id: 'fAdviser',  err: 'errAdviser',   test: v => v !== '' },
  ];
  if (!editingId)
    checks.push({ id: 'fStudLrn', err: 'errStudLrn', test: v => /^\d{7,9}$/.test(v.trim()) });

  checks.forEach(({ id, err, test }) => {
    const field = document.getElementById(id);
    if (!field) return;
    const wrap  = field.closest('.field');
    if (!test(field.value)) { wrap.classList.add('has-err'); ok = false; }
    else                    { wrap.classList.remove('has-err'); }
  });
  return ok;
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE / DETAIL VIEW  (tabbed: Info | Grades | Attendance)
// ══════════════════════════════════════════════════════════════════════════════
let profileLrn     = null;
let profileStudent = null;
let profilePersonnel = [];

async function openProfile(lrn) {
  profileLrn = lrn;
  document.getElementById('profileBody').innerHTML = '<div class="profile-loading">Loading…</div>';
  document.getElementById('profileOverlay').classList.add('open');

  const [sRes, pRes] = await Promise.all([
    fetch(`${API}?action=get_student&id=${encodeURIComponent(lrn)}`),
    fetch(`${API}?action=get_personnel`),
  ]);
  profileStudent   = await sRes.json();
  profilePersonnel = await pRes.json();

  if (profileStudent.error) {
    document.getElementById('profileBody').innerHTML = `<p class="error-msg">${profileStudent.error}</p>`;
    return;
  }

  renderProfileShell();
  switchTab('info');
}

function renderProfileShell() {
  const s    = profileStudent;
  const fullName = `${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''} ${s.last_name}`;

  document.getElementById('profileBody').innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${s.first_name[0]}${s.last_name[0]}</div>
      <div class="profile-info">
        <h2>${escHtml(fullName)}</h2>
        <div class="profile-meta">
          <span class="badge ${s.gender === 'Male' ? 'badge-m' : 'badge-f'}">${escHtml(s.gender)}</span>
          <span class="meta-chip">LRN: ${escHtml(s.stud_lrn)}</span>
          ${s.section_name ? `<span class="meta-chip">Gr.${s.grade_level} – ${escHtml(s.section_name)}</span>` : ''}
          ${s.school_year ? `<span class="meta-chip">${escHtml(s.school_year)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="profile-tabs">
      <button class="profile-tab active" id="tab-info"       onclick="switchTab('info')">Info</button>
      <button class="profile-tab"    id="tab-grades"     onclick="switchTab('grades')">Grades</button>
      <button class="profile-tab"    id="tab-attendance" onclick="switchTab('attendance')">Attendance</button>
    </div>

    <div id="tab-content"></div>
  `;
}

function switchTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tab-' + tab);
  if (btn) btn.classList.add('active');
  if (tab === 'info')    renderTabInfo();
  else if (tab === 'grades')     renderTabGrades();
  else if (tab === 'attendance') renderTabAttendance();
}

// ── Tab: Info ─────────────────────────────────────────────────────────────────
function renderTabInfo() {
  const s  = profileStudent;
  const bday = s.birth_date
    ? new Date(s.birth_date + 'T00:00:00').toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : '—';
  const addr = [s.address_barangay, s.address_municipality].filter(Boolean).join(', ') || '—';

  document.getElementById('tab-content').innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <div class="card-label">Personal Info</div>
        <div class="card-row"><span>Birthdate</span><strong>${bday}</strong></div>
        <div class="card-row"><span>Address</span><strong>${escHtml(addr)}</strong></div>
      </div>
      <div class="profile-card">
        <div class="card-label">Academic Info</div>
        <div class="card-row"><span>Grade Level</span><strong>${s.grade_level || '—'}</strong></div>
        <div class="card-row"><span>Section</span><strong>${escHtml(s.section_name || '—')}</strong></div>
        <div class="card-row"><span>Adviser</span><strong>${s.adviser_fname ? escHtml(s.adviser_fname + ' ' + s.adviser_lname) : '—'}</strong></div>
      </div>
    </div>
  `;
}

// ── Tab: Grades ───────────────────────────────────────────────────────────────
async function renderTabGrades() {
  document.getElementById('tab-content').innerHTML = '<div class="profile-loading">Loading grades…</div>';
  const res  = await fetch(`${API}?action=get_grades&id=${encodeURIComponent(profileLrn)}`);
  const grades = await res.json();

  const teacherOptions = profilePersonnel
    .map(p => `<option value="${p.personnel_id}">${escHtml(p.last_name)}, ${escHtml(p.first_name)}</option>`)
    .join('');

  const gradeRows = grades.map(g => {
    const periods  = ['1st Quarter','2nd Quarter','3rd Quarter','4th Quarter'];
    const scoreCols = periods.map(p =>
      g.periods[p] !== undefined
        ? `<td class="grade-cell">${g.periods[p].toFixed(2)}</td>`
        : `<td class="grade-cell grade-cell--empty">—</td>`
    ).join('');
    const finalClass = g.final_grade >= 75 ? 'grade-pass' : 'grade-fail';
    return `<tr>
      <td class="subject-name">${escHtml(g.subject_name)}</td>
      ${scoreCols}
      <td class="grade-cell grade-final ${finalClass}">${g.final_grade ? Number(g.final_grade).toFixed(2) : '—'}</td>
      <td><span class="remark-badge ${g.remarks === 'Passed' ? 'remark-pass' : 'remark-fail'}">${escHtml(g.remarks||'—')}</span></td>
      <td>
        <div class="td-actions">  
          <button class="btn btn-edit btn-sm" data-gid="${g.grade_id}" onclick="openGradeEdit(this.dataset.gid)">Edit</button>
          <button class="btn btn-danger btn-sm" data-gid="${g.grade_id}" onclick="deleteGrade(this.dataset.gid)">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="no-data">No grade records found.</td></tr>`;

  document.getElementById('tab-content').innerHTML = `
    <div class="grades-section">
      <div class="tab-section-header">
        <span class="section-label">Grades</span>
        <button class="btn btn-primary btn-sm" onclick="openGradeAdd()">+ Add Grade</button>
      </div>
      <div class="grades-scroll">
        <table class="grades-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th>
              <th>Final</th><th>Remarks</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${gradeRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Grade Form (hidden by default) -->
    <div class="inline-form" id="gradeForm" style="display:none">
      <div class="inline-form-title" id="gradeFormTitle">Add Grade Record</div>
      <input type="hidden" id="gfGradeId"/>
      <div class="form-grid" style="margin-top:12px">
        <div class="field full">
          <label>Subject *</label>
          <select id="gfSubject"><option value="">— Select Subject —</option></select>
        </div>
        <div class="field full">
          <label>Teacher *</label>
          <select id="gfTeacher"><option value="">— Select Teacher —</option>${teacherOptions}</select>
        </div>
        <div class="field">
          <label>1st Quarter</label>
          <input type="number" id="gfQ1" min="0" max="100" step="0.01" placeholder="0 – 100"/>
        </div>
        <div class="field">
          <label>2nd Quarter</label>
          <input type="number" id="gfQ2" min="0" max="100" step="0.01" placeholder="0 – 100"/>
        </div>
        <div class="field">
          <label>3rd Quarter</label>
          <input type="number" id="gfQ3" min="0" max="100" step="0.01" placeholder="0 – 100"/>
        </div>
        <div class="field">
          <label>4th Quarter</label>
          <input type="number" id="gfQ4" min="0" max="100" step="0.01" placeholder="0 – 100"/>
        </div>
      </div>
      <div class="inline-form-footer">
        <button class="btn btn-ghost" onclick="closeGradeForm()">Cancel</button>
        <button class="btn btn-primary" id="gfSubmitBtn" onclick="submitGradeForm()">Save Grade</button>
      </div>
    </div>
  `;

  // Populate subject dropdown
  const sRes  = await fetch(`${API}?action=get_subjects`);
  const subs  = await sRes.json();
  document.getElementById('gfSubject').innerHTML =
    '<option value="">— Select Subject —</option>' +
    subs.map(s => `<option value="${s.subject_id}">${escHtml(s.subject_name)}</option>`).join('');

  // Store grades data for edit
  window._gradesCache = grades;
}

function openGradeAdd() {
  document.getElementById('gradeFormTitle').textContent = 'Add Grade Record';
  document.getElementById('gfSubmitBtn').textContent    = 'Save Grade';
  document.getElementById('gfGradeId').value  = '';
  document.getElementById('gfSubject').value  = '';
  document.getElementById('gfTeacher').value  = '';
  document.getElementById('gfQ1').value = '';
  document.getElementById('gfQ2').value = '';
  document.getElementById('gfQ3').value = '';
  document.getElementById('gfQ4').value = '';
  document.getElementById('gfSubject').disabled = false;
  document.getElementById('gradeForm').style.display = '';
  document.getElementById('gradeForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openGradeEdit(gradeId) {
  const g = (window._gradesCache || []).find(x => String(x.grade_id) === String(gradeId));
  if (!g) return;
  document.getElementById('gradeFormTitle').textContent = 'Edit Grade Record';
  document.getElementById('gfSubmitBtn').textContent    = 'Update Grade';
  document.getElementById('gfGradeId').value   = g.grade_id;
  document.getElementById('gfSubject').value   = g.subject_id;
  document.getElementById('gfTeacher').value   = g.teacher_id;
  document.getElementById('gfQ1').value    = g.periods['1st Quarter'] ?? '';
  document.getElementById('gfQ2').value    = g.periods['2nd Quarter'] ?? '';
  document.getElementById('gfQ3').value    = g.periods['3rd Quarter'] ?? '';
  document.getElementById('gfQ4').value    = g.periods['4th Quarter'] ?? '';
  document.getElementById('gfSubject').disabled = true; // can't change subject on edit
  document.getElementById('gradeForm').style.display = '';
  document.getElementById('gradeForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeGradeForm() {
  document.getElementById('gradeForm').style.display = 'none';
}

async function submitGradeForm() {
  const gradeId  = document.getElementById('gfGradeId').value;
  const subjectId = document.getElementById('gfSubject').value;
  const teacherId = document.getElementById('gfTeacher').value;
  if (!subjectId) { showToast('Please select a subject.', 'error'); return; }
  if (!teacherId) { showToast('Please select a teacher.', 'error'); return; }

  const payload = {
    stud_lrn:  profileLrn,
    subject_id: subjectId,
    teacher_id: teacherId,
    '1st_quarter': document.getElementById('gfQ1').value,
    '2nd_quarter': document.getElementById('gfQ2').value,
    '3rd_quarter': document.getElementById('gfQ3').value,
    '4th_quarter': document.getElementById('gfQ4').value,
  };

  let res;
  if (gradeId) {
    payload.grade_id = gradeId;
    res = await fetch(`${API}?action=update_grade`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    res = await fetch(`${API}?action=add_grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  const data = await res.json();
  if (data.errors) { showToast(data.errors[0], 'error'); return; }
  if (data.success) {
    showToast(data.message, 'success');
    renderTabGrades();
  }
}

async function deleteGrade(gradeId) {
  if (!confirm('Delete this grade record? This cannot be undone.')) return;
  const res = await fetch(`${API}?action=delete_grade&id=${encodeURIComponent(gradeId)}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) { showToast(data.message, 'success'); renderTabGrades(); }
  else showToast(data.error || 'Delete failed.', 'error');
}

// ── Tab: Attendance ───────────────────────────────────────────────────────────
async function renderTabAttendance() {
  document.getElementById('tab-content').innerHTML = '<div class="profile-loading">Loading attendance…</div>';
  const res    = await fetch(`${API}?action=get_attendance&id=${encodeURIComponent(profileLrn)}`);
  const records  = await res.json();

  // Summary counts
  const summary = { Present: 0, Absent: 0, Excused: 0 };
  records.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++; });
  const total = records.length;
  const pPct  = total ? Math.round(summary.Present / total * 100) : 0;

  const teacherOptions = profilePersonnel
    .map(p => `<option value="${p.personnel_id}">${escHtml(p.last_name)}, ${escHtml(p.first_name)}</option>`)
    .join('');

  // Get class_id from student
  const classId = profileStudent.class_id || '';

  const attRows = records.map(r => {
    const d = new Date(r.date + 'T00:00:00').toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
    const statusClass = r.status === 'Present' ? 'att-present' : r.status === 'Absent' ? 'att-absent' : 'att-excused';
    return `<tr>
      <td>${d}</td>
      <td><span class="att-chip ${statusClass}">${escHtml(r.status)}</span></td>
      <td class="td-adviser">${escHtml(r.teacher_name || '—')}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-edit btn-sm" data-aid="${r.attendance_id}" onclick="openAttendanceEdit(this.dataset.aid)">Edit</button>
          <button class="btn btn-danger btn-sm" data-aid="${r.attendance_id}" onclick="deleteAttendance(this.dataset.aid)">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" class="no-data">No attendance records found.</td></tr>`;

  document.getElementById('tab-content').innerHTML = `
    <!-- Summary Bar -->
    <div class="profile-card attendance-card" style="margin-bottom:16px">
      <div class="card-label">Attendance Summary (${total} logged days)</div>
      <div class="attendance-bar-wrap">
        <div class="attendance-bar">
          <div class="bar-present" style="width:${pPct}%"></div>
        </div>
        <span class="bar-pct">${pPct}% present</span>
      </div>
      <div class="attendance-counts">
        <span class="att-chip att-present">✓ ${summary.Present} Present</span>
        <span class="att-chip att-absent">✗ ${summary.Absent} Absent</span>
        <span class="att-chip att-excused">◌ ${summary.Excused} Excused</span>
      </div>
    </div>

    <div class="grades-section">
      <div class="tab-section-header">
        <span class="section-label">Attendance Records</span>
        <button class="btn btn-primary btn-sm" onclick="openAttendanceAdd()">+ Add Record</button>
      </div>
      <div class="grades-scroll">
        <table class="grades-table">
          <thead>
            <tr><th>Date</th><th>Status</th><th>Teacher</th><th>Actions</th></tr>
          </thead>
          <tbody>${attRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Attendance Form -->
    <div class="inline-form" id="attForm" style="display:none">
      <div class="inline-form-title" id="attFormTitle">Add Attendance Record.</div>
      <input type="hidden" id="afAttId"/>
      <input type="hidden" id="afClassId" value="${classId}"/>
      <input type="hidden" id="afStudLrn" value="${profileLrn}"/>

      <div class="form-grid" style="margin-top:12px">
        <div class="field">
          <label>Date *</label>
          <input type="date" id="afDate"/>
        </div>
        <div class="field">
          <label>Status *</label>
          <select id="afStatus">
            <option value="">— Select —</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Excused">Excused</option>
          </select>
        </div>
        <div class="field full">
          <label>Teacher *</label>
          <select id="afTeacher"><option value="">— Select Teacher —</option>${teacherOptions}</select>
        </div>
      </div>
      <div class="inline-form-footer">
        <button class="btn btn-ghost" onclick="closeAttForm()">Cancel</button>
        <button class="btn btn-primary" id="afSubmitBtn" onclick="submitAttForm()">Save Record</button>
      </div>
    </div>
  `;

  window._attCache = records;
}

function openAttendanceAdd() {
  document.getElementById('attFormTitle').textContent = 'Add Attendance Record';
  document.getElementById('afSubmitBtn').textContent  = 'Save Record';
  document.getElementById('afAttId').value  = '';
  document.getElementById('afDate').value  = new Date().toLocaleDateString('en-CA');
  document.getElementById('afStatus').value = '';
  document.getElementById('afTeacher').value = '';
  document.getElementById('attForm').style.display = '';
  document.getElementById('attForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function quickAttendance(lrn, status, classId) {
  // Build or reuse the quick-attendance overlay
  let overlay = document.getElementById('quickAttOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'quickAttOverlay';
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal modal--confirm" style="max-width:440px">
        <div class="modal-header">
          <span class="modal-title" id="qaTitle">Mark Attendance</span>
          <button class="modal-close" onclick="closeQuickAtt()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="padding:20px 24px">
          <input type="hidden" id="qaLrn"/>
          <input type="hidden" id="qaClassId"/>
          <input type="hidden" id="qaStatus"/>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px">
            <div class="field">
              <label>Date *</label>
              <input type="date" id="qaDate"/>
            </div>
            <div class="field">
              <label>Status</label>
              <div id="qaStatusDisplay" style="padding:10px 14px;border-radius:var(--radius-sm);font-weight:600;font-size:13.5px;text-align:center"></div>
            </div>
            <div class="field full">
              <label>Teacher *</label>
              <select id="qaTeacher"><option value="">— Loading… —</option></select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeQuickAtt()">Cancel</button>
          <button class="btn btn-primary" id="qaSubmitBtn" onclick="submitQuickAtt()">Confirm</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeQuickAtt(); });
    document.body.appendChild(overlay);
  }

  // Populate fields
  document.getElementById('qaLrn').value    = lrn;
  document.getElementById('qaClassId').value = classId;
  document.getElementById('qaStatus').value  = status;
  document.getElementById('qaDate').value    = new Date().toLocaleDateString('en-CA');

  // Style the status display pill
  const statusColors = { Present: 'var(--green)', Absent: 'var(--red)', Excused: 'var(--yellow)' };
  const statusBg     = { Present: 'rgba(31,200,126,.15)', Absent: 'rgba(240,79,106,.15)', Excused: 'rgba(245,200,66,.15)' };
  const statusIcons  = { Present: '✓ Present', Absent: '✗ Absent', Excused: '◌ Excused' };
  const disp = document.getElementById('qaStatusDisplay');
  disp.textContent = statusIcons[status] || status;
  disp.style.color      = statusColors[status] || 'var(--text)';
  disp.style.background = statusBg[status] || 'var(--surface2)';
  disp.style.border     = `1px solid ${statusColors[status] || 'var(--border)'}`;

  const titleMap = { Present: '🟢 Mark as Present', Absent: '🔴 Mark as Absent', Excused: '🟡 Mark as Excused' };
  document.getElementById('qaTitle').textContent = titleMap[status] || `Mark as ${status}`;

  // Load teachers
  const teacherSel = document.getElementById('qaTeacher');
  teacherSel.innerHTML = '<option value="">— Loading… —</option>';
  const pRes = await fetch(`${API}?action=get_personnel`);
  const personnel = await pRes.json();
  teacherSel.innerHTML = '<option value="">— Select Teacher —</option>' +
    personnel.map(p => `<option value="${p.personnel_id}">${escHtml(p.last_name)}, ${escHtml(p.first_name)} (${escHtml(p.position_type)})</option>`).join('');

  overlay.classList.add('open');
}

function closeQuickAtt() {
  const overlay = document.getElementById('quickAttOverlay');
  if (overlay) overlay.classList.remove('open');
}

async function submitQuickAtt() {
  const lrn      = document.getElementById('qaLrn').value;
  const classId  = document.getElementById('qaClassId').value;
  const status   = document.getElementById('qaStatus').value;
  const date     = document.getElementById('qaDate').value;
  const teacherId = document.getElementById('qaTeacher').value;

  if (!date)       { showToast('Date is required.',    'error'); return; }
  if (!teacherId)  { showToast('Teacher is required.', 'error'); return; }

  const payload = { stud_lrn: lrn, date, status, class_id: classId, teacher_id: teacherId };
  const res = await fetch(`${API}?action=add_attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.errors) { showToast(data.errors[0], 'error'); return; }
  if (data.success) {
    closeQuickAtt();
    showToast(data.message, 'success');
  }
}

function openAttendanceEdit(attId) {
  const r = (window._attCache || []).find(x => String(x.attendance_id) === String(attId));
  if (!r) return;
  document.getElementById('attFormTitle').textContent = 'Edit Attendance Record';
  document.getElementById('afSubmitBtn').textContent  = 'Update Record';
  document.getElementById('afAttId').value   = r.attendance_id;
  document.getElementById('afDate').value  = r.date;
  document.getElementById('afStatus').value = r.status;
  document.getElementById('afTeacher').value = r.teacher_id;
  document.getElementById('attForm').style.display = '';
  document.getElementById('attForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeAttForm() {
  document.getElementById('attForm').style.display = 'none';
}

async function submitAttForm() {
  const attId  = document.getElementById('afAttId').value;
  const date     = document.getElementById('afDate').value;
  const status   = document.getElementById('afStatus').value;
  const teacherId = document.getElementById('afTeacher').value;
  const classId = document.getElementById('afClassId').value;

  if (!date)      { showToast('Date is required.',    'error'); return; }
  if (!status)    { showToast('Status is required.',  'error'); return; }
  if (!teacherId) { showToast('Teacher is required.', 'error'); return; }

  const lrn = document.getElementById('afStudLrn').value;
  const payload = { date, status, teacher_id: teacherId, class_id: classId, stud_lrn: lrn };

  let res;
  if (attId) {
    payload.attendance_id = attId;
    res = await fetch(`${API}?action=update_attendance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    res = await fetch(`${API}?action=add_attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  const data = await res.json();
  if (data.errors) { showToast(data.errors[0], 'error'); return; }
  if (data.success) {
    showToast(data.message, 'success');
    renderTabAttendance();
  }
}

async function deleteAttendance(attId) {
  if (!confirm('Delete this attendance record?')) return;
  const res = await fetch(`${API}?action=delete_attendance&id=${encodeURIComponent(attId)}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) { showToast(data.message, 'success'); renderTabAttendance(); }
  else showToast(data.error || 'Delete failed.', 'error');
}

function openAttFormModal() {
  const form = document.getElementById('attForm');
  form.style.display = '';
  if (!document.getElementById('attFormOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'attFormOverlay';
    overlay.className = 'att-form-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeAttForm(); };
    form.parentNode.insertBefore(overlay, form);
    overlay.appendChild(form);
    document.body.appendChild(overlay);
  }
  document.getElementById('attFormOverlay').style.display = 'flex';
}

function closeAttForm() {
  document.getElementById('attForm').style.display = 'none';
  const overlay = document.getElementById('attFormOverlay');
  if (overlay) overlay.style.display = 'none';
}

function closeProfile() {
  document.getElementById('profileOverlay').classList.remove('open');
  profileLrn = null;
  profileStudent = null;
}

// ── Delete Student Confirm ────────────────────────────────────────────────────
function openConfirm(id, name) {
  deleteId = id;
  document.getElementById('confirmText').textContent =
    `You are about to permanently delete the record of "${name}". This cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');

  // Re-assign onclick cleanly
  const btn = document.getElementById('confirmDeleteBtn');
  btn.replaceWith(btn.cloneNode(true)); // removes old listeners
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    const res = await fetch(`${API}?id=${encodeURIComponent(deleteId)}`, { method: 'DELETE' });
    const data = await res.json();
    closeConfirm();
    if (data.success) {
      fetchStudents(document.getElementById('searchInput').value);
      fetchStats();
      showToast(data.message, 'success');
    } else {
      showToast(data.error || 'Delete failed.', 'error');
    }
  });
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clearForm() {
  ['fStudLrn','fFirstName','fLastName','fMiddleName','fBirthdate','fBarangay','fMunicipality']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('fGender').value  = '';
  document.getElementById('fClass').value  = '';
  document.getElementById('fAdviser').value = '';
  document.querySelectorAll('.field.has-err').forEach(el => el.classList.remove('has-err'));
}

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

// Safe attribute escape (for data-* attributes)
function escAttr(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Close overlays on backdrop click
document.getElementById('formOverlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
document.getElementById('confirmOverlay').addEventListener('click', function(e) { if (e.target === this) closeConfirm(); });
document.getElementById('profileOverlay').addEventListener('click', function(e) { if (e.target === this) closeProfile(); });