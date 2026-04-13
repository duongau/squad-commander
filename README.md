# Squad Commander

**Your AI agent team, visualized and orchestrated.** One app. Full control over your [Squad](https://github.com/bradygaster/squad)-powered teams on GitHub Copilot CLI.

[![Platform](https://img.shields.io/badge/platform-GitHub%20Copilot-blue)](#)
[![Built with](https://img.shields.io/badge/built_with-Electron-47848F?logo=electron)](#tech-stack)
[![Tests](https://img.shields.io/badge/tests-121%20passing-brightgreen)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is Squad Commander?

Squad Commander is a desktop app + CLI that gives you visual control over your Squad AI agent teams. Instead of managing agents through CLI commands and markdown files, you get:

- **🏗️ Drag-and-drop org chart** — see your entire agent hierarchy at a glance
- **🔗 Visual pipeline builder** — chain agent tasks into reusable workflows with 7 step types
- **▶️ One-click execution** — run pipelines and watch agents work in real time
- **📅 Scheduling** — daily, weekly, or custom cron schedules that run while you sleep
- **🖐️ Approval gates** — human-in-the-loop checkpoints for critical steps
- **💰 Cost tracking** — token budgets with 4 enforcement modes
- **📊 Live dashboard** — real-time telemetry, agent activity, Ralph monitor
- **🔗 External integrations** — MCP servers, webhooks, Teams/Slack notifications
- **⌨️ CLI companion** — `commander run/list/status/team/cost/approve/schedule`

**No lock-in.** Commander reads and writes standard `.squad/` files. Your team works identically with or without it.

---

## Quick Start

### Option 1: Desktop App (built)

If you've already built the app, just double-click **Squad Commander** on your Desktop.

### Option 2: Dev Mode (hot reload)

```bash
git clone https://github.com/duongau/squad-commander.git
cd squad-commander
npm install
npm run dev
```

### Option 3: Build the desktop app yourself

```bash
npm run build
npx electron-builder --win --dir
```

The executable is at `release\win-unpacked\Squad Commander.exe`. Create a Desktop shortcut to it.

Then open a Squad project from the app (Settings → Open Project).

### CLI

```bash
# From any Squad project directory
npx squad-commander list          # List pipelines
npx squad-commander team          # Show team roster
npx squad-commander run my-pipe   # Run a pipeline
npx squad-commander status        # Check run status
```

> **📖 Full guide:** [Wiki](https://github.com/duongau/squad-commander/wiki) — start with [[01 Getting started]]

---

## Features

### 🏗️ Visual Org Chart

See your entire Squad hierarchy as a drag-and-drop canvas. Color-coded nodes (Lead = gold, Agent = blue, Scribe = gray). Click any agent to inspect their charter, routing rules, and recent decisions. Double-click to edit in Monaco.

### 🔗 Pipeline Builder

Build multi-step agent workflows visually with 7 step types:

| Step | Description |
|------|-------------|
| 🔧 **Task** | An agent executes a prompt |
| 🔀 **Condition** | Branch on true/false |
| 🧭 **Router** | Multi-way dispatch (pick from N routes) |
| 🖐️ **Approval** | Pause for human review |
| ⚡ **Parallel** | Fan-out / fan-in |
| 🔄 **Loop** | Repeat until condition met |
| ⏱️ **Delay** | Wait before continuing |

Pipelines support `{{variables}}` for reusable templates. 4 built-in templates included.

### 📅 Scheduler

Run pipelines automatically on cron schedules. Presets for hourly, daily, weekly, or custom cron expressions. App stays in system tray when schedules are active.

### 💰 Cost Tracking

Monitor token usage with 4 enforcement modes:

- **Approve to continue** — pauses and asks (default)
- **Notify only** — warns but doesn't pause
- **Auto-cancel** — hard kill at threshold
- **Disabled** — no enforcement

Set budgets per-pipeline, per-step, or as a daily global cap.

### 🔌 External Integrations

- **MCP servers** — connect to external data sources (ADO, Jira, Google Drive)
- **Webhooks** — HTTP endpoint triggers for pipelines from CI/CD or GitHub
- **Notification channels** — Teams, Slack, email alerts for pipeline events

### ⌨️ CLI Companion

Every feature is available from the terminal:

```
commander run <pipeline> [--var key=val]    Run a pipeline
commander list                              List pipelines
commander status                            Show run status
commander team                              Show agent roster
commander cost                              Token usage summary
commander approve <stepId>                  Approve a gate
commander schedule                          List schedules
```

---

## The 5-Layer Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Strategy** | Commander UI + CLI | Visual goal setting, team design, workflow orchestration |
| **Orchestration** | Squad CLI/SDK + Runner Registry | Repo-native execution with extensible engines |
| **Automation** | Ralph-Watch + Scheduler | Background issue triage + scheduled pipeline runs |
| **Memory** | decisions.md + MCP | Persistent source of truth + external data |
| **Guardrails** | CostTracker + HookPipeline | Token budgets, PII scrubbing, governance |

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
| Validation | Zod |
| CLI | yargs |
| Testing | Vitest (121 tests) |
| CI | GitHub Actions + Dependabot |

---

## Project Structure

```
squad-commander/
├── src/
│   ├── main/           # Electron main process (17 modules)
│   ├── renderer/       # React frontend (views, stores, components)
│   ├── cli/            # CLI companion (7 commands)
│   └── shared/         # Types, schemas, IPC channels
├── templates/          # Built-in pipeline templates
├── test/               # 121 tests
└── docs/               # Spec, roadmap, competitors
```

---

## Documentation

- **[📖 Wiki](https://github.com/duongau/squad-commander/wiki)** — complete user guide (start here!)
- **[Design Specification](docs/specs/2026-04-13-squad-commander-design.md)** — full technical design
- **[Roadmap](docs/ROADMAP.md)** — implementation phases + future enhancements
- **[Competitive Analysis](docs/COMPETITORS.md)** — vs CrewAI, PolyPilot, ATM

---

## Development

```bash
npm install         # Install dependencies
npm run dev         # Start Electron + Vite dev server
npm run lint        # TypeScript type check
npm test            # Run 121 tests
npm run build       # Production build
npm run build:cli   # Build CLI only
```

---

## License

[MIT](LICENSE)
