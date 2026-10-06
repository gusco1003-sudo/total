(function(){
 'use strict';
 const text=id=>document.getElementById(id)?.textContent.trim()||'';
 function snapshot(){
  const fc=!!document.getElementById('invoiceCard');
  if(fc)renderSettlement();else if(typeof render==='function')render();
  const root=document.getElementById(fc?'invoiceCard':'tab-statement');
  return {name:fc?text('invoiceShipper'):root.querySelector('p b').textContent.trim(),
   period:text(fc?'invoicePeriod':'statementPeriod').replace(/^기간:\s*/,''),
   supplier:fc?document.getElementById('supplierBlock').innerText.trim():'(주)태성 - TS3PL',
   rows:[...document.getElementById(fc?'invoiceBody':'statementRows').rows].filter(r=>r.cells.length===3).map(r=>[...r.cells].map(c=>c.textContent.trim())),
   totals:[text(fc?'invoiceSubtotal':'invoiceSupply'),text('invoiceVat'),text('invoiceTotal')]};
 }
 function wrap(ctx,value,width){
  const lines=[];let line='';for(const char of String(value)){if(char==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line);return lines;
 }
 function renderPages(data){
  const pages=[],W=794,H=1123,M=48,bottom=1055;let canvas,ctx,y,page;
  const font=(size=12,bold=false)=>{ctx.font=`${bold?'bold ':''}${size}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;ctx.textBaseline='top';};
  function line(y){ctx.strokeStyle='#d8dfe3';ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();}
  function start(){canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0d7377';font(11,true);ctx.fillText('TS3PL · SETTLEMENT STATEMENT',M,43);font(25,true);ctx.fillStyle='#1b2430';ctx.fillText('보관·물류비 정산서',M,69);font(12);ctx.fillText(data.period,M,108);ctx.fillText('화주: '+data.name,M,135);y=158;for(const s of wrap(ctx,'공급자: '+data.supplier,W-2*M)){ctx.fillText(s,M,y);y+=17;}y+=19;page={canvas};pages.push(page);header();}
  function header(){ctx.fillStyle='#eef5f5';ctx.fillRect(M,y,W-2*M,31);ctx.fillStyle='#33454c';font(12,true);ctx.fillText('항목',M+9,y+9);ctx.fillText('산출 내역',M+219,y+9);ctx.textAlign='right';ctx.fillText('금액',W-M-9,y+9);ctx.textAlign='left';y+=31;}
  start();
  for(const [rowIndex,row] of data.rows.entries()){font();const cols=[wrap(ctx,row[0],192),wrap(ctx,row[1],331),wrap(ctx,row[2],121)];let at=0;const count=Math.max(...cols.map(c=>c.length));if(rowIndex===data.rows.length-1 && y+count*18+156>bottom && count*18+156<700)start();while(at<count){if(y+34>bottom)start();const take=Math.min(count-at,Math.floor((bottom-y-16)/18));const height=take*18+16;ctx.fillStyle='#1b2430';font();for(let i=0;i<take;i++){ctx.fillText(cols[0][at+i]||'',M+9,y+8+i*18);ctx.fillText(cols[1][at+i]||'',M+219,y+8+i*18);ctx.textAlign='right';ctx.fillText(cols[2][at+i]||'',W-M-9,y+8+i*18);ctx.textAlign='left';}y+=height;line(y);at+=take;if(at<count)start();}}
  if(y+140>bottom)start();y+=24;
  ['공급가액','부가세 10%','합계 청구금액'].forEach((label,i)=>{font(i===2?16:13,i===2);ctx.fillStyle=i===2?'#0d7377':'#1b2430';ctx.fillText(label,430,y);ctx.textAlign='right';ctx.fillText(data.totals[i],W-M-9,y);ctx.textAlign='left';y+=34;});
  pages.forEach((p,i)=>{const c=p.canvas.getContext('2d');c.font='11px "Malgun Gothic", sans-serif';c.fillStyle='#65717b';c.textAlign='center';c.fillText(`${i+1} / ${pages.length}`,W/2,H-28);});
  return pages.map(p=>({bytes:Uint8Array.from(atob(p.canvas.toDataURL('image/jpeg',.94).split(',')[1]),c=>c.charCodeAt(0)),width:W*2,height:H*2}));
 }
 function pdf(images){
  const enc=new TextEncoder(),chunks=[],offsets=[0];let length=0;
  const add=v=>{const b=typeof v==='string'?enc.encode(v):v;chunks.push(b);length+=b.length;};
  const object=(id,body,bytes)=>{offsets[id]=length;add(id+' 0 obj\n'+body);if(bytes){add('\nstream\n');add(bytes);add('\nendstream');}add('\nendobj\n');};
  add('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>(3+i*3)+' 0 R').join(' ')}] >>`);
  images.forEach((img,i)=>{const n=3+i*3;object(n,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`);object(n+1,`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`,img.bytes);const content=enc.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im Do\nQ');object(n+2,`<< /Length ${content.length} >>`,content);});
  const xref=length;add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const o of offsets.slice(1))add(String(o).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(chunks,{type:'application/pdf'});
 }
 async function download(button){
  const old=button.textContent;button.disabled=true;button.textContent='PDF 생성 중…';
  try{await document.fonts.ready;const data=snapshot();if(!data.period.includes('202')||data.totals.some(v=>!v||v==='-'))throw Error('정산 기간과 계산 금액을 먼저 확인해 주세요.');const blob=pdf(renderPages(data)),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(data.name+'_'+data.period+'_정산서.pdf').replace(/[\\/:*?"<>|]/g,'-');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){alert('PDF 생성 실패: '+e.message);}finally{button.disabled=false;button.textContent=old;}
 }
 window.StatementPDF={async downloadBatch(statements,filename){
  if(!statements.length)throw Error('발급할 정산서가 없습니다.');
  await document.fonts.ready;
  const images=[];
  for(const data of statements){images.push(...renderPages(data));await new Promise(resolve=>setTimeout(resolve,0));}
  const url=URL.createObjectURL(pdf(images)),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return {statements:statements.length,pages:images.length};
 }};
 document.querySelectorAll('[data-download-statement]').forEach(button=>button.addEventListener('click',()=>download(button)));
})();
