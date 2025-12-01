const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * 进程管理器 - 管理项目服务的启动、停止和日志
 */
class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // { projectName: { process, logs, startTime, status } }
    this.failedLogs = new Map(); // 保存启动失败的日志
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
    let status = 'starting'; // starting/running/failed

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
      const processInfo = this.processes.get(projectName);

      // 如果是非正常退出，保存失败日志
      if (code !== 0 && code !== null) {
        this.failedLogs.set(projectName, {
          logs: processInfo ? processInfo.logs.slice() : [],
          exitCode: code,
          timestamp: Date.now(),
          command
        });
        console.log(`❌ 项目 ${projectName} 异常退出，退出码: ${code}`);
      }

      this.emit(`exit:${projectName}`, { code, projectName });
      this.processes.delete(projectName);
    });

    // 保存进程信息
    this.processes.set(projectName, {
      process: childProcess,
      logs,
      startTime,
      command,
      cwd,
      status
    });

    return {
      pid: childProcess.pid,
      startTime
    };
  }

  /**
   * 验证启动是否成功
   * 等待一段时间，检查进程是否还在运行，以及日志中是否有错误
   */
  async validateStartup(projectName, timeout = 10000) {
    return new Promise((resolve) => {
      const checkInterval = 500; // 每500ms检查一次
      let elapsed = 0;
      let hasError = false;
      let hasSuccess = false;

      const processInfo = this.processes.get(projectName);
      if (!processInfo) {
        return resolve({
          success: false,
          error: '进程未启动',
          logs: []
        });
      }

      // 成功标志关键词
      const successKeywords = [
        'listening',
        'started',
        'ready',
        'running on',
        'server started',
        'compiled successfully',
        'vite.*ready',
        'webpack.*compiled'
      ];

      // 错误标志关键词
      const errorKeywords = [
        'EADDRINUSE',
        'address already in use',
        'Error:',
        'ERROR',
        'Failed to',
        'Cannot',
        'EACCES',
        'ENOTFOUND',
        'MODULE_NOT_FOUND',
        'SyntaxError'
      ];

      const exitHandler = ({ code }) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: `进程异常退出，退出码: ${code}`,
            exitCode: code,
            logs: processInfo.logs.slice()
          });
        }
      };

      this.once(`exit:${projectName}`, exitHandler);

      const checker = setInterval(() => {
        elapsed += checkInterval;

        const currentInfo = this.processes.get(projectName);

        // 进程已退出
        if (!currentInfo) {
          clearInterval(checker);
          this.off(`exit:${projectName}`, exitHandler);

          const failedInfo = this.failedLogs.get(projectName);
          resolve({
            success: false,
            error: '进程已退出',
            exitCode: failedInfo?.exitCode,
            logs: failedInfo?.logs || []
          });
          return;
        }

        // 检查日志中的错误
        const recentLogs = currentInfo.logs.slice(-20); // 检查最近20条日志
        const logsText = recentLogs.map(l => l.content).join('\n');

        // 检查错误关键词
        for (const keyword of errorKeywords) {
          const regex = new RegExp(keyword, 'i');
          if (regex.test(logsText)) {
            hasError = true;
            break;
          }
        }

        // 检查成功关键词
        for (const keyword of successKeywords) {
          const regex = new RegExp(keyword, 'i');
          if (regex.test(logsText)) {
            hasSuccess = true;
            break;
          }
        }

        // 如果找到错误，立即返回失败
        if (hasError) {
          clearInterval(checker);
          this.off(`exit:${projectName}`, exitHandler);

          // 更新状态
          currentInfo.status = 'failed';

          resolve({
            success: false,
            error: '日志中检测到错误',
            logs: currentInfo.logs.slice()
          });
          return;
        }

        // 如果找到成功标志，返回成功
        if (hasSuccess) {
          clearInterval(checker);
          this.off(`exit:${projectName}`, exitHandler);

          // 更新状态
          currentInfo.status = 'running';

          resolve({
            success: true,
            logs: currentInfo.logs.slice()
          });
          return;
        }

        // 超时
        if (elapsed >= timeout) {
          clearInterval(checker);
          this.off(`exit:${projectName}`, exitHandler);

          // 超时但进程还在运行，可能是成功的（某些服务没有明确的启动日志）
          if (this.processes.has(projectName)) {
            currentInfo.status = 'running';
            resolve({
              success: true,
              warning: '未检测到明确的启动成功标志，但进程仍在运行',
              logs: currentInfo.logs.slice()
            });
          } else {
            resolve({
              success: false,
              error: '启动超时',
              logs: currentInfo.logs.slice()
            });
          }
        }
      }, checkInterval);
    });
  }

  /**
   * 获取失败日志和诊断信息
   */
  getFailedLogs(projectName) {
    const processInfo = this.processes.get(projectName);
    const failedInfo = this.failedLogs.get(projectName);

    if (!processInfo && !failedInfo) {
      return null;
    }

    // 如果进程正在运行且有错误日志
    if (processInfo) {
      const errorLogs = processInfo.logs.filter(log =>
        log.type === 'stderr' ||
        (log.type === 'stdout' && (
          log.content.toLowerCase().includes('error') ||
          log.content.toLowerCase().includes('fail') ||
          log.content.toLowerCase().includes('exception') ||
          log.content.toLowerCase().includes('错误') ||
          log.content.toLowerCase().includes('失败')
        ))
      );

      if (errorLogs.length > 0) {
        return {
          projectName,
          status: 'running_with_errors',
          command: processInfo.command,
          startTime: processInfo.startTime,
          errorLogs,
          allLogs: processInfo.logs
        };
      }
    }

    // 如果进程已失败
    if (failedInfo) {
      const errorLogs = failedInfo.logs.filter(log =>
        log.type === 'stderr' ||
        (log.type === 'stdout' && (
          log.content.toLowerCase().includes('error') ||
          log.content.toLowerCase().includes('fail') ||
          log.content.toLowerCase().includes('exception') ||
          log.content.toLowerCase().includes('错误') ||
          log.content.toLowerCase().includes('失败')
        ))
      );

      return {
        projectName,
        status: 'failed',
        command: failedInfo.command,
        exitCode: failedInfo.exitCode,
        errorLogs,
        allLogs: failedInfo.logs
      };
    }

    return null;
  }

  /**
   * 清除失败日志
   */
  clearFailedLogs(projectName) {
    this.failedLogs.delete(projectName);
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
