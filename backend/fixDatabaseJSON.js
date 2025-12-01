#!/usr/bin/env node

/**
 * 修复数据库中非 JSON 格式的字段
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'project-manager.db');
const db = new Database(dbPath);

console.log('🔧 开始修复数据库中的 JSON 格式问题...\n');

// 获取所有项目
const projects = db.prepare('SELECT id, name, tech, languages FROM projects').all();

let fixedCount = 0;

projects.forEach(project => {
  let needsUpdate = false;
  let newTech = project.tech;
  let newLanguages = project.languages;

  // 修复 tech 字段
  if (project.tech && project.tech !== '' && !project.tech.startsWith('[')) {
    try {
      // 尝试解析为 JSON
      JSON.parse(project.tech);
    } catch (e) {
      // 不是有效的 JSON，转换为数组
      if (project.tech.includes(',')) {
        const items = project.tech.split(',').map(s => s.trim()).filter(Boolean);
        newTech = JSON.stringify(items);
      } else {
        newTech = JSON.stringify([project.tech]);
      }
      needsUpdate = true;
      console.log(`  ✏️  ${project.name}: tech "${project.tech}" -> ${newTech}`);
    }
  }

  // 修复 languages 字段
  if (project.languages && project.languages !== '' && !project.languages.startsWith('[')) {
    try {
      // 尝试解析为 JSON
      JSON.parse(project.languages);
    } catch (e) {
      // 不是有效的 JSON，转换为数组
      if (project.languages.includes(',')) {
        const items = project.languages.split(',').map(s => s.trim()).filter(Boolean);
        newLanguages = JSON.stringify(items);
      } else {
        newLanguages = JSON.stringify([project.languages]);
      }
      needsUpdate = true;
      console.log(`  ✏️  ${project.name}: languages "${project.languages}" -> ${newLanguages}`);
    }
  }

  // 更新数据库
  if (needsUpdate) {
    db.prepare('UPDATE projects SET tech = ?, languages = ? WHERE id = ?')
      .run(newTech, newLanguages, project.id);
    fixedCount++;
  }
});

console.log(`\n✅ 修复完成！共修复 ${fixedCount} 个项目`);

db.close();
