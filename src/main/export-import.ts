import fs from 'fs';
import path from 'path';

export interface ExportData {
  version: 1;
  exportedAt: string;
  team: unknown;
  agents: Array<{ name: string; charter: string; history?: string }>;
  routing: unknown;
  pipelines: unknown[];
  schedules: unknown[];
}

/**
 * Export/Import — packages Squad config into a portable JSON file.
 */
export class ExportImport {
  constructor(private squadDir: string) {}

  /** Export entire Squad config to a JSON object */
  async exportAll(): Promise<ExportData> {
    const data: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      team: null,
      agents: [],
      routing: null,
      pipelines: [],
      schedules: [],
    };

    // Team
    const teamFile = path.join(this.squadDir, 'team.md');
    if (fs.existsSync(teamFile)) {
      data.team = fs.readFileSync(teamFile, 'utf-8');
    }

    // Agents
    const agentsDir = path.join(this.squadDir, 'agents');
    if (fs.existsSync(agentsDir)) {
      const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const charterPath = path.join(agentsDir, entry.name, 'charter.md');
        const historyPath = path.join(agentsDir, entry.name, 'history.md');

        if (fs.existsSync(charterPath)) {
          data.agents.push({
            name: entry.name,
            charter: fs.readFileSync(charterPath, 'utf-8'),
            history: fs.existsSync(historyPath)
              ? fs.readFileSync(historyPath, 'utf-8')
              : undefined,
          });
        }
      }
    }

    // Routing
    const routingFile = path.join(this.squadDir, 'routing.md');
    if (fs.existsSync(routingFile)) {
      data.routing = fs.readFileSync(routingFile, 'utf-8');
    }

    // Pipelines
    const pipelinesDir = path.join(this.squadDir, 'pipelines');
    if (fs.existsSync(pipelinesDir)) {
      const files = fs.readdirSync(pipelinesDir).filter(
        (f) => f.endsWith('.json') && !f.includes('.runs.')
      );
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(pipelinesDir, file), 'utf-8');
          data.pipelines.push(JSON.parse(content));
        } catch { /* skip invalid */ }
      }
    }

    // Schedules
    const schedulesFile = path.join(this.squadDir, 'schedules.json');
    if (fs.existsSync(schedulesFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(schedulesFile, 'utf-8'));
        data.schedules = content.schedules || [];
      } catch { /* skip */ }
    }

    return data;
  }

  /** Export to a file */
  async exportToFile(outputPath: string): Promise<void> {
    const data = await this.exportAll();
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Import from a file, returns count of items imported */
  async importFromFile(
    inputPath: string,
    mode: 'overwrite' | 'skip' = 'skip'
  ): Promise<{ agents: number; pipelines: number; schedules: number }> {
    const content = fs.readFileSync(inputPath, 'utf-8');
    const data: ExportData = JSON.parse(content);

    if (data.version !== 1) {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    const counts = { agents: 0, pipelines: 0, schedules: 0 };

    // Team
    if (data.team && typeof data.team === 'string') {
      const teamFile = path.join(this.squadDir, 'team.md');
      if (mode === 'overwrite' || !fs.existsSync(teamFile)) {
        fs.writeFileSync(teamFile, data.team, 'utf-8');
      }
    }

    // Routing
    if (data.routing && typeof data.routing === 'string') {
      const routingFile = path.join(this.squadDir, 'routing.md');
      if (mode === 'overwrite' || !fs.existsSync(routingFile)) {
        fs.writeFileSync(routingFile, data.routing, 'utf-8');
      }
    }

    // Agents
    for (const agent of data.agents) {
      const agentDir = path.join(this.squadDir, 'agents', agent.name);
      const charterPath = path.join(agentDir, 'charter.md');

      if (mode === 'skip' && fs.existsSync(charterPath)) continue;

      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(charterPath, agent.charter, 'utf-8');
      if (agent.history) {
        fs.writeFileSync(path.join(agentDir, 'history.md'), agent.history, 'utf-8');
      }
      counts.agents++;
    }

    // Pipelines
    const pipelinesDir = path.join(this.squadDir, 'pipelines');
    fs.mkdirSync(pipelinesDir, { recursive: true });
    for (const pipeline of data.pipelines) {
      const p = pipeline as { id: string };
      const filePath = path.join(pipelinesDir, `${p.id}.json`);
      if (mode === 'skip' && fs.existsSync(filePath)) continue;
      fs.writeFileSync(filePath, JSON.stringify(pipeline, null, 2), 'utf-8');
      counts.pipelines++;
    }

    // Schedules
    if (data.schedules.length > 0) {
      const schedulesFile = path.join(this.squadDir, 'schedules.json');
      const existing = fs.existsSync(schedulesFile)
        ? JSON.parse(fs.readFileSync(schedulesFile, 'utf-8'))
        : { schedules: [] };

      if (mode === 'overwrite') {
        existing.schedules = data.schedules;
      } else {
        const existingIds = new Set(existing.schedules.map((s: { id: string }) => s.id));
        for (const sched of data.schedules) {
          if (!existingIds.has((sched as { id: string }).id)) {
            existing.schedules.push(sched);
            counts.schedules++;
          }
        }
      }
      fs.writeFileSync(schedulesFile, JSON.stringify(existing, null, 2), 'utf-8');
    }

    return counts;
  }
}
