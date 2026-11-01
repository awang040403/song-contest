// app.js — web app controller (vanilla JS, no build step).
(() => {
  const cfg = window.APP_CONFIG || {};
  const JUDGES = cfg.JUDGES || [];

  const view = document.getElementById('view');
  const whoEl = document.getElementById('who');
  const tabbar = document.getElementById('tabbar');
  const modalRoot = document.getElementById('modal-root');

  // ---------- identity (per-device, remembered) ----------
  // A "user" = { name, token }. token is a random id used to prove ownership
  // of signups across sessions on this device.
  const USER_KEY = 'sc_user';
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem(USER_KEY); }
  function randToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function judgeSeatOf(name) {
    const j = JUDGES.find((x) => norm(x.name) === norm(name));
    return j ? j.seat : -1;
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:#fff;padding:12px 20px;border-radius:12px;z-index:100;font-size:14px;max-width:80%;text-align:center;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }
  function modal({ title, bodyHTML, confirmText = '确定', cancelText = '取消', onConfirm, danger }) {
    modalRoot.innerHTML = `
      <div class="modal-mask">
        <div class="modal">
          <h3>${esc(title)}</h3>
          <div>${bodyHTML || ''}</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" id="m-cancel">${esc(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger-ghost' : 'btn-primary'}" id="m-ok">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.getElementById('m-cancel').onclick = () => (modalRoot.innerHTML = '');
    document.getElementById('m-ok').onclick = () => {
      const close = () => (modalRoot.innerHTML = '');
      onConfirm ? onConfirm(close) : close();
    };
  }

  function renderWho() {
    const u = getUser();
    if (u) {
      const seat = judgeSeatOf(u.name);
      const tag = seat >= 0 ? ` · ${seat + 1}号评委` : '';
      whoEl.innerHTML = `${esc(u.name)}${tag}`;
    } else {
      whoEl.innerHTML = `<a id="login-link">登录</a>`;
      const l = document.getElementById('login-link');
      if (l) l.onclick = () => go('me');
    }
  }

  // ---------- data cache + fetch ----------
  async function fetchAll() {
    const [contestants, scores, round] = await Promise.all([
      DB.listContestants(), DB.listScores(), DB.getCurrentRound()
    ]);
    return { contestants, scores, round };
  }

  // ============================ VIEWS ============================
  let currentTab = 'home';

  function go(tab, arg) {
    currentTab = tab;
    [...tabbar.querySelectorAll('button')].forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    renderWho();
    if (tab === 'home') renderHome();
    else if (tab === 'signup') renderSignup();
    else if (tab === 'contestants') renderContestants();
    else if (tab === 'results') renderResults();
    else if (tab === 'me') renderMe();
    else if (tab === 'judge') renderJudge(arg);
  }

  function cloudNotice() {
    if (DB.hasCloud) return '';
    return `<div class="notice">⚠️ 当前为<b>本机演示模式</b>（数据只存在这台设备）。要让不同设备共享数据，请按 <b>config.js</b> 里的说明填入 Supabase 配置。</div>`;
  }

  // ---- Home ----
  async function renderHome() {
    const u = getUser();
    const userChip = u
      ? `<div class="hero-user" id="hero-user"><span class="name">${esc(u.name)}</span></div>`
      : `<div class="hero-user" id="hero-login"><span class="name">未登录 · 登录</span></div>`;

    view.innerHTML = `
      ${cloudNotice()}
      <div class="card hero">
        <div class="hero-top">
          <div>
            <div class="hero-title">🎤 吨吨好声音</div>
            <div class="hero-sub">吨百业 主办 · 报名 · 评委打分 · 自动统计成绩</div>
          </div>
          ${userChip}
        </div>
      </div>
      <div class="card stats">
        <div class="stat"><div class="stat-num" id="s-contestants">–</div><div class="stat-label">报名选手</div></div>
        <div class="stat"><div class="stat-num">${JUDGES.length}</div><div class="stat-label">评委人数</div></div>
        <div class="stat"><div class="stat-num" id="s-round">–</div><div class="stat-label">当前阶段</div></div>
      </div>
      <div class="menu-item" data-go="signup">
        <div class="menu-icon">📝</div>
        <div class="menu-text"><div class="menu-title">选手报名</div><div class="muted">填写姓名、曲目、语言等信息</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" data-go="contestants">
        <div class="menu-icon">👥</div>
        <div class="menu-text"><div class="menu-title">选手列表</div><div class="muted">查看报名选手并进入打分</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" data-go="results">
        <div class="menu-icon">🏆</div>
        <div class="menu-text"><div class="menu-title">成绩排行</div><div class="muted">查看最终得分与冠军</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="card">
        <div class="section-title">赛制与计分规则</div>
        <div class="muted">
          三轮淘汰制：<b>第一轮</b>全部选手打分，得分前 10 名晋级；<b>第二轮</b> 10 进 5；<b>决赛</b> 5 人决出 1–5 名。<br/>
          每轮每位评委给 <b>${cfg.SCORE_MIN}–${cfg.SCORE_MAX}</b> 分，去掉一个最高分和一个最低分，取剩余平均分为该选手本轮成绩。每轮分数独立。
        </div>
      </div>
      <div class="card" style="text-align:center">
        <div class="muted">本活动由 <b style="color:var(--brand)">吨百业</b> 主办</div>
      </div>`;

    const hu = document.getElementById('hero-user'); if (hu) hu.onclick = () => go('me');
    const hl = document.getElementById('hero-login'); if (hl) hl.onclick = () => go('me');
    view.querySelectorAll('[data-go]').forEach((el) => (el.onclick = () => go(el.dataset.go)));

    // Fill stats asynchronously so the page paints instantly.
    try {
      const { contestants, round } = await fetchAll();
      const a = document.getElementById('s-contestants'); if (a) a.textContent = contestants.length;
      const b = document.getElementById('s-round'); if (b) b.textContent = Scoring.roundName(round);
    } catch (e) {
      const a = document.getElementById('s-contestants'); if (a) a.textContent = '0';
      const b = document.getElementById('s-round'); if (b) b.textContent = '第一轮';
    }
  }

  // ---- Signup ----
  function renderSignup() {
    const u = getUser();
    const langs = ['国语', '粤语', '英语', '日语', '韩语', '其他'];
    view.innerHTML = `
      ${cloudNotice()}
      ${!u ? `<div class="card" style="background:linear-gradient(135deg,var(--brand),var(--brand-2));color:#fff;cursor:pointer" id="signup-login"><b>先登录</b><div class="muted" style="color:rgba(255,255,255,.9)">登录后自动填入你的名字，且只有你能删除自己的报名</div></div>` : ''}
      <div class="card">
        <div class="section-title">选手报名</div>
        <label>姓名<span class="req">*</span></label>
        <input id="f-name" maxlength="20" value="${u ? esc(u.name) : ''}" placeholder="请输入姓名" />
        <label>演唱曲目<span class="req">*</span></label>
        <input id="f-song" maxlength="40" placeholder="请输入歌曲名称" />
        <label>演唱语言<span class="req">*</span></label>
        <select id="f-lang">
          <option value="">请选择语言</option>
          ${langs.map((l) => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <div id="f-lang-other-wrap" class="hidden">
          <label>其他语言</label>
          <input id="f-lang-other" maxlength="20" placeholder="请填写语言" />
        </div>
        <label>原唱 / 作者</label>
        <input id="f-artist" maxlength="30" placeholder="选填" />
        <label>联系方式</label>
        <input id="f-contact" maxlength="30" placeholder="选填" />
        <label>备注</label>
        <textarea id="f-note" maxlength="100" placeholder="选填"></textarea>
        <button class="btn btn-primary" id="f-submit">提交报名</button>
      </div>`;

    const loginBtn = document.getElementById('signup-login');
    if (loginBtn) loginBtn.onclick = () => go('me');

    const langSel = document.getElementById('f-lang');
    langSel.onchange = () => {
      document.getElementById('f-lang-other-wrap').classList.toggle('hidden', langSel.value !== '其他');
    };

    document.getElementById('f-submit').onclick = async () => {
      const user = getUser();
      if (!user) { modal({ title: '请先登录', bodyHTML: '<div class="muted">报名需要先登录，之后只有你本人能删除。</div>', confirmText: '去登录', onConfirm: (c) => { c(); go('me'); } }); return; }
      const name = document.getElementById('f-name').value.trim();
      const song = document.getElementById('f-song').value.trim();
      let language = langSel.value;
      if (language === '其他') language = document.getElementById('f-lang-other').value.trim();
      if (!name) return toast('请填写姓名');
      if (!song) return toast('请填写演唱曲目');
      if (!language) return toast('请选择演唱语言');

      const btn = document.getElementById('f-submit');
      btn.disabled = true; btn.textContent = '提交中…';
      try {
        if (await DB.duplicateExists(name, song)) { toast('该选手曲目已报名'); btn.disabled = false; btn.textContent = '提交报名'; return; }
        await DB.addContestant({
          name, song, language,
          artist: document.getElementById('f-artist').value.trim(),
          contact: document.getElementById('f-contact').value.trim(),
          note: document.getElementById('f-note').value.trim(),
          owner: user.name,
          owner_token: user.token
        });
        toast('报名成功');
        setTimeout(() => go('contestants'), 600);
      } catch (e) {
        toast('报名失败：' + e.message);
        btn.disabled = false; btn.textContent = '提交报名';
      }
    };
  }

  // ---- Contestants ----
  async function renderContestants() {
    view.innerHTML = `<div class="empty">加载中…</div>`;
    try {
      const u = getUser();
      const { contestants, scores, round } = await fetchAll();
      const grouped = Scoring.groupScores(scores);
      if (!contestants.length) {
        view.innerHTML = cloudNotice() + `<div class="empty"><div style="font-size:48px">🎵</div>还没有选手报名<br/><button class="btn btn-ghost btn-sm" style="margin-top:14px" id="go-signup">去报名</button></div>`;
        const b = document.getElementById('go-signup'); if (b) b.onclick = () => go('signup');
        return;
      }
      const roundName = Scoring.roundName(round);
      // Contestants still in the current round come first; eliminated ones after.
      const inRound = contestants.filter((c) => (c.advanced_to || 1) >= round);
      const out = contestants.filter((c) => (c.advanced_to || 1) < round);

      function rowHTML(c, eliminated) {
        const seatMap = grouped[c.id] && grouped[c.id][round];
        const r = Scoring.computeRound(seatMap);
        const canDelete = !!(u && c.owner_token && u.token === c.owner_token);
        const statusText = eliminated ? '已淘汰'
          : (r.submitted === 0 ? '未打分' : (r.submitted < r.judgeCount ? `打分中 ${r.submitted}/${r.judgeCount}` : '已完成'));
        const statusCls = eliminated ? 'none' : (r.submitted === 0 ? 'none' : (r.submitted < r.judgeCount ? 'ing' : 'done'));
        return `<div class="card" ${eliminated ? 'style="opacity:.55"' : ''}>
          <div class="contestant">
            <div class="num">${c.number}</div>
            <div class="c-info">
              <div class="c-name">${esc(c.name)}</div>
              <div class="c-song">《${esc(c.song)}》 · ${esc(c.language)}</div>
            </div>
            <div class="c-score">
              ${(!eliminated && r.final !== null) ? `<div class="num-big">${r.final}</div>` : ''}
              <div class="status ${statusCls}">${statusText}</div>
            </div>
          </div>
          <div class="row-actions">
            ${canDelete ? `<a class="danger" data-del="${c.id}">删除报名</a>` : ''}
            ${eliminated ? '' : `<a data-judge="${c.id}">打分 ›</a>`}
          </div>
        </div>`;
      }

      const inHTML = inRound.map((c) => rowHTML(c, false)).join('');
      const outHTML = out.length
        ? `<div class="section-title span-all" style="margin-top:6px">已淘汰</div>` + out.map((c) => rowHTML(c, true)).join('')
        : '';

      view.innerHTML = cloudNotice() +
        `<div class="banner">当前：${roundName} · 共 ${inRound.length} 位选手</div>` +
        `<div class="grid-list">${inHTML}${outHTML}</div>`;

      view.querySelectorAll('[data-judge]').forEach((a) => a.onclick = () => go('judge', a.dataset.judge));
      view.querySelectorAll('[data-del]').forEach((a) => a.onclick = () => {
        const id = a.dataset.del;
        const c = contestants.find((x) => x.id === id);
        modal({
          title: '删除报名', danger: true, confirmText: '删除',
          bodyHTML: `<div class="muted">确定删除你的报名「${esc(c.name)} - ${esc(c.song)}」？</div>`,
          onConfirm: async (close) => {
            try { await DB.deleteContestant(id, u.token); close(); toast('已删除'); renderContestants(); }
            catch (e) { close(); toast(e.message === 'not_owner' ? '只有报名者本人可删除' : '删除失败'); }
          }
        });
      });
    } catch (e) {
      view.innerHTML = cloudNotice() + `<div class="empty">⚠️ 加载失败：${esc(e.message)}</div>`;
    }
  }

  // ---- Judge (scoring) ----
  async function renderJudge(contestantId) {
    const u = getUser();
    if (!u) {
      view.innerHTML = `<div class="empty"><div style="font-size:48px">🔒</div>请先登录<br/><button class="btn btn-ghost btn-sm" style="margin-top:14px" id="j-login">去登录</button></div>`;
      document.getElementById('j-login').onclick = () => go('me');
      return;
    }
    const mySeat = judgeSeatOf(u.name);
    if (mySeat < 0) {
      view.innerHTML = `<div class="empty"><div style="font-size:48px">⛔</div>当前账号「${esc(u.name)}」不是授权评委，无法打分。<br/><button class="btn btn-ghost btn-sm" style="margin-top:14px" id="j-back">返回</button></div>`;
      document.getElementById('j-back').onclick = () => go('contestants');
      return;
    }

    view.innerHTML = `<div class="empty">加载中…</div>`;
    try {
      const [contestants, scoreRows, round] = await Promise.all([
        DB.listContestants(), DB.listScoresFor(contestantId), DB.getCurrentRound()
      ]);
      const c = contestants.find((x) => x.id === contestantId);
      if (!c) { view.innerHTML = `<div class="empty">未找到该选手</div>`; return; }

      const roundName = Scoring.roundName(round);

      // Contestant must still be in the current round to be scored.
      if ((c.advanced_to || 1) < round) {
        view.innerHTML = `<div class="empty"><div style="font-size:48px">🚫</div>「${esc(c.name)}」已在上一轮被淘汰，${roundName}不可打分。<br/><button class="btn btn-ghost btn-sm" style="margin-top:14px" id="j-back">返回</button></div>`;
        document.getElementById('j-back').onclick = () => go('contestants');
        return;
      }

      // Only this round's scores matter here.
      const seatMap = {};
      scoreRows.forEach((s) => { if ((s.round || 1) === round) seatMap[s.seat] = s; });
      const mine = seatMap[mySeat] || null;
      const submitted = !!mine;
      const myVal = mine && mine.value !== undefined && mine.value !== null ? mine.value : '';
      const final = Scoring.computeRound(seatMap);

      const seatsHTML = JUDGES.map((j) => {
        const e = seatMap[j.seat];
        const cls = (j.seat === mySeat ? 'mine ' : '') + (e ? 'scored' : '');
        return `<div class="seat ${cls}"><div class="s-label">${esc(j.name)}${j.seat === mySeat ? '（我）' : ''}</div><div class="s-sub">${e ? e.value + '分' : '未打'}</div></div>`;
      }).join('');

      view.innerHTML = `
        <div class="banner">${roundName} · ${esc(u.name)}（${mySeat + 1}号评委）</div>
        <div class="card hero">
          <div style="font-size:19px;font-weight:800;position:relative;z-index:1">${c.number}. ${esc(c.name)}</div>
          <div class="muted" style="color:rgba(255,255,255,.92);position:relative;z-index:1">《${esc(c.song)}》 · ${esc(c.language)}</div>
          ${final.final !== null ? `<div style="margin-top:8px;font-size:13px;position:relative;z-index:1">本轮成绩 <b style="font-size:20px">${final.final}</b> <span style="opacity:.85">（${final.submitted}/${final.judgeCount} 评委）</span></div>` : ''}
        </div>
        <div class="card">
          <div class="section-title">本轮评委打分进度</div>
          <div class="seats">${seatsHTML}</div>
          <div class="muted" style="margin-top:12px">你只能查看并编辑自己的打分，其他评委的分数不可更改。</div>
        </div>
        <div class="card">
          <div class="section-title">我的打分 · ${roundName}（${cfg.SCORE_MIN}–${cfg.SCORE_MAX} 分）${submitted ? '<span class="locked-tag">已锁定</span>' : ''}</div>
          <div class="dim" style="border-bottom:none">
            <div><span class="d-label">评分</span><span class="d-max">${cfg.SCORE_MIN} – ${cfg.SCORE_MAX}</span></div>
            <input id="j-score" type="number" inputmode="decimal" step="0.1" ${submitted ? 'disabled' : ''} value="${myVal}" placeholder="${cfg.SCORE_MIN}-${cfg.SCORE_MAX}" />
          </div>
          ${submitted
            ? `<div class="locked-box" style="margin-top:12px">✓ 你已提交并锁定，分数不可修改。</div>`
            : `<button class="btn btn-primary" id="j-submit">提交我的打分</button><div class="muted" style="text-align:center;margin-top:8px">提交后将锁定，不能再修改。</div>`}
        </div>
        <button class="btn btn-ghost" id="j-results">查看成绩排行 ›</button>`;

      const rb = document.getElementById('j-results'); if (rb) rb.onclick = () => go('results');

      const inp = document.getElementById('j-score');
      if (inp && !submitted) {
        inp.onblur = () => {
          if (inp.value === '') return;
          let n = Number(inp.value);
          if (isNaN(n)) { inp.value = ''; return; }
          n = Math.max(cfg.SCORE_MIN, Math.min(cfg.SCORE_MAX, n));
          inp.value = n;
        };
      }

      const sb = document.getElementById('j-submit');
      if (sb) sb.onclick = () => {
        if (inp.value === '' || isNaN(Number(inp.value))) return toast(`请填写 ${cfg.SCORE_MIN}-${cfg.SCORE_MAX} 的分数`);
        let v = Math.max(cfg.SCORE_MIN, Math.min(cfg.SCORE_MAX, Number(inp.value)));
        v = Math.round(v * 10) / 10; // allow one decimal
        modal({
          title: '确认提交',
          bodyHTML: `<div class="muted">你给「${esc(c.name)}」打 <b>${v}</b> 分（${roundName}）。提交后将锁定，不能再修改。</div>`,
          onConfirm: async (close) => {
            try {
              await DB.submitScore(contestantId, mySeat, round, v, u.name);
              close(); toast('提交成功'); renderJudge(contestantId);
            } catch (e) {
              close();
              toast(e.message === 'already_submitted' ? '已提交，不可修改' : '提交失败');
              if (e.message === 'already_submitted') renderJudge(contestantId);
            }
          }
        });
      };
    } catch (e) {
      view.innerHTML = `<div class="empty">⚠️ 加载失败：${esc(e.message)}</div>`;
    }
  }

  // ---- Results (multi-round) ----
  async function renderResults() {
    view.innerHTML = `<div class="empty">加载中…</div>`;
    try {
      const { contestants, scores, round } = await fetchAll();
      if (!contestants.length) { view.innerHTML = cloudNotice() + `<div class="empty"><div style="font-size:48px">🏆</div>暂无成绩</div>`; return; }

      const ROUNDS = Scoring.ROUNDS;
      const lastRoundKey = ROUNDS[ROUNDS.length - 1].key;

      // Champion = #1 of the final round, only once the final round is complete.
      let champHTML = '';
      const finalRows = Scoring.leaderboard(contestants, scores, lastRoundKey);
      const finalComplete = finalRows.length > 0 && finalRows.every((r) => r.complete);
      if (round >= lastRoundKey && finalComplete && finalRows[0] && finalRows[0].final !== null) {
        const champ = finalRows[0];
        champHTML = `<div class="card champion span-all"><div class="crown">👑</div><div class="c-title">总冠军</div><div class="c-name">${esc(champ.name)}</div><div class="muted" style="color:rgba(255,255,255,.95)">《${esc(champ.song)}》 · ${esc(champ.language)}</div><div class="c-score">${champ.final} 分</div></div>`;
      }

      // Build a section for each round that has started (round key <= current).
      let sections = '';
      ROUNDS.forEach((rd) => {
        if (rd.key > round) return; // round not started yet
        const rows = Scoring.leaderboard(contestants, scores, rd.key);
        if (!rows.length) return;
        const isCurrent = rd.key === round;
        const tag = isCurrent ? '<span class="pill" style="margin-left:8px">进行中</span>' : '';
        const listHTML = rows.map((r) => {
          // Highlight who advanced (top N) in rounds that have an advance cutoff.
          const advanced = rd.advance > 0 && r.rank !== null && r.rank <= rd.advance;
          return `<div class="card rank">
            <div class="rank-badge r${r.rank || 0}">${r.rank === null ? '-' : r.rank}</div>
            <div class="c-info">
              <div class="c-name">${esc(r.name)} ${advanced ? '<span class="pill ok" style="margin-left:6px">晋级</span>' : ''}</div>
              <div class="c-song">《${esc(r.song)}》 · ${esc(r.language)}</div>
              ${!r.complete ? `<div class="muted" style="font-size:12px">打分进度 ${r.submitted}/${r.judgeCount}</div>` : ''}
            </div>
            <div class="c-score">${r.final !== null ? `<div class="num-big">${r.final}</div>` : '<div class="muted">未出分</div>'}</div>
          </div>`;
        }).join('');
        sections += `<div class="section-title span-all" style="margin-top:6px">${rd.name}排名 ${tag}</div>` + listHTML;
      });

      // Admin "next round" button for the current round (if not the last round).
      const curDef = Scoring.roundDef(round);
      const canAdvance = curDef && curDef.advance > 0;
      const adminHTML = `
        <div class="card span-all" style="background:#f6f7fe">
          <div class="section-title">管理员</div>
          ${canAdvance
            ? `<div class="muted" style="margin-bottom:10px">当前为 <b>${Scoring.roundName(round)}</b>。全部选手打分完成后，点击下方按钮，<b>得分前 ${curDef.advance} 名</b>晋级到下一轮，其余淘汰。</div>
               <button class="btn btn-primary" id="r-next">进入下一轮（保留前 ${curDef.advance} 名）</button>`
            : `<div class="muted" style="margin-bottom:10px">当前为最后一轮 <b>${Scoring.roundName(round)}</b>，排名即为最终名次。</div>`}
          <button class="btn btn-danger-ghost" id="r-reset">清空所有数据</button>
        </div>`;

      view.innerHTML = cloudNotice() +
        `<div class="banner">当前阶段：${Scoring.roundName(round)}</div>` +
        `<div class="grid-list">${champHTML}${sections}${adminHTML}</div>`;

      // Advance round (admin-gated).
      const nextBtn = document.getElementById('r-next');
      if (nextBtn) nextBtn.onclick = () => {
        const rows = Scoring.leaderboard(contestants, scores, round);
        const allComplete = rows.length > 0 && rows.every((r) => r.complete);
        const survivors = rows.filter((r) => r.rank !== null && r.rank <= curDef.advance);
        const survivorIds = survivors.map((r) => r.id);
        const nextKey = round + 1;

        modal({
          title: `进入${Scoring.roundName(nextKey)}`,
          bodyHTML:
            `<div class="muted">将把<b> ${Scoring.roundName(round)} </b>得分前 <b>${curDef.advance}</b> 名晋级到 <b>${Scoring.roundName(nextKey)}</b>，其余选手淘汰。此操作不可撤销。</div>` +
            (allComplete ? '' : `<div class="notice" style="margin-top:10px">⚠️ 还有选手未完成本轮全部评委打分，现在晋级可能不准确。建议打完再操作。</div>`) +
            `<div style="margin-top:10px"><b>晋级名单：</b>${survivors.map((s) => esc(s.name)).join('、') || '（无）'}</div>` +
            `<input id="adv-code" type="password" style="margin-top:12px" placeholder="管理员口令" />`,
          confirmText: '确认晋级',
          onConfirm: async (close) => {
            if (document.getElementById('adv-code').value !== cfg.ADMIN_CODE) { toast('口令不正确'); return; }
            try { await DB.advanceRound(nextKey, survivorIds); close(); toast(`已进入${Scoring.roundName(nextKey)}`); renderResults(); }
            catch (e) { close(); toast('操作失败：' + e.message); }
          }
        });
      };

      document.getElementById('r-reset').onclick = () => {
        modal({
          title: '清空所有数据', danger: true, confirmText: '清空',
          bodyHTML: `<div class="muted">将删除全部选手与打分、并回到第一轮，且不可恢复。请输入管理员口令：</div><input id="reset-code" type="password" style="margin-top:10px" placeholder="管理员口令" />`,
          onConfirm: async (close) => {
            if (document.getElementById('reset-code').value !== cfg.ADMIN_CODE) { toast('口令不正确'); return; }
            try { await DB.resetAll(); close(); toast('已清空'); renderResults(); }
            catch (e) { close(); toast('清空失败：' + e.message); }
          }
        });
      };
    } catch (e) {
      view.innerHTML = cloudNotice() + `<div class="empty">⚠️ 加载失败：${esc(e.message)}</div>`;
    }
  }

  // ---- Me / login ----
  function renderMe() {
    const u = getUser();
    const seat = u ? judgeSeatOf(u.name) : -1;
    view.innerHTML = `
      ${cloudNotice()}
      <div class="card profile-card">
        ${u ? `
          <div class="p-avatar">👤</div>
          <div class="p-name">${esc(u.name)}</div>
          <div class="pill ${seat >= 0 ? 'ok' : ''}" style="margin-top:10px">${seat >= 0 ? '✓ ' + (seat + 1) + '号授权评委' : '普通用户（无打分权限）'}</div>
          <button class="btn btn-ghost" id="me-edit">更改名字</button>
          <button class="btn btn-danger-ghost" id="me-logout">退出登录</button>
        ` : `
          <div class="p-avatar">👤</div>
          <div class="p-name">未登录</div>
          <div class="muted" style="margin:10px 0 16px">输入名字即可登录（评委请使用评委名字 + 口令）</div>
          <label style="text-align:left">名字<span class="req">*</span></label>
          <input id="me-name" maxlength="20" placeholder="请输入你的名字" />
          <label style="text-align:left">评委口令（仅评委需要）</label>
          <input id="me-code" placeholder="非评委可留空" />
          <button class="btn btn-primary" id="me-login">登录</button>
        `}
      </div>
      <div class="card">
        <div class="section-title">授权评委名单</div>
        <div class="muted" style="margin-bottom:10px">只有以下昵称登录（并输入正确口令）后才能进入打分页：</div>
        <div class="judge-list">
          ${JUDGES.map((j) => `<span class="pill">${j.seat + 1}号 · ${esc(j.name)}</span>`).join('')}
        </div>
        <div class="muted" style="margin-top:14px">如需修改评委名单，请联系 明明。</div>
      </div>
      <div class="card credit">
        <div class="section-title">关于</div>
        <div class="muted credit-line"><b>吨吨好声音</b> 由 <span class="name">吨百业</span> 主办。</div>
        <div class="muted credit-line">本应用由 <span class="name">明明</span> 制作，版权归 明明 所有。</div>
        <div class="muted credit-line">如果有应用/技术问题，请联系明明。</div>
        <div class="muted credit-line">如果有报名/成绩相关问题，请联系阿鱼。</div>
      </div>`;

    if (u) {
      document.getElementById('me-edit').onclick = () => { clearUser(); renderMe(); renderWho(); };
      document.getElementById('me-logout').onclick = () => {
        modal({ title: '退出登录', danger: true, confirmText: '退出', bodyHTML: '<div class="muted">确定退出当前账号？</div>', onConfirm: (c) => { clearUser(); c(); renderMe(); renderWho(); } });
      };
    } else {
      document.getElementById('me-login').onclick = () => {
        const name = document.getElementById('me-name').value.trim();
        const code = document.getElementById('me-code').value.trim();
        if (!name) return toast('请输入名字');
        const seat = judgeSeatOf(name);
        if (seat >= 0) {
          // Judge: must provide the shared judge code.
          if (code !== cfg.JUDGE_CODE) return toast('评委口令不正确');
        }
        // Preserve an existing token if this device had one, else create one.
        const prev = getUser();
        setUser({ name, token: (prev && prev.token) || randToken() });
        toast('登录成功');
        renderMe(); renderWho();
      };
    }
  }

  // ---------- boot ----------
  tabbar.querySelectorAll('button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  renderWho();
  go('home');
})();
