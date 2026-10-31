// score.js — pure scoring + ranking helpers.
const Scoring = (() => {
  const cfg = window.APP_CONFIG || {};
  const JUDGE_COUNT = (cfg.JUDGES || []).length || 5;

  function round2(n) { return Math.round(n * 100) / 100; }

  // Group flat score rows by contestant_id -> { seat: row }
  function groupScores(rows) {
    const map = {};
    (rows || []).forEach((s) => {
      if (!map[s.contestant_id]) map[s.contestant_id] = {};
      map[s.contestant_id][s.seat] = s;
    });
    return map;
  }

  // Standard rule: when all judges have scored, drop high + low, average rest.
  function computeFinal(seatMap) {
    const totals = [];
    for (let j = 0; j < JUDGE_COUNT; j++) {
      const e = seatMap && seatMap[j];
      if (e && e.total !== undefined && e.total !== null) {
        const n = Number(e.total);
        if (!isNaN(n)) totals.push(n);
      }
    }
    const submitted = totals.length;
    if (submitted === 0) {
      return { final: null, submitted: 0, judgeCount: JUDGE_COUNT };
    }
    const sorted = totals.slice().sort((a, b) => a - b);
    let used = sorted;
    if (submitted === JUDGE_COUNT && submitted >= 3) {
      used = sorted.slice(1, -1);
    }
    const sum = used.reduce((a, b) => a + b, 0);
    return {
      final: round2(sum / used.length),
      submitted,
      judgeCount: JUDGE_COUNT
    };
  }

  function leaderboard(contestants, scoreRows) {
    const grouped = groupScores(scoreRows);
    const rows = (contestants || []).map((c) => {
      const r = computeFinal(grouped[c.id]);
      return {
        id: c.id,
        name: c.name,
        song: c.song,
        language: c.language,
        final: r.final,
        submitted: r.submitted,
        judgeCount: r.judgeCount,
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

  return { round2, groupScores, computeFinal, leaderboard, JUDGE_COUNT };
})();
