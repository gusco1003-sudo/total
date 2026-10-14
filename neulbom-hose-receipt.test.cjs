const test=require('node:test'),assert=require('node:assert/strict'),C=require('./neulbom-core.js');
test('99 cartons received add 2475 hoses once, without changing goods or charges',()=>{
 const raw={app:'neulbom',version:1,unit_price:2400,vat:'exclusive',updated_at:'2026-10-14T18:00:00+09:00',shipments:{'2026-10-14':121},entries:[{id:5,day:'2026-10-14',kind:'receipt',goods_boxes:2250,pallets:30,hose_boxes:0,voided:0}]};
 const stock={revision:1,updated_at:raw.updated_at,hose:{quantity:132,baseline:0,day:'2026-10-13'},goods:{quantity:62,baseline:2250,day:'2026-10-13'}};
 const before=C.inventory(raw,stock,'2026-10-14'),fee=C.calculate(raw,'2026-10-14','2026-10-14','2026-10-14');
 raw.entries[0].hose_boxes=99;
 const after=C.inventory(raw,stock,'2026-10-14');
 assert.equal(after.hose-before.hose,2475);assert.equal(after.goods,before.goods);
 const updated=C.calculate(raw,'2026-10-14','2026-10-14','2026-10-14');
 for(const key of ['received','remaining','parcel_boxes','hose_boxes','subtotal','vat','total'])assert.equal(updated[key],fee[key]);
 assert.deepEqual(C.inventory(structuredClone(raw),stock,'2026-10-14'),after);
 raw.entries[0].hose_boxes=98;assert.equal(C.inventory(raw,stock,'2026-10-14').hose,after.hose-25);
});
