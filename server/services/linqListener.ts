import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getLinqApiToken, setLinqWebhookSecret } from './linq';

export interface LinqListenerStatus {
  running: boolean;
  pid?: number;
  forwardUrl?: string;
  startedAt?: string;
  linqPath?: string;
  autoListen: boolean;
  lastError?: string;
}

let listenerProcess: ChildProcess | null = null;
let currentForwardUrl: string | null = null;
let startedAtDate: Date | null = null;
let resolvedLinqPath: string | null = null;
let lastListenerError: string | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Searches common locations and system PATH for the `linq` CLI executable.
 */
export function findLinqExecutable(): string | null {
  if (process.env.LINQ_CLI_PATH && fs.existsSync(process.env.LINQ_CLI_PATH)) {
    return process.env.LINQ_CLI_PATH;
  }

  const homedir = os.homedir();
  const candidates: string[] = [];

  // Check PATH environment variable directories
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    candidates.push(path.join(dir, 'linq'));
    candidates.push(path.join(dir, 'linq.exe'));
    candidates.push(path.join(dir, 'linq.cmd'));
  }

  // Check NVM node versions
  const nvmVersionsDir = path.join(homedir, '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmVersionsDir)) {
    try {
      const versions = fs.readdirSync(nvmVersionsDir);
      for (const ver of versions.reverse()) {
        candidates.push(path.join(nvmVersionsDir, ver, 'bin', 'linq'));
      }
    } catch {
      // Ignore directory read errors
    }
  }

  // Common macOS / Linux installation paths
  candidates.push('/opt/homebrew/bin/linq');
  candidates.push('/usr/local/bin/linq');
  candidates.push(path.join(homedir, '.npm-global', 'bin', 'linq'));
  candidates.push(path.join(homedir, '.yarn', 'bin', 'linq'));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          return candidate;
        }
      }
    } catch {
      // Continue checking
    }
  }

  return null;
}

/**
 * Returns current status of the background Linq webhook listener.
 */
export function getLinqListenerStatus(): LinqListenerStatus {
  const isEnabled = process.env.LINQ_AUTO_LISTEN !== 'false' &&
    process.env.APP_MODE !== 'test' &&
    process.env.NODE_ENV !== 'test';

  return {
    running: Boolean(listenerProcess && !listenerProcess.killed),
    pid: listenerProcess?.pid,
    forwardUrl: currentForwardUrl || undefined,
    startedAt: startedAtDate ? startedAtDate.toISOString() : undefined,
    linqPath: resolvedLinqPath || undefined,
    autoListen: isEnabled,
    lastError: lastListenerError || undefined,
  };
}

/**
 * Starts the Linq webhook listener child process.
 */
export function startLinqWebhookListener(options?: {
  port?: number;
  forwardUrl?: string;
  force?: boolean;
}): boolean {
  if (isShuttingDown) {
    return false;
  }

  // Guard against running in automated test mode unless explicitly forced
  if (!options?.force) {
    if (
      process.env.LINQ_AUTO_LISTEN === 'false' ||
      process.env.APP_MODE === 'test' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }
  }

  if (listenerProcess && !listenerProcess.killed) {
    return true;
  }

  const port = options?.port || Number(process.env.PORT) || 3001;
  const forwardUrl = options?.forwardUrl ||
    process.env.LINQ_FORWARD_URL ||
    `http://localhost:${port}/api/webhooks/linq`;

  const linqPath = findLinqExecutable();
  if (!linqPath) {
    lastListenerError = 'Linq CLI executable not found in PATH or standard directories';
    console.warn(`[linq] ${lastListenerError}. Run "npm install -g @linqapp/cli" to enable auto-listening.`);
    return false;
  }

  resolvedLinqPath = linqPath;
  currentForwardUrl = forwardUrl;
  lastListenerError = null;

  try {
    const apiToken = getLinqApiToken();
    const args = ['webhooks', 'listen', '--forward-to', forwardUrl];
    if (apiToken) {
      args.push('--token', apiToken);
    }

    const env = { ...process.env };
    // Ensure PATH contains the directory of the linq executable and node binaries
    const linqDir = path.dirname(linqPath);
    if (!env.PATH?.includes(linqDir)) {
      env.PATH = `${linqDir}${path.delimiter}${env.PATH || ''}`;
    }

    const child = spawn(linqPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    listenerProcess = child;
    startedAtDate = new Date();

    console.log(`[linq] Started webhook listener (PID: ${child.pid}) forwarding to ${forwardUrl}`);

    child.stdout.on('data', (data: Buffer | string) => {
      const text = data.toString();
      
      // Capture session signing secret if outputted by the CLI
      const secretMatch = text.match(/Signing secret:\s*([^\s]+)/i);
      if (secretMatch && secretMatch[1]) {
        const secret = secretMatch[1].trim();
        setLinqWebhookSecret(secret);
        console.log(`[linq] Registered active session webhook signing secret`);
      }

      if (text.includes('Connected to relay') || text.includes('Listening for events')) {
        console.log(`[linq] Relay connected and listening for live iMessage / SMS events`);
      }
    });

    child.stderr.on('data', (data: Buffer | string) => {
      const text = data.toString().trim();
      if (text) {
        console.warn(`[linq] listener stderr: ${text}`);
      }
    });

    child.on('error', (err: Error) => {
      lastListenerError = err.message;
      console.error(`[linq] Webhook listener process error:`, err);
    });

    child.on('exit', (code, signal) => {
      listenerProcess = null;
      if (!isShuttingDown) {
        console.warn(`[linq] Webhook listener exited with code ${code} / signal ${signal}`);
        // Attempt automatic reconnection after 5 seconds if not deliberately shut down
        if (!restartTimer) {
          restartTimer = setTimeout(() => {
            restartTimer = null;
            if (!isShuttingDown) {
              console.log('[linq] Attempting to restart Linq webhook listener...');
              startLinqWebhookListener(options);
            }
          }, 5000);
          restartTimer.unref();
        }
      }
    });

    return true;
  } catch (error) {
    lastListenerError = error instanceof Error ? error.message : String(error);
    console.error(`[linq] Failed to spawn Linq webhook listener:`, error);
    return false;
  }
}

/**
 * Stops the Linq webhook listener child process cleanly.
 */
export function stopLinqWebhookListener(): void {
  isShuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (listenerProcess) {
    const proc = listenerProcess;
    listenerProcess = null;
    try {
      proc.kill('SIGINT');
      // Fallback force-kill if still alive after 2 seconds
      setTimeout(() => {
        try {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        } catch {
          // Process already ended
        }
      }, 2000).unref();
    } catch {
      // Process already terminated
    }
  }
}

// Clean up child process on process termination
process.once('exit', () => {
  stopLinqWebhookListener();
});
