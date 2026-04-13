# Squad Commander — Design Specification v3

**Date:** 2026-04-13
**Status:** Approved (v3 — integrated ATM + Squad research findings)
**Author:** duongau + Copilot

---

## Problem Statement

Managing Squad agent teams through CLI commands and markdown files works, but lacks visibility and automation. There's no visual overview of team structure, no way to chain agent tasks into reusable pipelines, and no scheduling without manual cron setup. ATM (Agent Team Manager) solves this for Claude Code agents, but nothing exists for GitHub Copilot's Squad ecosystem.

## Proposed Solution

**Squad Commander** — an Electron desktop app that provides visual orchestration for any Squad-powered project. It bridges the visual org-chart management of Claude Agent Team Manager (ATM) with the repo-native execution of Squad CLI/SDK. It reads and writes standard `.squad/` files (no proprietary formats), giving users a drag-and-drop org chart, visual pipeline builder with conditional branching, scheduling, real-time execution monitoring, and multi-engine dispatch.

The app is **general-purpose** — it works with any Squad setup regardless of domain. Users can later extend it for specific workflows (e.g., content development, DevOps) as needed.

## Vision: The 5-Layer Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Strategy** | Commander UI (org chart + pipeline builder) | Visual goal setting, team design, workflow orchestration |
| **Orchestration** | Squad CLI / SDK + extensible runner registry | Repo-native task delegation and parallel execution |
| **Automation** | Ralph-Watch + Scheduler | Background monitoring of issues + scheduled pipeline runs |
| **Memory** | decisions.md + MCP connectors (future) | Persistent repo-native "brain" and external data access |
| **Guardrails** | CostTracker + HookPipeline | Token budgets, PII scrubbing, reviewer lockout, governance |

> **Relationship to ATM (Claude-Agent-Team-Manager):** Squad Commander is fully standalone — no code dependency on ATM. We draw UX inspiration from ATM's visual patterns but build our own implementation on Copilot CLI + Squad SDK. ATM targets Claude Code; Commander targets GitHub Copilot.

## Design Principles

1. **No lock-in** — All state lives in `.squad/` files. Squad works identically with or without Commander.
2. **SDK-first with fallback** — Uses `@bradygaster/squad-sdk` for file operations when possible. Falls back to direct markdown parsing (gray-matter + custom parsers) for markdown-first projects.
3. **Live sync** — File watcher on `.squad/` ensures the UI reflects external changes (CLI, VS Code, other editors).
4. **Pipeline as data** — Pipelines are JSON files in `.squad/pipelines/`, version-controlled with your project.
5. **Don't compete with Ralph** — Squad's watch mode (Ralph) handles issue triage. Commander orchestrates workflow pipelines. They complement, not conflict.
6. **Multi-engine ready** — Runner registry pattern supports multiple agent engines (Squad CLI, Claude Code, custom) from day one. Only Squad ships in Phase 1.
7. **Decisions are the source of truth** — The pipeline engine reads `.squad/decisions.md` before delegating work and writes decisions back after completion.
8. **Cost-aware execution** — Token budgets and cost tracking are first-class concerns, not afterthoughts.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop | Electron 33+ | Native Node.js access to Squad SDK, no bridge needed |
| Frontend | React 19 + TypeScript 5.x | Modern React with strict types |
| Bundler | Vite | Fast dev server and production builds |
| Canvas | @xyflow/react (React Flow v12) + dagre | Proven for org chart UIs (used by ATM, n8n, Flowise) |
| State | Zustand v5 | Lightweight, no boilerplate |
| Editor | Monaco Editor | VS Code's editor engine, perfect for markdown/YAML |
| Scheduling | node-cron | In-process cron for Electron main |
| Notifications | Electron Notification API | Native desktop notifications |
| SDK | @bradygaster/squad-sdk | Direct import, caret version range |
| Markdown | gray-matter + remark | Fallback parsers for markdown-first projects |
| File watch | chokidar | Reliable cross-platform file watching |
| Testing | Vitest + React Testing Library | Unit and component tests |
| E2E | Playwright (Electron support) | Full app flow tests (Phase 4) |
| CI | GitHub Actions + Dependabot | Auto-update SDK, build/test on PR |

---

## Architecture

```
┌───────────────────────────────────────────────┐
│                Electron Main                  │
│                                               │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Squad Bridge │  │  File Watcher        │  │
│  │  (SDK +       │  │  (chokidar on        │  │
│  │   fallback +  │  │   .squad/ + log/ +   │  │
│  │   CLI cmds)   │  │   orchestration-log/)│  │
│  └───────────────┘  └──────────────────────┘  │
│                                               │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Pipeline     │  │  Scheduler           │  │
│  │  Engine       │  │  (node-cron)         │  │
│  └───────────────┘  └──────────────────────┘  │
│                                               │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Runner       │  │  Notification        │  │
│  │  Registry     │  │  Service             │  │
│  │  (extensible) │  │                      │  │
│  └───────────────┘  └──────────────────────┘  │
│                                               │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Cost         │  │  Telemetry           │  │
│  │  Tracker      │  │  Aggregator          │  │
│  └───────────────┘  └──────────────────────┘  │
├───────────────────────────────────────────────┤
│       IPC Bridge (preload.ts + types)         │
├───────────────────────────────────────────────┤
│                React Frontend                 │
│                                               │
│  ┌─────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ Canvas  │ │ Pipeline  │ │  Schedule    │  │
│  │ + Quick │ │ Builder   │ │  Manager     │  │
│  │  Run    │ │           │ │              │  │
│  └─────────┘ └───────────┘ └──────────────┘  │
│                                               │
│  ┌─────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ Charter │ │ Decision  │ │  Dashboard   │  │
│  │ Editor  │ │  Log      │ │  + Ralph     │  │
│  │ (Monaco)│ │           │ │  + Telemetry │  │
│  └─────────┘ └───────────┘ └──────────────┘  │
│                                               │
│  ┌─────────┐ ┌───────────┐                   │
│  │ Cost    │ │ Settings  │                   │
│  │ Monitor │ │ + Hooks   │                   │
│  └─────────┘ └───────────┘                   │
└───────────────────────────────────────────────┘
```

### Electron Main Process

- **Squad Bridge** — The adapter between Commander and Squad. Reads `.squad/` files via SDK (falls back to gray-matter for markdown-first projects). Translates UI actions into Squad SDK calls or CLI commands (`squad init`, `squad hire`). Handles bidirectional sync with conflict detection.
- **File Watcher** — chokidar watches `.squad/`, `.squad/log/`, and `.squad/orchestration-log/` for external changes. Pushes updates to renderer via IPC. Debounced (300ms). Powers both the org chart live-sync and the telemetry stream.
- **Pipeline Engine** — Executes pipeline steps. Reads `decisions.md` before delegating (persistence layer). Generates context files, spawns runner, captures output, evaluates conditions, handles fan-out/fan-in for parallel steps. Writes decisions back after completion.
- **Runner Registry** — Extensible registry of agent runners. Ships with Copilot CLI runner (`gh copilot`). Each runner defines: command, flags, context format, output capture method, and token parsing patterns. New runners can be added via settings without code changes.
- **Cost Tracker** — Parses token usage from runner stdout. Accumulates per-step and per-run totals. Estimates cost based on configurable model rates. Emits `budget-exceeded` event when threshold is hit, which the Pipeline Engine treats as an auto-triggered approval gate.
- **Telemetry Aggregator** — Aggregates real-time activity from `.squad/log/` and `.squad/orchestration-log/`. Pushes live activity stream to the Dashboard via IPC. Tracks per-agent metrics (runs, decisions, success rate).
- **Scheduler** — `node-cron` managing scheduled pipeline runs. Runs in background even when app is minimized to tray.
- **Notification Service** — Desktop notifications for pipeline events, approval gates, budget alerts, scheduled run results.

### IPC Bridge

Typed IPC channels via `preload.ts` using contextBridge (no nodeIntegration in renderer):

```typescript
interface CommanderAPI {
  // Squad state
  squad: {
    getTeam(): Promise<Team>;
    getAgents(): Promise<Agent[]>;
    getRouting(): Promise<Routing>;
    getDecisions(): Promise<Decision[]>;
    updateAgent(name: string, charter: string): Promise<void>;
    createAgent(config: AgentConfig): Promise<void>;
    deleteAgent(name: string): Promise<void>;
    reparentAgent(name: string, newParent: string): Promise<void>;
  };

  // Quick Run (single-step execution)
  quickRun: {
    execute(agent: string, prompt: string): Promise<RunHandle>;
    cancel(runId: string): Promise<void>;
  };

  // Pipelines
  pipelines: {
    list(): Promise<Pipeline[]>;
    get(id: string): Promise<Pipeline>;
    save(pipeline: Pipeline): Promise<void>;
    delete(id: string): Promise<void>;
    validate(pipeline: Pipeline): Promise<ValidationResult>;
    run(id: string, variables?: Record<string, string>): Promise<RunHandle>;
    pause(runId: string): Promise<void>;
    resume(runId: string): Promise<void>;
    cancel(runId: string): Promise<void>;
    approveGate(runId: string, gateId: string): Promise<void>;
    rejectGate(runId: string, gateId: string): Promise<void>;
    getRunHistory(pipelineId: string): Promise<PipelineRun[]>;
    getRunDetails(runId: string): Promise<PipelineRunDetail>;
    getTemplates(): Promise<PipelineTemplate[]>;
  };

  // Schedules
  schedules: {
    list(): Promise<Schedule[]>;
    create(config: ScheduleConfig): Promise<void>;
    update(id: string, config: Partial<ScheduleConfig>): Promise<void>;
    delete(id: string): Promise<void>;
    toggle(id: string, enabled: boolean): Promise<void>;
  };

  // Ralph monitor
  ralph: {
    getStatus(): Promise<RalphStatus | null>;
    start(config: RalphConfig): Promise<void>;
    stop(): Promise<void>;
  };

  // Cost tracking & guardrails
  costs: {
    getCurrentRun(): Promise<CostSnapshot | null>;
    getHistory(): Promise<CostHistory>;
    setBudget(tokens: number): Promise<void>;
    approveBudgetOverride(runId: string): Promise<void>;
  };

  // Telemetry (live activity stream)
  telemetry: {
    getAgentMetrics(): Promise<AgentMetrics[]>;
    getTeamStats(): Promise<TeamStats>;
    getLiveLog(limit?: number): Promise<LogEntry[]>;
  };

  // Runner registry
  runners: {
    list(): Promise<RunnerConfig[]>;
    add(config: RunnerConfig): Promise<void>;
    update(name: string, config: Partial<RunnerConfig>): Promise<void>;
    remove(name: string): Promise<void>;
    detect(): Promise<DetectedRunner[]>;
  };

  // Settings
  settings: {
    get(): Promise<AppSettings>;
    update(settings: Partial<AppSettings>): Promise<void>;
    getHooks(): Promise<HookConfig[]>;
    updateHooks(hooks: HookConfig[]): Promise<void>;
  };

  // Events (renderer subscribes to main process events)
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
}
```

---

## Features

### 1. Visual Org Chart (Canvas) + Quick Run

**Purpose:** See your entire Squad hierarchy at a glance. Run agents directly.

**Org Chart:**
- Renders agents from `.squad/team.md` and `.squad/agents/*/charter.md` as React Flow nodes
- Node types with color coding: Lead (gold), Agent (blue), Scribe (gray), Custom roles (configurable)
- Drag-drop to reparent agents (updates `team.md` on drop)
- Right-click context menu: Edit Charter, Duplicate, Delete, Change Role, Quick Run
- Click agent → Inspector panel slides in with charter summary, routing rules, recent decisions
- Double-click agent → Opens charter in Monaco editor
- File watcher: `.squad/` changes auto-update the canvas
- Supports both markdown-first (`.squad/`) and SDK-first (`squad.config.ts`) projects
- Dagre auto-layout with manual position overrides saved to `.squad/commander.json`
- Visual distinction from pipeline canvas: horizontal tree layout, rounded nodes

**Quick Run:**
- Select an agent from the org chart (or pick from dropdown)
- Type an objective/prompt in a text area
- Click "Run" → spawns agent runner with generated context file
- Live output panel shows stdout/stderr
- This is the simplest form of pipeline execution — validates the process spawning infrastructure early and provides immediate utility

### 2. Pipeline Builder

**Purpose:** Visually chain agent tasks into reusable, executable workflows.

**Canvas:**
- Separate canvas using React Flow in flowchart mode (top-to-bottom layout)
- Visual distinction from org chart: vertical layout, rectangular step blocks, colored connectors
- Left panel: palette of available step types and agents

**Step Types (7):**

| Type | Icon | Description |
|------|------|-------------|
| **Task** | 🔧 | An agent executes a prompt. Core building block. |
| **Condition** | 🔀 | Evaluates previous step result. Routes to true/false branch. |
| **Router** | 🧭 | Dynamic dispatch: evaluates output and picks from N possible next steps. Like Condition but multi-way. |
| **Approval Gate** | 🖐️ | Pauses execution for human review. |
| **Parallel** | ⚡ | Fan-out: run multiple steps simultaneously. Fan-in: wait for all to complete. |
| **Loop** | 🔄 | Repeat a step/group until a condition is met (max iterations as safety). |
| **Delay** | ⏱️ | Wait N seconds/minutes before continuing. For rate limiting or timing. |

**Task Step Configuration:**
- Agent name (dropdown from team)
- Prompt/objective (text area, supports `{{variable}}` syntax)
- Timeout in seconds (optional)
- Success criteria (optional, used by downstream conditions)

**Condition Step Configuration:**
- Expression: `step.{id}.success` (boolean) or `step.{id}.output.contains("text")`
- True target → step id
- False target → step id

**Router Step Configuration:**
- Evaluates previous step output against N named routes
- Each route: label + match expression + target step id
- Default/fallback route for unmatched output
- Example: output contains "critical" → hotfix branch, "minor" → backlog branch, default → standard branch

**Parallel Step Configuration:**
- List of child step IDs to run simultaneously
- Fan-in behavior: wait for all / wait for first / wait for majority

**Loop Step Configuration:**
- Body: step(s) to repeat
- Condition: when to stop (e.g., `step.{id}.success === true`)
- Max iterations: safety limit (default: 5)

**Pipeline Variables (Template Parameters):**
- Defined at pipeline level: `variables: [{ name: "pr_url", type: "string", required: true, default: "" }]`
- Referenced in step prompts: `"Review the PR at {{pr_url}}"`
- When running, Commander prompts for variable values
- Scheduled pipelines use saved default values

**Validation:**
- Checks for unreachable nodes, missing connections, invalid agent references
- Validates variable references exist in the pipeline's variable list
- Loop steps must have max iterations set
- At least one Start and one End node

**Built-in Templates (4):**
1. **Code Review** — Analyze → Review → Report
2. **Build & Test** — Build → Test → (pass? → Deploy : Fix → Retest loop)
3. **Research & Write** — Research → Outline → Draft → Review → Finalize
4. **Multi-Reviewer** — Parallel reviews → Merge feedback → Final decision

### 3. Pipeline Execution & Monitoring

**Purpose:** Run pipelines and watch progress in real time.

**Execution Model:**
Pipeline steps do NOT go through Squad's message routing. Instead, each step generates a **context file** that combines:
1. The agent's charter (from `.squad/agents/{name}/charter.md`)
2. The step's objective/prompt (with variables resolved)
3. Context from previous steps (output files from prior steps)
4. Success criteria (if defined)

The context file is passed to the agent runner: `{agentCmd} -p {contextFile}`

This is more deterministic than relying on Squad's coordinator routing for automated workflows.

**Context Handoff (File-Based):**
Each pipeline run gets its own directory:

```
.squad/pipelines/runs/{pipelineId}/{runId}/
├── run.json                    # Run metadata (status, timing, variables)
├── context-{stepId}.md         # Generated context file for the step
├── stdout-{stepId}.log         # Raw stdout capture
├── output-{stepId}.md          # Agent's structured output
└── ...
```

- Each step's output is captured to `stdout-{stepId}.log`
- The step prompt includes: "Write your results to `output-{stepId}.md`"
- The next step's context file includes the previous step's `output-{stepId}.md` content
- This is inspectable, debuggable, and git-friendly

**Real-Time Monitoring:**
- Pipeline canvas shows live status per step node: ⏳ Pending → 🔄 Running → ✅ Done → ❌ Failed → ⏭️ Skipped
- Output panel shows live stdout/stderr from the current step
- Progress bar for overall pipeline completion
- Pause: freezes execution after current step finishes
- Resume: continues from the paused step
- Cancel: kills the current process, marks remaining steps as cancelled

**Parallel Execution:**
- Parallel steps spawn multiple agent runner processes simultaneously
- Each parallel child gets its own context file and output file
- Fan-in waits for all children (or configurable: first/majority)
- A merge context file is generated combining all parallel outputs

**Loop Execution:**
- Loop body executes, then condition is evaluated
- If condition is false, body re-executes with iteration count incremented
- If max iterations reached, loop exits with failure
- Each iteration's output is preserved: `output-{stepId}-iter{N}.md`

**Error Handling:**
- Step failure → condition steps can route to error handling branches
- Unhandled failure → pipeline stops, notification sent
- Process timeout → step marked as failed with timeout error
- Process crash → stderr captured, step marked as failed

### 4. Human-in-the-Loop Approval Gates

**Purpose:** Insert review checkpoints where execution pauses for human approval.

**Behavior:**
- When execution reaches a gate: pipeline pauses, desktop notification fires
- Gate UI shows: previous step's output, the gate's review prompt, Approve/Reject buttons
- Approve → execution continues to the next step
- Reject → execution stops, pipeline marked as "rejected at gate {name}"
- Optional: timeout on gates (auto-reject after N hours if no human response)
- System tray badge shows count of pending approval gates
- Gates are essential before steps that create PRs, modify files, or deploy

### 5. Scheduler

**Purpose:** Run pipelines automatically on a schedule.

**Behavior:**
- UI: select a pipeline → choose frequency (hourly, daily, weekly, custom cron)
- Time picker for daily/weekly; cron expression editor with preview for custom
- Variable values can be set per schedule (or use pipeline defaults)
- Schedules managed by `node-cron` in Electron main process
- Persist in `.squad/schedules.json`
- System tray tooltip shows next scheduled run time
- Run history with success/failure counts and links to run details
- Enable/disable toggle per schedule without deleting
- Continues running when app is minimized to system tray

**Schedule Schema:**
```json
{
  "schedules": [
    {
      "id": "daily-review",
      "pipelineId": "code-review-pipeline",
      "cron": "0 6 * * *",
      "enabled": true,
      "variables": { "pr_url": "latest" },
      "lastRun": "2026-04-12T06:00:00Z",
      "lastStatus": "success",
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

### 6. Agent Activity Dashboard + Ralph Monitor

**Purpose:** At-a-glance view of team health, activity, and Ralph status.

**Agent Activity:**
- Card grid showing each agent with:
  - Name, role, status indicator (active/idle/error)
  - Last pipeline run timestamp
  - Success/failure rate (from run history)
  - Decision count (from `decisions.md`)
  - Sparkline of recent activity
- Team-level stats: total runs, success rate, most active agent, total decisions
- Filterable by date range and agent
- Data derived from `.squad/decisions.md` and `.squad/pipelines/runs/`

**Ralph Monitor:**
- Detects whether Ralph (Squad watch mode) is running
- Shows: PID, uptime, last poll time, issues triaged, current status
- Start/Stop Ralph from the UI (spawns `squad watch --execute`)
- Ralph config: polling interval, execute mode, overnight hours
- This is READ-ONLY integration — Commander surfaces Ralph's status, doesn't replace it

### 7. Agent Charter Editor

**Purpose:** Edit agent charters without leaving the app.

- Monaco Editor with markdown syntax highlighting
- YAML frontmatter validation (highlights invalid/missing fields inline)
- Side-by-side rendered preview (react-markdown)
- Autosave after 800ms idle
- "New Agent" button → scaffolds charter from Squad's template
- Charter changes written to `.squad/agents/{name}/charter.md`

### 8. Decision Log Viewer

**Purpose:** Browse and search the team's decision history.

- Reads `.squad/decisions.md` and parses into structured entries
- Timeline view: date, agent, decision summary, context
- Full-text search across all decisions
- Filters: by agent, by date range, by topic/tag
- Click a decision → expands to show full context and reasoning
- Links decisions to related pipeline runs when available

### 9. Desktop Notifications

**Purpose:** Know when things happen without watching the app.

- Uses Electron's Notification API (native OS notifications)
- Triggers: step completed, pipeline completed, pipeline failed, approval gate waiting, scheduled run completed/failed
- System tray icon with badge for pending approval gates
- Click notification → brings Commander to foreground, focuses relevant view
- Notification preferences in Settings (toggle per event type)

### 10. Export/Import

- Export: team config, agents, routing, pipelines, schedules → single `.squad-export.json`
- Import: loads export file, writes to `.squad/`
- Merge mode: prompt for conflict resolution (overwrite/skip/rename)
- Does NOT export decision history or run output (project-specific)

### 11. Settings

- **Project selector** — Open/switch Squad projects (remembers recent)
- **Agent runner** — Configurable command path (auto-detected, overridable). Default flags. Working directory.
- **SDK version** — Displays installed `@bradygaster/squad-sdk` version
- **Theme** — Light/dark toggle
- **Notifications** — Toggle per event type
- **Window** — Remembers size/position across sessions

---

## Data Model

### Files Created by Commander

All new files live inside the existing `.squad/` directory:

| File/Directory | Purpose |
|------|---------|
| `.squad/pipelines/{id}.json` | Pipeline definition |
| `.squad/pipelines/runs/{pipelineId}/{runId}/` | Individual run directory with context files, stdout, output |
| `.squad/schedules.json` | Schedule configurations |
| `.squad/commander.json` | App settings (window state, theme, node positions, agent runner config) |

### Pipeline Definition Schema

```json
{
  "id": "code-review-pipeline",
  "name": "Code Review Pipeline",
  "description": "Automated code review workflow",
  "version": 1,
  "variables": [
    { "name": "pr_url", "type": "string", "required": true, "default": "" },
    { "name": "branch", "type": "string", "required": false, "default": "main" }
  ],
  "steps": [
    {
      "id": "start",
      "type": "start"
    },
    {
      "id": "analyze",
      "type": "task",
      "agent": "keaton",
      "prompt": "Analyze the PR at {{pr_url}} on branch {{branch}}",
      "timeout": 300,
      "successCriteria": "Analysis report generated"
    },
    {
      "id": "gate-review",
      "type": "approval",
      "message": "Review Keaton's analysis before proceeding to implementation"
    },
    {
      "id": "check-severity",
      "type": "condition",
      "eval": "step.analyze.success",
      "trueTarget": "parallel-review",
      "falseTarget": "report-failure"
    },
    {
      "id": "parallel-review",
      "type": "parallel",
      "children": ["review-style", "review-tests"],
      "fanIn": "all"
    },
    {
      "id": "review-style",
      "type": "task",
      "agent": "edie",
      "prompt": "Review code style and type safety"
    },
    {
      "id": "review-tests",
      "type": "task",
      "agent": "hockney",
      "prompt": "Review test coverage and edge cases"
    },
    {
      "id": "implement-fixes",
      "type": "loop",
      "body": ["fix-step", "test-step"],
      "condition": "step.test-step.success === true",
      "maxIterations": 3
    },
    {
      "id": "fix-step",
      "type": "task",
      "agent": "fenster",
      "prompt": "Fix issues identified in reviews"
    },
    {
      "id": "test-step",
      "type": "task",
      "agent": "hockney",
      "prompt": "Run tests and verify fixes"
    },
    {
      "id": "report-failure",
      "type": "task",
      "agent": "mcmanus",
      "prompt": "Write failure report"
    },
    {
      "id": "end",
      "type": "end"
    }
  ],
  "edges": [
    { "source": "start", "target": "analyze" },
    { "source": "analyze", "target": "gate-review" },
    { "source": "gate-review", "target": "check-severity" },
    { "source": "parallel-review", "target": "implement-fixes" },
    { "source": "implement-fixes", "target": "end" },
    { "source": "report-failure", "target": "end" }
  ],
  "metadata": {
    "created": "2026-04-13T00:00:00Z",
    "modified": "2026-04-13T00:00:00Z",
    "tags": ["code-review", "ci"],
    "template": false
  }
}
```

### Pipeline Run Record

```json
{
  "runId": "uuid-abc123",
  "pipelineId": "code-review-pipeline",
  "pipelineVersion": 1,
  "startedAt": "2026-04-13T06:00:00Z",
  "completedAt": "2026-04-13T06:15:30Z",
  "status": "completed",
  "triggeredBy": "schedule",
  "variables": { "pr_url": "https://github.com/org/repo/pull/42", "branch": "main" },
  "steps": [
    {
      "stepId": "analyze",
      "status": "completed",
      "startedAt": "2026-04-13T06:00:01Z",
      "completedAt": "2026-04-13T06:03:22Z",
      "durationMs": 201000,
      "outputFile": "output-analyze.md",
      "error": null
    }
  ]
}
```

---

## Project Structure

```
squad-commander/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── .github/
│   ├── dependabot.yml          # Weekly SDK update checks
│   └── workflows/
│       └── ci.yml              # Build, test, lint on PR
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point, window management, tray
│   │   ├── preload.ts           # contextBridge IPC (no nodeIntegration)
│   │   ├── squad-bridge.ts      # Squad SDK + fallback parsing + CLI command adapter
│   │   ├── file-watcher.ts      # chokidar on .squad/ + log/ + orchestration-log/
│   │   ├── pipeline-engine.ts   # Step execution, branching, parallel, loops
│   │   ├── runner-registry.ts   # Extensible agent runner registry
│   │   ├── context-builder.ts   # Context files (charter + prompt + decisions + prior output)
│   │   ├── cost-tracker.ts      # Token parsing, budget enforcement (Phase 5)
│   │   ├── telemetry-aggregator.ts # Live activity stream from .squad/log/ (Phase 4)
│   │   ├── scheduler.ts         # node-cron schedule management
│   │   ├── ralph-monitor.ts     # Detect and monitor Ralph watch process
│   │   └── notification.ts      # Desktop notification dispatch
│   ├── renderer/                # React frontend
│   │   ├── App.tsx              # Layout shell with sidebar navigation
│   │   ├── main.tsx             # React entry
│   │   ├── stores/              # Zustand stores
│   │   │   ├── squad-store.ts   # Team, agents, routing state
│   │   │   ├── pipeline-store.ts # Pipelines, runs, execution state
│   │   │   ├── schedule-store.ts # Schedules
│   │   │   ├── cost-store.ts    # Token usage and budget state (Phase 5)
│   │   │   └── settings-store.ts # App settings + runner configs
│   │   ├── views/
│   │   │   ├── CanvasView.tsx   # Org chart + Quick Run panel
│   │   │   ├── PipelineView.tsx # Pipeline list, builder, execution monitor
│   │   │   ├── ScheduleView.tsx # Schedule manager + run history
│   │   │   ├── DashboardView.tsx # Agent activity + Ralph monitor + telemetry
│   │   │   ├── DecisionLogView.tsx
│   │   │   ├── CostView.tsx     # Cost monitor + budget config (Phase 5)
│   │   │   └── SettingsView.tsx # Settings + runner registry + hook config
│   │   ├── components/
│   │   │   ├── canvas/          # OrgChartNode, AgentInspector, QuickRunPanel
│   │   │   ├── pipeline/        # StepNode, StepPalette, PipelineCanvas, VariableEditor
│   │   │   ├── execution/       # RunMonitor, OutputPanel, ApprovalGateDialog
│   │   │   ├── editor/          # CharterEditor (Monaco wrapper), YamlValidator
│   │   │   ├── dashboard/       # AgentCard, TeamStats, RalphStatus, Sparkline, LiveLog
│   │   │   ├── cost/            # CostBadge, BudgetGauge, TokenBreakdown (Phase 5)
│   │   │   └── common/          # Button, Modal, Sidebar, Notification badge
│   │   └── styles/
│   │       ├── theme.ts         # Light/dark theme tokens
│   │       └── global.css
│   └── shared/                  # Types shared between main/renderer
│       ├── types.ts             # Core domain types
│       ├── ipc-channels.ts      # IPC channel name constants
│       ├── pipeline-schema.ts   # Pipeline JSON schema (Zod)
│       └── runner-types.ts      # Runner registry types
├── templates/                   # Built-in pipeline templates
│   ├── code-review.json
│   ├── build-and-test.json
│   ├── research-and-write.json
│   └── multi-reviewer.json
├── docs/
│   ├── specs/
│   │   └── 2026-04-13-squad-commander-design.md
│   └── ROADMAP.md               # Phase roadmap with milestones
└── test/
    ├── main/
    │   ├── pipeline-engine.test.ts   # Core pipeline logic
    │   ├── context-builder.test.ts   # Context file generation + decisions.md
    │   ├── squad-bridge.test.ts      # SDK + fallback parsing + CLI adapter
    │   ├── runner-registry.test.ts   # Runner config, spawn, lifecycle
    │   ├── cost-tracker.test.ts      # Token parsing, budget enforcement
    │   └── scheduler.test.ts         # Cron schedule management
    └── renderer/
        ├── CanvasView.test.tsx
        └── PipelineView.test.tsx
```

---

## Implementation Phases

### Phase 1: Visual Squad + Quick Run
**Goal:** See your team, edit charters, run a single agent — immediately useful.

- Electron + React + Vite scaffolding with contextBridge security model
- **Squad Bridge** (`squad-bridge.ts`): read `.squad/` files via SDK with gray-matter fallback. Translate UI actions to SDK/CLI calls. Conflict detection for bidirectional sync.
- File watcher (chokidar, debounced) for live sync on `.squad/`
- Org chart canvas (React Flow + dagre, horizontal tree layout)
- Agent inspector panel (charter summary, routing, recent decisions)
- Monaco charter editor with YAML validation + autosave
- Quick Run panel: select agent → type prompt → execute → see output
- **Runner Registry** (`runner-registry.ts`): extensible pattern with Copilot CLI as the default runner. Each runner defines command, flags, context format, output capture, and token parsing patterns.
- **Context Builder** (`context-builder.ts`): generates context file from charter + prompt. Includes relevant decisions from `decisions.md` (Persistence Layer — source of truth).
- Settings view (project selector, runner config, theme)
- **Tests:** squad-bridge parsing, context-builder, runner-registry mocking

### Phase 2: Pipeline Builder + Execution
**Goal:** Build and run multi-step agent workflows visually.

- Pipeline builder canvas (vertical flowchart, distinct from org chart)
- Step palette: Task, Condition, Approval Gate, Parallel, Loop, Delay
- **Task steps include optional `engine` field** — defaults to the project's default runner. Architecture supports multiple runners from day one even though only one ships initially.
- Drag-drop step creation and edge connection
- Step configuration panels (prompt, agent, timeout, variables)
- Pipeline variables (template parameters with `{{var}}` syntax)
- Pipeline validation (unreachable nodes, missing connections, invalid agent refs)
- Pipeline JSON persistence in `.squad/pipelines/`
- **Pipeline Engine**: sequential execution, condition evaluation, context handoff
  - Reads `decisions.md` before delegating work to any agent
  - Writes decisions back after step completion
- Parallel step execution (spawn multiple runner processes, fan-in)
- Loop step execution (repeat with iteration tracking, max iterations safety)
- Run directory with context files, stdout logs, output files
- Real-time status updates via IPC
- Output panel with live stdout/stderr
- Pause/resume/cancel controls
- Built-in pipeline templates (4)
- **Tests:** pipeline-engine (all step types, branching, loops, parallel, error handling), pipeline validation

### Phase 3: Automation
**Goal:** Pipelines run on their own with human checkpoints.

- Approval Gate UI: output display, approve/reject, timeout
- Desktop notifications (Electron Notification API)
- System tray icon with badge for pending gates
- Scheduler UI: pipeline → frequency → variables → enable/disable
- node-cron integration in main process
- Schedule persistence (`.squad/schedules.json`)
- Run history per schedule
- Background operation: scheduler runs when minimized to tray
- **Tests:** scheduler cron parsing, notification dispatch

### Phase 4: Intelligence + Polish
**Goal:** Understand what your team has been doing. Ship it.

- Agent activity dashboard (cards, stats, sparklines)
- **Telemetry Aggregator** (`telemetry-aggregator.ts`): watches `.squad/log/` and `.squad/orchestration-log/` for live activity. Pushes real-time stream to Dashboard via IPC.
- Ralph monitor (detect running watch process, show status, start/stop from UI)
- Decision log viewer (timeline, search, filters, links to pipeline runs)
- Export/import (`.squad-export.json`)
- Electron packaging (electron-builder, Windows + macOS + Linux)
- Dependabot config for SDK updates
- CI workflow (GitHub Actions: build, test, lint)
- E2E tests with Playwright
- **Tests:** E2E flows, export/import round-trip, telemetry aggregation

### Phase 5: Guardrails + Governance
**Goal:** Safe, cost-aware execution at scale.

- **Cost Tracker** (`cost-tracker.ts`): parses token usage from runner stdout using runner-specific patterns. Accumulates per-step and per-run totals. Estimates cost via configurable model pricing.
- **Budget enforcement modes** (user-configurable per pipeline):
  - **Approve to continue** (default) — pauses pipeline at threshold, shows cost summary, user clicks Continue (with optional new budget) or Cancel
  - **Notify only** — warns when threshold is hit but doesn't pause. Desktop notification + in-app banner.
  - **Auto-cancel** — hard kill at threshold. No prompt. For unattended scheduled runs with strict limits.
  - **Disabled** — no cost enforcement. For pipelines where budget isn't a concern.
- **Budget granularity**:
  - Per-pipeline budget: overall token/cost limit for the entire run
  - Per-step budget: individual step limits (e.g., research steps get more tokens than formatting steps)
  - Global budget: across all pipeline runs in a time period (daily/weekly/monthly cap)
- **Cost Monitor UI**: real-time token/cost gauge during pipeline execution. Per-step breakdown. Historical cost per pipeline with charts.
- **Cost reporting**: exportable cost history (CSV/JSON). Filter by pipeline, date range, agent. Tracks cost trends over time.
- **HookPipeline integration**: UI for configuring Squad's built-in hooks:
  - PII scrubbing (toggle, custom patterns)
  - Reviewer lockout (prevent same agent from writing + approving)
  - File-write guards (restrict which files agents can modify)
- Hook configuration persisted in `.squad/commander.json`
- Additional runner engines can be added via Settings (extensible runner registry)
- **Tests:** cost-tracker token parsing, all budget enforcement modes, hook config persistence

### Phase 6: External Integrations
**Goal:** Commander connects to the outside world.

- **MCP server connector**: access external data sources (Google Drive, Jira, ADO) from pipeline steps. Pipeline steps can declare MCP dependencies.
- **Webhook triggers**: expose HTTP endpoint to trigger pipelines from external services (CI/CD, GitHub webhooks, etc.)
- **Notification channels**: beyond desktop — Teams, Slack, email notifications for pipeline events
- **External action items**: monitor Teams channels / email for action items that can be routed to Squad agents (inspired by Squad's existing Teams/Email skills)
- **Tests:** MCP connector mocking, webhook endpoint, notification channel dispatch

---

## Testing Strategy

| Layer | Tool | What we test | When |
|-------|------|-------------|------|
| Unit | Vitest | Pipeline engine, context builder, condition eval, squad-bridge parsing, scheduler, cost-tracker, telemetry | Phase 1+ |
| Component | React Testing Library | Step palette, form validation, node rendering, inspector panel, cost monitor | Phase 1+ |
| Integration | Vitest + mock IPC | Main ↔ renderer communication, file watcher events, store updates, runner registry | Phase 2+ |
| E2E | Playwright (Electron) | Full app flows: open project → view org chart → create pipeline → run pipeline | Phase 4 |

**Test priorities (highest first):**
1. Pipeline engine — most complex logic, all step types, error cases
2. Context builder — correctness of generated context files, decisions.md inclusion
3. Condition evaluation — branching logic must be deterministic
4. Squad bridge — SDK parsing + fallback parsing both work correctly
5. Cost tracker — token parsing accuracy, budget enforcement

---

## Implementation Notes

### Security Model
- **No nodeIntegration** in renderer. All Node.js access via contextBridge preload.
- File system access only through IPC handlers in main process.
- Agent runner processes are sandboxed to the project's working directory.
- HookPipeline PII scrubbing applied before context files are written (Phase 5).

### Process Management
- Runner registry tracks all spawned child processes by PID.
- App exit handler: kill all child processes on quit.
- Process timeout: configurable per step, default 5 minutes.
- Orphan detection: on startup, check for stale PID files from crashed runs.
- Cost tracker monitors total token usage across ALL active processes.

### Persistence Layer
- `decisions.md` is the source of truth for team decisions.
- Context builder reads decisions before every pipeline step delegation.
- Pipeline engine appends new decisions after step completion.
- Decision log viewer provides searchable UI over this file.

### Runner Registry Architecture
```typescript
interface RunnerConfig {
  name: string;              // e.g., "copilot-cli"
  command: string;           // e.g., "gh copilot"
  flags: string[];           // e.g., ["--agent", "squad", "--yolo"]
  contextFormat: "squad-charter" | "plain-prompt"; // how to build context file
  outputCapture: "stdout" | "file";               // how to capture results
  tokenPattern?: RegExp;     // regex to parse token usage from stdout
  isDefault: boolean;
}
```
- Ships with one runner: Copilot CLI (`gh copilot`)
- Users can add custom runners via Settings (Phase 5+)
- Pipeline steps can specify a runner; unspecified steps use the project default

### Windows-Specific
- chokidar may need `usePolling: true` on some Windows file systems.
- Runner processes spawn via PowerShell.
- File paths normalized in Squad Bridge.

### macOS-Specific
- App is unsigned for local dev; notarization needed for distribution.
- System tray uses Electron's Tray API (works on all platforms).

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| How complex should condition expressions be? | Start simple: `step.{id}.success` boolean + `step.{id}.output.contains("text")`. Add expression parser later if needed. |
| Support multiple projects simultaneously? | Single project at a time. Project switcher for convenience. |
| How to invoke agent steps? | Generate context files (charter + prompt + decisions + prior output), invoke runner from registry. Bypass Squad's routing for deterministic execution. |
| How to handle context between steps? | File-based: each run gets a directory, each step writes output to `output-{stepId}.md`, next step reads it. |
| Relationship with Ralph? | Complementary. Commander monitors Ralph status but doesn't replace it. Pipelines are workflow chains; Ralph handles issue triage. |
| One pipeline at a time? | Yes initially. Queue additional runs; don't allow concurrent pipeline execution. |
| Relationship with ATM? | Fully standalone. No code dependency. Watch for UX inspiration only. |
| How to handle token costs? | Cost Tracker parses token counts from runner stdout. Budget exceeded = auto-triggered approval gate. |
| Multiple runner engines? | Runner registry is extensible from Phase 1. Only Copilot CLI ships initially. Users can add runners via Settings in Phase 5+. |
| decisions.md role? | Source of truth. Context builder reads before delegation. Pipeline engine writes after completion. |
