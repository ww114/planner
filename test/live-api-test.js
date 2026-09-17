// 用真实 Key 联调高德接口(UTF-8 编码,与浏览器行为一致)
const KEY = '613e32a79222f9e37d90a7de40dd009d';

async function j(url) {
  const r = await fetch(url);
  return r.json();
}

async function geo(addr) {
  const u = 'https://restapi.amap.com/v3/geocode/geo?' + new URLSearchParams({ key: KEY, address: addr, city: '深圳市' });
  const d = await j(u);
  if (d.status !== '1') return { addr, err: d.info, infocode: d.infocode };
  const g = d.geocodes[0];
  return { addr, formatted: g.formatted_address, loc: g.location, level: g.level };
}

// 与 index.html 的 routeLeg 相同逻辑:公交规划接口 + 只保留纯地铁方案
async function metroRoute(o, d) {
  const u = 'https://restapi.amap.com/v3/direction/transit/integrated?' + new URLSearchParams({ key: KEY, origin: o, destination: d, city: '深圳市', strategy: 0 });
  const res = await j(u);
  if (res.status !== '1') return { err: res.info, infocode: res.infocode };
  const transits = (res.route && res.route.transits) || [];
  const info = transits.map(t => ({
    dur: Math.round(t.duration / 60),
    cost: t.cost,
    lines: (t.segments || []).filter(s => s.bus && s.bus.buslines).map(s => s.bus.buslines.map(bl => bl.name + '/' + bl.type).join(','))
  }));
  const metro = transits.filter(t => {
    const rides = (t.segments || []).filter(s => s.bus && s.bus.buslines && s.bus.buslines.length);
    return rides.length > 0 && rides.every(s => s.bus.buslines.some(bl => (bl.type || '').indexOf('地铁') >= 0));
  }).sort((x, y) => x.duration - y.duration);
  const p = metro[0];
  if (p) return { durMin: Math.round(p.duration / 60), distKm: (+p.distance / 1000).toFixed(1), cost: p.cost, 总方案数: transits.length, 纯地铁方案数: metro.length, info };
  // 无纯地铁方案 → 直线距离≤2.5km 时步行兜底(与 index.html 相同逻辑)
  const [lng1, lat1] = o.split(',').map(Number);
  const [lng2, lat2] = d.split(',').map(Number);
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const dKm = 2 * R * Math.asin(Math.sqrt(h));
  if (dKm <= 2.5) {
    const wu = 'https://restapi.amap.com/v3/direction/walking?' + new URLSearchParams({ key: KEY, origin: o, destination: d });
    const wres = await j(wu);
    const wp = wres.route && wres.route.paths && wres.route.paths[0];
    return wp ? { walkFallback: true, durMin: Math.max(5, Math.round(wp.duration / 60)), distKm: (+wp.distance / 1000).toFixed(1), cost: null }
              : { walkFallback: true, 估算: true, durMin: Math.max(5, Math.round(dKm * 15)), distKm: dKm.toFixed(1) };
  }
  return { err: '无纯地铁方案', 方案数: transits.length, info };
}

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  console.log('--- 地理编码(用户真实三单) ---');
  const home = await geo('哈尔滨工业大学深圳校区');
  await sleep(500);
  const j1 = await geo('南山区中山公园地铁站');
  await sleep(500);
  const j2 = await geo('光明区将围地铁站');
  await sleep(500);
  const j3 = await geo('宝安区怀德地铁站');
  console.log(JSON.stringify({ home, j1, j2, j3 }, null, 1));

  console.log('--- 纯地铁路线(周六/周日全部腿) ---');
  const legs = [
    ['家→中山公园(周六早)', home, j1],
    ['中山公园→将围(周六课间直连)', j1, j2],
    ['将围→家(周六晚)', j2, home],
    ['家→怀德(周日早)', home, j3],
    ['怀德→家(周日午)', j3, home]
  ];
  for (const [name, a, b] of legs) {
    if (a.loc && b.loc) {
      console.log(name + ':', JSON.stringify(await metroRoute(a.loc, b.loc), null, 1));
      await sleep(500);
    }
  }
})();
