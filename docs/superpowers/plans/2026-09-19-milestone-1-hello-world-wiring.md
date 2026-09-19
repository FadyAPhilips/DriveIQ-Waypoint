# Milestone 1: One Real Request, End to End — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Expo app fetch and display a message from the already-deployed hello Lambda, with visible loading, success, and error states.

**Architecture:** A small API layer lives under `frontend/src/api/`. `client.ts` owns base-URL resolution, the `fetch` call, and a typed `ApiError`; `hello.ts` is a thin per-endpoint wrapper over it. `App.tsx` holds a three-state discriminated union in `useState` and renders one branch per state. Every later milestone adds a sibling to `hello.ts` rather than touching `client.ts`.

**Tech Stack:** Expo SDK ~57.0.24, React 19.2.3, React Native 0.86.3, TypeScript ~6.0.3 (strict). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-waypoint-v1-build-plan-design.md` (see "Milestone 1")

## Global Constraints

- **Read the pinned Expo docs before writing frontend code:** `https://docs.expo.dev/versions/v57.0.0/`. Required by `frontend/AGENTS.md`; it overrides training-data recall about Expo.
- **Add no new dependencies in this milestone.** Everything needed is already installed.
- **Test in Expo Go**, on a physical Android device and optionally the iOS simulator on macOS. Not the browser.
- **No CORS configuration is needed.** The API is consumed only by a native client, and native `fetch` is not subject to CORS.
- **`frontend/.gitignore` ignores `.env*.local` but NOT plain `.env`.** The real URL goes in `.env.local`. A file named `.env` would be committed.
- **`EXPO_PUBLIC_`-prefixed variables are inlined at build time**, not read at runtime. After editing `.env.local`, do a full in-app reload (shake gesture, then Reload). A dev server restart is not required; `npx expo start --clear` fixes stale-cache cases.
- **Never put a secret in an `EXPO_PUBLIC_` variable.** They are visible in plain text in the compiled app. The API Gateway URL is not a secret; it is kept out of git only to avoid baking one developer's deployment into the repo.
- **v1 has no user accounts.** Do not add auth headers, tokens, or a user concept.
- **Commit attribution:** agent executors append their own `Co-Authored-By` trailer to each commit. Human developers should not.

### Verified environment facts

These were confirmed on 2026-09-19. Re-check if this plan is executed much later.

| Fact | Value |
| --- | --- |
| Deployed API URL | `ApiUrl` output of the `BackendStack` CloudFormation stack |
| Endpoint response | `{"message":"Hello from Waypoint backend"}`, HTTP 200 |
| Base URL with and without trailing slash | Both return HTTP 200 |
| `GET /hello` today | Returns the same hello payload |
| `npx tsc --noEmit` in `frontend/` | Exits 0 on the untouched repo |
| `process.env.EXPO_PUBLIC_*` typing | Typechecks clean with no extra `@types` package |

Retrieve the URL with:

```bash
aws cloudformation describe-stacks \
  --stack-name BackendStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

The API currently proxies **every** path to the hello handler, so `/hello` works today by virtue of that proxying. Milestone 2 makes it an explicit route, so calling `/hello` now is forward-compatible. Do not call the bare root.

---

### Task 1: API client and environment configuration

**Files:**
- Create: `frontend/.env.local` (gitignored, never committed)
- Create: `frontend/.env.example` (committed)
- Create: `frontend/src/api/client.ts`
- Modify: `README.md` (add a Setup section)

**Interfaces:**
- Consumes: nothing. This is the first task.
- Produces:
  - `ApiError` — class extending `Error`, with `kind: ApiErrorKind` and `status?: number`
  - `ApiErrorKind` — `"config" | "network" | "http" | "parse"`
  - `apiRequest<T>(path: string, init?: RequestInit): Promise<T>` — `path` must begin with `/`

- [ ] **Step 1: Get the deployed API URL**

```bash
cd backend
aws cloudformation describe-stacks \
  --stack-name BackendStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

Expected: a URL of the form `https://<id>.execute-api.us-east-1.amazonaws.com/prod/`

- [ ] **Step 2: Confirm the endpoint is actually live**

```bash
curl -s -w "\nHTTP %{http_code}\n" "$(aws cloudformation describe-stacks \
  --stack-name BackendStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)hello"
```

Expected: `{"message":"Hello from Waypoint backend"}` and `HTTP 200`.

If this fails, stop. The rest of the milestone assumes a working backend, and debugging a deploy is not part of this plan.

- [ ] **Step 3: Create `frontend/.env.example`**

Commit this one. It documents the variable without pinning anyone's deployment.

```bash
# Base URL of the deployed Waypoint API (the ApiUrl output of BackendStack).
# Copy this file to .env.local and fill in your own value.
# Retrieve it with:
#   aws cloudformation describe-stacks --stack-name BackendStack \
#     --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
EXPO_PUBLIC_API_URL=https://replace-me.execute-api.us-east-1.amazonaws.com/prod/
```

- [ ] **Step 4: Create `frontend/.env.local` with the real URL**

Single line, using the exact value printed by Step 1. Keep the trailing slash; the client strips it.

```bash
EXPO_PUBLIC_API_URL=<paste the ApiUrl value from Step 1>
```

The literal URL is deliberately not written into this plan, because this file is committed and Step 5 exists to keep that value out of the repository.

- [ ] **Step 5: Verify git ignores the real file and tracks the example**

```bash
cd frontend
git check-ignore -v .env.local && echo "IGNORED (correct)"
git check-ignore .env.example || echo "NOT ignored (correct)"
```

Expected: `.env.local` matches the `.env*.local` rule and prints `IGNORED (correct)`. `.env.example` is not ignored and prints `NOT ignored (correct)`.

This step is the gate that keeps a personal deployment URL out of the repository. Do not skip it.

- [ ] **Step 6: Create `frontend/src/api/client.ts`**

```ts
export type ApiErrorKind = "config" | "network" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;

    // Required: without this, `error instanceof ApiError` can be false once the
    // class is transpiled and run on Hermes, which would silently downgrade
    // every real error message to a generic fallback in the UI.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function resolveBaseUrl(): string {
  // Inlined by Expo at build time, so this is a literal after bundling.
  const raw = process.env.EXPO_PUBLIC_API_URL;

  if (!raw) {
    throw new ApiError(
      "config",
      "EXPO_PUBLIC_API_URL is not set. Copy frontend/.env.example to " +
        "frontend/.env.local, add the API URL, then fully reload the app."
    );
  }

  // The deployed URL ends in a trailing slash; strip it so joining is predictable.
  return raw.replace(/\/+$/, "");
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(
      "network",
      `Could not reach ${url}. Check the device's network connection and ` +
        `that EXPO_PUBLIC_API_URL is correct.`
    );
  }

  if (!response.ok) {
    throw new ApiError(
      "http",
      `${url} returned HTTP ${response.status}.`,
      response.status
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("parse", `${url} did not return valid JSON.`);
  }
}
```

- [ ] **Step 7: Run the typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits 0 with no output.

- [ ] **Step 8: Add a Setup section to the root `README.md`**

The README is currently a single title line. Append the block below. It is shown here inside a four-backtick fence so that its own three-backtick fences survive; write only the inner content to the README.

````markdown
## Setup

### Backend

```bash
cd backend
npm install
npx cdk deploy
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Put the ApiUrl output of BackendStack into .env.local, then:
npm start
```

Open the project in Expo Go on a physical device, or press `i` for the iOS simulator.

`EXPO_PUBLIC_API_URL` is inlined at build time. After editing `.env.local`, do a
full in-app reload (shake, then Reload) rather than a fast refresh.
````

- [ ] **Step 9: Commit**

```bash
git add frontend/.env.example frontend/src/api/client.ts README.md
git status --short   # confirm .env.local is NOT staged
git commit -m "feat(frontend): add API client and environment configuration"
```

---

### Task 2: Hello endpoint and the three-state screen

**Files:**
- Create: `frontend/src/api/hello.ts`
- Modify: `frontend/App.tsx` (replace the template contents entirely)

**Interfaces:**
- Consumes: `apiRequest<T>`, `ApiError` from `frontend/src/api/client.ts`
- Produces:
  - `HelloResponse` — `{ message: string }`
  - `fetchHello(): Promise<HelloResponse>`

- [ ] **Step 1: Create `frontend/src/api/hello.ts`**

```ts
import { apiRequest } from "./client";

export type HelloResponse = {
  message: string;
};

export function fetchHello(): Promise<HelloResponse> {
  return apiRequest<HelloResponse>("/hello");
}
```

- [ ] **Step 2: Replace `frontend/App.tsx`**

Replace the whole file. Do not keep the template text.

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { ApiError } from "./src/api/client";
import { fetchHello } from "./src/api/hello";

type ScreenState =
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function App() {
  const [state, setState] = useState<ScreenState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { message } = await fetchHello();
      setState({ status: "success", message });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {state.status === "loading" && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.caption}>Contacting the backend…</Text>
        </>
      )}

      {state.status === "success" && (
        <>
          <Text style={styles.heading}>Connected</Text>
          <Text style={styles.message}>{state.message}</Text>
        </>
      )}

      {state.status === "error" && (
        <>
          <Text style={styles.heading}>Could not connect</Text>
          <Text style={styles.error}>{state.message}</Text>
        </>
      )}

      <View style={styles.actions}>
        <Button title="Retry" onPress={() => void load()} />
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  caption: {
    marginTop: 12,
    color: "#666",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: "#b00020",
    textAlign: "center",
  },
  actions: {
    marginTop: 24,
  },
});
```

- [ ] **Step 3: Run the typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits 0 with no output.

- [ ] **Step 4: Verify the success path on a device**

```bash
cd frontend && npm start
```

Open the project in Expo Go on the physical Android device.

Expected: a brief spinner reading "Contacting the backend…", then the heading "Connected" above the text **Hello from Waypoint backend**.

The success state is the milestone's headline result. Confirm the message text matches the Lambda's output exactly rather than assuming it rendered.

- [ ] **Step 5: Verify the error path on a device**

Temporarily corrupt the host in `frontend/.env.local`:

```bash
EXPO_PUBLIC_API_URL=https://wrong-host.execute-api.us-east-1.amazonaws.com/prod/
```

Then do a **full reload** in Expo Go (shake, then Reload). A fast refresh will not pick this up, because the value is inlined at build time.

Expected: the heading "Could not connect" above a message beginning "Could not reach https://wrong-host…". Specifically **not** a blank screen, an indefinite spinner, or a red error overlay.

- [ ] **Step 6: Restore the real URL**

Put the correct value back in `frontend/.env.local`, fully reload, and confirm the success state returns.

Do not skip this. Leaving a broken URL behind makes the next milestone's first run fail confusingly.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/hello.ts frontend/App.tsx
git status --short   # confirm .env.local is NOT staged
git commit -m "feat(frontend): fetch and display hello message from backend"
```

---

## Done when

All of the following hold:

- [ ] `npx tsc --noEmit` in `frontend/` exits 0.
- [ ] Expo Go on the physical Android device shows "Hello from Waypoint backend", fetched live from the deployed Lambda.
- [ ] A deliberately wrong `EXPO_PUBLIC_API_URL` produces a readable on-screen error naming the unreachable URL, not a blank screen or a hang.
- [ ] `git status` is clean and `frontend/.env.local` is untracked.
- [ ] `frontend/.env.example` is committed.

## Explicitly out of scope

Named because a reader might reasonably assume they are included:

- **No frontend test harness.** Expo's testing setup is real work and belongs in its own milestone. Verification here is the typecheck plus on-device checks, which is the honest check for UI wiring. Milestone 2 introduces the first automated test, on the backend, where jest is already configured.
- **No changes to the backend.** The hello Lambda and the stack are untouched. Milestone 2 owns the API restructuring.
- **No navigation library, state management library, or data-fetching library.** One screen needs none of them.
- **No CORS configuration.** See Global Constraints.
- **No retry, backoff, or timeout policy** beyond the manual Retry button. Add it when a real endpoint justifies it.
- **`app.json` still names the app "frontend".** Renaming is cosmetic and unrelated; leave it for a milestone that touches app identity.
