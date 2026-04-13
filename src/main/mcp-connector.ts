import fs from 'fs';
import path from 'path';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

export interface McpContext {
  serverName: string;
  capabilities: string[];
  status: 'connected' | 'disconnected' | 'error';
}

/**
 * MCP Connector — discovers and manages MCP server connections.
 * Pipeline steps can declare MCP dependencies to access external data
 * (ADO, Jira, Google Drive, etc.) during execution.
 */
export class McpConnector {
  private servers: Map<string, McpServerConfig> = new Map();
  private configPath: string;

  constructor(squadDir: string) {
    this.configPath = path.join(squadDir, 'commander.json');
    this.loadConfig();
  }

  /** Load MCP config from commander.json */
  private loadConfig(): void {
    if (!fs.existsSync(this.configPath)) return;

    try {
      const content = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      if (content.mcpServers && Array.isArray(content.mcpServers)) {
        for (const server of content.mcpServers) {
          this.servers.set(server.name, server);
        }
      }
    } catch {
      // Invalid config
    }
  }

  /** Save MCP config to commander.json */
  private saveConfig(): void {
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(this.configPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      } catch { /* start fresh */ }
    }

    existing.mcpServers = Array.from(this.servers.values());
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(existing, null, 2), 'utf-8');
  }

  /** List all configured MCP servers */
  list(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  /** Add or update an MCP server config */
  add(config: McpServerConfig): void {
    this.servers.set(config.name, config);
    this.saveConfig();
  }

  /** Remove an MCP server */
  remove(name: string): boolean {
    const deleted = this.servers.delete(name);
    if (deleted) this.saveConfig();
    return deleted;
  }

  /** Toggle server enabled/disabled */
  toggle(name: string, enabled: boolean): void {
    const server = this.servers.get(name);
    if (server) {
      server.enabled = enabled;
      this.saveConfig();
    }
  }

  /** Get enabled servers for inclusion in pipeline context */
  getEnabledServers(): McpServerConfig[] {
    return Array.from(this.servers.values()).filter((s) => s.enabled);
  }

  /** Generate MCP context section for pipeline step context files */
  generateContextSection(): string {
    const enabled = this.getEnabledServers();
    if (enabled.length === 0) return '';

    const lines = ['# Available MCP Servers\n'];
    lines.push('The following MCP servers are available for data access:\n');

    for (const server of enabled) {
      lines.push(`- **${server.name}**: ${server.description || server.command}`);
    }

    lines.push('');
    lines.push('Use these servers to access external data when needed for your task.\n');
    return lines.join('\n');
  }

  /** Discover MCP servers from VS Code or Copilot CLI config */
  async discover(): Promise<McpServerConfig[]> {
    const discovered: McpServerConfig[] = [];

    // Check for VS Code MCP config
    const vscodeConfigPaths = [
      path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json'),
      path.join(process.env.HOME || '', '.vscode', 'settings.json'),
    ];

    for (const configPath of vscodeConfigPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          const mcpServers = content['mcp.servers'] || content['github.copilot.chat.mcpServers'];
          if (mcpServers && typeof mcpServers === 'object') {
            for (const [name, config] of Object.entries(mcpServers)) {
              const c = config as Record<string, unknown>;
              discovered.push({
                name,
                command: (c.command as string) || '',
                args: (c.args as string[]) || [],
                enabled: false,
                description: `Discovered from VS Code config`,
              });
            }
          }
        } catch { /* skip */ }
      }
    }

    return discovered;
  }
}
