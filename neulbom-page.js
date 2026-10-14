'use strict';
const $=id=>document.getElementById(id),A=NeulbomAuth,C=Neulbom,viewer=document.body.dataset.mode==='viewer';
const money=n=>n==null?'—':Number(n).toLocaleString('ko-KR'),escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,settings={},stock={revision:0},stockDirty=false,editing=null,entryKey=crypto.randomUUID(),accountData={},loading=false,epoch=0;
let manualBusy=false,manualRequestKey=crypto.randomUUID();
let popup=null,channel='',pending=new Map(),connected=false;
const sourceOrigin='https://bless-reshuffle-vest.ngrok-free.dev';
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function clearData(){epoch++;data=null;settings={};stock={revision:0};stockDirty=false;manualPreview=null;$('manualForm').reset();$('manualDay').value=C.today();$('manualCommit').disabled=true;$('stockForm').reset();accountData={};$('content').hidden=true;for(const id of ['daily','europlusDaily','entries','manualEntries','sum','accounts'])$(id).replaceChildren();for(const id of ['remaining','hoseRemaining','todayBoxes','todayTotal','monthTotal','europlusRemaining','europlusReceived','europlusOutbound','europlusPeriod'])$(id).textContent='—';$('accountResult').textContent='';$('accountPassword').value='';$('accountResult').hidden=true;}
async function run(fn){try{await fn();}catch(e){status(e.message||'처리에 실패했습니다.',true);}}
function amountCell(v){return '<td>'+money(v)+'</td>';}
function updateEntryProduct(){const plus=$('entryProduct').value==='europlus';$('entryGoodsLabel').textContent=plus?'유로플러스 박스':'유록스 박스';$('entryHoseField').hidden=plus;$('entryHose').disabled=plus;if(plus)$('entryHose').value=0;$('entryProductHelp').textContent=plus?'유로플러스는 호스 포함 제품입니다. 이 기록은 유로플러스 재고에만 반영되며 유록스·별도 호스·택배비에는 영향을 주지 않습니다.':'유록스와 별도 호스 입출고를 기록합니다. 기존 유록스 택배 출고의 호스 자동 차감은 유지됩니다.';}
function resetEntry(){editing=null;entryKey=crypto.randomUUID();$('entryForm').reset();$('entryDay').value=C.today();$('entrySave').textContent='기록 추가';updateEntryProduct();}
function allStockEntries(){return [...data.entries.map(e=>({...e,product:'eurox'})),...data.europlus_entries.map(e=>({...e,product:'europlus'}))];}
function render(){
 if(!data)return;const today=C.today(),r=C.calculate(data,$('from').value,$('to').value,today),m=C.calculate(data,today.slice(0,7)+'-01',today,today);
 const current=C.inventory(data,stock,today);
 const ep=C.europlus(data,$('from').value,$('to').value,today);
 $('europlusRemaining').textContent=ep.remaining==null?'미등록':money(ep.remaining)+' 박스';
 $('europlusReceived').textContent=money(ep.received)+' 박스';$('europlusOutbound').textContent=money(ep.outbound)+' 박스';
 $('europlusPeriod').textContent=$('from').value+' ~ '+$('to').value+' · 현재 재고는 오늘 기준';
 $('europlusDaily').innerHTML=ep.daily.map(b=>'<tr><td>'+b.date+'</td>'+[b.received,b.outbound,b.remaining].map(amountCell).join('')+'</tr>').join('')||'<tr><td colspan="4">조회 기간에 유로플러스 입출고 기록이 없습니다.</td></tr>';
 $('remaining').textContent=money(current.goods)+' 개';$('hoseRemaining').textContent=money(current.hose)+' 개';
 $('hosePacking').textContent=current.hose<0?money(-current.hose)+'개 부족 · 호스 입고 필요':current.hose_boxes==null?'1박스 = 25개 · 실사 수량 미입력':money(current.hose_boxes)+'박스 + '+money(current.hose_loose)+'개 · 1박스 = 25개';
 $('stockUpdated').textContent=current.updated_at?'재고 실사 저장 '+new Date(current.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'입출고 기록 기준 · 재고 실사 미입력';
 if(!stockDirty){$('stockGoods').value='';$('stockHose').value='';$('stockThroughDay').checked=!!stock.goods?.through_day;}
 $('stockGoods').placeholder=current.goods==null?'미입력':String(current.goods);$('stockHose').placeholder=current.hose==null?'미입력':String(current.hose);
 $('todayBoxes').textContent=money(r.today_parcels)+' 박스';$('todayTotal').textContent=money(r.today_parcels*2640)+' 원';$('monthTotal').textContent=money(m.total)+' 원';
 $('palletEstimate').textContent=settings.boxesPerPallet&&current.goods!=null?'약 '+money(Math.ceil(Math.max(0,current.goods)/settings.boxesPerPallet))+' 파렛트 · '+money(settings.boxesPerPallet)+'개/PLT 환산':'파렛트 환산 기준 미설정';
 $('syncTime').textContent='자료 갱신 '+new Date(data.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
 const stale=Date.now()-Date.parse(data.updated_at)>15*60*1000;
 const warnings=[...r.warnings];if(stale)warnings.push('자동 동기화가 지연됐습니다. 마지막 갱신 시점의 자료입니다.');if(current.goods<0||current.hose<0)warnings.push('재고가 음수입니다. 입출고 기록을 확인해 주세요.');
 if(ep.remaining<0)warnings.push('유로플러스 재고가 음수입니다. 유로플러스 입출고 기록을 확인하세요.');
 $('warnings').textContent=warnings.join('\n');$('warnings').hidden=!warnings.length;
 $('daily').innerHTML=[...r.daily].reverse().map(b=>'<tr><td>'+b.date+'</td>'+[b.received,b.parcel_boxes,b.other_boxes,b.hose_boxes*25+b.parcel_boxes,b.remaining,b.supply,b.vat,b.total].map(amountCell).join('')+'</tr>').join('');
 $('sum').innerHTML='<tr><td>기간 합계</td>'+[r.received,r.parcel_boxes,r.other_boxes,r.hose_boxes*25+r.parcel_boxes,r.closing,r.subtotal,r.vat,r.total].map(amountCell).join('')+'</tr>';
 $('period').textContent=$('from').value+' ~ '+$('to').value+' · 택배 '+money(r.parcel_boxes)+'건 · 합계 '+money(r.total)+'원';
 $('entries').innerHTML=allStockEntries().filter(e=>e.day>=$('from').value&&e.day<=$('to').value).sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id).map(e=>'<tr class="'+(e.voided?'void':'')+'"><td>'+e.day+'</td><td>'+(e.kind==='receipt'?'입고':'별도 출고')+(e.voided?' (취소)':'')+'</td><td>'+escapeHTML(e.party)+'</td><td><strong>'+(e.product==='europlus'?'유로플러스':'유록스')+'</strong><br>'+money(e.goods_boxes)+'박스</td>'+amountCell(e.pallets)+'<td>'+(e.product==='europlus'?'제품에 포함':money(e.hose_boxes))+'</td><td class="note">'+escapeHTML(e.note)+'</td>'+(!viewer?'<td><button data-edit="'+e.id+'">수정</button> <button data-void="'+e.id+'">'+(e.voided?'복원':'취소')+'</button></td>':'')+'</tr>').join('')||'<tr><td colspan="8">해당 기간의 기록이 없습니다.</td></tr>';
 $('palletSize').value=settings.boxesPerPallet||'';
 $('manualEntries').innerHTML=data.manual_dispatches.filter(e=>e.day>=$('from').value&&e.day<=$('to').value).sort((a,b)=>b.day.localeCompare(a.day)||b.id-a.id).map(e=>'<tr class="'+(e.voided?'void':'')+'"><td>'+e.day+'</td><td>'+escapeHTML(e.party||'수동 택배')+'</td><td>'+money(e.listed_boxes)+'</td><td>'+money(e.boxes)+'</td><td>'+money(e.boxes)+'</td><td>'+money(e.boxes*2640)+'</td><td>'+escapeHTML(e.note)+'</td>'+(!viewer?'<td><button data-manual="'+e.id+'">'+(e.voided?'복원':'취소')+'</button></td>':'')+'</tr>').join('')||'<tr><td colspan="8">수동 택배 출고 기록이 없습니다.</td></tr>';
}
async function load(){
 if(loading||!A.auth.currentUser)return;loading=true;const stamp=epoch;
 try{
  const [raw,cfg,inventory]=await Promise.all([A.read('neulbom_data/source'),A.read('neulbom_data/settings'),A.read('neulbom_data/inventory')]);
  if(stamp!==epoch)return;settings=cfg||{};if(!stockDirty)stock=C.normalizeInventory(inventory);
  if(!raw){data=null;$('content').hidden=false;status('첫 정산 자료 연결이 필요합니다. 관리자 화면에서 주문수집 서버 연결 → 자동 정산 연결을 눌러 주세요.',true);return;}
  data=C.normalize(raw);render();$('content').hidden=false;if(!manualBusy)status(viewer?'늘봄 조회 전용 · 자료 수정 및 삭제는 관리자에게 요청해 주세요.':'늘봄 정산 자료를 불러왔습니다.');
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
$('viewerLogin').hidden=false;
if(viewer){$('loginTitle').textContent='늘봄 조회 로그인';$('loginHelp').textContent='TS3PL에서 발급받은 아이디와 비밀번호를 입력하세요.';}
else{$('loginHelp').textContent='관리자 아이디와 비밀번호를 입력해 주세요.';$('username').value='ts3pl';}
$('viewerLogin').onsubmit=e=>{e.preventDefault();const button=e.submitter;if(button.disabled)return;run(async()=>{button.disabled=true;button.textContent='로그인 중…';status('로그인 정보를 확인하고 있습니다.');try{const name=$('username').value.trim(),pw=$('password').value;
 if(viewer)await A.auth.signInWithEmailAndPassword(A.email(name),pw);else await A.loginOwner(name,pw);$('password').value='';}finally{button.disabled=false;button.textContent='조회하기';}});};
$('logout').onclick=()=>run(async()=>{clearData();await A.auth.signOut();});
$('query').onclick=()=>run(async()=>{render();await load();});$('print').onclick=()=>window.print();
$('thisMonth').onclick=()=>run(async()=>{$('from').value=C.today().slice(0,7)+'-01';$('to').value=C.today();render();});
$('connect').onclick=()=>{connected=false;channel=crypto.randomUUID();popup=window.open(sourceOrigin+'/static/settlement-bridge.html?target='+encodeURIComponent(location.origin)+'&channel='+channel,'neulbom-source','width=540,height=650');if(!popup)status('팝업 차단을 해제하고 다시 연결해 주세요.',true);};
$('activateSync').onclick=()=>run(async()=>{
 if(!A.owner(A.auth.currentUser))throw Error('관리자 로그인이 필요합니다.');
 const worker=await bridge('sync-prepare');await A.write('neulbomSync',{uid:worker.uid,enabled:true});
 await publishLatest();await bridge('sync-enable');status('자동 정산 연결 완료. 서버에서 1분마다 갱신하며, 서버가 꺼져 있어도 마지막 저장 자료를 조회할 수 있습니다.');
});
$('savePallet').onclick=()=>run(async()=>{const raw=$('palletSize').value,n=raw?Number(raw):null;if(n!==null&&(!Number.isInteger(n)||n<1||n>100000))throw Error('박스 수를 확인하세요.');await A.write('neulbom_data/settings/boxesPerPallet',n);settings={...settings,boxesPerPallet:n};render();status('파렛트 환산 기준을 저장했습니다.');});
$('stockForm').addEventListener('input',()=>{stockDirty=true;});
$('stockReload').onclick=()=>run(async()=>{stockDirty=false;await load();status('최신 재고를 불러왔습니다.');});
$('stockForm').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(viewer||!A.owner(A.auth.currentUser))throw Error('관리자만 재고를 변경할 수 있습니다.');
 const values={goods:$('stockGoods').value,hose:$('stockHose').value};
 if(!Object.values(values).some(v=>v!==''))throw Error('수정할 재고 수량을 입력하세요.');
 for(const v of Object.values(values))if(v!==''&&(!Number.isSafeInteger(Number(v))||Number(v)<0||Number(v)>10000000))throw Error('재고는 0~10,000,000 사이 정수로 입력하세요.');
 const b=$('stockSave'),stamp=epoch;b.disabled=true;
 try{
  const [latest,fresh]=await Promise.all([A.readVersion('neulbom_data/inventory'),A.read('neulbom_data/source')]);
  if(stamp!==epoch)throw Error('로그인 상태가 변경됐습니다. 다시 로그인하세요.');
  const previous=C.normalizeInventory(latest.value);
  if(previous.revision!==stock.revision)throw Error('다른 화면에서 재고가 변경됐습니다. 최신 재고 불러오기를 누른 뒤 다시 입력하세요.');
  const day=C.today(),net=C.stockNet(fresh,day),next={...previous,revision:previous.revision+1,updated_at:new Date().toISOString()};
  for(const key of ['goods','hose'])if(values[key]!=='')next[key]={quantity:Number(values[key]),baseline:net[key],day,...(key==='hose'?{parcel_rule:1}:{}),...(key==='goods'&&$('stockThroughDay').checked?{through_day:true}:{})};
  await A.compareWrite('neulbom_data/inventory',next,latest.etag);
  stockDirty=false;stock=next;await load();status('재고만 저장했습니다. 화주 조회 화면과 화주라운지에 반영되며 정산 금액은 그대로입니다.');
 }finally{b.disabled=false;}
});};
let manualPreview=null;
async function manualRequest(path,body){
 if(viewer||!A.owner(A.auth.currentUser))throw Error('관리자 로그인이 필요합니다.');
 const user=A.auth.currentUser;
 let response;
 for(let attempt=0;attempt<2;attempt++){
  const token=await user.getIdToken(attempt===1);
  response=await fetch(sourceOrigin+'/api/settlement/manual/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(response.status!==401||attempt===1)break;
 }
 const result=await response.json();if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'출고 반영에 실패했습니다.');return result;
}
async function showManualSource(raw){
 const normalized=C.normalize(raw);
 try{await A.write('neulbom_data/source',normalized);}catch{data=normalized;render();status('출고는 저장됐습니다. 화주 화면 자료는 자동 갱신됩니다.');return;}
 data=normalized;render();
}
$('manualForm').addEventListener('input',()=>{if(manualBusy)return;manualRequestKey=crypto.randomUUID();$('manualResult').textContent='업로드한 송장 행 수만큼 재고 차감과 비용 정산을 반영합니다.';});
$('manualForm').onsubmit=e=>{e.preventDefault();if(manualBusy)return;run(async()=>{
 manualBusy=true;const stamp=epoch,controls=[...document.querySelectorAll('#manualForm input,#manualForm textarea,#manualForm button')];controls.forEach(x=>x.disabled=true);
 try{
  status('파일을 읽고 있습니다…');$('manualResult').textContent='파일을 읽고 있습니다…';
  const body={day:$('manualDay').value,party:$('manualParty').value,note:$('manualNote').value,tracking:$('manualTracking').value,client_key:manualRequestKey};
  const file=$('manualFile').files[0];
  if(file){if(file.size>10*1024*1024)throw Error('파일은 10MB 이하로 선택하세요.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));body.file={name:file.name,content:btoa(binary)};}
  status('출고 기록·재고·비용 정산을 반영하고 있습니다…');$('manualResult').textContent='재고 차감과 비용 정산을 반영하고 있습니다…';
  const result=await manualRequest('upload',body);if(stamp!==epoch)return;
  await showManualSource(result.source);$('manualForm').reset();$('manualDay').value=C.today();manualRequestKey=crypto.randomUUID();
  $('manualResult').textContent=result.day+' 출고 '+money(result.boxes)+'박스 반영 완료 · 유록스 '+money(result.boxes)+'개 / 호스 '+money(result.boxes)+'개 차감 · 택배비 '+money(result.total)+'원 (부가세 포함)';status('출고 기록·재고·비용 정산을 반영했습니다.');
 }catch(e){$('manualResult').textContent=e.name==='TimeoutError'?'서버 응답이 늦습니다. 다시 누르면 같은 요청의 저장 결과를 확인합니다.':e.message;throw e;}
 finally{manualBusy=false;controls.forEach(x=>x.disabled=false);$('manualCommit').disabled=true;}
});};
$('manualEntries').onclick=e=>run(async()=>{const id=Number(e.target.closest('button')?.dataset.manual),entry=data?.manual_dispatches.find(x=>x.id===id);if(!entry)return;const result=await manualRequest(id+'/void',{revision:entry.revision,voided:!entry.voided});await showManualSource(result.source);status('수동 택배 출고 상태를 변경했습니다.');});
$('manualDay').value=C.today();
$('entryReset').onclick=resetEntry;
$('entryProduct').onchange=updateEntryProduct;
$('entryForm').onsubmit=e=>{e.preventDefault();if($('entrySave').disabled)return;run(async()=>{
 if(viewer||!A.owner(A.auth.currentUser))throw Error('관리자만 입출고 기록을 변경할 수 있습니다.');
 $('entrySave').disabled=true;try{
 const body={day:$('entryDay').value,kind:$('entryKind').value,party:$('entryParty').value,goods_boxes:Number($('entryGoods').value),pallets:Number($('entryPallets').value),hose_boxes:Number($('entryHose').value),note:$('entryNote').value,product:$('entryProduct').value};
 if(editing)body.revision=editing.revision;else body.client_key=entryKey;
 await bridge(editing?'edit':'add',body,editing?.id);resetEntry();
 try{await publishLatest();status('기록 저장 및 정산 반영 완료.');}catch{status('기록은 주문수집 서버에 저장됐습니다. 정산 화면 동기화가 지연되어 자동 재시도합니다.',true);}
 }finally{$('entrySave').disabled=false;}
 });};
$('entries').onclick=e=>run(async()=>{
 const b=e.target.closest('button');if(!b||!data)return;const id=Number(b.dataset.edit||b.dataset.void),entry=allStockEntries().find(x=>x.id===id);if(!entry)return;
 if(b.dataset.edit){editing=entry;$('entryDay').value=entry.day;$('entryKind').value=entry.kind;$('entryParty').value=entry.party;$('entryGoods').value=entry.goods_boxes;$('entryPallets').value=entry.pallets;$('entryHose').value=entry.hose_boxes;$('entryNote').value=entry.note;$('entryProduct').value=entry.product;updateEntryProduct();$('entrySave').textContent='기록 수정';$('entryForm').scrollIntoView({behavior:'smooth'});}
 else{await bridge('void',{revision:entry.revision,voided:!entry.voided},id);await publishLatest();status('기록 상태가 변경됐습니다. 취소 기록은 복원할 수 있습니다.');}
});
$('accountForm').onsubmit=e=>{e.preventDefault();run(async()=>{const b=e.submitter;b.disabled=true;try{
 const username=$('accountName').value.trim();await A.issue(username,$('accountPassword').value,$('accountLabel').value);$('accountPassword').value='';
 $('accountResult').hidden=false;$('accountResult').textContent='계정 발급 완료\n아이디: '+username+'\n조회 주소: '+new URL('./neulbom-view.html',location.href).href+'\n입력한 비밀번호와 주소를 화주에게 전달해 주세요.';await loadAccounts();status('화주 조회 계정이 발급됐습니다.');
 }finally{b.disabled=false;}});};
$('accounts').onclick=e=>run(async()=>{const uid=e.target.closest('button')?.dataset.account;if(!uid||!accountData[uid])return;await A.write('neulbomAccess/'+uid,{...accountData[uid],active:!accountData[uid].active});await loadAccounts();status('조회 계정 사용 상태를 변경했습니다.');});
A.auth.onAuthStateChanged(user=>{clearData();$('loginPanel').hidden=!!user;$('logout').hidden=!user;if(!user){status('로그인해 주세요.');return;}
 if(!viewer&&!A.owner(user)){$('loginPanel').hidden=false;status('관리자 계정이 아닙니다. 로그아웃 후 관리자 아이디로 로그인해 주세요.',true);return;}
 $('accessLabel').textContent=viewer?'화주 조회 전용':'TS3PL 관리자';run(async()=>{await load();await loadAccounts();});
});
$('from').value=C.today().slice(0,7)+'-01';$('to').value=C.today();resetEntry();
setInterval(()=>{if(!document.hidden&&A.auth.currentUser&&(viewer||A.owner(A.auth.currentUser)))run(load);},60000);
