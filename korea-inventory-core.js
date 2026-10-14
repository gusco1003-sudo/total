/* Product inventory extends the existing settlement document without changing its opening ledger. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KoreaInventory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog=[
  {id:'classic',name:'클래식',unit:'개',standard:120,aliases:['클래식','클래식제품','classic']},
  {id:'attract',name:'어트랙',unit:'개',standard:120,aliases:['어트랙','어트렉','attract','attrack']},
  {id:'ultra',name:'울트라',unit:'개',standard:120,aliases:['울트라','ultra']},
  {id:'box3',name:'3호 상자',unit:'매',standard:480,aliases:['3호상자','상자3호','3호박스','박스3호','3호','box3']}
 ];
 const product=id=>catalog.find(p=>p.id===id);
 const clone=v=>JSON.parse(JSON.stringify(v));
 const sum=xs=>xs.reduce((n,x)=>n+x,0);
 const kstToday=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
 function dateOK(s){return typeof s==='string'&&/^20\d\d-\d\d-\d\d$|^2100-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
 function assertDate(s,max){if(!dateOK(s)||(max&&s>max))throw Error('처리일은 오늘까지의 올바른 날짜로 입력해 주세요.');}
 function positive(n){return Number.isSafeInteger(n)&&n>0&&n<=1000000;}
 function idOK(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,70}$/.test(id);}
 function palletsOK(xs){return Array.isArray(xs)&&xs.length>0&&xs.length<=10000&&xs.every(positive);}
 function trackingKey(s){return String(s??'').trim().replace(/^'/,'').replace(/[\s-]+/g,'').toUpperCase();}
 function linesCanonical(lines){const totals={};for(const l of lines)totals[l.product]=(totals[l.product]||0)+l.qty;return Object.keys(totals).sort().map(k=>({product:k,qty:totals[k]}));}
 function matchProduct(value){const s=String(value??'').toLowerCase().replace(/[\s_()\[\]-]+/g,'');const matches=catalog.filter(p=>p.id===s||p.aliases.some(a=>s.includes(a)));return matches.length===1?matches[0].id:'';}
 function seed(document){
  const d=clone(document);if(d.inventory)return normalize(d);
  const opening=d.entries.find(e=>e.id==='initial-20260903'&&e.type==='IN'&&e.qty===20&&e.date==='2026-09-03');
  const balance=d.entries.filter(e=>e.date<='2026-10-14').reduce((n,e)=>n+(e.type==='IN'?e.qty:e.type==='OUT'?-e.qty:0),0);
  if(!opening||balance!==20)throw Error('기존 보관 수량이 확인한 20파렛트와 다릅니다. 품목별 기초 재고를 다시 확인해 주세요.');
  d.inventory={version:1,receipts:[{id:'opening-ultra',date:opening.date,product:'ultra',palletQty:Array(20).fill(120),openingEntryId:opening.id,note:'기존 입고분 · 울트라 20파렛트 × 120개'}],
   plans:[{id:'planned-20261015-classic',date:'2026-10-15',product:'classic',palletQty:[120,120,120,120,120,120,116],note:'기존 적재 6파렛트 720개 + 새 적재 1파렛트 116개'},
    {id:'planned-20261015-attract',date:'2026-10-15',product:'attract',palletQty:[120],note:'입고된 그대로'},
    {id:'planned-20261015-ultra',date:'2026-10-15',product:'ultra',palletQty:[120],note:'입고된 그대로'},
    {id:'planned-20261015-box3',date:'2026-10-15',product:'box3',palletQty:[480],note:'3호 상자 480매'}],shipments:[],releases:[]};
  return normalize(d);
 }
 function normalize(document){
  const d=clone(document);if(!d.inventory)return d;const inv=d.inventory;
  if(inv.version!==1)throw Error('지원하지 않는 재고 자료 버전입니다.');
  for(const key of ['receipts','plans','shipments','releases']){if(inv[key]===undefined)inv[key]=[];if(!Array.isArray(inv[key])||inv[key].length>100000)throw Error('재고 내역 형식을 확인해 주세요.');}
  const ids=new Set();
  for(const e of [...inv.receipts,...inv.plans,...inv.shipments,...inv.releases]){if(!idOK(e.id)||ids.has(e.id)||!dateOK(e.date))throw Error('중복되거나 잘못된 재고 내역입니다.');ids.add(e.id);}
  for(const r of [...inv.receipts,...inv.plans])if(!product(r.product)||!palletsOK(r.palletQty)||typeof r.note!=='string'||r.note.length>200)throw Error('입고 품목과 파렛트별 수량을 확인해 주세요.');
  for(const r of inv.receipts.filter(r=>r.openingEntryId)){const e=d.entries.find(e=>e.id===r.openingEntryId);if(!e||e.type!=='IN'||e.date!==r.date||e.qty!==r.palletQty.length||r.cancelled)throw Error('기초 재고와 기존 입고 내역이 서로 다릅니다. 기존 입고 내역을 보존해 주세요.');}
  for(const p of inv.plans.filter(p=>p.receivedId)){const r=inv.receipts.find(r=>r.id===p.receivedId&&!r.cancelled);if(!r||r.product!==p.product||JSON.stringify(r.palletQty)!==JSON.stringify(p.palletQty))throw Error('입고 예정과 확정 내역을 확인해 주세요.');}
  const seen=new Set();for(const s of inv.shipments){if(!Array.isArray(s.packages)||!s.packages.length||s.packages.length>10000)throw Error('택배 배송 내역을 확인해 주세요.');const local=new Set();for(const p of s.packages){const key=trackingKey(p.tracking);if(!key||key.length>100||local.has(key)||(!s.cancelled&&seen.has(key))||!Array.isArray(p.lines)||!p.lines.length||p.lines.some(l=>!product(l.product)||!positive(l.qty)))throw Error('중복 운송장 또는 잘못된 출고 수량입니다.');local.add(key);if(!s.cancelled)seen.add(key);}}
  for(const r of inv.releases)if(!Array.isArray(r.palletIds)||!r.palletIds.length||new Set(r.palletIds).size!==r.palletIds.length)throw Error('빈 파렛트 출고 내역을 확인해 주세요.');
  replay(d,'2100-12-31');return d;
 }
 function replay(d,asOf){
  const inv=d.inventory,pallets=[],shipmentResults={},releaseResults={};
  if(!inv)return {pallets,shipmentResults,releaseResults};
  const events=[...inv.receipts.filter(r=>!r.cancelled).map((r,i)=>({kind:0,event:r,order:i})),...inv.shipments.filter(s=>!s.cancelled).map((s,i)=>({kind:1,event:s,order:i})),...inv.releases.filter(r=>!r.cancelled).map((r,i)=>({kind:2,event:r,order:i}))].filter(e=>e.event.date<=asOf).sort((a,b)=>a.event.date.localeCompare(b.event.date)||a.kind-b.kind||a.order-b.order);
  for(const {kind,event:e} of events){
   if(kind===0){e.palletQty.forEach((qty,i)=>pallets.push({id:e.id+'-'+i,receiptId:e.id,product:e.product,date:e.date,initial:qty,remaining:qty,released:false}));continue;}
   if(kind===1){const totals=linesCanonical(e.packages.flatMap(p=>p.lines)),freed=[];
    for(const line of totals){let need=line.qty;for(const p of pallets.filter(p=>p.product===line.product&&!p.released&&p.remaining>0)){const taken=Math.min(p.remaining,need);p.remaining-=taken;need-=taken;if(p.remaining===0)freed.push(p.id);if(!need)break;}if(need)throw Error(e.date+' '+product(line.product).name+' 재고가 '+need.toLocaleString('ko-KR')+product(line.product).unit+' 부족합니다. 입고 확정과 출고 수량을 확인해 주세요.');}
    shipmentResults[e.id]={totals,freed,parcelCount:e.packages.length};continue;
   }
   for(const id of e.palletIds){const p=pallets.find(p=>p.id===id);if(!p||p.released||p.remaining!==0)throw Error('빈 파렛트 출고 이후에는 관련 출고를 취소할 수 없습니다. 빈 파렛트 출고를 먼저 취소해 주세요.');p.released=true;}releaseResults[e.id]=e.palletIds.length;
  }
  return {pallets,shipmentResults,releaseResults};
 }
 function snapshot(document,asOf=kstToday()){
  const d=normalize(document),state=replay(d,asOf);const rows=catalog.map(p=>{const pallets=state.pallets.filter(x=>x.product===p.id&&!x.released),pending=(d.inventory?.plans||[]).filter(x=>x.product===p.id&&!x.cancelled&&!x.receivedId);return {...p,qty:sum(pallets.map(x=>x.remaining)),pallets:pallets.length,empty:pallets.filter(x=>!x.remaining).length,plannedQty:sum(pending.flatMap(x=>x.palletQty)),plannedPallets:sum(pending.map(x=>x.palletQty.length))};});return {...state,rows};
 }
 function rebuild(document){
  const d=normalize(document);if(!d.inventory)return d;const inv=d.inventory,generated=[];
  for(const r of inv.receipts.filter(r=>!r.cancelled&&!r.openingEntryId))generated.push({id:'kp-in-'+r.id,date:r.date,type:'IN',qty:r.palletQty.length,note:product(r.product).name+' '+sum(r.palletQty).toLocaleString('ko-KR')+product(r.product).unit+' · '+r.palletQty.length+' PLT',inventoryRef:'receipt:'+r.id});
  for(const s of inv.shipments.filter(s=>!s.cancelled))generated.push({id:'kp-parcel-'+s.id,date:s.date,type:'PARCEL',qty:s.packages.length,note:'피킹리스트 · '+s.packages.length+'건 · 품목 재고 차감',inventoryRef:'shipment:'+s.id});
  for(const r of inv.releases.filter(r=>!r.cancelled))generated.push({id:'kp-out-'+r.id,date:r.date,type:'OUT',qty:r.palletIds.length,note:'실제 빈 파렛트 출고 '+r.palletIds.length+' PLT',inventoryRef:'release:'+r.id});
  const preserved=d.entries.filter(e=>!e.inventoryRef),ids=new Set(preserved.map(e=>e.id));for(const e of generated){if(ids.has(e.id))throw Error('정산 내역 번호가 중복됩니다.');ids.add(e.id);}d.entries=[...preserved,...generated];return d;
 }
 function requireInventory(document){const d=normalize(document);if(!d.inventory)throw Error('품목 재고 초기화를 먼저 완료해 주세요.');return d;}
 function addPlan(document,plan){const d=requireInventory(document);assertDate(plan.date);d.inventory.plans.push({...clone(plan),note:plan.note||''});return normalize(d);}
 function addReceipt(document,receipt,max=kstToday()){const d=requireInventory(document);assertDate(receipt.date,max);d.inventory.receipts.push({...clone(receipt),note:receipt.note||''});return rebuild(d);}
 function confirmPlan(document,planId,receiptId,date,max=kstToday()){const d=requireInventory(document),p=d.inventory.plans.find(p=>p.id===planId&&!p.cancelled);if(!p||p.receivedId)throw Error('이미 입고 확정되었거나 취소된 예정 내역입니다.');assertDate(date,max);if(date<p.date)throw Error('예정일 이전 입고는 실제 입고 등록에서 확인해 주세요.');d.inventory.receipts.push({id:receiptId,date,product:p.product,palletQty:clone(p.palletQty),note:p.note});p.receivedId=receiptId;return rebuild(d);}
 function cancelReceipt(document,id){const d=requireInventory(document),r=d.inventory.receipts.find(r=>r.id===id&&!r.cancelled);if(!r||r.openingEntryId)throw Error('기존 기초 입고분은 취소할 수 없습니다.');r.cancelled=true;for(const p of d.inventory.plans)if(p.receivedId===id)delete p.receivedId;return rebuild(d);}
 function cancelPlan(document,id){const d=requireInventory(document),p=d.inventory.plans.find(p=>p.id===id);if(!p||p.receivedId)throw Error('확정된 입고는 입고 내역에서 취소해 주세요.');p.cancelled=true;return normalize(d);}
 function preparePackages(document,rows){
  if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('피킹리스트는 1~10,000행으로 입력해 주세요.');
  const grouped=new Map();for(const [i,row] of rows.entries()){const key=trackingKey(row.tracking),qty=Number(String(row.qty).replace(/,/g,''));if(!key||key.length>100||/[eE][+-]\d/.test(key))throw Error((i+1)+'행의 운송장/배송키를 확인해 주세요.');if(!product(row.product)||!positive(qty))throw Error((i+1)+'행의 품목과 정수 수량을 확인해 주세요.');if(!grouped.has(key))grouped.set(key,{tracking:key,lines:[]});grouped.get(key).lines.push({product:row.product,qty});}
  const previous=new Map((document.inventory?.shipments||[]).filter(s=>!s.cancelled).flatMap(s=>s.packages).map(p=>[trackingKey(p.tracking),p]));let skipped=0;const packages=[];
  for(const p of grouped.values()){p.lines=linesCanonical(p.lines);const box=p.lines.find(l=>l.product==='box3');if(box&&box.qty!==1)throw Error(p.tracking+'의 3호 상자는 송장 1건당 1매로 입력해 주세요.');if(!box)p.lines.push({product:'box3',qty:1});p.lines=linesCanonical(p.lines);if(p.lines.some(l=>!positive(l.qty)))throw Error('한 배송의 품목 수량 범위를 초과했습니다.');const old=previous.get(p.tracking);if(old){if(JSON.stringify(linesCanonical(old.lines))!==JSON.stringify(p.lines))throw Error(p.tracking+'는 이미 등록된 배송키이며 품목/수량이 다릅니다. 기존 출고 내역을 확인해 주세요.');skipped++;}else packages.push(p);}return {packages,skipped};
 }
 function previewShipment(document,rows,date,max=kstToday()){
  const d=requireInventory(document);assertDate(date,max);const draft=preparePackages(d,rows);if(!draft.packages.length)return {...draft,totals:[],freed:[],parcelCount:0,fee:0};
  const id='preview-picking';if(d.inventory.shipments.some(s=>s.id===id))throw Error('출고 번호를 확인해 주세요.');d.inventory.shipments.push({id,date,packages:draft.packages,note:''});const state=replay(d,'2100-12-31'),result=state.shipmentResults[id];return {...draft,...result,fee:result.parcelCount*2900};
 }
 function ship(document,rows,date,id,max=kstToday(),releaseId=null){const preview=previewShipment(document,rows,date,max);if(!preview.packages.length)throw Error('모두 이미 등록된 배송입니다. 추가 차감하지 않았습니다.');const d=requireInventory(document);d.inventory.shipments.push({id,date,packages:preview.packages,note:''});if(releaseId&&preview.freed.length)d.inventory.releases.push({id:releaseId,date,palletIds:preview.freed});return rebuild(d);}
 function cancelShipment(document,id){const d=requireInventory(document),s=d.inventory.shipments.find(s=>s.id===id&&!s.cancelled);if(!s)throw Error('출고 내역을 찾을 수 없습니다.');s.cancelled=true;return rebuild(d);}
 function releaseEmpty(document,date,id,max=kstToday()){const d=requireInventory(document);assertDate(date,max);const palletIds=replay(d,date).pallets.filter(p=>!p.released&&!p.remaining).map(p=>p.id);if(!palletIds.length)throw Error('출고할 빈 파렛트가 없습니다.');d.inventory.releases.push({id,date,palletIds});return rebuild(d);}
 function cancelRelease(document,id){const d=requireInventory(document),r=d.inventory.releases.find(r=>r.id===id&&!r.cancelled);if(!r)throw Error('빈 파렛트 출고를 찾을 수 없습니다.');r.cancelled=true;return rebuild(d);}
 function isManagedEntry(document,e){return !!e.inventoryRef||!!document.inventory?.receipts.some(r=>r.openingEntryId===e.id);}
 function parseDelimited(text){const delimiter=text.includes('\t')?'\t':',',rows=[],row=[];let value='',quoted=false;const s=String(text).replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(value);value='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&s[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row.splice(0));else row.length=0;value='';}else value+=c;}if(quoted)throw Error('따옴표가 닫히지 않은 CSV입니다.');row.push(value);if(row.some(x=>x.trim()))rows.push(row);return rows;}
 const headerKey=s=>String(s??'').toLowerCase().replace(/[\s_()\[\]-]+/g,'');
 const headers={tracking:['운송장번호','송장번호','운송장','송장','배송키','주문번호','주문고유번호','tracking','trackingnumber','orderid'],product:['상품명','품목명','제품명','품명','상품','품목','제품','옵션명','product','sku'],qty:['수량','출고수량','상품수량','주문수량','qty','quantity']};
 function detectHeader(rows){for(let r=0;r<Math.min(rows.length,30);r++){const keys=rows[r].map(headerKey),mapping={header:r,tracking:keys.findIndex(k=>headers.tracking.includes(k)),product:keys.findIndex(k=>headers.product.includes(k)),qty:keys.findIndex(k=>headers.qty.includes(k))};const wide=rows[r].map((v,i)=>({index:i,product:matchProduct(v)})).filter(x=>x.product);if(mapping.tracking>=0&&((mapping.product>=0&&mapping.qty>=0)||wide.length)){if(mapping.product<0||mapping.qty<0)mapping.wide=wide;return mapping;}}return {header:0,tracking:-1,product:-1,qty:-1};}
 function parsePickingRows(rows,mapping=detectHeader(rows)){
  if(!Array.isArray(rows)||!rows.length)throw Error('피킹리스트가 비어 있습니다.');if(mapping.tracking<0||(!mapping.wide&&(mapping.product<0||mapping.qty<0)))throw Error('운송장/배송키, 품목, 수량 열을 지정해 주세요.');
  const result=[];for(let i=mapping.header+1;i<rows.length;i++){const row=rows[i];if(!row.some(v=>String(v??'').trim()))continue;const tracking=String(row[mapping.tracking]??'').trim();if(headers.tracking.includes(headerKey(tracking)))continue;if(/^(합계|총계|total)$/i.test(tracking))continue;
   if(mapping.wide){let added=false;for(const col of mapping.wide){const raw=String(row[col.index]??'').replace(/,/g,'').trim();if(!raw||Number(raw)===0)continue;result.push({rowNo:i+1,tracking,product:col.product,qty:Number(raw),originalName:catalog.find(p=>p.id===col.product).name});added=true;}if(!added&&tracking)throw Error((i+1)+'행에 차감할 품목 수량이 없습니다.');}
   else result.push({rowNo:i+1,tracking,product:matchProduct(row[mapping.product]),qty:Number(String(row[mapping.qty]??'').replace(/,/g,'').trim()),originalName:String(row[mapping.product]??'')});
  }if(!result.length)throw Error('출고할 상품 행이 없습니다.');return result;
 }
 function stableSignature(v){const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;return JSON.stringify(canonical(v??null));}
 return {catalog,product,kstToday,seed,normalize,snapshot,rebuild,addPlan,addReceipt,confirmPlan,cancelReceipt,cancelPlan,previewShipment,ship,cancelShipment,releaseEmpty,cancelRelease,isManagedEntry,matchProduct,trackingKey,parseDelimited,detectHeader,parsePickingRows,stableSignature};
});
