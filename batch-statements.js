'use strict';
async function issueMonthlyStatements(){
 const button=document.getElementById('batchStatements'),selector=document.getElementById('monthSelector'),status=document.getElementById('batchStatus');
 if(button.disabled)return;
 const month=selector.value,range=monthRange(month);
 if(!range){status.textContent='발급할 정산 월을 선택해 주세요.';return;}
 button.disabled=true;selector.disabled=true;status.textContent=month+' 정산 자료를 확인하고 있습니다…';
 for(let i=0;loading&&i<200;i++)await new Promise(resolve=>setTimeout(resolve,100));
 if(loading){status.textContent='동기화가 지연되고 있습니다. 잠시 후 다시 발급해 주세요.';button.disabled=false;selector.disabled=false;return;}
 loading=true;
 try{
  await loadData(false);render();
  const failed=CLIENTS.filter(c=>syncErr[c.key]);
  if(failed.length)throw Error(failed.map(c=>c.name).join(', ')+' 자료를 불러오지 못했습니다. 새로고침 후 다시 발급해 주세요.');
  const statements=CLIENTS.map(c=>{
   const m=calcClient(c,month),detail=calculationDetail(c.key,month),table=document.createElement('table');
   table.innerHTML='<thead>'+detail.head+'</thead><tbody>'+detail.body+'</tbody>';
   const headers=[...table.tHead.rows[0].cells].map(cell=>cell.textContent.trim());
   const rows=[...table.tBodies[0].rows].filter(r=>r.cells.length>=3).map(r=>{
    const cells=[...r.cells].map(cell=>cell.textContent.trim());
    return [cells[0],cells.length===3?cells[1]:cells.slice(1,-1).map((value,i)=>headers[i+1]+': '+value).join(' · '),cells.at(-1)+'원'];
   });
   if(![m.subtotal,m.vat,m.total].every(Number.isFinite))throw Error(c.name+' 정산 금액을 확인해 주세요.');
   const supplier=store[c.key]?.settings?.supplier;
   return {name:c.name,period:range.from+' ~ '+range.to,supplier:supplier?[supplier.name||'(주)태성 - TS3PL',supplier.bizNo&&'사업자등록번호 '+supplier.bizNo,supplier.ceo&&'대표 '+supplier.ceo,supplier.address,supplier.phone].filter(Boolean).join('\n'):'(주)태성 - TS3PL',rows,totals:[m.subtotal,m.vat,m.total].map(v=>comma(v)+'원')};
  });
  status.textContent=month+' · '+statements.length+'개 업체 PDF를 생성하고 있습니다…';
  const result=await StatementPDF.downloadBatch(statements,'TS3PL_'+month+'_업체별_정산서.pdf');
  status.textContent=month+' · '+result.statements+'개 업체, '+result.pages+'페이지 PDF 생성 완료 (0원 업체 포함)';
 }catch(e){status.textContent='발급 실패: '+e.message;}finally{loading=false;button.disabled=false;selector.disabled=false;}
}
document.getElementById('batchStatements').addEventListener('click',issueMonthlyStatements);
