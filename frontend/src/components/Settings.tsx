import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, ExternalLink, Info, Download, FolderOpen, Cpu, CheckCircle, XCircle, Globe, Server } from 'lucide-react';
import { getAvailableEngines, checkEngineAvailable } from '../api';
import type { AIEngine, AIEngineInfo } from '../types';

interface AppConfig {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  DEFAULT_AI_ENGINE: AIEngine;
  PROJECT_ROOT: string;
}

interface FrpsConfig {
  server_addr: string;
  server_port: number;
  auth_token: string;
  protocol: string;
  use_encryption: boolean;
  use_compression: boolean;
  tcp_mux: boolean;
  pool_count: number;
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AppConfig>({
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_BASE_URL: 'https://api.husanai.com',
    OPENAI_API_KEY: '',
    OPENAI_BASE_URL: 'https://api.openai.com',
    DEFAULT_AI_ENGINE: 'claude-code',
    PROJECT_ROOT: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availableEngines, setAvailableEngines] = useState<AIEngineInfo[]>([]);
  const [engineStatus, setEngineStatus] = useState<Record<string, boolean>>({});
  const [checkingEngines, setCheckingEngines] = useState(false);
  const [frpsConfig, setFrpsConfig] = useState<FrpsConfig>({
    server_addr: '',
    server_port: 7000,
    auth_token: '',
    protocol: 'tcp',
    use_encryption: false,
    use_compression: false,
    tcp_mux: true,
    pool_count: 1
  });
  const [frpsConfigLoaded, setFrpsConfigLoaded] = useState(false);

  useEffect(() => {
    loadConfig();
    loadEngines();
    loadFrpsConfig();
  }, []);

  const loadEngines = async () => {
    try {
      const engines = await getAvailableEngines();
      setAvailableEngines(engines);
    } catch (error) {
      console.error('加载引擎列表失败:', error);
    }
  };

  const checkAllEngines = async () => {
    setCheckingEngines(true);
    const status: Record<string, boolean> = {};
    for (const engine of availableEngines) {
      const available = await checkEngineAvailable(engine.name);
      status[engine.name] = available;
    }
    setEngineStatus(status);
    setCheckingEngines(false);
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:9999/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('http://localhost:9999/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '配置保存成功！' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || '保存失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存配置失败' });
    } finally {
      setSaving(false);
    }
  };

  const loadFrpsConfig = async () => {
    try {
      const response = await fetch('http://localhost:9999/api/frps/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setFrpsConfig(data.data);
        }
        setFrpsConfigLoaded(true);
      }
    } catch (error) {
      console.error('加载 frps 配置失败:', error);
      setFrpsConfigLoaded(true);
    }
  };

  const saveFrpsConfig = async () => {
    try {
      const response = await fetch('http://localhost:9999/api/frps/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frpsConfig)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Frps 配置保存成功！' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || 'Frps 配置保存失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存 Frps 配置失败' });
    }
  };

  const handleChange = (field: keyof AppConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleExportConfig = async () => {
    setExporting(true);
    try {
      const response = await fetch('http://localhost:9999/api/projects/export/download');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `projects-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: '配置导出成功！' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: '导出失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '导出配置失败' });
    } finally {
      setExporting(false);
    }
  };

  const handleSelectFolder = async () => {
    setSelectingFolder(true);
    setMessage(null);
    try {
      const response = await fetch('http://localhost:9999/api/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.path) {
          setConfig(prev => ({ ...prev, PROJECT_ROOT: result.path }));
          setMessage({ type: 'success', text: '文件夹选择成功！' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage({ type: 'error', text: result.message || '未选择文件夹' });
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || '选择失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '选择文件夹失败' });
    } finally {
      setSelectingFolder(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <RefreshCw className="animate-spin" size={24} color="#3b82f6" />
          <span>加载配置中...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SettingsIcon size={24} color="#3b82f6" />
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>应用配置</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            关闭
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px' }}>
          {/* Info Banner */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            gap: '12px'
          }}>
            <Info size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '14px', color: '#1e40af', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
                🎯 CCMage - 专为 Vibe Coding 开发者打造
              </p>
              <p style={{ margin: '0 0 8px 0' }}>
                CCMage 帮助你高效管理多个本地项目，提供项目状态监控、进程管理和 AI 辅助功能。
              </p>
              <p style={{ margin: 0 }}>
                配置 API Key 后，可以使用 AI 辅助功能（可选）。
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ANTHROPIC_API_KEY */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                Anthropic API Key (可选)
              </label>
              <input
                type="password"
                value={config.ANTHROPIC_API_KEY}
                onChange={(e) => handleChange('ANTHROPIC_API_KEY', e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                用于启用 AI 辅助功能（可选）。如果没有 API Key，可以到
                <a
                  href="https://api.husanai.com/register?aff=c34V"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'none',
                    margin: '0 4px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  虎三小破站 <ExternalLink size={12} />
                </a>
                申请。
              </div>
            </div>

            {/* ANTHROPIC_BASE_URL */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                API 基础地址
              </label>
              <input
                type="text"
                value={config.ANTHROPIC_BASE_URL}
                onChange={(e) => handleChange('ANTHROPIC_BASE_URL', e.target.value)}
                placeholder="https://api.husanai.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                Anthropic API 的基础 URL，默认使用虎三小破站的代理地址
              </div>
            </div>

            {/* OPENAI_API_KEY */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                OpenAI API Key (可选)
              </label>
              <input
                type="password"
                value={config.OPENAI_API_KEY}
                onChange={(e) => handleChange('OPENAI_API_KEY', e.target.value)}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                用于 Codex AI 引擎（可选）
              </div>
            </div>

            {/* OPENAI_BASE_URL */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                OpenAI API 基础地址
              </label>
              <input
                type="text"
                value={config.OPENAI_BASE_URL}
                onChange={(e) => handleChange('OPENAI_BASE_URL', e.target.value)}
                placeholder="https://api.openai.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                OpenAI API 的基础 URL
              </div>
            </div>

            {/* DEFAULT_AI_ENGINE */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                默认 AI 引擎
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}>
                  <Cpu size={16} color="#6b7280" />
                  <select
                    value={config.DEFAULT_AI_ENGINE}
                    onChange={(e) => handleChange('DEFAULT_AI_ENGINE', e.target.value as AIEngine)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {availableEngines.map((engine) => (
                      <option key={engine.name} value={engine.name}>
                        {engine.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={checkAllEngines}
                  disabled={checkingEngines}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    background: checkingEngines ? '#9ca3af' : '#10b981',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: checkingEngines ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {checkingEngines ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      检查中...
                    </>
                  ) : (
                    <>
                      <Cpu size={16} />
                      检查引擎
                    </>
                  )}
                </button>
              </div>
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                选择默认使用的 AI 引擎
              </div>

              {/* Engine Status Display */}
              {Object.keys(engineStatus).length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    引擎状态
                  </div>
                  {availableEngines.map((engine) => (
                    <div
                      key={engine.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0',
                        fontSize: '13px'
                      }}
                    >
                      {engineStatus[engine.name] ? (
                        <CheckCircle size={16} color="#10b981" />
                      ) : (
                        <XCircle size={16} color="#ef4444" />
                      )}
                      <span style={{ color: '#374151' }}>{engine.displayName}</span>
                      <span style={{
                        marginLeft: 'auto',
                        color: engineStatus[engine.name] ? '#10b981' : '#ef4444',
                        fontWeight: '500'
                      }}>
                        {engineStatus[engine.name] ? '可用' : '不可用'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PROJECT_ROOT */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                项目根目录
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={config.PROJECT_ROOT}
                  onChange={(e) => handleChange('PROJECT_ROOT', e.target.value)}
                  placeholder="/Users/username/Projects"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={selectingFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    background: selectingFolder ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: selectingFolder ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FolderOpen size={16} />
                  {selectingFolder ? '选择中...' : '选择'}
                </button>
              </div>
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                项目的根目录路径，留空则使用默认路径（当前目录的上两级）
              </div>
            </div>

            {/* Frps 服务器配置 */}
            <div style={{
              marginTop: '32px',
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Globe size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Frps 服务器配置</h3>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                配置 frps 服务器信息，用于内网穿透功能
              </p>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                    服务器地址 *
                  </label>
                  <input
                    type="text"
                    value={frpsConfig.server_addr}
                    onChange={(e) => setFrpsConfig({ ...frpsConfig, server_addr: e.target.value })}
                    placeholder="frp.example.com"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                      服务器端口
                    </label>
                    <input
                      type="number"
                      value={frpsConfig.server_port}
                      onChange={(e) => setFrpsConfig({ ...frpsConfig, server_port: parseInt(e.target.value) || 7000 })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                      连接池大小
                    </label>
                    <input
                      type="number"
                      value={frpsConfig.pool_count}
                      onChange={(e) => setFrpsConfig({ ...frpsConfig, pool_count: parseInt(e.target.value) || 1 })}
                      min="1"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                    认证 Token（可选）
                  </label>
                  <input
                    type="password"
                    value={frpsConfig.auth_token}
                    onChange={(e) => setFrpsConfig({ ...frpsConfig, auth_token: e.target.value })}
                    placeholder="留空表示不需要认证"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={frpsConfig.use_encryption}
                      onChange={(e) => setFrpsConfig({ ...frpsConfig, use_encryption: e.target.checked })}
                    />
                    <span style={{ fontSize: '14px' }}>启用加密</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={frpsConfig.use_compression}
                      onChange={(e) => setFrpsConfig({ ...frpsConfig, use_compression: e.target.checked })}
                    />
                    <span style={{ fontSize: '14px' }}>启用压缩</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={frpsConfig.tcp_mux}
                      onChange={(e) => setFrpsConfig({ ...frpsConfig, tcp_mux: e.target.checked })}
                    />
                    <span style={{ fontSize: '14px' }}>TCP 多路复用</span>
                  </label>
                </div>

                <button
                  onClick={saveFrpsConfig}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    justifyContent: 'center'
                  }}
                >
                  <Server size={16} />
                  保存 Frps 配置
                </button>
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              marginTop: '24px',
              padding: '12px 16px',
              borderRadius: '6px',
              background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '14px',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`
            }}>
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div style={{
            marginTop: '32px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={handleExportConfig}
              disabled={exporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: exporting ? 'not-allowed' : 'pointer'
              }}
            >
              {exporting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  导出配置
                </>
              )}
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: saving ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    保存配置
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
