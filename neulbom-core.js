(function(root){'use strict';
const RATE=2400,RETURN_RATE=2500;
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
 d.europlus_shipments=d.europlus_shipments||{};
 if(typeof d.europlus_shipments!=='object'||Array.isArray(d.europlus_shipments))throw Error('유로플러스 택배 자료를 확인하세요.');
 for(const [day,n] of Object.entries(d.europlus_shipments))if(!date(day)||!integer(n)||n>(d.shipments[day]||0))throw Error('유로플러스 택배 수량을 확인하세요.');
 d.europlus_entries=Array.isArray(d.europlus_entries)?d.europlus_entries:Object.values(d.europlus_entries||{});
 const ids=new Set();for(const e of [...d.entries,...d.europlus_entries]){
  if(!e||!Number.isSafeInteger(e.id)||ids.has(e.id)||!date(e.day)||!['receipt','outbound'].includes(e.kind)||!['goods_boxes','pallets','hose_boxes'].every(k=>integer(e[k]))||![0,1,false,true].includes(e.voided))throw Error('입출고 기록 또는 중복 번호를 확인하세요.');
  ids.add(e.id);
 }
 if(d.europlus_entries.some(e=>e.hose_boxes!==0))throw Error('유로플러스는 호스 포함 제품입니다. 별도 호스 차감 자료를 확인하세요.');
 d.manual_dispatches=Array.isArray(d.manual_dispatches)?d.manual_dispatches:Object.values(d.manual_dispatches||{});
 for(const e of d.manual_dispatches)if(!integer(e.id)||!date(e.day)||!integer(e.boxes)||!integer(e.listed_boxes)||!Number.isSafeInteger(e.revision)||![0,1].includes(e.voided))throw Error('수동 출고 기록을 확인하세요.');
 for(const e of d.manual_dispatches){e.europlus_boxes=e.europlus_boxes??0;e.eurox_boxes=e.eurox_boxes??e.boxes-e.europlus_boxes;e.hose_pieces=e.hose_pieces??e.eurox_boxes;if(![e.europlus_boxes,e.eurox_boxes,e.hose_pieces].every(integer)||e.eurox_boxes+e.europlus_boxes!==e.boxes||e.hose_pieces!==e.eurox_boxes)throw Error('수동 출고 품목별 수량을 확인하세요.');}
 d.returns=Array.isArray(d.returns)?d.returns:Object.values(d.returns||{});d.quality=Array.isArray(d.quality)?d.quality:Object.values(d.quality||{});
 const rt=new Set();for(const r of d.returns){if(!integer(r.id)||!/^\d{10}(?:\d{2})?$/.test(r.tracking)||rt.has(r.tracking)||!['eurox','europlus'].includes(r.product)||!['pending','completed','voided'].includes(r.status)||!integer(r.boxes)||r.boxes<1||!integer(r.good)||!integer(r.bad)||!date(r.day)||(r.status==='completed'&&(!date(r.completed_day)||r.completed_day<r.day||r.good+r.bad!==r.boxes)))throw Error('반품 자료를 확인하세요.');rt.add(r.tracking);}
 for(const q of d.quality)if(!date(q.day)||!['eurox','europlus'].includes(q.product)||!integer(q.boxes))throw Error('불량 재고 자료를 확인하세요.');
 return d;
}
function returnEffect(d,until){const out={eurox:{good:0,bad:0,total:0},europlus:{good:0,bad:0,total:0},hose:0,invoices:0};for(const r of d.returns||[])if(r.status==='completed'&&r.completed_day<=until){const b=out[r.product];b.good+=r.good;b.bad+=r.bad;b.total+=r.good+r.bad;if(r.product==='eurox')out.hose+=r.good+r.bad;out.invoices++;}for(const q of d.quality||[])if(q.day<=until){out[q.product].bad+=q.boxes;out[q.product].good-=q.boxes;}return out;}
function calculate(raw,from,to,asOf=today()){
 const d=normalize(raw);if(!date(from)||!date(to)||!date(asOf)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw Error('조회 기간은 최대 366일로 입력하세요.');
 const active=d.entries.filter(e=>!e.voided),days={};
 const bucket=k=>days[k]||(days[k]={date:k,received:0,parcel_boxes:0,eurox_parcel_boxes:0,europlus_parcel_boxes:0,other_boxes:0,pallets:0,hose_boxes:0,return_invoices:0,return_boxes:0,return_good:0,return_bad:0});
 for(const [k,n] of Object.entries(d.shipments)){const b=bucket(k);b.parcel_boxes=n;b.europlus_parcel_boxes=d.europlus_shipments[k]||0;b.eurox_parcel_boxes=n-b.europlus_parcel_boxes;}
 for(const e of active){const b=bucket(e.day);if(e.kind==='receipt')b.received+=e.goods_boxes;else{b.other_boxes+=e.goods_boxes;b.pallets+=e.pallets;b.hose_boxes+=e.hose_boxes;}}
 for(const r of d.returns)if(r.status==='completed'){const b=bucket(r.completed_day);b.return_invoices++;b.return_boxes+=r.boxes;b.return_good+=r.good;b.return_bad+=r.bad;}
 function balance(until){let received=0,parcel=0,other=0;for(const [k,b]of Object.entries(days))if(k<=until){received+=b.received;parcel+=b.eurox_parcel_boxes;other+=b.other_boxes;}
  return active.some(e=>e.kind==='receipt'&&e.day<=until)?received-parcel-other+returnEffect(d,until).eurox.total:null;
 }
 const daily=[];for(let k=from;k<=to;k=step(k)){const b={...bucket(k)};b.remaining=balance(k);b.return_supply=b.return_invoices*RETURN_RATE;b.supply=b.parcel_boxes*RATE+b.return_supply;b.vat=Math.round(b.supply/10);b.total=b.supply+b.vat;daily.push(b);}
 const sum=k=>daily.reduce((n,b)=>n+b[k],0),subtotal=sum('supply'),vat=Math.round(subtotal/10);
 if(!Number.isSafeInteger(subtotal+vat))throw Error('정산 금액 범위를 초과했습니다.');
 return {daily,entries:d.entries.filter(e=>e.day>=from&&e.day<=to).sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id),storage:0,inFee:0,outFee:sum('parcel_boxes')*RATE,etc:sum('return_supply'),return_invoices:sum('return_invoices'),return_boxes:sum('return_boxes'),return_supply:sum('return_supply'),subtotal,vat,total:subtotal+vat,parcel_boxes:sum('parcel_boxes'),eurox_parcel_boxes:sum('eurox_parcel_boxes'),europlus_parcel_boxes:sum('europlus_parcel_boxes'),received:sum('received'),other_boxes:sum('other_boxes'),pallets:sum('pallets'),hose_boxes:sum('hose_boxes'),remaining:balance(asOf),closing:balance(to),today_parcels:d.shipments[asOf]||0,updated_at:d.updated_at,warnings:d.warnings};
}
const HOSE_PACK=25;
function stockNet(raw,until=today()){
 const d=normalize(raw);let goods=0,hose=0;
 for(const [day,n] of Object.entries(d.shipments))if(day<=until){const eurox=n-(d.europlus_shipments[day]||0);goods-=eurox;hose-=eurox;}
 for(const e of d.entries)if(!e.voided&&e.day<=until){const sign=e.kind==='receipt'?1:-1;goods+=sign*e.goods_boxes;hose+=sign*e.hose_boxes*HOSE_PACK;}
 const returned=returnEffect(d,until);goods+=returned.eurox.total;hose+=returned.hose;
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
 const value=key=>s[key]&&s[key].day<=asOf?s[key].quantity+net[key]-(s[key].through_day?stockNet(raw,s[key].day)[key]:s[key].baseline):(key==='goods'?fallback:null);
 const goods=value('goods'),hose=value('hose');
 const bad=returnEffect(normalize(raw),asOf).eurox.bad;
 return {goods,good:goods==null?null:goods-bad,bad,hose,hose_pack:HOSE_PACK,hose_boxes:hose==null||hose<0?null:Math.floor(hose/HOSE_PACK),hose_loose:hose==null||hose<0?null:hose%HOSE_PACK,updated_at:s.updated_at||null};
}
function europlus(raw,from,to,asOf=today()){
 const d=normalize(raw);if(!date(from)||!date(to)||!date(asOf)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw Error('조회 기간은 최대 366일로 입력하세요.');
 const active=d.europlus_entries.filter(e=>!e.voided),days={};
 const bucket=day=>days[day]||(days[day]={date:day,received:0,outbound:0,pallets:0,returned:0});
 for(const e of active){const b=bucket(e.day);b[e.kind==='receipt'?'received':'outbound']+=e.goods_boxes;if(e.kind==='outbound')b.pallets+=e.pallets;}
 for(const [day,n] of Object.entries(d.europlus_shipments))bucket(day).outbound+=n;
 for(const r of d.returns)if(r.status==='completed'&&r.product==='europlus')bucket(r.completed_day).returned+=r.boxes;
 function balance(until){return active.some(e=>e.kind==='receipt'&&e.day<=until)?Object.values(days).filter(d=>d.date<=until).reduce((n,d)=>n+d.received+d.returned-d.outbound,0):null;}
 const daily=Object.values(days).filter(d=>d.date>=from&&d.date<=to).sort((a,b)=>b.date.localeCompare(a.date)).map(d=>({...d,remaining:balance(d.date)}));
 return {bad:returnEffect(d,asOf).europlus.bad,good:balance(asOf)==null?null:balance(asOf)-returnEffect(d,asOf).europlus.bad,remaining:balance(asOf),closing:balance(to),daily,received:daily.reduce((n,d)=>n+d.received,0),outbound:daily.reduce((n,d)=>n+d.outbound,0),
  entries:d.europlus_entries.filter(e=>e.day>=from&&e.day<=to).sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id)};
}
const api={RATE,RETURN_RATE,HOSE_PACK,today,date,normalize,calculate,stockNet,normalizeInventory,inventory,europlus,returnEffect};if(typeof module==='object'&&module.exports)module.exports=api;else root.Neulbom=api;
})(typeof window==='object'?window:globalThis);
