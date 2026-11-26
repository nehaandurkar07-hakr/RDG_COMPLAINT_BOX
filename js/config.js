// =====================================================================
//  Fill this file in once (README, Step 2).
//  Supabase dashboard -> Project Settings -> API -> copy the two values below.
//
//  Important: only the "anon public" key goes here. It is visible to everyone who
//  opens the website and that is normal - security comes from the database rules
//  (RLS). NEVER put the "service_role" key here.
// =====================================================================
window.RDG_CONFIG = {
  SUPABASE_URL: "https://crlnuvpturffmazbbnfe.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_QFBJuOauVJVRr2KDuEonbA_x4zJQlrs",

  COLLEGE_NAME: "Smt. Radhadevi Goenka College for Women",
  COLLEGE_CITY: "Akola",

  // Second footer line (name of the developer). Use "" to hide it.
  DEVELOPER_CREDIT: "Designed & Developed by Neha",

  // Country code added to 10-digit mobile numbers
  DEFAULT_COUNTRY_CODE: "+91",

  // Proof upload limits. 8192 MB = 8 GB per file (resumable upload for big files).
  // Note: Supabase's own project limit also applies (free plan: 50 MB, see README).
  MAX_FILES: 5,
  MAX_FILE_MB: 8192,

  // OPTIONAL - bot protection (Cloudflare Turnstile, free). See README "Extra security".
  // If you add a key here, also switch Captcha ON in the Supabase dashboard (both or neither).
  TURNSTILE_SITE_KEY: "",
};
