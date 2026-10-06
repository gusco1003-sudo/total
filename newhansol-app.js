'use strict';
const NH_URL='https://ts3pl-982ef-default-rtdb.firebaseio.com/newhansol_data.json';
const NH_LOCAL='newhansol_settlement_draft_v1';
const $=id=>document.getElementById(id),won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let nhData=NewHansol.initialData(),nhTag=null,nhDirty=false,nhSaving=false,nhEditId=null;
function status(text,kind=''){ $('status').textContent=text;$('status').dataset.state=kind; }
function monthRange(){const month=$('month').value;if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))throw Error('정산 월을 선택해 주세요.');const [y,m]=month.split('-').map(Number);return {from:month+'-01',to:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}}
function stage(data){nhData=NewHansol.normalize(data);nhDirty=true;localStorage.setItem(NH_LOCAL,JSON.stringify(nhData));status('변경사항이 있습니다. 지금 저장을 누르면 통합정산에 반영됩니다.');render();}
function render(){
 const {from,to}=monthRange(),r=NewHansol.calculate(nhData,from,to);
 $('storageTotal').textContent=won(r.storage);$('storageDetail').textContent=r.days.length+'일 기록 · '+r.plDays+' PLT·일';
 $('workTotal').textContent=won(r.etc);$('workDetail').textContent=r.works.length+'건';$('supplyTotal').textContent=won(r.subtotal);$('taxDetail').textContent='부가세 '+won(r.vat)+' · 합계 '+won(r.total);
 $('storageRows').innerHTML=r.days.map(d=>`<tr><td>${d.date}</td><td class="num">${d.qty}</td><td class="num">${won(d.rate)}</td><td class="num">${won(d.amount)}</td><td><button data-storage="${d.date}">수정</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">이 달에 등록된 보관 내역이 없습니다.</td></tr>';
 $('workRows').innerHTML=r.works.map(d=>`<tr><td>${d.date}</td><td>${esc(d.desc)}</td><td class="num">${d.qty}</td><td class="num">${won(d.rate)}</td><td class="num">${won(d.amount)}</td><td>${esc(d.memo)}</td><td><button data-work="${esc(d.id)}">수정</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">이 달에 등록된 기타작업이 없습니다.</td></tr>';
 const groups=new Map();for(const d of r.days){const key=d.qty+'|'+d.rate;const g=groups.get(key)||{qty:d.qty,rate:d.rate,days:0,amount:0};g.days++;g.amount+=d.amount;groups.set(key,g);}
 const lines=[...groups.values()].map(g=>['파렛트 보관',`${g.qty} PLT × ${g.days}일 × ${won(g.rate)}`,g.amount]);
 lines.push(...r.works.map(d=>[d.desc,`${d.date} · ${d.qty} × ${won(d.rate)}`,d.amount]));
 $('statementRows').innerHTML=lines.map(l=>`<tr><td>${esc(l[0])}</td><td>${esc(l[1])}</td><td class="num">${won(l[2])}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">등록 내역이 없습니다.</td></tr>';
 $('statementPeriod').textContent=from+' ~ '+to;$('invoiceSupply').textContent=won(r.subtotal);$('invoiceVat').textContent=won(r.vat);$('invoiceTotal').textContent=won(r.total);
}
function selectMonth(){try{const {from,to}=monthRange();$('storageFrom').value=from;$('storageTo').value=to;$('workDate').value=from;render();}catch(e){status(e.message,'error')}}
async function loadNH(){
 if(nhDirty&&!confirm('저장하지 않은 변경사항을 버리고 서버 자료를 불러올까요?'))return;
 status('클라우드 자료를 불러오는 중입니다.');
 try{
  const res=await fetch(NH_URL,{headers:{'X-Firebase-ETag':'true'},cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await res.json();
  if(!res.ok||data?.error)throw Error(data?.error||'HTTP '+res.status);
  nhData=NewHansol.normalize(data||NewHansol.initialData());nhTag=res.headers.get('ETag');nhDirty=false;
  status(data?'클라우드 동기화됨':'9월 및 10월 1일 자료 준비됨 · 지금 저장을 눌러 최초 등록',data?'ok':'');
 }catch(e){nhTag=null;status('클라우드 연결 실패: '+e.message+' · 저장 전 연결을 확인하세요.','error');}
 selectMonth();
}
async function saveNH(){
 if(nhSaving)return;
 if(!nhTag){status('서버 연결을 확인한 뒤 새로 불러오기를 눌러 주세요.','error');return;}
 nhSaving=true;$('save').disabled=true;status('클라우드에 저장하는 중입니다.');
 const payload=JSON.stringify(NewHansol.normalize(nhData));
 try{
  const res=await fetch(NH_URL,{method:'PUT',headers:{'Content-Type':'application/json','if-match':nhTag,'X-Firebase-ETag':'true'},body:payload,signal:AbortSignal.timeout(15000)});
  if(res.status===412){nhTag=null;throw Error('다른 기기에서 자료가 변경되었습니다. 새로 불러온 뒤 변경 내용을 다시 적용하세요.');}
  const data=await res.json();if(!res.ok||data?.error)throw Error(data?.error||'HTTP '+res.status);
  nhTag=res.headers.get('ETag');nhDirty=JSON.stringify(nhData)!==payload;
  status(nhDirty?'추가 변경사항이 있습니다. 지금 저장을 다시 눌러 주세요.':'클라우드 저장 완료 · 통합정산 반영됨',nhDirty?'':'ok');
  localStorage.setItem(NH_LOCAL,JSON.stringify(nhData));
 }catch(e){status('저장 실패: '+e.message,'error');}finally{nhSaving=false;$('save').disabled=false;}
}
$('storageForm').addEventListener('submit',e=>{e.preventDefault();try{
 const from=$('storageFrom').value,to=$('storageTo').value,qty=Number($('qty').value),rate=Number($('rate').value);
 const changed=Object.entries(nhData.storage).filter(([d,r])=>d>=from&&d<=to&&(r.qty!==qty||r.rate!==rate));
 const next=NewHansol.setStorage(nhData,from,to,qty,rate);
 if(changed.length&&!confirm('이미 등록된 '+changed.length+'일의 보관 수량·단가를 수정할까요?'))return;
 stage(next);
}catch(err){status(err.message,'error')}});
$('workForm').addEventListener('submit',e=>{e.preventDefault();try{
 const item={id:nhEditId||crypto.randomUUID(),date:$('workDate').value,desc:$('workDesc').value.trim(),qty:Number($('workQty').value),rate:Number($('workRate').value),memo:$('workMemo').value.trim()};
 if(item.qty<1)throw Error('작업 수량은 1 이상이어야 합니다.');
 const next=NewHansol.normalize(nhData),i=next.works.findIndex(w=>w.id===item.id);if(i<0)next.works.push(item);else next.works[i]=item;stage(next);resetWork();
}catch(err){status(err.message,'error')}});
function resetWork(){nhEditId=null;$('workHeading').textContent='기타작업 등록';$('workDesc').value='';$('workQty').value='1';$('workRate').value='';$('workMemo').value='';}
$('cancelEdit').onclick=resetWork;
$('storageRows').onclick=e=>{const b=e.target.closest('button[data-storage]');if(!b)return;const date=b.dataset.storage,r=nhData.storage[date];$('storageFrom').value=date;$('storageTo').value=date;$('qty').value=r.qty;$('rate').value=r.rate;$('qty').focus();};
$('workRows').onclick=e=>{const b=e.target.closest('button[data-work]');if(!b)return;const r=nhData.works.find(w=>w.id===b.dataset.work);nhEditId=r.id;$('workHeading').textContent='기타작업 수정';$('workDate').value=r.date;$('workDesc').value=r.desc;$('workQty').value=r.qty;$('workRate').value=r.rate;$('workMemo').value=r.memo;$('workDesc').focus();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-selected',String(t===b)));document.querySelectorAll('.tab-panel').forEach(t=>t.classList.toggle('hidden',t.id!=='tab-'+b.dataset.tab));});
$('month').onchange=selectMonth;$('save').onclick=saveNH;$('reload').onclick=loadNH;
window.addEventListener('beforeunload',e=>{if(nhDirty){e.preventDefault();e.returnValue='';}});
selectMonth();loadNH();
