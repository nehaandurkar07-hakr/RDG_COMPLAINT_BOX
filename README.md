# Complaint Box — Smt. Radhadevi Goenka College for Women, Akola

An online complaint portal for college students. Complaints reach the HOD, the Principal or the College Management (Super Admin), who reply from their own panel. If nobody replies in time, the complaint moves up to the next authority automatically.

**Website:** plain HTML, CSS and JavaScript (free hosting on GitHub Pages).
**Database, sign-in and file storage:** Supabase (the free plan is enough to start).
The whole interface is in English and works on phones, tablets and laptops (Chrome and any modern browser).

---

## What it does

| Role | What they can do |
|---|---|
| **Student** | Register with roll number, e-mail OTP, mobile number and a photo of the college ID card. Sign in with password or OTP. File complaints with photo / video / PDF proof (up to 8 GB per file on a paid Supabase plan), track the live status, vote on the Public Wall, give feedback after resolution. Receives an e-mail when the status changes. |
| **HOD** | Sees only the complaints of their own department, replies (mandatory), changes status, forwards to the Principal. |
| **Principal** | Sees all complaints and the complaints against HODs, replies, forwards to the College Management. |
| **Super Admin (College Management)** | Sees everything, including complaints against HODs and the Principal. Must reply too. Resets staff passwords, checks student ID cards, manages the optional roll list, reads the activity log. |

- Complaint ID looks like `RDG-2026-0001`. Status flow: Submitted, Under Review, In Progress, Resolved or Rejected.
- **High Priority** words (ragging, harassment, safety, medical, emergency...) turn a complaint red and move it to the top.
- A complaint **against the HOD** is never shown to the HOD and goes to the Principal. A complaint **against the Principal** goes to the College Management only. Both are always anonymous.
- **No reply within 24 hours:** the complaint moves HOD to Principal to College Management automatically. A reply is compulsory at every level, also for the Super Admin.
- There is **no delete button** anywhere. Complaints cannot be removed.

---

## Setup (one time, about 40 minutes)

### Step 1 — Create the Supabase project
1. Create a free account at https://supabase.com and click **New project**.
2. Name it `rdg-complaint-box`, choose a strong **database password** (keep it private; it never goes into the website) and the region **South Asia (Mumbai)**.

### Step 2 — Create the database
1. Supabase: **SQL Editor, New query**.
2. Copy the **whole** file `supabase/schema.sql`, paste it, press **Run**. It is safe to run again later.

### Step 3 — Fill in `js/config.js`
1. Supabase: **Project Settings, API**. Copy the **Project URL** and the **anon public** key.
2. Paste them into `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
3. **Never** put the `service_role` key here or on GitHub. The anon key is public by design; the real protection is the database rules (RLS).

### Step 4 — Supabase Authentication settings
1. **Authentication, URL Configuration:** set *Site URL* to your website address (you get it in Step 6, for example `https://yourname.github.io/rdg-complaint-box/`) and add the same address to *Redirect URLs*.
2. **Sign In / Providers, Email:** *Confirm email* **ON**, *Secure email change* **OFF**, OTP length **6**.
3. **E-mail templates.** Every template below must contain the code placeholder `{{ .Token }}`, otherwise users receive a link instead of a code:
   - *Confirm sign up*
   - *Magic Link*
   - *Change Email Address*
   - *Reset Password*

   Example body: `<p>Your Complaint Box verification code is <b>{{ .Token }}</b>.</p>`
4. **Password policy:** minimum length 8 (staff passwords are checked more strictly by the website).
5. **Custom SMTP (strongly recommended).** The built-in Supabase mailer sends only a handful of e-mails per hour, so OTPs get stuck as soon as many students register. In **Project Settings, Authentication, SMTP Settings** connect a free provider such as **Brevo** (300 e-mails per day) and use a sender address verified there.

### Step 5 — Create the staff accounts (HOD, Principal, Super Admin)
Every person gets a **different** e-mail and a **different** temporary password.
1. **Authentication, Users, Add user, Create new user.** Switch **Auto Confirm User** ON.
   - `YOURGMAIL+superadmin@gmail.com` (Super Admin)
   - `YOURGMAIL+principal@gmail.com` (Principal)
   - `YOURGMAIL+hod1@gmail.com`, `+hod2`, ... one account for each HOD
   (The Gmail `+` trick delivers all mail to your own inbox.)
2. Open `supabase/create-staff.sql`, replace `YOURGMAIL` and the HOD count **only inside the SQL Editor**, then **Run**.
3. Hand each person their temporary e-mail and password personally. **Never** write passwords into the repository, the README or any SQL file.

### Step 6 — Put the site on GitHub and make it live
1. https://github.com: **New repository** (`rdg-complaint-box`, Public).
2. Upload **all files and folders** of this project (`index.html`, `css`, `js`, `favicon.svg`, `_headers`, `.nojekyll`, ...). Do **not** upload any file with passwords.
3. **Settings, Pages:** deploy from branch `main`, folder `/ (root)`, **Save**.
4. After a minute the site is live at `https://<username>.github.io/rdg-complaint-box/`. Put this address into Step 4.1.

Optional: Netlify or Cloudflare Pages also work and apply the security headers from `_headers` automatically. On Chrome for Android use menu, **Add to Home screen** to get an app-like icon.

---

## First login of the HOD, Principal and Super Admin

1. They sign in on the normal page with the temporary e-mail and password.
2. A form opens automatically:
   - **Profile:** full name and role. The role is **locked** to what the administrator created, so nobody can promote themselves. A **HOD chooses the department** (BCA, BBA, B.Com, B.Sc, B.A, MBA, MCA, M.Com, M.Sc, M.A ...). A department that already has a HOD cannot be chosen again.
   - **Address:** address, district, state.
   - **Verify:** their own e-mail address and mobile number, each confirmed with an OTP (the e-mail OTP always; the mobile OTP once SMS is enabled, see Step 8).
   - **Password:** their own strong password (at least 10 characters with upper and lower case letters, a number and a symbol). The temporary password stops working. The server checks that it was really changed.
3. After that they see their dashboard with a small profile card (name, title such as "MBA HOD" or "Principal", e-mail, mobile).
4. From then on they sign in with their own e-mail and password.
5. Forgot the password? **Sign in page, Forgot password** sends a 6-digit code to the e-mail. The Super Admin can also reset a HOD or Principal password (**Staff** tab); the new temporary password is shown only once.

More departments can be added any time: `insert into public.departments (name) values ('B.Voc');`

---

## Student registration and sign in

- Registration: name, roll number, e-mail (OTP), password, then age, course, address, mobile number and a **photo of the real college ID card**. The ID card is stored in a private bucket; only the Super Admin can open it (**Students** tab) so outsiders can be recognised.
- Sign in with e-mail (or mobile number once SMS is enabled) and either the **password** or a one-time **OTP**.
- Forgot password: e-mail, 6-digit code, new password.
- Optional roll-number list: Super Admin, **Roll List** tab. If the list is empty, anyone with a college ID card can register; once it contains roll numbers only those can.

---

## Step 7 — E-mail notifications to students

Students get an e-mail when their complaint receives a reply, is forwarded or is escalated (the reply text itself is never e-mailed).
1. Create a free account at https://www.brevo.com, verify a sender address and create an **API key**.
2. Deploy the function `supabase/functions/notify-status` and set its secrets. Exact commands: `supabase/functions/notify-status/README.md`.
3. In the SQL Editor run the `insert into public.notify_config ...` statement from that README (keep this statement out of the repository).
4. Make sure **Database, Extensions, pg_net** is enabled.

Until this is done everything else works normally; only the e-mails are skipped.

## Step 8 — Mobile OTP by SMS (optional, needs a paid SMS service)

Sending SMS costs money, so it is switched **off** by default. Until it is on, the mobile number is collected and saved but not OTP-verified, and sign-in by mobile number is hidden.
1. Supabase: **Authentication, Sign In / Providers, Phone:** enable it and connect an SMS provider (Twilio, MessageBird, Vonage...). In India, SMS also needs DLT registration with the provider.
2. Run once in the SQL Editor: `update public.app_settings set phone_otp = true where id = 1;`
3. The website switches to mobile OTP automatically (no code change).

## Step 9 — Large uploads (up to 8 GB)

- The website supports **resumable uploads** (TUS): files above 6 MB are sent in pieces and continue after a network drop.
- The limit set in the database and in `js/config.js` (`MAX_FILE_MB: 8192`) is 8 GB per file.
- **Important:** Supabase has its own project-wide limit. On the **free plan a file can be at most 50 MB and the total storage is 1 GB.** To really accept 8 GB files you need the **Pro plan**, and then you must raise **Storage, Settings, Global file size limit** to 8 GB.
- If you stay on the free plan, set `MAX_FILE_MB: 50` in `js/config.js` so students see the correct limit.
- Photos are resized and stripped of location data before upload.

---

## Security overview

- **Row Level Security** on every table: a student sees only their own complaints, a HOD only their department, and so on.
- All writes go through server functions; the website has no direct update or delete access.
- Student identity is stored apart from the complaint. In anonymous mode HODs and the Principal cannot reach it.
- Roles are never read from the browser, always from the database. First-login checks (role, department, verified e-mail / mobile, changed password) are enforced on the server.
- Super Admin actions are checked on the server and written to an activity log nobody can edit.
- Limits: 10 complaints per student per day, 5 files per complaint, file type and size checks, strict staff passwords, common passwords blocked, automatic sign-out after inactivity (staff 15 min, students 30 min).
- Content-Security-Policy, clickjacking protection, no-referrer, all text escaped.
- Proof files and ID cards are in **private** buckets and opened only through short-lived links.
- Optional **Cloudflare Turnstile** captcha: put the site key into `js/config.js` **and** switch Captcha on in Supabase (both or neither).

**Honest limits.** No website can promise to be 100% unhackable. The Super Admin password is the most important secret: make it long and never reuse it. GitHub Pages cannot send custom security headers (the CSP tag inside each page covers this; Netlify / Cloudflare Pages use `_headers`). A free Supabase project pauses after 7 days of no activity (press Restore) and has no automatic backups, so export the data now and then. Never share the `service_role` key or the Supabase dashboard password.

---

## Project map

```
index.html          Sign in, student registration, forgot password
student.html        Student panel
staff.html          HOD, Principal and Super Admin panel
onboarding.html     First-login form for staff
css/style.css       Design
js/config.js        Supabase URL + anon key (Step 3)
js/*.js             Website code (admin.js = Super Admin tabs)
js/vendor/          Licences of the libraries (the libraries load from jsDelivr with an integrity hash)
```

The database scripts (`supabase/schema.sql`, `supabase/create-staff.sql`, `supabase/functions/notify-status/`) are kept by the developer outside this website repository, so that nothing private is published here.

```
_headers            Security headers for Netlify / Cloudflare Pages
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says "Setup is not complete" | Fill `js/config.js` (Step 3). |
| "Could not load departments" | Run `schema.sql` (Step 2); check the keys in Step 3. |
| OTP e-mail does not arrive | Check spam; set up custom SMTP (Step 4.5); make sure the template contains `{{ .Token }}`. |
| E-mail contains a link instead of a code | Add `{{ .Token }}` to that template (Step 4.3). |
| `create-staff.sql` prints "Skipped accounts" | Those Auth users do not exist yet (create them, Step 5.1) or the person has already finished the first login. Other accounts are processed normally. |
| "Please verify your own e-mail address" at first login | Use your own e-mail (not the temporary one) and enter the OTP. |
| Mobile OTP error | SMS is off or not configured (Step 8). |
| Upload fails for files above 50 MB | Free plan limit; upgrade or lower `MAX_FILE_MB` (Step 9). |
| Old version still showing after an update | Hard refresh with `Ctrl + Shift + R`. |

---

&copy; Smt. Radhadevi Goenka College for Women, Akola. All Rights Reserved.
