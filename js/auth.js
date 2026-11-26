/* auth.js - index.html: sign in (password or OTP), student registration, forgot password.
   All security decisions are taken by Supabase Auth and the database; this file only
   guides the user through the steps. */
(async function () {
  'use strict';
  const App = window.App;
  const { $, $$, esc } = App;

  if (!App.configured || !App.sb) { App.showSetupNeeded(); return; }
  const sb = App.sb;

  const views = { login: $('#viewLogin'), register: $('#viewRegister'), forgot: $('#viewForgot') };
  let settings = { phone_otp: false };

  function show(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    $('#pageAlert').innerHTML = '';
    if (name === 'login') ensureCaptcha('login', '#capLogin');
    if (name === 'forgot') ensureCaptcha('forgot', '#capForgot');
    if (name === 'register') ensureCaptcha('register', '#capRegister');
    window.scrollTo({ top: 0 });
  }
  function alertBox(msg, type) {
    const icon = type === 'ok' ? 'checkCircle' : (type === 'info' ? 'info' : 'alert');
    $('#pageAlert').innerHTML = '<div class="alert alert-' + (type || 'bad') + '" role="alert">' + App.icon(icon) + '<div>' + esc(msg) + '</div></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const clearAlert = () => { $('#pageAlert').innerHTML = ''; };

  // ---------- optional captcha (only when a key is set in config.js) ----------
  const caps = {};
  function ensureCaptcha(name, sel) {
    if (!App.captcha.enabled || caps[name]) return;
    caps[name] = App.captcha.mount($(sel));
  }
  function captchaToken(name) {
    if (!App.captcha.enabled) return undefined;
    const t = caps[name] && caps[name].token();
    if (!t) throw new Error('Please complete the "I am not a robot" check first.');
    return t;
  }
  function resetCaptcha(name) { if (caps[name]) caps[name].reset(); }

  App.attachMeter($('#regPass'), false);
  App.attachMeter($('#newPass'), false);

  // "Show password" checkboxes (can control one or two inputs)
  $$('[data-showpass]').forEach((cb) => {
    cb.addEventListener('change', () => {
      [cb.dataset.showpass, cb.dataset.showpass2].filter(Boolean).forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.type = cb.checked ? 'text' : 'password';
      });
    });
  });

  const cooldowns = {};
  function startCooldown(btn, label, sec) {
    clearInterval(cooldowns[btn.id]);
    let left = sec;
    btn.disabled = true;
    btn.textContent = label + ' (' + left + 's)';
    cooldowns[btn.id] = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(cooldowns[btn.id]); btn.disabled = false; btn.textContent = label; }
      else btn.textContent = label + ' (' + left + 's)';
    }, 1000);
  }

  // ---------- tabs ----------
  const goLogin = () => { show('login'); };
  const goRegister = () => { show('register'); setRegStep(1); };
  $('#segLogin').addEventListener('click', goLogin);
  $('#segRegister').addEventListener('click', goRegister);
  $('#segLogin2').addEventListener('click', goLogin);
  $('#segRegister2').addEventListener('click', goRegister);
  $('#toForgot').addEventListener('click', () => {
    const id = $('#loginId').value.trim();
    show('forgot');
    setForgotStep(1);
    if (id.includes('@')) $('#forgotEmail').value = id;
  });
  $('#forgotBack').addEventListener('click', goLogin);

  // =====================================================================
  //  SIGN IN
  // =====================================================================
  const login = { method: 'password', otpSent: false, otpTarget: null };

  function refreshLoginUi() {
    const otp = login.method === 'otp';
    $('#mPassword').setAttribute('aria-selected', String(!otp));
    $('#mOtp').setAttribute('aria-selected', String(otp));
    $('#passBox').hidden = otp;
    $('#otpBox').hidden = !(otp && login.otpSent);
    $('#resendLoginOtp').hidden = !(otp && login.otpSent);
    $('#loginBtn').textContent = !otp ? 'Sign in' : (login.otpSent ? 'Verify and sign in' : 'Send OTP');
  }
  $('#mPassword').addEventListener('click', () => { login.method = 'password'; login.otpSent = false; refreshLoginUi(); });
  $('#mOtp').addEventListener('click', () => { login.method = 'otp'; login.otpSent = false; refreshLoginUi(); });
  $('#loginId').addEventListener('input', () => { if (login.otpSent) { login.otpSent = false; refreshLoginUi(); } });

  // Reads the identifier field: {email} or {phone} or throws a friendly error
  function readIdentifier() {
    const raw = $('#loginId').value.trim();
    if (!raw) throw new Error('Please enter your e-mail address or mobile number.');
    if (raw.includes('@')) {
      const email = raw.toLowerCase();
      if (!App.EMAIL_RE.test(email)) throw new Error('Please enter a valid e-mail address.');
      return { email };
    }
    const phone = App.normalizePhone(raw);
    if (!phone) throw new Error('Please enter a valid e-mail address or a 10-digit mobile number.');
    if (!settings.phone_otp) throw new Error('Signing in with a mobile number is not available yet. Please use your e-mail address.');
    return { phone };
  }

  async function afterSignIn(user, viaOtp) {
    const profile = await App.fetchProfile(user.id);
    if (!profile) {
      await sb.auth.signOut();
      throw new Error('Your profile was not found. Please contact the college.');
    }
    if (profile.is_active === false) {
      await sb.auth.signOut();
      throw new Error('Your account is not active. Please contact the college office.');
    }
    if (viaOtp && profile.role !== 'student') {
      await sb.auth.signOut();
      throw new Error('Staff accounts must sign in with their password.');
    }
    location.replace(App.homeFor(profile));
  }

  async function sendLoginOtp(target) {
    const opts = { shouldCreateUser: false, captchaToken: captchaToken('login') };
    const { error } = await sb.auth.signInWithOtp(target.email ? { email: target.email, options: opts } : { phone: target.phone, options: opts });
    if (error) throw error;
    login.otpSent = true;
    login.otpTarget = target;
    $('#loginOtp').value = '';
    $('#loginOtpHint').textContent = 'A code was sent to ' + (target.email || target.phone) + '. It is valid for a short time only.';
    refreshLoginUi();
    startCooldown($('#resendLoginOtp'), 'Resend OTP', 60);
    $('#loginOtp').focus();
  }
  $('#resendLoginOtp').addEventListener('click', async () => {
    try { await sendLoginOtp(login.otpTarget); alertBox('A new OTP has been sent.', 'ok'); }
    catch (err) { alertBox(App.errMsg(err)); } finally { resetCaptcha('login'); }
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const btn = $('#loginBtn');
    let target;
    try { target = readIdentifier(); } catch (err) { return alertBox(err.message); }

    try {
      if (login.method === 'password') {
        const password = $('#loginPass').value;
        if (!password) return alertBox('Please enter your password.');
        App.setBusy(btn, true, 'Signing in...');
        const cred = target.email ? { email: target.email, password } : { phone: target.phone, password };
        const { data, error } = await sb.auth.signInWithPassword({ ...cred, options: { captchaToken: captchaToken('login') } });
        if (error) {
          if (/Email not confirmed/i.test(error.message) && target.email) {
            await sb.auth.resend({ type: 'signup', email: target.email }).catch(() => {});
            startVerifyEmail(target.email, 'Your e-mail address is not verified yet. We have sent you a new code.');
            return;
          }
          throw error;
        }
        await afterSignIn(data.user, false);
      } else if (!login.otpSent) {
        App.setBusy(btn, true, 'Sending...');
        await sendLoginOtp(target);
        alertBox('An OTP has been sent. Enter it below to sign in.', 'ok');
      } else {
        const token = $('#loginOtp').value.replace(/\s+/g, '');
        if (!/^\d{6,8}$/.test(token)) return alertBox('Please enter the 6-digit OTP.');
        App.setBusy(btn, true, 'Verifying...');
        const t = login.otpTarget;
        const { data, error } = await sb.auth.verifyOtp(t.email ? { email: t.email, token, type: 'email' } : { phone: t.phone, token, type: 'sms' });
        if (error) throw error;
        await afterSignIn(data.user, true);
      }
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      resetCaptcha('login');
      App.setBusy(btn, false);
      refreshLoginUi();
    }
  });

  // =====================================================================
  //  STUDENT REGISTRATION  (1 account -> 2 verify e-mail -> 3 details + ID card)
  // =====================================================================
  const reg = {
    email: '', uid: null,
    idFile: null, idUrl: null, idPath: null,
    pendingPhone: '', phoneVerified: false,
  };

  function setRegStep(n) {
    $('#regForm1').hidden = n !== 1;
    $('#regForm2').hidden = n !== 2;
    $('#regForm3').hidden = n !== 3;
    $$('#regSteps .wiz-step').forEach((li, idx) => {
      const num = idx + 1;
      li.classList.toggle('is-done', num < n);
      li.classList.toggle('is-now', num === n);
      $('.n', li).innerHTML = num < n ? App.icon('check') : String(num);
    });
    if (n === 2) ensureCaptcha('otp', '#capOtp');
    window.scrollTo({ top: 0 });
  }

  // ----- step 1: account -----
  $('#regForm1').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const full_name = $('#regName').value.trim().replace(/\s+/g, ' ');
    const roll = $('#regRoll').value.replace(/\s+/g, '').toUpperCase();
    const email = $('#regEmail').value.trim().toLowerCase();
    const pass = $('#regPass').value;
    const pass2 = $('#regPass2').value;

    if (full_name.length < 3) return alertBox('Please enter your full name.');
    if (!/^[A-Z0-9/\-_.]{3,30}$/.test(roll)) return alertBox('Please enter a valid roll number (letters, numbers, - and / only).');
    if (!App.EMAIL_RE.test(email)) return alertBox('Please enter a valid e-mail address.');
    const pc = App.passwordCheck(pass, false);
    if (!pc.ok) return alertBox('Your password needs: ' + pc.issues.join(', ') + '.');
    if (pass !== pass2) return alertBox('The two passwords do not match.');

    const btn = $('#regBtn1');
    App.setBusy(btn, true, 'Checking...');
    try {
      const chk = await sb.rpc('check_roll', { p_roll: roll });
      if (chk.error) throw chk.error;
      if (chk.data === 'already_registered') return alertBox('An account already exists for this roll number. Please sign in, or use "Forgot password".');
      if (chk.data === 'not_in_list') return alertBox('This roll number was not found in the college list. Please check it or contact the college office.');
      if (chk.data !== 'ok') return alertBox('This roll number is not valid.');

      const { data, error } = await sb.auth.signUp({
        email, password: pass,
        options: { data: { full_name, roll_no: roll }, captchaToken: captchaToken('register') },
      });
      if (error) throw error;
      // For an existing e-mail Supabase returns no error, but "identities" is empty
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return alertBox('An account with this e-mail address already exists. Please sign in.');
      }
      $('#regPass').value = ''; $('#regPass2').value = '';
      if (data.session) { reg.uid = data.user.id; setRegStep(3); prepareDetailsStep(); return; }   // "Confirm e-mail" is switched off
      startVerifyEmail(email, 'A verification code has been sent to your e-mail address.');
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      resetCaptcha('register');
      App.setBusy(btn, false);
    }
  });

  // ----- step 2: verify e-mail -----
  function startVerifyEmail(email, message) {
    reg.email = email;
    show('register');
    setRegStep(2);
    $('#otpEmail').textContent = email;
    $('#otpCode').value = '';
    if (message) alertBox(message, 'info');
    startCooldown($('#resendBtn'), 'Resend code', 60);
    $('#otpCode').focus();
  }
  $('#resendBtn').addEventListener('click', async () => {
    try {
      const { error } = await sb.auth.resend({ type: 'signup', email: reg.email, options: { captchaToken: captchaToken('otp') } });
      if (error) throw error;
      alertBox('A new code has been sent.', 'ok');
      startCooldown($('#resendBtn'), 'Resend code', 60);
    } catch (err) { alertBox(App.errMsg(err)); } finally { resetCaptcha('otp'); }
  });
  $('#otpBack').addEventListener('click', () => { setRegStep(1); clearAlert(); });

  $('#regForm2').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const token = $('#otpCode').value.replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(token)) return alertBox('Please enter the 6-digit code.');
    const btn = $('#otpBtn');
    App.setBusy(btn, true, 'Verifying...');
    try {
      const { data, error } = await sb.auth.verifyOtp({ email: reg.email, token, type: 'signup' });
      if (error) throw error;
      if (!data.session) throw new Error('Your e-mail is verified. Please sign in to continue.');
      reg.uid = data.user.id;
      setRegStep(3);
      prepareDetailsStep();
      alertBox('Your e-mail address is verified. Please complete your details.', 'ok');
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
    }
  });

  // ----- step 3: details + ID card -----
  async function prepareDetailsStep() {
    if (settings.phone_otp) {
      $('#phoneSend').hidden = false;
      $('#phoneHint').textContent = 'We will send an OTP by SMS to confirm this number.';
    } else {
      $('#phoneHint').textContent = 'A 10-digit Indian mobile number is saved with +91. SMS verification is currently switched off.';
    }
    // If the number is already verified on this account (resumed registration)
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (user && user.phone && user.phone_confirmed_at && settings.phone_otp) {
        $('#dPhone').value = '+' + String(user.phone).replace(/^\+/, '');
        reg.phoneVerified = true;
        $('#phoneVerified').hidden = false;
        $('#phoneSend').hidden = true;
      }
    } catch (e) { /* ignore */ }
  }

  $('#dPhone').addEventListener('input', () => {
    if (!settings.phone_otp) return;
    reg.phoneVerified = false; reg.pendingPhone = '';
    $('#phoneVerified').hidden = true;
    $('#phoneOtpBox').hidden = true;
    $('#phoneSend').hidden = false;
  });
  $('#phoneSend').addEventListener('click', async (ev) => {
    const phone = App.normalizePhone($('#dPhone').value);
    if (!phone) return alertBox('Please enter a valid mobile number (10 digits).');
    const btn = ev.currentTarget;
    App.setBusy(btn, true, 'Sending...');
    try {
      const { error } = await sb.auth.updateUser({ phone });
      if (error) throw error;
      reg.pendingPhone = phone;
      $('#phoneOtpBox').hidden = false;
      $('#phoneOtp').value = ''; $('#phoneOtp').focus();
      App.setBusy(btn, false);
      startCooldown(btn, 'Resend OTP', 60);
      alertBox('An OTP has been sent by SMS to ' + phone + '.', 'ok');
    } catch (err) { App.setBusy(btn, false); alertBox(App.errMsg(err)); }
  });
  async function verifyPhone() {
    const token = $('#phoneOtp').value.replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(token)) return alertBox('Please enter the 6-digit OTP sent by SMS.');
    const btn = $('#phoneVerify');
    App.setBusy(btn, true, 'Verifying...');
    try {
      const { error } = await sb.auth.verifyOtp({ phone: reg.pendingPhone, token, type: 'phone_change' });
      if (error) throw error;
      reg.phoneVerified = true;
      $('#phoneVerified').hidden = false;
      $('#phoneOtpBox').hidden = true;
      $('#phoneSend').hidden = true;
      clearAlert();
    } catch (err) { alertBox(App.errMsg(err)); } finally { App.setBusy(btn, false); }
  }
  $('#phoneVerify').addEventListener('click', verifyPhone);
  $('#phoneOtp').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyPhone(); } });

  // ID card picker
  const ID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  function pickId(file) {
    if (!file) return;
    if (!ID_TYPES.includes(file.type)) return alertBox('Please upload the ID card as a JPG, PNG or WebP photo.');
    if (file.size > 25 * 1048576) return alertBox('This photo is too large. Please choose a photo smaller than 25 MB.');
    if (reg.idUrl) URL.revokeObjectURL(reg.idUrl);
    reg.idFile = file; reg.idPath = null;
    reg.idUrl = URL.createObjectURL(file);
    $('#idImg').src = reg.idUrl;
    $('#idPreview').hidden = false;
    $('#idDrop').classList.add('has-file');
    clearAlert();
  }
  $('#idCamera').addEventListener('click', () => $('#inIdCamera').click());
  $('#idGallery').addEventListener('click', () => $('#inIdGallery').click());
  ['inIdCamera', 'inIdGallery'].forEach((id) => $('#' + id).addEventListener('change', (e) => { pickId(e.target.files[0]); e.target.value = ''; }));

  $('#regForm3').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const age = parseInt($('#dAge').value, 10);
    const course = $('#dCourse').value.trim().replace(/\s+/g, ' ');
    const address = $('#dAddress').value.trim().replace(/\s+/g, ' ');
    const phone = App.normalizePhone($('#dPhone').value);

    if (!Number.isInteger(age) || age < 15 || age > 60) return alertBox('Please enter a valid age (15 to 60).');
    if (course.length < 2) return alertBox('Please enter your course and year, for example "BCA Final Year".');
    if (address.length < 8) return alertBox('Please enter your full address.');
    if (!phone) return alertBox('Please enter a valid mobile number (10 digits).');
    if (settings.phone_otp && !reg.phoneVerified) return alertBox('Please verify your mobile number with the OTP first.');
    if (!reg.idFile && !reg.idPath) return alertBox('Please upload a photo of your college ID card.');

    const btn = $('#regBtn3');
    App.setBusy(btn, true, 'Saving...');
    try {
      if (!reg.uid) {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) throw new Error('Your session has expired. Please sign in again.');
        reg.uid = session.user.id;
      }
      if (!reg.idPath) {
        const f = await App.prepareFile(reg.idFile, 1600);
        const path = reg.uid + '/' + f.name;
        await App.uploadBig('student-ids', path, f);
        reg.idPath = path;
      }
      const { error } = await sb.rpc('complete_student_registration', {
        p_age: age, p_course: course, p_address: address, p_phone: phone, p_id_path: reg.idPath,
      });
      if (error) throw error;
      location.replace('student.html');
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
    }
  });
  $('#cancelDetails').addEventListener('click', async () => {
    try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
    location.replace('index.html');
  });

  // =====================================================================
  //  FORGOT PASSWORD  (1 e-mail -> 2 code + new password)
  // =====================================================================
  const forgot = { email: '', recovered: false };
  function setForgotStep(n) {
    $('#forgotForm1').hidden = n !== 1;
    $('#forgotForm2').hidden = n !== 2;
    forgot.recovered = false;
  }

  async function sendResetCode(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { captchaToken: captchaToken('forgot') });
    if (error) throw error;
    forgot.email = email;
  }
  $('#forgotForm1').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const email = $('#forgotEmail').value.trim().toLowerCase();
    if (!App.EMAIL_RE.test(email)) return alertBox('Please enter a valid e-mail address.');
    const btn = $('#forgotBtn');
    App.setBusy(btn, true, 'Sending...');
    try {
      await sendResetCode(email);
      $('#forgotSentTo').textContent = email;
      setForgotStep(2);
      $('#forgotCode').value = '';
      alertBox('If this e-mail address is registered, a 6-digit code has been sent. Please check your inbox and spam folder.', 'ok');
      startCooldown($('#forgotResend'), 'Resend code', 60);
      $('#forgotCode').focus();
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      resetCaptcha('forgot');
      App.setBusy(btn, false);
    }
  });
  $('#forgotResend').addEventListener('click', async () => {
    try { await sendResetCode(forgot.email); alertBox('A new code has been sent.', 'ok'); startCooldown($('#forgotResend'), 'Resend code', 60); }
    catch (err) { alertBox(App.errMsg(err)); } finally { resetCaptcha('forgot'); }
  });

  $('#forgotForm2').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const token = $('#forgotCode').value.replace(/\s+/g, '');
    const p1 = $('#newPass').value, p2 = $('#newPass2').value;
    if (!forgot.recovered && !/^\d{6,8}$/.test(token)) return alertBox('Please enter the 6-digit code.');
    const btn = $('#resetBtn');
    App.setBusy(btn, true, 'Please wait...');
    try {
      if (!forgot.recovered) {
        const { error } = await sb.auth.verifyOtp({ email: forgot.email, token, type: 'recovery' });
        if (error) throw error;
        forgot.recovered = true;   // the code is used up; we now hold a short-lived session
      }
      const { data: { session } } = await sb.auth.getSession();
      let strict = true;
      if (session) {
        const profile = await App.fetchProfile(session.user.id).catch(() => null);
        strict = !(profile && profile.role === 'student');
      }
      const pc = App.passwordCheck(p1, strict);
      if (!pc.ok) return alertBox('Your password needs: ' + pc.issues.join(', ') + '.');
      if (p1 !== p2) return alertBox('The two passwords do not match.');
      const { error: upErr } = await sb.auth.updateUser({ password: p1 });
      if (upErr) throw upErr;
      await sb.auth.signOut();
      $('#newPass').value = ''; $('#newPass2').value = ''; $('#forgotCode').value = '';
      show('login');
      alertBox('Your password has been changed. Please sign in with your new password.', 'ok');
    } catch (err) {
      alertBox(App.errMsg(err));
    } finally {
      App.setBusy(btn, false);
    }
  });

  // =====================================================================
  //  START
  // =====================================================================
  refreshLoginUi();
  ensureCaptcha('login', '#capLogin');
  settings = await App.getPublicSettings();
  if (settings.phone_otp) {
    $('#loginId').placeholder = 'you@example.com or 98765 43210';
  } else {
    $('#loginId').placeholder = 'you@example.com';
  }

  const params = new URLSearchParams(location.search);
  const msg = params.get('msg');
  if (msg === 'noprofile') alertBox('Your profile was not found. Please sign in again or contact the college.', 'warn');
  if (msg === 'idle') alertBox('You were signed out automatically after a period of inactivity. Please sign in again.', 'info');
  if (msg === 'blocked') alertBox('Your account is not active. Please contact the college office.', 'warn');

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const profile = await App.fetchProfile(session.user.id);
      if (profile) {
        if (profile.role === 'student' && !profile.registration_complete) {
          // Resume an unfinished registration at the details step
          reg.uid = session.user.id;
          show('register');
          setRegStep(3);
          prepareDetailsStep();
          alertBox('Please complete your registration to continue.', 'info');
          return;
        }
        location.replace(App.homeFor(profile));
        return;
      }
    }
  } catch (e) { /* show the sign-in form */ }
})();
