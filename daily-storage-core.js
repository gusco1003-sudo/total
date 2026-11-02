/* Daily pallet balances carry forward until the next explicit quantity/rate. */
(function(root){
  'use strict';
  function days(storage,from,to,today){
    const end=to<today?to:today;
    if(from>end)return [];
    const dates=Object.keys(storage).filter(date=>date<=end).sort();
    let index=0,row=null,sourceDate=null;
    const result=[];
    for(let date=from;date<=end;date=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)){
      while(index<dates.length&&dates[index]<=date){sourceDate=dates[index++];row=storage[sourceDate];}
      if(row)result.push({date,...row,amount:row.qty*row.rate,automatic:sourceDate!==date,sourceDate});
    }
    return result;
  }
  const api={days};root.DailyStorage=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
