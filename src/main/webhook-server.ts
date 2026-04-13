import http from 'http';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface WebhookEndpoint {
  id: string;
  path: string;
  pipelineId: string;
  secret: string;
  variables?: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  lastTriggered: string | null;
  triggerCount: number;
}

/**
 * Webhook Server — lightweight HTTP server for external pipeline triggers.
 * Maps webhook URLs to pipeline executions.
 *
 * Events:
 * - webhook:triggered (endpoint, requestBody)
 * - webhook:error (endpoint, error)
 */
export class WebhookServer extends EventEmitter {
  private server: http.Server | null = null;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private port: number;

  constructor(port = 9876) {
    super();
    this.port = port;
  }

  /** Start the webhook server */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve();
        return;
      }

      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          this.port++;
          this.server?.listen(this.port);
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, () => resolve());
    });
  }

  /** Stop the webhook server */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /** Handle incoming webhook request */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const urlPath = req.url || '/';
    const endpoint = Array.from(this.endpoints.values()).find((e) => e.path === urlPath && e.enabled);

    if (!endpoint) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
      return;
    }

    // Verify secret
    const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (authHeader !== endpoint.secret && authHeader !== `Bearer ${endpoint.secret}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Read body (with size limit)
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    let body = '';
    let oversized = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        oversized = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (oversized) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        return;
      }
      endpoint.lastTriggered = new Date().toISOString();
      endpoint.triggerCount++;

      let parsedBody: Record<string, unknown> = {};
      try {
        parsedBody = JSON.parse(body);
      } catch { /* non-JSON body */ }

      this.emit('webhook:triggered', endpoint, parsedBody);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'triggered',
        pipelineId: endpoint.pipelineId,
        triggerCount: endpoint.triggerCount,
      }));
    });
  }

  // ─── Endpoint Management ───────────────────────────────────────────────────

  /** Create a webhook endpoint */
  createEndpoint(pipelineId: string, variables?: Record<string, string>): WebhookEndpoint {
    const id = randomUUID().slice(0, 8);
    const endpoint: WebhookEndpoint = {
      id,
      path: `/webhook/${id}`,
      pipelineId,
      secret: randomUUID(),
      variables,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      triggerCount: 0,
    };

    this.endpoints.set(id, endpoint);
    return endpoint;
  }

  /** Delete a webhook endpoint */
  deleteEndpoint(id: string): boolean {
    return this.endpoints.delete(id);
  }

  /** List all endpoints */
  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /** Toggle endpoint enabled/disabled */
  toggleEndpoint(id: string, enabled: boolean): void {
    const endpoint = this.endpoints.get(id);
    if (endpoint) endpoint.enabled = enabled;
  }

  /** Get the server URL */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /** Get the port */
  getPort(): number {
    return this.port;
  }

  /** Check if server is running */
  isRunning(): boolean {
    return this.server !== null;
  }
}
