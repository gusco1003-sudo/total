'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const K=require('./korea-inventory-core.js'),XLSX=require('./vendor/xlsx-0.20.3.full.min.js');
const engine=fs.readFileSync(__dirname+'/korea-providence.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const context={module:{exports:{}}};vm.runInNewContext(engine+'\nmodule.exports={initialData,calculate,validateData};',context);const E=context.module.exports;
const initial=()=>JSON.parse(JSON.stringify(E.initialData()));
const seeded=()=>K.seed(initial());
function arrived(){let d=seeded();for(const p of d.inventory.plans)d=K.confirmPlan(d,p.id,'receipt-'+p.product,'2026-10-15','2026-10-15');return d;}
const stock=(d,p)=>K.snapshot(d,'2026-10-15').rows.find(x=>x.id===p);
const row=(tracking,product,qty)=>({tracking,product,qty});
test('opening products and planned pallets do not alter any existing settlement entry or fee',()=>{
 const original=initial(),d=K.seed(original);assert.deepEqual(d.entries,original.entries);assert.equal(E.calculate(d,'2026-10-01','2026-10-14').storageFee,196000);assert.equal(E.calculate(d,'2026-10-01','2026-10-14').total,215600);assert.equal(stock(d,'ultra').qty,2400);assert.equal(stock(d,'ultra').pallets,20);assert.equal(stock(d,'classic').qty,0);assert.equal(stock(d,'classic').plannedQty,836);assert.equal(K.snapshot(d).rows.reduce((n,p)=>n+p.plannedPallets,0),10);assert.deepEqual(K.seed(d),d);
});
test('scheduled receipt cannot be confirmed before its date',()=>{
 assert.throws(()=>K.confirmPlan(seeded(),'planned-20261015-classic','r1','2026-10-14','2026-10-14'),/예정일 이전/);assert.throws(()=>K.confirmPlan(seeded(),'planned-20261015-classic','r1','2026-10-15','2026-10-14'),/처리일/);
});
test('receipt confirmations add exactly 10 pallets, 836/120/120/480 units and contract fees',()=>{
 const d=arrived();assert.equal(stock(d,'classic').qty,836);assert.equal(stock(d,'attract').qty,120);assert.equal(stock(d,'ultra').qty,2520);assert.equal(stock(d,'box3').qty,480);assert.equal(K.snapshot(d,'2026-10-15').rows.reduce((n,p)=>n+p.pallets,0),30);const r=E.calculate(d,'2026-10-01','2026-10-15');assert.equal(r.inFee,50000);assert.equal(r.storageFee,217000);assert.equal(r.total,293700);assert.equal(E.calculate(d,'2026-10-01','2026-10-14').total,215600);assert.throws(()=>K.confirmPlan(d,'planned-20261015-classic','r2','2026-10-15','2026-10-15'),/이미 입고/);E.validateData(d);
});
test('one waybill with several product rows charges once and deducts one box',()=>{
 const d=arrived(),rows=[row('000-123','ultra',2),row('000123','classic',3),row('000123','ultra',1)],before=JSON.parse(JSON.stringify(d));const p=K.previewShipment(d,rows,'2026-10-15','2026-10-15');assert.deepEqual(d,before);assert.equal(p.parcelCount,1);assert.equal(p.fee,2900);assert.equal(p.totals.find(x=>x.product==='box3').qty,1);const saved=K.ship(d,rows,'2026-10-15','s1','2026-10-15');assert.equal(stock(saved,'ultra').qty,2517);assert.equal(stock(saved,'classic').qty,833);assert.equal(stock(saved,'box3').qty,479);assert.equal(E.calculate(saved,'2026-10-15','2026-10-15').parcelFee,2900);E.validateData(saved);
});
test('reimported waybills are skipped; changed quantities on the same key are rejected',()=>{
 const rows=[row('000123','ultra',2)],d=K.ship(arrived(),rows,'2026-10-15','s1','2026-10-15');const p=K.previewShipment(d,rows,'2026-10-15','2026-10-15');assert.equal(p.skipped,1);assert.equal(p.parcelCount,0);assert.throws(()=>K.ship(d,rows,'2026-10-15','s2','2026-10-15'),/이미 등록/);assert.throws(()=>K.previewShipment(d,[row('000123','ultra',3)],'2026-10-15','2026-10-15'),/수량이 다릅니다/);
});
test('explicit box rows do not double-consume packaging',()=>{
 const d=K.ship(arrived(),[row('1','ultra',1),row('1','box3',1)],'2026-10-15','s1','2026-10-15');assert.equal(stock(d,'box3').qty,479);assert.throws(()=>K.previewShipment(d,[row('2','ultra',1),row('2','box3',2)],'2026-10-15','2026-10-15'),/송장 1건당 1매/);
});
test('short stock and unreceived plans cannot be dispatched; document stays unchanged',()=>{
 const d=seeded(),before=JSON.parse(JSON.stringify(d));assert.throws(()=>K.ship(d,[row('1','classic',1)],'2026-10-14','s1','2026-10-14'),/부족/);assert.deepEqual(d,before);assert.throws(()=>K.ship(arrived(),[row('1','classic',837)],'2026-10-15','s1','2026-10-15'),/부족/);assert.throws(()=>K.ship(arrived(),[row('1','ultra',0)],'2026-10-15','s1','2026-10-15'),/정수/);
});
test('empty pallets remain billable until actual release and then stop that same day',()=>{
 let d=arrived();d=K.ship(d,[row('1','ultra',119)],'2026-10-15','s1','2026-10-15');assert.equal(stock(d,'ultra').empty,0);d=K.ship(d,[row('2','ultra',1)],'2026-10-15','s2','2026-10-15');assert.equal(stock(d,'ultra').empty,1);assert.equal(stock(d,'ultra').pallets,21);assert.equal(E.calculate(d,'2026-10-15','2026-10-15').storageFee,21000);d=K.releaseEmpty(d,'2026-10-15','release-1','2026-10-15');assert.equal(stock(d,'ultra').pallets,20);assert.equal(E.calculate(d,'2026-10-15','2026-10-15').storageFee,20300);assert.throws(()=>K.cancelShipment(d,'s2'),/빈 파렛트 출고/);d=K.cancelRelease(d,'release-1');d=K.cancelShipment(d,'s2');assert.equal(stock(d,'ultra').qty,2401);assert.equal(stock(d,'box3').qty,479);E.validateData(d);
});
test('shipment cancellation restores product and box stock and removes its fee',()=>{
 let d=K.ship(arrived(),[row('1','classic',120)],'2026-10-15','s1','2026-10-15','release-1');assert.equal(stock(d,'classic').pallets,6);d=K.cancelRelease(d,'release-1');d=K.cancelShipment(d,'s1');assert.equal(stock(d,'classic').qty,836);assert.equal(stock(d,'box3').qty,480);assert.equal(E.calculate(d,'2026-10-15','2026-10-15').parcelFee,0);assert.equal(d.inventory.shipments[0].cancelled,true);E.validateData(d);
});
test('receipts that underpin shipments cannot be removed; opening entry stays protected',()=>{
 const d=K.ship(arrived(),[row('1','classic',5)],'2026-10-15','s1','2026-10-15');assert.throws(()=>K.cancelReceipt(d,'receipt-classic'),/부족/);assert.throws(()=>K.cancelReceipt(d,'opening-ultra'),/기초 입고/);const changed=seeded();changed.entries[0].qty=19;assert.throws(()=>K.normalize(changed),/기초 재고/);assert.equal(K.isManagedEntry(d,d.entries[0]),true);
});
test('Firebase omitted empty arrays normalize without losing planned receipts',()=>{
 const d=seeded();delete d.inventory.shipments;delete d.inventory.releases;const normalized=K.normalize(d);assert.deepEqual(normalized.inventory.shipments,[]);assert.equal(normalized.inventory.plans.length,4);const reversed=Object.fromEntries(Object.entries(normalized.inventory).reverse());assert.equal(K.stableSignature(normalized.inventory),K.stableSignature(reversed));
});
test('tab and quoted CSV inputs preserve shipment keys; ambiguous products need a selection',()=>{
 const labels=require('./korea-product-names.js');
 const renamed=K.parsePickingRows(K.parseDelimited('운송장번호,품목,수량\n001,DE)클래식8kg,1\n002,DE)울트라8kg,1\n003,DE)어트랙8kg,1'));
 assert.deepEqual(renamed.map(r=>r.product),['classic','ultra','attract']);
 assert.equal(labels.format('클래식 836개 · 울트라 120개 · 어트랙 120개'),'DE)클래식8kg 836개 · DE)울트라8kg 120개 · DE)어트랙8kg 120개');
 assert.equal(labels.format('DE)울트라8kg'),'DE)울트라8kg');
 assert.equal(K.previewShipment(arrived(),renamed,'2026-10-15','2026-10-15').parcelCount,3);
 const tab=K.parsePickingRows(K.parseDelimited('제목\n운송장번호\t상품명\t수량\n000123\t울트라\t2'));assert.equal(tab[0].tracking,'000123');assert.equal(tab[0].product,'ultra');const csv=K.parsePickingRows(K.parseDelimited('운송장번호,품목,수량\r\n000123,"클래식, 제품",2\r\n'));assert.equal(csv[0].product,'classic');assert.equal(K.matchProduct('클래식+울트라'), '');assert.throws(()=>K.previewShipment(arrived(),[row('1','',1)],'2026-10-15','2026-10-15'),/품목/);
});
test('wide picking list and workbook reading preserve per-product quantities',()=>{
 const aoa=[['운송장번호','클래식','어트랙','울트라'],['000123',2,0,3]],ws=XLSX.utils.aoa_to_sheet(aoa),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'피킹');const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),read=XLSX.read(bytes),rows=XLSX.utils.sheet_to_json(read.Sheets['피킹'],{header:1,raw:false,defval:''}),parsed=K.parsePickingRows(rows);assert.equal(parsed.length,2);assert.equal(parsed[0].tracking,'000123');const p=K.previewShipment(arrived(),parsed,'2026-10-15','2026-10-15');assert.equal(p.parcelCount,1);assert.equal(p.totals.find(l=>l.product==='classic').qty,2);assert.equal(p.totals.find(l=>l.product==='ultra').qty,3);assert.equal(p.totals.find(l=>l.product==='box3').qty,1);
});
