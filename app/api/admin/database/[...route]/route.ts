/**
 * Backup Management API Endpoints for Hotel Manager v3
 * 
 * Endpoints:
 * - POST /api/admin/database/backup - Create a backup
 * - GET /api/admin/database/backups - List backups
 * - POST /api/admin/database/restore - Restore from backup
 * - GET /api/admin/database/schedule - Get backup schedule
 * - PUT /api/admin/database/schedule - Update backup schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { extractUserContext, loadUserWithRoles, isAdmin } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const SCHEDULE_FILE = path.join(BACKUP_DIR, '.backup-schedule.json');

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// Parse database URL
function parseDatabaseUrl(url: string) {
  const cleanUrl = url.replace('prisma+', '').replace(/\?.*$/, '');
  const regex =
    /postgres(?:ql)?:\/\/(?:([^:]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?\/(.+)/;
  const match = cleanUrl.match(regex);

  if (!match) throw new Error('Invalid DATABASE_URL format');

  return {
    user: match[1] || 'postgres',
    password: match[2],
    host: match[3],
    port: match[4] || '5432',
    database: match[5]
  };
}

// Get list of backups
function listBackups() {
  ensureBackupDir();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.sql.gz'))
    .sort()
    .reverse();

  return files.map((file) => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      size: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      created: stats.mtime.toISOString(),
      path: `backups/${file}`
    };
  });
}

// Create backup
function createBackup(dbUrl: string, name?: string) {
  ensureBackupDir();

  const parsed = parseDatabaseUrl(dbUrl);
  const timestamp = new Date().toISOString().split('T')[0];
  const backupName = name ? `${name}-${timestamp}.sql.gz` : `hotel-manager-dump-${timestamp}.sql.gz`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    const isWindows = os.platform() === 'win32';
    const env = { ...process.env };
    if (parsed.password) {
      env.PGPASSWORD = parsed.password;
    }

    let command: string;
    if (isWindows) {
      // Windows: use powershell with pipe syntax
      command = `pg_dump -U ${parsed.user} -h ${parsed.host} -p ${parsed.port} ${parsed.database} | gzip > "${backupPath}"`;
    } else {
      // Unix/Linux/Mac: use bash
      command = `pg_dump -U ${parsed.user} -h ${parsed.host} -p ${parsed.port} ${parsed.database} | gzip > "${backupPath}"`;
    }

    execSync(command, {
      stdio: 'pipe',
      env: env,
      shell: isWindows ? 'powershell.exe' : '/bin/bash'
    });

    const stats = fs.statSync(backupPath);
    return {
      success: true,
      name: backupName,
      size: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      created: new Date().toISOString(),
      path: `backups/${backupName}`
    };
  } catch (error) {
    throw new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Restore from backup
function restoreBackup(dbUrl: string, backupFileName: string) {
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupFileName}`);
  }

  const parsed = parseDatabaseUrl(dbUrl);
  const isWindows = os.platform() === 'win32';
  const env = { ...process.env };
  if (parsed.password) {
    env.PGPASSWORD = parsed.password;
  }

  try {
    let command: string;
    if (backupFileName.endsWith('.gz')) {
      if (isWindows) {
        // Windows: use powershell
        command = `gunzip -c "${backupPath}" | psql -U ${parsed.user} -h ${parsed.host} -p ${parsed.port} -d ${parsed.database}`;
      } else {
        // Unix/Linux/Mac: use bash
        command = `gunzip -c "${backupPath}" | psql -U ${parsed.user} -h ${parsed.host} -p ${parsed.port} -d ${parsed.database}`;
      }
    } else {
      command = `psql -U ${parsed.user} -h ${parsed.host} -p ${parsed.port} -d ${parsed.database} < "${backupPath}"`;
    }

    execSync(command, {
      stdio: 'pipe',
      env: env,
      shell: isWindows ? 'powershell.exe' : '/bin/bash'
    });

    return {
      success: true,
      message: `Restored from ${backupFileName}`,
      restored: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get backup schedule
function getSchedule() {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    const defaultSchedule = {
      enabled: false,
      frequency: 'daily', // daily, weekly
      time: '02:00', // 2 AM
      daysOfWeek: ['monday'], // for weekly
      retention: 30 // days
    };
    return defaultSchedule;
  }

  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  } catch {
    return {
      enabled: false,
      frequency: 'daily',
      time: '02:00',
      daysOfWeek: ['monday'],
      retention: 30
    };
  }
}

// Save backup schedule
function saveSchedule(schedule: any) {
  ensureBackupDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
  return schedule;
}

// Route handlers
export async function POST(request: NextRequest, { params }: any) {
  const ctx = await extractUserContext(request);

  if (!ctx.userId) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
      { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
    );
  }

  // Load full user with roles to check admin status
  const user = await loadUserWithRoles(ctx.userId);
  if (!user || !isAdmin(user)) {
    return NextResponse.json(
      errorResponse(ErrorCodes.FORBIDDEN, 'Admin access required'),
      { status: getStatusCode(ErrorCodes.FORBIDDEN) }
    );
  }

  const action = params.route?.[0]; // route is the first param after "database"

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INTERNAL_ERROR, 'DATABASE_URL not configured'),
        { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
      );
    }

    if (action === 'backup') {
      const body = await request.json().catch(() => ({}));
      const backup = createBackup(dbUrl, body.name);
      return NextResponse.json(successResponse({ data: { backup } }), { status: 200 });
    }

    if (action === 'restore') {
      const body = await request.json();
      if (!body.backupFile) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, 'backupFile required'),
          { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
        );
      }

      const result = restoreBackup(dbUrl, body.backupFile);
      return NextResponse.json(successResponse({ data: { result } }), { status: 200 });
    }

    return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Invalid action'), { status: getStatusCode(ErrorCodes.NOT_FOUND) });
  } catch (error) {
    console.error('Database backup error:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Operation failed'
      ),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function GET(request: NextRequest, { params }: any) {
  const ctx = await extractUserContext(request);

  if (!ctx.userId) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
      { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
    );
  }

  const user = await loadUserWithRoles(ctx.userId);
  if (!user || !isAdmin(user)) {
    return NextResponse.json(
      errorResponse(ErrorCodes.FORBIDDEN, 'Admin access required'),
      { status: getStatusCode(ErrorCodes.FORBIDDEN) }
    );
  }

  const action = params.route?.[0];

  try {
    if (action === 'backups') {
      const backups = listBackups();
      return NextResponse.json(successResponse({ data: { backups } }), { status: 200 });
    }

    if (action === 'schedule') {
      const schedule = getSchedule();
      return NextResponse.json(successResponse({ data: { schedule } }), { status: 200 });
    }

    return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Invalid action'), { status: getStatusCode(ErrorCodes.NOT_FOUND) });
  } catch (error) {
    console.error('Database list error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to list backups'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function PUT(request: NextRequest, { params }: any) {
  const ctx = await extractUserContext(request);

  if (!ctx.userId) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
      { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
    );
  }

  const user = await loadUserWithRoles(ctx.userId);
  if (!user || !isAdmin(user)) {
    return NextResponse.json(
      errorResponse(ErrorCodes.FORBIDDEN, 'Admin access required'),
      { status: getStatusCode(ErrorCodes.FORBIDDEN) }
    );
  }

  const action = params.route?.[0];

  try {
    if (action === 'schedule') {
      const body = await request.json();
      const schedule = saveSchedule(body);
      return NextResponse.json(successResponse({ data: { schedule } }), { status: 200 });
    }

    return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Invalid action'), { status: getStatusCode(ErrorCodes.NOT_FOUND) });
  } catch (error) {
    console.error('Database schedule error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to save schedule'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
