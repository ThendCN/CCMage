const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const db = require('./database');

const execAsync = promisify(exec);

/**
 * 简化的端口服务
 * 功能：端口检测、查询、冲突检查
 */
class PortService {
  constructor() {
    this.portCache = new Map(); // 端口检测缓存
    this.CACHE_TTL = 5000; // 缓存有效期 5 秒
  }

  // ==================== 端口可用性检测 ====================

  /**
   * 检测端口是否可用
   * @param {number} port - 端口号
   * @returns {Promise<boolean>} 是否可用
   */
  async isPortAvailable(port) {
    // 检查缓存
    const cached = this.portCache.get(port);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.available;
    }

    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err) => {
        const available = err.code !== 'EADDRINUSE';
        this.portCache.set(port, { available, timestamp: Date.now() });
        resolve(available);
      });

      server.once('listening', () => {
        server.close();
        this.portCache.set(port, { available: true, timestamp: Date.now() });
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * 查找下一个可用端口
   * @param {number} startPort - 起始端口
   * @param {number} maxAttempts - 最大尝试次数
   * @returns {Promise<number|null>} 可用端口或 null
   */
  async findAvailablePort(startPort = 3000, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * 批量检测端口可用性
   * @param {number[]} ports - 端口列表
   * @returns {Promise<Object>} 端口可用性映射
   */
  async checkPorts(ports) {
    const results = {};
    await Promise.all(
      ports.map(async (port) => {
        results[port] = await this.isPortAvailable(port);
      })
    );
    return results;
  }

  // ==================== 端口进程信息 ====================

  /**
   * 查找占用端口的进程信息
   * @param {number} port - 端口号
   * @returns {Promise<Object|null>} 进程信息
   */
  async findProcessByPort(port) {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -P -n -sTCP:LISTEN`);
      const lines = stdout.trim().split('\n');

      if (lines.length < 2) return null;

      const processLine = lines[1];
      const parts = processLine.split(/\s+/);

      return {
        command: parts[0],
        pid: parts[1],
        user: parts[2],
        name: parts[0]
      };
    } catch (error) {
      // lsof 没找到进程时会返回错误
      return null;
    }
  }

  // ==================== 数据库端口查询 ====================

  /**
   * 获取所有项目的端口使用情况
   * @returns {Object} 端口使用统计
   */
  getPortUsage() {
    const projects = db.getAllProjects();
    const usedPorts = [];
    const portMap = {};

    projects.forEach(project => {
      if (project.frontend_port) {
        usedPorts.push(project.frontend_port);
        portMap[project.frontend_port] = {
          project: project.name,
          type: 'frontend'
        };
      }

      if (project.backend_port) {
        usedPorts.push(project.backend_port);
        portMap[project.backend_port] = {
          project: project.name,
          type: 'backend'
        };
      }
    });

    return {
      usedPorts: [...new Set(usedPorts)].sort((a, b) => a - b),
      portMap,
      stats: {
        total: usedPorts.length,
        frontend: Object.values(portMap).filter(p => p.type === 'frontend').length,
        backend: Object.values(portMap).filter(p => p.type === 'backend').length
      }
    };
  }

  /**
   * 建议可用端口
   * @param {string} type - 端口类型 (frontend/backend)
   * @param {number} count - 建议数量
   * @returns {number[]} 建议的端口列表
   */
  suggestPorts(type = 'frontend', count = 3) {
    const { usedPorts } = this.getPortUsage();
    const usedSet = new Set(usedPorts);
    const suggestions = [];

    // 端口范围
    const ranges = {
      frontend: { start: 5000, end: 5999 },
      backend: { start: 3000, end: 3999 }
    };

    const range = ranges[type] || ranges.frontend;

    for (let port = range.start; port <= range.end && suggestions.length < count; port++) {
      if (!usedSet.has(port)) {
        suggestions.push(port);
      }
    }

    return suggestions;
  }

  /**
   * 检查端口冲突
   * @param {number} port - 要检查的端口
   * @param {string} projectName - 项目名称（可选，用于排除自己）
   * @returns {Object} 冲突信息
   */
  checkConflict(port, projectName = null) {
    const { portMap } = this.getPortUsage();
    const conflict = portMap[port];

    if (!conflict) {
      return { hasConflict: false };
    }

    // 如果是同一个项目，不算冲突
    if (conflict.project === projectName) {
      return { hasConflict: false };
    }

    return {
      hasConflict: true,
      project: conflict.project,
      type: conflict.type
    };
  }

  // ==================== 启动命令端口提取 ====================

  /**
   * 从启动命令中提取端口号
   * @param {string} command - 启动命令
   * @returns {number|null} 端口号
   */
  extractPortFromCommand(command) {
    const patterns = [
      /--port[= ](\d+)/,      // --port=3000 或 --port 3000
      /-p[= ](\d+)/,          // -p=3000 或 -p 3000
      /PORT[= ](\d+)/,        // PORT=3000
      /:(\d+)\b/,             // :3000
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * 替换命令中的端口号
   * @param {string} command - 原命令
   * @param {number} oldPort - 旧端口
   * @param {number} newPort - 新端口
   * @returns {string} 替换后的命令
   */
  replacePortInCommand(command, oldPort, newPort) {
    return command
      .replace(new RegExp(`--port[= ]${oldPort}\\b`, 'g'), `--port=${newPort}`)
      .replace(new RegExp(`-p[= ]${oldPort}\\b`, 'g'), `-p=${newPort}`)
      .replace(new RegExp(`PORT[= ]${oldPort}\\b`, 'g'), `PORT=${newPort}`)
      .replace(new RegExp(`:${oldPort}\\b`, 'g'), `:${newPort}`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 清理端口缓存
   */
  clearCache() {
    this.portCache.clear();
  }

  /**
   * 验证端口号是否有效
   * @param {number} port - 端口号
   * @returns {boolean} 是否有效
   */
  isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port < 65536;
  }
}

module.exports = new PortService();
