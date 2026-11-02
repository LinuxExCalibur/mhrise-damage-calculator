// 用一个极简 DOM 替身跑完整脚本，验证渲染路径不会抛错
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');

const start = html.indexOf('const MHW_DATA');
const endScript = html.lastIndexOf('</script>');
const code = html.slice(start, endScript);

const store = new Map();
function mkEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _html: '', textContent: '', className: '', value: '', type: '',
    options: [], children: [], style: {}, onclick: null, onchange: null, oninput: null,
    appendChild(c) { this.children.push(c); if (this.tagName === 'SELECT' && c.tagName === 'OPTION') this.options.push(c); return c; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get innerHTML() { return this._html; },
  };
  return el;
}
const document = {
  getElementById(id) {
    if (!store.has(id)) store.set(id, mkEl(id === 'monster' || id === 'soft' || id === 'mv' || id === 'monmod' ? (id === 'mv' || id === 'monmod' ? 'input' : 'select') : 'div'));
    return store.get(id);
  },
  createElement(tag) { return mkEl(tag); },
};
// 预置控件初值
document.getElementById('mv').value = '100';
document.getElementById('monmod').value = '1';
document.getElementById('soft').value = '0';

let ok = true;
try {
  const fn = new Function('document', code + '\nreturn {MHW_DATA, compute, state};');
  const ctx = fn(document);
  const htmlResult = document.getElementById('result').innerHTML;
  const mt = document.getElementById('mtTable').innerHTML;

  if (!htmlResult || htmlResult.length < 200) { ok = false; console.log('FAIL: 结果面板为空'); }
  if (!/合计 · 期望伤害/.test(htmlResult)) { ok = false; console.log('FAIL: 结果面板缺少合计行'); }
  if (!mt || !/部位/.test(mt)) { ok = false; console.log('FAIL: 肉质表未渲染'); }
  const partChips = document.getElementById('parts').children.length;
  if (partChips < 2) { ok = false; console.log('FAIL: 部位按钮未生成, count=' + partChips); }
  const monOptions = document.getElementById('monster').options.length;
  if (monOptions !== ctx.MHW_DATA.length) { ok = false; console.log('FAIL: 怪物下拉数量不符 ' + monOptions + ' vs ' + ctx.MHW_DATA.length); }
  console.log('怪物下拉: ' + monOptions + ' 项');
  console.log('部位按钮: ' + partChips + ' 个');
  console.log('肉质表长度: ' + mt.length + ' 字符');
  console.log('结果面板长度: ' + htmlResult.length + ' 字符');
} catch (e) {
  ok = false;
  console.log('FAIL: 渲染脚本抛错 -> ' + e.message);
  console.log(e.stack.split('\n').slice(0, 4).join('\n'));
}
console.log(ok ? '=== RENDER OK ===' : '=== RENDER FAILED ===');
process.exit(ok ? 0 : 1);
