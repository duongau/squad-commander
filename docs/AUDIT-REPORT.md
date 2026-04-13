# Squad Commander — Comprehensive Audit Report

**Date:** 2026-04-13
**Status:** Action Required
**Sources:** ATM codebase analysis + Squad SDK analysis + user testing feedback

---

## Executive Summary

Squad Commander was built rapidly across 7 phases in a single session. While the backend architecture is sound (121 tests passing), the implementation has three major gaps:

1. **We never read ATM's actual code** — designed from README descriptions, not implementation patterns
2. **We never read Squad's SDK** — rolled our own file parsing instead of using Squad's APIs
3. **No integration testing** — unit tests pass but modules aren't properly wired together

This document captures everything that needs to be fixed, organized by priority.

---

## PART 1: Squad SDK Integration (We Built the Wrong Thing)

### What We Did Wrong

We wrote our own `squad-bridge.ts` that manually parses `.squad/` files with gray-matter. **Squad SDK already has APIs for all of this.**

### What We Should Use Instead

| Our Module | Squad SDK Replacement | Impact |
|-----------|----------------------|--------|
| `squad-bridge.ts` file I/O | `SquadState` + `FSStorageProvider` | Correct parsing, format compatibility |
| Manual charter parsing | `compileCharter()` from SDK | Handles all charter sections properly |
| Manual team.md parsing | `SquadState.team` | Handles markdown tables, not just frontmatter |
| Manual routing parsing | `parseRoutingRules()` from SDK triage | Handles work type + module ownership tables |
| Process spawning | `SquadClient` + `SessionPool` | Proper session lifecycle, concurrent agents |
| Ralph polling | `RalphMonitor` + `EventBus` | Event-driven, not polling |
| Config loading | `loadConfig()` / `resolveSquad()` | Handles dual-root, remote mode |
| Response tier selection | `selectResponseTier()` | Smart model selection per task complexity |

### Specific Changes Needed

```typescript
// BEFORE (our code):
import fs from 'fs';
import matter from 'gray-matter';
const content = fs.readFileSync(charterPath, 'utf-8');
const { data } = matter(content);

// AFTER (using SDK):
import { SquadState, FSStorageProvider } from '@bradygaster/squad-sdk';
const state = await SquadState.create(new FSStorageProvider(), projectPath);
const charter = await state.agents.get('keaton').charter();
```

### Real .squad/ Format (What We Got Wrong)

| File | We Assumed | Actual Format |
|------|-----------|---------------|
| team.md | YAML frontmatter with members array | Markdown TABLES: `\| Name \| Role \| Charter \| Status \|` |
| routing.md | YAML frontmatter with rules | Markdown TABLES: `\| Work Type \| Agent \| Examples \|` + `\| Module \| Primary \| Secondary \|` |
| charter.md | Simple YAML frontmatter + body | Structured sections: Identity, What I Own, Boundaries, How I Work, Model |
| config.json | Doesn't exist in our model | `{ "version": 1, "defaultModel": "claude-sonnet-4.6" }` |

### Agent Spawning (Critical Architecture Change)

```typescript
// BEFORE: spawn CLI process per task
const child = spawn('gh', ['copilot', '-p', contextFile]);

// AFTER: use Squad SDK client with session pooling
import { SquadClientWithPool } from '@bradygaster/squad-sdk';
const client = new SquadClientWithPool({ pool: { maxConcurrent: 5 } });
const session = await client.createSession({ model: 'claude-sonnet-4.6' });
await session.sendMessage({ userMessage: prompt, systemPrompt: charter });
```

**Why this matters:** Session pooling reuses connections, eliminating the ~50k token system prompt overhead on subsequent calls. First call: ~50k. Second+ calls in same session: ~2k (just the new prompt).

---

## PART 2: ATM UI Patterns to Adopt

### Design System

ATM uses **zero CSS frameworks** — all inline styles with CSS variables. Their design tokens:

```css
/* ATM's palette (GitHub-inspired dark theme) */
--bg-primary: #0d1117
--bg-secondary: #151b23
--bg-surface: #1c2333
--accent-blue: #4a9eff     /* Teams/primary */
--accent-green: #3fb950    /* Skills */
--accent-gold: #d29922     /* Human/root */
--accent-orange: #f0883e   /* Agents */
--accent-purple: #8b5cf6   /* Context */
```

### Key Patterns We're Missing

1. **Inline Styles + Hover Mutations** — ATM doesn't use CSS classes for hover states. They use `onMouseEnter/Leave` to mutate `e.currentTarget.style`. More data-driven.

2. **Memoized Components** — Every tree node is wrapped in `React.memo()` to prevent expensive re-renders.

3. **Map<string, Node> for Data** — O(1) lookups instead of array filtering.

4. **useAutosave Hook** — Smart debounce that flushes old node data when switching to a new node. 88 lines of careful lifecycle management.

5. **Toast via useSyncExternalStore** — Module-level store for transient notifications, not Zustand. Keeps max 5 toasts with slide-in/out animations.

6. **Glass-morphism Overlays** — `backdrop-filter: blur(12px)` on search bar and floating panels.

7. **Glow Shadows on Nodes** — `boxShadow: "0 0 12px ${color}"` on hover/selection. Makes the graph feel alive.

8. **Context Menu with Submenu Hover Delay** — 150ms timeout prevents jitter when moving between parent and child menus.

9. **Dynamic Editor Switching** — Inspector panel renders different editors based on `node.kind` (agent → AgentEditor, skill → SkillEditor, etc.)

10. **Org Node Visual Hierarchy** — Badge (kind label), error dot, name (bold, truncated), description (2-line clamp), metadata (child count, skills), hover buttons (add/delete).

### ATM Component Structure

```
components/
  tree/
    OrgNode.tsx          (434 lines — inline styles, memo, glow effects)
    TreeCanvas.tsx        (500 lines — ReactFlow setup, layout, search)
  inspector/
    InspectorPanel.tsx    (500 lines — dynamic editor switching)
    AgentEditor.tsx       (field layouts, autosave)
    SkillEditor.tsx
    GroupEditor.tsx
  common/
    Toolbar.tsx           (115 lines — reusable button styles)
    Toast.tsx             (125 lines — external store, animations)
    ContextMenu.tsx       (197 lines — nested, hover delay)
    SearchBar.tsx          (glass-morphism overlay, centered)
  dialogs/
    DeleteConfirmDialog.tsx (90 lines — overlay + escape + backdrop click)
    CreateDialog.tsx
    DeployDialog.tsx
```

---

## PART 3: Wiring & Integration Bugs (Already Found)

| # | Bug | Status | Fix |
|---|-----|--------|-----|
| 1 | Cost Tracker not wired to Quick Run | ✅ Fixed | startRun/parseOutput/completeRun added |
| 2 | Cost Tracker not wired to Pipeline Engine | ✅ Fixed | runPipelineWithCostTracking() helper |
| 3 | Scheduler runs don't track costs | ✅ Fixed | Uses same helper |
| 4 | Webhook triggers don't track costs | ✅ Fixed | Uses same helper |
| 5 | Missing reparentAgent IPC handler | ✅ Fixed | Handler added |
| 6 | Missing preload channel | ✅ Fixed | cost:step-budget-exceeded added |
| 7 | Team.md parsing wrong priority | ✅ Fixed | Frontmatter first |
| 8 | Webhook no payload size limit | ✅ Fixed | 1MB limit |
| 9 | Runner --agent squad overhead | ✅ Fixed | Removed from default runner |
| 10 | Context builder too verbose | ✅ Fixed | 3 size modes (minimal/standard/full) |

### Still Broken (Found by Audit Agent)

| # | Bug | Severity | Description |
|---|-----|----------|-------------|
| 11 | Concurrent pipeline runs | HIGH | Engine uses single `currentRun` — second run overwrites first |
| 12 | CharterEditor not wired to CanvasView | MEDIUM | Component exists but never imported/rendered |
| 13 | StepConfigPanel never created | MEDIUM | Clicking pipeline steps has no config form |
| 14 | VariableEditor never created | MEDIUM | No UI to add/edit pipeline variables |
| 15 | ApprovalGateDialog not wired to pipeline flow | MEDIUM | Component exists but gate events don't trigger it |
| 16 | Hook config toggles don't persist | LOW | Switches exist but don't save to commander.json |
| 17 | Runner add/edit form missing | LOW | Settings shows list/detect but no add form |
| 18 | MCP/Channel add forms missing | LOW | Discover works but no manual add UI |

---

## PART 4: Token Optimization Status

### Already Done
- Removed `--agent squad` from default runner (~250k saved per call)
- Context builder with 3 size modes (minimal/standard/full)
- Charter truncation (30 lines in standard mode)
- Decisions trimmed to 20 lines (only in full mode)
- Prior output truncated to 3k chars

### Still Needed (from Squad SDK study)

| Optimization | Estimated Savings | How |
|-------------|------------------|-----|
| **Session pooling** via SquadClientWithPool | ~50k per subsequent call | SDK reuses sessions, eliminates system prompt reload |
| **Response tiers** via selectResponseTier() | Variable | SDK picks cheap model for simple tasks, expensive for complex |
| **Pre-run cost estimate dialog** | Prevents surprise costs | Show estimate + confirm before every run |
| **Persistent sessions** | ~50k per call after first | Keep Copilot session alive, send multiple prompts |
| **Local-first for read ops** | 100% for read queries | "What does this agent do?" → read file, no AI call |

---

## PART 5: GitHub Issues Filed

| Issue # | Title | Labels |
|---------|-------|--------|
| [#1](https://github.com/duongau/squad-commander/issues/1) | UI Design Overhaul — match ATM-quality polish | enhancement, design |
| [#2](https://github.com/duongau/squad-commander/issues/2) | Integration and E2E tests — fill the testing gap | testing, bug |
| [#3](https://github.com/duongau/squad-commander/issues/3) | Incomplete UI components — finish the wiring | bug, enhancement |
| [#4](https://github.com/duongau/squad-commander/issues/4) | Token optimization roadmap — further cost reduction | enhancement, optimization |
| [#5](https://github.com/duongau/squad-commander/issues/5) | Error handling and user-facing error states | bug, ux |
| [#6](https://github.com/duongau/squad-commander/issues/6) | Pipeline engine doesn't handle concurrent runs | bug |

### Additional Issues to File

| Title | Priority |
|-------|----------|
| Replace squad-bridge.ts with Squad SDK SquadState API | HIGH |
| Replace process spawning with SquadClientWithPool | HIGH |
| Adopt ATM's inline style + memo pattern for org nodes | MEDIUM |
| Add useAutosave hook (ATM pattern) | MEDIUM |
| Add Toast notification system (ATM pattern) | MEDIUM |
| Add pre-run cost estimate confirmation dialog | MEDIUM |
| Wire CharterEditor into CanvasView (double-click) | MEDIUM |
| Create StepConfigPanel for pipeline builder | MEDIUM |
| Create VariableEditor for pipeline variables | MEDIUM |
| Wire ApprovalGateDialog into pipeline execution flow | MEDIUM |
| Add response tier selection (selectResponseTier) | LOW |
| Add session pooling for agent spawning | LOW |

---

## PART 6: Recommended Next Steps

### Session 2 (Next Priority)
1. Install `@bradygaster/squad-sdk` and replace `squad-bridge.ts` with SDK APIs
2. Replace process spawning with `SquadClientWithPool`
3. Wire CharterEditor, StepConfigPanel, VariableEditor, ApprovalGateDialog
4. Add pre-run cost estimate dialog
5. Fix concurrent pipeline run bug

### Session 3 (UI Overhaul)
1. Study ATM's OrgNode.tsx (434 lines) and adopt their node design
2. Adopt inline style + memo pattern
3. Add Toast system
4. Add useAutosave hook
5. Polish forms, dialogs, context menus

### Session 4 (Testing)
1. Integration tests with mocked process spawning
2. E2E tests with Playwright
3. Test against real Squad projects (Blackbird, etc.)

---

## What Works Today

Despite the gaps, the following is functional:
- ✅ Electron app launches and renders
- ✅ Opens Squad projects and shows org chart
- ✅ Charter viewing in inspector panel
- ✅ Quick Run (executes agents, streams output)
- ✅ Pipeline JSON persistence (create, save, delete)
- ✅ Pipeline builder canvas (add steps, connect edges)
- ✅ Schedule creation and cron management
- ✅ Cost tracking with budget enforcement
- ✅ Dashboard with telemetry
- ✅ Decision log viewer
- ✅ Export/Import
- ✅ CLI companion (7 commands)
- ✅ 121 unit tests passing

The app is a **working prototype** that needs SDK integration, UI polish, and integration testing to become production-ready.
