// 에프씨머티리얼 전용 페이지와 동일한 정산 자료를 읽습니다.
if(!CLIENTS.some(c=>c.key==='fcmaterial')) CLIENTS.unshift({
 key:'fcmaterial', name:'에프씨머티리얼', emoji:'🏭', accent:'#38bdf8', accentRgb:'56,189,248',
 schema:'settlement', path:'fcmaterial',
 defaults:{unloadFee:5000,storageFee:800,vatRate:0.1},
 desc:'하차·상차 5,000원/PLT · 보관 800원/PLT·일', link:'./fc-material.html'
});
    async function loadData(showLoader) {
      if (showLoader) {
        document.getElementById('loader').classList.remove('hidden');
        document.getElementById('loader').classList.add('flex');
      }

      const noCache = '?t=' + Date.now();
      const results = await Promise.allSettled(
        CLIENTS.map(c => fetch(c.dataUrl ? `${c.dataUrl}${noCache}` : `${FIREBASE_BASE}/${c.path}.json${noCache}`, {signal:AbortSignal.timeout(15000)}))
      );

      for (let i = 0; i < CLIENTS.length; i++) {
        const c = CLIENTS[i];
        const r = results[i];
        let json = null, err = null;

        if (r.status !== 'fulfilled') {
          err = r.reason && r.reason.message ? r.reason.message : '네트워크 오류';
        } else if (!r.value.ok) {
          err = 'HTTP ' + r.value.status;
        } else {
          try { json = await r.value.json(); }
          catch (e) { err = '응답 해석 실패'; }
          // Firebase 권한 오류는 200에 {error:"..."} 형태로 오기도 한다.
          if (json && typeof json === 'object' && json.error) { err = String(json.error); json = null; }
        }

        if (!err && c.schema === 'dailyLedger') {
          try { json = NewHansol.normalize(json); }
          catch (e) { err = e.message; json = null; }
        }
        if (!err && c.schema === 'providence') {
          try {
            if (!json) throw new Error('개별 정산프로그램에서 서버 연결을 먼저 완료해 주세요.');
            if (json.entries === undefined) json.entries = [];
            Providence.validateData(json);
            if (json.vat !== 'exclusive') throw new Error('부가세 별도 10% 자료를 확인해 주세요.');
          } catch (e) { err = e.message; json = null; }
        }
        syncErr[c.key] = err;
        store[c.key] = (json && typeof json === 'object') ? json : {};

        if (c.schema === 'wms') patchDailyPlt(store[c.key], c.pltMode === 'pcs');
      }

      calcCache = {};

      if (showLoader) {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('loader').classList.remove('flex');
      }
    }

