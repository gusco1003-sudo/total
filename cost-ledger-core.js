(function(root){
  'use strict';
  const dayMs=86400000;
  const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const validDate=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  const nextDay=s=>new Date(Date.parse(s+'T00:00:00Z')+dayMs).toISOString().slice(0,10);
  const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  function initialData(){return normalize(root.ClientConfig.seed);}
  function normalize(d){
    if(!d||!['foodtravel','aekyung'].includes(d.app)||d.version!==1)throw Error('거래처 정산 자료 형식을 확인해 주세요.');
    const copy=JSON.parse(JSON.stringify(d));copy.storage=copy.storage||{};copy.works=Object.values(copy.works||{});
    if(!copy.settings||!integer(copy.settings.storageRate,100000000)||copy.settings.vatRate!==0.1)throw Error('보관 단가 또는 부가세 설정을 확인해 주세요.');
    for(const [date,row]of Object.entries(copy.storage))if(!validDate(date)||!row||!integer(row.qty,1000000)||!integer(row.rate,100000000))throw Error('일별 보관 수량과 단가를 확인해 주세요.');
    const ids=new Set();
    for(const row of copy.works){
      if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||!validDate(row.date)||typeof row.desc!=='string'||!row.desc.trim()||!integer(row.qty,1000000)||!integer(row.rate,100000000)||typeof row.memo!=='string'||!['inFee','outFee','etc'].includes(row.category)||!['unit','total'].includes(row.mode)||(row.mode==='total'&&!integer(row.amount,1000000000000)))throw Error('기타작업 내역을 확인해 주세요.');
      ids.add(row.id);
    }
    return copy;
  }
  function calculate(data,from,to){
    if(!validDate(from)||!validDate(to)||from>to)throw Error('정산 기간을 확인해 주세요.');
    const d=normalize(data);
    const days=Object.entries(d.storage).filter(([date])=>date>=from&&date<=to).sort(([a],[b])=>a.localeCompare(b)).map(([date,row])=>({date,...row,amount:row.qty*row.rate}));
    const works=d.works.filter(row=>row.date>=from&&row.date<=to).sort((a,b)=>a.date.localeCompare(b.date)).map(row=>({...row,amount:row.mode==='total'?row.amount:row.qty*row.rate}));
    const storage=days.reduce((n,r)=>n+r.amount,0),inFee=works.filter(r=>r.category==='inFee').reduce((n,r)=>n+r.amount,0),outFee=works.filter(r=>r.category==='outFee').reduce((n,r)=>n+r.amount,0),etc=works.filter(r=>r.category==='etc').reduce((n,r)=>n+r.amount,0),subtotal=storage+inFee+outFee+etc,vat=Math.round(subtotal*d.settings.vatRate),total=subtotal+vat;
    if(![storage,etc,subtotal,vat,total].every(Number.isSafeInteger))throw Error('정산 금액이 계산 가능한 범위를 초과했습니다.');
    return {storage,etc,subtotal,vat,total,inFee,outFee,days,works,plDays:days.reduce((n,r)=>n+r.qty,0),note:days.length+'일 기록 · '+days.reduce((n,r)=>n+r.qty,0)+' PLT·일'};
  }
  function setStorage(data,from,to,qty,rate){
    if(!validDate(from)||!validDate(to)||from>to||!integer(qty,1000000)||!integer(rate,100000000))throw Error('날짜, 파렛트 수량, 단가를 확인해 주세요.');
    if((Date.parse(to)-Date.parse(from))/dayMs>365)throw Error('한 번에 366일 이내로 입력해 주세요.');
    const d=normalize(data);
    for(let date=from;date<=to;date=nextDay(date))d.storage[date]={qty,rate};
    return normalize(d);
  }
  const api={today,validDate,nextDay,initialData,normalize,calculate,setStorage};
  root.CostLedger=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
