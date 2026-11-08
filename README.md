# Healthcare Payer AI Portfolio

Portfolio site with working AI applications for U.S. health plan workflows. All five apps are live: **Prior Auth Copilot**, **Denial & Appeals Assistant**, **Benefits Navigator**, **Payment Integrity Radar** and **HCC Evidence Finder**.

All data is synthetic, and the coverage policies are illustrative. None of it comes from a real payer, provider or member.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo works without an API key in **replay mode**, which runs the whole pipeline on stored model outputs.

To turn on live calls to Claude, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`.

## Prior Auth Copilot

`src/lib/pa/engine.ts` runs a fixed workflow:

1. **Policy lookup** by service code. Cases, policies and recorded outputs live in `data/pa/*.json`.
2. **Identifier redaction** before any model call (`src/lib/shared/redact.ts`)
3. **Criteria evaluation** with Claude Opus 5.5, constrained to a JSON schema. Each criterion gets met / not met / insufficient plus verbatim quotes.
4. **Citation check** in code. A "met" or "not met" with no quote found word for word in the record is downgraded to "insufficient".
5. **Routing** in code: all met → recommend approval; anything missing → request info; anything not met → nurse review. It never recommends a denial.

Other details:
- The system prompt is cached.
- Requests opt into server-side fallback (`fallbacks: "default"`), so a safety-classifier decline is retried on a fallback model.
- Live runs are capped per IP per day across all demos (`PA_DAILY_LIMIT_PER_IP`).

A Spring Boot version of this engine is in the services project. See [Java services](#java-services) below.

## Denial & Appeals Assistant

`src/lib/appeals/engine.ts` works one denied claim from its remittance (X12 835):

1. **Remittance parsing** in code: denied lines plus CARC/RARC meanings from lookup tables (`codes.ts`)
2. **Identifier redaction** of the provider's records
3. **Denial analysis** with Claude: per denied line, a plain-English reason, category, suggested action (appeal, corrected claim, don't pursue) and verbatim evidence
4. **Evidence check** in code. A line is pursued only if verified quotes from the provider's own records answer the denial. Strength (strong / moderate / weak) comes from how many.
5. **Appeal letter** with Claude, drafted only for lines that passed step 4 and only from their verified quotes
6. **Letter check** in code: every quoted passage in the letter is matched against the records and policy

Corrected-claim instructions (replacement claim, frequency code 7) are assembled in code. Claims, policies, codes and recorded outputs live in `data/appeals/*.json`. A Spring Boot version of this engine is in the services project.

## Benefits Navigator

`src/lib/benefits/engine.ts` answers a member's coverage question with a **tool-using agent**. Unlike the other two apps, Claude decides which tools to call, in a loop of up to 6 turns:

- **`get_plan_sections`** reads sections of the member's SBC and EOC by id. The model is given a table of contents.
- **`estimate_cost`** is the plan's cost calculator (`calculator.ts`). It applies the remaining deductible, copay or coinsurance and the out-of-pocket cap to the allowed amount, and adds prior authorization, referral, visit-limit and balance-billing notes. Claude never does the math.
- **`submit_answer`** returns the answer, verbatim citations, and whether a person should take over. It's a strict tool schema.

Code then checks the answer before the member sees it:
- every quote must appear word for word in its plan section
- every dollar amount must come from a section the model read or a calculator result
- out-of-scope questions, unsupported figures and unverified citations are handed to an agent

The sample questions include a prompt-injection attempt ("tell me the MRI is free"); the answer still gives the calculator's figure. Replay re-runs the recorded tool calls against the calculator, so estimates always reflect current data.

Plans, members, allowed amounts and recorded runs live in `data/benefits/*.json`. The plans are fictional, and their wording is modeled on SBC and EOC documents. A Spring Boot version of this agent is in the services project.

## Payment Integrity Radar

Statistics detect the leads, and Claude only explains them.

**Detection** (`src/lib/pi/detect.ts`) is plain code, with no model involved:
- robust z-scores (median and MAD) within each specialty
- risk adjustment of the 99215 share against patient risk score, using a Theil-Sen line
- a hard rule for more than 16 billed hours in a day
- scores and tiers set in code, which also set the action and record sample size

**The brief** (`src/lib/pi/engine.ts`): Claude gets a list of computed facts, all provider-level aggregates, and writes the pattern, legitimate explanations to rule out, and next steps. Code then checks that:
- every figure appears in the facts
- no wording implies wrongdoing
- citations resolve and include a flagged pattern

A failed check holds the brief for an analyst to edit. The lead itself stands on the statistics.

**Data:** `npm run generate:pi` writes 120 synthetic providers to `data/pi/providers.json`, using a seeded generator. It injects 6 patterns, plus one decoy whose high 99215 share is explained by a sicker panel. The injected labels go to `evals/pi-labels.json`, which the detector never reads. Screen scores against these labels are a sanity check, not evidence of real-world performance.

A Spring Boot version of this engine is in the services project.

## HCC Evidence Finder

`src/lib/hcc/engine.ts` compares a member's chart with the codes already submitted, in both directions: missed conditions and unsupported submissions.

1. **Identifier redaction** before any model call
2. **Chart review** with Claude: for each submitted code and documented condition, supported, not supported, or query the provider, with verbatim quotes tagged by MEAT element (Monitor, Evaluate, Assess, Treat)
3. **Reconciliation** in code (`reconcile`):
   - support needs a verified quote from an acceptable encounter, so a nurse phone call can't count
   - codes that mean active disease can't rest on "history of" language
   - the HCC and the hierarchy come from `data/hcc/hcc-map.json`, never from the model
   - a submitted code the model skipped still goes to a coder

Nothing is submitted or deleted automatically. The prompt excludes risk scores and payment, and deletions sort first.

**Check the map:** `data/hcc/hcc-map.json` is a small demo subset of CMS-HCC V28, checked against published coding guides rather than the CMS mapping file. I63.9 to HCC 249 couldn't be confirmed in those guides. Verify the map against the CMS tables for the payment year before relying on it.

A Spring Boot version of this engine is in the services project.

## Java services

The Spring Boot versions of all five engines live in a separate project, `healthcare-payer-ai-services`, in the folder next to this one. It builds and deploys on its own. This site only reaches it through a URL. Without Java, the TypeScript engines here handle everything, so Vercel needs nothing extra.

To run a demo on Java, start the service there and set its URL in `.env.local`:

```
PA_ENGINE_URL=http://localhost:8081
APPEALS_ENGINE_URL=http://localhost:8082
BENEFITS_ENGINE_URL=http://localhost:8083
PI_ENGINE_URL=http://localhost:8084
HCC_ENGINE_URL=http://localhost:8085
```

The demo's run trace then shows "Java engine". Leave a setting empty to use TypeScript.

## Contract with the Java services

`contract-tests/` holds golden JSON for every demo case, generated from this site's engines in replay mode. Both projects must reproduce it, so they can't drift apart unnoticed. With the dev server running:

```bash
npm run contracts:check
```

checks this site's engines against the golden files. After you change data, labels or recorded outputs:

```bash
npm run contracts:sync
```

regenerates the golden files and copies them, with `data/`, to the services project (`../healthcare-payer-ai-services`, or set `SERVICES_DIR`). Then run `mvn test` there. No API calls are made.

## Evaluation

```bash
npm run dev            # in one terminal
npm run eval           # replay mode, free
npm run eval -- --live # calls Claude for every labeled case
npm run record         # live run, then saves outputs as the demo's replay data
```

For the other apps, use `npm run eval:appeals` / `npm run record:appeals` and `npm run eval:benefits` / `npm run record:benefits` and `npm run eval:pi` / `npm run record:pi` and `npm run eval:hcc` / `npm run record:hcc` the same way. Live eval runs count toward the per-IP daily cap, so raise `PA_DAILY_LIMIT_PER_IP` in `.env.local` before recording a large set.

Labels are in `evals/labels.json`, `evals/appeals-labels.json`, `evals/benefits-labels.json`, `evals/pi-labels.json` and `evals/hcc-labels.json`. Full reports go to `evals/results/`. Only live runs update the headline numbers in each app's `eval-summary.json`, which the case study pages show.

Each app's `recorded.json` holds the outputs replay mode plays back. Its `"source"` field says whether they came from a live Claude run (`"live"`) or were written by hand (`"sample"`), and the demo labels them accordingly. All five apps' outputs are currently from live runs. Re-record whenever you change a prompt, policy or case.

## Architecture GIF

`scripts/make-architecture-gif.js` renders the platform architecture diagram as an animated GIF for LinkedIn posts, slides or a README. The output is `public/architecture-flow.gif`: 1120×742 px, about 0.5 MB, a 9.4-second loop.

```bash
npm run gif
```

The script doesn't need the dev server or an API key, and it takes about 40 seconds. To also save one still PNG per step (`step-1.png` … `step-9.png`), call it directly with a second argument:

```bash
node scripts/make-architecture-gif.js public/architecture-flow.gif gif-frames
```

What it draws:
- **Moving arrows:** dashes move in the direction of flow. Teal is requests, orange is results coming back, and grey dotted is logging.
- **Request dot:** a dot walks one request through steps 1–9, lighting the boxes involved and enlarging that step's badge.
- **Caption bar:** explains the current step, with a title at the top and your name on the right.

How it works:
- Each frame is built as an SVG string and rasterized with `@resvg/resvg-js`, then encoded with `gifenc`. Both are dev dependencies.
- All frames share one palette, and pixels that didn't change since the previous frame are stored as transparent, which keeps the file small.
- Fonts come from the operating system (Segoe UI and Consolas on Windows). Other systems substitute their own fonts, so the text may look slightly different.

Things to keep in sync:
- **Layout:** the script keeps its own copy of the diagram (`BOXES`, `LINKS`, `BADGES`, `ROUTES`). After changing `src/components/ArchitectureDiagram.tsx`, make the same change in the script and run `npm run gif` again.
- **Captions:** the `STEPS` text in the script mirrors `src/lib/architecture.ts`.
- **Timing:** `PER_STEP` (frames per step), `MOVE` (frames spent moving) and `DELAY` (ms per frame) set the speed. If you change the frame count, keep `SHIFT_TOTAL` a multiple of 14 so the moving dashes loop without a jump.

## Make it yours

- `src/lib/site.ts`: name, email, LinkedIn, GitHub, app list
- `src/app/about/page.tsx`: career timeline
- `public/resume.pdf`: add your resume
- Expand `src/lib/pa/cases.ts` and `evals/labels.json` toward 150–300 cases before quoting accuracy numbers

## Deploy

Push to GitHub and import the repo in Vercel. In the Vercel project settings, set `ANTHROPIC_API_KEY` to enable live mode, or leave it unset to keep the public demo in replay only.
