// 用真实高德数据跑完整 buildPlan+renderResults,复现"生成方案后无输出"
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);

global.window = {};
global.document = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = {};
global.alert = () => {};

// 真实高德接口(fetch 版,与 index.html 的 geocode/routeLeg 语义一致:QPS 重试、只纯地铁、近距步行兜底、错误转 {status:'err'})
const NET_STUB = `
;sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
var KEY='613e32a79222f9e37d90a7de40dd009d';
var CITY='深圳市';
function jfetch(url,timeout){
  return new Promise(function(res,rej){
    var c=new AbortController();
    var t=setTimeout(function(){c.abort();rej(new Error('请求超时,请检查网络'));},timeout||20000);
    fetch(url,{signal:c.signal}).then(function(r){clearTimeout(t);return r.json();}).then(function(d){
      clearTimeout(t);
      if(d&&d.status==='1')res(d);
      else rej(new Error((d&&d.info)?d.info:'接口返回异常'));
    },function(e){clearTimeout(t);rej(new Error('网络请求失败:'+e.message));});
  });
}
function withQpsRetry(fn){
  return fn().catch(function(e){
    var msg=e&&e.message?e.message:String(e);
    if(/CUQPS|QPS|10021/.test(msg))return sleep(1500).then(fn);
    throw e;
  });
}
geocode=function(addr){
  var u='https://restapi.amap.com/v3/geocode/geo?key='+KEY+'&address='+encodeURIComponent(String(addr).trim())+'&city='+encodeURIComponent(CITY);
  return withQpsRetry(function(){return jfetch(u);}).then(function(d){
    if(!d.geocodes||!d.geocodes.length)throw new Error('未找到该地址');
    var g=d.geocodes[0];
    var parts=g.location.split(',');
    return {lng:parts[0],lat:parts[1],formatted:g.formatted_address};
  });
};
routeLeg=function(a,b,mode){
  var u='https://restapi.amap.com/v3/direction/transit/integrated?key='+KEY+'&origin='+encodeURIComponent(a.lng+','+a.lat)+'&destination='+encodeURIComponent(b.lng+','+b.lat)+'&city='+encodeURIComponent(CITY)+'&strategy=0';
  return withQpsRetry(function(){return jfetch(u);}).then(function(data){
    var transits=(data.route&&data.route.transits)||[];
    var metro=transits.filter(function(t){
      var rides=(t.segments||[]).filter(function(seg){return seg.bus&&seg.bus.buslines&&seg.bus.buslines.length;});
      return rides.length>0&&rides.every(function(seg){return seg.bus.buslines.some(function(bl){return (bl.type||'').indexOf('地铁')>=0;});});
    }).sort(function(x,y){return x.duration-y.duration;});
    var p=metro[0];
    if(p)return {status:'ok',dur:Math.round(p.duration/60),distM:Math.round(+p.distance),cost:(p.cost!=null?+p.cost:null),mode:mode};
    var R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
    var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    var dKm=2*R*Math.asin(Math.sqrt(h));
    if(dKm<=2.5){
      var wu='https://restapi.amap.com/v3/direction/walking?key='+KEY+'&origin='+encodeURIComponent(a.lng+','+a.lat)+'&destination='+encodeURIComponent(b.lng+','+b.lat);
      return withQpsRetry(function(){return jfetch(wu);}).then(function(wd){
        var wp=wd.route&&wd.route.paths&&wd.route.paths[0];
        var wres=wp
          ?{status:'ok',dur:Math.max(5,Math.round(wp.duration/60)),distM:Math.round(+wp.distance),cost:null,walkFallback:true,mode:mode}
          :{status:'ok',dur:Math.max(5,Math.round(dKm*15)),distM:Math.round(dKm*1000),cost:null,walkFallback:true,mode:mode};
        return wres;
      }).catch(function(){
        return {status:'ok',dur:Math.max(5,Math.round(dKm*15)),distM:Math.round(dKm*1000),cost:null,walkFallback:true,mode:mode};
      });
    }
    throw new Error('无纯地铁方案(需乘公交,已按"只地铁"要求跳过)');
  }).catch(function(e){
    return {status:'err',err:e&&e.message?e.message:String(e),mode:mode};
  });
};
`;
try {
  (0, eval)(m[1] + NET_STUB);
} catch (e) {
  console.log('!!! eval 失败:', e && e.stack ? e.stack : e);
  process.exit(1);
}

function fakeEl() {
  return { classList: { add() {}, remove() {} }, innerHTML: '', textContent: '', hidden: false, value: '', scrollIntoView() {} };
}
global.document = { getElementById: () => fakeEl() };

const T = global.window.__test;
if (!T) { console.log('!!! __test 未挂载'); process.exit(1); }

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
T.state.geoCache = {};

const batch = require('./batch-data.js');

async function main() {
  try {
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

    const t0 = Date.now();
    let lastMsg = '';
    const plan = await T.buildPlan(msg => { lastMsg = msg; });
    console.log('buildPlan 完成,用时', Math.round((Date.now() - t0) / 1000), '秒,最后进度:', lastMsg);
    if (!plan) { console.log('!!! plan 为 null/undefined'); return; }
    if (plan.fatal) { console.log('!!! fatal:'); plan.fatal.forEach(f => console.log('   ', f)); return; }
    console.log('上课日:', JSON.stringify(plan.dayIdxs));
    console.log('冲突数:', plan.conflicts.length);
    plan.conflicts.forEach(c => console.log('  [' + c.level + '] ' + c.text));
    // 统计腿数据:ok/err/步行兜底 各多少,err 的是哪些
    const legs = {};
    plan.dayPlans && Object.keys(plan.dayPlans).forEach(d => {
      plan.dayPlans[d].steps.forEach(st => {
        if (st.type === 'leg' && st.leg) {
          const k = (st.leg.status === 'err' ? 'ERR ' : (st.leg.walkFallback ? 'WALK ' : 'ok   ')) + st.from + '→' + st.to;
          legs[k] = (legs[k] || 0) + 1;
          if (st.leg.status === 'err') console.log('  错误腿:', st.from + '→' + st.to, st.leg.err);
        }
      });
    });
    console.log('腿统计:', JSON.stringify(legs));
    T.renderResults(plan);
    console.log('renderResults 执行完毕,无异常');
  } catch (e) {
    console.log('!!! 异常:', e && e.stack ? e.stack : e);
  }
}
main();
