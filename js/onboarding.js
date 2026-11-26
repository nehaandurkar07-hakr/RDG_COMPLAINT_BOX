/* onboarding.js - first-login wizard for HOD / Principal / Super Admin.
   Steps: 1 Profile, 2 Address, 3 Verify e-mail + mobile (OTP), 4 Own password.
   The real checks happen on the server (complete_staff_onboarding); this page only guides the user. */
(async function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc } = App;

  if (!App.configured || !App.sb) { App.showSetupNeeded(); return; }
  const sb = App.sb;

  const ctx = await App.requireUser(['hod', 'principal', 'management'], { allowIncomplete: true }).catch(() => null);
  if (!ctx) return;
  const profile = ctx.profile;
  if (!profile.must_change_password) { location.replace('staff.html'); return; }

  App.initTopbar(profile, App.cfg.COLLEGE_NAME || '');
  const settings = await App.getPublicSettings();
  const phoneOtpOn = !!settings.phone_otp;
  let loginEmail = String(ctx.user.email || '').toLowerCase();

  const ROLES = [['principal', 'Principal'], ['hod', 'HOD'], ['management', 'Super Admin']];

  // ---------- state (kept in memory only) ----------
  const st = {
    step: 1,
    name: profile.full_name || '',
    deptId: profile.department_id || '',
    deptName: (profile.departments && profile.departments.name) || '',
    address: profile.address || '',
    district: profile.district || '',
    state: profile.state || 'Maharashtra',
    email: '',
    emailVerified: false,
    pendingEmail: '',
    phone: profile.phone || '',
    phoneVerified: false,
    pendingPhone: '',
    pwSet: '',
  };

  // Reset flow: the person already owns a verified e-mail / mobile
  if (profile.contact_email && profile.contact_email.toLowerCase() === loginEmail) {
    st.email = loginEmail;
    st.emailVerified = true;
  }
  const digits = (s) => String(s || '').replace(/\D/g, '');
  if (phoneOtpOn && ctx.user.phone && ctx.user.phone_confirmed_at && st.phone &&
      digits(ctx.user.phone) === digits(App.normalizePhone(st.phone))) {
    st.phoneVerified = true;
  }

  // ---------- helpers ----------
  function alertIn(n, msg, type) {
    $('#alert' + n).innerHTML = msg
      ? '<div class="alert alert-' + (type || 'bad') + '" role="alert">' +
        App.icon(type === 'ok' ? 'checkCircle' : type === 'info' ? 'info' : 'alert') + '<div>' + esc(msg) + '</div></div>'
      : '';
  }
  function showStep(n) {
    st.step = n;
    [1, 2, 3, 4].forEach((i) => { $('#step' + i).hidden = i !== n; });
    $('#stepDone').hidden = true;
    $$('#wizSteps .wiz-step').forEach((li, idx) => {
      const num = idx + 1;
      li.classList.toggle('is-done', num < n);
      li.classList.toggle('is-now', num === n);
      $('.n', li).innerHTML = num < n ? App.icon('check') : String(num);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (n === 4) renderReview();
  }
  function cooldown(btn, label, seconds) {
    let left = seconds;
    btn.disabled = true;
    btn.textContent = label + ' (' + left + 's)';
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = label; }
      else btn.textContent = label + ' (' + left + 's)';
    }, 1000);
  }
  const titleOf = () => profile.role === 'hod' ? ((st.deptName ? st.deptName + ' ' : '') + 'HOD')
    : (profile.role === 'principal' ? 'Principal' : 'Super Admin');

  // ---------- Step 1: profile ----------
  $('#oName').value = st.name;
  $('#rolePills').innerHTML = ROLES.map(([v, label]) => {
    const mine = v === profile.role;
    return '<button type="button" class="pill" aria-pressed="' + mine + '"' + (mine ? '' : ' disabled') + '>' +
      (mine ? '' : App.icon('lock')) + esc(label) + '</button>';
  }).join('');

  async function setupDepartment() {
    if (profile.role !== 'hod') return;
    $('#deptField').hidden = false;
    if (profile.department_id) {
      $('#deptSelectBox').hidden = true;
      $('#deptLockedBox').hidden = false;
      $('#oDeptLocked').value = st.deptName;
      return;
    }
    try {
      const { data, error } = await sb.rpc('department_options');
      if (error) throw error;
      $('#oDept').innerHTML = '<option value="">Select your department</option>' +
        (data || []).map((d) => '<option value="' + d.id + '"' + (d.taken ? ' disabled' : '') + '>' +
          esc(d.name) + (d.taken ? ' (HOD already registered)' : '') + '</option>').join('');
      if (st.deptId) $('#oDept').value = String(st.deptId);
    } catch (e) {
      $('#oDept').innerHTML = '<option value="">Could not load departments</option>';
      alertIn(1, App.errMsg(e));
    }
  }
  setupDepartment();

  $('#form1').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#oName').value.trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 80) return alertIn(1, 'Please enter your full name (3 to 80 characters).');
    if (profile.role === 'hod' && !profile.department_id) {
      const sel = $('#oDept');
      if (!sel.value) return alertIn(1, 'Please select your department.');
      st.deptId = Number(sel.value);
      st.deptName = sel.options[sel.selectedIndex].text.replace(/\s*\(HOD already registered\)\s*$/, '');
    }
    st.name = name;
    alertIn(1, '');
    showStep(2);
  });

  // ---------- Step 2: address ----------
  $('#oAddress').value = st.address;
  $('#oDistrict').value = st.district;
  $('#oState').innerHTML = App.INDIAN_STATES.map((s) => '<option' + (s === st.state ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  $('#form2').addEventListener('submit', (e) => {
    e.preventDefault();
    const address = $('#oAddress').value.trim().replace(/\s+/g, ' ');
    const district = $('#oDistrict').value.trim().replace(/\s+/g, ' ');
    const state = $('#oState').value;
    if (address.length < 5 || address.length > 200) return alertIn(2, 'Please enter your address (5 to 200 characters).');
    if (district.length < 2) return alertIn(2, 'Please enter your district.');
    if (!state) return alertIn(2, 'Please select your state.');
    st.address = address; st.district = district; st.state = state;
    alertIn(2, '');
    showStep(3);
  });
  $('#back2').addEventListener('click', () => showStep(1));

  // ---------- Step 3: verify e-mail and mobile ----------
  function refreshVerifyUi() {
    // e-mail row
    $('#emailVerified').hidden = !st.emailVerified;
    $('#emailSend').hidden = st.emailVerified;
    $('#emailOtpBox').hidden = st.emailVerified || !st.pendingEmail;
    $('#oEmail').readOnly = st.emailVerified && !!profile.contact_email && st.email === loginEmail && st.email === String(profile.contact_email).toLowerCase();
    // phone row
    const phoneOk = phoneOtpOn ? st.phoneVerified : !!App.normalizePhone($('#oPhone').value);
    $('#phoneVerified').hidden = !(phoneOtpOn && st.phoneVerified);
    $('#phoneSend').hidden = !phoneOtpOn || st.phoneVerified;
    $('#phoneOtpBox').hidden = !phoneOtpOn || st.phoneVerified || !st.pendingPhone;
    $('#toStep4').disabled = !(st.emailVerified && phoneOk);
  }
  $('#oEmail').value = st.email || profile.contact_email || '';
  $('#oPhone').value = st.phone;
  if (!phoneOtpOn) {
    $('#phoneHint').textContent = 'Mobile OTP verification is currently switched off. A 10-digit Indian mobile number is saved with +91.';
  }

  $('#oEmail').addEventListener('input', () => {
    const v = $('#oEmail').value.trim().toLowerCase();
    if (st.emailVerified && v !== st.email) { st.emailVerified = false; }
    if (v !== st.pendingEmail) { st.pendingEmail = ''; }
    refreshVerifyUi();
  });
  $('#oPhone').addEventListener('input', () => {
    const p = App.normalizePhone($('#oPhone').value);
    if (st.phoneVerified && p !== App.normalizePhone(st.phone)) st.phoneVerified = false;
    if (!p || p !== st.pendingPhone) st.pendingPhone = '';
    refreshVerifyUi();
  });

  $('#emailSend').addEventListener('click', async (ev) => {
    const email = $('#oEmail').value.trim().toLowerCase();
    if (!App.EMAIL_RE.test(email) || email.length > 120) return alertIn(3, 'Please enter a valid e-mail address.');
    if (email === loginEmail) return alertIn(3, 'Please enter your own e-mail address, not the temporary login e-mail given by the administrator.');
    const btn = ev.currentTarget;
    App.setBusy(btn, true, 'Sending...');
    try {
      const { error } = await sb.auth.updateUser({ email });
      if (error) throw error;
      st.pendingEmail = email;
      alertIn(3, 'An OTP has been sent to ' + email + '. Please check your inbox (and spam folder).', 'ok');
      App.setBusy(btn, false);
      cooldown(btn, 'Resend OTP', 60);
      refreshVerifyUi();
      $('#emailOtp').value = '';
      $('#emailOtp').focus();
    } catch (err) {
      App.setBusy(btn, false);
      alertIn(3, App.errMsg(err));
    }
  });
  async function verifyEmail(ev) {
    const token = $('#emailOtp').value.replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(token)) return alertIn(3, 'Please enter the 6-digit OTP sent to your e-mail.');
    const btn = $('#emailVerify');
    App.setBusy(btn, true, 'Verifying...');
    try {
      const { error } = await sb.auth.verifyOtp({ email: st.pendingEmail, token, type: 'email_change' });
      if (error) throw error;
      st.email = st.pendingEmail;
      st.emailVerified = true;
      loginEmail = st.email;
      alertIn(3, 'Your e-mail address has been verified.', 'ok');
      try { await sb.auth.refreshSession(); } catch (e) { /* not critical */ }
    } catch (err) {
      alertIn(3, App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
      refreshVerifyUi();
    }
  }
  $('#emailVerify').addEventListener('click', verifyEmail);
  $('#emailOtp').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyEmail(); } });

  $('#phoneSend').addEventListener('click', async (ev) => {
    const phone = App.normalizePhone($('#oPhone').value);
    if (!phone) return alertIn(3, 'Please enter a valid mobile number (10 digits).');
    const btn = ev.currentTarget;
    App.setBusy(btn, true, 'Sending...');
    try {
      const { error } = await sb.auth.updateUser({ phone });
      if (error) throw error;
      st.pendingPhone = phone;
      alertIn(3, 'An OTP has been sent by SMS to ' + phone + '.', 'ok');
      App.setBusy(btn, false);
      cooldown(btn, 'Resend OTP', 60);
      refreshVerifyUi();
      $('#phoneOtp').value = '';
      $('#phoneOtp').focus();
    } catch (err) {
      App.setBusy(btn, false);
      alertIn(3, App.errMsg(err));
    }
  });
  async function verifyPhone() {
    const token = $('#phoneOtp').value.replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(token)) return alertIn(3, 'Please enter the 6-digit OTP sent by SMS.');
    const btn = $('#phoneVerify');
    App.setBusy(btn, true, 'Verifying...');
    try {
      const { error } = await sb.auth.verifyOtp({ phone: st.pendingPhone, token, type: 'phone_change' });
      if (error) throw error;
      st.phone = st.pendingPhone;
      st.phoneVerified = true;
      alertIn(3, 'Your mobile number has been verified.', 'ok');
    } catch (err) {
      alertIn(3, App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
      refreshVerifyUi();
    }
  }
  $('#phoneVerify').addEventListener('click', verifyPhone);
  $('#phoneOtp').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyPhone(); } });

  $('#back3').addEventListener('click', () => showStep(2));
  $('#toStep4').addEventListener('click', () => {
    const p = App.normalizePhone($('#oPhone').value);
    if (!p) return alertIn(3, 'Please enter a valid mobile number (10 digits).');
    st.phone = p;
    alertIn(3, '');
    showStep(4);
  });

  // ---------- Step 4: own password ----------
  App.attachMeter($('#oPw1'), true);
  $('#showPw').addEventListener('change', (e) => {
    $('#oPw1').type = e.target.checked ? 'text' : 'password';
    $('#oPw2').type = e.target.checked ? 'text' : 'password';
  });
  function renderReview() {
    const rows = [
      ['Name', st.name],
      ['Role', titleOf()],
      ['E-mail', st.email],
      ['Mobile', App.normalizePhone(st.phone) || st.phone],
      ['Address', [st.address, st.district, st.state].filter(Boolean).join(', ')],
    ];
    $('#review').innerHTML = rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('');
  }
  $('#back4').addEventListener('click', () => showStep(3));

  $('#form4').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#oPw1').value, pw2 = $('#oPw2').value;
    const chk = App.passwordCheck(pw, true);
    if (!chk.ok) return alertIn(4, 'Your password needs: ' + chk.issues.join(', ') + '.');
    if (pw !== pw2) return alertIn(4, 'The two passwords do not match.');
    const phone = App.normalizePhone(st.phone);
    if (!phone) return alertIn(4, 'Your mobile number is not valid. Please go back and correct it.');

    const btn = $('#activateBtn');
    App.setBusy(btn, true, 'Activating...');
    try {
      if (st.pwSet !== pw) {
        const up = await sb.auth.updateUser({ password: pw });
        if (up.error && !/same password|different from the old/i.test(up.error.message || '')) throw up.error;
        st.pwSet = pw;
      }
      const { error } = await sb.rpc('complete_staff_onboarding', {
        p_name: st.name,
        p_role: profile.role,
        p_department_id: profile.role === 'hod' && !profile.department_id ? Number(st.deptId) : null,
        p_address: st.address,
        p_district: st.district,
        p_state: st.state,
        p_phone: phone,
        p_contact_email: st.email,
      });
      if (error) throw error;
      showDone();
    } catch (err) {
      alertIn(4, App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
    }
  });

  function showDone() {
    $('#oPw1').value = ''; $('#oPw2').value = '';
    [1, 2, 3, 4].forEach((i) => { $('#step' + i).hidden = true; });
    $$('#wizSteps .wiz-step').forEach((li) => { li.classList.add('is-done'); li.classList.remove('is-now'); $('.n', li).innerHTML = App.icon('check'); });
    const card = $('#stepDone');
    card.hidden = false;
    card.innerHTML =
      '<div class="center">' +
      '<div class="brand-mark" style="margin:0 auto 12px;width:56px;height:56px;border-radius:16px">' + App.icon('checkCircle') + '</div>' +
      '<h2>Your account is ready</h2>' +
      '<p class="muted">Welcome, <b>' + esc(st.name) + '</b> (' + esc(titleOf()) + '). From now on sign in with your own e-mail address and the password you just created.</p>' +
      '<button class="btn btn-primary" id="goBtn" type="button">Go to my dashboard ' + App.icon('arrowRight') + '</button>' +
      '</div>';
    $('#goBtn').addEventListener('click', () => location.replace('staff.html'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  refreshVerifyUi();
  showStep(1);
})();
