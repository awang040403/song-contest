// config.js
// ============================================================================
// FILL THESE IN to enable multi-device sync (free Supabase project).
//
// How to get them (takes ~3 minutes, email only — no phone, no ID):
//   1. Go to https://supabase.com  ->  Start your project  ->  sign up with email.
//   2. Create a new project (free plan). Pick any name + a database password.
//   3. Wait ~1 min for it to provision.
//   4. Left sidebar -> Project Settings (gear) -> "API".
//        - "Project URL"        -> paste into SUPABASE_URL below
//        - "Project API keys"   -> the "anon public" key -> SUPABASE_ANON_KEY
//   5. Left sidebar -> SQL Editor -> paste the contents of supabase_setup.sql
//      (in this folder) and click RUN. That creates the tables.
//   6. Save this file and open index.html. Done — all devices now share data.
//
// Until you fill these in, the app runs in LOCAL DEMO mode (this device only).
// ============================================================================

window.APP_CONFIG = {
  SUPABASE_URL: 'https://majammoshybzjvokzkly.supabase.co',
  // Use the PUBLISHABLE key (sb_publishable_...). This is safe to ship in the
  // browser. NEVER put the secret key (sb_secret_...) here.
  SUPABASE_ANON_KEY: 'sb_publishable_fsNx3vWgP9SX4b4wFxiAuQ_8NDw1mt9',

  // Shared code judges must enter to unlock scoring.
  JUDGE_CODE: 'dun-judge-8823',

  // Admin code required to wipe all data on the results page.
  ADMIN_CODE: 'dun-admin-7731',

  // Judges: each name maps to a fixed seat. A judge may ONLY edit their own
  // seat, and cannot edit after submitting.
  JUDGES: [
    { name: 'herring', seat: 0 },
    { name: '索隆', seat: 1 },
    { name: 'Claire', seat: 2 },
    { name: 'thinkerz', seat: 3 },
    { name: '青', seat: 4 }
  ],

  // Scoring dimensions, each out of its max. Totals should sum to 100.
  DIMENSIONS: [
    { key: 'vocal', label: '音准/唱功', max: 40 },
    { key: 'emotion', label: '情感表达', max: 30 },
    { key: 'stage', label: '台风表现', max: 20 },
    { key: 'overall', label: '综合印象', max: 10 }
  ]
};
