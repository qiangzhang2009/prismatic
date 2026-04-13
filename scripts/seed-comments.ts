/**
 * Database Seed Script
 * Run this to initialize the comments table with sample data
 * 
 * Usage: 
 *   npx tsx scripts/seed-comments.ts
 * or
 *   node --loader ts-node/esm scripts/seed-comments.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function seed() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  console.log('📦 Creating comments table...');
  
  // Create table
  await sql`
    CREATE TABLE IF NOT EXISTS public.prismatic_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID DEFAULT '97e7123c-a201-4cbf-a483-b6d777433818',
      content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
      author_name VARCHAR(50) NOT NULL DEFAULT 'Anonymous',
      author_avatar VARCHAR(10) DEFAULT '👤',
      user_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      is_pinned BOOLEAN DEFAULT FALSE,
      is_hidden BOOLEAN DEFAULT FALSE,
      parent_id UUID,
      likes INTEGER DEFAULT 0,
      display_name VARCHAR(50)
    )
  `;
  console.log('✅ Table created');

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_tenant ON public.prismatic_comments(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_created ON public.prismatic_comments(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_pinned ON public.prismatic_comments(is_pinned DESC, created_at DESC)`;
  console.log('✅ Indexes created');

  // Insert sample comments
  const existingComments = await sql`SELECT COUNT(*) as count FROM public.prismatic_comments`;
  
  if (Number(existingComments[0]?.count || 0) === 0) {
    console.log('📝 Inserting sample comments...');
    
    await sql`
      INSERT INTO public.prismatic_comments (content, author_name, author_avatar, display_name, is_pinned)
      VALUES 
        ('这个产品太棒了！让乔布斯和芒格同时思考我的问题，感觉打开了新世界的大门 🚀', '产品爱好者', '🚀', '产品爱好者', true),
        ('作为一个哲学爱好者，终于找到了可以深入探讨斯多葛主义的工具。费曼的思维方式也让人受益匪浅！', '哲学探索者', '🦉', '哲学探索者', false),
        ('张一鸣的实用主义思维对我做产品很有启发，强力推荐！', '创业者小明', '💡', '创业者小明', false),
        ('界面设计很优雅，使用体验流畅，期待更多功能！', '设计师阿杰', '🎨', '设计师阿杰', false),
        ('和乔布斯、马斯克、芒格同时对话，这种体验太神奇了！', '科技迷', '🔥', '科技迷', false)
    `;
    console.log('✅ Sample comments inserted');
  } else {
    console.log('ℹ️  Comments already exist, skipping sample data');
  }

  console.log('🎉 Done!');
}

seed().catch(console.error);
