// db.js
// Data layer. Uses Supabase REST when configured; otherwise falls back to a
// localStorage "demo mode" (single device) so the UI still works immediately.

const DB = (() => {
  const cfg = window.APP_CONFIG || {};
  const hasCloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  // ---------- Supabase REST helpers ----------
  function rest(path, opts = {}) {
    const url = cfg.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path;
    // New-format publishable keys (sb_publishable_...) are NOT JWTs and must go
    // in the apikey header only.
    const key = cfg.SUPABASE_ANON_KEY;
    const headers = Object.assign(
      { apikey: key, 'Content-Type': 'application/json' },
      opts.headers || {}
    );
    if (/^eyJ/.test(key)) headers.Authorization = 'Bearer ' + key;
    return fetch(url, Object.assign({}, opts, { headers })).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' ' + text);
      }
      if (res.status === 204) return null;
      const ct = res.headers.get('content-type') || '';
      return ct.includes('application/json') ? res.json() : null;
    });
  }

  // ---------- localStorage demo fallback ----------
  const LS_C = 'sc_contestants';
  const LS_S = 'sc_scores';
  const LS_STATE = 'sc_state';
  function lsGet(k, def) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

  // ---------- Contest state (current round) ----------
  async function getCurrentRound() {
    if (hasCloud) {
      const rows = await rest('contest_state?select=current_round&id=eq.1');
      return (rows && rows[0] && rows[0].current_round) || 1;
    }
    return lsGet(LS_STATE, { current_round: 1 }).current_round || 1;
  }

  async function setCurrentRound(round) {
    if (hasCloud) {
      await rest('contest_state?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({ current_round: round, updated_at: new Date().toISOString() })
      });
      return true;
    }
    lsSet(LS_STATE, { current_round: round });
    return true;
  }

  // ---------- Contestants ----------
  async function listContestants() {
    if (hasCloud) return rest('contestants?select=*&order=number.asc');
    return lsGet(LS_C, []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  async function addContestant(data) {
    if (hasCloud) {
      const existing = await rest('contestants?select=id');
      const row = Object.assign({ number: (existing ? existing.length : 0) + 1, advanced_to: 1 }, data);
      const inserted = await rest('contestants', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      return inserted && inserted[0];
    }
    const list = lsGet(LS_C, []);
    const row = Object.assign({ id: uid(), number: list.length + 1, advanced_to: 1, created_at: Date.now() }, data);
    list.push(row); lsSet(LS_C, list);
    return row;
  }

  async function duplicateExists(name, song) {
    if (hasCloud) {
      const enc = encodeURIComponent;
      const rows = await rest(`contestants?select=id&name=eq.${enc(name)}&song=eq.${enc(song)}`);
      return rows && rows.length > 0;
    }
    return lsGet(LS_C, []).some((c) => c.name === name && c.song === song);
  }

  async function deleteContestant(id, ownerToken) {
    if (hasCloud) {
      const rows = await rest(`contestants?select=owner_token&id=eq.${id}`);
      if (!rows || !rows.length) throw new Error('not_found');
      if (rows[0].owner_token !== ownerToken) throw new Error('not_owner');
      await rest(`contestants?id=eq.${id}`, { method: 'DELETE' });
      return true;
    }
    let list = lsGet(LS_C, []);
    const target = list.find((c) => c.id === id);
    if (!target) throw new Error('not_found');
    if (target.owner_token !== ownerToken) throw new Error('not_owner');
    list = list.filter((c) => c.id !== id);
    list.forEach((c, i) => (c.number = i + 1));
    lsSet(LS_C, list);
    lsSet(LS_S, lsGet(LS_S, []).filter((s) => s.contestant_id !== id));
    return true;
  }

  // ---------- Scores ----------
  async function listScores() {
    if (hasCloud) return rest('scores?select=*');
    return lsGet(LS_S, []);
  }

  async function listScoresFor(contestantId) {
    if (hasCloud) return rest(`scores?select=*&contestant_id=eq.${contestantId}`);
    return lsGet(LS_S, []).filter((s) => s.contestant_id === contestantId);
  }

  // Submit a single 1-10 value for (contestant, seat, round). Locked after submit.
  async function submitScore(contestantId, seat, round, value, byName) {
    const row = { contestant_id: contestantId, seat, round, value, by_name: byName || '' };
    if (hasCloud) {
      try {
        const inserted = await rest('scores', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row)
        });
        return inserted && inserted[0];
      } catch (e) {
        const m = String(e.message);
        if (m.includes('409') || m.includes('duplicate')) throw new Error('already_submitted');
        throw e;
      }
    }
    const list = lsGet(LS_S, []);
    if (list.some((s) => s.contestant_id === contestantId && s.seat === seat && (s.round || 1) === round)) {
      throw new Error('already_submitted');
    }
    row.id = uid(); row.created_at = Date.now();
    list.push(row); lsSet(LS_S, list);
    return row;
  }

  // ---------- Admin: advance to the next round ----------
  // Keeps the top `advance` contestants of the current round (by score); marks
  // the rest eliminated; bumps survivors' advanced_to to nextRound; sets state.
  async function advanceRound(nextRound, survivorIds) {
    if (hasCloud) {
      // Bump survivors.
      for (const id of survivorIds) {
        await rest(`contestants?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ advanced_to: nextRound })
        });
      }
      await setCurrentRound(nextRound);
      return true;
    }
    const list = lsGet(LS_C, []);
    list.forEach((c) => { if (survivorIds.indexOf(c.id) !== -1) c.advanced_to = nextRound; });
    lsSet(LS_C, list);
    lsSet(LS_STATE, { current_round: nextRound });
    return true;
  }

  // ---------- Admin reset ----------
  async function resetAll() {
    if (hasCloud) {
      await rest('contestants?id=not.is.null', { method: 'DELETE' });
      await rest('scores?id=not.is.null', { method: 'DELETE' }).catch(() => {});
      await setCurrentRound(1);
      return true;
    }
    lsSet(LS_C, []); lsSet(LS_S, []); lsSet(LS_STATE, { current_round: 1 });
    return true;
  }

  return {
    hasCloud,
    getCurrentRound, setCurrentRound,
    listContestants, addContestant, duplicateExists, deleteContestant,
    listScores, listScoresFor, submitScore,
    advanceRound, resetAll
  };
})();
