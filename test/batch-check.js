// 用用户真实粘贴的 10 条微信群家教单做端到端核对(不调高德接口)
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
global.window = {};
global.document = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = {};
global.alert = () => {};
(0, eval)(m[1]);
const T = window.__test;

// 用户原话粘贴的批量单(第9条的 4：30 是全角冒号;第2条编号后没有结尾☀️)
const batch = require('./batch-data.js');

const parts = T.splitPostings(batch);
console.log('切分出', parts.length, '条(应为 10)');
parts.forEach((p, i) => {
  const r = T.parseJobText(p);
  const t = r.startMin != null ? T.fmtTime(r.startMin) + '-' + T.fmtTime(r.endMin) : '未定时间';
  const sal = r.salary
    ? r.salary.type + (r.salary.amountMax != null ? ' ' + r.salary.amount + '-' + r.salary.amountMax : ' ' + r.salary.amount) + (r.salary.perDur ? '/' + r.salary.perDur + 'min' : '')
    : '未识别';
  console.log(
    (i + 1) + '. ' + (r.id || '(无编号)') +
    ' | 地址=' + (r.address || '?') +
    ' | 天=' + JSON.stringify(r.days) +
    ' | 每周' + (r.timesPerWeek || '?') + '次' +
    ' | ' + t +
    ' | 每次' + (r.durMin != null ? r.durMin + 'min' : '?') +
    ' | 薪=' + sal +
    ' | 备注=' + (r.note || '?')
  );
});
