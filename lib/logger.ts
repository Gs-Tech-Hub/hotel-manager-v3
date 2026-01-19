import fs from 'fs'
import path from 'path'

const LOG_DIR = path.resolve(process.cwd(), 'logs')
const ERROR_LOG = path.join(LOG_DIR, 'errors.log')

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch (e) {
    // ignore
  }
}

function timestamp() {
  return new Date().toISOString()
}

export function error(message: unknown, meta?: any) {
  try {
    ensureLogDir()
    const entry = {
      ts: timestamp(),
      level: 'error',
      message: typeof message === 'string' ? message : (message && (message as any).message) || String(message),
      meta: meta || null,
    }
    const line = JSON.stringify(entry) + '\n'
    fs.appendFileSync(ERROR_LOG, line, { encoding: 'utf8' })
  } catch (e) {
    // if logging fails, fallback to console
    try {
      // eslint-disable-next-line no-console
      console.error('[logger] failed to write log', e)
    } catch {}
  }
}

export function info(message: string, meta?: any) {
  try {
    ensureLogDir()
    const entry = { ts: timestamp(), level: 'info', message, meta: meta || null }
    fs.appendFileSync(ERROR_LOG, JSON.stringify(entry) + '\n', { encoding: 'utf8' })
  } catch (e) {
    try { console.info('[logger] failed to write log', e) } catch {}
  }
}

export default { error, info }
