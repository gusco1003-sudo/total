(function(){
'use strict';
if(viewer)return;
const entryPanel=$('entries').closest('section'),manualPanel=$('manualEntries').closest('section');
entryPanel.id='entryRecords';manualPanel.id='manualRecords';
const guide=document.createElement('section');
guide.className='panel admin-only no-print edit-guide';
guide.innerHTML='<h2>기록 · 재고 수정</h2><p class="muted">기존 기록의 <strong>수정</strong> 버튼을 누르면 날짜·품목·수량·송장·메모를 바꿀 수 있습니다. 수정 내용에 맞춰 재고와 날짜별 정산이 다시 계산됩니다. 기록이 안 보이면 날짜별 정산의 조회 기간을 넓혀 주세요.</p><nav class="row"><a class="button" href="#entryRecords">입고 · 화물출고 수정</a><a class="button" href="#manualRecords">수동 택배 수정</a><a class="button" href="#stockPanel">실사 재고 수정</a><button type="button" id="editReturnsLink">반품 수정</button></nav><p class="muted">실사 재고는 유록스·호스의 현재 수량을 조정합니다. 유로플러스는 품목별 입출고 기록에서 수정하세요. 출고 2,400원 · 반품 2,500원 (각 부가세 별도).</p>';
$('content').prepend(guide);
$('editReturnsLink').onclick=()=>{const h=$('neulbomReturns');if(h){h.querySelector('details').open=true;h.scrollIntoView({behavior:'smooth'});}};
const dialog=document.createElement('dialog');dialog.id='manualEditDialog';dialog.className='record-dialog';
dialog.innerHTML=`<form id="manualEditForm"><h2>수동 택배 출고 수정</h2><p class="muted">기존 출고 기록을 수정합니다. 유록스는 박스당 호스 1개를 함께 차감하며 유로플러스는 별도 호스를 차감하지 않습니다.</p>
<div class="formgrid"><label>출고일<input name="day" type="date" required></label><label>출고처 / 구분<input name="party" maxlength="100"></label><label class="wide">메모<input name="note" maxlength="500"></label>
<label class="wide">유록스 송장번호 · 한 줄에 1박스<textarea name="eurox" rows="7" maxlength="300000" spellcheck="false"></textarea></label><label class="wide">유로플러스 송장번호 · 한 줄에 1박스<textarea name="europlus" rows="7" maxlength="300000" spellcheck="false"></textarea></label>
<label class="wide">또는 수정된 피킹리스트로 전체 교체<input name="file" type="file" accept=".xlsx"><span class="muted">파일을 선택하면 위 송장 목록 대신 파일 전체를 반영합니다.</span></label></div>
<p class="notice" id="manualEditSummary"></p><p id="manualEditMessage" role="alert"></p><div class="row"><button type="button" id="manualEditClose">닫기</button><button class="primary" type="submit">수정 저장 · 재고·정산 반영</button></div></form>`;
document.body.append(dialog);
const form=$('manualEditForm'),fields=form.elements,msg=$('manualEditMessage');
let entry=null,key='',original={},saving=false,opening=false,stamp=0;
const lines=value=>value.split(/[,;\n]+/).map(x=>x.replace(/[\s-]/g,'')).filter(Boolean);
function summary(){
 if(fields.file.files.length){$('manualEditSummary').textContent='선택한 파일의 품목별 송장 행 수로 이 출고 기록 전체를 교체합니다.';return;}
 const goods=lines(fields.eurox.value).length,plus=lines(fields.europlus.value).length;
 $('manualEditSummary').textContent=`수정 후 택배 ${money(goods+plus)}박스 · 유록스 ${money(goods)} / 유로플러스 ${money(plus)} · 호스 ${money(goods)}개 차감 · 택배비 ${money((goods+plus)*2640)}원 (부가세 포함)`;
}
window.openNeulbomManualEdit=async id=>{
 if(opening||saving)return;opening=true;const opened=epoch;
 try{
  const result=await manualRequest('batches/'+id,undefined,'GET');if(opened!==epoch)return;
  if(result.voided)throw Error('취소된 기록은 먼저 복원한 뒤 수정하세요.');
  entry=result;stamp=opened;key=crypto.randomUUID();form.reset();msg.textContent='';msg.className='';
  for(const name of ['day','party','note'])fields[name].value=result[name];
  fields.day.max=C.today();
  for(const product of ['eurox','europlus'])fields[product].value=result.items.filter(p=>p.product===product).map(p=>p.tracking).join('\n');
  original={eurox:fields.eurox.value,europlus:fields.europlus.value};summary();dialog.showModal();
 }finally{opening=false;}
};
form.oninput=()=>{if(saving)return;key=crypto.randomUUID();msg.textContent='';summary();};
form.onchange=()=>{if(!saving)summary();};
$('manualEditClose').onclick=()=>{if(!saving)dialog.close();};
dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
form.onsubmit=async e=>{
 e.preventDefault();if(saving||!entry)return;saving=true;
 const controls=[...form.querySelectorAll('input,textarea,button')];controls.forEach(x=>x.disabled=true);
 try{
  const body={revision:entry.revision,request_key:key,day:fields.day.value,party:fields.party.value,note:fields.note.value};
  const file=fields.file.files[0];
  if(file){
   if(file.size>10*1024*1024)throw Error('파일은 10MB 이하로 선택하세요.');
   const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
   for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   body.file={name:file.name,content:btoa(binary)};
  }else if(fields.eurox.value!==original.eurox||fields.europlus.value!==original.europlus){
   body.items=['eurox','europlus'].flatMap(product=>lines(fields[product].value).map(tracking=>({tracking,product})));
   if(!body.items.length||body.items.length>20000||body.items.some(p=>! /^(?:\d{10}|\d{12})$/.test(p.tracking)))throw Error('한진 송장번호를 10자리 또는 12자리로 입력하세요. 전체 삭제는 기록의 취소 버튼을 이용하세요.');
  }
  msg.className='notice';msg.textContent='기록·재고·정산을 수정하고 있습니다…';
  const result=await manualRequest('batches/'+entry.id,body,'PUT');if(stamp!==epoch)return;
  await showManualSource(result.source);dialog.close();
  const r=result.entry;status(`${r.day} 수동 택배 수정 완료 · 유록스 ${money(r.eurox_boxes)} / 유로플러스 ${money(r.europlus_boxes)} · 총 ${money(r.boxes)}박스 · ${money(r.total)}원 (부가세 포함)`);
 }catch(error){msg.className='notice error';msg.textContent=error.name==='TimeoutError'?'응답이 늦습니다. 내용을 바꾸지 않고 저장을 다시 누르면 중복 반영 없이 결과를 확인합니다.':error.message;}
 finally{saving=false;controls.forEach(x=>x.disabled=false);}
};
A.auth.onAuthStateChanged(()=>{dialog.close();entry=null;});
})();
