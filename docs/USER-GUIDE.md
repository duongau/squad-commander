# Squad Commander — User Guide

> **This guide has moved to the wiki for easier navigation and updates.**
>
> 👉 **[Read the full User Guide on the Wiki](https://github.com/duongau/squad-commander/wiki)**
>
> Start with [01 — Getting started](https://github.com/duongau/squad-commander/wiki/01-Getting-started).

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) (`gh copilot`)
- A project with [Squad](https://github.com/bradygaster/squad) initialized (`.squad/` directory)

### Installation

```bash
git clone https://github.com/duongau/squad-commander.git
cd squad-commander
npm install
```

### Launch the Desktop App

```bash
npm run dev
```

This opens the Electron app with hot-reload. You'll see the sidebar with 7 views:

| View | Icon | What it does |
|------|------|-------------|
| Team | 🏗️ | Visual org chart of your Squad agents |
| Pipelines | 🔗 | Build and run multi-step agent workflows |
| Schedules | 📅 | Automate pipeline runs on cron schedules |
| Dashboard | 📊 | Agent activity, telemetry, Ralph monitor |
| Costs | 💰 | Token usage tracking and budget enforcement |
| Decisions | 📋 | Searchable team decision log |
| Settings | ⚙️ | Project, runners, hooks, integrations |

### Open Your Project

1. Click **Settings** in the sidebar
2. Click **Open Project**
3. Navigate to your Squad project folder (the one with `.squad/`)
4. The org chart populates automatically

---

## Daily Workflows

### Viewing Your Team

1. Click **Team** in the sidebar
2. Your agents appear as color-coded nodes:
   - 🟡 **Gold** = Lead
   - 🔵 **Blue** = Agent
   - ⚫ **Gray** = Scribe
3. Click any agent → Inspector panel shows charter, role, routing rules
4. Double-click → Opens charter in Monaco editor (autosaves after 800ms)

### Quick Run — Running a Single Agent

1. From the Team view, click **▶ Quick Run**
2. Select an agent from the dropdown
3. Type your objective (e.g., "Analyze the architecture of the auth module")
4. Click **▶ Run**
5. Watch live output stream in the panel below
6. Desktop notification fires when complete

**When to use:** Quick tasks where you want one agent to do something right now.

### Building a Pipeline

1. Click **Pipelines** in the sidebar
2. Click **+ New Pipeline** (or pick a template)
3. The pipeline builder opens with Start and End nodes
4. Click step types in the left palette to add them:
   - **Task** — agent runs a prompt
   - **Condition** — branch based on previous step result
   - **Router** — multi-way dispatch
   - **Approval** — pause for your review
   - **Parallel** — run multiple agents simultaneously
   - **Loop** — repeat until condition met
   - **Delay** — wait before continuing
5. Click each step to configure it (agent, prompt, timeout)
6. Use `{{variables}}` in prompts for reusable pipelines
7. Click **💾 Save**

### Running a Pipeline

1. From the pipeline detail view, click **▶ Run**
2. If the pipeline has variables, you'll be prompted to fill them in
3. Watch live status on the canvas: ⏳ → 🔄 → ✅ / ❌
4. Output streams in the right panel
5. If the pipeline hits an **Approval Gate**, a dialog pops up:
   - Review the previous step's output
   - Click ✅ **Approve** or ❌ **Reject**
6. Pipeline runs to completion (or cancels if rejected)

### Scheduling Pipelines

1. Click **Schedules** in the sidebar
2. Click **+ New Schedule**
3. Select a pipeline from the dropdown
4. Choose a frequency:
   - **Every hour** — `0 * * * *`
   - **Daily at 6am** — `0 6 * * *`
   - **Daily at 9am** — `0 9 * * *`
   - **Weekly Monday 9am** — `0 9 * * 1`
   - **Custom** — enter any cron expression
5. Toggle **Enable immediately**
6. Click **Create Schedule**
7. Minimize the app to the system tray — schedules continue running

**Tip:** The system tray tooltip shows your next scheduled run time.

### Monitoring Costs

1. Click **Costs** in the sidebar
2. Configure your budget:
   - **Enforcement mode** — choose how Commander reacts when budget is exceeded
   - **Pipeline budget** — max tokens per pipeline run
   - **Per-step budget** — max tokens per individual step
   - **Daily cap** — max tokens across all runs per day
3. During a pipeline run, the live gauge shows token consumption
4. Per-step breakdown shows which agents use the most tokens
5. History shows cost trends over time

### Checking Decisions

1. Click **Decisions** in the sidebar
2. Browse the timeline of team decisions from `.squad/decisions.md`
3. Use the search bar for full-text search
4. Filter by agent or date range
5. Click any decision to expand and see full context

### Using the Dashboard

1. Click **Dashboard** in the sidebar
2. Top row: stat cards (total runs, success rate, decisions, agent count)
3. **Ralph Monitor**: see if Squad's watch mode is running, start/stop it
4. **Agent Activity**: cards per agent with run count, success rate, sparklines
5. **Live Log**: real-time stream of agent activity from `.squad/log/`

---

## CLI Usage

Every feature is available from the terminal, useful for scripts, CI/CD, or when you prefer the command line.

### Commands

```bash
# List available pipelines
commander list

# Run a pipeline with variables
commander run code-review --var target=src/auth.ts --var scope=full

# Check pipeline status
commander status

# Show your team
commander team

# Check token costs
commander cost

# Approve a pending gate
commander approve gate-review

# List scheduled pipelines
commander schedule
```

### Using from Any Directory

The CLI automatically walks up from your current directory looking for `.squad/`. Or specify a project:

```bash
commander team --project /path/to/my/project
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run code review pipeline
  run: npx squad-commander run code-review --var target=${{ github.event.pull_request.html_url }}
```

---

## Integrations

### MCP Servers

Connect to external data sources for pipeline steps:

1. Go to **Settings** → **MCP Servers**
2. Click **Auto-Discover** to find MCP servers from VS Code config
3. Or manually add servers (name, command, args)
4. Toggle servers on/off — enabled servers are included in pipeline step context

### Webhooks

Trigger pipelines from external services:

1. Go to **Settings** → **Webhooks**
2. Click **▶ Start Server** to start the webhook listener
3. Create endpoints mapped to specific pipelines
4. Use the generated URL and secret in your external service:
   ```bash
   curl -X POST http://localhost:9876/webhook/{id} \
     -H "X-Webhook-Secret: {secret}" \
     -H "Content-Type: application/json" \
     -d '{"target": "main"}'
   ```

### Notification Channels

Get alerts beyond desktop notifications:

1. Go to **Settings** → **Notification Channels**
2. Add channels (Teams webhook URL, Slack webhook URL, or email SMTP config)
3. Configure per-event routing (e.g., approval gates → Teams, run complete → email)

---

## Settings Reference

| Setting | Where | Description |
|---------|-------|-------------|
| **Open Project** | Settings | Select your Squad project folder |
| **Runner Registry** | Settings | Manage agent execution engines (default: Copilot CLI) |
| **Auto-Detect** | Settings | Scan for available Copilot CLI installations |
| **PII Scrubbing** | Settings | Remove sensitive info from agent output |
| **Reviewer Lockout** | Settings | Prevent same agent from writing + approving code |
| **File-Write Guards** | Settings | Restrict which files agents can modify |
| **Export** | Settings | Package team + pipelines + schedules to JSON |
| **Import** | Settings | Restore from an export file |

---

## File Reference

Squad Commander stores all state in your project's `.squad/` directory:

| File | Created by | Purpose |
|------|-----------|---------|
| `.squad/pipelines/*.json` | Commander | Pipeline definitions |
| `.squad/pipelines/runs/` | Commander | Pipeline execution history |
| `.squad/schedules.json` | Commander | Cron schedule configurations |
| `.squad/commander.json` | Commander | App settings, MCP config |
| `.squad/team.md` | Squad | Team roster (read by Commander) |
| `.squad/routing.md` | Squad | Routing rules (read by Commander) |
| `.squad/agents/*/charter.md` | Squad | Agent charters (read/write by Commander) |
| `.squad/decisions.md` | Squad | Team decisions (read by Commander, included in pipeline context) |
| `.squad/log/` | Squad | Activity logs (read by telemetry aggregator) |

---

## Pipeline Templates

Commander ships with 4 built-in templates:

### Code Review
`Analyze → Review → (pass? → Report Pass : Report Fail)`

### Build & Test
`Build → (Fix → Retest) loop (max 3 iterations)`

### Research & Write
`Research → Outline → Draft → [Approval Gate] → Finalize`

### Multi-Reviewer
`3 parallel reviews (arch + code + tests) → Merge feedback`

Create a pipeline from any template by clicking it in the Pipelines view.

---

## Tips & Tricks

- **Keyboard shortcut**: Press the agent name in Quick Run to jump to that agent on the canvas
- **Autosave**: Charter editor saves after 800ms of idle — no save button needed
- **System tray**: Minimize the app and schedules keep running. The tray icon shows pending gates.
- **Cost tracking as a gate**: Set "approve to continue" mode to get prompted when costs exceed your budget — like an automatic approval gate for spending
- **decisions.md is king**: The pipeline engine reads decisions before every step. Your team's accumulated wisdom is always in context.
- **Export before experiments**: Export your config before trying something risky. Import to roll back.
- **Webhook + CI**: Create a webhook endpoint for your main pipeline, then add it to GitHub Actions for automatic runs on every PR
