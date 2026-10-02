'use strict';
function fcToday(){return new Date(Date.now()+32400000).toISOString().slice(0,10)}
function fcDay(date){return new Date(date+'T00:00:00Z')}
function fcNext(date){return new Date(fcDay(date).getTime()+86400000).toISOString().slice(0,10)}
function fcCalculate(data,from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to) throw Error('기간을 확인해 주세요.');
 const events=Object.values(data.events||{}),costs=Object.values(data.costs||{}),s=data.settings;
 let balance=0,storage=0,inFee=0,outFee=0; const daily=[];
 const delta=e=>e.type==='in'?Number(e.qty):-(Number(e.qty)||0);
 for(const e of events.filter(e=>e.date<from)) balance+=delta(e);
 for(let date=from;date<=to;date=fcNext(date)){
  const today=events.filter(e=>e.date===date),ins=today.filter(e=>e.type==='in'),outs=today.filter(e=>e.type==='out');
  balance+=ins.reduce((n,e)=>n+e.qty,0);
  if(balance<0)throw Error('입출고 수량을 확인해 주세요.');
  const fee=balance*s.storageFee; storage+=fee;
  if(balance) daily.push({date,qty:balance,fee});
  inFee+=ins.reduce((n,e)=>n+e.qty*s.unloadFee,0);
  outFee+=outs.reduce((n,e)=>n+e.qty*s.outboundFee[e.method||'general'],0);
  balance-=outs.reduce((n,e)=>n+e.qty,0);
  if(balance<0)throw Error('출고 수량이 재고를 초과합니다.');
 }
 const selectedCosts=costs.filter(e=>e.date>=from&&e.date<=to),etc=selectedCosts.reduce((n,e)=>n+e.amount,0);
 const subtotal=inFee+outFee+storage+etc,vat=Math.round(subtotal*(s.vatRate??.1));
 return {balance,storage,inFee,outFee,etc,subtotal,vat,total:subtotal+vat,daily,events:events.filter(e=>e.date>=from&&e.date<=to),costs:selectedCosts};
}
