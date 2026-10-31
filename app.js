// app.js — web app controller (vanilla JS, no build step).
(() => {
  const cfg = window.APP_CONFIG || {};
  const JUDGES = cfg.JUDGES || [];
  const DIMS = cfg.DIMENSIONS || [];

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
    const [contestants, scores] = await Promise.all([DB.listContestants(), DB.listScores()]);
    return { contestants, scores };
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
            <div class="hero-title">🎤 吨 · 百业歌唱比赛</div>
            <div class="hero-sub">报名 · 评委打分 · 自动统计成绩</div>
          </div>
          ${userChip}
        </div>
      </div>
      <div class="card stats">
        <div class="stat"><div class="stat-num" id="s-contestants">–</div><div class="stat-label">报名选手</div></div>
        <div class="stat"><div class="stat-num">${JUDGES.length}</div><div class="stat-label">评委人数</div></div>
        <div class="stat"><div class="stat-num" id="s-scored">–</div><div class="stat-label">已出成绩</div></div>
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
        <div class="section-title">计分规则</div>
        <div class="muted">共 ${JUDGES.length} 位评委打分，每位满分 100。全部评委打完后，去掉一个最高分和一个最低分，取剩余平均分作为最终成绩。</div>
      </div>`;

    const hu = document.getElementById('hero-user'); if (hu) hu.onclick = () => go('me');
    const hl = document.getElementById('hero-login'); if (hl) hl.onclick = () => go('me');
    view.querySelectorAll('[data-go]').forEach((el) => (el.onclick = () => go(el.dataset.go)));

    // Fill stats asynchronously so the page paints instantly.
    try {
      const { contestants, scores } = await fetchAll();
      const grouped = Scoring.groupScores(scores);
      const scored = contestants.filter((c) => Scoring.computeFinal(grouped[c.id]).final !== null).length;
      const a = document.getElementById('s-contestants'); if (a) a.textContent = contestants.length;
      const b = document.getElementById('s-scored'); if (b) b.textContent = scored;
    } catch (e) {
      const a = document.getElementById('s-contestants'); if (a) a.textContent = '0';
      const b = document.getElementById('s-scored'); if (b) b.textContent = '0';
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
      const { contestants, scores } = await fetchAll();
      const grouped = Scoring.groupScores(scores);
      if (!contestants.length) {
        view.innerHTML = cloudNotice() + `<div class="empty"><div style="font-size:48px">🎵</div>还没有选手报名<br/><button class="btn btn-ghost btn-sm" style="margin-top:14px" id="go-signup">去报名</button></div>`;
        const b = document.getElementById('go-signup'); if (b) b.onclick = () => go('signup');
        return;
      }
      const rows = contestants.map((c) => {
        const r = Scoring.computeFinal(grouped[c.id]);
        const canDelete = !!(u && c.owner_token && u.token === c.owner_token);
        const statusText = r.submitted === 0 ? '未打分' : (r.submitted < r.judgeCount ? `打分中 ${r.submitted}/${r.judgeCount}` : '已完成');
        const statusCls = r.submitted === 0 ? 'none' : (r.submitted < r.judgeCount ? 'ing' : 'done');
        return `<div class="card">
          <div class="contestant">
            <div class="num">${c.number}</div>
            <div class="c-info">
              <div class="c-name">${esc(c.name)}</div>
              <div class="c-song">《${esc(c.song)}》 · ${esc(c.language)}</div>
            </div>
            <div class="c-score">
              ${r.final !== null ? `<div class="num-big">${r.final}</div>` : ''}
              <div class="status ${statusCls}">${statusText}</div>
            </div>
          </div>
          <div class="row-actions">
            ${canDelete ? `<a class="danger" data-del="${c.id}">删除报名</a>` : ''}
            <a data-judge="${c.id}">打分 ›</a>
          </div>
        </div>`;
      }).join('');
      view.innerHTML = cloudNotice() + `<div class="grid-list">${rows}</div>`;

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
      const [contestants, scoreRows] = await Promise.all([DB.listContestants(), DB.listScoresFor(contestantId)]);
      const c = contestants.find((x) => x.id === contestantId);
      if (!c) { view.innerHTML = `<div class="empty">未找到该选手</div>`; return; }

      const seatMap = {}; scoreRows.forEach((s) => (seatMap[s.seat] = s));
      const mine = seatMap[mySeat] || null;
      const submitted = !!mine;
      const dims = (mine && mine.dims) || {};
      const final = Scoring.computeFinal(seatMap);

      const seatsHTML = JUDGES.map((j) => {
        const e = seatMap[j.seat];
        const cls = (j.seat === mySeat ? 'mine ' : '') + (e ? 'scored' : '');
        return `<div class="seat ${cls}"><div class="s-label">${j.seat + 1}号${j.seat === mySeat ? '（我）' : ''}</div><div class="s-sub">${e ? e.total + '分' : '未打'}</div></div>`;
      }).join('');

      const dimHTML = DIMS.map((d) => `
        <div class="dim">
          <div><span class="d-label">${esc(d.label)}</span><span class="d-max">/ ${d.max}</span></div>
          <input type="number" inputmode="numeric" data-dim="${d.key}" data-max="${d.max}" ${submitted ? 'disabled' : ''} value="${typeof dims[d.key] === 'number' ? dims[d.key] : ''}" placeholder="0" />
        </div>`).join('');

      view.innerHTML = `
        <div class="banner">${mySeat + 1}号评委 · ${esc(u.name)}</div>
        <div class="card" style="background:linear-gradient(135deg,var(--brand),var(--brand-2));color:#fff;">
          <div style="font-size:19px;font-weight:800;">${c.number}. ${esc(c.name)}</div>
          <div class="muted" style="color:rgba(255,255,255,.92)">《${esc(c.song)}》 · ${esc(c.language)}</div>
          ${final.final !== null ? `<div style="margin-top:8px;font-size:13px;">当前成绩 <b style="font-size:20px">${final.final}</b> <span style="opacity:.85">（${final.submitted}/${final.judgeCount} 评委）</span></div>` : ''}
        </div>
        <div class="card">
          <div class="section-title">评委打分进度</div>
          <div class="seats">${seatsHTML}</div>
          <div class="muted" style="margin-top:12px">你只能查看并编辑自己（${mySeat + 1}号）的打分，其他评委的分数不可更改。</div>
        </div>
        <div class="card">
          <div class="section-title">我的打分（${mySeat + 1}号 · 满分 100）${submitted ? '<span class="locked-tag">已锁定</span>' : ''}</div>
          ${dimHTML}
          <div class="total-row"><span>合计</span><span class="big" id="j-total">0</span></div>
          ${submitted
            ? `<div class="locked-box">✓ 你已提交并锁定，分数不可修改。</div>`
            : `<button class="btn btn-primary" id="j-submit">提交我的打分</button><div class="muted" style="text-align:center;margin-top:8px">提交后将锁定，不能再修改。</div>`}
        </div>
        ${final.final !== null ? `<button class="btn btn-ghost" id="j-results">查看成绩排行 ›</button>` : ''}`;

      function recalc() {
        let t = 0;
        view.querySelectorAll('[data-dim]').forEach((inp) => { const n = Number(inp.value); if (!isNaN(n)) t += n; });
        const el = document.getElementById('j-total'); if (el) el.textContent = Scoring.round2(t);
      }
      view.querySelectorAll('[data-dim]').forEach((inp) => {
        inp.oninput = recalc;
        inp.onblur = () => {
          if (inp.value === '') return;
          let n = Number(inp.value); const max = Number(inp.dataset.max);
          if (isNaN(n)) n = 0; n = Math.max(0, Math.min(max, Math.round(n)));
          inp.value = n; recalc();
        };
      });
      recalc();

      const rb = document.getElementById('j-results'); if (rb) rb.onclick = () => go('results');

      const sb = document.getElementById('j-submit');
      if (sb) sb.onclick = () => {
        const dimsOut = {}; let total = 0; let ok = true;
        view.querySelectorAll('[data-dim]').forEach((inp) => {
          const max = Number(inp.dataset.max);
          if (inp.value === '' || isNaN(Number(inp.value))) ok = false;
          let n = Math.max(0, Math.min(max, Math.round(Number(inp.value) || 0)));
          dimsOut[inp.dataset.dim] = n; total += n;
        });
        if (!ok) return toast('请填写所有评分项');
        total = Scoring.round2(total);
        modal({
          title: '确认提交',
          bodyHTML: '<div class="muted">分数提交后将锁定，不能再修改。确定提交？</div>',
          onConfirm: async (close) => {
            try {
              await DB.submitScore(contestantId, mySeat, dimsOut, total, u.name);
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

  // ---- Results ----
  async function renderResults() {
    view.innerHTML = `<div class="empty">加载中…</div>`;
    try {
      const { contestants, scores } = await fetchAll();
      const rows = Scoring.leaderboard(contestants, scores);
      if (!rows.length) { view.innerHTML = cloudNotice() + `<div class="empty"><div style="font-size:48px">🏆</div>暂无成绩</div>`; return; }
      const complete = rows.filter((r) => r.complete && r.final !== null);
      const champ = complete[0] || null;

      const champHTML = champ
        ? `<div class="card champion span-all"><div class="crown">👑</div><div class="c-title">冠军</div><div class="c-name">${esc(champ.name)}</div><div class="muted" style="color:rgba(255,255,255,.95)">《${esc(champ.song)}》 · ${esc(champ.language)}</div><div class="c-score">${champ.final} 分</div></div>`
        : `<div class="card span-all"><div class="muted">还没有选手完成全部 ${Scoring.JUDGE_COUNT} 位评委的打分，暂未产生冠军。下方为当前进度。</div></div>`;

      const listHTML = rows.map((r) => `
        <div class="card rank">
          <div class="rank-badge r${r.rank || 0}">${r.rank === null ? '-' : r.rank}</div>
          <div class="c-info">
            <div class="c-name">${esc(r.name)}</div>
            <div class="c-song">《${esc(r.song)}》 · ${esc(r.language)}</div>
            ${!r.complete ? `<div class="muted" style="font-size:12px">打分进度 ${r.submitted}/${r.judgeCount}</div>` : ''}
          </div>
          <div class="c-score">${r.final !== null ? `<div class="num-big">${r.final}</div>` : '<div class="muted">未出分</div>'}</div>
        </div>`).join('');

      view.innerHTML = cloudNotice() +
        `<div class="grid-list">
          ${champHTML}
          <div class="section-title span-all" style="padding:0 4px">完整排名</div>
          ${listHTML}
          <button class="btn btn-ghost span-all" id="r-reset">清空所有数据</button>
        </div>`;

      document.getElementById('r-reset').onclick = () => {
        modal({
          title: '清空所有数据', danger: true, confirmText: '清空',
          bodyHTML: `<div class="muted">将删除全部选手与打分，且不可恢复。请输入管理员口令：</div><input id="reset-code" type="password" style="margin-top:10px" placeholder="管理员口令" />`,
          onConfirm: async (close) => {
            const code = document.getElementById('reset-code').value;
            if (code !== cfg.ADMIN_CODE) { toast('口令不正确'); return; }
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
        <div class="muted credit-line">本小程序由 <span class="name">明明</span> 制作，版权归 明明 所有。</div>
        <div class="muted credit-line">如果有小程序问题，请联系明明。</div>
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
