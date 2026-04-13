import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';

/**
 * System Tray — shows app icon with context menu.
 * Badge shows pending approval gate count.
 * Tooltip shows next scheduled run.
 */
export class SystemTray {
  private tray: Tray | null = null;
  private pendingGates = 0;
  private nextSchedule: string | null = null;

  /** Create the system tray icon */
  create(): void {
    // Use a simple 16x16 icon (will be replaced with a real icon later)
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Squad Commander');
    this.updateMenu();

    this.tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });
  }

  /** Update the context menu */
  private updateMenu(): void {
    if (!this.tray) return;

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Show Squad Commander',
        click: () => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: 'separator' },
    ];

    if (this.pendingGates > 0) {
      template.push({
        label: `⚠️ ${this.pendingGates} approval gate(s) waiting`,
        enabled: false,
      });
    }

    if (this.nextSchedule) {
      template.push({
        label: `Next run: ${this.nextSchedule}`,
        enabled: false,
      });
    }

    template.push(
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      }
    );

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  /** Update pending gate count */
  setPendingGates(count: number): void {
    this.pendingGates = count;
    this.updateTooltip();
    this.updateMenu();
  }

  /** Update next schedule display */
  setNextSchedule(info: string | null): void {
    this.nextSchedule = info;
    this.updateTooltip();
    this.updateMenu();
  }

  private updateTooltip(): void {
    if (!this.tray) return;
    const parts = ['Squad Commander'];
    if (this.pendingGates > 0) {
      parts.push(`${this.pendingGates} gate(s) waiting`);
    }
    if (this.nextSchedule) {
      parts.push(`Next: ${this.nextSchedule}`);
    }
    this.tray.setToolTip(parts.join(' | '));
  }

  /** Destroy the tray */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
