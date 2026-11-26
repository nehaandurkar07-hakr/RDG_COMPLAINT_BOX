/* staff.js - HOD / Principal / Super Admin dashboard */
(async function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc } = App;

  if (!App.configured || !App.sb) { App.showSetupNeeded(); return; }
  const sb = App.sb;

  const ctx = await App.requireUser(['hod', 'principal', 'management']).catch(() => null);
  if (!ctx) return;
  const profile = ctx.profile;
  const role = profile.role;
  const deptName = profile.departments && profile.departments.name;
  const title = App.designation(profile);

  const panelTitle = { hod: 'HOD Panel', principal: 'Principal Panel', management: 'Super Admin Panel' }[role];
  $('#panelTitle').textContent = panelTitle;
  document.title = panelTitle + ' | Complaint Box';
  App.initTopbar(profile, title);
  $('#hello').textContent = 'Welcome, ' + (profile.full_name || title);
  $('#helloSub').textContent = {
    hod: 'Complaints for the ' + (deptName || 'your') + ' department',
    principal: 'Complaints from the whole college',
    management: 'Complaints from the whole college, including those against the HOD and Principal',
  }[role];

  // ---------- profile card (small, on the side) ----------
  (function renderProfile() {
    const email = profile.contact_email || ctx.user.email || '';
    const place = [profile.district, profile.state].filter(Boolean).join(', ');
    const rows = [];
    if (email) rows.push(['mail', email]);
    if (profile.phone) rows.push(['phone', profile.phone]);
    if (place) rows.push(['pin', place]);
    if (role === 'hod' && deptName) rows.push(['building', 'Department of ' + deptName]);
    $('#profileCard').innerHTML =
      '<div class="profile-top"><div class="avatar">' + esc(App.initials(profile.full_name)) + '</div>' +
      '<div><div class="pname">' + esc(profile.full_name || title) + '</div>' +
      '<span class="ptitle">' + esc(title) + '</span></div></div>' +
      (rows.length
        ? '<ul class="plist">' + rows.map((r) => '<li>' + App.icon(r[0]) + '<span>' + esc(r[1]) + '</span></li>').join('') + '</ul>'
        : '');
  })();

  const state = { all: [], hours: 24 };

  // ---------- filter controls ----------
  $('#fLevel').innerHTML =
    '<option value="mine">With me</option><option value="all">All complaints</option>';
  $('#fCategory').innerHTML = '<option value="">All categories</option>' +
    App.CATEGORIES.map(([v, l]) => '<option value="' + v + '">' + esc(l) + '</option>').join('');
  if (role !== 'hod') {
    const { data } = await sb.from('departments').select('id, name').order('name');
    $('#fDept').innerHTML = '<option value="">All departments</option>' +
      (data || []).map((d) => '<option value="' + d.id + '">' + esc(d.name) + '</option>').join('');
    $('#fDept').hidden = false;
  }
  // Complaints against the HOD / Principal (a HOD never sees these)
  if (role !== 'hod') {
    $('#fAgainst').innerHTML = '<option value="">Complaint against: all</option>' +
      '<option value="leaders">Against HOD / Principal</option>' +
      '<option value="hod">Against HOD only</option>' +
      (role === 'management' ? '<option value="principal">Against Principal only</option>' : '') +
      '<option value="other">Other (facility / faculty)</option>';
    $('#fAgainst').hidden = false;
  }
  ['fSearch', 'fLevel', 'fStatus', 'fCategory', 'fPrio', 'fDept', 'fAgainst'].forEach((id) => {
    $('#' + id).addEventListener('input', render);
    $('#' + id).addEventListener('change', render);
  });
  $('#refreshBtn').addEventListener('click', () => load());

  // ---------- helpers ----------
  const idOf = (c) => {
    const x = c.complaint_identity;
    return Array.isArray(x) ? x[0] : x;
  };
  const isMine = (c) => c.current_level === role;
  const isLeaderComplaint = (c) => c.against === 'hod' || c.against === 'principal';
  const awaitingReply = (c) => App.isOpen(c) && isMine(c) && !c.responded_at;

  function studentLine(idn) {
    if (!idn || !idn.student_name) return null;
    return idn.student_name +
      (idn.student_roll ? ' (' + idn.student_roll + ')' : '') +
      (idn.student_course ? ' - ' + idn.student_course : '');
  }

  function sortFn(a, b) {
    const ao = App.isOpen(a), bo = App.isOpen(b);
    if (ao !== bo) return ao ? -1 : 1;                                    // open complaints first
    if (!ao) return new Date(b.updated_at) - new Date(a.updated_at);       // closed: newest first
    if ((a.priority === 'high') !== (b.priority === 'high')) return a.priority === 'high' ? -1 : 1; // High Priority on top
    if (isMine(a) !== isMine(b)) return isMine(a) ? -1 : 1;
    if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
    return new Date(a.created_at) - new Date(b.created_at);                // oldest first
  }

  // ---------- load ----------
  async function load(silent) {
    if (!silent) $('#list').innerHTML = '<div class="loading"><span class="spinner"></span> Loading...</div>';
    try {
      await App.runEscalation();
      state.hours = await App.getEscalationHours();
      const { data, error } = await sb.from('complaints')
        .select('*, complaint_identity(student_name, student_roll, student_course), departments(name)')
        .order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      state.all = data || [];
      render();
    } catch (err) {
      $('#list').innerHTML = '<div class="alert alert-bad">' + App.icon('alert') + '<div>' + esc(App.errMsg(err)) + '</div></div>';
    }
  }

  // ---------- render ----------
  function renderStats() {
    const mineOpen = state.all.filter((c) => App.isOpen(c) && isMine(c));
    const stats = [
      ['s-main', mineOpen.length, 'clipboard', 'Pending with me'],
      ['s-high', mineOpen.filter((c) => c.priority === 'high').length, 'alert', 'High Priority'],
      ['s-late', state.all.filter(awaitingReply).length, 'clock', 'Reply pending'],
      ['s-ok', state.all.filter((c) => c.status === 'resolved').length, 'checkCircle', 'Resolved'],
    ];
    $('#stats').innerHTML = stats.map(([cls, n, ic, label]) =>
      '<div class="stat ' + cls + '"><b>' + n + '</b><span>' + App.icon(ic) + esc(label) + '</span></div>').join('');

    const esc2 = state.all.filter((c) => App.isOpen(c) && isMine(c) && c.escalated).length;
    const lead = role !== 'hod' ? state.all.filter((c) => App.isOpen(c) && isMine(c) && isLeaderComplaint(c)).length : 0;
    const overdueTop = role === 'management'
      ? state.all.filter((c) => { const d = App.deadlineInfo(c, state.hours); return d && d.overdue && isMine(c); }).length
      : 0;
    $('#notice').innerHTML =
      (lead
        ? '<div class="alert alert-high">' + App.icon('target') + '<div><b>' + lead + '</b> complaint(s) against the ' +
          (role === 'management' ? 'HOD / Principal' : 'HOD') + ' are with you. The student&rsquo;s identity always stays hidden in these complaints.</div></div>'
        : '') +
      (overdueTop
        ? '<div class="alert alert-bad">' + App.icon('clock') + '<div><b>' + overdueTop + '</b> complaint(s) are overdue for your reply. A reply is mandatory, even if the problem is not solved yet.</div></div>'
        : '') +
      (role !== 'hod' && esc2
        ? '<div class="alert alert-warn">' + App.icon('arrowUp') + '<div><b>' + esc2 + '</b> complaint(s) reached you because the lower level did not reply in time.</div></div>'
        : '');
  }

  function filtered() {
    const q = $('#fSearch').value.trim().toLowerCase();
    const lvl = $('#fLevel').value, st = $('#fStatus').value, cat = $('#fCategory').value;
    const pr = $('#fPrio').value, dept = $('#fDept').value, ag = $('#fAgainst').value;
    return state.all.filter((c) => {
      if (lvl === 'mine' && !isMine(c)) return false;
      if (st === 'open' ? !App.isOpen(c) : (st && c.status !== st)) return false;
      if (cat && c.category !== cat) return false;
      if (pr && c.priority !== pr) return false;
      if (dept && String(c.department_id) !== dept) return false;
      if (ag === 'leaders' ? !isLeaderComplaint(c) : (ag === 'other' ? isLeaderComplaint(c) : (ag && c.against !== ag))) return false;
      if (q && !(c.code + ' ' + c.subject + ' ' + c.description).toLowerCase().includes(q)) return false;
      return true;
    }).sort(sortFn);
  }

  function timerBadge(c) {
    const d = App.deadlineInfo(c, state.hours);
    if (!d) return '';
    return d.overdue
      ? '<span class="badge b-overdue">' + App.icon('clock') + 'Reply overdue</span>'
      : '<span class="badge b-timer">' + App.icon('clock') + 'Reply due in ' + esc(d.label) + '</span>';
  }

  function render() {
    renderStats();
    const list = $('#list');
    const rows = filtered();
    if (!rows.length) {
      list.innerHTML = '<div class="card empty">' + App.icon('inbox') + 'No complaints match these filters.</div>';
      return;
    }
    list.innerHTML = rows.map((c) => {
      const idn = idOf(c);
      const cls = [c.priority === 'high' && App.isOpen(c) ? 'is-high' : '', c.status === 'resolved' ? 'is-resolved' : '', c.escalated && App.isOpen(c) ? 'is-escalated' : ''].join(' ');
      return '<button type="button" class="item ' + cls + '" data-id="' + c.id + '">' +
        '<div class="row between"><span class="code">' + esc(c.code) + '</span><span class="badge b-' + c.status + '">' + esc(App.STATUS[c.status]) + '</span></div>' +
        '<div class="title">' + esc(c.subject) + '</div>' +
        '<p class="desc">' + esc(c.description) + '</p>' +
        '<div class="meta">' +
        (c.priority === 'high' ? '<span class="badge b-high">' + App.icon('alert') + 'High Priority</span>' : '') +
        (c.escalated ? '<span class="badge b-esc">' + App.icon('arrowUp') + 'Escalated</span>' : '') +
        (isLeaderComplaint(c) ? '<span class="badge b-lilac">' + App.icon('target') + 'Against ' + esc(App.AGAINST_LABEL[c.against]) + '</span>' : '') +
        timerBadge(c) +
        '<span>' + esc(App.CATEGORY_LABEL[c.category] || c.category) + '</span>' +
        '<span>' + esc((c.departments && c.departments.name) || '-') + '</span>' +
        '<span>' + esc(App.fmtDate(c.created_at)) + '</span>' +
        '<span>' + (idn && idn.student_name ? esc(idn.student_name) : App.icon('lock') + ' Anonymous') + '</span>' +
        (!isMine(c) && App.isOpen(c) ? '<span class="badge b-neutral">Now with: ' + esc(App.LEVEL[c.current_level]) + '</span>' : '') +
        '</div></button>';
    }).join('');
    $$('.item', list).forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.id)));
  }

  // ---------- detail ----------
  function nextStatus(c) {
    return { submitted: 'under_review', under_review: 'in_progress', in_progress: 'resolved' }[c.status] || 'under_review';
  }
  function forwardTarget() { return role === 'hod' ? 'Principal' : 'College Management'; }

  function deadlineAlert(d) {
    if (!d) return '';
    let text, cls;
    if (d.overdue) {
      cls = 'alert-bad';
      text = d.top
        ? 'Your reply is overdue by <b>' + esc(d.label) + '</b>. There is no higher level, so please reply as soon as possible.'
        : 'The reply deadline has passed (by <b>' + esc(d.label) + '</b>). The complaint is about to move to the next level.';
    } else {
      cls = 'alert-info';
      text = d.top
        ? 'Please reply within <b>' + esc(d.label) + '</b>.'
        : 'A reply is due in <b>' + esc(d.label) + '</b>. After that the complaint is escalated automatically.';
    }
    return '<div class="alert ' + cls + '">' + App.icon('clock') + '<div>' + text + '</div></div>';
  }

  async function openDetail(id) {
    const c = state.all.find((x) => x.id === id);
    if (!c) return;
    const sheet = App.openSheet('<div class="loading"><span class="spinner"></span></div>');
    const [upd, files] = await Promise.all([
      sb.from('complaint_updates').select('*').eq('complaint_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
      sb.from('complaint_files').select('*').eq('complaint_id', id).order('created_at', { ascending: true }),
    ]);

    const open = App.isOpen(c);
    const canAct = open && (role !== 'hod' || c.current_level === 'hod');
    const canForward = canAct && role !== 'management';
    const idn = idOf(c);
    const sLine = studentLine(idn);
    const d = App.deadlineInfo(c, state.hours);

    sheet.innerHTML =
      '<div class="sheet-head"><div><div class="item"><span class="code">' + esc(c.code) + '</span></div>' +
      '<h2>' + esc(c.subject) + '</h2></div>' + App.CLOSE_BTN + '</div>' +
      '<div class="row" style="margin-bottom:10px"><span class="badge b-' + c.status + '">' + esc(App.STATUS[c.status]) + '</span>' +
      (c.priority === 'high' ? '<span class="badge b-high">' + App.icon('alert') + 'High Priority</span>' : '') +
      (c.escalated ? '<span class="badge b-esc">' + App.icon('arrowUp') + 'Escalated x' + esc(c.escalation_count) + '</span>' : '') +
      (open ? '<span class="badge b-neutral">Now with: ' + esc(App.LEVEL[c.current_level]) + '</span>' : '') + '</div>' +
      (c.priority === 'high' && open ? '<div class="alert alert-high">' + App.icon('alert') + '<div>This complaint may be related to safety or an emergency. Please look into it urgently.</div></div>' : '') +
      deadlineAlert(d) +
      '<dl class="kv">' +
      '<dt>Student</dt><dd>' + (sLine ? esc(sLine) : App.icon('lock') + ' Anonymous <span class="muted">(identity hidden)</span>') + '</dd>' +
      '<dt>Department</dt><dd>' + esc((c.departments && c.departments.name) || '-') + '</dd>' +
      '<dt>Category</dt><dd>' + esc(App.CATEGORY_LABEL[c.category] || c.category) + '</dd>' +
      '<dt>Complaint against</dt><dd>' + esc(App.AGAINST_LABEL[c.against] || c.against) + '</dd>' +
      '<dt>Submitted</dt><dd>' + esc(App.fmtDateTime(c.created_at)) + '</dd>' +
      (c.is_public ? '<dt>Visibility</dt><dd>Public &middot; ' + esc(c.upvote_count) + ' other student(s) face the same problem</dd>' : '') +
      '</dl>' +
      '<div class="desc-box" style="margin-top:10px">' + esc(c.description) + '</div>' +
      '<div class="section-title">Proof</div><div id="dFiles"></div>' +
      '<div class="section-title">History</div>' + App.timelineHTML(upd.data, 'staff') +
      (c.feedback_satisfied !== null && c.feedback_satisfied !== undefined
        ? '<div class="section-title">Student feedback</div><div class="alert ' + (c.feedback_satisfied ? 'alert-ok' : 'alert-warn') + '">' +
          App.icon(c.feedback_satisfied ? 'smile' : 'frown') + '<div>' + (c.feedback_satisfied ? 'Satisfied' : 'Not satisfied') +
          (c.feedback_comment ? ' - ' + esc(c.feedback_comment) : '') + '</div></div>'
        : '') +
      (canAct
        ? '<div class="section-title">Take action</div><div class="card flat">' +
          (role === 'management'
            ? '<div class="alert alert-info">' + App.icon('info') + '<div>A reply is mandatory. If the problem is not solved, explain the reason and the next steps for the student.</div></div>'
            : '') +
          '<div class="field"><label for="aStatus">New status</label><select id="aStatus">' +
          ['under_review', 'in_progress', 'resolved', 'rejected'].map((s) => '<option value="' + s + '"' + (s === nextStatus(c) ? ' selected' : '') + '>' + esc(App.STATUS[s]) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label for="aRemark">Reply for the student <span class="req">*</span></label>' +
          '<textarea id="aRemark" maxlength="1000" placeholder="For example: The lab computers will be repaired by tomorrow."></textarea>' +
          '<div class="hint">Please give the reason when rejecting a complaint. The student can read this reply on their dashboard.</div></div>' +
          '<button class="btn btn-primary btn-block" id="aSave" type="button">' + App.icon('check') + ' Save</button>' +
          (canForward ? '<button class="btn btn-warn btn-block" id="aForward" type="button" style="margin-top:10px">' + App.icon('arrowUp') + ' Forward to ' + esc(forwardTarget()) + '</button>' : '') +
          '</div>'
        : (open ? '<div class="alert alert-info" style="margin-top:14px">' + App.icon('info') + '<div>This complaint is now with <b>' + esc(App.LEVEL[c.current_level]) + '</b>. You can view it but cannot act on it.</div></div>' : '')) +
      '<p class="hint" style="margin-top:14px">Complaints cannot be deleted. The full record is always kept safe.</p>';

    App.renderFiles($('#dFiles', sheet), files.data);

    if (canAct) {
      $('#aSave', sheet).addEventListener('click', async (ev) => {
        const remark = $('#aRemark', sheet).value.trim();
        if (remark.length < 3) return App.toast('A reply for the student is required.', 'bad');
        const btn = ev.currentTarget;
        App.setBusy(btn, true, 'Saving...');
        try {
          const { error } = await sb.rpc('act_on_complaint', { p_id: c.id, p_status: $('#aStatus', sheet).value, p_remark: remark });
          if (error) throw error;
          App.toast('Status updated. The student can see it now.', 'ok');
          App.closeSheet();
          load(true);
        } catch (err) { App.toast(App.errMsg(err), 'bad'); App.setBusy(btn, false); }
      });
    }
    if (canForward) {
      $('#aForward', sheet).addEventListener('click', async (ev) => {
        if (!window.confirm('Forward this complaint to ' + forwardTarget() + '?')) return;
        const btn = ev.currentTarget;
        App.setBusy(btn, true, 'Forwarding...');
        try {
          const { error } = await sb.rpc('forward_complaint', { p_id: c.id, p_remark: $('#aRemark', sheet).value });
          if (error) throw error;
          App.toast('The complaint was forwarded to ' + forwardTarget() + '.', 'ok');
          App.closeSheet();
          load(true);
        } catch (err) { App.toast(App.errMsg(err), 'bad'); App.setBusy(btn, false); }
      });
    }
  }

  // ---------- Super Admin tabs (management only) ----------
  if (role === 'management' && window.AdminPanel) window.AdminPanel.init({ profile, onSettingsChanged: () => load(true) });

  // ---------- start ----------
  await load();
  setInterval(() => { if (!document.hidden && !document.getElementById('sheetOverlay')) load(true); }, 90000);
})();
