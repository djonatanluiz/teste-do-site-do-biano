const ScannerBlocos=(()=>{
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const geo=(a,b)=>{if([a.lat,a.lng,b.lat,b.lng].some(x=>x===null||x===undefined||!Number.isFinite(Number(x))))return Infinity;return Math.hypot((a.lat-b.lat)*111320,(a.lng-b.lng)*111320*Math.cos((+a.lat + +b.lat)*Math.PI/360));};
function name(g){let s=norm(g.bairro),city=norm(g.cidade);if(city&&s.startsWith(city+' '))s=s.slice(city.length+1);return s.replace(/\b(de|da|do|das|dos)\b/g,' ').replace(/\s+/g,' ').trim();}
function editOne(a,b){if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return n+(i<a.length||j<b.length?1:0)<=1;}
function similar(a,b){if(!a||!b)return false;if(a===b)return true;const x=a.split(' '),y=b.split(' ');return (Math.min(a.length,b.length)>=8&&editOne(a,b))||(x.length!==y.length&&Math.min(x.length,y.length)===1&&Math.max(x.length,y.length)===2&&Math.min(a.length,b.length)>=6&&(x.includes(b)||y.includes(a)));}
function groups(stops,m){
 const ids=stops.map((_,i)=>i+1),road=(i,j)=>Math.min(m.distancias[i]?.[j]??Infinity,m.distancias[j]?.[i]??Infinity);
 const manual=i=>norm(stops[i-1].v11?.region),city=i=>norm(stops[i-1].cidade);
 const compatible=(a,b)=>a.every(i=>b.every(j=>(!city(i)||!city(j)||city(i)===city(j))&&manual(i)===manual(j)));
 const micro=ids.map(i=>({members:[i]})),edges=[];
 for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const i=ids[a],j=ids[b],g=geo(stops[i-1],stops[j-1]),d=road(i,j);if(g<=420&&d<=Math.max(100,g*2.5)&&d<=800)edges.push([i,j,d]);}
 edges.sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]);
 for(const [i,j]of edges){const a=micro.find(b=>b.members.includes(i)),b=micro.find(b=>b.members.includes(j));if(a===b||a.members.length+b.members.length>8||!compatible(a.members,b.members))continue;
   if(!a.members.every(x=>b.members.every(y=>geo(stops[x-1],stops[y-1])<=420&&road(x,y)<=850)))continue;a.members.push(...b.members);micro.splice(micro.indexOf(b),1);
 }
 // Voto por imóvel/coordenada: pacotes duplicados não pesam como vários bairros.
 for(const u of micro){u.positions=Object.fromEntries(u.members.map(i=>[i,stops[i-1]]));const votes=new Map(),seen=new Set();for(const i of u.members){const g=stops[i-1],key=String(g.lat)+'|'+g.lng;if(seen.has(key))continue;seen.add(key);const n=name(g);if(n)votes.set(n,(votes.get(n)||0)+1);}u.region=[...votes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'';u.manual=manual(u.members[0]);}
 const macro=micro.map(u=>({members:u.members.slice(),microblocks:[u],region:u.region,manual:u.manual}));
 // Regiões manuais são explícitas. Bairros importados só se unem com ligação local.
 for(let pass=0;pass<2;pass++)for(let a=0;a<macro.length;a++)for(let b=a+1;b<macro.length;b++){
   const x=macro[a],y=macro[b];if(!compatible(x.members,y.members))continue;
   const named=x.manual&&x.manual===y.manual;
   if(!named&&!(similar(x.region,y.region)||!x.region||!y.region))continue;
   const near=Math.min(...x.members.flatMap(i=>y.members.map(j=>road(i,j))));
   if(!named&&(near>1400||!x.members.every(i=>y.members.every(j=>geo(stops[i-1],stops[j-1])<=2500))))continue;
   x.members.push(...y.members);x.microblocks.push(...y.microblocks);if(!x.region)x.region=y.region;macro.splice(b--,1);
 }
 return macro.map((b,id)=>({...b,id,label:b.manual?stops[b.members[0]-1].v11.region:b.region||'Região '+(id+1),explicit:!!b.manual,deferred:b.members.some(i=>stops[i-1].v11?.deferred)}));
}
// Held–Karp por bloco pequeno. Guarda o melhor percurso para cada entrada/saída,
// sem presumir que números de imóvel ou distâncias em linha reta sejam vias.
function paths(unit,m,forced,options={}){
 const ids=unit.members,n=ids.length;if(n===1)return [ids.slice()];
 const cost=(i,j)=>{const t=m.duracoes[i]?.[j],d=m.distancias[i]?.[j];return Number.isFinite(t)&&Number.isFinite(d)?t>=0&&d>=0?t+(options.distanceWeight??.2)*d:Infinity:Infinity;},all=[];
 for(let start=0;start<n;start++){if(forced&&ids[start]!==forced)continue;
   const size=1<<n,dp=Array.from({length:size},()=>Array(n).fill(Infinity)),prev=Array.from({length:size},()=>Array(n).fill(-1));dp[1<<start][start]=0;
   for(let mask=1;mask<size;mask++)for(let j=0;j<n;j++)if(Number.isFinite(dp[mask][j]))for(let k=0;k<n;k++)if(!(mask&(1<<k))){const next=mask|(1<<k),c=dp[mask][j]+cost(ids[j],ids[k]);if(c<dp[next][k]){dp[next][k]=c;prev[next][k]=j;}}
   for(let end=0;end<n;end++){if(!Number.isFinite(dp[size-1][end]))continue;let mask=size-1,j=end,p=[];while(j>=0){p.push(ids[j]);const k=prev[mask][j];mask^=1<<j;j=k;}all.push({path:p.reverse(),cost:dp[size-1][end]});}
 }
 // Revisão local: conserva cada par de entrada/saída, sem poda prematura.
 if(options.allEndpoints)return all.map(c=>c.path);
 // Todas as entradas e saídas aparecem, com limite para o nível de região.
 all.sort((a,b)=>a.cost-b.cost);const out=[],seen=new Set();for(const side of [0,-1]){const ends=new Set();for(const c of all){const e=c.path.at(side);if(ends.has(e))continue;ends.add(e);const k=c.path.join(',');if(!seen.has(k)){seen.add(k);out.push(c.path);}}}
 return out.length?out:[ids.slice()];
}
return {groups,paths,geo};
})();

/* V14: entrega contígua por região e por trecho de rua.
   Custos dirigidos da malha viária. Não estima combustível em litros.
   ScannerRegioes.groups mantém a identificação/migração de regiões da V12. */
const ScannerRuas=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
function street(g){
  let s=norm(g.logradouro||g.rua||g.endereco);
  // Só remove número de imóvel delimitado: preserva Rua 7 de Setembro/Rua 20.
  s=s.split(/[,;]|\s+(?:n[º°.]?|numero)\s*\d/)[0].trim();
  s=s.replace(/^r[.]?\s+/,'rua ').replace(/^av[.]?\s+/,'avenida ').replace(/^rod[.]?\s+/,'rodovia ');
  return s && /[a-z]/.test(s)?s:'';
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]??0,y=b[i]??0;if(x===y||Math.abs(x-y)<1e-7)continue;return x<y?-1:1;}return 0;}
function corridors(block){return block.microblocks;}
function unitPaths(unit,m,forced){return ScannerBlocos.paths(unit,m,forced);}
async function solve(indices,m,stops,next,startAt,evaluate,options={}){
  if(!indices.length)return {order:[],blocks:[],metrics:evaluate([],m,stops,startAt),diagnostics:{version:14}};
  if(indices.length!==stops.length||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<1||i>stops.length))throw Error('Lista de paradas inconsistente.');
  const started=performance.now(),weight=options.distanceWeight??0.2;
  const limit=options.maxMs??6500,workLimit=options.maxCandidates??5000;
  let work=0,lastYield=started,limited=false;
  async function tick(){work++;if(performance.now()-lastYield>18){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}}
  const expired=()=>{const x=work>=workLimit||performance.now()-started>limit;if(x)limited=true;return x;};
  const edge=(i,j)=>{const t=m.duracoes[i]?.[j],d=m.distancias[i]?.[j];return Number.isFinite(t)&&t>=0&&Number.isFinite(d)&&d>=0?t+weight*d:Infinity;};
  const score=e=>Number.isFinite(e.duration)?[...e.score.slice(0,4),e.duration+weight*(e.distance||0)+weight*(e.entryRegret||0),e.distance||0]:[Infinity];
  const blocks=ScannerBlocos.groups(stops,m),forced=indices.find(i=>stops[i-1].id===next);
  const first=blocks.find(b=>b.members.includes(forced)),tail=Number.isInteger(m.indiceDestinoFinalV9)?m.indiceDestinoFinalV9:null;
  const windows=stops.some(g=>g.v11?.priority||Number.isFinite(g.v11?.startMin)||Number.isFinite(g.janelaHardMin)||Number.isFinite(g.janelaSoftInicioMin)||Number.isFinite(g.janelaSoftFimMin));
  const byPoint=new Map(blocks.flatMap(b=>b.microblocks.flatMap(u=>u.members.map(i=>[i,u]))));
  function regret(from,to){
    if(from===null||byPoint.get(from)===byPoint.get(to)||(from===0&&to===forced))return 0;
    const unit=byPoint.get(to);if(!unit)return 0;
    const chosen=m.distancias[from]?.[to],nearest=Math.min(...unit.members.map(i=>m.distancias[from]?.[i]??Infinity));
    return Number.isFinite(chosen)&&Number.isFinite(nearest)?Math.min(600,Math.max(0,chosen-nearest)):0;
  }
  const evaluateBase=evaluate;evaluate=(p,...args)=>{const e=evaluateBase(p,...args);e.entryRegret=p.reduce((s,i,k)=>s+regret(k?p[k-1]:0,i),0);return e;};
  function describe(path){let cost=0;for(let k=1;k<path.length;k++)cost+=edge(path[k-1],path[k])+weight*regret(path[k-1],path[k]);return {path,from:path[0],to:path.at(-1),cost};}
  // Programação dinâmica escolhe conjuntamente a orientação de todos os trechos
  // para uma sequência fixa; inclui a chegada e a saída, não apenas a entrada.
  function orient(sequence,variants,start=0,end=tail){
    let states=[{cost:0,to:start,prev:null,v:null}];
    for(const id of sequence){const newer=[];for(const v of variants.get(id)){let best=null;
      for(const s of states){const cost=s.cost+(s.to===null?0:edge(s.to,v.from)+weight*regret(s.to,v.from))+v.cost;if(!best||cost<best.cost)best={cost,to:v.to,prev:s,v};}newer.push(best);
    }states=newer;}
    let best=null;for(const s of states){const cost=s.cost+(end===null?0:edge(s.to,end));if(!best||cost<best.total)best={...s,total:cost};}
    const segments=[];for(let s=best;s?.v;s=s.prev)segments.push(s.v.path);return {path:segments.reverse().flat(),cost:best?.total??0};
  }
  function canonical(seq,items,fixed){return seq.filter(i=>i===fixed).concat(seq.filter(i=>i!==fixed&&!items[i].deferred),seq.filter(i=>i!==fixed&&items[i].deferred));}
  function seedsFor(items,variants,fixed,start,end){
    const ids=items.map((_,i)=>i),out=[],seen=new Set();
    const add=s=>{s=canonical(s,items,fixed);const k=s.join(',');if(!seen.has(k)){seen.add(k);out.push(s);}};
    add(ids);add(ids.slice().reverse());
    const between=(a,b)=>Math.min(...variants.get(a).flatMap(x=>variants.get(b).map(y=>edge(x.to,y.from))));
    const sorted=ids.slice().sort((a,b)=>Math.min(...variants.get(a).map(v=>edge(start,v.from)))-Math.min(...variants.get(b).map(v=>edge(start,v.from)))||a-b);
    const starts=fixed!==undefined?[fixed]:[...new Set([...sorted.slice(0,4),...ids.filter((_,k)=>k%Math.max(1,Math.ceil(ids.length/6))===0),...(end===null?[]:[ids.slice().sort((a,b)=>Math.min(...variants.get(a).map(v=>edge(v.to,end)))-Math.min(...variants.get(b).map(v=>edge(v.to,end))))[0]])])];
    for(const first of starts){const s=[first],left=new Set(ids.filter(i=>i!==first));while(left.size){const j=[...left].sort((a,b)=>between(s.at(-1),a)-between(s.at(-1),b)||a-b)[0];s.push(j);left.delete(j);}add(s);add(s.slice().reverse());}
    return out;
  }
  const variants=new Map(),allUnits=[];
  for(const b of blocks){
    const units=corridors(b,stops,m);allUnits.push(...units);
    const fixed=units.findIndex(u=>u.members.includes(forced));
    const uv=new Map(units.map((u,k)=>[k,unitPaths(u,m,fixed===k?forced:null).map(describe)]));
    if(units.length===1){variants.set(b.id,uv.get(0));await tick();continue;}
    const sequences=seedsFor(units,uv,fixed<0?undefined:fixed,0,tail);
    const candidates=[],seen=new Set();
    function add(seq){
      // Conservar variantes com entradas/saídas diferentes é essencial para
      // conectar bairros. Custo externo será decidido no nível seguinte.
      const p=orient(seq,uv,null,null).path,key=p.join(',');
      if(!seen.has(key)){seen.add(key);candidates.push(describe(p));}
      const withOrigin=orient(seq,uv,0,tail).path,k=withOrigin.join(',');if(!seen.has(k)){seen.add(k);candidates.push(describe(withOrigin));}
      for(const endId of [seq[0],seq.at(-1)])for(const v of uv.get(endId)){
        const locked=new Map(uv);locked.set(endId,[v]);const path=orient(seq,locked,null,null).path,key=path.join(',');if(!seen.has(key)){seen.add(key);candidates.push(describe(path));}
      }
    }
    for(const seq of sequences){add(seq);await tick();}
    // Relocação e reversão de ruas inteiras. Nunca intercala entregas A/B/A.
    let bestSeq=sequences.reduce((a,s)=>orient(s,uv,0,tail).cost<orient(a,uv,0,tail).cost?s:a,sequences[0]);
    let bestCost=orient(bestSeq,uv,0,tail).cost;
    for(let round=0;round<2&&!expired();round++){let improved=false;
      for(let i=0;i<units.length&&!expired();i++)for(let j=i+1;j<units.length&&!expired();j++)for(const kind of [0,1]){
        const s=bestSeq.slice();if(kind===0)s.splice(j,0,s.splice(i,1)[0]);else s.splice(i,j-i+1,...s.slice(i,j+1).reverse());
        if(fixed>=0&&s[0]!==fixed)continue;const cost=orient(s,uv,0,tail).cost;
        if(cost<bestCost-1e-7){bestSeq=s;bestCost=cost;improved=true;add(s);}await tick();
      }
      if(!improved)break;
    }
    // Retém entradas/saídas, depois as melhores variantes internas (máximo 24).
    const sorted=candidates.sort((a,b)=>a.cost-b.cost),kept=[],ends=new Set();
    for(const c of sorted){const k=c.from+':'+c.to;if(!ends.has(k)){ends.add(k);kept.push(c);}if(kept.length>=20)break;}
    for(const c of sorted){if(!kept.includes(c))kept.push(c);if(kept.length>=24)break;}
    variants.set(b.id,kept);await tick();
  }
  function expand(sequence){
    const plain=orient(sequence,variants).path;
    let result={order:plain,metrics:evaluate(plain,m,stops,startAt),sequence};
    if(windows){
      // Busca limitada com horário real de chegada/espera; nenhuma janela é apagada.
      const partialMatrix={...m,indiceDestinoFinalV9:null};let beam=[{path:[],rank:[0]}];
      for(let k=0;k<sequence.length;k++){
        const list=[];for(const s of beam)for(const v of variants.get(sequence[k])){const path=s.path.concat(v.path);const e=evaluate(path,k===sequence.length-1?m:partialMatrix,stops,startAt);list.push({path,rank:score(e)});}
        list.sort((a,b)=>compare(a.rank,b.rank));beam=list.slice(0,8);
      }
      for(const s of beam){const e=evaluate(s.path,m,stops,startAt);if(compare(score(e),score(result.metrics))<0)result={order:s.path,metrics:e,sequence};}
    }
    return result;
  }
  const sequences=seedsFor(blocks,variants,first?.id,0,tail);let best=null;
  for(const seq of sequences){const c=expand(seq);if(!best||compare(score(c.metrics),score(best.metrics))<0)best=c;await tick();}
  for(let round=0;round<3&&!expired();round++){let improved=false;
    for(let i=0;i<blocks.length&&!expired();i++)for(let j=0;j<blocks.length&&!expired();j++){
      if(i===j)continue;
      for(const kind of [0,1]){if(kind===1&&i>j)continue;const s=best.sequence.slice();
        if(kind===0)s.splice(j,0,s.splice(i,1)[0]);else s.splice(i,j-i+1,...s.slice(i,j+1).reverse());
        const valid=canonical(s,blocks,first?.id);if(valid.some((v,k)=>v!==s[k]))continue;
        const c=expand(s);if(compare(score(c.metrics),score(best.metrics))<0){best=c;improved=true;}await tick();
      }
    }if(!improved)break;
  }
  // V14.13: revisão de microblocos com fronteiras reais da rota já escolhida.
  // Cada alternativa usa custos dirigidos da matriz viária, inclusive chegada
  // e saída. Não ordena por projeção GPS, número da casa ou rótulo da parada.
  const microBefore=best.metrics.duration+weight*(best.metrics.distance||0)+weight*(best.metrics.entryRegret||0);
  let microChanges=0,microCandidates=0,microLimited=false;
  const microDeadline=performance.now()+Math.max(0,options.microMaxMs??1200);
  const microLimit=Math.max(0,options.microMaxCandidates??3000),microCache=new Map();
  const microExpired=()=>{const stop=microCandidates>=microLimit||performance.now()>=microDeadline;if(stop)microLimited=true;return stop;};
  for(let pass=0;pass<2&&!microExpired();pass++){
    let changed=false;
    for(const unit of allUnits){
      if(microExpired())break;
      if(unit.members.length<2||unit.members.length>8)continue;
      const positions=unit.members.map(i=>best.order.indexOf(i)).sort((a,b)=>a-b),offset=positions[0];
      if(offset<0||positions.at(-1)-offset+1!==unit.members.length)continue;
      if(!microCache.has(unit))microCache.set(unit,ScannerBlocos.paths(unit,m,unit.members.includes(forced)?forced:null,{allEndpoints:true,distanceWeight:weight}));
      for(const path of microCache.get(unit)){
        if(microExpired())break;
        const order=best.order.slice();order.splice(offset,path.length,...path);
        if(forced&&order[0]!==forced)continue;
        if(order.every((i,k)=>i===best.order[k]))continue;
        // Uma aresta ausente nunca vira distância em linha reta.
        const walk=[0,...order,...(tail===null?[]:[tail])];
        if(walk.some((i,k)=>k&& !Number.isFinite(edge(walk[k-1],i))))continue;
        const metrics=evaluate(order,m,stops,startAt),oldScore=score(best.metrics),newScore=score(metrics);
        microCandidates++;
        // Exige melhora estrita no custo global E nenhuma piora em qualquer
        // restrição anterior (horários, prioridades etc.), nem troca em empate.
        if(Number.isFinite(newScore[4])&&newScore.slice(0,4).every((v,k)=>v<=oldScore[k]+1e-7)&&newScore[4]<oldScore[4]-1e-7){
          best={...best,order,metrics};microChanges++;changed=true;
        }
        await tick();
      }
    }
    if(!changed)break;
  }
  const microAfter=best.metrics.duration+weight*(best.metrics.distance||0)+weight*(best.metrics.entryRegret||0);
  if(best.order.length!==indices.length||new Set(best.order).size!==indices.length||best.order.some(i=>!indices.includes(i)))throw Error('Não foi possível preservar todas as paradas.');
  if(!Number.isFinite(best.metrics.duration))throw Error('Não encontrei uma sequência pelas ruas que conclua cada bloco. Confira os acessos e as regiões.');
  return {...best,blocks:best.sequence.map(i=>blocks[i]),diagnostics:{version:14,microRevision:"14.13",microChanges,microCandidates,microLimited,microBefore,microAfter,regions:blocks.length,streets:allUnits.length,candidates:work,limited,elapsedMs:Math.round(performance.now()-started),distanceWeight:weight}};
}
return {solve,street,corridors,unitPaths};
})();
ScannerRegioes.solve=ScannerRuas.solve;