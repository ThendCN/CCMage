const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const db = require('./database');

/**
 * Frpc 进程管理器
 * 负责生成配置文件、启动/停止 frpc 进程、管理多个项目的穿透
 */
class FrpcManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // projectName -> { process, config }
    this.configDir = path.join(os.homedir(), '.ccmage', 'frpc');

    // 确保配置目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // 启动时恢复运行中的 frpc
    this.restoreRunningProcesses();
  }

  /**
   * 生成 frpc 配置文件
   * @param {string} projectName - 项目名称
   * @param {Object} project - 项目信息
   * @param {Object} frpcConfig - frpc 配置
   * @param {Object} frpsConfig - frps 服务器配置
   * @returns {string} 配置文件路径
   */
  generateConfig(projectName, project, frpcConfig, frpsConfig) {
    if (!frpsConfig || !frpsConfig.server_addr) {
      throw new Error('未配置 frps 服务器地址');
    }

    const configPath = path.join(this.configDir, `${projectName}.ini`);
    let config = `# Frpc 配置 - ${projectName}
# 自动生成，请勿手动修改

[common]
server_addr = ${frpsConfig.server_addr}
server_port = ${frpsConfig.server_port || 7000}
${frpsConfig.auth_token ? `auth_token = ${frpsConfig.auth_token}` : ''}
${frpsConfig.use_encryption ? 'use_encryption = true' : ''}
${frpsConfig.use_compression ? 'use_compression = true' : ''}
${frpsConfig.tcp_mux !== false ? 'tcp_mux = true' : ''}
pool_count = ${frpsConfig.pool_count || 1}
log_file = ${path.join(this.configDir, `${projectName}.log`)}
log_level = info
`;

    // 前端配置
    if (frpcConfig.frontend_enabled && project.frontend_port) {
      const proxyName = `${projectName}-frontend`;

      if (frpcConfig.protocol === 'http' || frpcConfig.protocol === 'https') {
        // HTTP/HTTPS 模式
        config += `
[${proxyName}]
type = ${frpcConfig.protocol}
local_ip = 127.0.0.1
local_port = ${project.frontend_port}
${frpcConfig.frontend_subdomain ? `subdomain = ${frpcConfig.frontend_subdomain}` : ''}
${frpcConfig.frontend_custom_domain ? `custom_domains = ${frpcConfig.frontend_custom_domain}` : ''}
${frpcConfig.use_encryption ? 'use_encryption = true' : ''}
${frpcConfig.use_compression ? 'use_compression = true' : ''}
`;
      } else {
        // TCP 模式
        config += `
[${proxyName}]
type = tcp
local_ip = 127.0.0.1
local_port = ${project.frontend_port}
${frpcConfig.frontend_remote_port ? `remote_port = ${frpcConfig.frontend_remote_port}` : ''}
${frpcConfig.use_encryption ? 'use_encryption = true' : ''}
${frpcConfig.use_compression ? 'use_compression = true' : ''}
`;
      }
    }

    // 后端配置
    if (frpcConfig.backend_enabled && project.backend_port) {
      const proxyName = `${projectName}-backend`;

      if (frpcConfig.protocol === 'http' || frpcConfig.protocol === 'https') {
        // HTTP/HTTPS 模式
        config += `
[${proxyName}]
type = ${frpcConfig.protocol}
local_ip = 127.0.0.1
local_port = ${project.backend_port}
${frpcConfig.backend_subdomain ? `subdomain = ${frpcConfig.backend_subdomain}` : ''}
${frpcConfig.backend_custom_domain ? `custom_domains = ${frpcConfig.backend_custom_domain}` : ''}
${frpcConfig.use_encryption ? 'use_encryption = true' : ''}
${frpcConfig.use_compression ? 'use_compression = true' : ''}
`;
      } else {
        // TCP 模式
        config += `
[${proxyName}]
type = tcp
local_ip = 127.0.0.1
local_port = ${project.backend_port}
${frpcConfig.backend_remote_port ? `remote_port = ${frpcConfig.backend_remote_port}` : ''}
${frpcConfig.use_encryption ? 'use_encryption = true' : ''}
${frpcConfig.use_compression ? 'use_compression = true' : ''}
`;
      }
    }

    fs.writeFileSync(configPath, config, 'utf8');
    console.log(`[Frpc] 生成配置文件: ${configPath}`);

    return configPath;
  }

  /**
   * 启动 frpc
   * @param {string} projectName - 项目名称
   * @returns {Promise<Object>} 启动结果
   */
  async start(projectName) {
    try {
      // 检查是否已运行
      if (this.processes.has(projectName)) {
        throw new Error('Frpc 已在运行中');
      }

      // 获取配置
      const project = db.getProjectByName(projectName);
      if (!project) {
        throw new Error('项目不存在');
      }

      const frpcConfig = db.getProjectFrpcConfig(projectName);
      if (!frpcConfig || !frpcConfig.enabled) {
        throw new Error('Frpc 未启用');
      }

      const frpsConfig = db.getFrpsConfig();
      if (!frpsConfig) {
        throw new Error('未配置 frps 服务器');
      }

      // 生成配置文件
      const configPath = this.generateConfig(projectName, project, frpcConfig, frpsConfig);

      // 检查 frpc 是否安装
      const frpcPath = this.findFrpcExecutable();
      if (!frpcPath) {
        throw new Error('未找到 frpc 可执行文件，请先安装 frp');
      }

      // 启动进程
      const proc = spawn(frpcPath, ['-c', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // 监听输出
      proc.stdout.on('data', (data) => {
        console.log(`[Frpc ${projectName}] ${data.toString().trim()}`);
        this.emit(`log:${projectName}`, data.toString());
      });

      proc.stderr.on('data', (data) => {
        console.error(`[Frpc ${projectName} Error] ${data.toString().trim()}`);
        this.emit(`error:${projectName}`, data.toString());
      });

      proc.on('exit', (code) => {
        console.log(`[Frpc ${projectName}] 进程退出，代码: ${code}`);
        this.processes.delete(projectName);
        db.updateProjectFrpcStatus(projectName, false, null);
        this.emit(`exit:${projectName}`, code);
      });

      // 保存进程信息
      this.processes.set(projectName, {
        process: proc,
        config: frpcConfig,
        configPath,
        startedAt: new Date()
      });

      // 更新数据库
      db.updateProjectFrpcStatus(projectName, true, proc.pid);

      // 生成访问URL
      const urls = this.generateAccessUrls(projectName, project, frpcConfig, frpsConfig);

      return {
        success: true,
        pid: proc.pid,
        configPath,
        urls
      };

    } catch (error) {
      console.error(`[Frpc] 启动失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停止 frpc
   * @param {string} projectName - 项目名称
   * @returns {Object} 停止结果
   */
  stop(projectName) {
    const info = this.processes.get(projectName);

    if (!info) {
      return {
        success: false,
        error: 'Frpc 未运行'
      };
    }

    try {
      info.process.kill('SIGTERM');
      this.processes.delete(projectName);
      db.updateProjectFrpcStatus(projectName, false, null);

      return {
        success: true,
        message: 'Frpc 已停止'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取运行状态
   * @param {string} projectName - 项目名称
   * @returns {Object} 运行状态
   */
  getStatus(projectName) {
    const info = this.processes.get(projectName);

    if (!info) {
      return {
        running: false
      };
    }

    const frpcConfig = db.getProjectFrpcConfig(projectName);
    const frpsConfig = db.getFrpsConfig();
    const project = db.getProjectByName(projectName);

    return {
      running: true,
      pid: info.process.pid,
      startedAt: info.startedAt,
      configPath: info.configPath,
      urls: this.generateAccessUrls(projectName, project, frpcConfig, frpsConfig)
    };
  }

  /**
   * 生成访问 URL
   */
  generateAccessUrls(projectName, project, frpcConfig, frpsConfig) {
    const urls = [];

    if (frpcConfig.frontend_enabled && project.frontend_port) {
      if (frpcConfig.protocol === 'http' || frpcConfig.protocol === 'https') {
        if (frpcConfig.frontend_custom_domain) {
          urls.push({
            type: 'frontend',
            url: `${frpcConfig.protocol}://${frpcConfig.frontend_custom_domain}`
          });
        } else if (frpcConfig.frontend_subdomain) {
          urls.push({
            type: 'frontend',
            url: `${frpcConfig.protocol}://${frpcConfig.frontend_subdomain}.${frpsConfig.server_addr}`
          });
        }
      } else if (frpcConfig.frontend_remote_port) {
        urls.push({
          type: 'frontend',
          url: `${frpsConfig.server_addr}:${frpcConfig.frontend_remote_port}`
        });
      }
    }

    if (frpcConfig.backend_enabled && project.backend_port) {
      if (frpcConfig.protocol === 'http' || frpcConfig.protocol === 'https') {
        if (frpcConfig.backend_custom_domain) {
          urls.push({
            type: 'backend',
            url: `${frpcConfig.protocol}://${frpcConfig.backend_custom_domain}`
          });
        } else if (frpcConfig.backend_subdomain) {
          urls.push({
            type: 'backend',
            url: `${frpcConfig.protocol}://${frpcConfig.backend_subdomain}.${frpsConfig.server_addr}`
          });
        }
      } else if (frpcConfig.backend_remote_port) {
        urls.push({
          type: 'backend',
          url: `${frpsConfig.server_addr}:${frpcConfig.backend_remote_port}`
        });
      }
    }

    return urls;
  }

  /**
   * 查找 frpc 可执行文件
   */
  findFrpcExecutable() {
    const possiblePaths = [
      '/usr/local/bin/frpc',
      '/usr/bin/frpc',
      '/opt/homebrew/bin/frpc',
      path.join(os.homedir(), '.local/bin/frpc'),
      path.join(os.homedir(), 'bin/frpc')
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // 尝试 PATH
    try {
      const { execSync } = require('child_process');
      const result = execSync('which frpc', { encoding: 'utf8' }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  /**
   * 恢复运行中的进程（启动时调用）
   */
  restoreRunningProcesses() {
    const running = db.getRunningFrpcProjects();

    running.forEach(config => {
      // 清除数据库中的运行状态（进程已失效）
      db.updateProjectFrpcStatus(config.project_name, false, null);
    });

    console.log(`[Frpc] 已清理 ${running.length} 个失效的进程记录`);
  }

  /**
   * 获取所有运行中的项目
   */
  getAllRunning() {
    const result = [];

    this.processes.forEach((info, projectName) => {
      result.push({
        projectName,
        pid: info.process.pid,
        startedAt: info.startedAt,
        configPath: info.configPath
      });
    });

    return result;
  }

  /**
   * 停止所有 frpc
   */
  stopAll() {
    const results = [];

    this.processes.forEach((info, projectName) => {
      results.push({
        projectName,
        ...this.stop(projectName)
      });
    });

    return results;
  }
}

module.exports = new FrpcManager();
