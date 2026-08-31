// 修复 npm reify 残留（v2）：只处理"正式目录缺失"的 .NAME-随机后缀 临时目录，
// rename 为正式名。正式目录已存在的临时垃圾跳过（不影响构建）。
const fs = require('fs');
const path = require('path');

let renamed = 0;

function fix(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    if (e.name.startsWith('@') && !e.name.includes('.')) {
      fix(full);
      continue;
    }
    const m = e.name.match(/^\.(.+)-([A-Za-z0-9]{6,8})$/);
    if (!m || !m[1]) continue;
    const real = path.join(dir, m[1]);
    if (fs.existsSync(real)) continue; // 正式已存在，跳过
    try {
      fs.renameSync(full, real);
      renamed++;
      console.log('RENAMED:', e.name, '->', m[1]);
    } catch (err) {
      console.log('FAIL rename:', full, err.message);
    }
  }
}

fix('node_modules');
console.log(`\nDONE: renamed=${renamed}`);
