import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebhookServer } from '../../src/main/webhook-server';
import { NotificationChannels } from '../../src/main/notification-channels';
import { McpConnector } from '../../src/main/mcp-connector';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('WebhookServer', () => {
  let server: WebhookServer;

  beforeEach(() => {
    server = new WebhookServer(0); // Random port
  });

  afterEach(() => {
    server.stop();
  });

  it('starts not running', () => {
    expect(server.isRunning()).toBe(false);
  });

  it('creates webhook endpoints', () => {
    const endpoint = server.createEndpoint('test-pipeline', { target: 'main' });
    expect(endpoint.id).toBeTruthy();
    expect(endpoint.path).toContain('/webhook/');
    expect(endpoint.pipelineId).toBe('test-pipeline');
    expect(endpoint.secret).toBeTruthy();
    expect(endpoint.enabled).toBe(true);
    expect(endpoint.triggerCount).toBe(0);
  });

  it('lists endpoints', () => {
    server.createEndpoint('pipe-1');
    server.createEndpoint('pipe-2');
    expect(server.listEndpoints()).toHaveLength(2);
  });

  it('deletes endpoints', () => {
    const endpoint = server.createEndpoint('pipe-1');
    expect(server.deleteEndpoint(endpoint.id)).toBe(true);
    expect(server.listEndpoints()).toHaveLength(0);
  });

  it('toggles endpoints', () => {
    const endpoint = server.createEndpoint('pipe-1');
    server.toggleEndpoint(endpoint.id, false);
    expect(server.listEndpoints()[0].enabled).toBe(false);
  });

  it('preserves variables in endpoint', () => {
    const endpoint = server.createEndpoint('pipe-1', { pr_url: 'https://example.com' });
    expect(endpoint.variables?.pr_url).toBe('https://example.com');
  });
});

describe('NotificationChannels', () => {
  let channels: NotificationChannels;

  beforeEach(() => {
    channels = new NotificationChannels();
  });

  it('starts with no channels', () => {
    expect(channels.listChannels()).toHaveLength(0);
  });

  it('adds a Teams channel', () => {
    channels.addChannel({
      id: 'teams-1',
      type: 'teams',
      name: 'Dev Team',
      enabled: true,
      webhookUrl: 'https://outlook.office.com/webhook/test',
    });
    expect(channels.listChannels()).toHaveLength(1);
    expect(channels.listChannels()[0].type).toBe('teams');
  });

  it('adds a Slack channel', () => {
    channels.addChannel({
      id: 'slack-1',
      type: 'slack',
      name: 'Alerts',
      enabled: true,
      webhookUrl: 'https://hooks.slack.com/services/test',
    });
    expect(channels.listChannels()).toHaveLength(1);
  });

  it('removes a channel', () => {
    channels.addChannel({ id: 'ch-1', type: 'teams', name: 'Test', enabled: true });
    expect(channels.removeChannel('ch-1')).toBe(true);
    expect(channels.listChannels()).toHaveLength(0);
  });

  it('toggles a channel', () => {
    channels.addChannel({ id: 'ch-1', type: 'teams', name: 'Test', enabled: true });
    channels.toggleChannel('ch-1', false);
    expect(channels.listChannels()[0].enabled).toBe(false);
  });

  it('sets and gets event routing', () => {
    channels.setRouting([
      { event: 'gate:waiting', channels: ['teams-1'] },
      { event: 'run:complete', channels: ['slack-1'] },
    ]);
    const routing = channels.getRouting();
    expect(routing).toHaveLength(2);
    expect(routing[0].event).toBe('gate:waiting');
  });
});

describe('McpConnector', () => {
  let tmpDir: string;
  let connector: McpConnector;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
    fs.mkdirSync(path.join(tmpDir, '.squad'), { recursive: true });
    connector = new McpConnector(path.join(tmpDir, '.squad'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts with no servers', () => {
    expect(connector.list()).toHaveLength(0);
  });

  it('adds an MCP server', () => {
    connector.add({
      name: 'test-server',
      command: 'node',
      args: ['server.js'],
      enabled: true,
      description: 'Test MCP server',
    });
    expect(connector.list()).toHaveLength(1);
    expect(connector.list()[0].name).toBe('test-server');
  });

  it('persists to commander.json', () => {
    connector.add({
      name: 'persisted',
      command: 'test',
      args: [],
      enabled: true,
    });

    const configPath = path.join(tmpDir, '.squad', 'commander.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(content.mcpServers).toHaveLength(1);
  });

  it('removes a server', () => {
    connector.add({ name: 'temp', command: 'test', args: [], enabled: true });
    expect(connector.remove('temp')).toBe(true);
    expect(connector.list()).toHaveLength(0);
  });

  it('toggles a server', () => {
    connector.add({ name: 'srv', command: 'test', args: [], enabled: true });
    connector.toggle('srv', false);
    expect(connector.list()[0].enabled).toBe(false);
  });

  it('generates context section for enabled servers', () => {
    connector.add({ name: 'ado', command: 'ado-mcp', args: [], enabled: true, description: 'Azure DevOps' });
    connector.add({ name: 'jira', command: 'jira-mcp', args: [], enabled: false });

    const context = connector.generateContextSection();
    expect(context).toContain('ado');
    expect(context).toContain('Azure DevOps');
    expect(context).not.toContain('jira');
  });

  it('returns empty context when no servers enabled', () => {
    expect(connector.generateContextSection()).toBe('');
  });
});
