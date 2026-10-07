(() => {
  'use strict';
  window.fetchJinjuForTotal=async()=>{if(!window.JinjuAuth)throw Error('진주불교사 인증 모듈을 불러오지 못했습니다.');await JinjuAuth.ready;if(!JinjuAuth.owner(JinjuAuth.auth.currentUser))throw Error('진주불교사 관리자 로그인 필요');return JinjuAuth.request('jinjubulgyosa');};
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;padding:9px 20px;background:#e5f1e9;color:#235540;font:12px system-ui;';
  const text=document.createElement('span'),link=document.createElement('a');link.href='https://gusco1003-sudo.github.io/jinjubulgyosa/accounts.html';link.textContent='진주불교사 관리자 로그인 · 조회 계정 발급';link.style.cssText='text-decoration:underline;font-weight:700';bar.append(text,link);document.body.prepend(bar);
  let last;
  JinjuAuth.auth.onAuthStateChanged(user=>{const uid=JinjuAuth.owner(user)?user.uid:null;if(last!==undefined&&last!==uid){location.reload();return;}last=uid;text.textContent=uid?'진주불교사 인증됨':'진주불교사 자료는 관리자 로그인 후 집계됩니다.';});
})();
