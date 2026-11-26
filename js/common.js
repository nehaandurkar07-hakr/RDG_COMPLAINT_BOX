/* =====================================================================
   common.js - code shared by every page (session guard, helpers, labels).
   Classic <script> (not a module) so pages also open from file://.
   ===================================================================== */
(function () {
  'use strict';

  const cfg = window.RDG_CONFIG || {};
  const configured =
    !!cfg.SUPABASE_URL && !/YOUR-PROJECT/i.test(cfg.SUPABASE_URL) &&
    !!cfg.SUPABASE_ANON_KEY && !/YOUR-ANON/i.test(cfg.SUPABASE_ANON_KEY);

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  // ---------- icons (inline SVG, no external requests) ----------
  const ICONS = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.3A6.5 6.5 0 0 1 21.5 20"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.4 3.2 8 7.5 9.5 4.3-1.5 7.5-5.1 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    clipboard: '<rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9.5 11h5M9.5 15h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    folder: '<path d="M3 6.5h6l2 2.5h10V19H3z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.7L16 9.5"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3 1.8"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-3.5L4 9.5M4 4v5.5h5.5"/><path d="M4 13a8 8 0 0 0 14.3 3.5L20 14.5M20 20v-5.5h-5.5"/>',
    logout: '<path d="M10 4H5v16h5"/><path d="m16 8 4 4-4 4M20 12H9"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16.5a3.4 3.4 0 0 1 6.4 0M14.5 10h3.5M14.5 13.5h2.5"/>',
    building: '<path d="M5 21V4.5L13 3v18"/><path d="M13 9h6v12M2.5 21h19M8.5 8v.01M8.5 12v.01M8.5 16v.01M16 13v.01M16 17v.01"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/>',
    bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.500 2h-15z"/><path d="M10 21.500h4"/>',
    thumb: '<path d="M7 11v9H4v-9z"/><path d="m7 11 4-8c1.700 0 2.700 1.200 2.400 2.800L12.800 9H19a2 2 0 0 1 2 2.300l-1.200 6.800A2 2 0 0 1 17.800 20H7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    inbox: '<path d="M3 13.500 6 5h12l3 8.500V19H3z"/><path d="M3 13.500h5l1 2.500h6l1-2.500h5"/>',
    message: '<path d="M4 5h16v11H10l-4.500 4V16H4z"/><path d="M8 9.500h8M8 12.500h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
    star: '<path d="m12 3.500 2.600 5.500 6 .8-4.400 4.100 1.100 6-5.300-2.900-5.300 2.900 1.100-6L3.400 9.800l6-.8z"/>',
    fire: '<path d="M12 3c1 4 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.500 1 2 2 2-1-3 0-5 1-8z"/>',
    heart: '<path d="M12 20s-8-4.800-8-10.500A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 8 2.500C20 15.200 12 20 12 20z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.500 14a4 4 0 0 0 7 0M9 9.500v.01M15 9.500v.01"/>',
    frown: '<circle cx="12" cy="12" r="9"/><path d="M8.500 16a4 4 0 0 1 7 0M9 9.500v.01M15 9.500v.01"/>',
  };
  function icon(name, extra) {
    return '<svg class="ico' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') + '</svg>';
  }
  // <i data-icon="mail"></i> in static HTML becomes an inline SVG
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.getAttribute('data-icon'), el.getAttribute('data-class') || '');
    });
  }

  // ---------- labels ----------
  const CATEGORIES = [
    ['academic', 'Academic (classes / exams)'],
    ['lab_computer', 'Lab / Computer'],
    ['library', 'Library'],
    ['canteen', 'Canteen'],
    ['hostel', 'Hostel'],
    ['wifi_internet', 'Wi-Fi / Internet'],
    ['cleanliness', 'Cleanliness / Washroom'],
    ['ragging_safety', 'Ragging / Harassment / Safety'],
    ['medical_emergency', 'Medical / Emergency'],
    ['other', 'Other'],
  ];
  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
  const AGAINST = [
    ['facility', 'Facility or general problem (lab, canteen, library...)'],
    ['faculty', 'Teacher / Faculty'],
    ['hod', 'Head of Department (HOD)'],
    ['principal', 'Principal'],
  ];
  const AGAINST_LABEL = { facility: 'Facility', faculty: 'Faculty', hod: 'HOD', principal: 'Principal' };
  const STATUS = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    rejected: 'Rejected',
  };
  const ROLE = { student: 'Student', hod: 'HOD', principal: 'Principal', management: 'Super Admin', system: 'System' };
  const LEVEL = { hod: 'HOD', principal: 'Principal', management: 'College Management' };
  const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

  // Display title of a person, e.g. "MBA HOD", "Principal", "Super Admin"
  function designation(p) {
    if (!p) return '';
    if (p.role === 'hod') return ((p.departments && p.departments.name) ? p.departments.name + ' ' : '') + 'HOD';
    if (p.role === 'principal') return 'Principal';
    if (p.role === 'management') return 'Super Admin';
    return 'Student';
  }

  // ---------- small helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function fmtDateTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDuration(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }
  function fmtSize(bytes) {
    const b = Number(bytes) || 0;
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }

  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'bad' ? 6000 : 3800);
  }

  // Turns technical errors into friendly English sentences
  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Please check your internet connection and try again.';
    if (/Invalid login credentials/i.test(m)) return 'The e-mail / mobile number or password is incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Your e-mail address is not verified yet. Please complete the OTP verification.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Too many attempts. Please wait a little and try again.';
    if (/Database error saving new user/i.test(m)) return 'Your account could not be created. The roll number may not be in the college list or is already registered.';
    if (/Token has expired or is invalid|otp_expired|invalid.*token/i.test(m)) return 'The OTP is incorrect or has expired. Please request a new one.';
    if (/same password|different from the old/i.test(m)) return 'Your new password must be different from the old one.';
    if (/Signups not allowed|user not found|not found for otp/i.test(m)) return 'No account was found with these details. Please register first.';
    if (/already registered|already been registered|already exists/i.test(m)) return 'An account with these details already exists. Please sign in.';
    if (/sms|twilio|phone provider|unsupported phone/i.test(m)) return 'SMS verification is not available right now. Please try again later.';
    if (/row-level security|permission denied/i.test(m)) return 'You do not have permission to do this.';
    if (/exceeded the maximum allowed size|payload too large|too large/i.test(m)) return 'This file is larger than the limit set for this server.';
    return m;
  }

  function setBusy(btn, busy, text) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + (text || 'Please wait...');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  // ---------- phone numbers ----------
  // "98765 43210" -> "+919876543210". Returns null when it is not a valid number.
  function normalizePhone(raw) {
    const p = String(raw || '').replace(/[\s\-()]/g, '');
    if (/^\+[0-9]{11,14}$/.test(p)) return p;
    if (/^0?[0-9]{10}$/.test(p)) return (cfg.DEFAULT_COUNTRY_CODE || '+91') + p.slice(-10);
    if (/^91[0-9]{10}$/.test(p)) return '+' + p;
    return null;
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Settings the login page needs. phone_otp = SMS OTP is switched on (see README).
  let settingsPromise = null;
  function getPublicSettings() {
    if (!sb) return Promise.resolve({ phone_otp: false });
    if (!settingsPromise) {
      settingsPromise = sb.rpc('get_public_settings')
        .then((r) => ({ phone_otp: !!(r && r.data && r.data.phone_otp) }))
        .catch(() => ({ phone_otp: false }));
    }
    return settingsPromise;
  }

  // ---------- "setup needed" screen ----------
  function showSetupNeeded() {
    document.body.innerHTML =
      '<div class="auth-single"><div class="auth-card"><div class="setup-box">' +
      '<h2>Setup is not complete</h2>' +
      '<p>Please add your Supabase project URL and anon key in <code>js/config.js</code>.</p>' +
      '<p>Follow <b>Step 1 and Step 2</b> of the README.</p>' +
      '</div></div></div>';
  }

  // ---------- session guard ----------
  function homeFor(profile) {
    if (profile.role === 'student') {
      return profile.registration_complete ? 'student.html' : 'index.html?step=details';
    }
    if (profile.must_change_password) return 'onboarding.html';
    return 'staff.html';
  }

  async function fetchProfile(userId) {
    const { data, error } = await sb
      .from('profiles').select('*, departments(name)').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Call first on every protected page. Redirects when not signed in / wrong role.
   * Usage: const ctx = await App.requireUser(['student']).catch(() => null); if (!ctx) return;
   * Allow onboarding pages to run with an unfinished profile via opts.allowIncomplete.
   */
  async function requireUser(roles, opts) {
    opts = opts || {};
    if (!sb) { showSetupNeeded(); throw new Error('not configured'); }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.replace('index.html'); throw new Error('no session'); }
    let profile;
    try { profile = await fetchProfile(session.user.id); }
    catch (e) { toast(errMsg(e), 'bad'); throw e; }
    if (!profile) {
      await sb.auth.signOut();
      location.replace('index.html?msg=noprofile');
      throw new Error('no profile');
    }
    if (profile.is_active === false) {
      await sb.auth.signOut();
      location.replace('index.html?msg=blocked');
      throw new Error('blocked');
    }
    if (!opts.allowIncomplete) {
      const target = homeFor(profile);
      const here = location.pathname.split('/').pop() || 'index.html';
      if (target.split('?')[0] !== here) { location.replace(target); throw new Error('wrong page'); }
    }
    if (roles && !roles.includes(profile.role)) { location.replace(homeFor(profile)); throw new Error('wrong role'); }
    startIdleTimer(profile.role === 'student' ? 30 : 15);
    return { session, user: session.user, profile };
  }

  // ---------- idle auto-logout (staff 15 min, student 30 min) ----------
  let idleStarted = false;
  let lastActive = Date.now();
  function touchActivity() { lastActive = Date.now(); }
  function startIdleTimer(minutes) {
    if (idleStarted) return;
    idleStarted = true;
    const limit = minutes * 60000;
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach((ev) =>
      window.addEventListener(ev, touchActivity, { passive: true }));
    const check = async () => {
      if (Date.now() - lastActive > limit) {
        try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
        location.replace('index.html?msg=idle');
      }
    };
    setInterval(check, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  // ---------- password rules + strength meter ----------
  const COMMON_PW = ['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123',
    'iloveyou', 'admin123', 'welcome1', 'abcd1234', '11111111', '00000000', 'rdg@2026'];
  // strict = staff (10+ chars, upper, lower, number, symbol). Student: 8+ chars, letters + numbers.
  function passwordCheck(pw, strict) {
    const p = String(pw || '');
    const min = strict ? 10 : 8;
    const hasLower = /[a-z]/.test(p), hasUpper = /[A-Z]/.test(p), hasDigit = /\d/.test(p), hasSym = /[^A-Za-z0-9]/.test(p);
    const issues = [];
    if (p.length < min) issues.push('at least ' + min + ' characters');
    if (!(hasLower || hasUpper) || !hasDigit) issues.push('both letters and numbers');
    if (strict && !(hasLower && hasUpper)) issues.push('both upper and lower case letters');
    if (strict && !hasSym) issues.push('one symbol (for example @ # ! $)');
    if (COMMON_PW.includes(p.toLowerCase())) issues.push('a less common password');
    const score = [p.length >= min, hasLower && hasUpper, hasDigit, hasSym, p.length >= min + 4].filter(Boolean).length;
    return { ok: issues.length === 0, issues, score };
  }
  function attachMeter(input, strict) {
    if (!input) return;
    const box = document.createElement('div');
    box.className = 'meter-wrap';
    box.innerHTML = '<div class="meter"><i></i></div><div class="meter-text hint"></div>';
    input.insertAdjacentElement('afterend', box);
    const bar = box.querySelector('i'), txt = box.querySelector('.meter-text');
    const update = () => {
      const r = passwordCheck(input.value, strict);
      if (!input.value) { bar.style.width = '0'; txt.textContent = ''; return; }
      bar.style.width = Math.max(12, r.score * 20) + '%';
      bar.className = r.ok ? (r.score >= 4 ? 'strong' : 'okay') : 'weak';
      txt.textContent = r.ok ? (r.score >= 4 ? 'Strong password' : 'Acceptable password') : 'Required: ' + r.issues.join(', ');
    };
    input.addEventListener('input', update);
    update();
  }

  // ---------- optional captcha (Cloudflare Turnstile) ----------
  const captcha = (function () {
    const key = cfg.TURNSTILE_SITE_KEY;
    let loading = null;
    function load() {
      if (window.turnstile) return Promise.resolve(window.turnstile);
      if (!loading) {
        loading = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          s.async = true;
          s.onload = () => resolve(window.turnstile);
          s.onerror = () => reject(new Error('The captcha could not be loaded'));
          document.head.appendChild(s);
        });
      }
      return loading;
    }
    function mount(el) {
      if (!key || !el) return null;
      const h = { id: null, token: null };
      load().then((t) => {
        h.id = t.render(el, {
          sitekey: key, theme: 'light',
          callback: (tok) => { h.token = tok; },
          'expired-callback': () => { h.token = null; },
          'error-callback': () => { h.token = null; },
        });
      }).catch(() => { el.textContent = 'The captcha could not be loaded. Please refresh the page.'; });
      return {
        token: () => h.token,
        reset: () => { h.token = null; if (window.turnstile && h.id !== null) { try { window.turnstile.reset(h.id); } catch (e) { /* ignore */ } } },
      };
    }
    return { enabled: !!key, mount };
  })();

  // ---------- footer (every page) ----------
  function renderFooter() {
    let f = document.getElementById('siteFooter');
    if (!f) { f = document.createElement('footer'); f.id = 'siteFooter'; document.body.appendChild(f); }
    f.className = 'site-footer';
    const place = [cfg.COLLEGE_NAME, cfg.COLLEGE_CITY].filter(Boolean).join(', ');
    f.innerHTML = '<div>&copy; ' + new Date().getFullYear() + ' ' + esc(place) + '. All Rights Reserved.</div>' +
      (cfg.DEVELOPER_CREDIT ? '<div class="small">' + esc(cfg.DEVELOPER_CREDIT) + '</div>' : '');
  }

  async function logout() {
    try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
    location.replace('index.html');
  }

  // Top bar: name chip + sign out. subtitle goes under the brand name.
  function initTopbar(profile, subtitle) {
    const chip = document.getElementById('userChip');
    if (chip) chip.textContent = profile.full_name || ROLE[profile.role] || '';
    const sub = document.getElementById('brandSub');
    if (sub && subtitle) sub.textContent = subtitle;
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', logout);
  }

  // Moves overdue complaints up even if pg_cron is not running
  async function runEscalation() {
    try { await sb.rpc('escalate_overdue'); } catch (e) { /* not critical */ }
  }

  async function getEscalationHours() {
    try {
      const { data } = await sb.from('app_settings').select('escalation_hours').eq('id', 1).maybeSingle();
      return (data && data.escalation_hours) || 24;
    } catch (e) { return 24; }
  }

  // ---------- High Priority (same logic as the SQL) ----------
  async function loadKeywords() {
    try {
      const { data } = await sb.from('priority_keywords').select('word');
      return (data || []).map((r) => r.word.toLowerCase());
    } catch (e) { return []; }
  }
  function isHighPriority(category, text, keywords) {
    if (category === 'ragging_safety' || category === 'medical_emergency') return true;
    const t = String(text || '').toLowerCase();
    return (keywords || []).some((w) => t.includes(w));
  }

  // ---------- reply deadline ----------
  function isOpen(c) { return c.status !== 'resolved' && c.status !== 'rejected'; }
  // Returns {overdue, ms, label} while a reply is still awaited at the complaint's current level.
  // For College Management nothing escalates further, so an overdue item is simply flagged.
  function deadlineInfo(c, hours) {
    if (!isOpen(c) || c.responded_at) return null;
    if (!['hod', 'principal', 'management'].includes(c.current_level)) return null;
    const ms = new Date(c.level_since).getTime() + hours * 3600000 - Date.now();
    return { overdue: ms <= 0, ms, label: fmtDuration(Math.abs(ms)), top: c.current_level === 'management' };
  }

  // ---------- proof files ----------
  const EXT = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/webm': 'webm',
    'video/quicktime': 'mov', 'application/pdf': 'pdf',
  };
  function randomName(ext) {
    const r = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return r + '-' + Date.now().toString(36) + '.' + ext;
  }

  // Shrinks photos and removes GPS / device metadata (EXIF). Videos and PDFs are sent as they are.
  async function prepareFile(file, maxSide) {
    const ext = EXT[file.type] || 'bin';
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return new File([file], randomName(ext), { type: file.type });
    }
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, (maxSide || 1600) / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const c2d = canvas.getContext('2d');
      c2d.fillStyle = '#fff'; c2d.fillRect(0, 0, w, h);
      c2d.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('compress failed');
      return new File([blob], randomName('jpg'), { type: 'image/jpeg' });
    } catch (e) {
      return new File([file], randomName(ext), { type: file.type });
    }
  }

  /**
   * Uploads a file to Storage. Small files use a normal upload; files above 6 MB use the
   * resumable (TUS) protocol so uploads up to 8 GB survive weak mobile networks.
   * onProgress receives a number between 0 and 1. Throws on failure.
   */
  async function uploadBig(bucket, path, file, onProgress) {
    const LIMIT = 6 * 1024 * 1024;
    if (file.size <= LIMIT || !window.tus) {
      const r = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (r.error) throw r.error;
      if (onProgress) onProgress(1);
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Your session has expired. Please sign in again.');
    await new Promise((resolve, reject) => {
      const up = new window.tus.Upload(file, {
        endpoint: cfg.SUPABASE_URL.replace(/\/+$/, '') + '/storage/v1/upload/resumable',
        retryDelays: [0, 3000, 5000, 10000, 20000, 30000],
        headers: { authorization: 'Bearer ' + session.access_token, apikey: cfg.SUPABASE_ANON_KEY, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: { bucketName: bucket, objectName: path, contentType: file.type, cacheControl: '3600' },
        chunkSize: LIMIT,
        // Long uploads outlive a 1-hour access token, so refresh the header before every request.
        onBeforeRequest: async (req) => {
          try {
            const s = (await sb.auth.getSession()).data.session;
            if (s) req.setHeader('authorization', 'Bearer ' + s.access_token);
          } catch (e) { /* keep old header */ }
        },
        onError: (err) => reject(err),
        onProgress: (sent, total) => { touchActivity(); if (onProgress) onProgress(total ? sent / total : 0); },
        onSuccess: () => resolve(),
      });
      up.findPreviousUploads().then((prev) => {
        if (prev && prev.length) up.resumeFromPreviousUpload(prev[0]);
        up.start();
      }).catch(() => up.start());
    });
  }

  async function renderFiles(container, files) {
    if (!files || !files.length) { container.innerHTML = '<p class="muted small">No proof was uploaded.</p>'; return; }
    container.innerHTML = '<p class="muted small"><span class="spinner"></span> Loading files...</p>';
    const { data, error } = await sb.storage.from('complaint-proofs').createSignedUrls(files.map((f) => f.path), 3600);
    if (error || !data) { container.innerHTML = '<p class="muted small">The files could not be loaded right now.</p>'; return; }
    const urlByPath = Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
    container.innerHTML = '<div class="files">' + files.map((f) => {
      const url = urlByPath[f.path];
      if (!url) return '';
      const name = '<div class="fname">' + esc(f.file_name) + (f.size_bytes ? ' &middot; ' + esc(fmtSize(f.size_bytes)) : '') + '</div>';
      if (f.mime_type.startsWith('image/')) return '<div class="file"><a href="' + esc(url) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(url) + '" alt="Proof photo"></a>' + name + '</div>';
      if (f.mime_type.startsWith('video/')) return '<div class="file"><video controls preload="metadata" src="' + esc(url) + '"></video>' + name + '</div>';
      return '<div class="file"><a href="' + esc(url) + '" target="_blank" rel="noopener"><div class="pdf">' + icon('file') + '<span>PDF</span></div></a>' + name + '</div>';
    }).join('') + '</div>';
  }

  // ---------- timeline ----------
  function timelineHTML(updates, viewer) {
    if (!updates || !updates.length) return '<p class="muted small">No updates yet.</p>';
    return '<ul class="timeline">' + updates.map((u) => {
      let what;
      if (u.kind === 'submitted') what = viewer === 'student' ? 'You submitted the complaint' : 'Complaint submitted';
      else if (u.kind === 'action') what = ROLE[u.by_role] + ' changed the status to "' + (STATUS[u.status] || u.status) + '"';
      else if (u.kind === 'forwarded') what = ROLE[u.by_role] + ' forwarded the complaint to ' + (LEVEL[u.status] || 'the next level');
      else if (u.kind === 'escalated') what = 'No reply in time: escalated to ' + (LEVEL[u.status] || 'the next level');
      else if (u.kind === 'feedback') what = 'Student feedback';
      else what = u.kind;
      return '<li class="' + (u.by_role === 'system' ? 'sys' : '') + '">' +
        '<div class="when">' + esc(fmtDateTime(u.created_at)) + '</div>' +
        '<div class="what">' + esc(what) + '</div>' +
        (u.remark ? '<div class="remark">' + esc(u.remark) + '</div>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  // ---------- modal (bottom sheet on phones, dialog on desktop) ----------
  function openSheet(html) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id = 'sheetOverlay';
    ov.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('click', (e) => { if (e.target === ov) closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    hydrateIcons(ov);
    const closeBtn = ov.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
    return ov.querySelector('.sheet');
  }
  function closeSheet() {
    const ov = document.getElementById('sheetOverlay');
    if (ov) ov.remove();
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Standard close button markup for sheet headers
  const CLOSE_BTN = '<button class="x" data-close type="button" aria-label="Close">' + icon('x') + '</button>';

  window.App = {
    cfg, configured, sb,
    CATEGORIES, CATEGORY_LABEL, AGAINST, AGAINST_LABEL, STATUS, ROLE, LEVEL, INDIAN_STATES, EMAIL_RE, CLOSE_BTN,
    $, $$, esc, initials, fmtDate, fmtDateTime, fmtDuration, fmtSize, toast, errMsg, setBusy,
    icon, hydrateIcons, designation, normalizePhone, getPublicSettings,
    showSetupNeeded, homeFor, fetchProfile, requireUser, logout, initTopbar,
    runEscalation, getEscalationHours, loadKeywords, isHighPriority,
    isOpen, deadlineInfo, prepareFile, uploadBig, renderFiles, timelineHTML, openSheet, closeSheet,
    startIdleTimer, touchActivity, passwordCheck, attachMeter, captcha, renderFooter,
  };

  function boot() { hydrateIcons(document); renderFooter(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
