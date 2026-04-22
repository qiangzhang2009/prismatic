// ============================================
// Hermes Settings API — 读取/写入 ~/.hermes/.env
// 暴露微信权限策略相关的环境变量配置
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HERMES_DIR = join(homedir(), '.hermes');
const ENV_FILE = join(HERMES_DIR, '.env');

interface EnvVars {
  WEIXIN_ACCOUNT_ID: string;
  WEIXIN_TOKEN: string;
  WEIXIN_DM_POLICY: string;
  WEIXIN_ALLOWED_USERS: string;
  WEIXIN_GROUP_POLICY: string;
  WEIXIN_GROUP_ALLOWED_USERS: string;
  WEIXIN_HOME_CHANNEL: string;
  WEIXIN_HOME_CHANNEL_NAME: string;
}

function parseEnvFile(content: string): EnvVars {
  const vars: EnvVars = {
    WEIXIN_ACCOUNT_ID: '',
    WEIXIN_TOKEN: '',
    WEIXIN_DM_POLICY: 'open',
    WEIXIN_ALLOWED_USERS: '',
    WEIXIN_GROUP_POLICY: 'disabled',
    WEIXIN_GROUP_ALLOWED_USERS: '',
    WEIXIN_HOME_CHANNEL: '',
    WEIXIN_HOME_CHANNEL_NAME: '',
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key in vars) {
      (vars as unknown as Record<string, string>)[key] = value;
    }
  }
  return vars;
}

function envVarsToString(vars: Partial<EnvVars>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    const needsQuotes = value.includes(' ') || value.includes('#');
    lines.push(`${key}=${needsQuotes ? `"${value}"` : value}`);
  }
  return lines.join('\n');
}

// GET /api/hermes/settings — 读取当前配置
export async function GET() {
  try {
    if (!existsSync(ENV_FILE)) {
      return NextResponse.json({
        settings: {
          WEIXIN_DM_POLICY: 'open',
          WEIXIN_ALLOWED_USERS: '',
          WEIXIN_GROUP_POLICY: 'disabled',
          WEIXIN_GROUP_ALLOWED_USERS: '',
          WEIXIN_HOME_CHANNEL: '',
          WEIXIN_HOME_CHANNEL_NAME: '',
        },
        envFileExists: false,
        envFilePath: ENV_FILE,
      });
    }

    const content = readFileSync(ENV_FILE, 'utf-8');
    const vars = parseEnvFile(content);

    return NextResponse.json({
      settings: vars,
      envFileExists: true,
      envFilePath: ENV_FILE,
    });
  } catch (error) {
    console.error('[API/hermes/settings/GET]', error);
    return NextResponse.json(
      { error: 'Failed to read Hermes settings', details: String(error) },
      { status: 500 },
    );
  }
}

// PATCH /api/hermes/settings — 更新配置（追加到 .env）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { WEIXIN_DM_POLICY, WEIXIN_ALLOWED_USERS, WEIXIN_GROUP_POLICY, WEIXIN_GROUP_ALLOWED_USERS, WEIXIN_HOME_CHANNEL, WEIXIN_HOME_CHANNEL_NAME } = body;

    // 构建要写入的行
    const updates: Partial<EnvVars> = {};
    if (WEIXIN_DM_POLICY !== undefined) updates.WEIXIN_DM_POLICY = WEIXIN_DM_POLICY;
    if (WEIXIN_ALLOWED_USERS !== undefined) updates.WEIXIN_ALLOWED_USERS = WEIXIN_ALLOWED_USERS;
    if (WEIXIN_GROUP_POLICY !== undefined) updates.WEIXIN_GROUP_POLICY = WEIXIN_GROUP_POLICY;
    if (WEIXIN_GROUP_ALLOWED_USERS !== undefined) updates.WEIXIN_GROUP_ALLOWED_USERS = WEIXIN_GROUP_ALLOWED_USERS;
    if (WEIXIN_HOME_CHANNEL !== undefined) updates.WEIXIN_HOME_CHANNEL = WEIXIN_HOME_CHANNEL;
    if (WEIXIN_HOME_CHANNEL_NAME !== undefined) updates.WEIXIN_HOME_CHANNEL_NAME = WEIXIN_HOME_CHANNEL_NAME;

    // 读取现有内容
    let existing = '';
    if (existsSync(ENV_FILE)) {
      existing = readFileSync(ENV_FILE, 'utf-8');
    }

    // 追加新的环境变量（每行一个）
    const newLines = Object.entries(updates)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${v}`);

    const updated = existing.trimEnd() + (existing ? '\n' : '') + newLines.join('\n') + '\n';
    writeFileSync(ENV_FILE, updated, 'utf-8');

    return NextResponse.json({ success: true, updated: updates });
  } catch (error) {
    console.error('[API/hermes/settings/PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update Hermes settings', details: String(error) },
      { status: 500 },
    );
  }
}
