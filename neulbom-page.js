'use strict';
const $=id=>document.getElementById(id),A=NeulbomAuth,C=Neulbom,viewer=document.body.dataset.mode==='viewer';
const money=n=>n==null?'—':Number(n).toLocaleString('ko-KR'),escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,settings={},editing=null,entryKey=crypto.randomUUID(),accountData={},loading=false,epoch=0;
let popup=null,channel='',pending=new Map(),connected=false;
const sourceOrigin='https://bless-reshuffle-vest.ngrok-free.dev';
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function clearData(){epoch++;data=null;settings={};accountData={};$('content').hidden=true;for(const id of ['daily','entries','sum','accounts'])$(id).replaceChildren();for(const id of ['remaining','todayBoxes','todayTotal','monthTotal'])$(id).textContent='—';$('accountResult').textContent='';$('accountPassword').value='';$('accountResult').hidden=true;}
async function run(fn){try{await fn();}catch(e){status(e.message||'처리에 실패했습니다.',true);}}
function amountCell(v){return '<td>'+money(v)+'</td>';}
function resetEntry(){editing=null;entryKey=crypto.randomUUID();$('entryForm').reset();$('entryDay').value=C.today();$('entrySave').textContent='기록 추가';}
function render(){
 if(!data)return;const today=C.today(),r=C.calculate(data,$('from').value,$('to').value,today),m=C.calculate(data,today.slice(0,7)+'-01',today,today);
 $('remaining').textContent=money(r.remaining)+' 개';$('todayBoxes').textContent=money(r.today_parcels)+' 박스';$('todayTotal').textContent=money(r.today_parcels*2640)+' 원';$('monthTotal').textContent=money(m.total)+' 원';
 $('palletEstimate').textContent=settings.boxesPerPallet&&r.remaining!=null?'약 '+money(Math.ceil(Math.max(0,r.remaining)/settings.boxesPerPallet))+' 파렛트 · '+money(settings.boxesPerPallet)+'개/PLT 환산':'파렛트 환산 기준 미설정';
 $('syncTime').textContent='자료 갱신 '+new Date(data.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
 const stale=Date.now()-Date.parse(data.updated_at)>15*60*1000;
 const warnings=[...r.warnings];if(stale)warnings.push('자동 동기화가 지연됐습니다. 마지막 갱신 시점의 자료입니다.');if(r.remaining<0)warnings.push('재고가 음수입니다. 입출고 기록을 확인해 주세요.');
 $('warnings').textContent=warnings.join('\n');$('warnings').hidden=!warnings.length;
 $('daily').innerHTML=[...r.daily].reverse().map(b=>'<tr><td>'+b.date+'</td>'+[b.received,b.parcel_boxes,b.other_boxes,b.hose_boxes,b.remaining,b.supply,b.vat,b.total].map(amountCell).join('')+'</tr>').join('');
 $('sum').innerHTML='<tr><td>기간 합계</td>'+[r.received,r.parcel_boxes,r.other_boxes,r.hose_boxes,r.closing,r.subtotal,r.vat,r.total].map(amountCell).join('')+'</tr>';
 $('period').textContent=$('from').value+' ~ '+$('to').value+' · 택배 '+money(r.parcel_boxes)+'건 · 합계 '+money(r.total)+'원';
 $('entries').innerHTML=r.entries.map(e=>'<tr class="'+(e.voided?'void':'')+'"><td>'+e.day+'</td><td>'+(e.kind==='receipt'?'입고':'별도 출고')+(e.voided?' (취소)':'')+'</td><td>'+escapeHTML(e.party)+'</td>'+[e.goods_boxes,e.pallets,e.hose_boxes].map(amountCell).join('')+'<td class="note">'+escapeHTML(e.note)+'</td>'+(!viewer?'<td><button data-edit="'+e.id+'">수정</button> <button data-void="'+e.id+'">'+(e.voided?'복원':'취소')+'</button></td>':'')+'</tr>').join('')||'<tr><td colspan="8">해당 기간의 기록이 없습니다.</td></tr>';
 $('palletSize').value=settings.boxesPerPallet||'';
}
async function load(){
 if(loading||!A.auth.currentUser)return;loading=true;const stamp=epoch;
 try{
  const [raw,cfg]=await Promise.all([A.read('neulbom_data/source'),A.read('neulbom_data/settings')]);
  if(stamp!==epoch)return;settings=cfg||{};
  if(!raw){data=null;$('content').hidden=false;status('첫 정산 자료 연결이 필요합니다. 관리자 화면에서 주문수집 서버 연결 → 자동 정산 연결을 눌러 주세요.',true);return;}
  data=C.normalize(raw);render();$('content').hidden=false;status(viewer?'늘봄 조회 전용 · 자료 수정 및 삭제는 관리자에게 요청해 주세요.':'늘봄 정산 자료를 불러왔습니다.');
 }catch(e){if(stamp===epoch){clearData();status(e.message,true);}}
 finally{loading=false;}
}
async function loadAccounts(){
 if(viewer||!A.owner(A.auth.currentUser))return;const stamp=epoch,raw=await A.read('neulbomAccess');if(stamp!==epoch)return;accountData=raw||{};
 $('accounts').innerHTML=Object.entries(accountData).map(([uid,a])=>'<tr><td>'+escapeHTML(a.username)+'</td><td>'+escapeHTML(a.label)+'</td><td>'+(a.active?'사용 중':'중지')+'</td><td><button data-account="'+escapeHTML(uid)+'">'+(a.active?'사용 중지':'사용 허용')+'</button></td></tr>').join('')||'<tr><td colspan="4">발급된 계정이 없습니다.</td></tr>';
}
function bridge(op,body,entryId){return new Promise((resolve,reject)=>{
 if(!connected||!popup||popup.closed)return reject(Error('먼저 주문수집 서버 연결 버튼을 눌러 주세요.'));
 const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('서버 응답이 늦습니다. 목록을 새로고침한 뒤 저장 여부를 확인하세요.'));},45000);
 pending.set(id,{resolve,reject,timer});popup.postMessage({protocol:'ts3pl-neulbom-v1',channel,id,op,body,entryId},sourceOrigin);
 });}
window.addEventListener('message',event=>{
 const m=event.data;if(event.source!==popup||event.origin!==sourceOrigin||!m||m.protocol!=='ts3pl-neulbom-v1'||m.channel!==channel)return;
 if(m.type==='ready'){connected=true;status('주문수집 서버 연결 완료. 입출고 기록과 자동 정산 연결을 사용할 수 있습니다.');return;}
 const p=pending.get(m.id);if(m.type!=='result'||!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);
});
async function publishLatest(){const raw=C.normalize(await bridge('read'));await A.write('neulbom_data/source',raw);await load();}
document.querySelectorAll('.admin-only').forEach(el=>el.hidden=viewer);
if(viewer){$('loginTitle').textContent='늘봄 조회 로그인';$('loginHelp').textContent='TS3PL에서 발급받은 아이디와 비밀번호를 입력하세요.';$('viewerLogin').hidden=false;}
$('googleLogin').onclick=()=>run(()=>A.loginOwner());
$('viewerLogin').onsubmit=e=>{e.preventDefault();run(async()=>{await A.auth.signInWithEmailAndPassword(A.email($('username').value.trim()),$('password').value);$('password').value='';});};
$('logout').onclick=()=>run(async()=>{clearData();await A.auth.signOut();});
$('query').onclick=()=>run(async()=>{render();await load();});$('print').onclick=()=>window.print();
$('thisMonth').onclick=()=>run(async()=>{$('from').value=C.today().slice(0,7)+'-01';$('to').value=C.today();render();});
$('connect').onclick=()=>{connected=false;channel=crypto.randomUUID();popup=window.open(sourceOrigin+'/static/settlement-bridge.html?target='+encodeURIComponent(location.origin)+'&channel='+channel,'neulbom-source','width=540,height=650');if(!popup)status('팝업 차단을 해제하고 다시 연결해 주세요.',true);};
$('activateSync').onclick=()=>run(async()=>{
 if(!A.owner(A.auth.currentUser))throw Error('관리자 로그인이 필요합니다.');
 const worker=await bridge('sync-prepare');await A.write('neulbomSync',{uid:worker.uid,enabled:true});
 await publishLatest();await bridge('sync-enable');status('자동 정산 연결 완료. 서버에서 1분마다 갱신하며, 서버가 꺼져 있어도 마지막 저장 자료를 조회할 수 있습니다.');
});
$('savePallet').onclick=()=>run(async()=>{const raw=$('palletSize').value,n=raw?Number(raw):null;if(n!==null&&(!Number.isInteger(n)||n<1||n>100000))throw Error('박스 수를 확인하세요.');await A.write('neulbom_data/settings',{boxesPerPallet:n});settings={boxesPerPallet:n};render();status('파렛트 환산 기준을 저장했습니다.');});
$('entryReset').onclick=resetEntry;
$('entryForm').onsubmit=e=>{e.preventDefault();run(async()=>{
 $('entrySave').disabled=true;try{
 const body={day:$('entryDay').value,kind:$('entryKind').value,party:$('entryParty').value,goods_boxes:Number($('entryGoods').value),pallets:Number($('entryPallets').value),hose_boxes:Number($('entryHose').value),note:$('entryNote').value};
 if(editing)body.revision=editing.revision;else body.client_key=entryKey;
 await bridge(editing?'edit':'add',body,editing?.id);resetEntry();
 try{await publishLatest();status('기록 저장 및 정산 반영 완료.');}catch{status('기록은 주문수집 서버에 저장됐습니다. 정산 화면 동기화가 지연되어 자동 재시도합니다.',true);}
 }finally{$('entrySave').disabled=false;}
 });};
$('entries').onclick=e=>run(async()=>{
 const b=e.target.closest('button');if(!b||!data)return;const id=Number(b.dataset.edit||b.dataset.void),entry=data.entries.find(x=>x.id===id);if(!entry)return;
 if(b.dataset.edit){editing=entry;$('entryDay').value=entry.day;$('entryKind').value=entry.kind;$('entryParty').value=entry.party;$('entryGoods').value=entry.goods_boxes;$('entryPallets').value=entry.pallets;$('entryHose').value=entry.hose_boxes;$('entryNote').value=entry.note;$('entrySave').textContent='기록 수정';$('entryForm').scrollIntoView({behavior:'smooth'});}
 else{await bridge('void',{revision:entry.revision,voided:!entry.voided},id);await publishLatest();status('기록 상태가 변경됐습니다. 취소 기록은 복원할 수 있습니다.');}
});
$('accountForm').onsubmit=e=>{e.preventDefault();run(async()=>{const b=e.submitter;b.disabled=true;try{
 const username=$('accountName').value.trim();await A.issue(username,$('accountPassword').value,$('accountLabel').value);$('accountPassword').value='';
 $('accountResult').hidden=false;$('accountResult').textContent='계정 발급 완료\n아이디: '+username+'\n조회 주소: '+new URL('./neulbom-view.html',location.href).href+'\n입력한 비밀번호와 주소를 화주에게 전달해 주세요.';await loadAccounts();status('화주 조회 계정이 발급됐습니다.');
 }finally{b.disabled=false;}});};
$('accounts').onclick=e=>run(async()=>{const uid=e.target.closest('button')?.dataset.account;if(!uid||!accountData[uid])return;await A.write('neulbomAccess/'+uid,{...accountData[uid],active:!accountData[uid].active});await loadAccounts();status('조회 계정 사용 상태를 변경했습니다.');});
A.auth.onAuthStateChanged(user=>{clearData();$('loginPanel').hidden=!!user;$('logout').hidden=!user;if(!user){status('로그인해 주세요.');return;}
 if(!viewer&&!A.owner(user)){$('loginPanel').hidden=false;status('관리자 계정이 아닙니다. 로그아웃 후 Google 관리자 계정으로 로그인해 주세요.',true);return;}
 $('accessLabel').textContent=viewer?'화주 조회 전용':'TS3PL 관리자';run(async()=>{await load();await loadAccounts();});
});
$('from').value=C.today().slice(0,7)+'-01';$('to').value=C.today();resetEntry();
setInterval(()=>{if(!document.hidden&&A.auth.currentUser&&(viewer||A.owner(A.auth.currentUser)))run(load);},60000);
