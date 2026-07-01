import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** Public how-to for paid billboard campaigns - `/advertise/how-it-works`. */
export function advertiseGuidePageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>How advertising works - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .adv-guide-page .ms-doc-title { margin-bottom: 0.35rem; }
    .adv-guide-lead {
      font-size: 1rem;
      color: #9fb0c7;
      margin: 0 0 1.25rem;
      max-width: 42rem;
      line-height: 1.55;
    }
    .adv-guide-panel {
      max-width: 42rem;
      margin: 0 0 1rem;
      padding: 1rem 1.1rem;
      border: 1px solid #263348;
      border-radius: 12px;
      background: #0f1622;
    }
    .adv-guide-panel h2 {
      margin: 0 0 0.65rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #e6edf3;
    }
    .adv-guide-steps {
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: adv-step;
    }
    .adv-guide-steps > li {
      counter-increment: adv-step;
      position: relative;
      padding: 0 0 1rem 2.35rem;
      border-left: 2px solid #1e293b;
      margin-left: 0.65rem;
    }
    .adv-guide-steps > li:last-child {
      padding-bottom: 0;
      border-left-color: transparent;
    }
    .adv-guide-steps > li::before {
      content: counter(adv-step);
      position: absolute;
      left: -0.95rem;
      top: 0;
      width: 1.55rem;
      height: 1.55rem;
      border-radius: 999px;
      background: var(--ms-accent);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .adv-guide-steps h3 {
      margin: 0 0 0.35rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #c8d4e4;
    }
    .adv-guide-steps p {
      margin: 0;
      font-size: 0.9rem;
      color: #9fb0c7;
      line-height: 1.5;
    }
    .adv-guide-note {
      margin: 0.75rem 0 0;
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      background: #0a1018;
      border: 1px solid #263348;
      font-size: 0.85rem;
      color: #7b8da8;
      line-height: 1.45;
    }
    .adv-guide-note strong { color: #c8d4e4; font-weight: 600; }
    .adv-guide-faq { margin: 0; padding: 0; list-style: none; }
    .adv-guide-faq li { margin-bottom: 0.85rem; }
    .adv-guide-faq li:last-child { margin-bottom: 0; }
    .adv-guide-faq h3 {
      margin: 0 0 0.25rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: #c8d4e4;
    }
    .adv-guide-faq p {
      margin: 0;
      font-size: 0.875rem;
      color: #9fb0c7;
      line-height: 1.45;
    }
    .adv-guide-cta {
      margin-top: 1.25rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .adv-guide-cta a {
      display: inline-block;
      background: var(--ms-accent);
      color: #ffffff;
      border: 1px solid var(--ms-accent-hover-border);
      border-radius: 8px;
      padding: 0.5rem 0.9rem;
      font-size: 0.9375rem;
      font-weight: 700;
      text-decoration: none;
    }
    .adv-guide-cta a.secondary {
      background: #1a2433;
      border-color: #334155;
      color: #c8d4e4;
      font-weight: 600;
    }
  </style>
</head>
<body class="ms-site adv-guide-page">
  ${analyticsTopbarHtml("advertise")}
  <h1 class="ms-doc-title">How advertising works</h1>
  <p class="adv-guide-lead">
    Paid billboards in Nimiq Space run on <strong>prepaid visibility</strong>: you fund NIM up front,
    your advert appears on billboards around the game, and your balance drains only while active players
    can actually see it nearby.
  </p>

  <div class="adv-guide-panel">
    <h2>From campaign to in-game advert</h2>
    <ol class="adv-guide-steps">
      <li>
        <h3>Sign in and create a campaign</h3>
        <p>
          Open <a href="/advertise">Advertise</a>, connect your Nimiq wallet, and use the
          <strong>New</strong> tab. Add your <strong>project name</strong>, <strong>project URL</strong>
          (where players go when they tap Visit), a <strong>billboard image</strong>, and how long each
          on-screen slide lasts (10, 30, or 45 seconds).
        </p>
      </li>
      <li>
        <h3>Fund with NIM</h3>
        <p>
          Click <strong>Fund</strong>, enter any amount, and pay with your wallet (Nimiq Pay or Hub).
          There is no fixed minimum - more NIM buys more on-screen time. At the default rate,
          <strong>400 NIM ≈ 24 hours</strong> of full-audience display while players are watching.
        </p>
      </li>
      <li>
        <h3>Wait for admin approval</h3>
        <p>
          After payment confirms on chain, status becomes <strong>Pending approval</strong>.
          Operators review your image and target URL before the campaign can go live.
        </p>
      </li>
      <li>
        <h3>Your advert goes on billboards</h3>
        <p>
          Once approved, your campaign is placed on <strong>billboards around Nimiq Space</strong>.
          Status shows <strong>Live</strong> when players can see it in-game, or
          <strong>Approved · Not Live</strong> while placement is still being set up. Your balance is
          not used until the advert is live.
        </p>
      </li>
      <li>
        <h3>Players see your advert in game</h3>
        <p>
          When live, nearby players see your image on billboards in the world. Players within
          <strong>14 blocks</strong> who have the game tab open and are not AFK count as viewers.
          Tapping <strong>Visit</strong> opens your project URL.
        </p>
      </li>
      <li>
        <h3>Balance drains from real views</h3>
        <p>
          Your prepaid balance goes down only for verified on-screen time - not idle calendar days.
          The <strong>Existing</strong> tab shows time left, NIM remaining, audience stats, and
          transaction history. When balance reaches zero, the campaign ends and is taken off billboards.
        </p>
      </li>
      <li>
        <h3>Top up while live</h3>
        <p>
          On approved campaigns (including <strong>Live</strong>), use <strong>Add funds</strong> to
          increase prepaid balance without re-approval and without taking the advert offline.
        </p>
      </li>
    </ol>
    <p class="adv-guide-note">
      <strong>Live vs Not Live:</strong> <strong>Live</strong> means your advert is on billboards in the
      game right now. <strong>Not Live</strong> means approved but not yet visible to players - your
      balance is safe until it goes live.
    </p>
  </div>

  <div class="adv-guide-panel">
    <h2>Common questions</h2>
    <ul class="adv-guide-faq">
      <li>
        <h3>Why is my time-left estimate not a calendar date?</h3>
        <p>
          Time left is <strong>remaining balance ÷ on-screen rate</strong>. If few players are nearby,
          your advert lasts longer in real-world days; busy periods use balance faster.
        </p>
      </li>
      <li>
        <h3>What counts as a viewer?</h3>
        <p>
          A unique wallet within 14 blocks of the billboard, game tab visible, not AFK for 2+ minutes,
          and not in a wallet-send flow. Stats on your dashboard match what billing uses.
        </p>
      </li>
      <li>
        <h3>Can I change my image after funding?</h3>
        <p>
          Draft fields lock after you leave draft status. Contact operators if you need a correction
          before approval; after approval, use support for exceptional changes.
        </p>
      </li>
      <li>
        <h3>Can I change on-screen duration?</h3>
        <p>
          Yes - on the <strong>Existing</strong> tab you can update slide dwell (10 / 30 / 45 s) after
          funding. Longer dwell means each time your slide is shown costs more prepaid time when players watch.
        </p>
      </li>
    </ul>
    <div class="adv-guide-cta">
      <a href="/advertise">Open Advertise dashboard</a>
      <a class="secondary" href="/">Play Nimiq Space</a>
    </div>
  </div>
</body>
</html>`;
}
