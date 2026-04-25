export function analyticsTopbarCss(): string {
  return `
    .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.8rem; margin-bottom: 1.4rem; }
    .title-left { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; flex: 1 1 auto; }
    .brand-title { margin: 0; font-size: clamp(24px, 5.5vw, 40px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; display: inline-flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-start; gap: 0.2em; text-transform: uppercase; min-width: 0; flex: 1 1 auto; }
    .brand-title__nimiq { color: #ffffff; }
    .brand-title__space { color: #fc8702; }
    .analytics-topbar { display: flex; justify-content: flex-end; flex: 0 0 auto; align-items: center; }
    .auth-user { position: relative; z-index: 5; }
    .auth-user-btn { display: inline-flex; align-items: center; gap: 0.45rem; background: #161d2a; color: #d9e3f1; border: 1px solid #2f3d53; border-radius: 999px; padding: 0.22rem 0.48rem; cursor: pointer; }
    .auth-user-btn .ident { width: 22px; height: 22px; border-radius: 4px; }
    .auth-user-menu { position: absolute; right: 0; top: calc(100% + 4px); min-width: 150px; background: #121926; border: 1px solid #2d3c52; border-radius: 8px; padding: 0.35rem; display: none; z-index: 20; }
    .auth-user-menu button { width: 100%; text-align: left; background: transparent; color: #d6e0ef; border: 0; border-radius: 6px; padding: 0.4rem 0.45rem; cursor: pointer; }
    .auth-user-menu button:hover { background: #1f2a3a; }
    @media (max-width: 720px) {
      .title-row { margin-bottom: 1rem; gap: 0.5rem; }
    }
  `;
}

export function analyticsTopbarHtml(): string {
  return `
  <div class="title-row">
    <div class="title-left">
      <h1 class="brand-title"><span class="brand-title__nimiq">NIMIQ</span> <span class="brand-title__space">SPACE</span></h1>
    </div>
    <div class="analytics-topbar">
      <div id="authUser" class="auth-user" style="display:none"></div>
    </div>
  </div>
  `;
}
