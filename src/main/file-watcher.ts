import { watch, type FSWatcher } from 'chokidar';
import { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';

/**
 * File Watcher — watches .squad/ for external changes and notifies the renderer.
 * Debounced to 300ms to handle rapid file saves.
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300;

  constructor(private squadDir: string) {}

  /** Start watching the .squad/ directory */
  start(): void {
    if (this.watcher) return;

    this.watcher = watch(this.squadDir, {
      ignoreInitial: true,
      depth: 5,
      // Windows may need polling on some file systems
      usePolling: process.platform === 'win32',
      interval: 500,
    });

    this.watcher.on('add', (filePath) => this.onFileChange('add', filePath));
    this.watcher.on('change', (filePath) => this.onFileChange('change', filePath));
    this.watcher.on('unlink', (filePath) => this.onFileChange('unlink', filePath));
  }

  /** Stop watching */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Debounced handler — notifies renderer of changes */
  private onFileChange(event: string, filePath: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.notifyRenderer(event, filePath);
    }, this.DEBOUNCE_MS);
  }

  /** Send IPC event to all renderer windows */
  private notifyRenderer(event: string, filePath: string): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SQUAD_CHANGED, { event, filePath });
      }
    }
  }
}
