const test=require('node:test'),assert=require('node:assert/strict'),C=require('./neulbom-core.js');
function sample(){return {app:'neulbom',version:1,unit_price:2400,vat:'exclusive',updated_at:'2026-10-14T15:00:00+09:00',shipments:{'2026-10-14':30},europlus_shipments:{'2026-10-14':5},entries:[{id:1,day:'2026-10-12',kind:'receipt',goods_boxes:100,pallets:0,hose_boxes:0,voided:0}],europlus_entries:[{id:2,day:'2026-10-12',kind:'receipt',goods_boxes:10,pallets:0,hose_boxes:0,voided:0}],manual_dispatches:[{id:1,day:'2026-10-14',boxes:30,listed_boxes:30,eurox_boxes:25,europlus_boxes:5,hose_pieces:25,revision:1,voided:0}]};}
test('25 Eurox with hoses and 5 Europlus bill 30 parcels without sharing stock',()=>{
 const d=sample(),r=C.calculate(d,'2026-10-14','2026-10-14','2026-10-14'),ep=C.europlus(d,'2026-10-14','2026-10-14','2026-10-14');
 assert.equal(r.remaining,75);assert.equal(r.eurox_parcel_boxes,25);assert.equal(r.europlus_parcel_boxes,5);assert.equal(r.parcel_boxes,30);assert.equal(r.subtotal,72000);assert.equal(r.vat,7200);assert.equal(r.total,79200);
 assert.equal(ep.remaining,5);assert.equal(ep.outbound,5);assert.equal(ep.daily[0].outbound,5);
 const stock={revision:1,updated_at:d.updated_at,hose:{quantity:200,baseline:0,day:'2026-10-12'}};
 assert.equal(C.inventory(d,stock,'2026-10-14').hose,175);
 const historical=C.calculate(d,'2026-10-12','2026-10-12','2026-10-14');assert.equal(historical.closing,100);assert.equal(historical.remaining,75);
 assert.equal(C.europlus(d,'2026-10-12','2026-10-12','2026-10-14').remaining,5);
 d.shipments={};d.europlus_shipments={};d.manual_dispatches[0]={...d.manual_dispatches[0],boxes:0,eurox_boxes:0,europlus_boxes:0,hose_pieces:0,voided:1};
 assert.equal(C.inventory(d,stock,'2026-10-14').hose,200);assert.equal(C.calculate(d,'2026-10-14','2026-10-14','2026-10-14').total,0);assert.equal(C.europlus(d,'2026-10-14','2026-10-14','2026-10-14').remaining,10);
});
test('legacy batches default to Eurox while invalid product sums are rejected',()=>{
 const d=sample();delete d.europlus_shipments;delete d.manual_dispatches[0].europlus_boxes;delete d.manual_dispatches[0].eurox_boxes;delete d.manual_dispatches[0].hose_pieces;
 assert.equal(C.normalize(d).manual_dispatches[0].hose_pieces,30);assert.equal(C.calculate(d,'2026-10-14','2026-10-14','2026-10-14').remaining,70);
 for(const mutation of [d=>d.europlus_shipments['2026-10-14']=31,d=>d.europlus_shipments['2026-10-15']=1,d=>d.manual_dispatches[0].hose_pieces=30,d=>d.manual_dispatches[0].eurox_boxes=26]){const x=sample();mutation(x);assert.throws(()=>C.normalize(x));}
});
