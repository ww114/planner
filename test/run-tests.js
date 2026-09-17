// 解析与规划逻辑的离线测试(不需要浏览器,不调高德接口)
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到 <script> 内容'); process.exit(1); }

// 最小环境桩:document 不带 getElementById → 脚本里的 init() 自动跳过
global.window = {};
global.document = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = {};
global.alert = () => {};

(0, eval)(m[1]);
const T = window.__test;
if (!T) { console.error('window.__test 未挂载'); process.exit(1); }

let fail = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) console.log('✓ ' + name);
  else { fail++; console.log('✗ ' + name + '\n   got : ' + g + '\n   want: ' + e); }
}

console.log('--- parseDays ---');
eq('每周二、四', T.parseDays('每周二、四晚上7点到9点'), [2, 4]);
eq('周一至周五', T.parseDays('周一至周五晚上辅导'), [1, 2, 3, 4, 5]);
eq('周六周日', T.parseDays('周六周日下午2:00-4:00'), [0, 6]);
eq('每天', T.parseDays('每天两小时'), [0, 1, 2, 3, 4, 5, 6]);
eq('工作日', T.parseDays('工作日晚上'), [1, 2, 3, 4, 5]);
eq('周末', T.parseDays('周末上课'), [0, 6]);
eq('周1-周5', T.parseDays('周1-周5'), [1, 2, 3, 4, 5]);
eq('周二和周四', T.parseDays('每周二和周四'), [2, 4]);

console.log('--- parseTime ---');
eq('晚上7点到9点', T.parseTime('每周二、四晚上7点到9点'), { startMin: 1140, endMin: 1260 });
eq('下午2:00-4:00', T.parseTime('下午2:00-4:00'), { startMin: 840, endMin: 960 });
eq('19:00-21:00', T.parseTime('高一物理,每周一19:00-21:00'), { startMin: 1140, endMin: 1260 });
eq('上午9点到11点半', T.parseTime('上午9点到11点半'), { startMin: 540, endMin: 690 });
eq('晚7-9点', T.parseTime('晚7-9点'), { startMin: 1140, endMin: 1260 });
eq('7点到9点(无时段词按晚上)', T.parseTime('7点到9点'), { startMin: 1140, endMin: 1260 });
eq('开始时间+时长', T.parseTime('晚上7点开始,每次2小时'), { startMin: 1140, durMin: 120 });
eq('14:00-16:00', T.parseTime('14:00-16:00'), { startMin: 840, endMin: 960 });
eq('纯数字范围(10-12)', T.parseTime('一周两次，周末（10-12）'), { startMin: 600, endMin: 720 });
eq('4:30-9:00按下午到晚上', T.parseTime('周一到周五4:30-9:00'), { startMin: 990, endMin: 1260 });
eq('全角冒号4：30-9:00', T.parseTime('周一到周五4：30-9:00'), { startMin: 990, endMin: 1260 });
eq('点号时间2.30-4.30', T.parseTime('周六下午2.30-4.30'), { startMin: 870, endMin: 990 });

console.log('--- parseDuration ---');
eq('每次2小时', T.parseDuration('每次2小时,120元'), 120);
eq('一个半小时', T.parseDuration('每次一个半小时'), 90);
eq('共1.5小时', T.parseDuration('共1.5小时'), 90);

console.log('--- parseSalary ---');
eq('100元/小时', T.parseSalary('100元/小时'), { type: 'hourly', amount: 100 });
eq('每次120元', T.parseSalary('每次120元'), { type: 'per', amount: 120 });
eq('月薪3000', T.parseSalary('月薪3000元'), { type: 'monthly', amount: 3000 });
eq('80/小时', T.parseSalary('80/小时'), { type: 'hourly', amount: 80 });
eq('课时费80/小时', T.parseSalary('课时费80/小时'), { type: 'hourly', amount: 80 });
eq('每次2小时不是薪资', T.parseSalary('每次2小时'), null);
eq('每小时100元', T.parseSalary('每小时100元'), { type: 'hourly', amount: 100 });
eq('240-280/2h 区间按次', T.parseSalary('240-280/2h'), { type: 'per', amount: 240, amountMax: 280, perDur: 120 });
eq('90-110/h 区间时薪', T.parseSalary('90-110/h'), { type: 'hourly', amount: 90, amountMax: 110 });
eq('150/1.5h 按次带时长', T.parseSalary('150/1.5h'), { type: 'per', amount: 150, perDur: 90 });
eq('400-480/4h 区间', T.parseSalary('400-480/4h'), { type: 'per', amount: 400, amountMax: 480, perDur: 240 });
eq('200/2h 按次', T.parseSalary('200/2h'), { type: 'per', amount: 200, perDur: 120 });
eq('4000/月 月薪', T.parseSalary('4000/月'), { type: 'monthly', amount: 4000 });

console.log('--- parseAddress ---');
eq('地址:标注', T.parseAddress('地址:武昌区中南路地铁站旁XX小区,月结'), '武昌区中南路地铁站旁XX小区');
eq('在..附近', T.parseAddress('在洪山区街道口武汉大学西门附近,次结'), '洪山区街道口武汉大学西门');
eq('无地址返回空', T.parseAddress('初二数学,晚上7点到9点,100元/小时'), '');

console.log('--- parseNote ---');
eq('年级科目结款', T.parseNote('初二数学,月结'), '初二 · 数学 · 月结');
eq('高一物理周结', T.parseNote('高一物理,周结'), '高一 · 物理 · 周结');

console.log('--- parseJobText 完整样例 ---');
const r1 = T.parseJobText('【家教】初二数学,每周二、四晚上7点到9点,100元/小时,地址:武昌区中南路地铁站旁XX小区,月结,学生基础一般');
eq('样例1 days', r1.days, [2, 4]);
eq('样例1 start', r1.startMin, 1140);
eq('样例1 end', r1.endMin, 1260);
eq('样例1 salary', r1.salary, { type: 'hourly', amount: 100 });
eq('样例1 address', r1.address, '武昌区中南路地铁站旁XX小区');
eq('样例1 note', r1.note, '初二 · 数学 · 月结');

const r2 = T.parseJobText('小学五年级英语家教,周六周日下午2:00-4:00,每次120元,在洪山区街道口武汉大学西门附近,次结');
eq('样例2 days', r2.days, [0, 6]);
eq('样例2 time', [r2.startMin, r2.endMin], [840, 960]);
eq('样例2 salary', r2.salary, { type: 'per', amount: 120 });
eq('样例2 address', r2.address, '洪山区街道口武汉大学西门');

const r3 = T.parseJobText('高一物理,每周一19:00-21:00,80元/小时,光谷广场地铁站C出口附近,周结');
eq('样例3 days', r3.days, [1]);
eq('样例3 salary', r3.salary, { type: 'hourly', amount: 80 });
eq('样例3 address', r3.address, '光谷广场地铁站C出口');

console.log('--- parseJobText 用户真实三单(应用内置) ---');
const s1 = T.parseJobText('【家教】周六上午9点到11点,地址:南山区中山公园地铁站附近');
eq('单1 days', s1.days, [6]);
eq('单1 time', [s1.startMin, s1.endMin], [540, 660]);
eq('单1 address', s1.address, '南山区中山公园地铁站');

const s2 = T.parseJobText('【家教】周六下午1点半到6点,地址:光明区将围地铁站附近');
eq('单2 days', s2.days, [6]);
eq('单2 time', [s2.startMin, s2.endMin], [810, 1080]);
eq('单2 address', s2.address, '光明区将围地铁站');

const s3 = T.parseJobText('【家教】周日上午10点到12点,地址:宝安区怀德地铁站附近');
eq('单3 days', s3.days, [0]);
eq('单3 time', [s3.startMin, s3.endMin], [600, 720]);
eq('单3 address', s3.address, '宝安区怀德地铁站');

console.log('--- 微信群批量单格式(☀️编号☀️ + 逐行字段) ---');
const p1 = '☀️26091502☀️#新单#长期单#未投递\n学员地址：深圳南山区蛇口街道港湾花园\n辅导科目：数学\n学员情况：初一，基础差\n上课次数：一周三次\n老师要求：女老师 数学专业 有辅导经验\n老师薪水：240-280/2h';
const p5 = '♻️回收单☀️26091406☀️#新家长#长期单\n学员地址：深圳龙岗区大鹏新区葵涌\n辅导科目：英语数学\n学员情况：初一\n上课次数：一周一次，周末\n老师要求：有辅导经验，92优先\n老师薪水：400-480/4h';
const p9 = '☀️26091103☀️#老家长#长期单\n学员地址：深圳宝安区沙井街道\n辅导科目：英语作业辅导#一对二\n学员情况：二年级和四年级\n上课次数：一周六次（周一到周五4：30-9:00）\n老师要求：有辅导经验，英语专业优先\n老师薪水：4000/月';
const batch = p1 + '\n\n' + p5 + '\n\n' + p9;
const parts = T.splitPostings(batch);
eq('☀️格式切分 3 条', parts.length, 3);
eq('☀️第一条从编号开头', parts[0].indexOf('☀️26091502☀️'), 0);
eq('♻️回收单是第二条开头', parts[1].indexOf('♻️回收单☀️26091406☀️'), 0);
eq('第三条从编号开头', parts[2].indexOf('☀️26091103☀️'), 0);
eq('☀️格式保留行结构', parts[0].indexOf('\n') >= 0, true);
eq('☀️格式不加空行也能切', T.splitPostings(p1 + p9).length, 2);
var ten = ''; for (var n = 1; n <= 10; n++) ten += '☀️2609150' + (n < 10 ? '0' : '') + n + '☀️#新单\n地址：南山区小区' + n + '号\n\n';
eq('☀️格式 10 条批量', T.splitPostings(ten).length, 10);
// 编号后没有结尾☀️的单(如 26052505)也要能切分
var pNoClose = '☀️26052505#老家长未投递 #长期单\n地址：深圳光明大街地铁站\n薪水：90-110/h';
var partsNoClose = T.splitPostings(p1 + '\n\n' + pNoClose);
eq('☀️无结尾☀️也能切 2 条', partsNoClose.length, 2);
eq('☀️无结尾☀️第二条从编号开头', partsNoClose[1].indexOf('☀️26052505'), 0);
eq('☀️无结尾☀️紧贴前单也能切', T.splitPostings(p1 + '\n' + pNoClose).length, 2);

const w1 = T.parseJobText(p1);
eq('单1 未写具体日子→days空', w1.days, []);
eq('单1 一周三次', w1.timesPerWeek, 3);
eq('单1 薪资区间240-280/2h', w1.salary, { type: 'per', amount: 240, amountMax: 280, perDur: 120 });
eq('单1 时长按2h', w1.durMin, 120);
eq('单1 地址去深圳前缀', w1.address, '南山区蛇口街道港湾花园');
eq('单1 备注', w1.note, '初一 · 数学 · 每周3次');
eq('单1 标签', w1.label, '数学 · 26091502');

const w5 = T.parseJobText(p5);
eq('回收单 一周一次周末→日子待定', w5.days, []);
eq('回收单 一周一次', w5.timesPerWeek, 1);
eq('回收单 薪资400-480/4h', w5.salary, { type: 'per', amount: 400, amountMax: 480, perDur: 240 });
eq('回收单 地址', w5.address, '龙岗区大鹏新区葵涌');

const w9 = T.parseJobText(p9);
eq('单9 周一到周五', w9.days, [1, 2, 3, 4, 5]);
eq('单9 时间4:30-9:00→16:30-21:00', [w9.startMin, w9.endMin], [990, 1260]);
eq('单9 一周六次', w9.timesPerWeek, 6);
eq('单9 月薪4000', w9.salary, { type: 'monthly', amount: 4000 });

const w8 = T.parseJobText('☀️26091104☀️#新家长#长期单\n学员地址：深圳宝安侨香地铁站附近\n辅导科目：全科（主英语）\n学员情况：一年级\n上课次数：一周两次，周末（10-12）\n老师要求：有辅导经验，双一流以上\n老师薪水：200/2h');
eq('单8 周末两天+10-12点', w8.days, [0, 6]);
eq('单8 时间10-12', [w8.startMin, w8.endMin], [600, 720]);
eq('单8 一周两次不标待定', w8.timesPerWeek, 2);
eq('单8 薪资200/2h', w8.salary, { type: 'per', amount: 200, perDur: 120 });

const w2 = T.parseJobText('☀️26052505#老家长未投递 #长期单\n地址：深圳光明大街地铁站\n科目：英语\n情况：5年级\n次数：一周五次\n要求：英语相关专业女老师 深圳长期稳定 有辅导经验\n薪水：90-110/h');
eq('单2 简写字段地址', w2.address, '光明大街地铁站');
eq('单2 一周五次', w2.timesPerWeek, 5);
eq('单2 时薪区间', w2.salary, { type: 'hourly', amount: 90, amountMax: 110 });
eq('单2 5年级进备注', w2.note, '5年级 · 英语 · 每周5次');

// 平台模板格式:城市+编号开头,"标签:值"字段空格分隔(无☀️标记,时间用点号)
console.log('--- 平台模板格式(城市+编号, 标签:值) ---');
const appTxt = '深圳2026010905 家庭地址:龙岗区合正丹郡 学生年级:高一升高二 学生性别:男 辅导科目:数学 每周几次:周六下午2.30-4.30 老师性别:不限 老师要求:有经验， 本科是哈工深或南科大 课时费:170/小时';
const a1 = T.parseJobText(appTxt);
eq('平台单 判为平台格式', T.isAppPosting(appTxt), true);
eq('平台单 地址', a1.address, '龙岗区合正丹郡');
eq('平台单 上课日', a1.days, [6]);
eq('平台单 时间', [a1.startMin, a1.endMin], [870, 990]);
eq('平台单 时长2小时', a1.durMin, 120);
eq('平台单 时薪170', a1.salary, { type: 'hourly', amount: 170 });
eq('平台单 标签=科目·编号', a1.label, '数学 · 2026010905');
eq('平台单 备注含年级/科目/性别/要求', /高一升高二/.test(a1.note) && /数学/.test(a1.note) && /男/.test(a1.note) && /哈工深/.test(a1.note), true);
const appBatch = appTxt + '\n广州2026010906 家庭地址:天河区体育西路185号 学生年级:初二 学生性别:女 辅导科目:英语 每周几次:周日下午3:00-5:00 老师要求:有耐心 课时费:150/小时';
const appParts = T.splitPostings(appBatch);
eq('平台批量 切出2条', appParts.length, 2);
const a2 = T.parseJobText(appParts[1]);
eq('平台批量 第2条地址(补城市前缀)', a2.address, '广州天河区体育西路185号');
eq('平台批量 第2条时间', [a2.startMin, a2.endMin], [900, 1020]);
eq('平台批量 第2条上课日', a2.days, [0]);
eq('平台批量 第2条时薪150', a2.salary, { type: 'hourly', amount: 150 });

// 中介模板格式:【标签】:值 逐行字段
console.log('--- 中介模板格式(【标签】:值) ---');
eq('时长范围2-4h不误读为时间', T.parseTime('周六（具体时间时间可协商），一周1次，一次2-4h'), null);
eq('时长范围解析', T.parseDurRange('一次2-4h'), { min: 120, max: 240, txt: '一次2-4小时' });
const brTxt = '#加急加急#求简历~\n\n               宝安区：数理化\n【编号】：TXY-szxBi150982（长期单）\n【报价】：200-300/h\n【地址】：宝安区即马安山地铁口直行500米\n【年级】：高三女\n【科目】：数理化\n【课次】：周六（具体时间时间可协商），一周1次，一次2-4h\n【要求】：孩子数理化基础比较差，希望教学经验丰富的，数理化能一起教的，尽量要女老师';
const b1 = T.parseJobText(brTxt);
eq('中介单 判为中介格式', T.isBracketPosting(brTxt), true);
eq('中介单 地址清理(去即/直行500米)', b1.address, '宝安区马安山地铁口');
eq('中介单 上课日', b1.days, [6]);
eq('中介单 时间可协商→无时间', [b1.startMin, b1.endMin], [null, null]);
eq('中介单 每周1次', b1.timesPerWeek, 1);
eq('中介单 时长按最短2h', b1.durMin, 120);
eq('中介单 时薪区间200-300', b1.salary, { type: 'hourly', amount: 200, amountMax: 300 });
eq('中介单 标签=科目·编号', b1.label, '数理化 · TXY-szxBi150982');
eq('中介单 备注含高三/女/长期单/时长区间/要求', /高三/.test(b1.note) && /女/.test(b1.note) && /长期单/.test(b1.note) && /2-4小时/.test(b1.note) && /教学经验丰富/.test(b1.note), true);
const brBatch = brTxt + '\n\n#长期单#\n【编号】：TXY-szxBi150983\n【报价】：180/h\n【地址】：福田区上梅林地铁站\n【年级】：初二\n【科目】：物理\n【课次】：周日10:00-12:00，一周1次';
const brParts = T.splitPostings(brBatch);
eq('中介批量 切出2条', brParts.length, 2);
const b2 = T.parseJobText(brParts[1]);
eq('中介批量 第2条地址', b2.address, '福田区上梅林地铁站');
eq('中介批量 第2条时间', [b2.startMin, b2.endMin], [600, 720]);
eq('中介批量 第2条时薪180', b2.salary, { type: 'hourly', amount: 180 });
eq('中介批量 第2条上课日(10:00别误读成周一)', b2.days, [0]);

// 同一单被转发挤成一行(换行被吃掉)也要能拆出全部字段
const brOneLine = '宝安区：数理化【编号】：TXY-szxBi150982（长期单）【报价】：200-300/h【地址】：宝安区即马安山地铁口直行500米【年级】：高三女【科目】：数理化【课次】：周六（具体时间时间可协商），一周1次，一次2-4h【要求】：孩子数理化基础比较差，希望教学经验丰富的，数理化能一起教的，尽量要女老师';
const o1 = T.parseJobText(brOneLine);
eq('单行中介单 判为中介格式', T.isBracketPosting(brOneLine), true);
eq('单行中介单 地址', o1.address, '宝安区马安山地铁口');
eq('单行中介单 上课日', o1.days, [6]);
eq('单行中介单 每周1次', o1.timesPerWeek, 1);
eq('单行中介单 时长按最短2h', o1.durMin, 120);
eq('单行中介单 时薪区间', o1.salary, { type: 'hourly', amount: 200, amountMax: 300 });
eq('单行中介单 标签', o1.label, '数理化 · TXY-szxBi150982');
eq('单行中介单 备注', /高三/.test(o1.note) && /女/.test(o1.note) && /长期单/.test(o1.note) && /2-4小时/.test(o1.note) && /教学经验丰富/.test(o1.note), true);

// 【标签】后不带冒号的写法
const brNoColon = '【编号】TXY-001（长期单）\n【报价】200-300/h\n【地址】宝安区马安山地铁口直行500米\n【年级】高三女\n【科目】数理化\n【课次】周六，一周1次，一次2-4h';
const n1 = T.parseJobText(brNoColon);
eq('无冒号中介单 判为中介格式', T.isBracketPosting(brNoColon), true);
eq('无冒号中介单 地址', n1.address, '宝安区马安山地铁口');
eq('无冒号中介单 上课日', n1.days, [6]);
eq('无冒号中介单 时薪区间', n1.salary, { type: 'hourly', amount: 200, amountMax: 300 });
eq('无冒号中介单 时长', n1.durMin, 120);
eq('无冒号中介单 标签', n1.label, '数理化 · TXY-001');

// 批量:两单各挤成一行,按【编号】切分
const brOneBatch = '宝安区：数理化【编号】：TXY-001【报价】：200-300/h【地址】：宝安区马安山地铁口【年级】：高三女【科目】：数理化【课次】：周六，一周1次，一次2-4h\n福田区：物理【编号】：TXY-002【报价】：180/h【地址】：福田区上梅林地铁站【年级】：初二【科目】：物理【课次】：周日10:00-12:00，一周1次';
const brOneParts = T.splitPostings(brOneBatch);
eq('单行批量 切出2条', brOneParts.length, 2);
const ob1 = T.parseJobText(brOneParts[0]);
eq('单行批量 第1条地址', ob1.address, '宝安区马安山地铁口');
eq('单行批量 第1条标签', ob1.label, '数理化 · TXY-001');
eq('单行批量 第1条上课日', ob1.days, [6]);
const ob2 = T.parseJobText(brOneParts[1]);
eq('单行批量 第2条地址', ob2.address, '福田区上梅林地铁站');
eq('单行批量 第2条时间', [ob2.startMin, ob2.endMin], [600, 720]);
eq('单行批量 第2条标签', ob2.label, '物理 · TXY-002');
eq('单行批量 第2条上课日(10:00别误读成周一)', ob2.days, [0]);

// 批量:表头行(福田区：物理)要归到下一单,不污染上一单
const brMultBatch = '【编号】：TXY-001【地址】：宝安区马安山地铁口【年级】：高三女【科目】：数理化【课次】：周六，一周1次\n福田区：物理\n【编号】：TXY-002【报价】：180/h【地址】：福田区上梅林地铁站【年级】：初二【科目】：物理【课次】：周日10:00-12:00';
const brMultParts = T.splitPostings(brMultBatch);
eq('多行批量 切出2条', brMultParts.length, 2);
eq('多行批量 表头归下一单', brMultParts[1].indexOf('福田区：物理'), 0);
eq('多行批量 上一单不被污染', brMultParts[0].indexOf('福田区'), -1);

console.log('--- 智能选单评分(通勤最短优先,其次薪资) ---');
eq('每周次数:一周3次', T.candidateSessions({ timesPerWeek: '3', days: [] }), 3);
eq('每周次数:只有上课日', T.candidateSessions({ timesPerWeek: '', days: [0, 6] }), 2);
eq('每周次数:信息不全按1', T.candidateSessions({ timesPerWeek: '', days: [] }), 1);
eq('周收入:时薪100每次2h每周1次', Math.round(T.estimateWeeklyIncome({ payType: 'hourly', amount: '100', durMin: '120', timesPerWeek: '1' })), 200);
eq('周收入:每次200每周3次', T.estimateWeeklyIncome({ payType: 'per', amount: '200', timesPerWeek: '3' }), 600);
eq('周收入:月薪4000折算周', Math.round(T.estimateWeeklyIncome({ payType: 'monthly', amount: '4000' })), 924);
eq('周收入:没填金额返回null', T.estimateWeeklyIncome({ payType: 'hourly', amount: '' }), null);
var ranked = T.rankCandsByScore([
  { label: 'A', commute: 300, income: 500 },
  { label: 'B', commute: 120, income: 200 },
  { label: 'C', commute: 120, income: 600 },
  { label: 'D', commute: null, income: 900 },
  { label: 'E', commute: null, income: 100 }
]);
eq('排序:通勤最短优先', ranked.map(function (r) { return r.label; }).join(','), 'C,B,A,D,E');
eq('排序:同通勤比薪资', ranked[0].label, 'C');
eq('排序:通勤未知排最后按收入', ranked.slice(3).map(function (r) { return r.label; }).join(','), 'D,E');

console.log('--- 采用新单(勾选且已排好时间/日子才可采用) ---');
var adBl = { use: true, start: '10:00', end: '12:00', days: [6] };
eq('可采:勾选+时间+日子齐', T.adoptableCands([Object.assign({}, adBl)]).length, 1);
eq('可采跳过:没勾选', T.adoptableCands([Object.assign({}, adBl, { use: false })]).length, 0);
eq('可采跳过:没排时间', T.adoptableCands([Object.assign({}, adBl, { start: '', end: '' })]).length, 0);
eq('可采跳过:没选日子', T.adoptableCands([Object.assign({}, adBl, { days: [] })]).length, 0);
eq('可采只挑合格的', T.adoptableCands([Object.assign({}, adBl, { use: false }), Object.assign({}, adBl)]).length, 1);

console.log('--- 手动通勤模式(高德不可用时的兜底) ---');
T.state.settings.manual = { on: false, home: 30, hop: 20 };
eq('手动:家↔单默认30分', T.manualLegMin('home', 'j0', { home: null, j0: { homeMin: '' } }), 30);
eq('手动:家↔单用卡片分钟', T.manualLegMin('home', 'j0', { home: null, j0: { homeMin: '45' } }), 45);
eq('手动:单↔单用转场默认', T.manualLegMin('j0', 'j1', { j0: {}, j1: {} }), 20);
T.state.settings.manual = { on: true, home: 25, hop: 15 };
eq('手动:默认改为25分', T.manualLegMin('home', 'j1', { home: null, j1: {} }), 25);
eq('手动:转场改为15分', T.manualLegMin('j1', 'j2', { j1: {}, j2: {} }), 15);
// 手动模式下不要求 key/城市(住址仍要填),在线模式恢复要求
T.state.settings.key = ''; T.state.settings.city = '';
var manErr = T.validate().errs;
eq('手动模式:不要求key', manErr.some(function (e) { return /Key/.test(e); }), false);
eq('手动模式:不要求城市', manErr.some(function (e) { return /城市/.test(e); }), false);
T.state.settings.manual = { on: false, home: 30, hop: 20 };
eq('在线模式:恢复要求key', T.validate().errs.some(function (e) { return /Key/.test(e); }), true);
T.state.settings.key = '613e32a79222f9e37d90a7de40dd009d'; T.state.settings.city = '深圳市';

console.log('--- planDay 行程规划 ---');
const baseLegs = {
  'home|j0': { status: 'ok', dur: 20, distM: 3000, mode: 'bicycling' },
  'j0|j1': { status: 'ok', dur: 30, distM: 5000, mode: 'bicycling' },
  'j0|home': { status: 'ok', dur: 20, distM: 3000, mode: 'bicycling' },
  'home|j1': { status: 'ok', dur: 20, distM: 3000, mode: 'bicycling' },
  'j1|home': { status: 'ok', dur: 20, distM: 3000, mode: 'bicycling' }
};
const A = { jobIdx: 0, label: '单1', start: 840, end: 960, pay: 200 };

// 场景1: 课间70分钟 → 直接前往,在附近等待30分钟(17:10-18:40下课,19:00前到家,正常作息无提醒)
let confs = [];
let pd = T.planDay(1, [A, { jobIdx: 1, label: '单2', start: 1030, end: 1120, pay: 120 }], baseLegs, { buffer: 10 }, confs);
eq('场景1 步数', pd.steps.length, 6);
eq('场景1 有一处等待', pd.steps.filter(s => s.type === 'rest').length, 1);
eq('场景1 通勤70分钟', pd.travelMin, 70);
eq('场景1 无冲突', confs.length, 0);

// 场景2: 中间隔3小时 → 自动选择先回家(在家休息130分钟)
confs = [];
pd = T.planDay(1, [A, { jobIdx: 1, label: '单2', start: 1140, end: 1260, pay: 120 }], baseLegs, { buffer: 10 }, confs);
eq('场景2 步数', pd.steps.length, 7);
eq('场景2 回家休息', pd.steps.filter(s => s.type === 'rest')[0].home, true);
eq('场景2 通勤80分钟', pd.travelMin, 80);

// 场景3: 中间只隔30分钟,路上要40分钟 → 红色冲突
confs = [];
pd = T.planDay(1, [A, { jobIdx: 1, label: '单2', start: 990, end: 1110, pay: 120 }], baseLegs, { buffer: 10 }, confs);
eq('场景3 有红色冲突', confs.some(c => c.level === 'red'), true);

// 场景4: 两节课时间重叠 → 红色冲突
confs = [];
pd = T.planDay(1, [A, { jobIdx: 1, label: '单2', start: 900, end: 1100, pay: 120 }], baseLegs, { buffer: 10 }, confs);
eq('场景4 重叠冲突', confs.some(c => c.level === 'red'), true);

// 场景5: 路线查询失败 → 黄色警告
confs = [];
const badLegs = Object.assign({}, baseLegs, { 'j0|j1': { status: 'err', err: 'INVALID_USER_KEY', mode: 'bicycling' } });
pd = T.planDay(1, [A, { jobIdx: 1, label: '单2', start: 1020, end: 1140, pay: 120 }], badLegs, { buffer: 10 }, confs);
eq('场景5 有黄色警告', confs.some(c => c.level === 'yellow'), true);

console.log('--- 候选新单 ---');
// 默认状态应已预填用户的三单和空闲时间(打开网页就有,不用点按钮)
eq('默认预填三单', T.state.jobs.filter(j => j.raw).length, 3);
eq('默认预填周五空闲 14-18', T.state.free[5], '14:00-18:00');
eq('默认预填周六空闲 8-19', T.state.free[6], '08:00-19:00');
eq('默认预填周日空闲 8-19', T.state.free[0], '08:00-19:00');
eq('预填三单校验无错误', T.validate().errs.length, 0);
eq('预填三单有效数', T.validate().validJobs.length, 3);
eq('splitPostings 两条', T.splitPostings('【家教】A单周六9-11\n\n【家教】B单周日2-4').length, 2);
eq('splitPostings 无标记单条', T.splitPostings('初二数学,周六9点到11点,地址:南山').length, 1);
eq('splitPostings 空文本', T.splitPostings('  \n ').length, 0);

// evalCandFit 需要布置 state(已接单 + 空闲时间)
var blankJob = { label: '', raw: '', days: [], start: '', end: '', payType: 'hourly', amount: '', address: '', note: '' };
T.state.jobs = [Object.assign({}, blankJob, { raw: 'x', label: '单1', days: [6], start: '09:00', end: '11:00', amount: '100', address: '南山区中山公园地铁站' }), blankJob, blankJob];
T.state.free = ['08:00-19:00', '', '', '', '', '14:00-18:00', '08:00-19:00'];
eq('候选与已接单重叠→红', T.evalCandFit({ days: [6], start: '09:30', end: '10:30' }).level, 'red');
eq('候选落空闲时段→绿', T.evalCandFit({ days: [5], start: '14:00', end: '16:00' }).level, 'green');
eq('候选在空闲时段外→橙', T.evalCandFit({ days: [0], start: '19:00', end: '20:00' }).level, 'orange');
eq('候选未定时间→自动安排提示', T.evalCandFit({ days: [6], start: '', end: '', durMin: '120' }).level, 'green');
eq('候选未定时间未定日→自动挑日提示', T.evalCandFit({ days: [], start: '', end: '' }).level, 'green');
eq('候选未定时间一周3次→挑3天提示', T.evalCandFit({ days: [], start: '', end: '', timesPerWeek: '3' }).text.indexOf('3 天') >= 0, true);
eq('候选只填开始时间→黄', T.evalCandFit({ days: [6], start: '10:00', end: '' }).level, 'yellow');

// validate 是否把勾选的候选计入方案
T.state.cands = [Object.assign({}, blankJob, { raw: 'y', use: true, label: '候选1', days: [5], start: '14:00', end: '16:00', amount: '120', address: '宝安区怀德地铁站' })];
eq('validate 已接+候选=2', T.validate().validJobs.length, 2);
T.state.cands[0].use = false;
eq('validate 候选未勾选不计入', T.validate().validJobs.length, 1);
T.state.cands = [];

// 未定时候选(只勾了上课日、没写时间)能通过校验并标记 untimed
T.state.cands = [Object.assign({}, blankJob, { raw: 'y', use: true, label: '候选1', days: [5], start: '', end: '', durMin: '120', address: '宝安区怀德地铁站' })];
eq('validate 未定时候选无错误', T.validate().errs.length, 0);
eq('validate 未定时候选标 untimed', T.validate().validJobs.filter(x => x.untimed).length, 1);
T.state.cands = [];

console.log('--- optimizeSchedule 排时优化 ---');
// 路线桩:home↔j0/j1 30分钟,j0↔j1 直达90分钟,home↔j2 20,j2 与各点20,j3 与各点15
var optLegs = {
  'home|j0': { status: 'ok', dur: 30, distM: 3000 }, 'j0|home': { status: 'ok', dur: 30, distM: 3000 },
  'home|j1': { status: 'ok', dur: 30, distM: 3000 }, 'j1|home': { status: 'ok', dur: 30, distM: 3000 },
  'j0|j1': { status: 'ok', dur: 90, distM: 9000 }, 'j1|j0': { status: 'ok', dur: 90, distM: 9000 },
  'home|j2': { status: 'ok', dur: 20, distM: 2000 }, 'j2|home': { status: 'ok', dur: 20, distM: 2000 },
  'j0|j2': { status: 'ok', dur: 20, distM: 2000 }, 'j2|j0': { status: 'ok', dur: 20, distM: 2000 },
  'j1|j2': { status: 'ok', dur: 20, distM: 2000 }, 'j2|j1': { status: 'ok', dur: 20, distM: 2000 },
  'home|j3': { status: 'ok', dur: 15, distM: 1500 }, 'j3|home': { status: 'ok', dur: 15, distM: 1500 },
  'j0|j3': { status: 'ok', dur: 15, distM: 1500 }, 'j3|j0': { status: 'ok', dur: 15, distM: 1500 },
  'j1|j3': { status: 'ok', dur: 15, distM: 1500 }, 'j3|j1': { status: 'ok', dur: 15, distM: 1500 },
  'j2|j3': { status: 'ok', dur: 15, distM: 1500 }, 'j3|j2': { status: 'ok', dur: 15, distM: 1500 }
};
var mkJob = (idx, start, end, days, o) => Object.assign(
  { idx, j: {}, start, end, days, untimed: start === null && end === null, label: '', adjustable: false, flexible: false, dur: end != null ? end - start : 0, timesPerWeek: 0, pay: null }, o || {});

// 场景A:无未定时候选 → 已接单保持原时间(偏移没有收益)
T.state.free = ['', '', '', '', '', '', '08:00-19:00'];
var optA = T.optimizeSchedule([
  mkJob(0, 540, 660, [6], { label: '单1', adjustable: true }),
  mkJob(1, 780, 840, [6], { label: '单2' })
], optLegs, { buffer: 10 });
eq('优化A 无收益不微调已接单', optA.shifts.length, 0);
eq('优化A 保持9:00-11:00', [optA.sessions[6][0].start, optA.sessions[6][0].end], [540, 660]);
eq('优化A 总通勤120', optA.total, 120);

// 场景B:候选2小时卡不进10:00-15:00中间的缝隙(需留 通勤+15分钟 余量) → 已接单1前移20分钟腾出位置,总通勤130→100
var optB = T.optimizeSchedule([
  mkJob(0, 600, 720, [6], { label: '单1', adjustable: true }),
  mkJob(1, 900, 960, [6], { label: '单2' }),
  mkJob(2, null, null, [6], { label: '候选1', flexible: true, dur: 120 })
], optLegs, { buffer: 10 });
eq('优化B 已接单1前移20分钟', optB.shifts[0].delta, -20);
eq('优化B 候选排到12:20', optB.placements[0].start, 740);
eq('优化B 总通勤100', optB.total, 100);

// 场景C:候选没勾上课日 → 系统挑有窗口的周日,排在已接单之后
T.state.free = ['08:00-19:00', '', '', '', '', '', ''];
var optC = T.optimizeSchedule([
  mkJob(0, 600, 720, [0], { label: '单3' }),
  mkJob(2, null, null, [], { label: '候选1', flexible: true, dur: 120 })
], optLegs, { buffer: 10 });
eq('优化C 未定日候选挑到周日', optC.placements[0].days, [0]);
eq('优化C 固定已接单不动', optC.shifts.length, 0);
eq('优化C 候选排到12:40(留15分钟余量)', optC.placements[0].start, 760);
eq('优化C 总通勤70', optC.total, 70);

// 场景D:候选10小时,所有缝隙都放不下 → 不排入方案并给出橙色提示
T.state.free = ['', '', '', '', '', '', '08:00-19:00'];
var optD = T.optimizeSchedule([
  mkJob(0, 540, 660, [6], { label: '单1' }),
  mkJob(1, 780, 840, [6], { label: '单2' }),
  mkJob(2, null, null, [6], { label: '候选1', flexible: true, dur: 600 })
], optLegs, { buffer: 10 });
eq('优化D 放不下→不排入候选', optD.placements.length, 0);
eq('优化D 定时课照常保留', optD.sessions[6].length, 2);
eq('优化D 给一条橙色提示', optD.notes.length, 1);
eq('优化D 提示级别orange', optD.notes[0].level, 'orange');

// 场景E:两个未定时候选,枚举排列后塞进缝隙;候选2(60分钟)刚好卡进早缝,无需前移已接单
T.state.free = ['', '', '', '', '', '', '08:00-19:00'];
var optE = T.optimizeSchedule([
  mkJob(0, 540, 660, [6], { label: '单1', adjustable: true }),
  mkJob(1, 780, 840, [6], { label: '单2' }),
  mkJob(2, null, null, [6], { label: '候选1', flexible: true, dur: 120 }),
  mkJob(3, null, null, [6], { label: '候选2', flexible: true, dur: 60 })
], optLegs, { buffer: 10 });
eq('优化E 两候选都排下', optE.placements.length, 2);
eq('优化E 一天4节课', optE.sessions[6].length, 4);
eq('优化E 已接单保持原时间', optE.shifts.length, 0);
eq('优化E 总通勤100', optE.total, 100);
eq('优化E 候选塞进缝隙', optE.placements.map(p => p.start).sort((a, b) => a - b).join(','), '690,880');
eq('优化E 课程按时间排序', optE.sessions[6].map(x => x.start).join(','), '540,690,780,880');

// 场景F:一周2次、没写日子 → 自动挑 2 个空闲日(周日+周六),各天同时段
T.state.free = ['08:00-19:00', '', '', '', '', '', '08:00-19:00'];
var optF = T.optimizeSchedule([
  mkJob(0, 600, 720, [0], { label: '单3' }),
  mkJob(2, null, null, [], { label: '候选1', flexible: true, dur: 120, timesPerWeek: 2 })
], optLegs, { buffer: 10 });
eq('优化F 挑中周日+周六', optF.placements[0].days, [0, 6]);
eq('优化F 两天同时段12:40', optF.placements[0].start, 760);
eq('优化F 周日两节/周六一节', [optF.sessions[0].length, optF.sessions[6].length], [2, 1]);
eq('优化F 总通勤110', optF.total, 110);

// 场景G:一周3次但只有2个空闲日 → 放不下,给橙色提示
T.state.free = ['08:00-19:00', '', '', '', '', '', '08:00-19:00'];
var optG = T.optimizeSchedule([
  mkJob(0, 600, 720, [0], { label: '单3' }),
  mkJob(2, null, null, [], { label: '候选1', flexible: true, dur: 120, timesPerWeek: 3 })
], optLegs, { buffer: 10 });
eq('优化G 空闲日不够→候选跳过', optG.placements.length, 0);
eq('优化G 定时课照常保留', optG.sessions[0].length, 1);
eq('优化G 给橙色提示', optG.notes.length, 1);

// 场景H:家长给定时间的固定单超出作息(16:30-21:00)→ 只提示不否定,未定时候选照常排
var legsH = {};
['j0', 'j1', 'j2'].forEach(function (a) {
  legsH['home|' + a] = { status: 'ok', dur: 20, distM: 3000 };
  legsH[a + '|home'] = { status: 'ok', dur: 20, distM: 3000 };
  ['j0', 'j1', 'j2'].forEach(function (b) { if (a !== b) legsH[a + '|' + b] = { status: 'ok', dur: 20, distM: 3000 }; });
});
T.state.free = ['08:00-19:00', '08:00-19:00', '', '', '', '', '08:00-19:00'];
var optH = T.optimizeSchedule([
  mkJob(0, 600, 720, [0], { label: '单3', adjustable: true }),
  mkJob(1, 990, 1260, [1], { label: '固定晚课' }),
  mkJob(2, null, null, [], { label: '候选1', flexible: true, dur: 120 })
], legsH, { buffer: 15 });
eq('优化H 固定单超作息不否定方案', optH.sessions != null, true);
eq('优化H 周一保留固定晚课', [optH.sessions[1][1].start, optH.sessions[1][1].end], [990, 1260]);
eq('优化H 候选排到周一', optH.placements[0].days, [1]);
eq('优化H 候选12:30开课(空隙<90分钟走直达)', optH.placements[0].start, 750);
eq('优化H 已接单不动', optH.shifts.length, 0);

// 场景I:定时课互相冲突(固定单与已接单重叠)→ 不放弃,候选排到别的天,冲突留给红色提示
T.state.free = ['08:00-19:00', '', '', '', '', '', '08:00-19:00'];
var optI = T.optimizeSchedule([
  mkJob(0, 540, 660, [6], { label: '单1', adjustable: true }),
  mkJob(1, 600, 720, [6], { label: '固定课' }),
  mkJob(2, null, null, [], { label: '候选1', flexible: true, dur: 120 })
], legsH, { buffer: 15 });
eq('优化I 定时课冲突不放弃', optI.sessions != null, true);
eq('优化I 周六保留两节冲突课', optI.sessions[6].length, 2);
eq('优化I 候选排到周日', optI.placements[0].days, [0]);
eq('优化I 候选8:40开课', optI.placements[0].start, 520);
eq('优化I 已接单不动', optI.shifts.length, 0);

console.log('--- 其他 ---');
eq('parseFreeRanges', T.parseFreeRanges('10:00-12:00, 19:00-22:00'), [[600, 720], [1140, 1320]]);
eq('fmtTime 11:30', T.fmtTime(690), '11:30');
eq('fmtDur 1小时35分钟', T.fmtDur(95), '1小时35分钟');

// HTML 显隐机制回归:结果区/复制按钮必须用 hidden 类控制(代码只操作 classList),
// 若 HTML 里带 hidden 属性,浏览器原生 [hidden]{display:none} 会让结果区永远显示不出来
console.log('--- HTML 显隐机制回归 ---');
var resTag = html.match(/<section id="results"[^>]*>/);
var copyTag = html.match(/<button[^>]*id="btn-copy"[^>]*>/);
eq('results 无 hidden 属性', /\shidden(?=[\s>])/.test(resTag ? resTag[0] : ''), false);
eq('results 有 hidden 类', /class="[^"]*\bhidden\b/.test(resTag ? resTag[0] : ''), true);
eq('btn-copy 无 hidden 属性', /\shidden(?=[\s>])/.test(copyTag ? copyTag[0] : ''), false);
eq('btn-copy 有 hidden 类', /class="[^"]*\bhidden\b/.test(copyTag ? copyTag[0] : ''), true);
var adoptTag = html.match(/<button[^>]*id="btn-adopt"[^>]*>/);
eq('btn-adopt 无 hidden 属性', /\shidden(?=[\s>])/.test(adoptTag ? adoptTag[0] : ''), false);
eq('btn-adopt 有 hidden 类', /class="[^"]*\bhidden\b/.test(adoptTag ? adoptTag[0] : ''), true);

if (fail) { console.log('\n' + fail + ' 个用例失败 ✗'); process.exit(1); }
console.log('\n全部 ' + '通过 ✓');
