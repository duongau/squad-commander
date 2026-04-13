# Squad Commander — Design Specification v2

**Date:** 2026-04-13
**Status:** Approved (v2 — revised after deep design review)
**Author:** duongau + Copilot

---

## Problem Statement

Managing Squad agent teams through CLI commands and markdown files works, but lacks visibility and automation. There's no visual overview of team structure, no way to chain agent tasks into reusable pipelines, and no scheduling without manual cron setup. ATM (Agent Team Manager) solves this for Claude Code agents, but nothing exists for GitHub Copilot's Squad ecosystem.

## Proposed Solution

**Squad Commander** — an Electron desktop app that provides visual orchestration for any Squad-powered project. It reads and writes standard `.squad/` files (no proprietary formats), giving users a drag-and-drop org chart, visual pipeline builder with conditional branching, scheduling, and real-time execution monitoring.

The app is **general-purpose** — it works with any Squad setup regardless of domain. Users can later extend it for specific workflows (e.g., content development, DevOps) as needed.

## Design Principles

1. **No lock-in** — All state lives in `.squad/` files. Squad works identically with or without Commander.
2. **SDK-first with fallback** — Uses `@bradygaster/squad-sdk` for file operations when possible. Falls back to direct markdown parsing (gray-matter + custom parsers) for markdown-first projects.
3. **Live sync** — File watcher on `.squad/` ensures the UI reflects external changes (CLI, VS Code, other editors).
4. **Pipeline as data** — Pipelines are JSON files in `.squad/pipelines/`, version-controlled with your project.
5. **Don't compete with Ralph** — Squad's watch mode (Ralph) handles issue triage. Commander orchestrates workflow pipelines. They complement, not conflict.
6. **Configurable runner** — Don't hardcode `copilot`. Support any agent runner via settings.

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
┌──────────────────────────────────────────┐
│              Electron Main               │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Squad       │  │  File Watcher   │   │
│  │  Service     │  │  (chokidar on   │   │
│  │  (SDK +      │  │   .squad/)      │   │
│  │   fallback)  │  │                 │   │
│  └──────────────┘  └─────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Pipeline    │  │  Scheduler      │   │
│  │  Engine      │  │  (node-cron)    │   │
│  └──────────────┘  └─────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Agent       │  │  Notification   │   │
│  │  Runner      │  │  Service        │   │
│  │  (configurable│                   │   │
│  │   CLI spawn) │  │                 │   │
│  └──────────────┘  └─────────────────┘   │
├──────────────────────────────────────────┤
│     IPC Bridge (preload.ts + types)      │
├──────────────────────────────────────────┤
│              React Frontend              │
│                                          │
│  ┌────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Canvas │ │ Pipeline │ │ Schedule  │  │
│  │ + Quick│ │ Builder  │ │ Manager   │  │
│  │  Run   │ │          │ │           │  │
│  └────────┘ └──────────┘ └───────────┘  │
│                                          │
│  ┌────────┐ ┌──────────┐ ┌───────────┐  │
│  │Charter │ │ Decision │ │ Dashboard │  │
│  │ Editor │ │   Log    │ │ + Ralph   │  │
│  │(Monaco)│ │          │ │  Monitor  │  │
│  └────────┘ └──────────┘ └───────────┘  │
└──────────────────────────────────────────┘
```

### Electron Main Process

- **Squad Service** — Reads `.squad/` files via SDK. Falls back to gray-matter + custom parsers for markdown-first projects that don't use `squad.config.ts`. All writes go through SDK when possible.
- **File Watcher** — chokidar watches `.squad/` for external changes, pushes updates to renderer via IPC. Debounced (300ms) to handle rapid file saves.
- **Pipeline Engine** — Executes pipeline steps. Generates context files, spawns agent runner, captures output, evaluates conditions, handles fan-out/fan-in for parallel steps.
- **Agent Runner** — Configurable CLI spawner. Default: `gh copilot`. Supports custom commands via settings. Handles process lifecycle (spawn, monitor, timeout, kill).
- **Scheduler** — `node-cron` managing scheduled pipeline runs. Runs in background even when app is minimized to tray.
- **Notification Service** — Desktop notifications for pipeline events, approval gates, scheduled run results.

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

  // Settings
  settings: {
    get(): Promise<AppSettings>;
    update(settings: Partial<AppSettings>): Promise<void>;
    detectAgentRunner(): Promise<string | null>;
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

**Step Types (6):**

| Type | Icon | Description |
|------|------|-------------|
| **Task** | 🔧 | An agent executes a prompt. Core building block. |
| **Condition** | 🔀 | Evaluates previous step result. Routes to true/false branch. |
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
│   │   ├── squad-service.ts     # Squad SDK + fallback markdown parsing
│   │   ├── file-watcher.ts      # chokidar on .squad/ with debounce
│   │   ├── pipeline-engine.ts   # Step execution, branching, parallel, loops
│   │   ├── agent-runner.ts      # Configurable CLI process spawning
│   │   ├── context-builder.ts   # Generates context files (charter + prompt + prior output)
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
│   │   │   └── settings-store.ts # App settings
│   │   ├── views/
│   │   │   ├── CanvasView.tsx   # Org chart + Quick Run panel
│   │   │   ├── PipelineView.tsx # Pipeline list, builder, execution monitor
│   │   │   ├── ScheduleView.tsx # Schedule manager + run history
│   │   │   ├── DashboardView.tsx # Agent activity + Ralph monitor
│   │   │   ├── DecisionLogView.tsx
│   │   │   └── SettingsView.tsx
│   │   ├── components/
│   │   │   ├── canvas/          # OrgChartNode, AgentInspector, QuickRunPanel
│   │   │   ├── pipeline/        # StepNode, StepPalette, PipelineCanvas, VariableEditor
│   │   │   ├── execution/       # RunMonitor, OutputPanel, ApprovalGateDialog
│   │   │   ├── editor/          # CharterEditor (Monaco wrapper), YamlValidator
│   │   │   ├── dashboard/       # AgentCard, TeamStats, RalphStatus, Sparkline
│   │   │   └── common/          # Button, Modal, Sidebar, Notification badge
│   │   └── styles/
│   │       ├── theme.ts         # Light/dark theme tokens
│   │       └── global.css
│   └── shared/                  # Types shared between main/renderer
│       ├── types.ts             # Core domain types
│       ├── ipc-channels.ts      # IPC channel name constants
│       └── pipeline-schema.ts   # Pipeline JSON schema (Zod)
├── templates/                   # Built-in pipeline templates
│   ├── code-review.json
│   ├── build-and-test.json
│   ├── research-and-write.json
│   └── multi-reviewer.json
├── docs/
│   └── specs/
│       └── 2026-04-13-squad-commander-design.md
└── test/
    ├── main/
    │   ├── pipeline-engine.test.ts   # Core pipeline logic
    │   ├── context-builder.test.ts   # Context file generation
    │   ├── squad-service.test.ts     # SDK + fallback parsing
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
- Squad Service: read `.squad/` files (SDK with gray-matter fallback)
- File watcher (chokidar, debounced) for live sync
- Org chart canvas (React Flow + dagre, horizontal tree layout)
- Agent inspector panel (charter summary, routing, decisions)
- Monaco charter editor with YAML validation + autosave
- Quick Run panel: select agent → type prompt → execute → see output
- Agent Runner module: configurable CLI spawning with process lifecycle management
- Context Builder: generates context file from charter + prompt
- Settings view (project selector, agent runner config, theme)
- **Tests:** squad-service parsing, context-builder, agent-runner process mocking

### Phase 2: Pipeline Builder + Execution
**Goal:** Build and run multi-step agent workflows visually.

- Pipeline builder canvas (vertical flowchart, distinct from org chart)
- Step palette: Task, Condition, Approval Gate, Parallel, Loop, Delay
- Drag-drop step creation and edge connection
- Step configuration panels (prompt, agent, timeout, variables)
- Pipeline variables (template parameters with `{{var}}` syntax)
- Pipeline validation (unreachable nodes, missing connections, etc.)
- Pipeline JSON persistence in `.squad/pipelines/`
- Pipeline Engine: sequential execution, condition evaluation, context handoff
- Parallel step execution (spawn multiple processes, fan-in)
- Loop step execution (repeat with iteration tracking)
- Run directory with context files, stdout logs, output files
- Real-time status updates via IPC
- Output panel with live stdout/stderr
- Pause/resume/cancel controls
- Built-in pipeline templates (4)
- **Tests:** pipeline-engine (all step types, branching, error handling), pipeline validation

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
- Ralph monitor (detect running watch, show status, start/stop)
- Decision log viewer (timeline, search, filters)
- Export/import (`.squad-export.json`)
- Electron packaging (electron-builder, Windows + macOS + Linux)
- Dependabot config for SDK updates
- CI workflow (GitHub Actions: build, test, lint)
- E2E tests with Playwright (open project → view chart → create pipeline → run)
- **Tests:** E2E flows, export/import round-trip

---

## Testing Strategy

| Layer | Tool | What we test | When |
|-------|------|-------------|------|
| Unit | Vitest | Pipeline engine logic, context builder, condition evaluation, SDK parsing, schedule management | Phase 1+ |
| Component | React Testing Library | Step palette interactions, form validation, node rendering, inspector panel | Phase 1+ |
| Integration | Vitest + mock IPC | Main ↔ renderer communication, file watcher events, store updates | Phase 2+ |
| E2E | Playwright (Electron) | Full app flows: open project → view org chart → create pipeline → run pipeline | Phase 4 |

**Test priorities (highest first):**
1. Pipeline engine — most complex logic, all step types, error cases
2. Context builder — correctness of generated context files
3. Condition evaluation — branching logic must be deterministic
4. Squad service — SDK parsing + fallback parsing both work correctly

---

## Implementation Notes

### Security Model
- **No nodeIntegration** in renderer. All Node.js access via contextBridge preload.
- File system access only through IPC handlers in main process.
- Agent runner processes are sandboxed to the project's working directory.

### Process Management
- Agent runner tracks all spawned child processes by PID.
- App exit handler: kill all child processes on quit.
- Process timeout: configurable per step, default 5 minutes.
- Orphan detection: on startup, check for stale PID files from crashed runs.

### Windows-Specific
- chokidar may need `usePolling: true` on some Windows file systems.
- Agent runner uses PowerShell for process spawning.
- File paths use backslashes; normalize in Squad Service.

### macOS-Specific
- App is unsigned for local dev; notarization needed for distribution.
- System tray uses Electron's Tray API (works on all platforms).

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| How complex should condition expressions be? | Start simple: `step.{id}.success` boolean + `step.{id}.output.contains("text")`. Add expression parser in v2 if needed. |
| Support multiple projects simultaneously? | Single project at a time in v1. Project switcher for convenience. |
| How to invoke agent steps? | Generate context files (charter + prompt + prior output), invoke configurable agent runner CLI. Bypass Squad's routing for deterministic execution. |
| How to handle context between steps? | File-based: each run gets a directory, each step writes output to `output-{stepId}.md`, next step reads it. |
| Relationship with Ralph? | Complementary. Commander monitors Ralph status but doesn't replace it. Pipelines are workflow chains; Ralph handles issue triage. |
| One pipeline at a time? | Yes for v1. Queue additional runs; don't allow concurrent pipeline execution. |
