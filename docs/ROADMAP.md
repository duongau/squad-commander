# Squad Commander — Roadmap

> Visual orchestration for Squad-powered projects on GitHub Copilot CLI.
> Standalone app — no dependency on ATM (Claude Agent Team Manager). Copilot CLI + Squad native.

---

## Phase Overview

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6 ──► Phase 7
 Visual      Pipelines   Automation  Intelligence Guardrails  External    CLI +
 Squad       + Execution             + Polish     + Governance Integrations Copilot
 + Quick Run                                                              Skill
```

---

## Phase 1: Visual Squad + Quick Run

**Goal:** See your team, edit charters, run a single agent — immediately useful.

| Component | Description |
|-----------|-------------|
| Electron scaffold | React 19 + Vite + contextBridge security |
| Squad Bridge | Read/write `.squad/` via SDK with gray-matter fallback |
| File Watcher | chokidar on `.squad/` for live sync |
| Org Chart Canvas | React Flow + dagre, horizontal tree, color-coded nodes |
| Agent Inspector | Charter summary, routing rules, recent decisions |
| Charter Editor | Monaco with YAML validation + autosave |
| Quick Run | Select agent → type prompt → execute → see output |
| Runner Registry | Extensible pattern, ships with Copilot CLI runner |
| Context Builder | Charter + prompt + decisions.md content |
| Settings | Project selector, runner config, theme |

**Key architectural decisions made here:**
- Squad Bridge adapter pattern (not raw file I/O)
- Runner Registry extensible from day one
- Context Builder reads `decisions.md` as source of truth
- All future phases build on these foundations

---

## Phase 2: Pipeline Builder + Execution

**Goal:** Build and run multi-step agent workflows visually.

| Component | Description |
|-----------|-------------|
| Pipeline Canvas | Vertical flowchart, distinct from org chart |
| Step Palette | Task, Condition, Approval Gate, Parallel, Loop, Delay |
| Step Config | Agent, prompt with `{{variables}}`, timeout, success criteria |
| Pipeline Variables | Template parameters, prompted at run time |
| Validation | Unreachable nodes, missing connections, invalid refs |
| Pipeline Engine | Sequential execution, condition eval, context handoff |
| Parallel Execution | Fan-out/fan-in with multiple runner processes |
| Loop Execution | Repeat-until with max iterations safety |
| Run Directory | Context files, stdout logs, output files per step |
| Real-time Monitor | Live status per step node + stdout panel |
| Built-in Templates | Code Review, Build & Test, Research & Write, Multi-Reviewer |

**Key architectural decisions:**
- Pipeline Engine reads decisions.md before delegating, writes back after
- Task steps have optional `engine` field (defaults to project runner)
- File-based context handoff: each step writes `output-{id}.md`

---

## Phase 3: Automation

**Goal:** Pipelines run on their own with human checkpoints.

| Component | Description |
|-----------|-------------|
| Approval Gates | Output display, approve/reject buttons, optional timeout |
| Desktop Notifications | Native OS notifications via Electron API |
| System Tray | Badge for pending gates, next scheduled run tooltip |
| Scheduler | node-cron, daily/weekly/hourly/custom cron |
| Schedule Config | Pipeline → frequency → variables → enable/disable |
| Run History | Per-schedule success/failure counts + links to run details |
| Background Mode | Scheduler runs when minimized to tray |

---

## Phase 4: Intelligence + Polish

**Goal:** Understand what your team has been doing. Ship it.

| Component | Description |
|-----------|-------------|
| Activity Dashboard | Per-agent cards with stats, sparklines, success rates |
| Telemetry Aggregator | Live stream from `.squad/log/` and `orchestration-log/` |
| Ralph Monitor | Detect running watch, show status, start/stop from UI |
| Decision Log | Searchable timeline, filter by agent/date, links to runs |
| Export/Import | `.squad-export.json` with merge conflict resolution |
| Packaging | electron-builder for Windows + macOS + Linux |
| CI/CD | GitHub Actions build/test/lint + Dependabot for SDK |
| E2E Tests | Playwright full app flows |

---

## Phase 5: Guardrails + Governance

**Goal:** Safe, cost-aware execution at scale.

| Component | Description |
|-----------|-------------|
| Cost Tracker | Parse token usage from runner stdout, accumulate totals |
| Budget Limits | Token threshold per run → auto-pause (reuses approval gate) |
| Cost Monitor UI | Real-time token/cost display, historical cost per pipeline |
| HookPipeline UI | Configure Squad's PII scrubbing, reviewer lockout, file-write guards |
| Extended Runners | Add custom runners via Settings (runner registry) |

**How Cost Tracker works:**
```
Runner process stdout → Cost Tracker parses token lines
  → Accumulates per-step and per-run totals
  → Estimates cost via configurable model rates
  → If total > budget → emits "budget-exceeded" event
  → Pipeline Engine pauses (same mechanism as approval gates)
  → User approves continue or cancels
```

---

## Phase 6: External Integrations

**Goal:** Commander connects to the outside world.

| Component | Description |
|-----------|-------------|
| MCP Connectors | Access external data (Google Drive, Jira, ADO) from pipeline steps |
| Webhooks | HTTP endpoint to trigger pipelines from external services |
| Notification Channels | Teams, Slack, email (beyond desktop notifications) |
| External Action Items | Monitor Teams/email for action items → route to Squad agents |

---

## Phase 7: CLI + Copilot Skill

**Goal:** Use Commander from the terminal and from within Copilot CLI sessions.

### Architecture: Shared Core

The pipeline engine and supporting modules don't depend on Electron. Extract them into a shared package:

```
@squad-commander/core           ← Shared library (no Electron dependency)
│   pipeline-engine, runner-registry, context-builder,
│   cost-tracker, scheduler, squad-bridge
│
├── squad-commander (Electron)  ← GUI imports core
└── commander-cli               ← CLI imports core
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `commander run <pipeline> [--var key=val]` | Trigger a pipeline by name or ID |
| `commander status` | Show running pipelines and pending approval gates |
| `commander approve <run-id>` | Approve a pending gate from terminal |
| `commander list` | List available pipelines |
| `commander schedule list` | Show scheduled pipelines |
| `commander schedule run <id>` | Manually trigger a scheduled pipeline |
| `commander cost [--period 7d]` | Show token usage and cost summary |
| `commander team` | Show Squad team roster and status |

### Copilot CLI Skill

A skill that lets you trigger Commander pipelines from within a Copilot session:

```
You: "Run the code review pipeline on PR #42"
Copilot: [calls commander run code-review --var pr_url=...] 
         Pipeline started. Keaton is analyzing...
```

### CI/CD Integration

GitHub Actions can trigger Commander pipelines:

```yaml
- name: Run review pipeline
  run: npx commander-cli run code-review --var pr_url=${{ github.event.pull_request.html_url }}
```

---

## Future Enhancements

Features identified from competitive analysis (CrewAI, PolyPilot, ATM) that are worth adding after the core phases.

### High Value

| Feature | Inspired by | Description | Suggested phase |
|---------|-------------|-------------|-----------------|
| **AI-generated teams** | ATM | Describe what you're building → Copilot generates full Squad team (charters, routing, config) | Phase 6+ |
| **Demo mode** | PolyPilot | Try Commander with simulated data, no real Squad project needed. Great for onboarding. | Phase 4 |
| **Agent memory viewer** | CrewAI + Squad | Surface `.squad/agents/{name}/history.md` in the UI alongside charters. Squad already tracks agent learning — we just don't show it. | Phase 4 |
| **Git worktree strategies** | PolyPilot | Pipeline steps that modify code run on isolated branches (shared, isolated, or fully-isolated worktrees). Safety for parallel code changes. | Phase 2 |
| **Multi-model per step** | PolyPilot | Different steps use different models (e.g., Opus for research, Haiku for formatting). Runner flags per step. | Phase 2 |
| **Reflection step** | PolyPilot | Dedicated execute → evaluate → refine UX pattern. Our Loop step covers the logic, but a purpose-built step type would be cleaner. | Phase 2 |

### Medium Value

| Feature | Inspired by | Description |
|---------|-------------|-------------|
| **Watchdog auto-recovery** | PolyPilot | 3-tier recovery for stuck agents: retry → restart → escalate. Beyond simple timeout-kill. |
| **Output validation** | CrewAI | Validate agent output format/quality before passing to next step. Schema or rule-based. |
| **Remote access** | ATM + PolyPilot | Control Commander from phone or another machine (WebSocket bridge or dev tunnels). |
| **Knowledge sources / RAG** | CrewAI | Agents search internal docs during pipeline steps. Phase 6 MCP partially covers this. |
| **Input/output guardrails** | CrewAI | Beyond cost — validate that agent outputs don't contain hallucinations, PII, or off-topic content. |

### Not Pursuing

| Feature | From | Why skip |
|---------|------|----------|
| Consensual process | CrewAI | Agents negotiating is interesting but impractical for our workflow-oriented pipelines |
| Tool marketplace | CrewAI | MCP servers serve this purpose in the Copilot ecosystem |
| Training/fine-tuning | CrewAI | Not applicable to Copilot CLI — model training is outside our scope |
| Slash commands | PolyPilot | We're primarily a GUI app. Phase 7 CLI covers terminal usage. |
| Fiesta Mode (LAN cluster) | PolyPilot | Cool but niche. Revisit if distributed pipelines become a need. |

---

## Architecture Summary

### The 5-Layer Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Strategy** | Commander UI + CLI | Visual goal setting, team design, workflow orchestration |
| **Orchestration** | Squad CLI/SDK + Runner Registry | Repo-native execution with extensible engines |
| **Automation** | Ralph-Watch + Scheduler | Background issue triage + scheduled pipeline runs |
| **Memory** | decisions.md + agent history.md + MCP (Phase 6) | Persistent source of truth + agent learning + external data |
| **Guardrails** | CostTracker + HookPipeline | Token budgets, PII scrubbing, governance |

### Core Modules

| Module | Phase | Package | Description |
|--------|-------|---------|-------------|
| `squad-bridge.ts` | 1 | core | SDK + fallback parsing + CLI command adapter |
| `file-watcher.ts` | 1 | electron | chokidar on `.squad/` + log dirs |
| `runner-registry.ts` | 1 | core | Extensible agent runner management |
| `context-builder.ts` | 1 | core | Context files with decisions.md integration |
| `pipeline-engine.ts` | 2 | core | Step execution, branching, parallel, loops, router |
| `scheduler.ts` | 3 | core | node-cron schedule management |
| `ralph-monitor.ts` | 4 | core | Ralph watch process detection + control |
| `telemetry-aggregator.ts` | 4 | core | Live activity stream from Squad logs |
| `cost-tracker.ts` | 5 | core | Token parsing, budget enforcement |
| `notification.ts` | 1-6 | core + electron | Desktop + external notification dispatch |

> Modules marked `core` are Electron-independent and will be shared with the CLI in Phase 7.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33+ |
| Frontend | React 19 + TypeScript 5.x |
| Bundler | Vite |
| Canvas | @xyflow/react (React Flow v12) + dagre |
| State | Zustand v5 |
| Editor | Monaco Editor |
| Scheduling | node-cron |
| Notifications | Electron Notification API |
| SDK | @bradygaster/squad-sdk (npm, `^` range) |
| Markdown | gray-matter + remark |
| File Watch | chokidar |
| Testing | Vitest + React Testing Library + Playwright |
| CI | GitHub Actions + Dependabot |
| CLI (Phase 7) | commander.js or yargs |

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Standalone from ATM | Different ecosystem (Copilot vs. Claude). Watch ATM for UX ideas only. |
| Runner Registry from Phase 1 | Architecture supports future engines without rewrites |
| decisions.md as source of truth | Pipeline Engine reads before delegation, writes after completion |
| File-based context handoff | Inspectable, debuggable, git-friendly. No summarization needed. |
| Cost tracking as approval gate | Reuses existing pause mechanism. No new UX paradigm needed. |
| Ralph = complementary | Commander monitors Ralph; doesn't replace issue triage |
| Single project at a time | Simplicity. Project switcher for convenience. |
| Core modules Electron-free | Pipeline engine, runners, cost tracker don't depend on Electron — enables CLI + Copilot skill reuse |
| Event-driven triggers skipped | Ralph + Phase 6 webhooks cover this. Adding listeners to pipelines would complicate the run model. |
