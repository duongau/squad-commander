import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Agent, Team, Routing, RoutingRule, Decision } from '../shared/types';

/**
 * Squad Bridge — reads and writes .squad/ files.
 * Uses gray-matter for markdown parsing (SDK integration added when available).
 */
export class SquadBridge {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  get squadDir(): string {
    return path.join(this.projectPath, '.squad');
  }

  /** Check if this project has a .squad/ directory */
  isSquadProject(): boolean {
    return fs.existsSync(this.squadDir);
  }

  /** Read the team roster from team.md */
  async getTeam(): Promise<Team> {
    const teamFile = path.join(this.squadDir, 'team.md');
    if (!fs.existsSync(teamFile)) {
      return { name: '', description: '', projectContext: '', members: [] };
    }

    const content = fs.readFileSync(teamFile, 'utf-8');
    const { data, content: body } = matter(content);

    // Extract member names from the body (look for @mentions or list items)
    const members: string[] = [];
    const memberPattern = /@(\w+)/g;
    let match;
    while ((match = memberPattern.exec(body)) !== null) {
      members.push(match[1]);
    }

    // Also check for list items like "- name" or "* name"
    if (members.length === 0) {
      const listPattern = /^[\s]*[-*]\s+(\w+)/gm;
      while ((match = listPattern.exec(body)) !== null) {
        members.push(match[1]);
      }
    }

    return {
      name: (data.name as string) || '',
      description: (data.description as string) || '',
      projectContext: (data.projectContext as string) || '',
      members: members.length > 0 ? members : (data.members as string[]) || [],
    };
  }

  /** Read all agent charters from agents/ subdirectories */
  async getAgents(): Promise<Agent[]> {
    const agentsDir = path.join(this.squadDir, 'agents');
    if (!fs.existsSync(agentsDir)) return [];

    const agents: Agent[] = [];
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const charterPath = path.join(agentsDir, entry.name, 'charter.md');
      if (!fs.existsSync(charterPath)) continue;

      const content = fs.readFileSync(charterPath, 'utf-8');
      const { data } = matter(content);

      agents.push({
        name: entry.name,
        role: (data.role as string) || 'Agent',
        description: (data.description as string) || '',
        status: (data.status as 'active' | 'inactive') || 'active',
        charterPath,
        charterContent: content,
      });
    }

    return agents;
  }

  /** Read routing rules from routing.md */
  async getRouting(): Promise<Routing> {
    const routingFile = path.join(this.squadDir, 'routing.md');
    if (!fs.existsSync(routingFile)) {
      return { rules: [], defaultAgent: '', fallback: 'coordinator' };
    }

    const content = fs.readFileSync(routingFile, 'utf-8');
    const { data } = matter(content);

    const rules: RoutingRule[] = [];
    if (Array.isArray(data.rules)) {
      for (const rule of data.rules) {
        rules.push({
          pattern: rule.pattern || '',
          agents: Array.isArray(rule.agents) ? rule.agents : [],
          description: rule.description || '',
        });
      }
    }

    return {
      rules,
      defaultAgent: (data.defaultAgent as string) || '',
      fallback: (data.fallback as string) || 'coordinator',
    };
  }

  /** Read decisions from decisions.md */
  async getDecisions(): Promise<Decision[]> {
    const decisionsFile = path.join(this.squadDir, 'decisions.md');
    if (!fs.existsSync(decisionsFile)) return [];

    const content = fs.readFileSync(decisionsFile, 'utf-8');
    return this.parseDecisions(content);
  }

  /** Update an agent's charter */
  async updateAgent(name: string, charterContent: string): Promise<void> {
    const charterPath = path.join(this.squadDir, 'agents', name, 'charter.md');
    if (!fs.existsSync(charterPath)) {
      throw new Error(`Agent "${name}" not found`);
    }
    fs.writeFileSync(charterPath, charterContent, 'utf-8');
  }

  /** Create a new agent with a charter */
  async createAgent(config: { name: string; role: string; description: string }): Promise<void> {
    const agentDir = path.join(this.squadDir, 'agents', config.name);
    if (fs.existsSync(agentDir)) {
      throw new Error(`Agent "${config.name}" already exists`);
    }

    fs.mkdirSync(agentDir, { recursive: true });

    const charter = [
      '---',
      `role: ${config.role}`,
      `description: ${config.description}`,
      'status: active',
      '---',
      '',
      `# ${config.name}`,
      '',
      `**Role:** ${config.role}`,
      '',
      config.description,
      '',
    ].join('\n');

    fs.writeFileSync(path.join(agentDir, 'charter.md'), charter, 'utf-8');

    // Create empty history.md
    fs.writeFileSync(
      path.join(agentDir, 'history.md'),
      `# ${config.name} — History\n\n_No history yet._\n`,
      'utf-8'
    );
  }

  /** Delete an agent */
  async deleteAgent(name: string): Promise<void> {
    const agentDir = path.join(this.squadDir, 'agents', name);
    if (!fs.existsSync(agentDir)) {
      throw new Error(`Agent "${name}" not found`);
    }
    fs.rmSync(agentDir, { recursive: true, force: true });
  }

  /** Read a specific agent's charter content */
  async getCharterContent(name: string): Promise<string> {
    const charterPath = path.join(this.squadDir, 'agents', name, 'charter.md');
    if (!fs.existsSync(charterPath)) {
      throw new Error(`Agent "${name}" not found`);
    }
    return fs.readFileSync(charterPath, 'utf-8');
  }

  /** Read the full decisions.md content (for context builder) */
  async getDecisionsRaw(): Promise<string> {
    const decisionsFile = path.join(this.squadDir, 'decisions.md');
    if (!fs.existsSync(decisionsFile)) return '';
    return fs.readFileSync(decisionsFile, 'utf-8');
  }

  /** Parse decisions.md into structured entries */
  private parseDecisions(content: string): Decision[] {
    const decisions: Decision[] = [];
    // Split on heading patterns like "## " or "### "
    const sections = content.split(/^#{2,3}\s+/m).filter(Boolean);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const summary = lines[0]?.trim() || '';

      // Try to extract date and agent from the section
      const dateMatch = section.match(/\d{4}-\d{2}-\d{2}/);
      const agentMatch = section.match(/@(\w+)/);

      decisions.push({
        date: dateMatch?.[0] || '',
        agent: agentMatch?.[1] || '',
        summary,
        context: lines.slice(1).join('\n').trim(),
        raw: section,
      });
    }

    return decisions;
  }
}
