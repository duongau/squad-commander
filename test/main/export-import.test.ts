import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ExportImport } from '../../src/main/export-import';

describe('ExportImport', () => {
  let tmpDir: string;
  let squadDir: string;
  let ei: ExportImport;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
    squadDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(path.join(squadDir, 'agents', 'keaton'), { recursive: true });
    fs.mkdirSync(path.join(squadDir, 'pipelines'), { recursive: true });

    fs.writeFileSync(path.join(squadDir, 'team.md'), '---\nname: Test\n---\n# Team');
    fs.writeFileSync(path.join(squadDir, 'routing.md'), '---\ndefaultAgent: keaton\n---\n');
    fs.writeFileSync(
      path.join(squadDir, 'agents', 'keaton', 'charter.md'),
      '---\nrole: Lead\n---\n# Keaton'
    );
    fs.writeFileSync(
      path.join(squadDir, 'agents', 'keaton', 'history.md'),
      '# History\nLearned stuff.'
    );

    ei = new ExportImport(squadDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exports all squad config', async () => {
    const data = await ei.exportAll();
    expect(data.version).toBe(1);
    expect(data.team).toContain('Test');
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].name).toBe('keaton');
    expect(data.agents[0].charter).toContain('Lead');
    expect(data.agents[0].history).toContain('Learned stuff');
    expect(data.routing).toContain('keaton');
  });

  it('exports to file and imports back', async () => {
    const exportPath = path.join(tmpDir, 'export.json');
    await ei.exportToFile(exportPath);
    expect(fs.existsSync(exportPath)).toBe(true);

    // Import into a fresh directory
    const freshDir = path.join(tmpDir, 'fresh', '.squad');
    fs.mkdirSync(freshDir, { recursive: true });
    const freshEi = new ExportImport(freshDir);

    const counts = await freshEi.importFromFile(exportPath);
    expect(counts.agents).toBe(1);

    // Verify imported files
    const charter = fs.readFileSync(path.join(freshDir, 'agents', 'keaton', 'charter.md'), 'utf-8');
    expect(charter).toContain('Lead');
  });

  it('skips existing agents in skip mode', async () => {
    const exportPath = path.join(tmpDir, 'export.json');
    await ei.exportToFile(exportPath);

    // Import into same directory (skip mode)
    const counts = await ei.importFromFile(exportPath, 'skip');
    expect(counts.agents).toBe(0); // Already exists, skipped
  });

  it('overwrites existing agents in overwrite mode', async () => {
    const exportPath = path.join(tmpDir, 'export.json');
    await ei.exportToFile(exportPath);

    // Modify charter
    fs.writeFileSync(
      path.join(squadDir, 'agents', 'keaton', 'charter.md'),
      'modified'
    );

    // Import with overwrite
    const counts = await ei.importFromFile(exportPath, 'overwrite');
    expect(counts.agents).toBe(1);

    // Verify original content restored
    const charter = fs.readFileSync(
      path.join(squadDir, 'agents', 'keaton', 'charter.md'),
      'utf-8'
    );
    expect(charter).toContain('Lead');
  });

  it('handles empty squad directory', async () => {
    const emptyDir = path.join(tmpDir, 'empty', '.squad');
    fs.mkdirSync(emptyDir, { recursive: true });
    const emptyEi = new ExportImport(emptyDir);

    const data = await emptyEi.exportAll();
    expect(data.agents).toHaveLength(0);
    expect(data.pipelines).toHaveLength(0);
  });

  it('rejects unsupported export version', async () => {
    const badExport = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badExport, JSON.stringify({ version: 99 }));

    await expect(ei.importFromFile(badExport)).rejects.toThrow('Unsupported export version');
  });
});
