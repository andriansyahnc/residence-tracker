# UI snapshots vs PRD / RFC

Browser captures of the MVP, mapped to doc sections. Files live in [`../snapshots/`](../snapshots/) inside this repo.

## Design — Auralis (neuform-top-creators-featured)

Applied tokens: primary `#EA580C`, surface `#191C21`, Geist + JetBrains Mono, split hero login.

| File | Screen |
|------|--------|
| [auralis-login.png](../snapshots/design/auralis-login.png) | Split hero login (dark panel + form card) |

## PRD — §6.4 Mobile-first UX

| File | PRD screen |
|------|------------|
| [6.4-login.png](../snapshots/prd/6.4-login.png) | Sign-in (demo magic link) — Auralis skin |
| [6.4-home-list-resident-empty.png](../snapshots/prd/6.4-home-list-resident-empty.png) | Home / list — resident, empty state |
| [6.4-home-list-resident-with-problem.png](../snapshots/prd/6.4-home-list-resident-with-problem.png) | Home / list — resident with problem — Auralis skin |
| [6.4-new-problem.png](../snapshots/prd/6.4-new-problem.png) | New problem form |
| [6.4-problem-detail-resident.png](../snapshots/prd/6.4-problem-detail-resident.png) | Problem detail — status, body, comment composer |
| [6.4-manager-queue-filters.png](../snapshots/prd/6.4-manager-queue-filters.png) | Manager queue + status filter chips — Auralis skin |
| [6.4-manager-filter-empty.png](../snapshots/prd/6.4-manager-filter-empty.png) | Empty state: “Nothing in this filter” |
| [6.4-problem-detail-manager.png](../snapshots/prd/6.4-problem-detail-manager.png) | Manager detail + status control |

## RFC — Auth & membership

| File | RFC section |
|------|-------------|
| [auth-sign-in-ux.png](../snapshots/rfc/auth-sign-in-ux.png) | §3.6 Sign-in UX (email + magic link demo) |
| [e1-not-a-member.png](../snapshots/rfc/e1-not-a-member.png) | §3.4 E1 — signed-in, no membership |

## RFC — System architecture (UX shell)

| File | RFC section |
|------|-------------|
| [ux-shell-app-bar-resident.png](../snapshots/rfc/ux-shell-app-bar-resident.png) | §3.5 Top app bar: residence name + role badge |
| [ux-manager-filter-chips.png](../snapshots/rfc/ux-manager-filter-chips.png) | §3.5 Manager list: horizontal status filter chips — Auralis skin |
| [ux-manager-status-control.png](../snapshots/rfc/ux-manager-status-control.png) | §3.5 Detail: manager status control above comments |

## Re-capture

```bash
cd residence-tracker
# after browser_take_screenshot with a temp filename:
bash scripts/archive-browser-screenshot.sh <temp-name>.png prd/6.4-login.png
```

See [../snapshots/README.md](../snapshots/README.md).
