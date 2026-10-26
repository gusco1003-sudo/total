/* Administrator-only, recoverable removal of Aekyung work ledger entries. */
(function(root){
 'use strict';
 const list=v=>Array.isArray(v)?v.filter(Boolean):Object.values(v||{});
 function remove(data,id,now=Date.now()){
  if(data.app!=='aekyung')throw Error('애경 내역만 삭제할 수 있습니다.');
  const next=JSON.parse(JSON.stringify(data)),rows=list(next.works),row=rows.find(r=>r.id===id);
  if(!row)throw Error('이미 삭제되었거나 찾을 수 없는 내역입니다. 새로 불러와 주세요.');
  next.works=rows.filter(r=>r.id!==id);next.deletedWorks=list(next.deletedWorks);
  if(next.deletedWorks.some(r=>r.id===id))throw Error('삭제 이력 식별자가 중복되었습니다.');
  next.deletedWorks.push({...row,deletedAt:now});return next;
 }
 function restore(data,id){
  if(data.app!=='aekyung')throw Error('애경 내역만 복원할 수 있습니다.');
  const next=JSON.parse(JSON.stringify(data)),row=list(next.deletedWorks).find(r=>r.id===id);
  if(!row||list(next.works).some(r=>r.id===id))throw Error('복원할 내역을 다시 확인해 주세요.');
  const copy={...row};delete copy.deletedAt;next.works=[...list(next.works),copy];next.deletedWorks=list(next.deletedWorks).filter(r=>r.id!==id);return next;
 }
 const api={remove,restore};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.AekyungDeletion=api;
 if(ClientConfig.key!=='aekyung')return;
 let allowed=false,busy=false,pending=null;
 const host=document.createElement('div');host.className='panel';host.innerHTML=`<h2>내역 삭제·복원</h2><p id="aekyungDeleteAccess" class="muted">삭제는 관리자만 가능합니다. <a class="button" href="https://ts3pl-wms.onrender.com/manage/aekyung" target="_blank" rel="noopener">관리자 화면 열기</a></p><div id="aekyungDeleteConfirm" hidden style="padding:16px;background:#fff5ed;border:1px solid #f0c3a4;border-radius:12px;margin:14px 0"><p id="aekyungDeletePreview"></p><p class="muted">저장하면 해당 입출고·기타비용이 정산에서 제외됩니다. 아래 삭제한 내역에서 복원할 수 있습니다. 별도 보관 수량 기록은 바뀌지 않습니다.</p><button id="aekyungDeleteApply" type="button" style="color:#a32f30">삭제 저장</button> <button id="aekyungDeleteCancel" type="button">취소</button></div><p id="aekyungDeleteStatus" role="status" aria-live="polite"></p><details><summary>삭제한 내역 · 복원</summary><div class="scroll"><table><thead><tr><th>날짜</th><th>작업 내용</th><th class="num">금액</th><th>관리</th></tr></thead><tbody id="aekyungDeletedRows"></tbody></table></div></details>`;
 $('tab-works').appendChild(host);
 function paint(){
  $('aekyungDeleteAccess').hidden=allowed;
  for(const b of $('workRows').querySelectorAll('[data-work]')){
   const button=document.createElement('button');button.type='button';button.dataset.aekyungDelete=b.dataset.work;button.textContent='삭제';button.disabled=!allowed||busy||!nhTag||nhSaving;button.style.cssText='margin-left:6px;color:#a32f30';if(!allowed)button.title='관리자 화면에서 삭제할 수 있습니다.';b.after(button);
  }
  $('aekyungDeletedRows').innerHTML=list(nhData.deletedWorks).filter(r=>r.date.startsWith($('month').value)).sort((a,b)=>b.deletedAt-a.deletedAt).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.desc)}</td><td class="num">${won(r.mode==='total'?r.amount:r.qty*r.rate)}</td><td><button type="button" data-aekyung-restore="${esc(r.id)}" ${allowed&&!busy&&nhTag&&!nhSaving?'':'disabled'}>복원</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">이 달에 삭제한 내역이 없습니다.</td></tr>';
 }
 const oldRender=render;render=function(){oldRender();paint();};
 function ready(){if(!allowed){$('aekyungDeleteStatus').textContent='관리자 화면에서 삭제·복원할 수 있습니다.';return false;}if(busy||nhSaving)return false;if(!nhTag||nhDirty){$('aekyungDeleteStatus').textContent=nhDirty?'다른 변경사항을 먼저 지금 저장한 뒤 삭제·복원하세요.':'새로 불러오기로 서버 연결을 확인하세요.';return false;}return true;}
 $('workRows').addEventListener('click',e=>{const b=e.target.closest('[data-aekyung-delete]');if(!b||!ready())return;const row=list(nhData.works).find(r=>r.id===b.dataset.aekyungDelete);if(!row)return;pending=row.id;$('aekyungDeletePreview').textContent=`${row.date} · ${row.desc} · ${won(row.mode==='total'?row.amount:row.qty*row.rate)} 내역을 삭제합니다.`;$('aekyungDeleteConfirm').hidden=false;});
 $('aekyungDeleteCancel').onclick=()=>{pending=null;$('aekyungDeleteConfirm').hidden=true;};
 async function commit(next,message){
  const previous=nhData;busy=true;
  // Prevent edits while this conditional save is pending; preserve disabled states.
  const controls=[...document.querySelectorAll('input,select,button')].map(e=>[e,e.disabled]);controls.forEach(([e])=>e.disabled=true);
  try{stage(CostLedger.normalize(next));await saveNH();if(nhDirty||!nhTag)throw Error('서버 저장을 확인하지 못했습니다. 새로 불러온 뒤 내역을 확인하세요.');if(nhEditId&&!list(nhData.works).some(r=>r.id===nhEditId))resetWork();$('aekyungDeleteStatus').textContent=message;pending=null;$('aekyungDeleteConfirm').hidden=true;}
  catch(e){nhData=previous;nhDirty=false;nhTag=null;localStorage.setItem(NH_LOCAL,JSON.stringify(previous));$('aekyungDeleteStatus').textContent=e.message;}
  finally{busy=false;controls.forEach(([e,disabled])=>e.disabled=disabled);render();}
 }
 $('aekyungDeleteApply').onclick=async()=>{if(!pending||!ready())return;try{await commit(remove(nhData,pending),'삭제 저장 완료 · 통합정산에서 제외되었습니다. 삭제한 내역에서 복원할 수 있습니다.');}catch(e){$('aekyungDeleteStatus').textContent=e.message;}};
 $('aekyungDeletedRows').addEventListener('click',async e=>{const b=e.target.closest('[data-aekyung-restore]');if(!b||!ready())return;try{await commit(restore(nhData,b.dataset.aekyungRestore),'복원 저장 완료 · 정산에 다시 반영되었습니다.');}catch(err){$('aekyungDeleteStatus').textContent=err.message;}});
 if(typeof portalBridge!=='undefined')portalBridge.session.then(s=>{allowed=s.key==='aekyung'&&s.writable===true;render();}).catch(()=>{});
 render();
})(typeof window==='object'?window:globalThis);
