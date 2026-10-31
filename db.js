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
    // in the apikey header only. Sending them as "Authorization: Bearer" causes
    // a 401, so we only add a Bearer header for legacy JWT anon keys (eyJ...).
    const key = cfg.SUPABASE_ANON_KEY;
    const headers = Object.assign(
      { apikey: key, 'Content-Type': 'application/json' },
      opts.headers || {}
    );
    if (/^eyJ/.test(key)) {
      headers.Authorization = 'Bearer ' + key;
    }
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
  function lsGet(k) {
    try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; }
  }
  function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- Contestants ----------
  async function listContestants() {
    if (hasCloud) {
      return rest('contestants?select=*&order=number.asc');
    }
    return lsGet(LS_C).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  async function addContestant(data) {
    if (hasCloud) {
      // Compute next number from current count.
      const existing = await rest('contestants?select=id');
      const row = Object.assign({ number: (existing ? existing.length : 0) + 1 }, data);
      const inserted = await rest('contestants', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      return inserted && inserted[0];
    }
    const list = lsGet(LS_C);
    const row = Object.assign({ id: uid(), number: list.length + 1, created_at: Date.now() }, data);
    list.push(row);
    lsSet(LS_C, list);
    return row;
  }

  async function duplicateExists(name, song) {
    if (hasCloud) {
      const enc = encodeURIComponent;
      const rows = await rest(
        `contestants?select=id&name=eq.${enc(name)}&song=eq.${enc(song)}`
      );
      return rows && rows.length > 0;
    }
    return lsGet(LS_C).some((c) => c.name === name && c.song === song);
  }

  async function deleteContestant(id, ownerToken) {
    if (hasCloud) {
      // Verify ownership first by token.
      const rows = await rest(`contestants?select=owner_token&id=eq.${id}`);
      if (!rows || !rows.length) throw new Error('not_found');
      if (rows[0].owner_token !== ownerToken) throw new Error('not_owner');
      await rest(`contestants?id=eq.${id}`, { method: 'DELETE' });
      // scores cascade-delete via FK.
      return true;
    }
    let list = lsGet(LS_C);
    const target = list.find((c) => c.id === id);
    if (!target) throw new Error('not_found');
    if (target.owner_token !== ownerToken) throw new Error('not_owner');
    list = list.filter((c) => c.id !== id);
    list.forEach((c, i) => (c.number = i + 1));
    lsSet(LS_C, list);
    lsSet(LS_S, lsGet(LS_S).filter((s) => s.contestant_id !== id));
    return true;
  }

  // ---------- Scores ----------
  async function listScores() {
    if (hasCloud) return rest('scores?select=*');
    return lsGet(LS_S);
  }

  async function listScoresFor(contestantId) {
    if (hasCloud) return rest(`scores?select=*&contestant_id=eq.${contestantId}`);
    return lsGet(LS_S).filter((s) => s.contestant_id === contestantId);
  }

  async function submitScore(contestantId, seat, dims, total, byName) {
    const row = {
      contestant_id: contestantId,
      seat,
      dims,
      total,
      by_name: byName || ''
    };
    if (hasCloud) {
      try {
        const inserted = await rest('scores', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row)
        });
        return inserted && inserted[0];
      } catch (e) {
        // Unique violation => already submitted for this seat.
        if (String(e.message).includes('409') || String(e.message).includes('duplicate')) {
          throw new Error('already_submitted');
        }
        throw e;
      }
    }
    const list = lsGet(LS_S);
    if (list.some((s) => s.contestant_id === contestantId && s.seat === seat)) {
      throw new Error('already_submitted');
    }
    row.id = uid();
    row.created_at = Date.now();
    list.push(row);
    lsSet(LS_S, list);
    return row;
  }

  // ---------- Admin reset ----------
  async function resetAll() {
    if (hasCloud) {
      // Deleting all contestants cascades to scores.
      await rest('contestants?id=not.is.null', { method: 'DELETE' });
      // Clean up any orphan scores just in case.
      await rest('scores?id=not.is.null', { method: 'DELETE' }).catch(() => {});
      return true;
    }
    lsSet(LS_C, []);
    lsSet(LS_S, []);
    return true;
  }

  return {
    hasCloud,
    listContestants,
    addContestant,
    duplicateExists,
    deleteContestant,
    listScores,
    listScoresFor,
    submitScore,
    resetAll
  };
})();
