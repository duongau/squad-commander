import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { SquadBridge } from './squad-bridge';
import { FileWatcher } from './file-watcher';
import { RunnerRegistry } from './runner-registry';
import { ContextBuilder } from './context-builder';
import { NotificationService } from './notification';
import { IPC } from '../shared/ipc-channels';
import { randomUUID } from 'crypto';

let mainWindow: BrowserWindow | null = null;
let squadBridge: SquadBridge | null = null;
let fileWatcher: FileWatcher | null = null;
const runnerRegistry = new RunnerRegistry();
let contextBuilder: ContextBuilder | null = null;
const notifications = new NotificationService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Squad Commander',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** Initialize Squad Bridge for a project path */
function initProject(projectPath: string): void {
  squadBridge = new SquadBridge(projectPath);
  contextBuilder = new ContextBuilder(squadBridge);

  // Stop existing file watcher
  if (fileWatcher) {
    fileWatcher.stop();
  }

  // Start watching if it's a Squad project
  if (squadBridge.isSquadProject()) {
    fileWatcher = new FileWatcher(squadBridge.squadDir);
    fileWatcher.start();
  }
}

// ─── IPC Handlers: Squad State ───────────────────────────────────────────────

ipcMain.handle(IPC.SQUAD_GET_TEAM, async () => {
  if (!squadBridge) return null;
  return squadBridge.getTeam();
});

ipcMain.handle(IPC.SQUAD_GET_AGENTS, async () => {
  if (!squadBridge) return [];
  return squadBridge.getAgents();
});

ipcMain.handle(IPC.SQUAD_GET_ROUTING, async () => {
  if (!squadBridge) return null;
  return squadBridge.getRouting();
});

ipcMain.handle(IPC.SQUAD_GET_DECISIONS, async () => {
  if (!squadBridge) return [];
  return squadBridge.getDecisions();
});

ipcMain.handle(IPC.SQUAD_UPDATE_AGENT, async (_event, name: string, charter: string) => {
  if (!squadBridge) throw new Error('No project open');
  return squadBridge.updateAgent(name, charter);
});

ipcMain.handle(IPC.SQUAD_CREATE_AGENT, async (_event, config: { name: string; role: string; description: string }) => {
  if (!squadBridge) throw new Error('No project open');
  return squadBridge.createAgent(config);
});

ipcMain.handle(IPC.SQUAD_DELETE_AGENT, async (_event, name: string) => {
  if (!squadBridge) throw new Error('No project open');
  return squadBridge.deleteAgent(name);
});

// ─── IPC Handlers: Quick Run ─────────────────────────────────────────────────

ipcMain.handle(IPC.QUICK_RUN_EXECUTE, async (_event, agent: string, prompt: string) => {
  if (!contextBuilder || !squadBridge) throw new Error('No project open');

  const runId = randomUUID();

  // Build context file
  const contextPath = await contextBuilder.build({ agent, prompt });

  // Spawn runner
  const runProcess = runnerRegistry.spawn(runId, agent, contextPath, undefined, squadBridge.squadDir.replace(/[/\\]\.squad$/, ''));

  // Stream stdout to renderer
  runProcess.process.stdout?.on('data', (data: Buffer) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_OUTPUT, {
        runId,
        chunk: data.toString(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Stream stderr to renderer
  runProcess.process.stderr?.on('data', (data: Buffer) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_OUTPUT, {
        runId,
        chunk: data.toString(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle completion
  runProcess.process.on('exit', (code) => {
    const success = code === 0;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_COMPLETE, {
        runId,
        agent,
        success,
        exitCode: code,
      });
    }
    notifications.runCompleted(agent, success);
  });

  return { runId, agent, status: 'running' };
});

ipcMain.handle(IPC.QUICK_RUN_CANCEL, async (_event, runId: string) => {
  return runnerRegistry.cancel(runId);
});

// ─── IPC Handlers: Runners ───────────────────────────────────────────────────

ipcMain.handle(IPC.RUNNERS_LIST, async () => {
  return runnerRegistry.listRunners();
});

ipcMain.handle(IPC.RUNNERS_DETECT, async () => {
  return runnerRegistry.detect();
});

// ─── IPC Handlers: Settings ──────────────────────────────────────────────────

ipcMain.handle(IPC.SETTINGS_GET, async () => {
  // TODO: Read from commander.json
  return {
    projectPath: squadBridge ? path.dirname(squadBridge.squadDir) : null,
    recentProjects: [],
    theme: 'dark',
    defaultRunner: 'copilot-cli',
  };
});

ipcMain.handle(IPC.SETTINGS_UPDATE, async (_event, settings: { projectPath?: string }) => {
  if (settings.projectPath) {
    initProject(settings.projectPath);
  }
});

// ─── IPC Handler: Open Project ───────────────────────────────────────────────

ipcMain.handle('dialog:openProject', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Open Squad Project',
  });
  if (!result.canceled && result.filePaths[0]) {
    initProject(result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  runnerRegistry.killAll();
  fileWatcher?.stop();
});
