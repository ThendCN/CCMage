const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * 进程管理器 - 管理项目服务的启动、停止和日志
 */
class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // { projectName: { process, logs, startTime } }
    this.maxLogLines = 1000; // 最多保存1000行日志
  }

  /**
   * 启动项目服务
   */
  start(projectName, command, cwd, env = {}) {
    // 如果已经在运行，返回错误
    if (this.processes.has(projectName)) {
      throw new Error(`项目 ${projectName} 已在运行中`);
    }

    // 解析命令
    const [cmd, ...args] = command.split(' ');

    // 启动进程
    const childProcess = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true
    });

    // 初始化日志
    const logs = [];
    const startTime = Date.now();

    // 监听标准输出
    childProcess.stdout.on('data', (data) => {
      const line = data.toString();
      logs.push({ time: Date.now(), type: 'stdout', content: line });
      if (logs.length > this.maxLogLines) logs.shift();
      this.emit(`log:${projectName}`, { type: 'stdout', content: line });
    });

    // 监听错误输出
    childProcess.stderr.on('data', (data) => {
      const line = data.toString();
      logs.push({ time: Date.now(), type: 'stderr', content: line });
      if (logs.length > this.maxLogLines) logs.shift();
      this.emit(`log:${projectName}`, { type: 'stderr', content: line });
    });

    // 监听进程退出
    childProcess.on('exit', (code) => {
      this.emit(`exit:${projectName}`, { code, projectName });
      this.processes.delete(projectName);
    });

    // 保存进程信息
    this.processes.set(projectName, {
      process: childProcess,
      logs,
      startTime,
      command,
      cwd
    });

    return {
      pid: childProcess.pid,
      startTime
    };
  }

  /**
   * 停止项目服务
   */
  stop(projectName) {
    const processInfo = this.processes.get(projectName);
    if (!processInfo) {
      throw new Error(`项目 ${projectName} 未在运行`);
    }

    processInfo.process.kill('SIGTERM');

    // 5秒后如果还没停止，强制杀死
    setTimeout(() => {
      if (this.processes.has(projectName)) {
        processInfo.process.kill('SIGKILL');
      }
    }, 5000);

    return { success: true };
  }

  /**
   * 检查项目是否在运行
   */
  isRunning(projectName) {
    return this.processes.has(projectName);
  }

  /**
   * 获取项目状态
   */
  getStatus(projectName) {
    const processInfo = this.processes.get(projectName);
    if (!processInfo) {
      return { running: false };
    }

    return {
      running: true,
      pid: processInfo.process.pid,
      startTime: processInfo.startTime,
      uptime: Date.now() - processInfo.startTime,
      command: processInfo.command
    };
  }

  /**
   * 获取最近的日志
   */
  getLogs(projectName, limit = 100) {
    const processInfo = this.processes.get(projectName);
    if (!processInfo) {
      return [];
    }

    return processInfo.logs.slice(-limit);
  }

  /**
   * 停止所有进程
   */
  stopAll() {
    const projectNames = Array.from(this.processes.keys());
    projectNames.forEach(name => {
      try {
        this.stop(name);
      } catch (error) {
        console.error(`停止项目 ${name} 失败:`, error);
      }
    });
  }
}

module.exports = new ProcessManager();
