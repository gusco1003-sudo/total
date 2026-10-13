(function(root){'use strict';
const RATE=2400;
function date(s){return typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());}
function step(s,n=1){return new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
function integer(v){return Number.isSafeInteger(v)&&v>=0&&v<=10000000;}
function normalize(raw){
 const d=structuredClone(raw);
 if(!d||d.app!=='neulbom'||d.version!==1||d.unit_price!==RATE||d.vat!=='exclusive'||typeof d.updated_at!=='string'||isNaN(Date.parse(d.updated_at)))throw Error('늘봄 정산 자료가 아직 연결되지 않았습니다.');
 d.shipments=d.shipments||{};d.entries=Array.isArray(d.entries)?d.entries:Object.values(d.entries||{});d.warnings=d.warnings||[];
 if(typeof d.shipments!=='object'||Array.isArray(d.shipments)||!Array.isArray(d.warnings))throw Error('정산 자료 형식을 확인하세요.');
 for(const [day,n] of Object.entries(d.shipments))if(!date(day)||!integer(n))throw Error('택배 출고 수량 또는 날짜를 확인하세요.');
 const ids=new Set();for(const e of d.entries){
  if(!e||!Number.isSafeInteger(e.id)||ids.has(e.id)||!date(e.day)||!['receipt','outbound'].includes(e.kind)||!['goods_boxes','pallets','hose_boxes'].every(k=>integer(e[k]))||![0,1,false,true].includes(e.voided))throw Error('입출고 기록 또는 중복 번호를 확인하세요.');
  ids.add(e.id);
 }
 return d;
}
function calculate(raw,from,to,asOf=today()){
 const d=normalize(raw);if(!date(from)||!date(to)||!date(asOf)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw Error('조회 기간은 최대 366일로 입력하세요.');
 const active=d.entries.filter(e=>!e.voided),days={};
 const bucket=k=>days[k]||(days[k]={date:k,received:0,parcel_boxes:0,other_boxes:0,pallets:0,hose_boxes:0});
 for(const [k,n] of Object.entries(d.shipments))bucket(k).parcel_boxes=n;
 for(const e of active){const b=bucket(e.day);if(e.kind==='receipt')b.received+=e.goods_boxes;else{b.other_boxes+=e.goods_boxes;b.pallets+=e.pallets;b.hose_boxes+=e.hose_boxes;}}
 function balance(until){let received=0,parcel=0,other=0;for(const [k,b]of Object.entries(days))if(k<=until){received+=b.received;parcel+=b.parcel_boxes;other+=b.other_boxes;}
  return active.some(e=>e.kind==='receipt'&&e.day<=until)?received-parcel-other:null;
 }
 const daily=[];for(let k=from;k<=to;k=step(k)){const b={...bucket(k)};b.remaining=balance(k);b.supply=b.parcel_boxes*RATE;b.vat=Math.round(b.supply/10);b.total=b.supply+b.vat;daily.push(b);}
 const sum=k=>daily.reduce((n,b)=>n+b[k],0),subtotal=sum('supply'),vat=Math.round(subtotal/10);
 if(!Number.isSafeInteger(subtotal+vat))throw Error('정산 금액 범위를 초과했습니다.');
 return {daily,entries:d.entries.filter(e=>e.day>=from&&e.day<=to).sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id),storage:0,inFee:0,outFee:subtotal,etc:0,subtotal,vat,total:subtotal+vat,parcel_boxes:sum('parcel_boxes'),received:sum('received'),other_boxes:sum('other_boxes'),pallets:sum('pallets'),hose_boxes:sum('hose_boxes'),remaining:balance(asOf),closing:balance(to),today_parcels:d.shipments[asOf]||0,updated_at:d.updated_at,warnings:d.warnings};
}
const HOSE_PACK=25;
function stockNet(raw,until=today()){
 const d=normalize(raw);let goods=0,hose=0;
 for(const [day,n] of Object.entries(d.shipments))if(day<=until)goods-=n;
 for(const e of d.entries)if(!e.voided&&e.day<=until){const sign=e.kind==='receipt'?1:-1;goods+=sign*e.goods_boxes;hose+=sign*e.hose_boxes*HOSE_PACK;}
 return {goods,hose};
}
function normalizeInventory(raw){
 if(raw==null)return {revision:0};
 const d=structuredClone(raw);
 if(!integer(d.revision)||d.revision<1||typeof d.updated_at!=='string'||isNaN(Date.parse(d.updated_at)))throw Error('재고 실사 자료를 확인하세요.');
 for(const key of ['goods','hose'])if(d[key]&&(!integer(d[key].quantity)||!Number.isSafeInteger(d[key].baseline)||Math.abs(d[key].baseline)>1000000000||!date(d[key].day)))throw Error('재고 실사 수량을 확인하세요.');
 return d;
}
function inventory(raw,snapshot,asOf=today()){
 const s=normalizeInventory(snapshot),net=stockNet(raw,asOf),fallback=calculate(raw,asOf,asOf,asOf).remaining;
 const value=key=>s[key]&&s[key].day<=asOf?s[key].quantity+net[key]-s[key].baseline:(key==='goods'?fallback:null);
 const goods=value('goods'),hose=value('hose');
 return {goods,hose,hose_pack:HOSE_PACK,hose_boxes:hose==null||hose<0?null:Math.floor(hose/HOSE_PACK),hose_loose:hose==null||hose<0?null:hose%HOSE_PACK,updated_at:s.updated_at||null};
}
const api={RATE,HOSE_PACK,today,date,normalize,calculate,stockNet,normalizeInventory,inventory};if(typeof module==='object'&&module.exports)module.exports=api;else root.Neulbom=api;
})(typeof window==='object'?window:globalThis);
