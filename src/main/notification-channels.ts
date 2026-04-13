import https from 'https';
import http from 'http';

export interface NotificationChannelConfig {
  id: string;
  type: 'teams' | 'slack' | 'email';
  name: string;
  enabled: boolean;
  // Teams/Slack: webhook URL
  webhookUrl?: string;
  // Email: SMTP config
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  emailTo?: string;
}

export interface ChannelEventRouting {
  event: string;
  channels: string[]; // channel IDs
}

/**
 * Notification Channels — extends desktop notifications with external channels.
 * Supports Teams webhooks, Slack webhooks, and email.
 */
export class NotificationChannels {
  private channels: Map<string, NotificationChannelConfig> = new Map();
  private routing: ChannelEventRouting[] = [];

  /** Add a notification channel */
  addChannel(config: NotificationChannelConfig): void {
    this.channels.set(config.id, config);
  }

  /** Remove a channel */
  removeChannel(id: string): boolean {
    return this.channels.delete(id);
  }

  /** List all channels */
  listChannels(): NotificationChannelConfig[] {
    return Array.from(this.channels.values());
  }

  /** Toggle a channel */
  toggleChannel(id: string, enabled: boolean): void {
    const channel = this.channels.get(id);
    if (channel) channel.enabled = enabled;
  }

  /** Set event routing */
  setRouting(routing: ChannelEventRouting[]): void {
    this.routing = routing;
  }

  /** Get event routing */
  getRouting(): ChannelEventRouting[] {
    return [...this.routing];
  }

  /** Send a notification to all channels configured for this event */
  async notify(event: string, title: string, message: string): Promise<void> {
    const route = this.routing.find((r) => r.event === event);
    const channelIds = route?.channels || [];

    // If no routing configured, send to all enabled channels
    const targets = channelIds.length > 0
      ? channelIds.map((id) => this.channels.get(id)).filter((c): c is NotificationChannelConfig => !!c && c.enabled)
      : Array.from(this.channels.values()).filter((c) => c.enabled);

    const promises = targets.map((channel) => this.sendToChannel(channel, title, message));
    await Promise.allSettled(promises);
  }

  /** Send to a specific channel */
  private async sendToChannel(channel: NotificationChannelConfig, title: string, message: string): Promise<void> {
    switch (channel.type) {
      case 'teams':
        await this.sendTeams(channel.webhookUrl!, title, message);
        break;
      case 'slack':
        await this.sendSlack(channel.webhookUrl!, title, message);
        break;
      case 'email':
        // Email sending would require nodemailer — log for now
        console.log(`[Email] To: ${channel.emailTo} | ${title}: ${message}`);
        break;
    }
  }

  /** Send to Microsoft Teams via webhook */
  private sendTeams(webhookUrl: string, title: string, message: string): Promise<void> {
    const payload = JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: title,
      themeColor: '0076D7',
      title: `⚔️ Squad Commander: ${title}`,
      sections: [{ text: message }],
    });

    return this.postWebhook(webhookUrl, payload);
  }

  /** Send to Slack via webhook */
  private sendSlack(webhookUrl: string, title: string, message: string): Promise<void> {
    const payload = JSON.stringify({
      text: `*⚔️ Squad Commander: ${title}*\n${message}`,
    });

    return this.postWebhook(webhookUrl, payload);
  }

  /** POST to a webhook URL */
  private postWebhook(url: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 10000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook returned status ${res.statusCode}`));
          }
          res.resume(); // Consume response
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook timeout'));
      });
      req.write(payload);
      req.end();
    });
  }
}
