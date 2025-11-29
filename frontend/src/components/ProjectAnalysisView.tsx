import { ProjectAnalysis } from '../types';
import { Server, Terminal, Package, Settings, Database, AlertCircle } from 'lucide-react';

interface Props {
  analysis: ProjectAnalysis;
}

export default function ProjectAnalysisView({ analysis }: Props) {
  if (!analysis || !analysis.analyzed) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <AlertCircle size={48} style={{ marginBottom: '16px', color: '#d1d5db' }} />
        <p>该项目尚未进行 AI 分析</p>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          点击"AI分析"按钮开始分析项目结构和配置
        </p>
      </div>
    );
  }

  if (analysis.analysis_status === 'failed') {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#ef4444'
      }}>
        <AlertCircle size={48} style={{ marginBottom: '16px', color: '#fca5a5' }} />
        <p>分析失败</p>
        {analysis.analysis_error && (
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            {analysis.analysis_error}
          </p>
        )}
      </div>
    );
  }

  const { dependencies } = analysis;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      maxHeight: '70vh',
      overflowY: 'auto'
    }}>
      {/* 基本信息 */}
      {analysis.description && (
        <Section title="项目描述" icon={<Package size={18} />}>
          <p style={{ color: '#4b5563', lineHeight: '1.6' }}>{analysis.description}</p>
        </Section>
      )}

      {/* 技术栈 */}
      {analysis.tech && analysis.tech.length > 0 && (
        <Section title="技术栈" icon={<Server size={18} />}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {analysis.tech.map(tech => (
              <span key={tech} style={{
                padding: '4px 12px',
                background: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#374151'
              }}>
                {tech}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 运行环境 */}
      {dependencies.runtime && (
        <Section title="运行环境" icon={<Settings size={18} />}>
          <InfoRow label="运行时" value={dependencies.runtime.name} />
          <InfoRow label="版本要求" value={dependencies.runtime.version} />
          <InfoRow label="包管理器" value={dependencies.runtime.packageManager} />
          {dependencies.runtime.systemDependencies && dependencies.runtime.systemDependencies.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>系统依赖:</span>
              <div style={{ marginTop: '4px' }}>
                {dependencies.runtime.systemDependencies.map((dep, idx) => (
                  <div key={idx} style={{ fontSize: '14px', color: '#4b5563', marginLeft: '12px' }}>
                    • {dep}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 启动命令 */}
      {dependencies.startCommands && (
        <Section title="启动命令" icon={<Terminal size={18} />}>
          {dependencies.startCommands.install && (
            <CommandRow label="安装依赖" command={dependencies.startCommands.install} />
          )}
          {dependencies.startCommands.dev && (
            <CommandRow label="开发模式" command={dependencies.startCommands.dev} />
          )}
          {dependencies.startCommands.build && (
            <CommandRow label="构建项目" command={dependencies.startCommands.build} />
          )}
          {dependencies.startCommands.prod && (
            <CommandRow label="生产运行" command={dependencies.startCommands.prod} />
          )}
        </Section>
      )}

      {/* 端口配置 */}
      {dependencies.port && (
        <Section title="端口配置" icon={<Server size={18} />}>
          <InfoRow label="默认端口" value={dependencies.port.default.toString()} />
          {dependencies.port.envVar && (
            <InfoRow label="环境变量" value={dependencies.port.envVar} />
          )}
          {dependencies.port.configFile && (
            <InfoRow label="配置文件" value={dependencies.port.configFile} />
          )}
        </Section>
      )}

      {/* 环境变量 */}
      {dependencies.environmentVariables && dependencies.environmentVariables.length > 0 && (
        <Section title="环境变量" icon={<Settings size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dependencies.environmentVariables.map((env, idx) => (
              <div key={idx} style={{
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {env.name}
                  </span>
                  {env.required && (
                    <span style={{
                      padding: '2px 6px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      fontSize: '11px',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      必需
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0' }}>
                  {env.description}
                </p>
                {env.default && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    默认值: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px' }}>
                      {env.default}
                    </code>
                  </div>
                )}
                {env.example && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    示例: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px' }}>
                      {env.example}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 服务依赖 */}
      {dependencies.services && dependencies.services.length > 0 && (
        <Section title="服务依赖" icon={<Database size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dependencies.services.map((service, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {service.name}
                </span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    端口: {service.port}
                  </span>
                  {service.required && (
                    <span style={{
                      padding: '2px 6px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      fontSize: '11px',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      必需
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 架构说明 */}
      {analysis.architecture_notes && (
        <Section title="架构说明" icon={<Package size={18} />}>
          <p style={{ color: '#4b5563', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {analysis.architecture_notes}
          </p>
        </Section>
      )}

      {/* 主要功能 */}
      {analysis.main_features && analysis.main_features.length > 0 && (
        <Section title="主要功能" icon={<Package size={18} />}>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#4b5563', lineHeight: '1.8' }}>
            {analysis.main_features.map((feature, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{feature}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 代码统计 */}
      <Section title="代码统计" icon={<Package size={18} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {analysis.file_count && (
            <StatCard label="文件数量" value={analysis.file_count.toLocaleString()} />
          )}
          {analysis.loc && (
            <StatCard label="代码行数" value={analysis.loc.toLocaleString()} />
          )}
        </div>
      </Section>

      {/* 分析时间 */}
      {analysis.analyzed_at && (
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          textAlign: 'center',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb'
        }}>
          分析时间: {new Date(analysis.analyzed_at).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '2px solid #f3f4f6'
      }}>
        <div style={{ color: '#3b82f6' }}>{icon}</div>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }}>
      <span style={{ fontSize: '14px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{value}</span>
    </div>
  );
}

function CommandRow({ label, command }: { label: string; command: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <code style={{
        display: 'block',
        padding: '8px 12px',
        background: '#1f2937',
        color: '#10b981',
        borderRadius: '6px',
        fontSize: '13px',
        fontFamily: 'Monaco, Consolas, monospace'
      }}>
        {command}
      </code>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '12px',
      background: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>
        {label}
      </div>
    </div>
  );
}
