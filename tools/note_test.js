const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const s = html.indexOf('function partNote');
const e = html.indexOf('function renderParts');
if (s < 0 || e < 0) { console.log('FAIL: 未找到 partNote'); process.exit(1); }
const code = html.slice(s, e);
const fn = new Function(code + '\nreturn partNote;')();
const cases = ['头部', '头部（破坏）', '下颚（软化）', '颈部①', '翼②', '颈部（临界状态）', '尾巴'];
let ok = true;
for (const c of cases) {
  const n = fn(c);
  console.log('  ' + c + ' -> ' + (n || '(无备注)'));
}
if (!fn('头部（破坏）').includes('破坏')) { ok = false; console.log('FAIL 破坏备注'); }
if (!fn('下颚（软化）').includes('软化')) { ok = false; console.log('FAIL 软化备注'); }
if (!fn('颈部①').includes('同名重复')) { ok = false; console.log('FAIL ①② 备注'); }
if (fn('头部') !== '') { ok = false; console.log('FAIL 普通部位应为空'); }
console.log(ok ? '=== NOTE OK ===' : '=== NOTE FAILED ===');
process.exit(ok ? 0 : 1);
