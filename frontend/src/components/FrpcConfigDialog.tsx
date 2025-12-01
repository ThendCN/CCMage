import React, { useState, useEffect } from 'react';
import { X, Wifi, WifiOff, Globe, Lock, Settings as SettingsIcon, ExternalLink, Copy, Check } from 'lucide-react';

interface FrpcConfig {
  enabled: boolean;
  frontend_enabled: boolean;
  frontend_subdomain: string;
  frontend_custom_domain: string;
  frontend_remote_port: number | null;
  backend_enabled: boolean;
  backend_subdomain: string;
  backend_custom_domain: string;
  backend_remote_port: number | null;
  protocol: 'http' | 'https' | 'tcp';
  use_encryption: boolean;
  use_compression: boolean;
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

interface FrpcStatus {
  running: boolean;
  pid?: number;
  startedAt?: string;
  urls?: Array<{ type: string; url: string }>;
}

interface Props {
  projectName: string;
  frontendPort?: number;
  backendPort?: number;
  onClose: () => void;
}

export default function FrpcConfigDialog({ projectName, frontendPort, backendPort, onClose }: Props) {
  const [config, setConfig] = useState<FrpcConfig>({
    enabled: false,
    frontend_enabled: false,
    frontend_subdomain: '',
    frontend_custom_domain: '',
    frontend_remote_port: null,
    backend_enabled: false,
    backend_subdomain: '',
    backend_custom_domain: '',
    backend_remote_port: null,
    protocol: 'http',
    use_encryption: false,
    use_compression: false
  });

  const [frpsConfig, setFrpsConfig] = useState<FrpsConfig | null>(null);
  const [status, setStatus] = useState<FrpcStatus>({ running: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadFrpsConfig();
    loadStatus();
  }, [projectName]);

  const loadConfig = async () => {
    try {
      const res = await fetch(`/api/projects/${projectName}/frpc/config`);
      const data = await res.json();
      if (data.success && data.data) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error('加载 frpc 配置失败:', error);
    }
  };

  const loadFrpsConfig = async () => {
    try {
      const res = await fetch('/api/frps/config');
      const data = await res.json();
      if (data.success) {
        setFrpsConfig(data.data);
      }
    } catch (error) {
      console.error('加载 frps 配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/projects/${projectName}/frpc/status`);
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('加载运行状态失败:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectName}/frpc/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await res.json();
      if (data.success) {
        alert('配置已保存');
        onClose();
      } else {
        alert(`保存失败: ${data.error}`);
      }
    } catch (error) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFrpc = async () => {
    try {
      const endpoint = status.running ? 'stop' : 'start';
      const res = await fetch(`/api/projects/${projectName}/frpc/${endpoint}`, {
        method: 'POST'
      });

      const data = await res.json();
      if (data.success) {
        await loadStatus();
      } else {
        alert(`操作失败: ${data.error}`);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{ color: 'white' }}>加载中...</div>
      </div>
    );
  }

  if (!frpsConfig) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <SettingsIcon size={48} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 12px', fontSize: '20px' }}>未配置 frps 服务器</h3>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            请先在系统设置中配置 frps 服务器地址和认证信息
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
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
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Globe size={24} color="#3b82f6" />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>内网穿透配置</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                {projectName}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px'
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* 运行状态 */}
          {status.running && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Wifi size={18} color="#10b981" />
                <strong style={{ color: '#065f46' }}>运行中 (PID: {status.pid})</strong>
              </div>
              {status.urls && status.urls.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>访问地址：</div>
                  {status.urls.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      background: 'white',
                      borderRadius: '6px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '4px'
                      }}>
                        {item.type}
                      </span>
                      <code style={{ flex: 1, fontSize: '13px', color: '#374151' }}>
                        {item.url}
                      </code>
                      <button
                        onClick={() => window.open(`http://${item.url}`, '_blank')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#3b82f6',
                          padding: '4px'
                        }}
                      >
                        <ExternalLink size={16} />
                      </button>
                      <button
                        onClick={() => copyUrl(item.url)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: copiedUrl === item.url ? '#10b981' : '#6b7280',
                          padding: '4px'
                        }}
                      >
                        {copiedUrl === item.url ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 启用开关 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <div>
              <strong>启用内网穿透</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                将本地服务暴露到公网
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
          </div>

          {config.enabled && (
            <>
              {/* 协议选择 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  协议类型
                </label>
                <select
                  value={config.protocol}
                  onChange={(e) => setConfig({ ...config, protocol: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="tcp">TCP</option>
                </select>
              </div>

              {/* 前端配置 */}
              {frontendPort && (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <strong>前端穿透 (端口 {frontendPort})</strong>
                    <input
                      type="checkbox"
                      checked={config.frontend_enabled}
                      onChange={(e) => setConfig({ ...config, frontend_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                  </div>

                  {config.frontend_enabled && (
                    <>
                      {config.protocol !== 'tcp' ? (
                        <>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              子域名
                            </label>
                            <input
                              type="text"
                              value={config.frontend_subdomain}
                              onChange={(e) => setConfig({ ...config, frontend_subdomain: e.target.value })}
                              placeholder="myapp"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                              访问地址: {config.protocol}://{config.frontend_subdomain || 'myapp'}.{frpsConfig.server_addr}
                            </p>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              自定义域名（可选）
                            </label>
                            <input
                              type="text"
                              value={config.frontend_custom_domain}
                              onChange={(e) => setConfig({ ...config, frontend_custom_domain: e.target.value })}
                              placeholder="app.example.com"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            远程端口
                          </label>
                          <input
                            type="number"
                            value={config.frontend_remote_port || ''}
                            onChange={(e) => setConfig({ ...config, frontend_remote_port: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="8080"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 后端配置 */}
              {backendPort && (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <strong>后端穿透 (端口 {backendPort})</strong>
                    <input
                      type="checkbox"
                      checked={config.backend_enabled}
                      onChange={(e) => setConfig({ ...config, backend_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                  </div>

                  {config.backend_enabled && (
                    <>
                      {config.protocol !== 'tcp' ? (
                        <>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              子域名
                            </label>
                            <input
                              type="text"
                              value={config.backend_subdomain}
                              onChange={(e) => setConfig({ ...config, backend_subdomain: e.target.value })}
                              placeholder="api"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                              访问地址: {config.protocol}://{config.backend_subdomain || 'api'}.{frpsConfig.server_addr}
                            </p>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              自定义域名（可选）
                            </label>
                            <input
                              type="text"
                              value={config.backend_custom_domain}
                              onChange={(e) => setConfig({ ...config, backend_custom_domain: e.target.value })}
                              placeholder="api.example.com"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            远程端口
                          </label>
                          <input
                            type="number"
                            value={config.backend_remote_port || ''}
                            onChange={(e) => setConfig({ ...config, backend_remote_port: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="3000"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 高级选项 */}
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <strong style={{ display: 'block', marginBottom: '12px' }}>高级选项</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.use_encryption}
                    onChange={(e) => setConfig({ ...config, use_encryption: e.target.checked })}
                  />
                  <Lock size={16} />
                  <span style={{ fontSize: '14px' }}>启用加密</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.use_compression}
                    onChange={(e) => setConfig({ ...config, use_compression: e.target.checked })}
                  />
                  <span style={{ fontSize: '14px' }}>启用压缩</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          {config.enabled && (
            <button
              onClick={handleToggleFrpc}
              style={{
                padding: '10px 20px',
                background: status.running ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {status.running ? <WifiOff size={16} /> : <Wifi size={16} />}
              {status.running ? '停止穿透' : '启动穿透'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
