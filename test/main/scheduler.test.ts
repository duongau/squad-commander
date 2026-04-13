import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cron from 'node-cron';

// Test cron validation and schedule config serialization
describe('Scheduler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-test-'));
    fs.mkdirSync(path.join(tmpDir, '.squad'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('cron validation', () => {
    it('validates correct cron expressions', () => {
      expect(cron.validate('0 * * * *')).toBe(true);      // every hour
      expect(cron.validate('0 6 * * *')).toBe(true);      // daily 6am
      expect(cron.validate('0 9 * * 1')).toBe(true);      // weekly monday
      expect(cron.validate('*/30 * * * *')).toBe(true);    // every 30 min
      expect(cron.validate('0 0 1 * *')).toBe(true);      // monthly
    });

    it('rejects invalid cron expressions', () => {
      expect(cron.validate('not a cron')).toBe(false);
      expect(cron.validate('')).toBe(false);
      expect(cron.validate('* * *')).toBe(false); // too few fields
    });
  });

  describe('schedules.json persistence', () => {
    it('saves and loads schedule config', () => {
      const filePath = path.join(tmpDir, '.squad', 'schedules.json');
      const config = {
        schedules: [
          {
            id: 'test-sched',
            pipelineId: 'my-pipeline',
            cron: '0 6 * * *',
            enabled: true,
            variables: { target: 'main' },
            lastRun: null,
            lastStatus: null,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.schedules).toHaveLength(1);
      expect(loaded.schedules[0].id).toBe('test-sched');
      expect(loaded.schedules[0].cron).toBe('0 6 * * *');
      expect(loaded.schedules[0].enabled).toBe(true);
    });

    it('handles multiple schedules', () => {
      const filePath = path.join(tmpDir, '.squad', 'schedules.json');
      const config = {
        schedules: [
          {
            id: 'sched-1', pipelineId: 'p1', cron: '0 6 * * *',
            enabled: true, variables: {}, lastRun: null, lastStatus: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'sched-2', pipelineId: 'p2', cron: '0 9 * * 1',
            enabled: false, variables: {}, lastRun: '2026-04-12T06:00:00Z',
            lastStatus: 'success', createdAt: new Date().toISOString(),
          },
        ],
      };

      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.schedules).toHaveLength(2);
      expect(loaded.schedules[1].enabled).toBe(false);
      expect(loaded.schedules[1].lastStatus).toBe('success');
    });

    it('handles empty schedules file', () => {
      const filePath = path.join(tmpDir, '.squad', 'schedules.json');
      fs.writeFileSync(filePath, JSON.stringify({ schedules: [] }), 'utf-8');

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.schedules).toEqual([]);
    });
  });

  describe('schedule config validation', () => {
    it('schedule config has all required fields', () => {
      const config = {
        id: 'test',
        pipelineId: 'my-pipe',
        cron: '0 6 * * *',
        enabled: true,
        variables: {},
        lastRun: null,
        lastStatus: null,
        createdAt: new Date().toISOString(),
      };

      expect(config.id).toBeTruthy();
      expect(config.pipelineId).toBeTruthy();
      expect(cron.validate(config.cron)).toBe(true);
      expect(typeof config.enabled).toBe('boolean');
    });

    it('toggle preserves other fields', () => {
      const config = {
        id: 'test', pipelineId: 'p1', cron: '0 6 * * *',
        enabled: true, variables: { x: '1' }, lastRun: '2026-04-12T00:00:00Z',
        lastStatus: 'success' as const, createdAt: '2026-04-01T00:00:00Z',
      };

      const toggled = { ...config, enabled: false };
      expect(toggled.enabled).toBe(false);
      expect(toggled.pipelineId).toBe('p1');
      expect(toggled.variables.x).toBe('1');
      expect(toggled.lastRun).toBe('2026-04-12T00:00:00Z');
    });
  });
});
