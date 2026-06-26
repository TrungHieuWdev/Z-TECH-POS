import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();
const execFileAsync = promisify(execFile);
const port = Number(process.argv[2] || process.env.PORT || 5000);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`[free-port] Port khong hop le: ${process.argv[2] || process.env.PORT}`);
  process.exit(1);
}

async function getWindowsPids() {
  const { stdout } = await execFileAsync('netstat', ['-ano']);
  const pattern = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'gmi');
  const pids = new Set();
  let match;

  while ((match = pattern.exec(stdout)) !== null) {
    pids.add(match[1]);
  }

  return [...pids];
}

async function getUnixPids() {
  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`]);
    return stdout.split(/\s+/).filter(Boolean);
  } catch (error) {
    if (error.code === 1) return [];
    throw error;
  }
}

async function killPid(pid) {
  if (String(pid) === String(process.pid)) return;

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/F']);
    return;
  }

  process.kill(Number(pid), 'SIGTERM');
}

try {
  const pids = process.platform === 'win32'
    ? await getWindowsPids()
    : await getUnixPids();

  if (pids.length === 0) {
    console.log(`[free-port] Port ${port} dang trong.`);
    process.exit(0);
  }

  for (const pid of pids) {
    await killPid(pid);
  }

  console.log(`[free-port] Da giai phong port ${port}: PID ${pids.join(', ')}.`);
} catch (error) {
  console.error(`[free-port] Khong the giai phong port ${port}: ${error.message}`);
  process.exit(1);
}
