/* student.js - Student panel: new complaint, my complaints (status tracking), public wall */
(async function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc } = App;

  if (!App.configured || !App.sb) { App.showSetupNeeded(); return; }
  const sb = App.sb;
  const cfg = App.cfg;
  const MAX_FILES = cfg.MAX_FILES || 5;
  const MAX_MB = cfg.MAX_FILE_MB || 8192;
  const OK_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf',
  ];

  const ctx = await App.requireUser(['student']).catch(() => null);
  if (!ctx) return;
  const profile = ctx.profile;
  App.initTopbar(profile, [profile.roll_no, profile.course].filter(Boolean).join(' · ') || 'Student Panel');

  $('#hello').textContent = 'Welcome, ' + ((profile.full_name || '').split(' ')[0] || 'Student');

  const state = { files: [], keywords: [], mine: [], wall: [], myUpvotes: new Set(), hours: 24 };

  // "8192 MB" -> "8 GB"
  function fmtLimit(mb) {
    if (mb >= 1024) { const g = mb / 1024; return (Number.isInteger(g) ? g : g.toFixed(1)) + ' GB'; }
    return mb + ' MB';
  }

  // ---------- remember which updates were already seen (this device only) ----------
  const seen = {
    get(id) { try { return localStorage.getItem('rdg_seen_' + id); } catch (e) { return null; } },
    set(id, v) { try { localStorage.setItem('rdg_seen_' + id, v); } catch (e) { /* ignore */ } },
  };
  function hasNewUpdate(c) {
    if (new Date(c.updated_at) <= new Date(c.created_at)) return false; // no action taken yet
    const s = seen.get(c.id);
    return !s || new Date(c.updated_at) > new Date(s);
  }

  // ---------- tabs ----------
  function showTab(name) {
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    ['new', 'mine', 'wall'].forEach((n) => { $('#tab-' + n).hidden = n !== name; });
    if (name === 'mine') loadMine();
    if (name === 'wall') loadWall();
    window.scrollTo({ top: 0 });
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // =====================================================================
  //  NEW COMPLAINT
  // =====================================================================
  $('#fCategory').innerHTML = '<option value="">Select a category</option>' +
    App.CATEGORIES.map(([v, l]) => '<option value="' + v + '">' + esc(l) + '</option>').join('');
  $('#fAgainst').innerHTML = App.AGAINST.map(([v, l]) => '<option value="' + v + '">' + esc(l) + '</option>').join('');

  // Departments for routing
  (async function loadDepartments() {
    try {
      const { data, error } = await sb.from('departments').select('id, name').order('name');
      if (error) throw error;
      $('#fDept').innerHTML = '<option value="">Select a department</option>' +
        (data || []).map((d) => '<option value="' + d.id + '">' + esc(d.name) + '</option>').join('');
    } catch (e) {
      $('#fDept').innerHTML = '<option value="">Could not load departments</option>';
    }
  })();

  function currentText() { return $('#fSubject').value + ' ' + $('#fDesc').value; }

  function refreshRules() {
    const against = $('#fAgainst').value;
    const high = App.isHighPriority($('#fCategory').value, currentText(), state.keywords);
    const anon = $('#fAnon'), pub = $('#fPublic');

    // High priority alert
    $('#prioAlert').innerHTML = high
      ? '<div class="alert alert-high">' + App.icon('alert') + '<div><b>High Priority:</b> This complaint will be treated as urgent and shown at the top of the Principal’s dashboard.</div></div>'
      : '';

    // Department is not needed for complaints about the Principal
    const needDept = against !== 'principal';
    $('#deptField').hidden = !needDept;

    // Anonymous (forced ON and locked for complaints against HOD / Principal)
    const forced = against === 'hod' || against === 'principal';
    if (forced) anon.checked = true;
    anon.disabled = forced;
    $('#anonBox').classList.toggle('locked', forced);
    $('#anonText').textContent = forced
      ? 'Your identity is hidden automatically for this complaint, for your safety.'
      : 'The complaint is visible to the HOD / Principal, but your name and roll number are not.';

    // Hint about routing
    $('#againstHint').textContent = {
      facility: '',
      faculty: 'This complaint goes to the HOD of the selected department.',
      hod: 'This complaint goes directly to the Principal. The HOD will not be able to see it.',
      principal: 'This complaint goes directly to the College Management. The Principal and HODs will not see it.',
    }[against] || '';

    // Public only for general facility problems
    const canPublic = against === 'facility' && !high;
    if (!canPublic) pub.checked = false;
    pub.disabled = !canPublic;
    $('#pubBox').classList.toggle('locked', !canPublic);
    $('#pubText').textContent = canPublic
      ? 'For common problems (canteen, Wi-Fi...). Other students can see the complaint and proof and press "I also face this". Your name is never shown.'
      : (high
        ? 'High Priority and sensitive complaints stay private and cannot be made public.'
        : 'Complaints about a teacher, HOD or Principal stay private and cannot be made public.');
  }
  ['fCategory', 'fAgainst', 'fSubject', 'fDesc'].forEach((id) => {
    $('#' + id).addEventListener('input', refreshRules);
    $('#' + id).addEventListener('change', refreshRules);
  });
  $('#fDesc').addEventListener('input', () => { $('#descCount').textContent = $('#fDesc').value.length; });

  // ---------- proof files ----------
  function updateFileHint() {
    $('#fileHint').textContent = 'Up to ' + MAX_FILES + ' files, each up to ' + fmtLimit(MAX_MB) + '. ' +
      'Photos are resized automatically and location data is removed. ' +
      '(' + state.files.length + ' / ' + MAX_FILES + ' selected)';
  }
  function renderFiles() {
    const box = $('#fileList');
    if (!state.files.length) { box.innerHTML = ''; updateFileHint(); return; }
    box.innerHTML = '<div class="files" style="margin-bottom:8px">' + state.files.map((f, i) => {
      const thumb = f.file.type.startsWith('image/')
        ? '<img src="' + esc(f.url) + '" alt="Selected photo">'
        : f.file.type.startsWith('video/')
          ? '<video src="' + esc(f.url) + '" muted preload="metadata"></video>'
          : '<div class="pdf">' + App.icon('file') + '<span>PDF</span></div>';
      return '<div class="file">' + thumb +
        '<div class="fname">' + esc(f.file.name.length > 20 ? f.file.name.slice(0, 17) + '...' : f.file.name) + ' · ' + esc(App.fmtSize(f.file.size)) + '</div>' +
        '<button type="button" class="rm" data-rm="' + i + '">Remove</button></div>';
    }).join('') + '</div>';
    $$('[data-rm]', box).forEach((b) => b.addEventListener('click', () => {
      const [removed] = state.files.splice(Number(b.dataset.rm), 1);
      if (removed) URL.revokeObjectURL(removed.url);
      renderFiles();
    }));
    updateFileHint();
  }
  function addFiles(list) {
    for (const file of Array.from(list || [])) {
      if (state.files.length >= MAX_FILES) { App.toast('You can upload at most ' + MAX_FILES + ' files.', 'bad'); break; }
      if (!OK_TYPES.includes(file.type)) { App.toast('"' + file.name + '" is not an allowed file type. Please choose a photo, video or PDF.', 'bad'); continue; }
      if (file.size > MAX_MB * 1048576) { App.toast('"' + file.name + '" is larger than ' + fmtLimit(MAX_MB) + '.', 'bad'); continue; }
      state.files.push({ file, url: URL.createObjectURL(file) });
    }
    renderFiles();
  }
  [['btnCamera', 'inCamera'], ['btnVideo', 'inVideo'], ['btnGallery', 'inGallery']].forEach(([b, i]) => {
    $('#' + b).addEventListener('click', () => $('#' + i).click());
    $('#' + i).addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  });

  // ---------- submit ----------
  function resetForm() {
    $('#cForm').reset();
    state.files.forEach((f) => URL.revokeObjectURL(f.url));
    state.files = [];
    $('#descCount').textContent = '0';
    renderFiles();
    refreshRules();
  }

  function setProgress(pct, label) {
    $('#progress').hidden = false;
    $('#progressLabel').hidden = false;
    $('#progressBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
    $('#progressLabel').textContent = label;
  }
  function hideProgress() {
    $('#progress').hidden = true;
    $('#progressLabel').hidden = true;
    $('#progressBar').style.width = '0';
  }

  $('#cForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = $('#fCategory').value;
    const against = $('#fAgainst').value;
    const subject = $('#fSubject').value.trim();
    const description = $('#fDesc').value.trim();
    const dept = $('#fDept').value;
    if (!category) return App.toast('Please select a category.', 'bad');
    if (against !== 'principal' && !dept) return App.toast('Please select the department concerned.', 'bad');
    if (subject.length < 5) return App.toast('The subject must be at least 5 characters long.', 'bad');
    if (description.length < 10) return App.toast('Please describe the problem in at least 10 characters.', 'bad');

    const btn = $('#submitBtn');
    App.setBusy(btn, true, 'Submitting...');
    try {
      const { data, error } = await sb.rpc('submit_complaint', {
        p_category: category, p_against: against, p_subject: subject, p_description: description,
        p_is_public: $('#fPublic').checked, p_anonymous: $('#fAnon').checked,
        p_department_id: against === 'principal' ? null : Number(dept),
      });
      if (error) throw error;

      // Proof upload (the complaint itself is already saved)
      let failed = 0;
      const total = state.files.length;
      for (let i = 0; i < total; i++) {
        const label = (frac) => 'Uploading file ' + (i + 1) + ' of ' + total + ' - ' + Math.round(frac * 100) + '%';
        setProgress((i / total) * 100, label(0) + '. Please keep this page open.');
        try {
          const raw = state.files[i].file;
          const f = await App.prepareFile(raw, 1600);
          const path = data.id + '/' + f.name;
          await App.uploadBig('complaint-proofs', path, f, (frac) => {
            setProgress(((i + frac) / total) * 100, label(frac) + '. Please keep this page open.');
          });
          const ext = f.name.split('.').pop();
          const ins = await sb.from('complaint_files').insert({
            complaint_id: data.id, path, file_name: 'Proof-' + (i + 1) + '.' + ext, mime_type: f.type, size_bytes: f.size,
          });
          if (ins.error) throw ins.error;
        } catch (err) { failed++; console.error('upload failed', err); }
      }
      if (total) setProgress(100, failed ? 'Upload finished with errors.' : 'Upload complete.');

      showDone(data, total, failed);
      resetForm();
      loadMine(true);
    } catch (err) {
      App.toast(App.errMsg(err), 'bad');
    } finally {
      App.setBusy(btn, false);
      setTimeout(hideProgress, 600);
    }
  });

  function showDone(res, total, failed) {
    $('#cForm').hidden = true;
    const card = $('#doneCard');
    card.hidden = false;
    card.innerHTML =
      '<div class="center">' +
      '<div style="color:var(--mint-ink)">' + App.icon('checkCircle').replace('class="ico"', 'class="ico" style="width:56px;height:56px"') + '</div>' +
      '<h2 style="margin-top:8px">Complaint submitted</h2>' +
      '<p class="muted">Your complaint ID is</p>' +
      '<p style="font-size:1.6rem;font-weight:800;color:var(--primary-hover);letter-spacing:.04em;margin:0 0 8px">' + esc(res.code) + '</p>' +
      '<p class="muted small">Please keep this ID for your records. You can follow the live status under "My Complaints", and we will also send you an e-mail whenever the status changes.</p>' +
      (res.priority === 'high' ? '<div class="alert alert-high" style="text-align:left">' + App.icon('alert') + '<div>This complaint has been marked as High Priority.</div></div>' : '') +
      (failed ? '<div class="alert alert-warn" style="text-align:left">' + App.icon('alert') + '<div>' + failed + ' of ' + total + ' files could not be uploaded. Your complaint has been saved; if needed, you can submit a new complaint with the missing proof.</div></div>' : '') +
      '<div class="row" style="justify-content:center;margin-top:12px">' +
      '<button class="btn btn-primary" id="doneTrack" type="button">' + App.icon('clipboard') + ' View status</button>' +
      '<button class="btn" id="doneAnother" type="button">' + App.icon('plus') + ' Submit another complaint</button></div></div>';
    $('#doneTrack').addEventListener('click', () => { backToForm(); showTab('mine'); });
    $('#doneAnother').addEventListener('click', backToForm);
    window.scrollTo({ top: 0 });
  }
  function backToForm() { $('#doneCard').hidden = true; $('#cForm').hidden = false; }

  // =====================================================================
  //  MY COMPLAINTS
  // =====================================================================
  function levelLine(c) {
    if (!App.isOpen(c)) return '';
    return 'With: ' + (App.LEVEL[c.current_level] || '');
  }
  function awaitingTop(c) {
    const d = App.deadlineInfo(c, state.hours);
    return !!(d && d.top && d.overdue);
  }

  async function loadMine(silent) {
    const list = $('#mineList');
    if (!silent) list.innerHTML = '<div class="loading"><span class="spinner"></span> Loading...</div>';
    try {
      const { data, error } = await sb.from('complaint_owners').select('complaints(*)');
      if (error) throw error;
      state.mine = (data || []).map((r) => r.complaints).filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderMine();
      updateNotice();
    } catch (err) {
      list.innerHTML = '<div class="alert alert-bad">' + App.icon('alert') + '<div>' + esc(App.errMsg(err)) + '</div></div>';
    }
  }

  function updateNotice() {
    const n = state.mine.filter(hasNewUpdate).length;
    $('#mineDot').hidden = n === 0;
    $('#mineDot').textContent = n;
    $('#notice').innerHTML = n
      ? '<div class="alert alert-ok">' + App.icon('bell') + '<div>You have <b>' + n + '</b> complaint' + (n === 1 ? '' : 's') + ' with a new update or reply. Open "My Complaints" to read it.</div></div>'
      : '';
  }

  function renderMine() {
    const list = $('#mineList');
    if (!state.mine.length) {
      list.innerHTML = '<div class="card empty">' + App.icon('inbox') + 'You have not submitted any complaints yet.</div>';
      return;
    }
    list.innerHTML = state.mine.map((c) => {
      const cls = [c.priority === 'high' ? 'is-high' : '', c.status === 'resolved' ? 'is-resolved' : '', c.escalated && App.isOpen(c) ? 'is-escalated' : ''].join(' ');
      return '<button type="button" class="item ' + cls + '" data-id="' + c.id + '">' +
        '<div class="row between"><span class="code">' + esc(c.code) + '</span>' +
        '<span class="badge b-' + c.status + '">' + esc(App.STATUS[c.status]) + '</span></div>' +
        '<div class="title">' + esc(c.subject) + '</div>' +
        '<div class="meta">' +
        '<span>' + esc(App.CATEGORY_LABEL[c.category] || c.category) + '</span>' +
        '<span>' + esc(App.fmtDate(c.created_at)) + '</span>' +
        (levelLine(c) ? '<span>' + esc(levelLine(c)) + '</span>' : '') +
        (c.priority === 'high' ? '<span class="badge b-high">' + App.icon('alert') + ' High Priority</span>' : '') +
        (c.is_anonymous ? '<span class="badge b-neutral">' + App.icon('lock') + ' Anonymous</span>' : '') +
        (c.is_public ? '<span class="badge b-neutral">' + App.icon('globe') + ' Public</span>' : '') +
        (awaitingTop(c) ? '<span class="badge b-overdue">' + App.icon('clock') + ' Awaiting College Management reply</span>' : '') +
        (hasNewUpdate(c) ? '<span class="badge b-new">' + App.icon('bell') + ' New update</span>' : '') +
        '</div></button>';
    }).join('');
    $$('.item', list).forEach((b) => b.addEventListener('click', () => openMine(b.dataset.id)));
  }

  function stepperHTML(status) {
    const steps = [
      ['submitted', 'Submitted', 'message'],
      ['under_review', 'Under Review', 'eye'],
      ['in_progress', 'In Progress', 'activity'],
      ['resolved', 'Resolved', 'checkCircle'],
    ];
    const rejected = status === 'rejected';
    const idx = rejected ? 0 : steps.findIndex((s) => s[0] === status);
    return '<div class="stepper">' + steps.map((s, i) => {
      let cls = '', label = s[1], icon = s[2];
      if (rejected) {
        if (i === 0) cls = 'done';
        if (i === 3) { cls = 'bad now'; label = 'Rejected'; icon = 'xCircle'; }
      } else {
        if (i <= idx) cls = 'done';
        if (i === idx) cls += ' now';
      }
      return '<div class="step ' + cls + '"><span class="dotc">' + App.icon(icon) + '</span>' + esc(label) + '</div>';
    }).join('') + '</div>';
  }

  async function openMine(id) {
    const c = state.mine.find((x) => x.id === id);
    if (!c) return;
    const sheet = App.openSheet('<div class="loading"><span class="spinner"></span></div>');
    const [upd, files] = await Promise.all([
      sb.from('complaint_updates').select('*').eq('complaint_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
      sb.from('complaint_files').select('*').eq('complaint_id', id).order('created_at', { ascending: true }),
    ]);
    seen.set(id, c.updated_at);
    renderMine(); updateNotice();

    const last = (upd.data || []).filter((u) => u.kind === 'action').slice(-1)[0];
    sheet.innerHTML =
      '<div class="sheet-head"><div><div class="code" style="font-weight:800;color:var(--primary-hover)">' + esc(c.code) + '</div>' +
      '<h2>' + esc(c.subject) + '</h2></div>' + App.CLOSE_BTN + '</div>' +
      '<div class="row" style="margin-bottom:6px"><span class="badge b-' + c.status + '">' + esc(App.STATUS[c.status]) + '</span>' +
      (c.priority === 'high' ? '<span class="badge b-high">' + App.icon('alert') + ' High Priority</span>' : '') +
      (c.is_anonymous ? '<span class="badge b-neutral">' + App.icon('lock') + ' Anonymous</span>' : '') + '</div>' +
      stepperHTML(c.status) +
      (c.status === 'rejected' && last && last.remark ? '<div class="alert alert-bad">' + App.icon('xCircle') + '<div><b>Reason for rejection:</b> ' + esc(last.remark) + '</div></div>' : '') +
      (c.status === 'resolved' && last && last.remark ? '<div class="alert alert-ok">' + App.icon('checkCircle') + '<div><b>Reply:</b> ' + esc(last.remark) + '</div></div>' : '') +
      (c.escalated && App.isOpen(c) ? '<div class="alert alert-warn">' + App.icon('arrowUp') + '<div>No reply was received in time, so your complaint has been escalated to a higher authority.</div></div>' : '') +
      (awaitingTop(c) ? '<div class="alert alert-warn">' + App.icon('clock') + '<div>This complaint is awaiting a reply from the College Management.</div></div>' : '') +
      '<div class="section-title">Complaint details</div>' +
      '<dl class="kv">' +
      '<dt>Category</dt><dd>' + esc(App.CATEGORY_LABEL[c.category] || c.category) + '</dd>' +
      '<dt>About</dt><dd>' + esc(App.AGAINST_LABEL[c.against] || c.against) + '</dd>' +
      '<dt>Submitted on</dt><dd>' + esc(App.fmtDateTime(c.created_at)) + '</dd>' +
      (App.isOpen(c) ? '<dt>Currently with</dt><dd>' + esc(App.LEVEL[c.current_level]) + '</dd>' : '') +
      '</dl><div class="desc-box" style="margin-top:10px">' + esc(c.description) + '</div>' +
      '<div class="section-title">Proof</div><div id="mFiles"></div>' +
      '<div class="section-title">Updates and replies</div>' + App.timelineHTML(upd.data, 'student') +
      '<div id="mFeedback"></div>';
    sheet.querySelector('[data-close]').addEventListener('click', App.closeSheet);
    App.renderFiles($('#mFiles', sheet), files.data);
    renderFeedback(sheet, c);
  }

  function renderFeedback(sheet, c) {
    const box = $('#mFeedback', sheet);
    if (c.status !== 'resolved') return;
    if (c.feedback_satisfied !== null && c.feedback_satisfied !== undefined) {
      box.innerHTML = '<div class="section-title">Your feedback</div><div class="alert ' + (c.feedback_satisfied ? 'alert-ok' : 'alert-warn') + '">' +
        App.icon(c.feedback_satisfied ? 'smile' : 'frown') + '<div>' + (c.feedback_satisfied ? 'Satisfied' : 'Not satisfied') +
        (c.feedback_comment ? ' — ' + esc(c.feedback_comment) : '') + '</div></div>';
      return;
    }
    box.innerHTML =
      '<div class="section-title">Feedback</div><div class="card flat"><h3>Are you satisfied with the solution?</h3>' +
      '<div class="row"><button class="btn btn-primary" type="button" data-fb="1">' + App.icon('smile') + ' Satisfied</button>' +
      '<button class="btn btn-warn" type="button" data-fb="0">' + App.icon('frown') + ' Not satisfied</button></div>' +
      '<textarea id="fbComment" maxlength="500" placeholder="Anything you would like to add? (optional)" style="margin-top:10px;min-height:70px"></textarea></div>';
    $$('[data-fb]', box).forEach((b) => b.addEventListener('click', async () => {
      App.setBusy(b, true, 'Sending...');
      try {
        const { error } = await sb.rpc('give_feedback', {
          p_id: c.id, p_satisfied: b.dataset.fb === '1', p_comment: $('#fbComment', box).value,
        });
        if (error) throw error;
        App.toast('Thank you for your feedback.', 'ok');
        App.closeSheet();
        loadMine(true);
      } catch (err) { App.toast(App.errMsg(err), 'bad'); App.setBusy(b, false); }
    }));
  }

  // =====================================================================
  //  PUBLIC WALL
  // =====================================================================
  async function loadWall() {
    const list = $('#wallList');
    list.innerHTML = '<div class="loading"><span class="spinner"></span> Loading...</div>';
    try {
      const [w, v] = await Promise.all([
        sb.from('complaints')
          .select('id, code, category, subject, description, status, upvote_count, created_at')
          .eq('is_public', true)
          .order('upvote_count', { ascending: false }).order('created_at', { ascending: false }).limit(100),
        sb.from('upvotes').select('complaint_id'),
      ]);
      if (w.error) throw w.error;
      state.wall = w.data || [];
      state.myUpvotes = new Set((v.data || []).map((r) => r.complaint_id));
      renderWall();
    } catch (err) {
      list.innerHTML = '<div class="alert alert-bad">' + App.icon('alert') + '<div>' + esc(App.errMsg(err)) + '</div></div>';
    }
  }

  function renderWall() {
    const list = $('#wallList');
    if (!state.wall.length) {
      list.innerHTML = '<div class="card empty">' + App.icon('globe') + 'There are no public complaints yet.</div>';
      return;
    }
    const mineIds = new Set(state.mine.map((c) => c.id));
    list.innerHTML = state.wall.map((c) => {
      const mineOne = mineIds.has(c.id);
      const on = state.myUpvotes.has(c.id);
      return '<div class="item" style="cursor:default" data-wid="' + c.id + '">' +
        '<div class="row between"><span class="code">' + esc(c.code) + '</span><span class="badge b-' + c.status + '">' + esc(App.STATUS[c.status]) + '</span></div>' +
        '<div class="title">' + esc(c.subject) + '</div>' +
        '<p class="desc">' + esc(c.description) + '</p>' +
        '<div class="row between"><span class="meta">' + esc(App.CATEGORY_LABEL[c.category] || c.category) + ' · ' + esc(App.fmtDate(c.created_at)) + '</span>' +
        (mineOne
          ? '<span class="badge b-neutral">Your complaint · ' + App.icon('thumb') + ' ' + c.upvote_count + '</span>'
          : '<button type="button" class="upvote ' + (on ? 'on' : '') + '" data-up="' + c.id + '">' + App.icon('thumb') + ' ' + (on ? 'You voted' : 'I also face this') + ' · ' + c.upvote_count + '</button>') +
        '</div></div>';
    }).join('');
    $$('[data-up]', list).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const { data, error } = await sb.rpc('toggle_upvote', { p_id: b.dataset.up });
        if (error) throw error;
        const c = state.wall.find((x) => x.id === b.dataset.up);
        if (c) c.upvote_count = data.count;
        if (data.upvoted) state.myUpvotes.add(b.dataset.up); else state.myUpvotes.delete(b.dataset.up);
        renderWall();
      } catch (err) { App.toast(App.errMsg(err), 'bad'); b.disabled = false; }
    }));
  }

  // ---------- start ----------
  refreshRules();
  updateFileHint();
  App.loadKeywords().then((k) => { state.keywords = k; refreshRules(); });
  App.getEscalationHours().then((h) => { state.hours = h; renderMine(); });
  App.runEscalation();
  loadMine(true);
})();
