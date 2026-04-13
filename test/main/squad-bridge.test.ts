import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SquadBridge } from '../../src/main/squad-bridge';

describe('SquadBridge', () => {
  let tmpDir: string;
  let bridge: SquadBridge;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squad-test-'));
    const squadDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(squadDir, { recursive: true });
    bridge = new SquadBridge(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects a Squad project', () => {
    expect(bridge.isSquadProject()).toBe(true);
  });

  it('returns false for non-Squad directory', () => {
    const noSquad = fs.mkdtempSync(path.join(os.tmpdir(), 'no-squad-'));
    const b = new SquadBridge(noSquad);
    expect(b.isSquadProject()).toBe(false);
    fs.rmSync(noSquad, { recursive: true, force: true });
  });

  describe('getTeam', () => {
    it('returns empty team when team.md missing', async () => {
      const team = await bridge.getTeam();
      expect(team.name).toBe('');
      expect(team.members).toEqual([]);
    });

    it('parses team.md with frontmatter', async () => {
      const teamMd = [
        '---',
        'name: Test Squad',
        'description: A test team',
        '---',
        '',
        '## Members',
        '- @alice',
        '- @bob',
        '- @charlie',
      ].join('\n');
      fs.writeFileSync(path.join(tmpDir, '.squad', 'team.md'), teamMd);

      const team = await bridge.getTeam();
      expect(team.name).toBe('Test Squad');
      expect(team.description).toBe('A test team');
      expect(team.members).toContain('alice');
      expect(team.members).toContain('bob');
      expect(team.members).toContain('charlie');
    });
  });

  describe('getAgents', () => {
    it('returns empty array when agents dir missing', async () => {
      const agents = await bridge.getAgents();
      expect(agents).toEqual([]);
    });

    it('parses agent charters', async () => {
      const agentDir = path.join(tmpDir, '.squad', 'agents', 'keaton');
      fs.mkdirSync(agentDir, { recursive: true });

      const charter = [
        '---',
        'role: Lead',
        'description: The architect',
        'status: active',
        '---',
        '',
        '# Keaton',
        'Leads the team.',
      ].join('\n');
      fs.writeFileSync(path.join(agentDir, 'charter.md'), charter);

      const agents = await bridge.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('keaton');
      expect(agents[0].role).toBe('Lead');
      expect(agents[0].description).toBe('The architect');
      expect(agents[0].status).toBe('active');
    });

    it('handles multiple agents', async () => {
      for (const name of ['alice', 'bob', 'charlie']) {
        const dir = path.join(tmpDir, '.squad', 'agents', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, 'charter.md'),
          `---\nrole: Agent\n---\n# ${name}\n`
        );
      }

      const agents = await bridge.getAgents();
      expect(agents).toHaveLength(3);
    });
  });

  describe('createAgent', () => {
    it('creates agent directory and charter', async () => {
      fs.mkdirSync(path.join(tmpDir, '.squad', 'agents'), { recursive: true });

      await bridge.createAgent({
        name: 'newagent',
        role: 'Tester',
        description: 'Tests everything',
      });

      const charterPath = path.join(tmpDir, '.squad', 'agents', 'newagent', 'charter.md');
      expect(fs.existsSync(charterPath)).toBe(true);

      const content = fs.readFileSync(charterPath, 'utf-8');
      expect(content).toContain('role: Tester');
      expect(content).toContain('Tests everything');
    });

    it('throws if agent already exists', async () => {
      const dir = path.join(tmpDir, '.squad', 'agents', 'existing');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'charter.md'), '# existing');

      await expect(
        bridge.createAgent({ name: 'existing', role: 'Agent', description: '' })
      ).rejects.toThrow('already exists');
    });
  });

  describe('updateAgent', () => {
    it('writes new charter content', async () => {
      const dir = path.join(tmpDir, '.squad', 'agents', 'test');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'charter.md'), 'old content');

      await bridge.updateAgent('test', 'new content');

      const content = fs.readFileSync(path.join(dir, 'charter.md'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('throws if agent not found', async () => {
      await expect(
        bridge.updateAgent('nonexistent', 'content')
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteAgent', () => {
    it('removes agent directory', async () => {
      const dir = path.join(tmpDir, '.squad', 'agents', 'doomed');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'charter.md'), '# doomed');

      await bridge.deleteAgent('doomed');
      expect(fs.existsSync(dir)).toBe(false);
    });
  });

  describe('getDecisions', () => {
    it('returns empty array when no decisions file', async () => {
      const decisions = await bridge.getDecisions();
      expect(decisions).toEqual([]);
    });

    it('parses decisions from markdown', async () => {
      const decisionsContent = [
        '# Decisions',
        '',
        '## Use TypeScript for everything',
        '2026-04-13 — @keaton decided we use TypeScript.',
        '',
        '## Adopt Vitest',
        '2026-04-14 — @hockney chose Vitest over Jest.',
      ].join('\n');
      fs.writeFileSync(
        path.join(tmpDir, '.squad', 'decisions.md'),
        decisionsContent
      );

      const decisions = await bridge.getDecisions();
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
