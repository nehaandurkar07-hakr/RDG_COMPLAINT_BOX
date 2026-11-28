/* admin.js - extra tabs for the Super Admin: Staff, Students, Roll List, Activity.
   Started by staff.js only when the signed-in role is "management".
   The real security is on the server (every RPC first runs _require_management());
   this file only draws the screens. */
(function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc } = App;

  const ROLE_NAME = { hod: 'HOD', principal: 'Principal', management: 'Super Admin' };
  const ACTION_LABEL = {
    staff_created: 'New staff account created',
    staff_setup_done: 'Completed first login',
    staff_password_reset: 'Password reset',
    roll_list_imported: 'Roll number list imported',
    student_blocked: 'Student account blocked',
    student_unblocked: 'Student account unblocked',
  };

  let sb = null;
  let ctx = null;

  function init(c) {
    ctx = c;
    sb = App.sb;
    const tabs = $('#adminTabs');
    tabs.hidden = false;
    $$('.tab', tabs).forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  }

  function show(name) {
    $$('#adminTabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    const panes = { complaints: '#paneComplaints', staff: '#paneStaff', students: '#paneStudents', rolls: '#paneRolls', activity: '#paneActivity' };
    Object.entries(panes).forEach(([k, sel]) => { $(sel).hidden = k !== name; });
    $('#refreshBtn').hidden = name !== 'complaints';
    if (name === 'staff') loadStaff();
    if (name === 'students') loadStudents();
    if (name === 'rolls') loadRolls();
    if (name === 'activity') loadActivity();
  }

  const spinner = '<div class="loading"><span class="spinner"></span> Loading...</div>';
  const errBox = (e) => '<div class="alert alert-bad">' + App.icon('alert') + '<div>' + esc(App.errMsg(e)) + '</div></div>';
  const note = (type, icon, html) => '<div class="alert alert-' + type + '">' + App.icon(icon) + '<div>' + html + '</div></div>';

  // =====================================================================
  // STAFF
  // =====================================================================
  async function loadStaff() {
    const pane = $('#paneStaff');
    pane.innerHTML = spinner;
    try {
      const { data, error } = await sb.rpc('staff_list');
      if (error) throw error;
      renderStaff(data || []);
    } catch (e) { pane.innerHTML = errBox(e); }
  }

  function statusBadge(s) {
    if (s.must_change_password) return '<span class="badge b-in_progress">' + App.icon('clock') + ' First login pending</span>';
    return '<span class="badge b-resolved">' + App.icon('checkCircle') + ' Active</span>';
  }

  function renderStaff(rows) {
    const pane = $('#paneStaff');
    const pending = rows.filter((s) => s.must_change_password).length;
    pane.innerHTML =
      note('info', 'info', 'HOD and Principal accounts can be given a new temporary password here. The new password is shown <b>only once</b>; ' +
        'the person signs in with it and completes the first-login form again. New accounts are created as described in the README.') +
      (pending ? note('warn', 'clock', '<b>' + pending + '</b> account(s) have not completed their first login yet. Give them their temporary e-mail and password.') : '') +
      '<div class="list">' +
      (rows.length ? rows.map(staffCard).join('') : '<div class="card empty">' + App.icon('users') + 'There are no staff accounts yet.</div>') +
      '</div>';

    $$('[data-act="reset"]', pane).forEach((b) => b.addEventListener('click', () => {
      const s = rows.find((x) => x.id === b.dataset.id);
      if (s) resetPassword(s, b);
    }));
  }

  function staffCard(s) {
    const me = s.id === ctx.profile.id;
    const canManage = s.role !== 'management';
    const place = [s.district, s.state].filter(Boolean).join(', ');
    return '<div class="card flat staff-card">' +
      '<div class="row between"><span class="who">' + esc(s.full_name || '(name not entered yet)') + (me ? ' <span class="muted">(you)</span>' : '') + '</span>' + statusBadge(s) + '</div>' +
      '<dl class="kv">' +
      '<dt>Role</dt><dd>' + esc(ROLE_NAME[s.role] || s.role) + (s.department ? ' &middot; ' + esc(s.department) : '') + '</dd>' +
      '<dt>Sign-in e-mail</dt><dd>' + esc(s.login_email || '-') + '</dd>' +
      (s.contact_email ? '<dt>Own e-mail</dt><dd>' + esc(s.contact_email) + '</dd>' : '') +
      (s.phone ? '<dt>Mobile</dt><dd>' + esc(s.phone) + '</dd>' : '') +
      (place ? '<dt>Location</dt><dd>' + esc(place) + '</dd>' : '') +
      '<dt>Created</dt><dd>' + esc(App.fmtDate(s.created_at)) + '</dd>' +
      '</dl>' +
      (canManage
        ? '<div class="actions"><button class="btn btn-sm btn-warn" type="button" data-act="reset" data-id="' + esc(s.id) + '">' + App.icon('key') + ' Reset password</button></div>'
        : '') +
      '</div>';
  }

  function label(s) { return (s.full_name || ROLE_NAME[s.role]) + ' (' + (s.login_email || '') + ')'; }

  async function resetPassword(s, btn) {
    if (!window.confirm('Reset the password of ' + label(s) + '?\n\n' +
      'The old password stops working immediately. The person must sign in with the new temporary password and complete the first-login form again' +
      (s.role === 'hod' ? ' (the HOD will choose the department again).' : '.'))) return;
    App.setBusy(btn, true, 'Please wait...');
    try {
      const { data, error } = await sb.rpc('reset_staff_password', { p_id: s.id });
      if (error) throw error;
      showTemp(s, data);
      loadStaff();
    } catch (e) { App.toast(App.errMsg(e), 'bad'); App.setBusy(btn, false); }
  }

  function showTemp(s, temp) {
    const sheet = App.openSheet(
      '<div class="sheet-head"><h2>New temporary password</h2>' + App.CLOSE_BTN + '</div>' +
      '<p class="muted">' + esc(ROLE_NAME[s.role] || s.role) + (s.department ? ' &middot; ' + esc(s.department) : '') + '</p>' +
      '<div class="section-title">Sign-in e-mail</div><div class="tempbox" id="tmpEmail"></div>' +
      '<div class="section-title">Temporary password</div><div class="tempbox" id="tmpPass"></div>' +
      '<div class="alert alert-warn" style="margin-top:14px">' + App.icon('alert') + '<div>This password is shown <b>only now, once</b>. After you close this window it cannot be shown again. ' +
      'Share it only with the person concerned. On first sign-in they will create their own password.</div></div>' +
      '<div class="row"><button class="btn btn-primary" id="tmpCopy" type="button">Copy both</button>' +
      '<button class="btn btn-ghost" data-close type="button">Close</button></div>');
    // set with textContent (never as HTML)
    $('#tmpEmail', sheet).textContent = s.login_email || '';
    $('#tmpPass', sheet).textContent = String(temp || '');
    $$('[data-close]', sheet).forEach((b) => b.addEventListener('click', () => {
      $('#tmpPass', sheet).textContent = '';
      App.closeSheet();
    }));
    $('#tmpCopy', sheet).addEventListener('click', async () => {
      const text = 'Sign-in e-mail: ' + (s.login_email || '') + '\nTemporary password: ' + String(temp || '');
      try {
        await navigator.clipboard.writeText(text);
        App.toast('Copied.', 'ok');
      } catch (e) {
        App.toast('Could not copy. Tap the password to select it and copy manually.', 'warn');
      }
    });
  }

  // =====================================================================
  // STUDENTS (check ID cards, block or unblock)
  // =====================================================================
  let studentRows = [];

  async function loadStudents() {
    const pane = $('#paneStudents');
    pane.innerHTML = spinner;
    try {
      const { data, error } = await sb.rpc('student_list');
      if (error) throw error;
      studentRows = data || [];
      pane.innerHTML =
        note('info', 'idcard', 'Every student uploads a photo of the college ID card while registering. Use this list to check that the person belongs to the college. If a card is not valid, you can block the student.') +
        '<div class="field input-icon">' + App.icon('search') +
        '<input type="search" id="stSearch" placeholder="Search by name, roll number, mobile or e-mail" aria-label="Search students"></div>' +
        '<p class="muted small" id="stCount"></p>' +
        '<div class="list" id="stList"></div>';
      $('#stSearch', pane).addEventListener('input', renderStudents);
      renderStudents();
    } catch (e) { pane.innerHTML = errBox(e); }
  }

  function renderStudents() {
    const q = ($('#stSearch').value || '').trim().toLowerCase();
    const rows = studentRows.filter((s) =>
      !q || [s.full_name, s.roll_no, s.phone, s.email].join(' ').toLowerCase().includes(q));
    $('#stCount').textContent = rows.length + ' of ' + studentRows.length + ' students';
    const list = $('#stList');
    if (!rows.length) {
      list.innerHTML = '<div class="card empty">' + App.icon('users') + 'No students found.</div>';
      return;
    }
    list.innerHTML = rows.map((s) =>
      '<div class="card flat staff-card">' +
      '<div class="row between"><span class="who">' + esc(s.full_name || '-') + '</span>' +
      (s.is_active === false
        ? '<span class="badge b-rejected">' + App.icon('xCircle') + ' Blocked</span>'
        : s.registration_complete
          ? '<span class="badge b-resolved">' + App.icon('checkCircle') + ' Registered</span>'
          : '<span class="badge b-in_progress">' + App.icon('clock') + ' Registration incomplete</span>') + '</div>' +
      '<dl class="kv">' +
      '<dt>Roll number</dt><dd>' + esc(s.roll_no || '-') + '</dd>' +
      '<dt>Course</dt><dd>' + esc(s.course || '-') + (s.age ? ' &middot; Age ' + esc(s.age) : '') + '</dd>' +
      '<dt>Mobile</dt><dd>' + esc(s.phone || '-') + '</dd>' +
      '<dt>E-mail</dt><dd>' + esc(s.email || '-') + '</dd>' +
      '<dt>Address</dt><dd>' + esc(s.address || '-') + '</dd>' +
      '<dt>Registered</dt><dd>' + esc(App.fmtDate(s.created_at)) + '</dd>' +
      '</dl>' +
      '<div class="actions"><button class="btn btn-sm" type="button" data-id-card="' + esc(s.id) + '">' + App.icon('idcard') + ' View ID card</button>' +
      (s.is_active === false
        ? '<button class="btn btn-sm" type="button" data-block="' + esc(s.id) + '" data-to="1">' + App.icon('checkCircle') + ' Unblock student</button>'
        : '<button class="btn btn-sm btn-danger" type="button" data-block="' + esc(s.id) + '" data-to="0">' + App.icon('xCircle') + ' Block student</button>') +
      '</div>' +
      '</div>').join('');
    $$('[data-id-card]', list).forEach((b) => b.addEventListener('click', () => {
      const s = studentRows.find((x) => x.id === b.dataset.idCard);
      if (s) viewIdCard(s, b);
    }));
    $$('[data-block]', list).forEach((b) => b.addEventListener('click', () => {
      const s = studentRows.find((x) => x.id === b.dataset.block);
      if (s) setBlocked(s, b.dataset.to === '1', b);
    }));
  }

  // Block / unblock a student (Super Admin only; the database checks this again)
  async function setBlocked(s, makeActive, btn) {
    const who = (s.full_name || 'this student') + (s.roll_no ? ' (' + s.roll_no + ')' : '');
    const text = makeActive
      ? 'Unblock ' + who + '?\n\nThe student will be able to sign in and file complaints again.'
      : 'Block ' + who + '?\n\nThe student will not be able to sign in, file complaints or vote. Complaints already filed are kept and handled by the staff. ' +
        'The roll number and e-mail stay taken, so the student cannot register again. You can unblock the student at any time.';
    if (!window.confirm(text)) return false;
    App.setBusy(btn, true, 'Please wait...');
    try {
      const { error } = await sb.rpc('set_student_active', { p_id: s.id, p_active: makeActive });
      if (error) throw error;
      s.is_active = makeActive;
      App.toast(makeActive ? 'Student unblocked.' : 'Student blocked.', 'ok');
      renderStudents();
      return true;
    } catch (e) { App.toast(App.errMsg(e), 'bad'); App.setBusy(btn, false); return false; }
  }

  async function viewIdCard(s, btn) {
    if (!s.id_card_path) { App.toast('This student has not uploaded an ID card yet.', 'warn'); return; }
    App.setBusy(btn, true, 'Loading...');
    try {
      const { data, error } = await sb.storage.from('student-ids').createSignedUrl(s.id_card_path, 300);
      if (error || !data) throw error || new Error('The ID card could not be loaded.');
      const sheet = App.openSheet(
        '<div class="sheet-head"><div><div class="muted small">College ID card</div><h2></h2></div>' + App.CLOSE_BTN + '</div>' +
        '<img class="idcard-img" alt="College ID card">' +
        '<p class="hint">This link expires in 5 minutes. The image is private and visible only to the Super Admin.</p>' +
        (s.is_active === false ? '' :
          '<div class="row" style="margin-top:12px"><button class="btn btn-danger" id="idBlock" type="button">' + App.icon('xCircle') + ' This is not a valid ID card: block student</button></div>'));
      $('h2', sheet).textContent = (s.full_name || 'Student') + (s.roll_no ? ' (' + s.roll_no + ')' : '');
      $('img', sheet).src = data.signedUrl;
      const blockBtn = $('#idBlock', sheet);
      if (blockBtn) blockBtn.addEventListener('click', async () => {
        if (await setBlocked(s, false, blockBtn)) App.closeSheet();
      });
    } catch (e) { App.toast(App.errMsg(e), 'bad'); }
    finally { App.setBusy(btn, false); }
  }

  // =====================================================================
  // ROLL LIST (optional allow-list)
  // =====================================================================
  async function loadRolls() {
    const pane = $('#paneRolls');
    pane.innerHTML = spinner;
    try {
      const [info, depts] = await Promise.all([
        sb.rpc('roll_list_info'),
        sb.from('departments').select('name').order('name'),
      ]);
      if (info.error) throw info.error;
      renderRolls(info.data || {}, (depts.data || []).map((d) => d.name));
    } catch (e) { pane.innerHTML = errBox(e); }
  }

  function renderRolls(info, deptNames) {
    const pane = $('#paneRolls');
    pane.innerHTML =
      '<div class="card">' +
      '<h2>Student roll number list <span class="muted small">(optional)</span></h2>' +
      '<p class="muted">If this list contains roll numbers, only those students can register. This helps against fake accounts. ' +
      '<b>If the list is empty, any student with a college ID card can register.</b></p>' +
      note('info', 'info', 'Currently <b>' + esc(info.total || 0) + '</b> roll numbers in the list &middot; <b>' + esc(info.registered || 0) + '</b> students have registered.') +
      '<div class="field"><label for="rollText">Paste roll numbers (one per line)</label>' +
      '<textarea id="rollText" class="roll-area" spellcheck="false" placeholder="BCA2026001, BCA\nBCA2026002, BCA\nCOM2026001, B.Com"></textarea>' +
      '<div class="hint">Format: <code>ROLLNO</code> or <code>ROLLNO, Department</code>. Departments: ' + esc(deptNames.join(', ') || '-') + '. Copy-paste from Excel or upload a CSV file.</div></div>' +
      '<div class="row"><label class="btn btn-sm" for="rollFile" style="cursor:pointer">' + App.icon('folder') + ' Choose CSV / TXT file</label>' +
      '<input id="rollFile" type="file" accept=".csv,.txt,text/csv,text/plain" hidden>' +
      '<button class="btn btn-primary btn-sm" id="rollSave" type="button">' + App.icon('upload') + ' Add to list</button></div>' +
      '</div>';

    $('#rollFile', pane).addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { ev.target.value = ''; return App.toast('The file must be smaller than 1 MB.', 'bad'); }
      const rd = new FileReader();
      rd.onload = () => { $('#rollText', pane).value = String(rd.result || ''); ev.target.value = ''; };
      rd.readAsText(f);
    });
    $('#rollSave', pane).addEventListener('click', async (ev) => {
      const rows = parseRolls($('#rollText', pane).value);
      if (!rows.length) return App.toast('Please enter roll numbers or choose a file first.', 'bad');
      if (!window.confirm('Add ' + rows.length + ' roll numbers to the list?')) return;
      const btn = ev.currentTarget;
      App.setBusy(btn, true, 'Importing...');
      try {
        let imported = 0, skipped = 0;
        for (let i = 0; i < rows.length; i += 1000) {
          const { data, error } = await sb.rpc('import_roll_numbers', { p_rows: rows.slice(i, i + 1000) });
          if (error) throw error;
          imported += (data && data.imported) || 0;
          skipped += (data && data.skipped) || 0;
        }
        App.toast(imported + ' roll numbers added' + (skipped ? ', ' + skipped + ' invalid line(s) skipped.' : '.'), 'ok');
        loadRolls();
      } catch (e) { App.toast(App.errMsg(e), 'bad'); App.setBusy(btn, false); }
    });
  }

  // "ROLL", "ROLL, Dept"; separators , tab ; | are accepted. A header line is skipped.
  function parseRolls(text) {
    const out = [];
    const seen = new Set();
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const parts = line.split(/[,\t;|]/).map((x) => x.trim().replace(/^"|"$/g, '').trim());
      const roll = (parts[0] || '').replace(/\s+/g, '').toUpperCase();
      if (!roll) return;
      if (i === 0 && /^(ROLL|ROLLNO|ROLLNUMBER|ROLL_NO|SR|SRNO)/.test(roll) && !/\d/.test(roll)) return;
      if (seen.has(roll)) return;
      seen.add(roll);
      out.push({ roll, dept: parts[1] || '' });
    });
    return out;
  }

  // =====================================================================
  // ACTIVITY
  // =====================================================================
  async function loadActivity() {
    const pane = $('#paneActivity');
    pane.innerHTML = spinner;
    try {
      const { data, error } = await sb.rpc('audit_list');
      if (error) throw error;
      const rows = data || [];
      pane.innerHTML =
        note('info', 'info', 'A record of changes to staff accounts and settings (latest 200). It never contains a student\'s identity and nobody can delete it.') +
        '<div class="card flat">' +
        (rows.length
          ? rows.map((r) =>
            '<div class="logrow"><span class="when">' + esc(App.fmtDateTime(r.created_at)) + '</span>' +
            '<span><b>' + esc(ACTION_LABEL[r.action] || r.action) + '</b></span>' +
            '<span class="muted">' + esc(r.actor_name || 'System') +
            (r.target_name ? ' &rarr; ' + esc(r.target_name) : '') +
            (r.details ? ' &middot; ' + esc(r.details) : '') + '</span></div>').join('')
          : '<div class="empty">' + App.icon('activity') + 'No activity yet.</div>') +
        '</div>';
    } catch (e) { pane.innerHTML = errBox(e); }
  }

  window.AdminPanel = { init, parseRolls };
})();
