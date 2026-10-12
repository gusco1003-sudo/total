'use strict';
async function fetchNeulbomForTotal(){
 await NeulbomAuth.ready;
 if(!NeulbomAuth.owner(NeulbomAuth.auth.currentUser))throw Error('늘봄 관리자 연결 버튼으로 로그인해 주세요.');
 const uid=NeulbomAuth.auth.currentUser.uid,r=await NeulbomAuth.request('neulbom_data/source');
 return {ok:r.ok,status:r.status,json:async()=>{const value=await r.json();
  if(NeulbomAuth.auth.currentUser?.uid!==uid||!NeulbomAuth.owner(NeulbomAuth.auth.currentUser))throw Error('늘봄 관리자 연결이 해제됐습니다.');
  return value;
 }};
}
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('div');bar.style.cssText='padding:12px 18px;border-radius:12px;background:#e9f4ed;color:#245942;display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 16px;font-size:13px';
 bar.innerHTML='<span id="neulbomTotalState">늘봄 정산은 관리자 계정으로 연결합니다.</span><form id="neulbomTotalForm" style="display:flex;gap:8px;flex-wrap:wrap"><input aria-label="늘봄 관리자 아이디" name="username" value="ts3pl" autocomplete="username" required style="border:1px solid #acc8b8;border-radius:6px;padding:7px;width:110px"><input aria-label="늘봄 관리자 비밀번호" name="password" type="password" placeholder="관리자 비밀번호" autocomplete="current-password" required style="border:1px solid #acc8b8;border-radius:6px;padding:7px;width:150px"><button type="submit" style="background:white;padding:7px 13px;border:1px solid #acc8b8;border-radius:8px">늘봄 연결</button></form><button id="neulbomTotalLogin" hidden>늘봄 연결 해제</button><a href="./neulbom.html" style="text-decoration:underline">늘봄 재고·계정 관리</a>';
 document.getElementById('appContent').prepend(bar);
 const b=document.getElementById('neulbomTotalLogin'),s=document.getElementById('neulbomTotalState');
 const form=document.getElementById('neulbomTotalForm');
 b.onclick=async()=>{b.disabled=true;try{await NeulbomAuth.auth.signOut();await refreshData(false);}catch(e){s.textContent=e.message;}finally{b.disabled=false;}};
 form.onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{await NeulbomAuth.loginOwner(form.elements.username.value.trim(),form.elements.password.value);form.elements.password.value='';await refreshData(false);}catch(e){s.textContent='늘봄 로그인 실패: '+e.message;}finally{submit.disabled=false;}};
 NeulbomAuth.auth.onAuthStateChanged(user=>{
  const ok=NeulbomAuth.owner(user);s.textContent=ok?'늘봄 관리자 연결 완료':'늘봄 로그인 전에는 늘봄 금액이 전체 합계에서 제외됩니다.';b.hidden=!ok;form.hidden=ok;form.style.display=ok?'none':'flex';
  if(!ok){store.neulbom={};syncErr.neulbom='늘봄 관리자 로그인이 필요합니다.';calcCache={};}
  if(!document.getElementById('appContent').classList.contains('hidden')){if(!ok)render();refreshData(false);}
 });
});
