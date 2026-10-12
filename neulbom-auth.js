(function(){'use strict';
const config={apiKey:'AIzaSyBvjM1aD-bmGTsG86-9_2H_HtQNwXdmpvw',authDomain:'ts3pl-982ef.firebaseapp.com',projectId:'ts3pl-982ef',appId:'1:863439274504:web:ea99901657e04c8d5a07bd'};
const app=firebase.apps.find(a=>a.name==='neulbom')||firebase.initializeApp(config,'neulbom'),auth=app.auth();
const ready=new Promise(resolve=>{const off=auth.onAuthStateChanged(()=>{off();resolve();});});
const owner=u=>!!u&&u.email==='gusco1003@gmail.com'&&u.emailVerified&&u.providerData.some(p=>p.providerId==='google.com');
async function request(path,options={}){
 await ready;const user=auth.currentUser;if(!user)throw Error('늘봄 관리자 로그인이 필요합니다.');
 const token=await user.getIdToken();
 const r=await fetch('https://ts3pl-982ef-default-rtdb.firebaseio.com/'+path+'.json?auth='+encodeURIComponent(token),{cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'늘봄 조회 권한을 확인하세요. 관리자에게 계정 승인을 요청하세요.':'정산 서버 연결 실패 ('+r.status+')');
 return r;
}
async function read(path){return (await request(path)).json();}
async function write(path,value){if(!owner(auth.currentUser))throw Error('관리자만 변경할 수 있습니다.');return (await request(path,{method:'PUT',body:JSON.stringify(value)})).json();}
async function loginOwner(){const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});const result=await auth.signInWithPopup(p);if(!owner(result.user)){await auth.signOut();throw Error('등록된 TS3PL 관리자 Google 계정을 선택하세요.');}}
function email(username){if(!/^[a-z0-9][a-z0-9_-]{3,31}$/.test(username))throw Error('아이디는 영문 소문자·숫자·_·- 4~32자로 입력하세요.');return username+'@neulbom.ts3pl.invalid';}
async function issue(username,password,label){
 if(!owner(auth.currentUser))throw Error('관리자 로그인이 필요합니다.');
 if(password.length<12)throw Error('비밀번호는 12자 이상 입력하세요.');
 const address=email(username),secondary=firebase.initializeApp(config,'neulbom-issue-'+crypto.randomUUID());let user;
 try{
  await secondary.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
  user=(await secondary.auth().createUserWithEmailAndPassword(address,password)).user;
  await write('neulbomAccess/'+user.uid,{username,label:label.trim().slice(0,60)||'늘봄 화주',active:true,createdAt:Date.now()});
  return user.uid;
 }catch(e){if(user){try{await user.delete();}catch{throw Error('계정 승인에 실패했습니다. 조회 권한은 부여되지 않았습니다. Firebase 사용자 목록에서 발급 상태를 확인하세요.');}}throw e;}
 finally{await secondary.delete();}
}
window.NeulbomAuth={auth,ready,owner,request,read,write,loginOwner,issue,email};
})();
