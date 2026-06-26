import { execSync } from 'child_process'

const PORT = process.env.PORT || 3001

function freePortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf-8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (pid > 0) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
        console.log(`Proceso ${pid} cerrado (puerto ${port})`)
      } catch {
        /* ya no existe */
      }
    }
  } catch {
    /* puerto libre */
  }
}

function freePortUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { shell: true, stdio: 'ignore' })
  } catch {
    /* puerto libre */
  }
}

if (process.platform === 'win32') {
  freePortWindows(PORT)
} else {
  freePortUnix(PORT)
}
