// score.js — scoring + ranking for the round-based tournament.
const Scoring = (() => {
  const cfg = window.APP_CONFIG || {};
  const JUDGE_COUNT = (cfg.JUDGES || []).length || 5;
  const ROUNDS = cfg.ROUNDS || [{ key: 1, name: '第一轮', advance: 0 }];

  function round2(n) { return Math.round(n * 100) / 100; }

  function roundDef(roundKey) {
    return ROUNDS.find((r) => r.key === roundKey) || null;
  }
  function roundName(roundKey) {
    const r = roundDef(roundKey);
    return r ? r.name : ('第' + roundKey + '轮');
  }
  function isLastRound(roundKey) {
    const r = roundDef(roundKey);
    return !!r && (!r.advance || r.advance <= 0);
  }

  // Group flat score rows -> { contestant_id: { round: { seat: row } } }
  function groupScores(rows) {
    const map = {};
    (rows || []).forEach((s) => {
      const r = s.round || 1;
      if (!map[s.contestant_id]) map[s.contestant_id] = {};
      if (!map[s.contestant_id][r]) map[s.contestant_id][r] = {};
      map[s.contestant_id][r][s.seat] = s;
    });
    return map;
  }

  // Compute a contestant's score for one round from its { seat: row } map.
  // Rule: need all judges; drop high + low; average the middle. If fewer than
  // all judges have scored, average what exists (preview).
  function computeRound(seatMap) {
    const vals = [];
    for (let j = 0; j < JUDGE_COUNT; j++) {
      const e = seatMap && seatMap[j];
      if (e && e.value !== undefined && e.value !== null) {
        const n = Number(e.value);
        if (!isNaN(n)) vals.push(n);
      }
    }
    const submitted = vals.length;
    if (submitted === 0) return { final: null, submitted: 0, judgeCount: JUDGE_COUNT };
    const sorted = vals.slice().sort((a, b) => a - b);
    let used = sorted;
    if (submitted === JUDGE_COUNT && submitted >= 3) used = sorted.slice(1, -1);
    const sum = used.reduce((a, b) => a + b, 0);
    return { final: round2(sum / used.length), submitted, judgeCount: JUDGE_COUNT };
  }

  // Leaderboard for a specific round. Only contestants who reached that round
  // (advanced_to >= round) are included.
  function leaderboard(contestants, scoreRows, roundKey) {
    const grouped = groupScores(scoreRows);
    const inRound = (contestants || []).filter((c) => (c.advanced_to || 1) >= roundKey);
    const rows = inRound.map((c) => {
      const r = computeRound(grouped[c.id] && grouped[c.id][roundKey]);
      return {
        id: c.id, name: c.name, song: c.song, language: c.language,
        final: r.final, submitted: r.submitted, judgeCount: r.judgeCount,
        complete: r.submitted === r.judgeCount
      };
    });
    rows.sort((a, b) => {
      const fa = a.final === null ? -1 : a.final;
      const fb = b.final === null ? -1 : b.final;
      return fb - fa;
    });
    let lastScore = null, lastRank = 0;
    rows.forEach((row, i) => {
      if (row.final === null) { row.rank = null; return; }
      if (row.final === lastScore) { row.rank = lastRank; }
      else { row.rank = i + 1; lastRank = row.rank; lastScore = row.final; }
    });
    return rows;
  }

  return {
    round2, groupScores, computeRound, leaderboard,
    roundDef, roundName, isLastRound,
    JUDGE_COUNT, ROUNDS
  };
})();
