# Squad Commander

**Visual orchestration for Squad-powered AI agent teams on GitHub Copilot CLI.**

[![Platform](https://img.shields.io/badge/platform-GitHub%20Copilot-blue)](#)
[![Built with](https://img.shields.io/badge/built_with-Electron-47848F?logo=electron)](#tech-stack)
[![Squad SDK](https://img.shields.io/badge/squad_sdk-compatible-blueviolet)](#)

---

## What is Squad Commander?

Squad Commander is a desktop app that gives you visual control over your [Squad](https://github.com/bradygaster/squad) AI agent teams. Instead of managing agents through CLI commands and markdown files, you get:

- **Drag-and-drop org chart** — see your entire agent hierarchy at a glance
- **Visual pipeline builder** — chain agent tasks into reusable workflows with conditions, loops, and parallel execution
- **One-click execution** — run pipelines and watch agents work in real time
- **Scheduling** — daily, weekly, or custom cron schedules that run while you sleep
- **Approval gates** — human-in-the-loop checkpoints for critical steps
- **Cost tracking** — token budgets with auto-pause when limits are exceeded
- **Live telemetry** — real-time dashboard of agent activity

**No lock-in.** Commander reads and writes standard `.squad/` files. Your team works identically with or without it.

---

## Status

🚧 **In development** — Phase 1 (Visual Squad + Quick Run) is the current focus.

See [ROADMAP.md](docs/ROADMAP.md) for the full 6-phase plan.

---

## The 5-Layer Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Strategy** | Commander UI | Visual goal setting, team design, workflow orchestration |
| **Orchestration** | Squad CLI/SDK + Runner Registry | Repo-native execution with extensible engines |
| **Automation** | Ralph-Watch + Scheduler | Background issue triage + scheduled pipeline runs |
| **Memory** | decisions.md + MCP | Persistent source of truth + external data |
| **Guardrails** | CostTracker + HookPipeline | Token budgets, PII scrubbing, governance |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33+ |
| Frontend | React 19 + TypeScript |
| Canvas | React Flow v12 + dagre |
| State | Zustand v5 |
| Editor | Monaco Editor |
| SDK | @bradygaster/squad-sdk |

---

## Documentation

- [Design Specification](docs/specs/2026-04-13-squad-commander-design.md) — full technical design
- [Roadmap](docs/ROADMAP.md) — 6-phase implementation plan

---

## License

MIT
