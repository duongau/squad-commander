import fs from 'fs';
import path from 'path';
import os from 'os';
import { SquadBridge } from './squad-bridge';
import type { ContextSize } from '../shared/runner-types';

/**
 * Context Builder — generates LEAN context files for agent execution.
 *
 * Context size modes (token optimization):
 * - minimal: just the prompt (~0.5k tokens) — for simple tasks
 * - standard: charter + prompt (~2-5k tokens) — default, good balance
 * - full: charter + prompt + decisions + output instructions (~5-15k tokens) — for complex tasks
 *
 * Previously ALL calls used 'full' mode with 50 lines of decisions, even for
 * trivial queries. Combined with the Squad coordinator overhead (~300k tokens),
 * this made simple tasks cost ~350k tokens. Now defaults to 'standard'.
 */
export class ContextBuilder {
  constructor(private bridge: SquadBridge) {}

  /**
   * Build a context file for agent execution.
   * @param contextSize - 'minimal' | 'standard' | 'full' (default: 'standard')
   */
  async build(options: {
    agent: string;
    prompt: string;
    priorOutput?: string;
    contextSize?: ContextSize;
    includeDecisions?: boolean; // deprecated — use contextSize instead
    outputDir?: string;
  }): Promise<string> {
    const {
      agent,
      prompt,
      priorOutput,
      contextSize = options.includeDecisions === false ? 'minimal' : 'standard',
      outputDir,
    } = options;

    const sections: string[] = [];

    // ─── Minimal: just the prompt ──────────────────────────────────────
    if (contextSize === 'minimal') {
      sections.push(prompt);

      if (priorOutput) {
        sections.push('\n# Context from Previous Step\n');
        sections.push(priorOutput.slice(0, 2000)); // Truncate to save tokens
      }

      return this.writeContextFile(agent, sections.join('\n'), outputDir);
    }

    // ─── Standard: charter + prompt (default) ──────────────────────────
    try {
      const charter = await this.bridge.getCharterContent(agent);
      // Only include the YAML frontmatter + first 20 lines of charter body
      // Full charters can be 100+ lines — most of it isn't needed per-task
      const charterLines = charter.split('\n');
      const trimmedCharter = charterLines.slice(0, 30).join('\n');
      sections.push('# Agent\n');
      sections.push(trimmedCharter);
      if (charterLines.length > 30) {
        sections.push('\n_(charter truncated for token efficiency)_');
      }
      sections.push('');
    } catch {
      sections.push(`# Agent: ${agent}\n`);
    }

    sections.push('# Objective\n');
    sections.push(prompt);
    sections.push('');

    // ─── Full: + decisions + prior output + instructions ───────────────
    if (contextSize === 'full') {
      const decisions = await this.bridge.getDecisionsRaw();
      if (decisions) {
        // Include last 20 lines (not 50) to save tokens
        const lines = decisions.split('\n');
        const recentDecisions = lines.slice(-20).join('\n');
        sections.push('# Recent Decisions\n');
        sections.push(recentDecisions);
        sections.push('');
      }

      sections.push('# Instructions\n');
      sections.push('Write results clearly and concisely.');
    }

    // Prior step output (for pipeline chaining) — truncated
    if (priorOutput) {
      sections.push('\n# Previous Step Output\n');
      sections.push(priorOutput.slice(0, 3000)); // Truncate large outputs
    }

    return this.writeContextFile(agent, sections.join('\n'), outputDir);
  }

  /** Write context to a temp file */
  private writeContextFile(agent: string, content: string, outputDir?: string): string {
    const dir = outputDir || path.join(os.tmpdir(), 'squad-commander');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = `context-${agent}-${Date.now()}.md`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /** Estimate context file size in tokens (rough: 1 token ≈ 4 chars) */
  async estimateTokens(options: {
    agent: string;
    prompt: string;
    contextSize?: ContextSize;
  }): Promise<number> {
    const filePath = await this.build({ ...options, outputDir: path.join(os.tmpdir(), 'squad-estimate') });
    const content = fs.readFileSync(filePath, 'utf-8');
    fs.unlinkSync(filePath);
    return Math.ceil(content.length / 4);
  }

  /** Clean up old context files from temp directory */
  async cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const dir = path.join(os.tmpdir(), 'squad-commander');
    if (!fs.existsSync(dir)) return 0;

    let cleaned = 0;
    const now = Date.now();
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const filePath = path.join(dir, entry);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }

    return cleaned;
  }
}
