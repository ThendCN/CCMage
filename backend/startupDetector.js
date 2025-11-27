const fs = require('fs');
const path = require('path');

/**
 * 启动命令检测器 - 自动识别项目的启动方式
 */
class StartupDetector {
  /**
   * 检测项目的启动命令
   */
  detect(projectPath, project) {
    const detectors = [
      this.detectNodeProject,
      this.detectPythonProject,
      this.detectGoProject,
      this.detectDockerProject,
      this.detectMakefile,
    ];

    for (const detector of detectors) {
      const result = detector.call(this, projectPath, project);
      if (result) return result;
    }

    return null;
  }

  /**
   * 检测 Node.js 项目
   */
  detectNodeProject(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return null;

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};

      // 优先级：dev > start > serve
      if (scripts.dev) {
        return { command: 'npm run dev', type: 'node', manager: 'npm' };
      }
      if (scripts.start) {
        return { command: 'npm start', type: 'node', manager: 'npm' };
      }
      if (scripts.serve) {
        return { command: 'npm run serve', type: 'node', manager: 'npm' };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检测 Python 项目
   */
  detectPythonProject(projectPath, project) {
    // 检查常见的 Python 启动文件
    const candidates = [
      'main.py',
      'app.py',
      'server.py',
      'manage.py',
      'run.py'
    ];

    for (const file of candidates) {
      if (fs.existsSync(path.join(projectPath, file))) {
        // 如果有 requirements.txt，可能需要虚拟环境
        const hasRequirements = fs.existsSync(path.join(projectPath, 'requirements.txt'));
        const hasVenv = fs.existsSync(path.join(projectPath, 'venv')) ||
                       fs.existsSync(path.join(projectPath, '.venv'));

        if (hasVenv && hasRequirements) {
          return {
            command: `source venv/bin/activate && python ${file}`,
            type: 'python',
            manager: 'python'
          };
        }

        return {
          command: `python ${file}`,
          type: 'python',
          manager: 'python'
        };
      }
    }

    // 检查 FastAPI/Flask 特定启动方式
    if (project.stack && project.stack.includes('fastapi')) {
      if (fs.existsSync(path.join(projectPath, 'app'))) {
        return { command: 'uvicorn app.main:app --reload', type: 'python', manager: 'uvicorn' };
      }
    }

    return null;
  }

  /**
   * 检测 Go 项目
   */
  detectGoProject(projectPath) {
    const goModPath = path.join(projectPath, 'go.mod');
    if (!fs.existsSync(goModPath)) return null;

    // 查找 main.go
    if (fs.existsSync(path.join(projectPath, 'main.go'))) {
      return { command: 'go run main.go', type: 'go', manager: 'go' };
    }

    if (fs.existsSync(path.join(projectPath, 'cmd'))) {
      return { command: 'go run ./cmd/...', type: 'go', manager: 'go' };
    }

    return null;
  }

  /**
   * 检测 Docker 项目
   */
  detectDockerProject(projectPath) {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    const composeFilePath = path.join(projectPath, 'docker-compose.yml');

    if (fs.existsSync(composeFilePath)) {
      return { command: 'docker-compose up', type: 'docker', manager: 'docker-compose' };
    }

    if (fs.existsSync(dockerfilePath)) {
      const projectName = path.basename(projectPath);
      return {
        command: `docker build -t ${projectName} . && docker run -p 8080:8080 ${projectName}`,
        type: 'docker',
        manager: 'docker'
      };
    }

    return null;
  }

  /**
   * 检测 Makefile
   */
  detectMakefile(projectPath) {
    const makefilePath = path.join(projectPath, 'Makefile');
    if (!fs.existsSync(makefilePath)) return null;

    try {
      const content = fs.readFileSync(makefilePath, 'utf8');

      // 查找常见的目标
      if (content.includes('run:')) {
        return { command: 'make run', type: 'make', manager: 'make' };
      }
      if (content.includes('dev:')) {
        return { command: 'make dev', type: 'make', manager: 'make' };
      }
      if (content.includes('start:')) {
        return { command: 'make start', type: 'make', manager: 'make' };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new StartupDetector();
