# 吨 · 百业歌唱比赛 · 网页版 (Song Contest — Web App)

一个纯网页版的歌唱比赛报名 + 评委打分应用，**任何手机/电脑用浏览器打开链接即可使用**，多设备共享同一份数据。无需微信小程序账号、无需手机号/实名。界面与配色、标题、文案与 `150luck/` 小程序版保持一致，并做了**全面响应式适配**（手机竖屏、平板、桌面都自适应；大屏居中成卡片面板）。

> 这是独立的网页版，和 `150luck/` 里的微信小程序版本互不影响。

## ⚠️ 还差一步：填入 Supabase anon key

`config.js` 里已经填好了你的 `SUPABASE_URL`（`https://majammoshybzjvokzkly.supabase.co`）。
**还需要把 anon public key 填进 `SUPABASE_ANON_KEY`**（Supabase 后台 → Project Settings → API → `anon` `public`）。
填好后再按下面「开启多设备同步」第 4 步跑一次建表 SQL，就能真正跨设备同步。在填好之前，页面顶部会显示“本机演示模式”。

## 为什么用网页版

你的微信是测试号，无法开通云开发、也无法分享给别人。网页版绕开这些限制：
- 用免费的静态托管（GitHub Pages / Netlify / Vercel）放网页；
- 用免费的 **Supabase**（只需邮箱注册，无需手机/实名）做数据库，实现多设备同步；
- 全部免费。

## 登录说明（关于“微信一键登录”）

纯网页**做不到**微信小程序那种一键抓取昵称的登录——那需要已认证的微信开放平台账号（同样有实名/手机门槛）。所以网页版改为：
- **普通用户**：输入名字即可登录（记在本机浏览器里）。
- **评委**：输入评委名字 + 一个共享口令（`config.js` 里的 `JUDGE_CODE`）才能打分。

规则不变：
- **只有报名者本人能删自己的报名**（用本机随机 token 校验归属）。
- **每位评委只能改自己座位的分**，且**提交后锁定不可改**（数据库对 `(选手, 座位)` 唯一约束 + 无 update/delete 策略）。
- 清空全部数据需要管理员口令（`config.js` 里的 `ADMIN_CODE`）。

## 🔑 密钥与口令（已为你填好）

- `config.js` 已填入你的 **Project URL** 和 **publishable key**（`sb_publishable_...`，可安全放进网页）。
- 评委口令 `JUDGE_CODE` = **`dun-judge-8823`**（发给 5 位评委）。
- 管理员口令 `ADMIN_CODE` = **`dun-admin-7731`**（清空数据用，自己留着）。
- 你可以在 `config.js` 里随时改这两个口令。

> ⚠️ **安全提醒**：你之前贴出的 `sb_secret_...` 是**密钥（secret）**，绝不能放进网页或公开。它已经公开过了，请到 Supabase → Project Settings → API Keys 把它**轮换/重置**。网页版只用 publishable key，不用 secret key。

## 快速开始

### A. 先本地试用（本机演示模式）
直接双击打开 `index.html` 预览界面。注意：直接用 `file://` 打开时浏览器可能限制网络请求，**建议用本地服务器**跑（见下），否则只能看本机演示数据。

本地服务器（任选，在 `song-contest-web` 目录下）：
- Python：`python3 -m http.server 8080` → 浏览器开 `http://localhost:8080`
- Node：`npx serve` 或 `npx http-server`

### B. 建表（只需一次，必做）
1. 打开 Supabase 控制台 → 你的项目。
2. 左侧 **SQL Editor** → **New query** → 把 `supabase_setup.sql` 的内容整段粘贴 → 点 **RUN**。
3. 成功后会创建 `contestants` 和 `scores` 两张表。（在这之前，页面会显示“表不存在”的报错——这是正常的，建完表刷新即可。）

### C. 发布成一个链接发给朋友（免费，推荐 Netlify Drop）
1. 打开 **https://app.netlify.com/drop** （Netlify Drop，不用注册也能先试）。
2. 把整个 **`song-contest-web` 文件夹**拖进页面。
3. 几秒后得到一个 `https://随机名.netlify.app` 链接。
4. 把链接发给朋友，手机/电脑浏览器打开即用，数据实时同步。
   - 想要固定域名/可更新：注册 Netlify 免费账号后，站点 → **Site settings** 可改名；以后更新就再拖一次文件夹（或连 Git 仓库自动部署）。

其他免费托管同理：**Vercel**（导入文件夹）、**GitHub Pages**（推仓库后开启 Pages）。

## 配置（config.js）

| 项 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase 项目地址与匿名密钥（留空则为本机演示模式） |
| `JUDGE_CODE` | 评委打分口令（发给 5 位评委） |
| `ADMIN_CODE` | 清空数据的管理员口令 |
| `JUDGES` | 评委名字 → 固定座位（`seat`） |
| `DIMENSIONS` | 评分维度与满分（各 `max` 之和应为 100） |

## 赛制与计分规则（三轮淘汰制）

- **第一轮**：所有报名选手打分，得分**前 10 名**晋级第二轮。
- **第二轮**：10 人打分，**前 5 名**晋级决赛。
- **决赛**：5 人打分，决出 **1–5 名**；第 1 名为总冠军 👑。

每一轮：每位评委给选手一个 **1–10** 分（单一分值，可带一位小数）。集齐 5 位评委后，**去掉一个最高分和一个最低分**，取剩余 3 位的平均分作为该选手**本轮**成绩。每轮分数相互独立。

### 晋级 / 进入下一轮
- 在 **成绩页** 底部「管理员」卡片，当前轮全部打分完成后，管理员点击「**进入下一轮**」并输入管理员口令 `ADMIN_CODE`，系统自动把本轮前 N 名标记晋级、其余淘汰，并切换到下一轮。
- 晋级前会弹出**晋级名单确认**；若还有选手未打满会给出提醒。
- 各轮配置在 `config.js` 的 `ROUNDS`（`advance` = 该轮晋级人数，最后一轮为 0）。
- 分值范围在 `config.js` 的 `SCORE_MIN` / `SCORE_MAX`。

> 规则不变：**只有报名者本人能删自己的报名**；**每位评委只能打自己座位的分**；**提交后锁定不可改**（数据库对 `(选手, 座位, 轮次)` 唯一约束 + 无 update/delete 策略）。

## 文件结构

```
song-contest-web/
  index.html          页面骨架 + 底部标签栏
  styles.css          样式（与小程序版一致的配色）
  config.js           配置（Supabase、口令、评委、维度）—— 需要你填
  db.js               数据层（Supabase REST，带本机演示回退）
  score.js            计分/排名纯函数
  app.js              应用逻辑（登录、路由、各页面）
  supabase_setup.sql  Supabase 建表脚本（跑一次）
  README.md           本说明
```

## 费用与额度

Supabase 免费版对 20 人以内、5 位评委的比赛绰绰有余，实际 ¥0。免费额度为配额、非永久承诺；静态托管（Netlify/Vercel/Pages）亦为免费。
