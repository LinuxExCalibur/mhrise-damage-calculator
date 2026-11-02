const fs = require('fs');
const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf8');

const start = html.indexOf('const MHW_DATA');
const end = html.indexOf('/* ---------- 渲染：怪物与部位');
if (start < 0 || end < 0) { console.error('FAIL: 无法定位脚本片段'); process.exit(1); }
const code = html.slice(start, end);
const ctx = new Function(code + '\nreturn {MHW_DATA, WEP, SHARP, ATK_BOOST, WEX, compute};')();

const { MHW_DATA, SHARP, ATK_BOOST, WEX, compute } = ctx;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

console.log('加载怪物数: ' + MHW_DATA.length);
ok(MHW_DATA.length === 78, '怪物数量应为 78，实际 ' + MHW_DATA.length);

// 数据完整性
MHW_DATA.forEach(m => {
  ok(m.parts && m.parts.length >= 2, m.name + ' 部位数异常');
  m.parts.forEach(p => {
    ['cut','blunt','ranged','fire','water','ice','thunder','dragon'].forEach(k => {
      ok(typeof p[k] === 'number' && p[k] >= 0 && p[k] <= 200, `${m.name}/${p.part} 字段 ${k} 异常: ${p[k]}`);
    });
  });
});

// 元气常量
ok(JSON.stringify(WEX) === JSON.stringify([0,15,30,50]), '弱点特效应为 0/15/30/50');
ok(ATK_BOOST[7].flat === 10 && ATK_BOOST[7].pct === 0.10, '攻击 Lv7 应为 +10 / +10%');
ok(ATK_BOOST[4].flat === 7 && ATK_BOOST[4].pct === 0.05, '攻击 Lv4 应为 +7 / +5%');
ok(SHARP['白'].raw === 1.32 && SHARP['紫'].raw === 1.39, '斩味倍率异常');

// 怨虎龙核对
const mag = MHW_DATA.find(m => m.slug === '1921564947');
ok(!!mag, '缺少怨虎龙');
const head = mag.parts.find(p => p.part === '头部');
ok(!!head, '怨虎龙缺少头部');
ok(head.cut === 55 && head.blunt === 55 && head.ranged === 30, '怨虎龙头部物理肉质不符: ' + JSON.stringify(head));
ok(head.fire === 0 && head.water === 15 && head.ice === 5 && head.thunder === 10 && head.dragon === 0, '怨虎龙头部属性吸收不符');
console.log('怨虎龙头部: ' + JSON.stringify(head));

// 物理计算：太刀 1000 攻击，白斩，MV100，肉质 55，0 会心，超会心 Lv3
const build = {weapon:'太刀', atk:1000, eleDisp:0, element:'无', aff:0, sharp:'白',
               atkLv:0, eyeLv:0, wexLv:0, cbLv:3, critEle:'none', extraRaw:0, pctBonus:0, eleExtra:0};
const opts = {mv:100, monMod:1, soft:false};
const r = compute(build, mag, head, opts);
ok(near(r.trueRaw, 1000/3.3, 0.01), '真实攻击力错误: ' + r.trueRaw);
ok(near(r.physBase, (1000/3.3)*1.32*0.55, 0.05), '物理非会心错误: ' + r.physBase);
ok(near(r.physCrit, (1000/3.3)*1.32*0.55*1.40, 0.1), '超会心3 会心错误: ' + r.physCrit);
console.log('太刀1000/白斩/肉质55: 非会心=' + r.physBase.toFixed(1) + ' 会心=' + r.physCrit.toFixed(1));

// 会心期望 50%
const b50 = Object.assign({}, build, {aff:50});
const r50 = compute(b50, mag, head, opts);
const base = (1000/3.3)*1.32*0.55;
ok(near(r50.physExp, base*0.5 + base*1.40*0.5, 0.1), '50% 会心期望错误');

// 负会心 -30
const bneg = Object.assign({}, build, {aff:-30});
ok(near(compute(bneg, mag, head, opts).physExp, base*0.7 + base*0.75*0.3, 0.1), '负会心期望错误');

// 攻击 Lv7：+10 且 ×1.10
const bA = Object.assign({}, build, {atkLv:7});
const rA = compute(bA, mag, head, opts);
ok(near(rA.trueRaw, 1000/3.3 + 10, 0.01), '攻击Lv7 trueRaw 错误: ' + rA.trueRaw);
ok(near(rA.rawTotal, (1000/3.3 + 10)*1.10, 0.01), '攻击Lv7 rawTotal 错误: ' + rA.rawTotal);

// 弱点特效：肉质 55 应 +50；肉质 <45 不应生效
ok(near(compute(Object.assign({}, build, {wexLv:3}), mag, head, opts).aff, 50, 0.01), '弱特3 在肉质55 未生效');
const lowPart = mag.parts.find(p => p.cut > 0 && p.cut < 45);
if (lowPart) {
  ok(near(compute(Object.assign({}, build, {wexLv:3}), mag, lowPart, opts).aff, 0, 0.01), '弱特3 在肉质<45 不应生效');
}

// 属性：水 300，白斩，吸收 15，会心击属性 Lv3 = 1.15
const be = Object.assign({}, build, {element:'水', eleDisp:300, critEle:'3', aff:100});
const re = compute(be, mag, head, opts);
const trueEle = 300/10;
const eleBase = trueEle * SHARP['白'].ele * (head.water/100);
ok(near(re.eleBase, eleBase, 0.01), '属性非会心错误: ' + re.eleBase);
ok(near(re.eleCrit, eleBase*1.15, 0.01), '会心击属性Lv3 应为 1.15×: ' + re.eleCrit);
console.log('水300/白斩/吸收15: 非会心=' + re.eleBase.toFixed(2) + ' 会心=' + re.eleCrit.toFixed(2));

// 软化
const rs = compute(build, mag, head, {mv:100, monMod:1, soft:true});
ok(near(rs.zoneRaw, 0.75*55 + 25, 0.01), '软化肉质错误: ' + rs.zoneRaw);

// 全组合
let combos = 0;
MHW_DATA.forEach(m => m.parts.forEach(p => {
  try { compute(build, m, p, opts); compute(b50, m, p, opts); combos += 2; }
  catch (e) { fails++; console.log('FAIL: ' + m.name + '/' + p.part + ' 抛错 ' + e.message); }
}));
console.log('计算组合数: ' + combos);
console.log(fails === 0 ? '=== ALL TESTS PASSED ===' : '=== FAILURES: ' + fails + ' ===');
process.exit(fails === 0 ? 0 : 1);
