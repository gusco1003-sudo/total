const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/'+name,'utf8');
class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-11-02T03:00:00Z']));}static now(){return Date.parse('2026-11-02T03:00:00Z');}}
function harness(){
  const context=vm.createContext({Date:FixedDate,console,document:{addEventListener(){}},window:{addEventListener(){}},setInterval(){}});
  for(const name of ['daily-storage-core.js','cost-ledger-core.js','newhansol-core.js'])vm.runInContext(read(name),context);
  const main=[...read('index.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('const CLIENTS ='))[1];
  vm.runInContext(main,context);
  return {context,run:code=>vm.runInContext(code,context)};
}
function ledger(app,qty,rate){return {app,version:1,settings:{storageRate:rate,vatRate:.1},storage:{'2026-10-31':{qty,rate}},works:[]};}
for(const [key,qty,rate] of [['aekyung',19,900],['foodtravel',11,700],['newhansol',5,1000]]){
  test(key+' carries across months, caps at KST today, and leaves records untouched',()=>{
    const {context,run}=harness(),data=ledger(key,qty,rate),before=JSON.stringify(data);context.input=data;
    run(`store['${key}']=input`);
    const r=run(`calcClient(clientOf('${key}'),'2026-11')`);
    assert.equal(r.storage,qty*rate*2);assert.equal(r.vat,r.storage*.1);assert.equal(r.total,r.storage*1.1);
    assert.equal(r.days.length,2);assert(r.days.every(d=>d.automatic&&d.sourceDate==='2026-10-31'));
    assert.equal(JSON.stringify(data),before);
    assert.match(run(`calculationDetail('${key}','2026-11').body`),/자동 이월/);
    assert.equal(run(`calcClient(clientOf('${key}'),'2026-12').total`),0);
  });
}
test('explicit quantity/rate changes and zero override carry; never backfill before first record',()=>{
  const {context,run}=harness();context.input=ledger('aekyung',19,900);
  context.input.storage['2026-11-01']={qty:4,rate:700};context.input.storage['2026-11-02']={qty:0,rate:700};
  const r=run("CostLedger.calculate(input,'2026-10-30','2026-11-30')");
  assert.equal(r.days.length,3);assert.equal(r.storage,17100+2800);assert.equal(r.days.at(-1).qty,0);
  assert.equal(run("CostLedger.calculate(input,'2026-10-01','2026-10-30').storage"),0);
});
test('interior gaps, leap day and year rollover carry correctly',()=>{
  const {context,run}=harness();context.input={'2024-02-28':{qty:3,rate:700},'2024-03-02':{qty:0,rate:700}};
  const rows=run("DailyStorage.days(input,'2024-02-28','2024-03-03','2026-11-02')");
  assert.equal(rows.length,5);assert.equal(rows.reduce((s,r)=>s+r.amount,0),6300);
  context.input={'2025-12-31':{qty:1,rate:900}};
  assert.equal(run("DailyStorage.days(input,'2026-01-01','2026-01-31','2026-01-02').length"),2);
});
test('existing explicit history and unit/total work fees retain their amounts',()=>{
  const {context,run}=harness();context.input=ledger('foodtravel',11,700);
  context.input.works=[{id:'total',date:'2026-10-31',desc:'운송',qty:3,rate:999,amount:12345,mode:'total',category:'etc',memo:''},{id:'unit',date:'2026-10-31',desc:'입고',qty:2,rate:5000,mode:'unit',category:'inFee',memo:''}];
  const r=run("CostLedger.calculate(input,'2026-10-01','2026-10-31')");
  assert.equal(r.storage,7700);assert.equal(r.etc,12345);assert.equal(r.inFee,10000);assert.equal(r.vat,3005);
});
test('SB partial shipments retain handling fees; planned events affect neither storage nor charges/detail',()=>{
  const {context,run}=harness();context.input={events:[
    {type:'in',date:'2026-10-31',qty:3},
    {type:'out',date:'2026-11-01',qty:1,stockQty:0,product:'부분 출고'},
    {type:'out',date:'2026-11-01',qty:2,status:'planned',product:'예정 상품'}
  ]};run('store.sbnutrition=input');
  let r=run("calcClient(clientOf('sbnutrition'),'2026-11')");
  assert.equal(r.storage,5400);assert.equal(r.outFee,5000);assert.equal(r.total,11440);
  assert(!run("calculationDetail('sbnutrition','2026-11').body").includes('예정 상품'));
  run("input.events[2].status='completed';calcCache={}");
  r=run("calcClient(clientOf('sbnutrition'),'2026-11')");
  assert.equal(r.storage,3600);assert.equal(r.outFee,15000);
});
test('other settlement clients retain courier deductions and fees',()=>{
  const {context,run}=harness();context.input={events:[{type:'in',date:'2026-10-31',qty:3},{type:'out',date:'2026-11-01',method:'courier',count:10,deductPlt:1}]};
  run('store.nineblackkitchen=input');const r=run("calcClient(clientOf('nineblackkitchen'),'2026-11')");
  assert.equal(r.storage,4000);assert.equal(r.outFee,50000);
});
