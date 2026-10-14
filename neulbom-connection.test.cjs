const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./neulbom-core.js');
function harness(){
 const nodes=new Map(),calls=[],writes=[],state={fail:false,denied:false};
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,files:[],dataset:{},classList:{toggle(){}},addEventListener(){},replaceChildren(){},reset(){}});return nodes.get(id);};
 const user={uid:'owner',getIdToken:async()=> 'owner-token'},A={auth:{currentUser:user,onAuthStateChanged(){}},owner:u=>u?.uid==='owner',write:async(p,b)=>writes.push({p,b}),read:async()=>null};
 const fetch=async(url,opts)=>{calls.push({url,opts});assert.equal(opts.credentials,'omit');assert.equal(opts.headers.Authorization,'Bearer owner-token');if(opts.method==='GET')assert.equal(opts.body,undefined,'GET must omit request body');if(state.fail)throw new TypeError('Failed to fetch');if(state.denied)return {ok:false,status:403,json:async()=>({detail:'관리자만 사용할 수 있습니다.'})};const path=new URL(url).pathname;return {ok:true,status:200,json:async()=>path.endsWith('/prepare')?{uid:'sync-worker'}:path.endsWith('/enable')?{enabled:true}:{app:'neulbom-wms',cloud:{enabled:true,last_success:'2026-10-14T17:00:00+09:00',error:''}}};};
 const context=vm.createContext({NeulbomAuth:A,Neulbom:C,document:{body:{dataset:{mode:'admin'}},getElementById:el,querySelectorAll:()=>[]},window:{open:()=>{throw Error('Connection must not open a popup');},addEventListener(){}},crypto:require('node:crypto'),location:{origin:'https://gusco1003-sudo.github.io'},URL,Intl,Date,AbortSignal,fetch,TypeError,setTimeout,clearTimeout,setInterval(){}});
 vm.runInContext(fs.readFileSync('neulbom-page.js','utf8'),context);
 // Server verification must not reload or reset in-progress stock-entry fields.
 vm.runInContext('load=async()=>{}',context);el('entryParty').value='작성 중';
 return {el,calls,writes,state,context,A};
}
test('connection checks and sync activation complete without popup and preserve entry inputs',async()=>{
 const h=harness();await h.el('connect').onclick();assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.endsWith('/connection'));assert.match(h.el('connectionResult').textContent,/서버 연결 정상/);assert.match(h.el('connectionResult').textContent,/자동 정산 연결됨/);assert.equal(h.el('entryParty').value,'작성 중');assert.equal(h.writes.length,0);
 await h.el('activateSync').onclick();assert.deepEqual(h.calls.slice(1).map(c=>new URL(c.url).pathname.split('/').slice(-2).join('/')),['cloud/prepare','cloud/enable','manual/connection']);assert.equal(h.writes[0].p,'neulbomSync');assert.equal(h.writes[0].b.uid,'sync-worker');assert.equal(h.el('connect').disabled,false);
});
test('network failures and expired permissions are shown next to the button and controls recover',async()=>{
 const h=harness();h.state.fail=true;await h.el('connect').onclick();assert.match(h.el('connectionResult').textContent,/서버 PC가 켜져/);assert.equal(h.el('connect').disabled,false);h.state.fail=false;h.state.denied=true;await h.el('connect').onclick();assert.match(h.el('connectionResult').textContent,/관리자만/);assert.equal(h.writes.length,0);assert.equal(h.el('activateSync').disabled,false);
 h.A.auth.currentUser=null;const before=h.calls.length;await h.el('connect').onclick();assert.equal(h.calls.length,before);assert.match(h.el('connectionResult').textContent,/관리자 로그인/);
});
