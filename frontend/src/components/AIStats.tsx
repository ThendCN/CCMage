import React, { useEffect, useState } from 'react';
import { Activity, DollarSign, MessageSquare, Zap, TrendingUp, Clock } from 'lucide-react';

interface AISession {
  session_id: string;
  project_name: string;
  engine: string;
  model: string;
  status: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  total_cost_formatted: string;
  num_messages: number;
  num_tool_calls: number;
  started_at: string;
  prompt: string;
}

interface AICostSummary {
  total_sessions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost: number;
  total_cost_formatted: string;
  avg_cost: number;
  avg_cost_formatted: string;
  completed_sessions: number;
  failed_sessions: number;
  success_rate: string;
}

interface AIStatsProps {
  projectName: string;
}

export default function AIStats({ projectName }: AIStatsProps) {
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [summary, setSummary] = useState<AICostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAIStats();
  }, [projectName]);

  const fetchAIStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectName}/ai/stats`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.data.sessions || []);
        setSummary(data.data.summary || null);
      } else {
        setError(data.error || '获取 AI 统计失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      console.error('[AIStats] 获取失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Activity className="animate-spin" size={32} style={{ margin: '0 auto', color: '#3b82f6' }} />
        <p style={{ marginTop: '16px', color: '#6b7280' }}>加载 AI 使用统计...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#dc2626'
      }}>
        <p>❌ {error}</p>
        <button
          onClick={fetchAIStats}
          style={{
            marginTop: '12px',
            padding: '6px 12px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <StatCard
            icon={<DollarSign size={20} />}
            label="总费用"
            value={summary.total_cost_formatted || '$0.00'}
            color="#10b981"
          />
          <StatCard
            icon={<Zap size={20} />}
            label="总 Token"
            value={(summary.total_tokens || 0).toLocaleString()}
            color="#3b82f6"
          />
          <StatCard
            icon={<MessageSquare size={20} />}
            label="会话数"
            value={(summary.total_sessions || 0).toString()}
            color="#8b5cf6"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="成功率"
            value={summary.success_rate || '0%'}
            color="#f59e0b"
          />
        </div>
      )}

      {/* Token 分布 */}
      {summary && summary.total_tokens > 0 && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Token 使用分布
          </h4>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
            <TokenBar
              label="输入"
              value={summary.total_input_tokens || 0}
              total={summary.total_tokens || 0}
              color="#3b82f6"
            />
            <TokenBar
              label="输出"
              value={summary.total_output_tokens || 0}
              total={summary.total_tokens || 0}
              color="#10b981"
            />
          </div>
        </div>
      )}

      {/* 会话列表 */}
      <div>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: '16px',
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Clock size={18} />
          最近会话
        </h4>

        {sessions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: '#f9fafb',
            borderRadius: '8px',
            color: '#6b7280'
          }}>
            <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>暂无 AI 使用记录</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((session) => (
              <SessionCard key={session.session_id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color }}>
        {icon}
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
        {value}
      </div>
    </div>
  );
}

// Token 占比条组件
function TokenBar({ label, value, total, color }: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#6b7280' }}>{label}</span>
        <span style={{ fontWeight: '500', color: '#111827' }}>{value.toLocaleString()}</span>
      </div>
      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s'
        }} />
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
}

// 会话卡片组件
function SessionCard({ session }: { session: AISession }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = session.status === 'completed' ? '#10b981' :
                      session.status === 'failed' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px',
      transition: 'box-shadow 0.2s',
      cursor: 'pointer'
    }}
    onClick={() => setExpanded(!expanded)}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              background: statusColor,
              color: 'white',
              borderRadius: '4px',
              fontWeight: '500'
            }}>
              {session.status}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {session.model || session.engine}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}>
            {new Date(session.started_at).toLocaleString('zh-CN')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
            {session.total_cost_formatted || '$0.00'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {(session.total_tokens || 0).toLocaleString()} tokens
          </div>
        </div>
      </div>

      {/* 指标 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        fontSize: '12px'
      }}>
        <Metric label="消息数" value={(session.num_messages || 0).toString()} />
        <Metric label="工具调用" value={(session.num_tool_calls || 0).toString()} />
        <Metric label="耗时" value={`${((session.duration_ms || 0) / 1000).toFixed(1)}s`} />
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '12px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#6b7280', fontWeight: '500' }}>输入:</span>
            <span style={{ marginLeft: '8px', color: '#374151' }}>
              {(session.input_tokens || 0).toLocaleString()} tokens
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#6b7280', fontWeight: '500' }}>输出:</span>
            <span style={{ marginLeft: '8px', color: '#374151' }}>
              {(session.output_tokens || 0).toLocaleString()} tokens
            </span>
          </div>
          {session.prompt && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ color: '#6b7280', fontWeight: '500', marginBottom: '4px' }}>提示词:</div>
              <div style={{
                background: '#f9fafb',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#374151',
                maxHeight: '100px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {session.prompt.length > 200 ? session.prompt.substring(0, 200) + '...' : session.prompt}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 指标组件
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: '#6b7280', fontSize: '11px' }}>{label}</div>
      <div style={{ color: '#111827', fontWeight: '500', marginTop: '2px' }}>{value}</div>
    </div>
  );
}
