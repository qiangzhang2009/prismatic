'use client';

/**
 * Admin — Affiliates Management (full CRUD + settle + export)
 * /admin/affiliates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, RefreshCw, CheckCircle2, XCircle, Eye, Loader2,
  Search, TrendingUp, Wallet, Plus, Edit2, Trash2, TrendingDown,
  Copy, Check, X, ChevronDown, Download, Banknote, UserPlus,
  BarChart3, ExternalLink, AlertTriangle
} from 'lucide-react';

function fmt(n: any) { return Number(n ?? 0).toFixed(2); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type StatusFilter = 'all' | 'pending' | 'active' | 'paused' | 'rejected';

interface Conversion {
  id: number;
  plan: string;
  amount: string;
  commission: string;
  commission_status: string;
  created_at: string;
}

interface Referral {
  id: number;
  user_id: string;
  referral_code: string;
  referred_at: string;
}

interface Affiliate {
  id: number;
  partner_id: string;
  name: string;
  wechat_id: string;
  email: string | null;
  referral_code: string;
  commission_type: string;
  commission_rate: number;
  commission_fixed: number;
  status: string;
  total_referrals: number;
  total_conversions: number;
  total_commission: number;
  pending_commission: number;
  withdrawn_commission: number;
  bio: string | null;
  dashboard_token?: string;
  created_at: string;
  updated_at?: string;
  conversions?: Conversion[];
  referrals?: Referral[];
}

interface EditForm {
  name: string;
  wechat_id: string;
  email: string;
  commission_type: string;
  commission_rate: string;
  commission_fixed: string;
  bio: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核', active: '已激活', paused: '已暂停', rejected: '已拒绝',
};
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  active: 'bg-green-500/15 text-green-400',
  paused: 'bg-red-500/15 text-red-400',
  rejected: 'bg-gray-500/15 text-gray-400',
};

const COMMISSION_TYPE_LABEL: Record<string, string> = {
  percentage: '按比例', fixed: '固定金额', both: '两者取高',
};

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal: 'add' | 'detail' | 'edit' | 'settle' | 'delete' | null
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Affiliate | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'conversions' | 'referrals'>('info');
  const [detailLoading, setDetailLoading] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState({ name: '', wechat_id: '', email: '', commission_type: 'percentage', commission_rate: '10', commission_fixed: '', bio: '' });
  const [addLoading, setAddLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState<EditForm>({ name: '', wechat_id: '', email: '', commission_type: 'percentage', commission_rate: '10', commission_fixed: '', bio: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Settle form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  // Delete confirm
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliates?status=all', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAffiliates(data.affiliates ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const fetchDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/affiliates?id=${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelected(data.affiliate);
      }
    } finally { setDetailLoading(false); }
  };

  const handleAction = async (id: number, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || '操作成功', true);
        fetchAffiliates();
        if (selected?.id === id) fetchDetail(id);
      } else {
        showToast(data.error || '操作失败', false);
      }
    } catch { showToast('网络错误', false); }
    finally { setActionLoading(null); }
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.wechat_id) { showToast('姓名和微信号必填', false); return; }
    setAddLoading(true);
    try {
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...addForm, is_admin: true }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('合伙人添加成功', true);
        setModal(null);
        setAddForm({ name: '', wechat_id: '', email: '', commission_type: 'percentage', commission_rate: '10', commission_fixed: '', bio: '' });
        fetchAffiliates();
      } else {
        showToast(data.error || '添加失败', false);
      }
    } catch { showToast('网络错误', false); }
    finally { setAddLoading(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setEditLoading(true);
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: selected.id, ...editForm }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('更新成功', true);
        setModal(null);
        fetchAffiliates();
      } else {
        showToast(data.error || '更新失败', false);
      }
    } catch { showToast('网络错误', false); }
    finally { setEditLoading(false); }
  };

  const handleSettle = async () => {
    if (!selected) return;
    const amount = Number(settleAmount);
    if (!amount || amount <= 0) { showToast('请输入正确的结算金额', false); return; }
    setSettleLoading(true);
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: selected.id, action: 'settle', settle_amount: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `已结算 ¥${amount.toFixed(2)}`, true);
        setModal(null);
        setSettleAmount('');
        fetchAffiliates();
        fetchDetail(selected.id);
      } else {
        showToast(data.error || '结算失败', false);
      }
    } catch { showToast('网络错误', false); }
    finally { setSettleLoading(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/affiliates?id=${selected.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        showToast('已删除', true);
        setModal(null);
        setSelected(null);
        fetchAffiliates();
      } else {
        const data = await res.json();
        showToast(data.error || '删除失败', false);
      }
    } catch { showToast('网络错误', false); }
    finally { setDeleteLoading(false); }
  };

  const exportCSV = () => {
    const headers = ['姓名', '合伙人ID', '微信号', '邮箱', '邀请码', '佣金模式', '佣金比例', '固定金额', '状态', '引流用户', '转化数', '累计佣金', '待结算', '已提现', '申请时间'];
    const rows = filtered.map(a => [
      a.name, a.partner_id, a.wechat_id, a.email || '', a.referral_code,
      COMMISSION_TYPE_LABEL[a.commission_type] || a.commission_type,
      a.commission_type === 'percentage' ? `${a.commission_rate}%` : '',
      a.commission_type === 'fixed' ? `¥${a.commission_fixed}` : '',
      STATUS_LABEL[a.status] || a.status,
      a.total_referrals, a.total_conversions,
      `¥${fmt(a.total_commission)}`, `¥${fmt(a.pending_commission)}`, `¥${fmt(a.withdrawn_commission)}`,
      fmtDate(a.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `合伙人列表_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (a: Affiliate) => { setSelected(a); fetchDetail(a.id); setDetailTab('info'); setModal('detail'); };
  const openEdit = (a: Affiliate) => {
    setSelected(a);
    setEditForm({
      name: a.name, wechat_id: a.wechat_id, email: a.email || '',
      commission_type: a.commission_type, commission_rate: String(a.commission_rate),
      commission_fixed: String(a.commission_fixed), bio: a.bio || '',
    });
    setModal('edit');
  };
  const openSettle = (a: Affiliate) => { setSelected(a); setSettleAmount(fmt(a.pending_commission)); setModal('settle'); };
  const openDelete = (a: Affiliate) => { setSelected(a); setModal('delete'); };

  const filtered = affiliates.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.wechat_id.toLowerCase().includes(q) || a.referral_code.toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    all: affiliates.length,
    pending: affiliates.filter(a => a.status === 'pending').length,
    active: affiliates.filter(a => a.status === 'active').length,
    referrals: affiliates.reduce((s, a) => s + (a.total_referrals ?? 0), 0),
    conversions: affiliates.reduce((s, a) => s + (a.total_conversions ?? 0), 0),
    commission: affiliates.reduce((s, a) => s + Number(a.total_commission ?? 0), 0),
    pendingComm: affiliates.reduce((s, a) => s + Number(a.pending_commission ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
              toast.ok ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="sticky top-0 z-10 glass border-b border-border-subtle">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-text-secondary hover:text-text-primary flex-shrink-0">← 管理后台</Link>
          <div className="w-px h-5 bg-border-subtle flex-shrink-0" />
          <h1 className="font-display font-semibold flex-shrink-0">合伙人管理</h1>
          <button onClick={fetchAffiliates} className="ml-auto flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary flex-shrink-0">
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-1.5 text-sm bg-prism-blue/20 hover:bg-prism-blue/30 text-prism-blue border border-prism-blue/30 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            添加合伙人
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: '合伙人总数', value: totals.all, sub: `${totals.pending} 待审核`, icon: Users, color: 'prism-blue' },
            { label: '已激活', value: totals.active, sub: '正常推广中', icon: CheckCircle2, color: 'green-500' },
            { label: '引流用户', value: totals.referrals, sub: '总注册数', icon: TrendingUp, color: 'prism-purple' },
            { label: '成功转化', value: totals.conversions, sub: '付费用户', icon: BarChart3, color: 'amber-500' },
            { label: '累计佣金', value: `¥${fmt(totals.commission)}`, sub: '已入账', icon: Wallet, color: 'green-500' },
            { label: '待结算', value: `¥${fmt(totals.pendingComm)}`, sub: '应付未付', icon: Banknote, color: 'amber-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border-subtle bg-bg-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-muted">{s.label}</p>
                <s.icon className={`w-4 h-4 text-${s.color}`} />
              </div>
              <p className={`text-xl font-bold text-${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索姓名/微信号/邀请码" autoComplete="off"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'pending', 'active', 'paused', 'rejected'] as StatusFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                  : 'text-text-muted border border-border-subtle hover:text-text-primary'
              }`}>
                {f === 'all' ? '全部' : STATUS_LABEL[f] || f}
                {f !== 'all' && (f === 'pending' ? totals.pending : f === 'active' ? totals.active : affiliates.filter(a => a.status === f).length) > 0 && (
                  <span className="ml-1 opacity-60">({f === 'pending' ? totals.pending : f === 'active' ? totals.active : affiliates.filter(a => a.status === f).length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted text-sm">暂无数据</div>
        ) : (
          <div className="rounded-2xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated border-b border-border-subtle">
                <tr className="text-xs text-text-muted">
                  <th className="text-left px-4 py-3">合伙人</th>
                  <th className="text-left px-4 py-3">邀请码</th>
                  <th className="text-center px-4 py-3">引流</th>
                  <th className="text-center px-4 py-3">转化</th>
                  <th className="text-right px-4 py-3">累计佣金</th>
                  <th className="text-right px-4 py-3">待结算</th>
                  <th className="text-center px-4 py-3">状态</th>
                  <th className="text-center px-4 py-3">申请时间</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/50">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-medium text-text-primary">{a.name}</p>
                        <p className="text-xs text-text-muted font-mono">{a.wechat_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono bg-bg-surface px-2 py-1 rounded-lg">{a.referral_code}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-text-secondary">{a.total_referrals}</td>
                    <td className="px-4 py-3.5 text-center text-text-secondary">{a.total_conversions}</td>
                    <td className="px-4 py-3.5 text-right text-green-400 font-medium">¥{fmt(a.total_commission)}</td>
                    <td className="px-4 py-3.5 text-right text-amber-400">¥{fmt(a.pending_commission)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_CLASS[a.status] || 'bg-gray-500/15 text-gray-400'}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-text-muted">{fmtDate(a.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDetail(a)} className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors" title="查看详情">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(a)} className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-prism-blue transition-colors" title="编辑资料">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {a.status === 'pending' && (
                          <button onClick={() => handleAction(a.id, 'approve')} disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-green-500/15 hover:bg-green-500/25 flex items-center justify-center text-green-400 transition-colors disabled:opacity-50" title="批准">
                            {actionLoading === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {a.status === 'pending' && (
                          <button onClick={() => handleAction(a.id, 'reject')} disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/25 flex items-center justify-center text-red-400 transition-colors disabled:opacity-50" title="拒绝">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {a.status === 'active' && Number(a.pending_commission) > 0 && (
                          <button onClick={() => openSettle(a)} className="w-7 h-7 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 flex items-center justify-center text-amber-400 transition-colors" title="结算佣金">
                            <Banknote className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {a.status === 'active' && (
                          <button onClick={() => handleAction(a.id, 'pause')} disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-red-400 transition-colors disabled:opacity-50" title="暂停">
                            <TrendingDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(a.status === 'paused' || a.status === 'rejected') && (
                          <button onClick={() => handleAction(a.id, 'activate')} disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-green-400 transition-colors disabled:opacity-50" title="重新激活">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => openDelete(a)} className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-red-500/15 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors" title="删除">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ADD MODAL ── */}
      <AnimatePresence>
        {modal === 'add' && (
          <Modal onClose={() => setModal(null)} title="添加合伙人">
            <div className="space-y-4">
              <FormField label="姓名/昵称" required>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="你的名字或昵称" className={inputCls} />
              </FormField>
              <FormField label="微信号" required>
                <input value={addForm.wechat_id} onChange={e => setAddForm(f => ({ ...f, wechat_id: e.target.value }))}
                  placeholder="用于结算佣金" className={inputCls} />
              </FormField>
              <FormField label="邮箱">
                <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="选填" className={inputCls} />
              </FormField>
              <FormField label="佣金模式">
                <div className="flex gap-3">
                  {['percentage', 'fixed'].map(ct => (
                    <label key={ct} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${addForm.commission_type === ct ? 'border-prism-blue bg-prism-blue/5' : 'border-border-subtle'}`}>
                      <input type="radio" name="add_ct" value={ct} checked={addForm.commission_type === ct}
                        onChange={e => setAddForm(f => ({ ...f, commission_type: e.target.value }))} className="accent-prism-blue" />
                      <span className="text-sm text-text-primary">{ct === 'percentage' ? '按比例' : '固定金额'}</span>
                    </label>
                  ))}
                </div>
              </FormField>
              {addForm.commission_type === 'percentage' && (
                <FormField label="佣金比例">
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="100" value={addForm.commission_rate}
                      onChange={e => setAddForm(f => ({ ...f, commission_rate: e.target.value }))} className={`${inputCls} w-24 text-center`} />
                    <span className="text-sm text-text-muted">%</span>
                  </div>
                </FormField>
              )}
              {addForm.commission_type === 'fixed' && (
                <FormField label="固定金额">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-muted">¥</span>
                    <input type="number" min="1" value={addForm.commission_fixed}
                      onChange={e => setAddForm(f => ({ ...f, commission_fixed: e.target.value }))} className={`${inputCls} w-24`} />
                  </div>
                </FormField>
              )}
              <FormField label="自我介绍">
                <textarea value={addForm.bio} onChange={e => setAddForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="选填" rows={2} className={`${inputCls} resize-none`} />
              </FormField>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm text-text-secondary hover:bg-bg-surface">取消</button>
                <button onClick={handleAdd} disabled={addLoading}
                  className="flex-1 py-2.5 rounded-xl bg-prism-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {addLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {addLoading ? '添加中...' : '添加并激活'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {modal === 'detail' && selected && (
          <Modal onClose={() => { setModal(null); setSelected(null); }} title={selected.name} wide>
            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-border-subtle">
              {[
                { id: 'info' as const, label: '基本信息' },
                { id: 'conversions' as const, label: `转化明细 (${selected.conversions?.length ?? '—'})` },
                { id: 'referrals' as const, label: `引流记录 (${selected.referrals?.length ?? '—'})` },
              ].map(t => (
                <button key={t.id} onClick={() => setDetailTab(t.id)}
                  className={`px-3 py-2 text-sm border-b-2 transition-colors ${detailTab === t.id ? 'border-prism-blue text-prism-blue' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
            ) : detailTab === 'info' ? (
              <div className="space-y-3 text-sm">
                <InfoRow label="合伙人ID" value={<span className="font-mono text-text-secondary">{selected.partner_id}</span>} />
                <InfoRow label="微信号" value={<span className="font-mono text-text-secondary">{selected.wechat_id}</span>} />
                <InfoRow label="邮箱" value={selected.email || '—'} />
                <InfoRow label="邀请码">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-prism-blue">{selected.referral_code}</span>
                    <CopyBtn text={selected.referral_code} />
                  </div>
                </InfoRow>
                <InfoRow label="佣金模式" value={COMMISSION_TYPE_LABEL[selected.commission_type] || selected.commission_type} />
                {selected.commission_type === 'percentage' && <InfoRow label="佣金比例" value={`${selected.commission_rate}%`} />}
                {selected.commission_type === 'fixed' && <InfoRow label="固定金额" value={`¥${selected.commission_fixed}`} />}
                <InfoRow label="引流用户" value={String(selected.total_referrals)} />
                <InfoRow label="成功转化" value={String(selected.total_conversions)} />
                <InfoRow label="累计佣金" value={<span className="text-green-400 font-medium">¥{fmt(selected.total_commission)}</span>} />
                <InfoRow label="待结算" value={<span className="text-amber-400">¥{fmt(selected.pending_commission)}</span>} />
                <InfoRow label="已提现" value={<span className="text-text-secondary">¥{fmt(selected.withdrawn_commission)}</span>} />
                <InfoRow label="状态">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_CLASS[selected.status] || ''}`}>
                    {STATUS_LABEL[selected.status] || selected.status}
                  </span>
                </InfoRow>
                <InfoRow label="申请时间" value={fmtDateTime(selected.created_at)} />
                {selected.updated_at && <InfoRow label="更新时间" value={fmtDateTime(selected.updated_at)} />}
                {selected.bio && <div className="border-t border-border-subtle pt-3"><p className="text-xs text-text-muted mb-1">自我介绍</p><p className="text-sm text-text-secondary">{selected.bio}</p></div>}
                <div className="border-t border-border-subtle pt-3">
                  <p className="text-xs text-text-muted mb-2">推广链接</p>
                  <div className="flex items-center gap-2 bg-bg-surface rounded-lg px-3 py-2">
                    <code className="flex-1 text-xs text-prism-blue truncate">https://prismatic.zxqconsulting.com/?ref={selected.referral_code}</code>
                    <CopyBtn text={`https://prismatic.zxqconsulting.com/?ref=${selected.referral_code}`} />
                    <a href={`https://prismatic.zxqconsulting.com/?ref=${selected.referral_code}`} target="_blank" rel="noopener noreferrer"
                      className="text-text-muted hover:text-prism-blue"><ExternalLink className="w-3.5 h-3.5" /></a>
                  </div>
                </div>
              </div>
            ) : detailTab === 'conversions' ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {(selected.conversions ?? []).length === 0 ? (
                  <p className="text-center text-text-muted text-sm py-8">暂无转化记录</p>
                ) : selected.conversions?.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-border-subtle bg-bg-surface">
                    <div>
                      <p className="text-sm text-text-primary">{c.plan || '未知方案'}</p>
                      <p className="text-xs text-text-muted">{fmtDateTime(c.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-text-primary">¥{c.amount}</p>
                      <p className="text-xs text-green-400">+¥{fmt(c.commission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {(selected.referrals ?? []).length === 0 ? (
                  <p className="text-center text-text-muted text-sm py-8">暂无引流记录</p>
                ) : selected.referrals?.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border-subtle bg-bg-surface">
                    <div>
                      <p className="text-sm text-text-primary font-mono">{r.user_id.slice(0, 12)}...</p>
                      <p className="text-xs text-text-muted">{fmtDateTime(r.referred_at)}</p>
                    </div>
                    <span className="text-xs text-text-muted">{r.referral_code}</span>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* ── EDIT MODAL ── */}
      <AnimatePresence>
        {modal === 'edit' && selected && (
          <Modal onClose={() => setModal(null)} title="编辑合伙人资料">
            <div className="space-y-4">
              <FormField label="姓名/昵称" required>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="微信号" required>
                <input value={editForm.wechat_id} onChange={e => setEditForm(f => ({ ...f, wechat_id: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="邮箱">
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </FormField>
              <FormField label="佣金模式">
                <div className="flex gap-3">
                  {['percentage', 'fixed'].map(ct => (
                    <label key={ct} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${editForm.commission_type === ct ? 'border-prism-blue bg-prism-blue/5' : 'border-border-subtle'}`}>
                      <input type="radio" name="edit_ct" value={ct} checked={editForm.commission_type === ct}
                        onChange={e => setEditForm(f => ({ ...f, commission_type: e.target.value }))} className="accent-prism-blue" />
                      <span className="text-sm text-text-primary">{ct === 'percentage' ? '按比例' : '固定金额'}</span>
                    </label>
                  ))}
                </div>
              </FormField>
              {editForm.commission_type === 'percentage' && (
                <FormField label="佣金比例">
                  <div className="flex items-center gap-2">
                    <input type="number" min="0.1" max="100" step="0.1" value={editForm.commission_rate}
                      onChange={e => setEditForm(f => ({ ...f, commission_rate: e.target.value }))} className={`${inputCls} w-24 text-center`} />
                    <span className="text-sm text-text-muted">%</span>
                  </div>
                </FormField>
              )}
              {editForm.commission_type === 'fixed' && (
                <FormField label="固定金额">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-muted">¥</span>
                    <input type="number" min="0" step="0.01" value={editForm.commission_fixed}
                      onChange={e => setEditForm(f => ({ ...f, commission_fixed: e.target.value }))} className={`${inputCls} w-24`} />
                  </div>
                </FormField>
              )}
              <FormField label="自我介绍">
                <textarea value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </FormField>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm text-text-secondary hover:bg-bg-surface">取消</button>
                <button onClick={handleEdit} disabled={editLoading}
                  className="flex-1 py-2.5 rounded-xl bg-prism-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editLoading ? '保存中...' : '保存修改'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── SETTLE MODAL ── */}
      <AnimatePresence>
        {modal === 'settle' && selected && (
          <Modal onClose={() => setModal(null)} title="结算佣金">
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">当前待结算</span>
                  <span className="text-amber-400 font-medium">¥{fmt(selected.pending_commission)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">已提现</span>
                  <span className="text-text-secondary">¥{fmt(selected.withdrawn_commission)}</span>
                </div>
              </div>
              <FormField label="本次结算金额" required>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">¥</span>
                  <input type="number" min="0.01" step="0.01" value={settleAmount}
                    onChange={e => setSettleAmount(e.target.value)}
                    placeholder={fmt(selected.pending_commission)} className={`${inputCls} w-32 text-center`} />
                  <button onClick={() => setSettleAmount(fmt(selected.pending_commission))} className="text-xs text-prism-blue hover:underline">全部结算</button>
                </div>
              </FormField>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
                结算后，资金将从待结算转入已提现，合伙人可在后台查看
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm text-text-secondary hover:bg-bg-surface">取消</button>
                <button onClick={handleSettle} disabled={settleLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {settleLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {settleLoading ? '结算中...' : '确认结算'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── DELETE MODAL ── */}
      <AnimatePresence>
        {modal === 'delete' && selected && (
          <Modal onClose={() => setModal(null)} title="确认删除合伙人">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium mb-1">删除后无法恢复</p>
                  <p className="text-text-muted">
                    将同时删除该合伙人的所有转化记录和引流记录，此操作不可撤销。
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">姓名</span><span className="text-text-primary">{selected.name}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">微信号</span><span className="text-text-primary font-mono">{selected.wechat_id}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">邀请码</span><span className="text-text-primary font-mono">{selected.referral_code}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">累计佣金</span><span className="text-green-400">¥{fmt(selected.total_commission)}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border-subtle text-sm text-text-secondary hover:bg-bg-surface">取消</button>
                <button onClick={handleDelete} disabled={deleteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleteLoading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared components ──────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue';

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{children ?? value}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-text-muted hover:text-prism-blue transition-colors" title="复制">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-border-subtle bg-bg-elevated p-6`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-medium text-text-primary">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-overlay flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
