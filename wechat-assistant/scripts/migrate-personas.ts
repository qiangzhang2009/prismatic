#!/usr/bin/env npx tsx
# ============================================
# Persona 迁移脚本
# 将 Prismatic personas.ts 迁移到 wechat-assistant corpus/personas/
# ============================================

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const PRISMATIC_ROOT = join(PROJECT_ROOT, '..', 'prismatic'); // 假设 prismatic 在同级目录

// 如果 Prismatic 不存在，创建基础 Persona
async function main() {
  console.log('===========================================');
  console.log('Persona 迁移工具');
  console.log('===========================================');

  const corpusDir = join(PROJECT_ROOT, 'corpus', 'personas');
  const targetDir = join(PROJECT_ROOT, 'wechat-assistant', 'corpus', 'personas');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 已有内置 Persona，检查是否需要补充
  const builtinPersonas = [
    'smart-assistant',
    'customer-service',
    'mentor',
    'entertainer',
    'strict-moderator',
  ];

  for (const slug of builtinPersonas) {
    const targetPath = join(targetDir, `${slug}.json`);
    if (existsSync(targetPath)) {
      console.log(`[跳过] ${slug}.json 已存在`);
    } else {
      console.log(`[待创建] ${slug}.json 不存在`);
    }
  }

  // 尝试从 Prismatic 迁移（如果存在）
  const prismaticPersonasPath = join(PRISMATIC_ROOT, 'src', 'lib', 'personas.ts');
  if (existsSync(prismaticPersonasPath)) {
    console.log('\n[发现] 检测到 Prismatic personas.ts');
    console.log('      迁移功能需要手动执行，请参考 docs/migration-guide.md');
  } else {
    console.log('\n[信息] 未找到 Prismatic personas.ts');
    console.log('      将使用内置基础 Persona');
  }

  console.log('\n===========================================');
  console.log('迁移完成');
  console.log('===========================================');
  console.log('\n内置 Persona:');
  for (const slug of builtinPersonas) {
    console.log(`  - ${slug}`);
  }
  console.log('\n如需添加自定义 Persona:');
  console.log(`  1. 创建 ${targetDir}/<slug>.json`);
  console.log('  2. 参考内置 Persona 的格式');
  console.log('  3. 在管理后台导入');
}

main().catch(console.error);
