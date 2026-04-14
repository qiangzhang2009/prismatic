'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  MessageSquare, Send, ChevronDown, ChevronUp, Loader2, Sparkles,
  ThumbsUp, Heart, Smile, MoreHorizontal, Pin, Trash2, Edit3, Flag,
  Eye, Clock, TrendingUp, MessageCircle, Check, X, AlertTriangle,
  Shield, ChevronLeft, CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { GuardianBanner } from '@/components/guardian-banner';

interface Reaction {
  emoji: string;
  count: number;
}

interface PersonaInteraction {
  id: number;
  personaId: string;
  personaNameZh: string;
  gradientFrom: string;
  gradientTo: string;
  interactionType: string;
  content: string | null;
  emoji: string | null;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_avatar: string;
  avatar_url: string | null;
  display_name: string | null;
  gender: string | null;
  location: string | null;
  created_at: string;
  is_pinned: boolean;
  is_edited: boolean;
  likes: number;
  reactions: Record<string, number>;
  reactionCount: number;
  userReaction: string | null;
  view_count: number;
  report_count: number;
  replyCount: number;
  personaInteractions?: PersonaInteraction[];
}

interface Reply {
  id: string;
  content: string;
  author_name: string;
  author_avatar: string;
  avatar_url: string | null;
  display_name: string | null;
  gender: string | null;
  location: string | null;
  created_at: string;
  is_edited: boolean;
}

// Available reactions
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '💯', '✨', '🎉'];

// Popular quick reactions
const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😮', '💯'];

// DiceBear avatar helper
function buildAvatarUrl(seedOrEmoji: string, gender?: string | null): { type: 'url'; url: string } | { type: 'emoji'; emoji: string } {
  // If it looks like a DiceBear seed (hex string 8+ chars), build URL
  if (/^[a-f0-9]{8,}$/i.test(seedOrEmoji)) {
    const bgColor = gender === 'male' ? 'b6e3f4,c0aede,d1d4f9'
      : gender === 'female' ? 'ffd5dc,ffdfbf'
      : 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';
    return {
      type: 'url',
      url: `https://api.dicebear.com/7.x/avataaars/png?seed=${seedOrEmoji}&backgroundColor=${bgColor}`,
    };
  }
  return { type: 'emoji', emoji: seedOrEmoji || '👤' };
}
function getVisitorId(): string {
  let visitorId = localStorage.getItem('prismatic-visitor');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem('prismatic-visitor', visitorId);
  }
  return visitorId;
}

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  
  if (weeks > 0) return `${weeks}周前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Reaction picker component
function ReactionPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      className="absolute bottom-full left-0 mb-2 z-50"
    >
      <div className="bg-bg-overlay border border-white/10 rounded-2xl p-2 shadow-2xl flex gap-1">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-10 h-10 rounded-xl hover:bg-white/10 transition-all hover:scale-125 flex items-center justify-center text-xl"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="absolute top-full left-4 w-4 h-4 bg-bg-overlay border-l border-b border-white/10 rotate-45 -mt-[9px]" />
    </motion.div>
  );
}

// Edit modal
function EditModal({
  isOpen,
  onClose,
  onSave,
  initialContent,
  isSubmitting
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  initialContent: string;
  isSubmitting: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-bg-surface border border-white/10 rounded-2xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">编辑留言</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue/50 transition-colors resize-none mb-4"
          placeholder="修改你的留言..."
          autoFocus
        />
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{content.length}/1000</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-text-muted hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onSave(content)}
              disabled={isSubmitting || !content.trim() || content === initialContent}
              className="px-4 py-2 rounded-lg bg-prism-gradient text-white disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Report modal
function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState('');
  
  const reasons = [
    { id: 'spam', label: '垃圾广告' },
    { id: 'hate', label: '仇恨言论' },
    { id: 'harassment', label: '人身攻击' },
    { id: 'misinformation', label: '虚假信息' },
    { id: 'offensive', label: '不当内容' },
  ];
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-500" />
            举报留言
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        
        <p className="text-text-secondary text-sm mb-4">请选择举报原因，我们会尽快审核处理。</p>
        
        <div className="space-y-2 mb-6">
          {reasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              className={cn(
                'w-full px-4 py-3 rounded-xl text-left transition-all flex items-center gap-3',
                reason === r.id
                  ? 'bg-prism-blue/20 border border-prism-blue/50 text-text-primary'
                  : 'bg-white/5 border border-transparent hover:bg-white/10 text-text-secondary'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                reason === r.id ? 'border-prism-blue bg-prism-blue' : 'border-text-muted'
              )}>
                {reason === r.id && <Check className="w-3 h-3 text-white" />}
              </div>
              {r.label}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-text-muted hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => reason && onSubmit(reason)}
            disabled={!reason || isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? '提交中...' : '提交举报'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Admin action menu
function AdminMenu({
  commentId,
  isPinned,
  onPin,
  onHide,
  onDelete,
  onClose
}: {
  commentId: string;
  isPinned: boolean;
  onPin: () => void;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 bg-bg-overlay border border-white/10 rounded-xl p-1 min-w-[140px] shadow-2xl z-50"
    >
      <button
        onClick={onPin}
        className="w-full px-3 py-2 rounded-lg text-left text-sm hover:bg-white/10 flex items-center gap-2 text-amber-400"
      >
        <Pin className="w-4 h-4" />
        {isPinned ? '取消置顶' : '置顶'}
      </button>
      <button
        onClick={onHide}
        className="w-full px-3 py-2 rounded-lg text-left text-sm hover:bg-white/10 flex items-center gap-2 text-text-secondary"
      >
        <Eye className="w-4 h-4" />
        隐藏/显示
      </button>
      <div className="h-px bg-white/10 my-1" />
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 rounded-lg text-left text-sm hover:bg-white/10 flex items-center gap-2 text-red-400"
      >
        <Trash2 className="w-4 h-4" />
        删除
      </button>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-4 h-4 bg-bg-overlay border-l border-t border-white/10 rotate-45 -mt-[9px]" />
    </motion.div>
  );
}

// Comment item component
function CommentItem({
  comment,
  isAdmin,
  onReact,
  onEdit,
  onDelete,
  onReport,
  onAdminAction,
  onReply,
  showReplyButton = true
}: {
  comment: Comment;
  isAdmin: boolean;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onAdminAction: (action: string, value?: any) => void;
  onReply: (commentId: string) => void;
  showReplyButton?: boolean;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [personaInteractions, setPersonaInteractions] = useState<PersonaInteraction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fix hydration: timeAgo uses new Date() which differs between server and client
  useEffect(() => { setMounted(true); }, []);
  const timeDisplay = mounted ? timeAgo(comment.created_at) : '加载中';
  const canEdit = comment.author_name.startsWith('Admin') || isAdmin;

  // Determine avatar to show
  const avatarInfo = buildAvatarUrl(comment.author_avatar, comment.gender);
  const avatarDisplay = avatarInfo.type === 'url'
    ? <Image src={avatarInfo.url} alt={comment.display_name || comment.author_name} width={44} height={44} className="w-11 h-11 rounded-full object-cover" unoptimized />
    : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center text-xl flex-shrink-0">{avatarInfo.emoji}</div>;

  // Fetch persona interactions for this comment
  useEffect(() => {
    if (comment.personaInteractions) {
      setPersonaInteractions(comment.personaInteractions);
      return;
    }
    setLoadingInteractions(true);
    fetch(`/api/comments/${comment.id}/persona`)
      .then(r => r.json())
      .then(data => { setPersonaInteractions(data.interactions || []); })
      .catch(() => {})
      .finally(() => setLoadingInteractions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment.id]);
  
  const fetchReplies = async () => {
    if (replies.length > 0 || loadingReplies) {
      setShowReplies(!showReplies);
      return;
    }
    
    setLoadingReplies(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}/replies?parentId=${comment.id}`);
      const data = await res.json();
      setReplies(data.replies || []);
      setShowReplies(true);
    } catch (e) {
      console.error('Failed to fetch replies:', e);
    } finally {
      setLoadingReplies(false);
    }
  };
  
  const handleEdit = async (content: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', content }),
      });
      if (res.ok) {
        onEdit();
        setEditModal(false);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleReport = async (reason: string) => {
    setSubmitting(true);
    try {
      await fetch(`/api/comments/${comment.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      setReportModal(false);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <>
      <motion.div
        layout
        className={cn(
          'rounded-2xl border p-5 transition-all',
          comment.is_pinned
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-white/10 bg-white/[0.02]'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {avatarDisplay}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-text-primary">
                {comment.display_name || comment.author_name}
              </span>
              {comment.gender && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted/70 bg-bg-surface/50 px-1.5 py-0.5 rounded-full">
                  {comment.gender === 'male' ? '♂' : comment.gender === 'female' ? '♀' : '⚥'}
                  {comment.gender === 'male' ? '男' : comment.gender === 'female' ? '女' : '其他'}
                </span>
              )}
              {comment.location && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted/70 bg-bg-surface/50 px-1.5 py-0.5 rounded-full">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {comment.location}
                </span>
              )}
              {comment.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  <Pin className="w-3 h-3" /> 置顶
                </span>
              )}
              {comment.is_edited && (
                <span className="text-[10px] text-text-muted/50">(已编辑)</span>
              )}
              <span className="text-xs text-text-muted">{timeDisplay}</span>
            </div>
            <div className="text-xs text-text-muted/50" title={formatDate(comment.created_at)}>
              {comment.view_count} 阅读
            </div>
          </div>
          
          {/* Actions menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-text-muted" />
            </button>
            
            <AnimatePresence>
              {showAdminMenu && (
                <AdminMenu
                  commentId={comment.id}
                  isPinned={comment.is_pinned}
                  onPin={() => {
                    const pinAction = comment.is_pinned ? 'unpin' : 'pin';
                    onAdminAction(pinAction);
                    setShowAdminMenu(false);
                  }}
                  onHide={() => { onAdminAction('hide', true); setShowAdminMenu(false); }}
                  onDelete={() => { onDelete(); setShowAdminMenu(false); }}
                  onClose={() => setShowAdminMenu(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Content */}
        <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap mb-4">
          {comment.content}
        </p>
        
        {/* Actions */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Reaction button */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all',
                comment.userReaction
                  ? 'bg-prism-blue/20 text-prism-blue'
                  : 'hover:bg-white/5 text-text-muted'
              )}
            >
              {comment.userReaction ? (
                <span>{comment.userReaction}</span>
              ) : (
                <ThumbsUp className="w-4 h-4" />
              )}
              <span>{comment.reactionCount || ''}</span>
            </button>
            
            <AnimatePresence>
              {showReactions && (
                <ReactionPicker
                  onSelect={(emoji) => { onReact(emoji); setShowReactions(false); }}
                  onClose={() => setShowReactions(false)}
                />
              )}
            </AnimatePresence>
          </div>
          
          {/* Show existing reactions */}
          {Object.entries(comment.reactions || {}).filter(([emoji]) => emoji !== comment.userReaction).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              <span>{emoji}</span>
              <span className="text-text-muted text-xs">{count}</span>
            </button>
          ))}
          
          <div className="w-px h-4 bg-white/10 mx-2" />
          
          {/* Reply button */}
          {showReplyButton && (
            <button
              onClick={() => onReply(comment.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 text-text-muted transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{comment.replyCount > 0 ? `${comment.replyCount} 回复` : '回复'}</span>
            </button>
          )}
          
          {/* View replies */}
          {comment.replyCount > 0 && (
            <button
              onClick={fetchReplies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 text-text-muted transition-colors"
            >
              {loadingReplies ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showReplies ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <span>{showReplies ? '收起' : `${comment.replyCount} 条回复`}</span>
            </button>
          )}
          
          <div className="flex-1" />
          
          {/* Edit button (for own comments) */}
          {canEdit && (
            <button
              onClick={() => setEditModal(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="编辑"
            >
              <Edit3 className="w-4 h-4 text-text-muted" />
            </button>
          )}
          
          {/* Report button */}
          <button
            onClick={() => setReportModal(true)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="举报"
          >
            <Flag className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        
        {/* Replies */}
        <AnimatePresence>
          {showReplies && replies.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-white/5 space-y-3"
            >
              {replies.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-3 pl-4 border-l-2 border-white/10">
                    {(() => {
                      const info = buildAvatarUrl(reply.author_avatar, reply.gender);
                      return info.type === 'url'
                        ? <Image src={info.url} alt={reply.display_name || reply.author_name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" unoptimized />
                        : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-prism-green/20 to-prism-cyan/20 flex items-center justify-center text-sm flex-shrink-0">{info.emoji}</div>;
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary">
                          {reply.display_name || reply.author_name}
                        </span>
                        {reply.gender && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted/60 bg-bg-surface/30 px-1.5 py-0.5 rounded-full">
                            {reply.gender === 'male' ? '♂' : reply.gender === 'female' ? '♀' : '⚥'}
                            {reply.gender === 'male' ? '男' : reply.gender === 'female' ? '女' : '其他'}
                          </span>
                        )}
                        {reply.location && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted/60 bg-bg-surface/30 px-1.5 py-0.5 rounded-full">
                            {reply.location}
                          </span>
                        )}
                        {reply.is_edited && (
                          <span className="text-[10px] text-text-muted/50">(已编辑)</span>
                        )}
                        <span className="text-xs text-text-muted">{timeAgo(reply.created_at)}</span>
                      </div>
                      <p className="text-sm text-text-secondary mt-1">{reply.content}</p>
                    </div>
                  </div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persona Interactions — "守望者计划" responses */}
        <AnimatePresence>
          {personaInteractions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-prism-blue/20 space-y-3"
            >
              {personaInteractions.map((interaction) => (
                <div key={interaction.id} className="flex items-start gap-3 pl-4 border-l-2 border-prism-blue/30">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${interaction.gradientFrom}, ${interaction.gradientTo})`,
                      boxShadow: `0 2px 8px ${interaction.gradientFrom}60`,
                    }}
                    title={`守望者 ${interaction.personaNameZh}`}
                  >
                    {interaction.personaNameZh[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-prism-blue">
                        {interaction.personaNameZh}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-prism-blue/10 text-prism-blue flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        守望者回复
                      </span>
                      <span className="text-xs text-text-muted">{timeAgo(interaction.createdAt)}</span>
                    </div>
                    {interaction.content && (
                      <p className="text-sm text-text-secondary leading-relaxed italic">
                        {interaction.content}
                      </p>
                    )}
                    {interaction.emoji && (
                      <span className="text-2xl">{interaction.emoji}</span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Modals */}
      <EditModal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        onSave={handleEdit}
        initialContent={comment.content}
        isSubmitting={submitting}
      />
      
      <ReportModal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
        onSubmit={handleReport}
        isSubmitting={submitting}
      />
    </>
  );
}

// Reply form
function ReplyForm({
  parentId,
  onSubmit,
  onCancel
}: {
  parentId: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(content);
    setSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 pl-6 border-l-2 border-prism-blue/30"
    >
      <div className="bg-white/5 rounded-xl p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下你的回复..."
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-prism-blue/50 transition-colors resize-none mb-3"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{content.length}/500</span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-text-muted text-sm hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="px-3 py-1.5 rounded-lg bg-prism-gradient text-white text-sm disabled:opacity-50 transition-opacity"
            >
              {submitting ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main comments section
export function CommentsSection() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;
  const MAX_VISIBLE_PAGES = 5; // max page number buttons to show
  // Date filter
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('全部时间');
  // Debate topic for comment inspiration (forum ops)
  const [debateTopic, setDebateTopic] = useState<string | null>(null);
  // Quick date filter
  const QUICK_DATES = [
    { label: '今天', getValue: () => new Date().toISOString().slice(0, 10), isToday: true },
    { label: '昨天', getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }, isToday: false },
    { label: '本周', getValue: () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); return d.toISOString().slice(0, 10); }, isToday: false },
    { label: '本月', getValue: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }, isToday: false },
  ];

  const { user } = useAuthStore();
  const visitorId = typeof window !== 'undefined' ? getVisitorId() : '';

  const fetchComments = useCallback(async (pageNum = 0, reset = true) => {
    try {
      setLoading(true);
      const offset = pageNum * LIMIT;
      const url = `/api/comments?limit=${LIMIT}&offset=${offset}&sort=${sort}${dateFilter ? `&date=${dateFilter}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (reset) {
        setComments(data.comments || []);
      } else {
        setComments(prev => [...prev, ...(data.comments || [])]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [sort, dateFilter]);

  useEffect(() => {
    // Fetch fresh data when sort or date changes — use shared callback to avoid double-fetch
    fetchComments(0, true);

    // Also fetch today's debate topic for community engagement hook
    fetch('/api/forum/debate')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.debate?.topic) setDebateTopic(data.debate.topic);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, dateFilter]); // intentionally omit fetchComments deps to avoid stale closures

  const loadMore = () => fetchComments(page + 1, false);

  const handleDateFilter = (date: string | null) => {
    setDateFilter(date);
    if (date) {
      const d = new Date(date);
      setDateRangeLabel(d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      setDateRangeLabel('全部时间');
    }
  };

  const handleSortChange = (newSort: 'latest' | 'popular') => {
    setSort(newSort);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const data = await res.json();
      setComments(prev => [data.comment, ...prev]);
      setContent('');
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              reactions: data.counts,
              reactionCount: data.total,
              userReaction: data.userReacted ? emoji : null,
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };
  
  const handleReply = async (parentId: string, replyContent: string) => {
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          parentId,
        }),
      });

      if (res.ok) {
        setComments(prev => prev.map(c => {
          if (c.id === parentId) {
            return { ...c, replyCount: c.replyCount + 1 };
          }
          return c;
        }));
        setReplyingTo(null);
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to submit reply:', err);
    }
  };
  
  const handleAdminAction = async (commentId: string, action: string, value?: any) => {
    try {
      // Delete goes through DELETE endpoint, everything else through PATCH
      if (action === 'delete') {
        const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
        if (res.ok) {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }
        return;
      }

      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });

      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error('Admin action failed:', err);
    }
  };
  
  return (
    <section className="py-20 px-6 bg-bg-surface/30">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-6">
            <MessageSquare className="w-4 h-4 text-prism-blue" />
            <span className="text-sm text-text-secondary">用户留言</span>
            <span className="text-xs text-text-muted/50">·</span>
            <span className="text-xs text-text-muted">{total > 0 ? total : comments.length} 条留言</span>
            {total > 50 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-prism-blue/10 text-prism-blue/70">
                活跃社区
              </span>
            )}
            {total > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/80">
                🛡️ 守望者关注中
              </span>
            )}
          </div>

          {/* Debate topic engagement banner — 论坛运营优化 */}
          {debateTopic && (
            <div className="mb-4 mx-auto max-w-md">
              <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2 text-center">
                <span className="text-sm">🔥</span>
                <span className="text-xs text-text-secondary">
                  今日辩题：<span className="text-text-primary font-medium">{debateTopic}</span>
                </span>
                <span className="text-[10px] text-text-muted/60">围观守望者辩论，也可以在下方说说你的观点，辩论结束后仍可继续参与讨论</span>
              </div>
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-3">
            听听大家怎么说
          </h2>
          <p className="text-text-muted text-sm">
            分享你的使用体验，与其他用户交流心得
          </p>
        </motion.div>

        {/* Guardian Banner */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <GuardianBanner />
          </motion.div>
        </div>

        {/* Comment Form — open to everyone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {/* User identity — avatar + name */}
            <div className="flex items-center gap-3 mb-4">
              {user ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-prism-gradient flex items-center justify-center text-white text-xs font-medium">
                    {user.name?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-text-secondary">
                    以 <span className="text-text-primary font-medium">{user.name || user.email.split('@')[0]}</span> 身份发言
                  </span>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center overflow-hidden flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-text-muted" />
                  </div>
                  <span className="text-sm text-text-muted">
                    匿名发言 · 游客
                  </span>
                  <span className="text-xs text-text-muted/50 ml-1">
                    （无需注册，IP仅用于防刷）
                  </span>
                </>
              )}
            </div>

            {/* Textarea */}
            <div className="mb-4 relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  debateTopic
                    ? `围绕"${debateTopic}"发表你的看法，或分享任何想法... 守望者正在关注今天的讨论`
                    : "分享你的想法... 守望者正在关注今天的讨论"
                }
                maxLength={1000}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue/50 transition-colors resize-none"
              />
              <div className="absolute bottom-3 right-3 text-xs text-text-muted">
                {content.length}/1000
              </div>
            </div>

            {error && (
              <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Quick reactions preview */}
                <div className="flex gap-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setContent(prev => prev + emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 transition-all hover:scale-110 flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-text-muted flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>守望者正在关注</span>
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={submitting || !content.trim()}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all',
                  'bg-prism-gradient text-white',
                  'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? '提交中...' : '发布留言'}
              </motion.button>
            </div>

            {/* Anonymous hint */}
            {!user && (
              <div className="mt-3 flex items-center justify-center gap-1 text-xs text-text-muted/60">
                <Shield className="w-3 h-3" />
                <span>匿名发言 · 位置信息仅显示大致地区 · </span>
                <Link href="/auth/signin" className="text-prism-blue hover:underline">登录</Link>
                <span>后可个性化发言</span>
              </div>
            )}
          </form>
        </motion.div>

          {/* Quick Date Filter + Sort tabs */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Quick date chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_DATES.map((qd) => {
                const val = qd.getValue();
                const isActive = dateFilter === val;
                return (
                  <button
                    key={qd.label}
                    onClick={() => handleDateFilter(isActive ? null : val)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs transition-all',
                      isActive
                        ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                        : 'text-text-muted hover:bg-white/5 border border-transparent'
                    )}
                  >
                    {qd.label}
                  </button>
                );
              })}
              {/* Sort tabs */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => handleSortChange('latest')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5',
                    sort === 'latest'
                      ? 'bg-prism-blue/20 text-prism-blue'
                      : 'text-text-muted hover:bg-white/5'
                  )}
                >
                  <Clock className="w-3 h-3" />
                  最新
                </button>
                <button
                  onClick={() => handleSortChange('popular')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5',
                    sort === 'popular'
                      ? 'bg-prism-blue/20 text-prism-blue'
                      : 'text-text-muted hover:bg-white/5'
                  )}
                >
                  <TrendingUp className="w-3 h-3" />
                  最热
                </button>
              </div>
            </div>
          </div>

        {/* Comments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-prism-blue/5 border border-prism-blue/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-prism-blue/40" />
              </div>
              <p className="text-text-muted font-medium">还没有留言</p>
              <p className="text-text-muted/60 text-sm mt-1 mb-6">成为第一个留言的人吧！守望者正在值班中...</p>
              <div className="flex items-center justify-center gap-4 text-xs text-text-muted/50">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> 守望者正在关注</span>
                <span>·</span>
                <span>快速响应</span>
                <span>·</span>
                <span>匿名可发</span>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {comments.map((comment, index) => (
                <div key={comment.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <CommentItem
                      comment={comment}
                      isAdmin={false}
                      onReact={(emoji) => handleReaction(comment.id, emoji)}
                      onEdit={fetchComments}
                      onDelete={() => handleAdminAction(comment.id, 'delete')}
                      onReport={() => {}}
                      onAdminAction={(action, value) => handleAdminAction(comment.id, action, value)}
                      onReply={setReplyingTo}
                    />
                    
                    {/* Reply form */}
                    <AnimatePresence>
                      {replyingTo === comment.id && (
                        <ReplyForm
                          parentId={comment.id}
                          onSubmit={(content) => handleReply(comment.id, content)}
                          onCancel={() => setReplyingTo(null)}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="mt-8 space-y-4">
            {/* Status bar */}
            <div className="flex items-center justify-between text-xs text-text-muted/60">
              <span>
                共 {total} 条留言
                {dateFilter && <span> · 已筛选：{dateRangeLabel}</span>}
              </span>
              <span>
                第 {page + 1} / {Math.ceil(total / LIMIT)} 页
              </span>
            </div>

            {/* Page controls */}
            <div className="flex items-center justify-center gap-2">
              {/* Prev */}
              <button
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); fetchComments(page - 1, true); }}
                disabled={page === 0 || loading}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-text-muted hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>

              {/* Page number buttons */}
              {(() => {
                const totalPages = Math.ceil(total / LIMIT);
                const pages: (number | '...')[] = [];
                if (totalPages <= MAX_VISIBLE_PAGES) {
                  for (let i = 0; i < totalPages; i++) pages.push(i);
                } else {
                  pages.push(0);
                  if (page > 2) pages.push('...');
                  for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
                    pages.push(i);
                  }
                  if (page < totalPages - 3) pages.push('...');
                  pages.push(totalPages - 1);
                }
                return pages.map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-text-muted/40 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); fetchComments(p, true); }}
                      disabled={loading}
                      className={cn(
                        'w-9 h-9 rounded-lg border text-xs transition-all',
                        p === page
                          ? 'bg-prism-blue/20 border-prism-blue/50 text-prism-blue font-semibold'
                          : 'border-white/10 text-text-muted hover:bg-white/5 hover:border-white/20',
                        loading ? 'opacity-30 cursor-not-allowed' : ''
                      )}
                    >
                      {p + 1}
                    </button>
                  )
                );
              })()}

              {/* Next */}
              <button
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); fetchComments(page + 1, true); }}
                disabled={!hasMore || loading}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-text-muted hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>

            {/* Clear filter */}
            {dateFilter && (
              <div className="flex justify-center">
                <button
                  onClick={() => handleDateFilter(null)}
                  className="text-xs text-prism-blue hover:underline"
                >
                  清除日期筛选
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
