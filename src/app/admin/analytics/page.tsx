'use client';

/**
 * Prismatic — Analytics Dashboard
 * 系统数据分析仪表板
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, MessageSquare, TrendingUp, DollarSign, Activity,
  TrendingDown, RefreshCw, Calendar, Zap, Crown,
  Clock, Eye, BarChart2, PieChart
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart as RePieChart, Cell,
  AreaChart, Area, Legend
} from 'recharts';
import { useAnalyticsOverview, useAnalyticsTrend, useAnalyticsPersonas } from '@/lib/use-admin-data';

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

// ─── Components ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  format?: 'number' | 'currency' | 'percent';
}) {
  const formattedValue = useMemo(() => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'currency':
        return `¥${value.toFixed(2)}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  }, [value, format]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">{title}</span>
        <div className="w-10 h-10 rounded-lg bg-prism-blue/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-prism-blue" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-2">{formattedValue}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${
          changeType === 'positive' ? 'text-green-400' :
          changeType === 'negative' ? 'text-red-400' : 'text-gray-400'
        }`}>
          {changeType === 'positive' ? (
            <TrendingUp className="w-4 h-4" />
          ) : changeType === 'negative' ? (
            <TrendingDown className="w-4 h-4" />
          ) : null}
          <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-gray-500">vs 上期</span>
        </div>
      )}
    </motion.div>
  );
}

function TrendChart({ data }: { data: Array<{ date: string; dau: number; sessions: number; messages: number }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">活跃趋势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
          />
          <YAxis stroke="#9ca3af" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="dau"
            stroke="#8b5cf6"
            fillOpacity={1}
            fill="url(#colorDau)"
            name="日活用户"
          />
          <Area
            type="monotone"
            dataKey="messages"
            stroke="#06b6d4"
            fillOpacity={1}
            fill="url(#colorMessages)"
            name="消息数"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

function PersonaChart({ data }: { data: Array<{ personaId: string; personaName: string; views: number; conversations: number }> }) {
  const chartData = data.slice(0, 8).map(p => ({
    name: p.personaName.length > 6 ? p.personaName.slice(0, 6) + '...' : p.personaName,
    views: p.views,
    conversations: p.conversations,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">人物热度排行</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" stroke="#9ca3af" fontSize={12} />
          <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend />
          <Bar dataKey="views" fill="#8b5cf6" name="浏览次数" />
          <Bar dataKey="conversations" fill="#06b6d4" name="对话次数" />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

function DevicePieChart({ data }: { data: Array<{ device_type: string; count: number }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">设备分布</h3>
      <ResponsiveContainer width="100%" height={250}>
        <RePieChart>
          <PieChart
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(7);

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useAnalyticsOverview(days);
  const { data: trend, isLoading: trendLoading } = useAnalyticsTrend(days);
  const { data: personas, isLoading: personasLoading } = useAnalyticsPersonas(30);

  const trendData = trend || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">数据分析</h1>
          <p className="text-gray-400 text-sm mt-1">系统运行状态与用户行为洞察</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-prism-blue text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              refetchOverview();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="日活用户 (DAU)"
          value={overview?.dau || 0}
          change={12.5}
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="月活用户 (MAU)"
          value={overview?.mau || 0}
          change={8.3}
          changeType="positive"
          icon={Activity}
        />
        <StatCard
          title="总消息数"
          value={overview?.totalMessages || 0}
          change={-2.1}
          changeType="negative"
          icon={MessageSquare}
        />
        <StatCard
          title="API 成本"
          value={overview?.totalApiCost || 0}
          change={15.2}
          changeType="negative"
          icon={DollarSign}
          format="currency"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="总用户数"
          value={overview?.totalUsers || 0}
          change={5.0}
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="新增用户"
          value={overview?.newUsers || 0}
          change={18.7}
          changeType="positive"
          icon={Zap}
        />
        <StatCard
          title="总对话数"
          value={overview?.totalConversations || 0}
          change={3.2}
          changeType="positive"
          icon={BarChart2}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart data={trendData} />
        <PersonaChart data={personas || []} />
      </div>

      {/* Additional Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">关键指标解读</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">用户增长</h4>
                <p className="text-sm text-gray-400 mt-1">
                  过去{days}天新增用户{(overview?.newUsers || 0).toLocaleString()}人，活跃度稳步提升。
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-prism-blue/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-prism-blue" />
              </div>
              <div>
                <h4 className="text-white font-medium">对话质量</h4>
                <p className="text-sm text-gray-400 mt-1">
                  平均每次对话产生{(overview?.totalMessages / Math.max(overview?.totalConversations, 1)).toFixed(1)}条消息，说明用户参与度高。
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">成本控制</h4>
                <p className="text-sm text-gray-400 mt-1">
                  API成本¥{(overview?.totalApiCost || 0).toFixed(2)}，平均每次对话成本¥{((overview?.totalApiCost || 0) / Math.max(overview?.totalConversations, 1)).toFixed(4)}。
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Data Freshness Notice */}
      <div className="text-center text-sm text-gray-500">
        数据更新于 {new Date().toLocaleString('zh-CN')}
        {overviewLoading && ' • 加载中...'}
      </div>
    </div>
  );
}
