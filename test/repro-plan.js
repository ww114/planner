// 复现浏览器里"生成方案后无输出"的完整流程(高德接口用假数据,渲染用 DOM 桩)
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);

global.window = {};
global.document = {}; // 先不带 getElementById → init() 自动跳过
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = {};
global.alert = () => {};
// 高德接口换成假数据:20分钟/3km 的地铁腿(必须拼进 eval 同一作用域,否则被 strict 作用域遮蔽)
const NET_STUB = `
;sleep=function(){return Promise.resolve();};
geocode=function(addr){return Promise.resolve({loc:'113.9,22.5',formatted:String(addr)});};
routeLeg=function(gA,gB,mode){return Promise.resolve({status:'ok',dur:20,distM:3000,mode:'transit',cost:4});};
`;
try {
  (0, eval)(m[1] + NET_STUB);
} catch (e) {
  console.log('!!! eval 失败:', e && e.stack ? e.stack : e);
  process.exit(1);
}

// DOM 桩:所有元素通用
function fakeEl() {
  return { classList: { add() {}, remove() {} }, innerHTML: '', textContent: '', hidden: false, value: '', scrollIntoView() {} };
}
global.document = { getElementById: () => fakeEl() };

const T = global.window.__test;
if (!T) { console.log('!!! __test 未挂载'); process.exit(1); }

// 与用户浏览器一致的状态:3 个已接单 + 空闲时间(注意:必须改 T.state 这个对象,不能整体替换)
T.state.settings = { home: '哈尔滨工业大学深圳校区', key: '613e32a79222f9e37d90a7de40dd009d', city: '深圳市', buffer: 15, mode: 'transit' };
T.state.jobs = [
  { label: '单1', raw: '单1', days: [6], start: '09:00', end: '11:00', durMin: '', payType: 'hourly', amount: '', amountMax: '', address: '南山区中山公园地铁站', note: '', timesPerWeek: '' },
  { label: '单2', raw: '单2', days: [6], start: '13:30', end: '18:00', durMin: '', payType: 'hourly', amount: '', amountMax: '', address: '光明区将围地铁站', note: '', timesPerWeek: '' },
  { label: '单3', raw: '单3', days: [0], start: '10:00', end: '12:00', durMin: '', payType: 'hourly', amount: '', amountMax: '', address: '宝安区怀德地铁站', note: '', timesPerWeek: '' }
];
T.state.cands = [];
T.state.free = ['08:00-19:00', '', '', '', '', '14:00-18:00', '08:00-19:00'];
T.state.routeCache = {};
T.state.legMode = {};

const batch = require('./batch-data.js');

async function main() {
  try {
    // 1) 与浏览器 addCandidates 相同的解析映射
    const parts = T.splitPostings(batch);
    parts.forEach(p => {
      const r = T.parseJobText(p);
      const c = T.emptyJob();
      c.raw = p;
      if (r.label) c.label = r.label;
      c.days = r.days || [];
      if (r.startMin != null) c.start = T.fmtTime(r.startMin);
      if (r.endMin != null) c.end = T.fmtTime(r.endMin);
      if (r.durMin != null) c.durMin = String(r.durMin);
      if (r.salary) { c.payType = r.salary.type; c.amount = String(r.salary.amount); if (r.salary.amountMax != null) c.amountMax = String(r.salary.amountMax); }
      if (r.address) c.address = r.address;
      if (r.note) c.note = r.note;
      if (r.timesPerWeek) c.timesPerWeek = String(r.timesPerWeek);
      c.use = true;
      T.state.cands.push(c);
    });
    console.log('候选:', T.state.cands.length, '条(未定时间', T.state.cands.filter(c => !c.start).length, '条)');

    // 2) buildPlan(进度只打印最后一条)
    let lastMsg = '';
    const plan = await T.buildPlan(msg => { lastMsg = msg; });
    console.log('buildPlan 完成,最后进度:', lastMsg);
    if (!plan) { console.log('!!! plan 为 null/undefined(这不可能是正常路径)'); return; }
    if (plan.fatal) { console.log('!!! fatal:', JSON.stringify(plan.fatal)); return; }
    console.log('上课日:', JSON.stringify(plan.dayIdxs));
    console.log('冲突数:', plan.conflicts.length);
    plan.conflicts.forEach(c => console.log('  [' + c.level + '] ' + c.text));

    // 3) renderResults(与浏览器相同)
    T.renderResults(plan);
    console.log('renderResults 执行完毕,无异常');
  } catch (e) {
    console.log('!!! 异常:', e && e.stack ? e.stack : e);
  }
}
main();
