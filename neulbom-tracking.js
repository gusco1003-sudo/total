(function(){'use strict';
 const form=document.getElementById('trackingSearch');if(!form)return;
 const input=document.getElementById('trackingNumber'),button=document.getElementById('trackingSubmit');
 const message=document.getElementById('trackingMessage'),result=document.getElementById('trackingResult');
 const A=NeulbomAuth;let serial=0,controller=null;
 function clear(){serial++;controller?.abort();controller=null;result.replaceChildren();result.hidden=true;message.textContent='대표송장 또는 개별 박스 송장번호를 입력하세요.';message.classList.remove('error');button.disabled=false;button.textContent='송장 조회';}
 function note(text,error=false){message.textContent=text;message.classList.toggle('error',error);}
 input.addEventListener('input',clear);
 A.auth.onAuthStateChanged(()=>{clear();input.value='';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();clear();const stamp=serial;
  const number=input.value.replace(/[\s-]/g,'');
  if(!/^(?:[0-9]{10}|[0-9]{12})$/.test(number)){note('한진 송장번호 10자리 또는 12자리를 입력해 주세요.',true);return;}
  const user=A.auth.currentUser;if(!user){note('화주 조회 계정으로 로그인해 주세요.',true);return;}
  const requestController=new AbortController();controller=requestController;const signal=requestController.signal,timer=setTimeout(()=>requestController.abort(),25000);
  button.disabled=true;button.textContent='조회 중…';note('출고 기록을 조회하고 있습니다.');
  try{
   let response;
   for(let attempt=0;attempt<2;attempt++){
    const token=await user.getIdToken(attempt===1);
    if(stamp!==serial||A.auth.currentUser?.uid!==user.uid)return;
    response=await fetch('https://bless-reshuffle-vest.ngrok-free.dev/api/shipper/tracking-search',{
     method:'POST',credentials:'omit',cache:'no-store',signal,
     headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},
     body:JSON.stringify({tracking_number:number})});
    if(response.status!==401||attempt===1)break;
   }
   const body=await response.json();if(stamp!==serial||A.auth.currentUser?.uid!==user.uid)return;
   if(!response.ok)throw Error(typeof body.detail==='string'?body.detail:'송장 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
   if(body.found===false){note('송장전송이 완료된 출고 이력에서 찾지 못했습니다. 번호를 확인하거나 TS3PL에 문의해 주세요.');return;}
   if(body.found!==true||body.tracking_number!==number||!/^20\d{2}-\d{2}-\d{2}$/.test(body.dispatch_date)||!Number.isSafeInteger(body.shipment_boxes)||body.shipment_boxes<1||body.matched_boxes!==1||typeof body.recipient_name!=='string')throw Error('출고 기록 형식을 확인할 수 없습니다. TS3PL에 문의해 주세요.');
   const fields=[['조회 송장번호',body.tracking_number],['출고일',body.dispatch_date],['수취인',body.recipient_name||'이름 미등록'],['배송수량',body.shipment_boxes.toLocaleString('ko-KR')+' 박스']];
   for(const [label,value] of fields){const card=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;card.append(term,description);result.append(card);}
   result.hidden=false;note('조회한 송장 1개 = 1박스 · 배송수량은 같은 출고에 등록된 전체 송장 수입니다. 출고일은 송장전송 완료일 기준입니다.');
  }catch(error){if(stamp===serial){note(signal.aborted?'응답이 늦습니다. 잠시 후 다시 검색해 주세요.':error instanceof TypeError?'주문수집 서버에 연결할 수 없습니다. TS3PL에 서버 상태를 확인해 주세요.':error.message,true);}}
  finally{clearTimeout(timer);if(stamp===serial){controller=null;button.disabled=false;button.textContent='송장 조회';}}
 });
})();
