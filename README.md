# Beyder&Co. Agent Office

A three-dimensional office for viewing business-source status, reviewing prepared work and coordinating local office tasks. The public site runs entirely on **TEST data**. It has no credentials, live contacts, or business-system connection.

© Beyder&Co. Realty. All rights reserved.

## Public demo and security

Vercel builds `main` using `python3 build.py --public` and serves only `dist/public`. The build embeds a permanent TEST-mode marker. Its Content Security Policy denies all network connections, including WebSockets. The page can connect to the local bridge only at the exact origin `http://127.0.0.1:4317`; URL parameters cannot override this. Public builds remain TEST-only even if copied to that origin.

The bridge listens on loopback. Every HTTP request validates a single exact Host and rejects foreign or duplicate Origin headers. WebSocket upgrades also require the bridge's exact Origin. Command-line health checks may omit Origin. No CORS access is granted.

Only source, synthetic tests, required runtime libraries/fonts, the builder and installer templates are published. Local configuration, keys, runtime state, decision/command ledgers, logs, builds, audit reports, screenshots and soak/telemetry evidence stay ignored. Publication uses clean history; the original local history is retained privately.

## Run on a Mac

Requires Python 3.9+; Node is needed for the offline JavaScript boundary test. Bundled three.js/fonts are served locally. This repository does not grant permission to use business accounts.

```sh
python3 build.py office
python3 -B -m unittest discover -s bridge -p 'test_*.py'
python3 bridge/build_installer.py dist/office.html /tmp/install-agent-office.command
bash /tmp/install-agent-office.command
```

The installer uses only the separate office launch agent, verifies exact payload checksums, preserves private state and retains the preceding release for rollback. It does not install or modify business jobs. Open `http://127.0.0.1:4317` after installation.

Live sources require a private `config.json` in `~/Library/Application Support/bco-agent-office/` (or the explicit `BCO_OFFICE_CONFIG` path). Supply the locally reviewed `access_hold_ids` list, authorized `fub_user_id`, `fub_domain`, credential-file path and source-file paths. Without an explicit access-hold configuration, private source reads fail closed. Keys remain in the existing private credential file; never copy them into this repository. Coordinator binding and business phone values also belong in local configuration. Do not commit the local file.

## Operational contract

FUB and RealScout access is GET only. The bridge never sends client messages, changes CRM records, runs NJMLS intake, replays a business job, changes business schedules or grants permissions. Prepared approvals open the source for authorized action. Add reminder records a local reminder; adding a display agent creates no worker or integration.

Existing configured coordinator handoffs remain review-bound and local. A necessary incident repair requires a stable incident ID, proven cause, a bounded reversible change, rollback and evidence from an ordinary scheduled run. A dependency hold remains held. No broad repair cycle, forced job, sender replay, re-dating or provider-hold clearance is authorized.

Retain privacy exclusions and dated source/freshness labels. Rendering can slow or pause without slowing live source checks. Diagnostics contain aggregate counts and state codes only.

## Release identities

The Studio had already reached page 8.8.0 / bridge 1.6.0 before this publication request. Public tags `v8.6` and `v8.7` identify the clean-source publication baseline and requested follow-up milestone; they do not import the older private Git history or downgrade the later room/coordinator work. The page and bridge expose their actual installed versions in local health diagnostics.
