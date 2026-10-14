const test=require('node:test'),assert=require('node:assert/strict'),C=require('./neulbom-core.js');
function sample(){return {app:'neulbom',version:1,unit_price:2400,vat:'exclusive',updated_at:'2026-10-14T14:00:00+09:00',shipments:{'2026-10-12':2},entries:[
 {id:1,day:'2026-10-12',kind:'receipt',goods_boxes:100,pallets:0,hose_boxes:0,voided:0},
 {id:2,day:'2026-10-12',kind:'outbound',goods_boxes:20,pallets:1,hose_boxes:2,voided:0}],europlus_entries:[
 {id:3,day:'2026-10-12',kind:'receipt',goods_boxes:30,pallets:1,hose_boxes:0,voided:0},
 {id:4,day:'2026-10-13',kind:'outbound',goods_boxes:5,pallets:0,hose_boxes:0,voided:0}]};}
test('Europlus is independent from Eurox, hose net, stock snapshots and fees',()=>{
 const data=sample(),before={...data,europlus_entries:[]},stock={revision:1,updated_at:data.updated_at,hose:{quantity:1000,baseline:0,day:'2026-10-12'},goods:{quantity:80,baseline:-22,day:'2026-10-12'}};
 assert.deepEqual(C.calculate(data,'2026-10-12','2026-10-14'),C.calculate(before,'2026-10-12','2026-10-14'));
 assert.deepEqual(C.inventory(data,stock),C.inventory(before,stock));assert.deepEqual(C.stockNet(data),C.stockNet(before));
 assert.equal(C.inventory(data,stock).hose,948);assert.equal(C.calculate(data,'2026-10-12','2026-10-14').total,5280);
 const ep=C.europlus(data,'2026-10-12','2026-10-14','2026-10-14');assert.equal(ep.remaining,25);assert.equal(ep.received,30);assert.equal(ep.outbound,5);
});
test('period, cancellation, restoration and replacement snapshots do not duplicate Europlus',()=>{
 const d=sample();let r=C.europlus(d,'2026-10-12','2026-10-12','2026-10-14');assert.equal(r.remaining,25);assert.equal(r.closing,30);assert.equal(r.outbound,0);
 d.europlus_entries[1].voided=1;assert.equal(C.europlus(d,'2026-10-12','2026-10-14').remaining,30);
 d.europlus_entries[1].voided=0;d.europlus_entries[1].goods_boxes=7;assert.equal(C.europlus(d,'2026-10-12','2026-10-14').remaining,23);
 assert.deepEqual(C.europlus(d,'2026-10-12','2026-10-14'),C.europlus(structuredClone(d),'2026-10-12','2026-10-14'));
 d.europlus_entries[0].voided=1;assert.equal(C.europlus(d,'2026-10-12','2026-10-14').remaining,null);
});
test('legacy missing entries and Firebase objects work; mixed IDs and hose deductions fail closed',()=>{
 const d=sample();delete d.europlus_entries;assert.equal(C.europlus(d,'2026-10-12','2026-10-14').remaining,null);
 d.europlus_entries=Object.fromEntries(sample().europlus_entries.map(e=>[e.id,e]));assert.equal(C.europlus(d,'2026-10-12','2026-10-14').remaining,25);
 for(const change of [d=>d.europlus_entries[0].id=1,d=>d.europlus_entries[0].hose_boxes=1,d=>d.europlus_entries[0].goods_boxes=-1,d=>d.europlus_entries[0].day='2026-02-30']){const data=sample();change(data);assert.throws(()=>C.normalize(data));}
});

test('integrated form sends Europlus through existing bridge and supports edit, void, restore',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const nodes=new Map(),messages=[];let data=sample();const listeners={};
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',checked:false,hidden:false,disabled:false,files:[],dataset:{},classList:{toggle(){}},addEventListener(){},replaceChildren(){this.innerHTML='';},scrollIntoView(){},reset(){if(this===el('entryForm'))for(const [key,v]of Object.entries({entryProduct:'eurox',entryKind:'receipt',entryGoods:'0',entryPallets:'0',entryHose:'0',entryParty:'',entryNote:''}))el(key).value=v;}});return nodes.get(id);};
 const popup={closed:false,postMessage(m){messages.push(m);let result={};
  if(m.op==='add'){data.europlus_entries.push({...m.body,id:5,revision:1,voided:0});result=data.europlus_entries.at(-1);}
  if(m.op==='edit'){Object.assign(data.europlus_entries.find(e=>e.id===m.entryId),m.body,{revision:2});}
  if(m.op==='void'){Object.assign(data.europlus_entries.find(e=>e.id===m.entryId),m.body,{revision:m.body.revision+1,voided:Number(m.body.voided)});}
  if(m.op==='read')result=structuredClone(data);
  queueMicrotask(()=>listeners.message({source:popup,origin:'https://bless-reshuffle-vest.ngrok-free.dev',data:{...m,type:'result',result}}));
 }};
 const stockFixture={revision:1,updated_at:data.updated_at};
 const auth={currentUser:{uid:'owner'},onAuthStateChanged(){}},A={auth,owner:()=>true,read:async p=>p.endsWith('/source')?structuredClone(data):p.endsWith('/inventory')?structuredClone(stockFixture):null,write:async()=>{}};
 const context=vm.createContext({NeulbomAuth:A,Neulbom:{...C,today:()=> '2026-10-14'},crypto:require('node:crypto'),document:{body:{dataset:{mode:'admin'}},getElementById:el,querySelectorAll:()=>[]},window:{addEventListener:(type,fn)=>listeners[type]=fn,open:()=>popup},location:{origin:'https://gusco1003-sudo.github.io'},URL,URLSearchParams,Intl,Date,Number,Promise,Set,Map,AbortSignal,setTimeout,clearTimeout,setInterval(){},console});
 vm.runInContext(fs.readFileSync('neulbom-page.js','utf8'),context);context.fixture=data;context.stockFixture=stockFixture;
 vm.runInContext('stock=stockFixture;data=C.normalize(fixture);render();',context);
 el('connect').onclick();vm.runInContext('connected=true;',context);
 el('entryProduct').value='europlus';el('entryHose').value='8';el('entryProduct').onchange();assert.equal(el('entryHose').value,0);assert.equal(el('entryHoseField').hidden,true);
 el('entryGoods').value='10';el('entryParty').value='시험 입고처';el('entryForm').onsubmit({preventDefault(){}});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.equal(messages[0].body.product,'europlus');assert.equal(messages[0].body.hose_boxes,0);assert.equal(el('europlusRemaining').textContent,'35 박스');
 el('entries').onclick({target:{closest:()=>({dataset:{edit:'5'}})}});await new Promise(setImmediate);assert.equal(el('entryProduct').value,'europlus');assert.equal(el('entryGoods').value,10);
 el('entryGoods').value='12';el('entryForm').onsubmit({preventDefault(){}});for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.equal(el('europlusRemaining').textContent,'37 박스');assert.equal(messages.find(m=>m.op==='edit').body.product,'europlus');
 for(const expected of ['25 박스','37 박스']){await el('entries').onclick({target:{closest:()=>({dataset:{void:'5'}})}});assert.equal(el('europlusRemaining').textContent,expected);}
 assert.equal(el('remaining').textContent,'78 개');assert.match(el('entries').innerHTML,/유로플러스/);assert.match(el('entries').innerHTML,/제품에 포함/);
});
