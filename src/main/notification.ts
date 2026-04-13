import { Notification, app } from 'electron';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification Service — desktop notifications via Electron API.
 */
export class NotificationService {
  private enabled: boolean = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Send a desktop notification */
  send(title: string, body: string, level: NotificationLevel = 'info'): void {
    if (!this.enabled || !Notification.isSupported()) return;

    const icon = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    }[level];

    const notification = new Notification({
      title: `${icon} ${title}`,
      body,
      silent: level === 'info',
    });

    notification.show();
  }

  /** Notify that a quick run completed */
  runCompleted(agent: string, success: boolean): void {
    this.send(
      success ? 'Run Completed' : 'Run Failed',
      `${agent} ${success ? 'finished successfully' : 'encountered an error'}`,
      success ? 'success' : 'error'
    );
  }

  /** Notify that an approval gate is waiting */
  approvalRequired(pipelineName: string, gateName: string): void {
    this.send(
      'Approval Required',
      `Pipeline "${pipelineName}" is waiting at gate "${gateName}"`,
      'warning'
    );
  }

  /** Notify that a scheduled run completed */
  scheduleCompleted(pipelineName: string, success: boolean): void {
    this.send(
      success ? 'Scheduled Run Completed' : 'Scheduled Run Failed',
      `Pipeline "${pipelineName}" ${success ? 'completed' : 'failed'}`,
      success ? 'success' : 'error'
    );
  }
}
