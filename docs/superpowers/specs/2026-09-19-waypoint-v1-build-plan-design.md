# Waypoint v1 Build Plan

Date: 2026-09-19
Status: Approved. Milestone 1 not yet started.

## How to use this document

This is the source of truth for what Waypoint v1 is and the order it gets built in. It is written for an engineer or agent arriving with no prior context.

Read "Product context", "Fixed decisions", and "Open questions" once. Then work a single milestone at a time, top to bottom. Each milestone section is self-contained and ends with a **Plan seed** telling you what its implementation plan must cover.

Do not work more than one milestone at a time. The whole point of the sequencing is that each milestone leaves the app runnable.

## Product context

Waypoint is a mobile app that solves multi-stop route optimization. The user enters a list of errands (Costco, the bank, the post office) and the app computes the most efficient order to visit them, using real traffic-aware driving times. It is a personal Traveling Salesman Problem solver behind a friendly mobile UI.

It is the first app under the DriveIQ branding. DriveIQ is a branding concept only. Do not create suite-level folders or a monorepo for it. Waypoint is a standalone repository.

### Repository layout

```
waypoint/
├── backend/           AWS CDK (TypeScript)
│   ├── bin/backend.ts
│   ├── lib/backend-stack.ts    CDK stack definition
│   ├── lambda/hello.ts         hello-world handler
│   └── test/backend.test.ts    CDK scaffold placeholder, fully commented out
├── frontend/          Expo (React Native, TypeScript)
│   ├── App.tsx                 still the untouched blank-typescript template
│   └── AGENTS.md               read this before writing frontend code
└── docs/superpowers/specs/
```

### Current state

Both sides have a deployed hello-world and nothing is wired between them.

The backend deploys one Lambda behind an `apigateway.LambdaRestApi`, bundled by `aws-cdk-lib/aws-lambda-nodejs` via esbuild. It is confirmed working via `curl`. Note that `LambdaRestApi` with a single `handler` proxies **every** path to the hello function. Milestone 2 fixes this.

The frontend is the unmodified Expo `blank-typescript` scaffold. `App.tsx` still reads "Open up App.tsx to start working on your app!" There is no custom hello-world screen yet, despite what earlier notes may imply.

The backend test file contains only a commented-out SQS example from the CDK scaffold. There is **no real test coverage anywhere in the repo**. Milestone 2 is the first milestone that must leave a genuine passing test behind.

AWS is bootstrapped for CDK and the AWS CLI is configured locally. The IAM user holds `AdministratorAccess`. This is accepted dev-only debt, already known. Do not report it as a new security finding. It must be scoped down before any public launch.

## Fixed decisions

These are settled. Do not re-litigate them inside a milestone. If one genuinely blocks you, stop and raise it.

**No user accounts in v1.** There is no Cognito, no Users table, and no Routes table. Route history is stored on the device only (milestone 8). This keeps every endpoint unauthenticated for v1 and removes auth from the critical path. Accounts can be added later without reworking the solver or the map.

**Testing happens in Expo Go**, on a physical Android device and occasionally the iOS simulator on macOS. Not the browser, and not a custom dev client.

Staying on Expo Go through v1 is viable, verified against the pinned Expo v57 docs:

- `react-native-maps` is bundled in Expo Go, badged "Included in Expo Go", needing no extra setup for development. Extra Google Maps configuration is required only to ship a store binary.
- Google Places Autocomplete needs no native module. The standard components are pure JavaScript against the Places **Web Service** API, which is why the Google Cloud console setup enables the Web Service API rather than the Android or iOS SDK.
- Location and SecureStore are Expo SDK packages present in Expo Go.

The only real forcing functions for a development build are shipping to the app stores and the deferred car-screen work. Prefer pure-JavaScript libraries over native SDK wrappers to preserve that runway.

**No milestone needs CORS configuration**, because the API is consumed only by a native client and native `fetch` is not subject to it. If browser testing is ever added, that becomes a real task.

**The solver is exact Held-Karp**, bitmask dynamic programming, not a heuristic library like OR-Tools. It must support precedence constraints from day one, which makes the real problem the Sequential Ordering Problem, not plain TSP. Precedence is a filter inside the DP state transition: before extending a partial route to stop X, confirm every required predecessor of X is already set in the visited bitmask.

One precedence mechanism powers three features, so none is a special case in solver code:

- **Lock stops** (v1, milestone 9): a single-pair precedence edge, such as post office after bank.
- **Return to origin**: modeled as locking Home as a required-last stop. This deliberately avoids a second closed-loop solver mode.
- **Groups** (post-v1): a set of stops that must all precede any non-group stop, as a set-level constraint. The solver never needs the concept of "people".

Design the solver as swappable. Implement `solveExact()` now and leave room for a future `solveHeuristic()` if limits ever rise past roughly 15 to 18 stops.

**Stop limit is 9 to 10 for the free tier**, not counting the origin. Chosen for two reasons at once: more stops are unwieldy on a phone screen, and Held-Karp is O(2^n × n²), which stays well under a second at n=10. Keep the limit in adjustable config, never a hardcoded literal, so a future paid tier is a value change. Raising it past roughly 15 to 18 requires the heuristic solver.

The exact value, 9 or 10, is still unpicked. Milestone 4 must choose one and record it, and must state whether the origin counts toward the total.

**The graph is directed, not undirected.** Travel time A→B often differs from B→A because of one-way streets, turn delays, and asymmetric traffic. This also matches the Distance Matrix API's origins-by-destinations shape. Never collapse a cache key or an edge to an unordered pair. Direction is part of the identity.

**The client geocodes; the backend never sees addresses.** Places Autocomplete resolves coordinates on the device and the app sends only lat/lng, label, and id. Do not add an address-string field or backend geocoding without raising it first.

**Navigation is a handoff, not an in-app feature.** v1 deep-links into the Google Maps app with the computed waypoint order. This yields real voice guidance and rerouting for free and avoids the Directions API entirely. In-app turn-by-turn becomes worth building only when the car screens arrive, which is deferred.

**Shared types between packages are deliberately deferred.** Wiring Metro and esbuild to resolve a common folder is three configs that can break the dev loop early for little gain at this size. Keep two small hand-maintained type files. The trigger to revisit is the third time the contract changes and drift causes a bug. At that point, set up npm workspaces rather than Metro `watchFolders`.

## Open questions

Do not silently resolve these. Raise them if a milestone touches one.

- The lock-stops UX is functionally decided but not visually designed. Milestone 9 will need a real design conversation before implementation.
- Whether a paid or membership tier exists in v1 at all, or is purely a later concern that only needs the stop limit to be adjustable config.
- Time-window constraints, such as "the bank closes at 5pm", are **explicitly out of scope**. Manual precedence locking is the user's workaround. A real solver for this is the harder Sequential Ordering Problem with time windows. Do not start building it.

## The organizing principle: a fake-data spine

Every milestone ends with something visible in Expo Go, and real data arrives late.

A deliberate spine of fake data runs through the middle. The endpoint returns hardcoded results before the solver exists (milestone 2). The solver runs on straight-line distances before Google billing is involved (milestone 4). This lets the hard parts get built and verified in isolation while the app stays runnable and demoable throughout.

Milestone 3 is the single exception with nothing to look at. That is intentional and explained in its section.

---

## Turning a milestone into an implementation plan

Follow this procedure for every milestone. It exists so that different agents and devs produce comparable plans.

### Standard procedure

1. **Read the context.** This document's "Fixed decisions" and "Open questions" sections, plus the target milestone's section in full.
2. **Verify current repo state before planning.** This document was accurate on 2026-09-19 and drifts as milestones land. Check the actual files and `git log`. Never plan against what this document claims is present without confirming it.
3. **Read `frontend/AGENTS.md` before any frontend work.** It requires reading the exact versioned Expo docs at `https://docs.expo.dev/versions/v57.0.0/` before writing code, because the pinned SDK's API has changed. This is not optional and it overrides training-data recall about Expo.
4. **Confirm the milestone's prerequisites are actually met.** Each section lists them. If a prerequisite is missing, stop and say so rather than quietly widening scope.
5. **Invoke the `superpowers:writing-plans` skill** to produce the plan. Save it next to this document as `docs/superpowers/plans/YYYY-MM-DD-milestone-N-<slug>.md`.
6. **Execute with `superpowers:test-driven-development`.** Write the failing test first. This matters most for milestone 3, where the solver is pure logic and trivially testable, and least for UI work where a manual check on the device is the honest verification.
7. **Verify against the milestone's "Done when" before claiming completion.** Use `superpowers:verification-before-completion`. Run the command, read the output, paste it. Do not assert success from a clean edit.

### What every milestone plan must contain

- **Files touched**, by path, split into created versus modified.
- **The test or check that proves it works**, with the exact command, or the exact on-device steps if there is no automatable check.
- **A rollback note** for anything deployed to AWS.
- **An explicit out-of-scope list**, naming what a reader might reasonably assume is included but is not.

### Scope discipline

Each milestone is small on purpose. If a plan grows past roughly a day of work, the milestone has been misread or has hidden complexity. Stop and re-scope rather than pushing through.

Resist the pull to build the next milestone early because it is "only a few more lines". The sequencing is what keeps the app runnable.

---

## Milestone 1 — One real request, end to end

**Goal.** Prove one genuine frontend-to-backend round trip before any feature exists.

**Prerequisites.** None. This is the starting point.

**Scope.** Replace the Expo template `App.tsx` with a screen that calls the existing hello Lambda and renders the returned message. Show three visibly distinct states: loading, success, and error. Add a small reusable fetch helper that later milestones build on. Put the deployed API Gateway URL in a gitignored `.env` as `EXPO_PUBLIC_API_URL`, with a committed `.env.example`.

**Done when.** Expo Go on the Android device displays the message that came from the deployed Lambda, and killing the URL in `.env` produces a readable on-screen error rather than a blank screen or a silent hang.

**Known traps.** The `EXPO_PUBLIC_` prefix is required for Expo to inline the variable at build time; a differently named variable is silently undefined. Changing `.env` needs a dev server restart, not just a reload. Render the error text on screen, because a silent failure is exactly what a wrong URL looks like.

**Plan seed.** The plan must decide where the fetch helper lives and what its error shape is, since every later feature inherits it. Keep it small: a base URL, JSON parsing, and a typed error. Do not introduce a data-fetching library.

## Milestone 2 — The optimize-route contract, stubbed

**Goal.** Settle the frontend-backend contract before any real logic exists behind it.

**Prerequisites.** Milestone 1.

**Scope.** Define the request and response shapes for `POST /optimize-route`. The request carries an origin, a `returnToOrigin` flag, and a list of stops each with lat/lng, label, and id. The response carries the ordered stop ids plus total distance and duration. Add a second Lambda that returns a hardcoded but plausible order, ignoring its input.

Restructure the API. The current `LambdaRestApi` proxies every path to the hello handler, so routing must become explicit before a second endpoint can exist.

Replace the commented-out CDK scaffold test with a real one asserting the stack synthesizes both routes.

The frontend sends a hardcoded stop list and renders the returned order as a list.

**Done when.** `npm test` in `backend/` passes with a real assertion, and the phone shows a reordered list that demonstrably came from the backend.

**Known traps.** Both the hello and optimize routes must still work after the routing change; it is easy to break hello while adding the second endpoint. Keep the stub's response shape exactly what the real solver will return later, because the entire point of this milestone is that milestone 4 changes no frontend code.

**Plan seed.** The plan must write out the full contract explicitly, including how an infeasible or over-limit request is reported. Decide the error shape now. Retrofitting error handling after the solver exists is where contract drift starts.

## Milestone 3 — The solver, standalone

**Goal.** Build the hardest logic in the app in isolation, under test, with no cloud or UI in the way.

**Prerequisites.** Milestone 2's contract, so the solver's output type matches what the endpoint already returns.

**Scope.** A pure TypeScript module, no AWS and no Google imports, living under `backend/src/solver/`. Not `backend/lib/`, which is for CDK constructs. It takes a duration matrix plus precedence constraints and returns an order with totals. Implement `solveExact()` using Held-Karp with the precedence bitmask filter. Structure it so a `solveHeuristic()` could be swapped in later.

**Done when.** `npm test` in `backend/` passes, covering at minimum: a known-optimal small case; an asymmetric matrix where A→B differs from B→A; a precedence constraint that is actually honored; return-to-origin expressed as a last-stop lock; and an infeasible constraint set that is rejected cleanly rather than looping or returning nonsense.

**This is the only milestone with nothing visible on the device.** That is deliberate. This is the most intricate logic in the product and it is fully testable without a UI or a network call. Building it behind a screen would make failures far harder to localize.

**Known traps.** The asymmetric case is the one most likely to be missed, because symmetric test fixtures pass even when the implementation wrongly assumes an undirected graph. Write that test early. Infeasible precedence cycles must be detected rather than silently returning a partial route.

**Plan seed.** The plan must enumerate the test cases before any implementation, and must state the precedence representation explicitly, since milestone 9's UI will have to produce it.

## Milestone 4 — Solver wired up, distances still fake

**Goal.** Real optimization on real coordinates, with no API key and no bill.

**Prerequisites.** Milestone 3.

**Scope.** Replace the milestone 2 stub's hardcoded response with a real call into the solver, computing the duration matrix from straight-line haversine distances rather than Google. Enforce the stop limit here, reading it from config.

**Done when.** The phone shows a genuinely optimized order for a real set of coordinates, and an over-limit request returns the contract's error rather than a slow response or a crash.

**Known traps.** No frontend change should be needed. If the frontend requires edits, the milestone 2 contract was wrong and that is worth noting rather than papering over.

**Plan seed.** The plan should treat the matrix builder as a named seam with two future implementations, haversine now and Distance Matrix at milestone 6, so milestone 6 is a swap rather than a rewrite.

## Milestone 5 — Real stop entry

**Goal.** Make it an app you can point at real errands.

**Prerequisites.** Milestone 4.

**Scope.** Places Autocomplete replaces the hardcoded stop list. Build the stop list UI: add, remove, and choose the origin. Enforce the stop limit in the interface, not only on the server.

**Done when.** You can search real places on the Android device, get real coordinates, and receive a real optimized order computed from haversine distances.

**Known traps.** Use the Web Service API in the Google console, not the Android or iOS SDK, which is what keeps this working in Expo Go. The Places key ships inside the app binary and is extractable, so it must be restricted by API and by app identity in the Google console. That restriction is the mitigation; do not treat `EXPO_PUBLIC_` as if it were secret.

**Plan seed.** The plan must name the specific autocomplete library and confirm against the v57 docs that it needs no native module. It must also state the key restriction settings as a concrete task, not a footnote.

## Milestone 6 — Real drive times

**Goal.** Orders that reflect actual traffic.

**Prerequisites.** Milestone 5.

**Scope.** Swap the haversine matrix builder for server-side Distance Matrix calls with `departure_time=now`. Add the EdgeCache DynamoDB table in front of it.

EdgeCache is keyed by origin geohash, destination geohash, and mode, storing distance and duration with a TTL. Use 5 to 15 minutes for live-traffic requests and longer for non-traffic baselines. On each request, check the cache for every needed pair and call Google only for misses.

Caching individual **edges** rather than whole routes is the point. Users rarely repeat an identical stop set, so whole-route caching would almost never hit, while the same Home→Costco edge recurs constantly across different routes. This is where the API savings come from.

**Done when.** Orders change in response to real traffic conditions, and a repeated request for an overlapping stop set demonstrably hits the cache rather than re-calling Google.

**Known traps.** The Distance Matrix key is server-side and must never reach the phone; store it in Secrets Manager or SSM Parameter Store, not in the Lambda source or environment defaults committed to git. Keep the cache key directional. Verify the cache is actually hit rather than assuming it, since a subtly wrong key silently degrades to a full-price cache miss every time.

**Plan seed.** The plan must specify geohash precision, because too fine a precision destroys the hit rate and too coarse returns wrong durations. It must also include a concrete way to observe hits versus misses.

## Milestone 7 — Map and navigation handoff

**Goal.** See the route, then drive it.

**Prerequisites.** Milestone 6.

**Scope.** Render the ordered route on a `react-native-maps` map. Add a handoff that deep-links into the Google Maps app with the stops as waypoints in the computed order.

**Done when.** The optimized route is visible on the map in Expo Go, and the handoff opens Google Maps on the Android device with the stops in the right order.

**Known traps.** `react-native-maps` works in Expo Go without setup, but shipping a store binary later needs additional Google Maps configuration; that belongs to the store-build milestone, not here. The Google Maps deep-link URL format caps the number of waypoints, so check that limit against the stop limit and handle the overflow case explicitly.

**Plan seed.** The plan must verify the deep link on the physical Android device specifically, since URL handling differs between the simulator and a real device with the Google Maps app installed.

## Milestone 8 — Recent routes, on the device

**Goal.** Route history without a backend.

**Prerequisites.** Milestone 7.

**Scope.** Persist recent routes locally, storing the stop list, the computed order, a timestamp, and totals. Local storage only. No Routes table, no sync, no accounts.

**Done when.** Recent routes survive a full app restart on the device and can be reopened.

**Known traps.** This is the milestone where "we may as well add accounts" pressure appears. Resist it. The no-accounts decision is what makes v1 reachable, and local history is a complete feature on its own.

**Plan seed.** The plan should pick the storage mechanism explicitly and state a retention cap, since unbounded history on a phone is a slow leak.

## Milestone 9 — Lock stops

**Goal.** Surface the precedence capability the solver has had since milestone 3.

**Prerequisites.** Milestone 8, and a UX decision that does not exist yet.

**Scope.** Interface work only. Let the user express constraints like "post office after bank", pass them to the existing solver, and show the result. No solver changes should be required.

**Done when.** A user-expressed constraint visibly changes the computed order, and a contradictory pair produces a clear message rather than a failure.

**Known traps.** The UX for this is an open question and genuinely unsolved. **Start with a design conversation, not an implementation plan.** If solver changes appear necessary, something has been misunderstood about the milestone 3 precedence representation; stop and check before modifying the solver.

**Plan seed.** This milestone needs `superpowers:brainstorming` first to settle the interaction design. Only then write the implementation plan.

---

## Deferred beyond v1

**User accounts and synced history.** Cognito plus the Users and Routes tables. Explicitly cut from v1.

**Paid tier.** Would raise the stop limit to roughly 15 while still using the exact solver. Requires the stop limit to be adjustable config, which milestone 4 already provides.

**Store builds and the development build switch.** The first genuine forcing function for leaving Expo Go. Also where the additional Google Maps binary configuration becomes real.

**Groups, meaning multi-person pickup.** Architecturally supported by the precedence design already. Only the UI for defining a group is missing.

**Time-window constraints.** Out of scope, as described in "Open questions".

**CarPlay and Android Auto.** Notes for whenever this is picked up:

- Both platforms require template-based UIs, not custom React Native views. Apple uses `CPMapTemplate`; Android uses the `androidx.car.app` Cars App Library. The driving-mode experience is a genuine UI rewrite, not a port.
- `react-native-carplay` covers iOS. Android Auto has less mature React Native tooling and likely needs a native Kotlin module.
- Apple requires applying for a specific CarPlay Navigation entitlement, which carries review and lead time. **This is the long pole**; flag it early in any scheduling conversation.
- Realistic scope: build and edit routes on the phone, with the car screen rendering navigation only for an already-computed order. Neither platform permits stop entry while driving.
- This is also the point where the milestone 7 navigation handoff stops being sufficient and in-app turn-by-turn has to be built.

**IAM scope-down.** The dev IAM user's `AdministratorAccess` must be reduced before any public launch.
