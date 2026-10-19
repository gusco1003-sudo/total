/* Canonical labels; product IDs and historical inventory documents stay intact. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KoreaProductNames=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const names={classic:'DE)클래식8kg',ultra:'DE)울트라8kg',attract:'DE)어트랙8kg'};
 const ids={'클래식':'classic','울트라':'ultra','어트랙':'attract','어트렉':'attract'};
 function format(value){return String(value??'').replace(/(?:DE\)\s*)?(클래식|울트라|어트랙|어트렉)(?:\s*8\s*kg)?/gi,(_,name)=>names[ids[name]]);}
 return {names,format};
});
