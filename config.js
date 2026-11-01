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

  // Admin code required to advance rounds / wipe data.
  ADMIN_CODE: 'dun-admin-7731',

  // Judges: each name maps to a fixed seat. A judge may ONLY edit their own
  // seat's score, and cannot edit after submitting.
  JUDGES: [
    { name: '阿鱼', seat: 0 },
    { name: '喵酱', seat: 1 },
    { name: '亲舞', seat: 2 },
    { name: '哈啤酒', seat: 3 },
    { name: '谢青', seat: 4 }
  ],

  // ===== Tournament rounds =====
  // Each judge gives a single 1-10 score per contestant per round.
  // 5 judges -> drop highest + lowest -> average the middle 3 = round score.
  // advance = how many top contestants move on when the admin clicks 下一轮.
  // The last round has advance = 0 (no further round; produces final rank).
  SCORE_MIN: 1,
  SCORE_MAX: 10,
  ROUNDS: [
    { key: 1, name: '第一轮', advance: 10 }, // all signups -> top 10
    { key: 2, name: '第二轮', advance: 5 },  // 10 -> top 5
    { key: 3, name: '决赛',   advance: 0 }   // 5 -> final rank 1-5
  ]
};
