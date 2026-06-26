# Agent workflow prompt — Event-Driven Bag Tracking Upgrade

Paste the block below into a fresh Claude Code session (Opus 4.8 recommended), or
hand it to a subagent. It orchestrates the implementation of
`docs/state-machine-upgrade-plan.md` phase by phase, with a verification gate
after each phase. Work one phase at a time; do not start a phase until the
previous one passes its gate.

---

## PROMPT

You are implementing a multi-phase upgrade to **SkyWatcher**, an IoT baggage-tracking
FYP (Flask backend + React/Vite dashboard + Flutter mobile + Supabase + MQTT).

**Source of truth:** read `docs/state-machine-upgrade-plan.md` and `CLAUDE.md` in
full before writing any code. The plan defines Part A (bag finite-state machine +
real operator inputs) and Part B (passenger ETA, friendly anomaly messages,
checkpoint advisories, arrival email). Implement exactly what the plan describes;
if you deviate, say why first.

### Hard constraints (do not violate)
1. **Backward compatibility:** existing bags have `status` of `in_transit`/`arrived`.
   Map these into the new FSM states on first touch; never crash on a legacy value.
2. **Security/privacy:** NEVER expose the literal phrase "security bypass" (or
   internal anomaly type names) on any public/passenger surface. Passengers see
   "needs an additional check". Staff/admin surfaces may show the real type.
3. **Uniform staff:** do NOT reintroduce per-checkpoint staff logic. All staff
   roles see/do the same. (Project direction — see CLAUDE.md.)
4. **Follow existing conventions:** match the surrounding code style. Backend =
   PEP 8 + dotenv for config + the `@token_required(...roles)` decorator. React =
   functional components/hooks, colours via CSS variables in `index.css`. Flutter
   = the design system in `lib/theme.dart` (AppColors, SoftCard, DotChip, etc.).
5. **The state machine is a pure, testable module.** Put decision logic in
   `backend/models/state_machine.py` with no DB/IO; the DB layer calls into it.
6. **SQL is run by the human, not you.** For any schema change, write the DDL to a
   file under `backend/sql/` AND tell the user to run it in the Supabase SQL editor
   before that feature works. Do not assume you can execute it.
7. **Don't commit or push** unless the user explicitly asks. Work on the current
   feature branch.

### Phased plan — implement in this order, one at a time

**Phase 1 — State engine + backend + DB (core)**
- `backend/models/state_machine.py`: `STATES`, `TRANSITIONS`, and
  `decide(current_status, trigger, context) -> (new_status, anomaly|None)`.
- Wire `backend/models/database.py: insert_event` through `state_machine.decide()`;
  add `bag_status_history` writes; add `apply_operator_action()`.
- New endpoints in `backend/routes/baggage.py`: `POST /api/bags/<tag>/scan`,
  `POST /api/bags/<tag>/action`, `GET /api/bags/<tag>/status-history`.
- `backend/sql/state_machine.sql`: `bags.status_updated_at` + `bag_status_history` table.
- Add unit tests for `decide()` (happy path + each exception: bypass, wrong-route, stall).

**Phase 2 — Dashboard: status visibility**
- Status badge (colour per state), status-history timeline, and a "Register scan"
  control in `BagHistoryModal.jsx`. Status badges in the bag table / live map.

**Phase 3 — Operator actions (dashboard)**
- Hold / Release / Reroute / Claim / Report lost / Found buttons wired to
  `POST /api/bags/<tag>/action`, with optimistic UI + the existing polling refresh.

**Phase 4 — Mobile**
- Add QR scanner (`mobile_scanner`) → scan tag → choose checkpoint → call the scan
  endpoint → show the status change. Add status badge + operator actions to the bag
  detail. Update `lib/api.dart`. Update iOS permission (camera usage string in
  `Info.plist`) and the README.

**Phase 5 — Passenger features + loop closure**
- ETA computation + friendly anomaly messages + checkpoint advisories
  (`backend/sql/advisories.sql`, `GET/PUT /api/advisories`) folded into
  `GET /api/track`; opt-in arrival email in `notifier.py`.
- `PublicTrack.jsx`: ETA card, advisory/anomaly banners, "notify me" email field.
- Resolving an anomaly transitions the bag back (`FLAGGED→SCREENED`,
  `MISROUTED→SORTED`).

### Verification gate (run after EVERY phase; do not proceed if it fails)
- **Backend:** `cd backend && python3 -c "import ast,glob; [ast.parse(open(f).read()) for f in glob.glob('**/*.py', recursive=True)]"` and import the changed modules. Run the new unit tests.
- **Dashboard:** `cd skywatcher-dashboard && npm run build`.
- **Mobile:** `cd skywatcher-mobile && LANG=en_US.UTF-8 flutter analyze && flutter test`
  (and `flutter build ios --no-codesign --debug` for the phase that touches native/plugins).
- Report what you changed, the gate output, and any SQL the user must run. Then STOP
  and wait for the user to confirm before the next phase.

### Working style
- Think hard before Phase 1 — the FSM design is load-bearing.
- Keep each phase self-contained and shippable.
- Update `CLAUDE.md` and the relevant README when behaviour changes.
- If a decision is genuinely ambiguous and not answered by the plan, ask — don't guess.

Begin with Phase 1. Confirm you've read the plan and list the Phase-1 files you'll
create/modify before editing.
