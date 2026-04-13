import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { SquadBridge } from './squad-bridge';
import { FileWatcher } from './file-watcher';
import { RunnerRegistry } from './runner-registry';
import { ContextBuilder } from './context-builder';
import { PipelinePersistence } from './pipeline-persistence';
import { PipelineEngine } from './pipeline-engine';
import { NotificationService } from './notification';
import { IPC } from '../shared/ipc-channels';
import { randomUUID } from 'crypto';

let mainWindow: BrowserWindow | null = null;
let squadBridge: SquadBridge | null = null;
let fileWatcher: FileWatcher | null = null;
const runnerRegistry = new RunnerRegistry();
let contextBuilder: ContextBuilder | null = null;
let pipelinePersistence: PipelinePersistence | null = null;
let pipelineEngine: PipelineEngine | null = null;
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
  pipelinePersistence = new PipelinePersistence(squadBridge.squadDir);
  pipelineEngine = new PipelineEngine(
    contextBuilder,
    runnerRegistry,
    pipelinePersistence,
    projectPath
  );

  // Wire pipeline engine events to renderer
  pipelineEngine.on('step:start', (stepId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_STATUS, { type: 'step:start', stepId });
    }
  });
  pipelineEngine.on('step:output', (stepId: string, chunk: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_OUTPUT, { stepId, chunk, timestamp: new Date().toISOString() });
    }
  });
  pipelineEngine.on('step:complete', (stepId: string, result: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_STATUS, { type: 'step:complete', stepId, result });
    }
  });
  pipelineEngine.on('run:complete', (run: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_COMPLETE, run);
    }
  });
  pipelineEngine.on('gate:waiting', (stepId: string, message: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RUN_STATUS, { type: 'gate:waiting', stepId, message });
    }
    notifications.approvalRequired('Pipeline', stepId);
  });

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

// ─── IPC Handlers: Pipelines ─────────────────────────────────────────────────

ipcMain.handle('pipelines:list', async () => {
  if (!pipelinePersistence) return [];
  return pipelinePersistence.list();
});

ipcMain.handle('pipelines:get', async (_event, id: string) => {
  if (!pipelinePersistence) return null;
  return pipelinePersistence.get(id);
});

ipcMain.handle('pipelines:save', async (_event, pipeline: unknown) => {
  if (!pipelinePersistence) throw new Error('No project open');
  return pipelinePersistence.save(pipeline as import('../shared/types').Pipeline);
});

ipcMain.handle('pipelines:delete', async (_event, id: string) => {
  if (!pipelinePersistence) return false;
  return pipelinePersistence.delete(id);
});

ipcMain.handle('pipelines:validate', async (_event, pipeline: unknown) => {
  const { validatePipeline } = await import('../shared/pipeline-schema');
  return validatePipeline(pipeline);
});

ipcMain.handle('pipelines:run', async (_event, id: string, variables?: Record<string, string>) => {
  if (!pipelinePersistence || !pipelineEngine) throw new Error('No project open');
  const pipeline = await pipelinePersistence.get(id);
  if (!pipeline) throw new Error(`Pipeline "${id}" not found`);
  // Run async — don't await (engine emits events)
  pipelineEngine.run(pipeline, variables);
  return { status: 'started', pipelineId: id };
});

ipcMain.handle('pipelines:pause', async () => {
  pipelineEngine?.pause();
});

ipcMain.handle('pipelines:resume', async () => {
  pipelineEngine?.resume();
});

ipcMain.handle('pipelines:cancel', async () => {
  pipelineEngine?.cancel();
});

ipcMain.handle('pipelines:approveGate', async (_event, stepId: string) => {
  pipelineEngine?.approveGate(stepId);
});

ipcMain.handle('pipelines:rejectGate', async (_event, stepId: string) => {
  pipelineEngine?.rejectGate(stepId);
});

ipcMain.handle('pipelines:getRunHistory', async (_event, pipelineId: string) => {
  if (!pipelinePersistence) return [];
  return pipelinePersistence.listRuns(pipelineId);
});

ipcMain.handle('pipelines:getTemplates', async () => {
  if (!pipelinePersistence) return [];
  const templatesDir = path.join(__dirname, '../../templates');
  return pipelinePersistence.getTemplates(templatesDir);
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
