# AI App Rescue

A one-page landing site for Brandon / Bsibz's fixed-scope engineering repair offer.

## Offer

**$250 USD fixed scope** for one agreed, reproducible TypeScript / Node.js workflow problem.

Includes:

- patch
- regression test where practical
- verification evidence
- short handover

## Intake flow

The site includes a client-side intake helper for one broken workflow:

- project / app name
- stack
- optional public app or repository URL
- broken workflow description
- reproduction steps
- expected behavior
- urgency / timing

The form does **not** submit to a backend. It builds a prefilled email to `kickbsibz@gmail.com` or lets the visitor copy the summary.

Visitors are explicitly told not to send credentials or private customer data. A small client-side heuristic blocks several obvious credential shapes before creating/copying the draft; it is a guardrail, not a complete secret scanner.

## Public proof

- https://github.com/Bsibz/preview-fence
- https://github.com/Bsibz/contribgate
- https://github.com/Bsibz/runtime-receipt

## Contact

kickbsibz@gmail.com

## Site

Static HTML/CSS/JavaScript only. No runtime dependencies, analytics, cookies, backend, or build step.

## Local checks

```sh
node --check intake.js
node intake.test.cjs
```
