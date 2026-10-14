(function(){
const A=NeulbomAuth;let host;
A.auth.onAuthStateChanged(user=>{if(host){host.remove();host=null;}if(!user)return;
 host=document.createElement('section');host.id='neulbomReturns';document.getElementById('content').prepend(host);
 mountNeulbomReturns(host,async(method,path='',body)=>{
  const current=A.auth.currentUser;if(!current)throw Error('다시 로그인하세요.');
  const token=await current.getIdToken();const r=await fetch('https://bless-reshuffle-vest.ngrok-free.dev/api/returns'+path,{method,credentials:'omit',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  const result=await r.json();if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'반품 입력을 확인하세요.');if(A.auth.currentUser?.uid!==current.uid)throw Error('로그인 상태가 변경됐습니다.');return result;
 },async()=>{await load();});
});
})();
