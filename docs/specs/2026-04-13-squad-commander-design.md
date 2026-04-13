# Squad Commander — Design Specification

**Date:** 2026-04-13
**Status:** Approved
**Author:** duongau + Copilot

---

## Problem Statement

Managing Squad agent teams through CLI commands and markdown files works, but lacks visibility and automation. There's no visual overview of team structure, no way to chain agent tasks into reusable pipelines, and no scheduling without manual cron setup. ATM (Agent Team Manager) solves this for Claude Code agents, but nothing exists for GitHub Copilot's Squad ecosystem.

## Proposed Solution

**Squad Commander** — an Electron desktop app that provides visual orchestration for any Squad-powered project. It reads and writes standard `.squad/` files (no proprietary formats), giving users a drag-and-drop org chart, visual pipeline builder with conditional branching, scheduling, and real-time execution monitoring.

The app is **general-purpose** — it works with any Squad setup regardless of domain. Users can later extend it for specific workflows (e.g., content development, DevOps) as needed.

## Design Principles

1. **No lock-in** — All state lives in `.squad/` files. Squad works identically with or without Commander.
2. **SDK-first** — Uses `@bradygaster/squad-sdk` for all file operations. Stays current via npm caret range + Dependabot.
3. **Live sync** — File watcher on `.squad/` ensures the UI reflects external changes (CLI, VS Code, other editors).
4. **Pipeline as data** — Pipelines are JSON files in `.squad/pipelines/`, version-controlled with your project.

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
| CI | GitHub Actions + Dependabot | Auto-update SDK, build/test on PR |

---

## Architecture

```
┌──────────────────────────────────────────┐
│              Electron Main               │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Squad SDK   │  │  File Watcher   │   │
│  │  Integration │  │  (.squad/ dir)  │   │
│  └──────────────┘  └─────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Pipeline    │  │  Scheduler      │   │
│  │  Engine      │  │  (node-cron)    │   │
│  └──────────────┘  └─────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Process     │  │  Notification   │   │
│  │  Manager     │  │  Service        │   │
│  └──────────────┘  └─────────────────┘   │
├──────────────────────────────────────────┤
│          IPC Bridge (preload.ts)          │
├──────────────────────────────────────────┤
│              React Frontend              │
│                                          │
│  ┌────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Canvas │ │ Pipeline │ │ Schedule  │  │
│  │ (Flow) │ │ Builder  │ │ Manager   │  │
│  └────────┘ └──────────┘ └───────────┘  │
│                                          │
│  ┌────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Editor │ │ Decision │ │ Execution │  │
│  │ Monaco │ │   Log    │ │  Monitor  │  │
│  └────────┘ └──────────┘ └───────────┘  │
│                                          │
│  ┌────────┐ ┌──────────┐ ┌───────────┐  │
│  │Activity│ │ Settings │ │  System   │  │
│  │ Dash   │ │          │ │   Tray    │  │
│  └────────┘ └──────────┘ └───────────┘  │
└──────────────────────────────────────────┘
```

### Electron Main Process

Handles all Node.js/filesystem operations:

- **Squad SDK Integration** — Reads `.squad/` files, parses `squad.config.ts`, writes updates back
- **File Watcher** — `chokidar` watches `.squad/` for external changes, pushes updates to renderer via IPC
- **Pipeline Engine** — Executes pipeline steps sequentially, manages context handoff, evaluates branch conditions
- **Scheduler** — `node-cron` instance managing scheduled pipeline runs
- **Process Manager** — Spawns Copilot CLI processes for agent execution, captures stdout/stderr
- **Notification Service** — Sends desktop notifications for pipeline events

### IPC Bridge

Typed IPC channels via `preload.ts`:

```typescript
interface CommanderAPI {
  // Squad state
  squad: {
    getTeam(): Promise<Team>;
    getAgents(): Promise<Agent[]>;
    getRouting(): Promise<Routing>;
    updateAgent(name: string, charter: string): Promise<void>;
    createAgent(config: AgentConfig): Promise<void>;
    deleteAgent(name: string): Promise<void>;
  };
  // Pipelines
  pipelines: {
    list(): Promise<Pipeline[]>;
    get(id: string): Promise<Pipeline>;
    save(pipeline: Pipeline): Promise<void>;
    delete(id: string): Promise<void>;
    run(id: string): Promise<RunHandle>;
    pause(runId: string): Promise<void>;
    resume(runId: string): Promise<void>;
    cancel(runId: string): Promise<void>;
    approveGate(runId: string, gateId: string): Promise<void>;
    rejectGate(runId: string, gateId: string): Promise<void>;
  };
  // Schedules
  schedules: {
    list(): Promise<Schedule[]>;
    create(config: ScheduleConfig): Promise<void>;
    delete(id: string): Promise<void>;
    getHistory(): Promise<RunHistory[]>;
  };
  // Events
  on(channel: string, callback: (...args: any[]) => void): void;
}
```

### React Frontend

Single-window app with sidebar navigation:

- **Canvas View** — Default view. React Flow org chart.
- **Pipeline View** — Pipeline builder and execution monitor.
- **Schedule View** — Schedule manager with run history.
- **Dashboard View** — Agent activity dashboard.
- **Decision Log View** — Searchable decision timeline.
- **Settings View** — Project selector, SDK version, theme, CLI path.

---

## Features

### 1. Visual Org Chart (Canvas)

**Purpose:** See your entire Squad hierarchy at a glance.

**Behavior:**
- Renders agents from `.squad/team.md` and `.squad/agents/*/charter.md` as React Flow nodes
- Node types with color coding: Lead (gold), Agent (blue), Scribe (gray), Custom roles (configurable)
- Drag-drop to reparent agents (updates `team.md` on drop)
- Right-click context menu: Edit Charter, Duplicate, Delete, Change Role
- Click agent → Inspector panel slides in showing charter summary, routing rules, recent decisions
- Double-click agent → Opens charter in Monaco editor
- File watcher: `.squad/` changes from CLI or other tools auto-update the canvas
- Supports both markdown-first (`.squad/`) and SDK-first (`squad.config.ts`) projects
- Dagre auto-layout with manual position overrides saved to `.squad/commander.json`

### 2. Pipeline Builder

**Purpose:** Visually chain agent tasks into reusable, executable workflows.

**Behavior:**
- Separate canvas using React Flow in flowchart mode (top-to-bottom layout)
- Left panel: palette of available agents and step types (Task, Condition, Approval Gate, Start, End)
- Drag agents/steps from palette → drop on canvas → connect with edges
- Each Task step has: agent name, prompt/objective, timeout (optional), success criteria (optional)
- Condition steps: evaluate previous step output (success/failure, output contains, custom expression)
- Approval Gate steps: pause execution and wait for human approval
- Pipeline metadata: name, description, tags
- Saved as JSON in `.squad/pipelines/{id}.json`
- Validation: checks for unreachable nodes, missing connections, invalid agent references

### 3. Pipeline Execution & Monitoring

**Purpose:** Run pipelines and watch progress in real time.

**Behavior:**
- "Run" button on any pipeline → starts execution in Electron main process
- Each step spawns a Copilot CLI process: `copilot --agent squad -p "{prompt}"`
- Real-time status per step node: ⏳ Pending → 🔄 Running → ✅ Done → ❌ Failed
- Output panel shows live stdout/stderr from the current step
- Context handoff: each step's output is summarized and prepended to the next step's prompt
- Condition evaluation: after a step completes, conditions route to the appropriate next step
- Pause/Resume: freezes execution after current step finishes
- Cancel: kills the current process and marks remaining steps as cancelled
- Run history stored in `.squad/pipelines/{id}.runs.json`

### 4. Human-in-the-Loop Approval Gates

**Purpose:** Insert review checkpoints in pipelines where execution pauses for human approval.

**Behavior:**
- Approval Gate nodes in the pipeline builder
- When execution reaches a gate: pipeline pauses, desktop notification fires
- Gate UI shows: previous step's output, the gate's review prompt, Approve/Reject buttons
- Approve → execution continues to the next step
- Reject → execution stops, pipeline marked as "rejected at gate X"
- Optional: timeout on gates (auto-reject after N hours if no human response)
- Gates are especially useful before steps that create PRs, modify files, or deploy

### 5. Scheduler

**Purpose:** Run pipelines automatically on a schedule.

**Behavior:**
- UI: select a pipeline → choose frequency (hourly, daily, weekly, custom cron)
- Time picker for daily/weekly; cron expression editor for custom
- Schedules managed by `node-cron` in Electron main process
- Persist in `.squad/schedules.json`:
  ```json
  {
    "schedules": [
      {
        "id": "daily-review",
        "pipelineId": "code-review-pipeline",
        "cron": "0 6 * * *",
        "enabled": true,
        "lastRun": "2026-04-12T06:00:00Z",
        "lastStatus": "success"
      }
    ]
  }
  ```
- System tray tooltip shows next scheduled run time
- Run history with success/failure counts and logs
- Enable/disable toggle per schedule without deleting

### 6. Agent Activity Dashboard

**Purpose:** At-a-glance view of team health and activity.

**Behavior:**
- Card grid showing each agent with:
  - Name, role, status indicator (active/idle/error)
  - Last pipeline run timestamp
  - Success/failure rate (from run history)
  - Decision count (from `decisions.md`)
  - Sparkline of recent activity
- Team-level stats: total runs, success rate, most active agent, total decisions
- Filterable by date range and agent
- Data derived from `.squad/decisions.md` and `.squad/pipelines/*.runs.json`

### 7. Agent Charter Editor

**Purpose:** Edit agent charters without leaving the app.

**Behavior:**
- Monaco Editor instance with markdown syntax highlighting
- YAML frontmatter validation (highlights invalid/missing fields)
- Side-by-side rendered preview (react-markdown)
- Autosave after 800ms idle (matches ATM's behavior)
- "New Agent" button → scaffolds charter from Squad's template
- Charter changes written back to `.squad/agents/{name}/charter.md` via SDK

### 8. Decision Log Viewer

**Purpose:** Browse and search the team's decision history.

**Behavior:**
- Reads `.squad/decisions.md` and parses into structured entries
- Timeline view with entries showing: date, agent, decision summary, context
- Search bar: full-text search across all decisions
- Filters: by agent, by date range, by topic/tag
- Click a decision → expands to show full context and reasoning
- Link decisions to related pipeline runs (if available)

### 9. Desktop Notifications

**Purpose:** Know when things happen without watching the app.

**Behavior:**
- Uses Electron's Notification API (native OS notifications)
- Notification triggers:
  - Pipeline step completed (success or failure)
  - Pipeline completed
  - Approval gate waiting for review
  - Scheduled run completed
  - Scheduled run failed
- System tray icon with badge for pending approval gates
- Click notification → brings Commander to foreground, focuses relevant view
- Notification preferences in Settings (toggle per event type)

### 10. Export/Import

**Purpose:** Share and reuse team configurations across projects.

**Behavior:**
- Export: packages team config, agents, routing, pipelines, and schedules into a single `.squad-export.json`
- Import: loads an export file and writes the files into `.squad/`
- Merge mode: when importing into an existing project, prompt for conflict resolution (overwrite/skip/rename)
- Does NOT export decision history or run history (those are project-specific)

### 11. Settings

**Purpose:** Configure the app.

**Behavior:**
- **Project selector** — Open/switch between Squad projects (remembers recent projects)
- **SDK version** — Displays installed `@bradygaster/squad-sdk` version
- **Copilot CLI path** — Configure path to `copilot` binary (auto-detected by default)
- **Theme** — Light/dark toggle
- **Notifications** — Toggle per event type
- **Window** — Remembers size/position across sessions

---

## Data Model

### Files Created by Commander

All new files live inside the existing `.squad/` directory:

| File | Purpose |
|------|---------|
| `.squad/pipelines/{id}.json` | Pipeline definition |
| `.squad/pipelines/{id}.runs.json` | Execution history for a pipeline |
| `.squad/schedules.json` | Schedule configurations |
| `.squad/commander.json` | App settings (window state, theme, node positions) |

### Pipeline Definition Schema

```json
{
  "id": "string — kebab-case identifier",
  "name": "string — display name",
  "description": "string — what this pipeline does",
  "version": 1,
  "steps": [
    {
      "id": "string — step identifier",
      "type": "task | condition | approval | start | end",
      "agent": "string — agent name (task type only)",
      "prompt": "string — objective/instruction (task type only)",
      "timeout": "number — seconds (optional)",
      "successCriteria": "string — how to determine success (optional)",
      "message": "string — review prompt (approval type only)",
      "eval": "string — condition expression (condition type only)",
      "trueTarget": "string — step id if true (condition type only)",
      "falseTarget": "string — step id if false (condition type only)"
    }
  ],
  "edges": [
    { "source": "string — step id", "target": "string — step id" }
  ],
  "metadata": {
    "created": "ISO 8601",
    "modified": "ISO 8601",
    "tags": ["string"]
  }
}
```

### Pipeline Run Record Schema

```json
{
  "runId": "string — UUID",
  "pipelineId": "string",
  "startedAt": "ISO 8601",
  "completedAt": "ISO 8601 | null",
  "status": "running | paused | completed | failed | cancelled | rejected",
  "triggeredBy": "manual | schedule",
  "steps": [
    {
      "stepId": "string",
      "status": "pending | running | completed | failed | skipped | cancelled",
      "startedAt": "ISO 8601 | null",
      "completedAt": "ISO 8601 | null",
      "output": "string — captured stdout (truncated)",
      "error": "string | null"
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
│   ├── dependabot.yml
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point
│   │   ├── preload.ts           # IPC bridge
│   │   ├── squad-service.ts     # Squad SDK integration
│   │   ├── file-watcher.ts      # .squad/ file watching
│   │   ├── pipeline-engine.ts   # Pipeline execution
│   │   ├── scheduler.ts         # node-cron scheduling
│   │   ├── process-manager.ts   # Copilot CLI process spawning
│   │   └── notification.ts      # Desktop notifications
│   ├── renderer/                # React frontend
│   │   ├── App.tsx
│   │   ├── main.tsx             # React entry
│   │   ├── stores/              # Zustand stores
│   │   │   ├── squad-store.ts
│   │   │   ├── pipeline-store.ts
│   │   │   └── schedule-store.ts
│   │   ├── views/
│   │   │   ├── CanvasView.tsx
│   │   │   ├── PipelineView.tsx
│   │   │   ├── ScheduleView.tsx
│   │   │   ├── DashboardView.tsx
│   │   │   ├── DecisionLogView.tsx
│   │   │   └── SettingsView.tsx
│   │   ├── components/
│   │   │   ├── canvas/          # Org chart nodes, edges
│   │   │   ├── pipeline/        # Pipeline builder components
│   │   │   ├── editor/          # Monaco wrapper
│   │   │   └── common/          # Shared UI components
│   │   └── styles/
│   └── shared/                  # Types shared between main/renderer
│       └── types.ts
├── docs/
│   └── specs/
│       └── 2026-04-13-squad-commander-design.md
└── test/
    ├── main/
    └── renderer/
```

---

## Implementation Phases

### Phase 1: Foundation
- Electron + React + Vite scaffolding
- Squad SDK integration (read `.squad/` files)
- IPC bridge with typed channels
- Org chart canvas (React Flow + dagre)
- Agent inspector panel
- File watcher for live sync

### Phase 2: Editing
- Monaco charter editor with autosave
- YAML frontmatter validation
- New agent creation
- Agent drag-drop reparenting (writes back to team.md)

### Phase 3: Pipelines
- Pipeline builder canvas (palette, drag-drop, connections)
- Pipeline JSON persistence
- Pipeline validation

### Phase 4: Execution
- Pipeline engine in main process
- Copilot CLI process spawning
- Real-time status updates via IPC
- Context handoff between steps
- Conditional branching evaluation

### Phase 5: Approval & Scheduling
- Approval gate UI and pause/resume
- node-cron scheduler
- Schedule UI and persistence
- Desktop notifications

### Phase 6: Dashboard & Polish
- Agent activity dashboard
- Decision log viewer
- Export/import
- Settings
- System tray
- Packaging (electron-builder)

---

## Open Questions

1. **Condition expressions** — How complex should pipeline conditions be? Start with simple `step.{id}.success` boolean checks, or support arbitrary expressions?
   - **Decision:** Start simple (success/failure boolean). Add expression support in v2 if needed.

2. **Multi-project** — Should Commander support multiple Squad projects open simultaneously?
   - **Decision:** Single project at a time in v1. Project switcher for convenience.

3. **Copilot CLI invocation** — How exactly should we invoke agent steps? `copilot --agent squad` with a prompt file, or through Squad's SDK programmatically?
   - **Decision:** Use Copilot CLI via process spawn for v1 (simpler, works with any Squad version). Consider SDK-level integration in v2.
