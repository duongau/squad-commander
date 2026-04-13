import fs from 'fs';
import path from 'path';
import os from 'os';
import { SquadBridge } from './squad-bridge';

/**
 * Context Builder — generates context files for agent execution.
 * Combines: agent charter + prompt + relevant decisions from decisions.md + prior step output.
 * Returns the path to the generated context file.
 */
export class ContextBuilder {
  constructor(private bridge: SquadBridge) {}

  /**
   * Build a context file for a single agent execution (Quick Run or pipeline step).
   * Returns the path to the temporary context file.
   */
  async build(options: {
    agent: string;
    prompt: string;
    priorOutput?: string;
    includeDecisions?: boolean;
    outputDir?: string;
  }): Promise<string> {
    const { agent, prompt, priorOutput, includeDecisions = true, outputDir } = options;

    const sections: string[] = [];

    // Section 1: Agent charter
    try {
      const charter = await this.bridge.getCharterContent(agent);
      sections.push('# Agent Charter\n');
      sections.push(charter);
      sections.push('');
    } catch {
      sections.push(`# Agent: ${agent}\n`);
      sections.push(`_No charter found for "${agent}"._\n`);
    }

    // Section 2: Objective
    sections.push('# Objective\n');
    sections.push(prompt);
    sections.push('');

    // Section 3: Recent decisions (source of truth)
    if (includeDecisions) {
      const decisions = await this.bridge.getDecisionsRaw();
      if (decisions) {
        // Include last ~50 lines of decisions to stay within context limits
        const lines = decisions.split('\n');
        const recentDecisions = lines.slice(-50).join('\n');
        sections.push('# Recent Team Decisions\n');
        sections.push(recentDecisions);
        sections.push('');
      }
    }

    // Section 4: Prior step output (for pipeline chaining)
    if (priorOutput) {
      sections.push('# Context from Previous Step\n');
      sections.push(priorOutput);
      sections.push('');
    }

    // Section 5: Output instructions
    sections.push('# Output Instructions\n');
    sections.push(
      'Write your results clearly. If this is part of a pipeline, ' +
        'your output will be passed as context to the next step.'
    );

    const content = sections.join('\n');

    // Write to temp file or specified output directory
    const dir = outputDir || path.join(os.tmpdir(), 'squad-commander');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = `context-${agent}-${Date.now()}.md`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');

    return filePath;
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
