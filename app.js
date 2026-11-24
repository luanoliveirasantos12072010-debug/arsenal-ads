/* Arsenal Ads — app de ofertas (Supabase + PWA). Sem bibliotecas externas. */
(function(){
"use strict";

/* ---------- configuração pública (a chave publicável é feita para ficar no navegador;
   quem protege os dados são as regras RLS do banco) ---------- */
const SB_URL="https://alzyyilraqymejdvxmnq.supabase.co";
const SB_KEY="sb_publishable_GYrF500RdmrA_GX-mHpoDA_xpd1Jg24";
const BUCKET="criativos";
const SESSION_KEY="arsenal.sessao.v1";

/* ---------- utilidades seguras: nada de innerHTML ---------- */
const $=s=>document.querySelector(s);
const SVG_NS="http://www.w3.org/2000/svg";
function h(tag,attrs,...kids){
  const el=document.createElement(tag);
  if(attrs)for(const k in attrs){const v=attrs[k];if(v==null||v===false)continue;
    if(k==="class")el.className=v;else if(k==="text")el.textContent=v;else if(k==="style")el.style.cssText=v;
    else if(k.startsWith("on")&&typeof v==="function")el.addEventListener(k.slice(2),v);
    else el.setAttribute(k,v===true?"":String(v));}
  for(const c of kids.flat()){if(c==null||c===false)continue;el.appendChild(typeof c==="string"?document.createTextNode(c):c)}
  return el;
}
const ICONS={plus:"M12 5v14M5 12h14",link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  copy:"M9 9h10v10H9zM5 15V5h10",open:"M14 4h6v6M20 4l-9 9M19 14v5H5V5h5",trash:"M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  down:"M12 4v11M7 10l5 5 5-5M5 20h14",up:"M12 20V9M7 14l5-5 5 5M5 4h14",img:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  x:"M6 6l12 12M18 6 6 18",box:"M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",lock:"M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  back:"M15 6l-6 6 6 6",share:"M12 3v12M8 7l4-4 4 4M5 13v7h14v-7"};
function icon(name){const s=document.createElementNS(SVG_NS,"svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width","18");s.setAttribute("height","18");s.setAttribute("aria-hidden","true");
  const p=document.createElementNS(SVG_NS,"path");p.setAttribute("d",ICONS[name]);p.setAttribute("fill","none");p.setAttribute("stroke","currentColor");p.setAttribute("stroke-width","2");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");s.appendChild(p);return s}
function bolt(){const s=document.createElementNS(SVG_NS,"svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("aria-hidden","true");const p=document.createElementNS(SVG_NS,"path");p.setAttribute("fill","#1a1600");p.setAttribute("d","M13 2 4 14h6l-1 8 9-12h-6z");s.appendChild(p);return s}
function toast(msg,err){const t=h("div",{class:"toast"+(err?" er":""),text:msg});$("#toasts").appendChild(t);setTimeout(()=>t.remove(),err?4500:2600)}
const clip=(s,n)=>String(s==null?"":s).slice(0,n);
const fmtBytes=b=>{b=Number(b)||0;if(b<1024)return b+" B";if(b<1048576)return (b/1024).toFixed(0)+" KB";if(b<1073741824)return (b/1048576).toFixed(1)+" MB";return (b/1073741824).toFixed(2)+" GB"};
const fmtDate=t=>{try{return new Date(t).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}catch(e){return ""}};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE=/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/i;
function safeHttps(raw){let v=String(raw||"").trim();if(!v)return null;if(!/^[a-z][a-z0-9+.-]*:/i.test(v))v="https://"+v;
  try{const u=new URL(v);if(u.protocol!=="https:"||!u.hostname||u.username||u.password)return null;return u.href.slice(0,2000)}catch(e){return null}}
const STATUS_O=[["testando","Testando"],["rodando","Rodando"],["pausada","Pausada"],["encerrada","Encerrada"]];
const STATUS_C=[["novo","Novo"],["testando","Testando"],["vencedor","Vencedor"],["reprovado","Reprovado"]];
const okStatus=(v,list,def)=>list.some(x=>x[0]===v)?v:def;
const TYPES={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
const MAX=50*1024*1024;
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));

/* ---------- cliente Supabase mínimo (REST) ---------- */
let session=null,refreshing=null;
function loadSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");if(s&&s.access_token&&s.refresh_token&&s.user&&UUID_RE.test(s.user.id))session=s}catch(e){session=null}}
function saveSession(s){session=s;try{s?localStorage.setItem(SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(SESSION_KEY)}catch(e){}}
function fromAuth(d){if(!d||!d.access_token||!d.refresh_token||!d.user)return null;
  return{access_token:String(d.access_token),refresh_token:String(d.refresh_token),expires_at:Number(d.expires_at)||Math.floor(Date.now()/1000)+Number(d.expires_in||3600),user:{id:String(d.user.id),email:clip(d.user.email,200)}}}
async function authPost(path,body){
  const r=await fetch(SB_URL+"/auth/v1/"+path,{method:"POST",headers:{"apikey":SB_KEY,"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"omit",cache:"no-store"});
  let d=null;try{d=await r.json()}catch(e){}
  if(!r.ok){const e=new Error((d&&(d.msg||d.error_description||d.message))||"erro");e.status=r.status;e.code=d&&(d.error_code||d.code||d.error);throw e}
  return d;
}
async function token(){
  if(!session)throw Object.assign(new Error("sem sessão"),{status:401});
  if(session.expires_at-60>Date.now()/1000)return session.access_token;
  if(!refreshing)refreshing=authPost("token?grant_type=refresh_token",{refresh_token:session.refresh_token})
    .then(d=>{const s=fromAuth(d);if(!s)throw new Error("sessão");saveSession(s);return s.access_token})
    .catch(e=>{if(e.status===400||e.status===401){saveSession(null);showAuth("Sua sessão expirou. Entre de novo.")}throw e})
    .finally(()=>{refreshing=null});
  return refreshing;
}
async function rest(method,path,body,extra){
  const t=await token();
  const r=await fetch(SB_URL+"/rest/v1/"+path,{method,headers:{"apikey":SB_KEY,"Authorization":"Bearer "+t,"Content-Type":"application/json","Prefer":"return=representation",...(extra||{})},body:body==null?undefined:JSON.stringify(body),credentials:"omit",cache:"no-store"});
  let d=null;const txt=await r.text();try{d=txt?JSON.parse(txt):null}catch(e){}
  if(r.status===401){saveSession(null);showAuth("Sua sessão expirou. Entre de novo.");throw new Error("401")}
  if(!r.ok){const e=new Error("rest");e.status=r.status;e.code=d&&d.code;throw e}
  return d;
}
async function storageUpload(path,file){
  const t=await token();
  const r=await fetch(SB_URL+"/storage/v1/object/"+BUCKET+"/"+path,{method:"POST",headers:{"apikey":SB_KEY,"Authorization":"Bearer "+t,"Content-Type":file.type,"x-upsert":"false","cache-control":"max-age=3600"},body:file,credentials:"omit"});
  if(!r.ok){let d=null;try{d=await r.json()}catch(e){}const e=new Error("upload");e.status=r.status;e.code=d&&(d.error||d.statusCode);e.msg=d&&d.message;throw e}
}
async function storageDelete(paths){
  paths=paths.filter(p=>PATH_RE.test(p));if(!paths.length)return;
  const t=await token();
  const r=await fetch(SB_URL+"/storage/v1/object/"+BUCKET,{method:"DELETE",headers:{"apikey":SB_KEY,"Authorization":"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({prefixes:paths}),credentials:"omit"});
  if(!r.ok)throw new Error("delete");
}
const signed=new Map();
async function signPaths(paths){
  const now=Date.now();const need=[...new Set(paths)].filter(p=>PATH_RE.test(p)&&!(signed.has(p)&&signed.get(p).exp>now+60000));
  for(let i=0;i<need.length;i+=100){const part=need.slice(i,i+100);
    const t=await token();
    const r=await fetch(SB_URL+"/storage/v1/object/sign/"+BUCKET,{method:"POST",headers:{"apikey":SB_KEY,"Authorization":"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600,paths:part}),credentials:"omit"});
    if(!r.ok)continue;let d=[];try{d=await r.json()}catch(e){}
    for(const x of (Array.isArray(d)?d:[])){const su=x&&(x.signedURL||x.signedUrl);if(x&&x.path&&typeof su==="string"&&su.startsWith("/object/sign/")){signed.set(x.path,{url:SB_URL+"/storage/v1"+su,exp:now+3500*1000})}}
  }
}
const urlOf=p=>{const s=signed.get(p);return s&&s.exp>Date.now()?s.url:null};

/* ---------- estado ---------- */
const S={ofertas:[],criativos:[],sel:null,aba:"paginas",ctipo:"todos",busca:"",filtro:"todas",uploads:[],loaded:false};
let notesTimer=null,notesBusy=false;

/* ---------- login ---------- */
function showAuth(msg){
  ["#btnNova","#btnSair","#side","#meter"].forEach(s=>{$(s).hidden=true});
  let modo="entrar";
  const email=h("input",{class:"inp",id:"email",type:"email",autocomplete:"email",inputmode:"email",required:true,maxlength:"200",placeholder:"seu@email.com"});
  const senha=h("input",{class:"inp",id:"senha",type:"password",autocomplete:"current-password",required:true,minlength:"8",maxlength:"72",placeholder:"Sua senha"});
  const err=h("p",{class:"err",role:"alert",text:msg||""});
  const go=h("button",{class:"btn y",type:"submit"},"Entrar");
  const bE=h("button",{type:"button",class:"on"},"Entrar"),bC=h("button",{type:"button"},"Criar conta");
  const setModo=m=>{modo=m;bE.classList.toggle("on",m==="entrar");bC.classList.toggle("on",m==="criar");go.textContent=m==="entrar"?"Entrar":"Criar conta";senha.setAttribute("autocomplete",m==="entrar"?"current-password":"new-password");senha.placeholder=m==="entrar"?"Sua senha":"Crie uma senha (mínimo 8 caracteres)";err.textContent=""};
  bE.addEventListener("click",()=>setModo("entrar"));bC.addEventListener("click",()=>setModo("criar"));
  const form=h("form",{novalidate:true},h("div",{class:"sw2"},bE,bC),h("label",null,"E-mail",email),h("label",null,"Senha",senha),err,go);
  form.addEventListener("submit",async e=>{e.preventDefault();err.className="err";err.textContent="";
    const em=email.value.trim(),pw=senha.value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){err.textContent="Digite um e-mail válido.";return}
    if(pw.length<8){err.textContent="A senha precisa ter pelo menos 8 caracteres.";return}
    go.disabled=true;
    try{
      if(modo==="criar"){const d=await authPost("signup",{email:em,password:pw});const s=fromAuth(d);
        if(s){saveSession(s);senha.value="";return start()}
        err.className="ok";err.textContent="Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.";setModo("entrar")}
      else{const d=await authPost("token?grant_type=password",{email:em,password:pw});const s=fromAuth(d);if(!s)throw new Error("login");saveSession(s);senha.value="";start()}
    }catch(x){const c=String(x.code||"");
      err.textContent=c.includes("invalid_credentials")||x.status===400&&modo==="entrar"?"E-mail ou senha incorretos.":c.includes("email_not_confirmed")?"Confirme seu e-mail pelo link que chegou na sua caixa de entrada.":c.includes("signup_disabled")?"Criação de contas desativada.":c.includes("user_already_exists")?"Esse e-mail já tem conta. Use Entrar.":c.includes("weak_password")?"Senha fraca. Use letras e números.":x.status===429?"Muitas tentativas. Espere alguns minutos.":"Não foi possível entrar. Verifique a internet e tente de novo."}
    finally{go.disabled=false}});
  $("#view").replaceChildren(h("div",{class:"auth"},h("div",{class:"hd"},h("div",{class:"ic"},bolt()),h("h1",{text:"Arsenal Ads"}),h("p",{text:"Suas ofertas, páginas de venda e criativos em um só lugar."})),form,
    h("small",{text:"Entre com o mesmo e-mail e senha no celular e no computador."})));
}
async function sair(){
  try{if(session){const t=session.access_token;await fetch(SB_URL+"/auth/v1/logout",{method:"POST",headers:{"apikey":SB_KEY,"Authorization":"Bearer "+t},credentials:"omit"})}}catch(e){}
  saveSession(null);signed.clear();S.ofertas=[];S.criativos=[];S.sel=null;S.loaded=false;showAuth("");
}

/* ---------- dados ---------- */
async function carregar(){
  try{
    const [o,c]=await Promise.all([rest("GET","ofertas?select=*&order=criado_em.desc&limit=500"),rest("GET","criativos?select=*&order=criado_em.desc&limit=2000")]);
    S.ofertas=(Array.isArray(o)?o:[]).filter(x=>UUID_RE.test(x.id));
    S.criativos=(Array.isArray(c)?c:[]).filter(x=>UUID_RE.test(x.id)&&PATH_RE.test(x.caminho));
    if(S.sel&&!S.ofertas.some(x=>x.id===S.sel))S.sel=null;
    S.loaded=true;
    await signPaths(S.criativos.map(x=>x.caminho));
    render();atualizarUso();
  }catch(e){if(e.message!=="401")toast("Não foi possível carregar. Verifique a internet.",true)}
}
function atualizarUso(){const tot=S.criativos.reduce((n,c)=>n+(Number(c.bytes)||0),0);$("#meter").hidden=false;$("#meterTxt").textContent=fmtBytes(tot)+" de 1 GB"}

/* ---------- render ---------- */
function render(){renderSide();S.sel?renderOferta():renderHome()}
const criativosDe=id=>S.criativos.filter(c=>c.oferta_id===id);
function renderSide(){
  const side=$("#side");const kids=[h("h4",null,"Ofertas",h("span",{class:"mono",text:String(S.ofertas.length)}))];
  kids.push(h("button",{class:"tab"+(S.sel?"":" on"),type:"button",onclick:()=>{S.sel=null;render();scrollTo(0,0)}},icon("box"),h("span",{class:"nm",text:"Todas as ofertas"})));
  for(const o of S.ofertas){const st=okStatus(o.status,STATUS_O,"testando");
    kids.push(h("button",{class:"tab"+(S.sel===o.id?" on":""),type:"button",title:clip(o.nome,80),onclick:()=>abrir(o.id)},h("span",{class:"dot "+st}),h("span",{class:"nm",text:clip(o.nome,80)||"Sem nome"}),h("span",{class:"ct mono",text:String(criativosDe(o.id).length)})))}
  side.replaceChildren(...kids);
}
function abrir(id){S.sel=id;S.aba="paginas";render();scrollTo(0,0)}
function renderHome(){
  const v=$("#view");if(!S.loaded){v.replaceChildren(h("div",{class:"skel"}));return}
  const total=S.ofertas.length,rod=S.ofertas.filter(o=>o.status==="rodando").length,pags=S.ofertas.reduce((n,o)=>n+(Array.isArray(o.paginas)?o.paginas.length:0),0);
  const head=h("div",{class:"hello"},h("div",null,h("h1",{text:"Suas ofertas"}),h("p",{text:"Páginas de venda e criativos de cada oferta, guardados em um só lugar."})));
  if(!total){v.replaceChildren(head,h("div",{class:"empty"},h("div",{class:"ic"},icon("box")),h("h3",{text:"Nenhuma oferta ainda"}),h("p",{text:"Crie sua primeira oferta para guardar as páginas de venda e os criativos que você vai anunciar no Meta Ads."}),h("button",{class:"btn y",type:"button",onclick:novaOferta},icon("plus"),"Criar nova oferta")));return}
  const vids=S.criativos.filter(c=>c.tipo==="video").length;
  const stats=h("div",{class:"stats"},
    h("div",{class:"stat"},h("b",{class:"mono",text:String(total)}),h("span",{text:"ofertas"})),
    h("div",{class:"stat hl"},h("b",{class:"mono",text:String(rod)}),h("span",{text:"rodando"})),
    h("div",{class:"stat"},h("b",{class:"mono",text:vids+" / "+(S.criativos.length-vids)}),h("span",{text:"vídeos / imagens"})),
    h("div",{class:"stat"},h("b",{class:"mono",text:String(pags)}),h("span",{text:"páginas de venda"})));
  const busca=h("input",{class:"inp",id:"busca",type:"search",placeholder:"Buscar oferta…",value:S.busca,maxlength:"80","aria-label":"Buscar oferta"});
  busca.addEventListener("input",()=>{S.busca=busca.value;drawGrid()});
  const filtros=h("div",{class:"filters"},[["todas","Todas"]].concat(STATUS_O).map(([k,l])=>h("button",{class:"chip"+(S.filtro===k?" on":""),type:"button",onclick:()=>{S.filtro=k;renderHome()}},l)));
  v.replaceChildren(head,stats,h("div",{class:"tools"},busca,filtros),h("div",{class:"grid",id:"ogrid"}));drawGrid();
}
function thumb(c){const u=urlOf(c.caminho);const box=h("div");if(!u)return box;
  if(c.tipo==="video")box.appendChild(h("video",{src:u+"#t=0.1",muted:true,playsinline:true,preload:"metadata"}));else box.style.backgroundImage="url(\""+u.replace(/"/g,"%22")+"\")";return box}
function drawGrid(){
  const g=$("#ogrid");if(!g)return;const q=S.busca.trim().toLowerCase();
  const list=S.ofertas.filter(o=>(S.filtro==="todas"||o.status===S.filtro)&&(!q||String(o.nome||"").toLowerCase().includes(q)||String(o.nicho||"").toLowerCase().includes(q)));
  if(!list.length){g.replaceChildren(h("p",{class:"nic",text:"Nenhuma oferta encontrada."}));return}
  g.replaceChildren(...list.map(o=>{const st=okStatus(o.status,STATUS_O,"testando"),cs=criativosDe(o.id);
    const th=h("div",{class:"thumbs"});for(let i=0;i<4;i++)th.appendChild(cs[i]?thumb(cs[i]):h("div"));
    return h("button",{class:"ocard",type:"button",onclick:()=>abrir(o.id)},
      h("div",null,h("span",{class:"pill "+st,text:STATUS_O.find(x=>x[0]===st)[1]})),
      h("div",null,h("h3",{text:clip(o.nome,80)||"Sem nome"}),o.nicho?h("div",{class:"nic",text:clip(o.nicho,120)}):null),th,
      h("div",{class:"ft mono"},h("span",{text:cs.filter(c=>c.tipo==="video").length+" vídeos"}),h("span",{text:cs.filter(c=>c.tipo!=="video").length+" imagens"}),h("span",{text:(Array.isArray(o.paginas)?o.paginas.length:0)+" páginas"})))}));
}
function renderOferta(){
  const o=S.ofertas.find(x=>x.id===S.sel);if(!o){S.sel=null;return renderHome()}
  const v=$("#view");const ae=document.activeElement;
  if(ae&&v.contains(ae)&&ae.dataset&&ae.dataset.keep===o.id){updateCounts(o);if(S.aba==="criativos"&&!ae.classList.contains("nmi"))drawCriativos(o);return}
  const st=okStatus(o.status,STATUS_O,"testando");
  const ttl=h("input",{class:"ttl",id:"ttl",value:clip(o.nome,80),maxlength:"80","aria-label":"Nome da oferta","data-keep":o.id});
  ttl.addEventListener("change",()=>salvarOferta(o.id,{nome:clip(ttl.value.trim(),80)||"Sem nome"}));
  const nic=h("input",{class:"nicho",id:"nicho",value:clip(o.nicho,120),maxlength:"120",placeholder:"Nicho ou produto (opcional)","aria-label":"Nicho","data-keep":o.id});
  nic.addEventListener("change",()=>salvarOferta(o.id,{nicho:clip(nic.value.trim(),120)}));
  const sel=h("select",{class:"sel",id:"ostatus","aria-label":"Status da oferta"},STATUS_O.map(([k,l])=>h("option",{value:k,selected:k===st},l)));
  sel.addEventListener("change",()=>salvarOferta(o.id,{status:okStatus(sel.value,STATUS_O,"testando")}));
  const head=h("div",{class:"ohead"},h("div",{class:"t"},h("button",{class:"btn ghost sm mb10",type:"button",onclick:()=>{S.sel=null;render()}},icon("back"),"Ofertas"),ttl,nic),
    h("div",{class:"oact"},sel,h("button",{class:"btn danger sm",type:"button",onclick:()=>excluirOferta(o)},icon("trash"),"Excluir")));
  const tabs=h("div",{class:"itabs",role:"tablist"},[["paginas","Páginas de venda",(Array.isArray(o.paginas)?o.paginas.length:0)],["criativos","Criativos",criativosDe(o.id).length],["notas","Anotações",null]]
    .map(([k,l,n])=>h("button",{class:"itab"+(S.aba===k?" on":""),type:"button",role:"tab","aria-selected":S.aba===k?"true":"false","data-tab":k,onclick:()=>{S.aba=k;renderOferta()}},l,n==null?null:h("span",{class:"n mono",text:String(n)}))));
  const body=h("div",{id:"obody"});v.replaceChildren(head,tabs,body);
  if(S.aba==="paginas")drawPaginas(o,body);else if(S.aba==="criativos"){body.appendChild(criativosShell(o));drawCriativos(o)}else drawNotas(o,body);
}
function updateCounts(o){document.querySelectorAll(".itab").forEach(t=>{const n=t.querySelector(".n");if(!n)return;if(t.dataset.tab==="paginas")n.textContent=String(Array.isArray(o.paginas)?o.paginas.length:0);if(t.dataset.tab==="criativos")n.textContent=String(criativosDe(o.id).length)})}

/* ---------- ofertas ---------- */
function patchLocal(id,data){const o=S.ofertas.find(x=>x.id===id);if(o)Object.assign(o,data)}
async function salvarOferta(id,data){if(!UUID_RE.test(id))return false;
  try{const d=await rest("PATCH","ofertas?id=eq."+id,{...data,atualizado_em:new Date().toISOString()});if(Array.isArray(d)&&d[0])patchLocal(id,d[0]);else patchLocal(id,data);render();return true}
  catch(e){if(e.message!=="401")toast("Não foi possível salvar.",true);return false}}
function novaOferta(){
  const nome=h("input",{class:"inp",id:"novoNome",maxlength:"80",placeholder:"Ex.: Regata Sauna — Black Friday",required:true});
  const nicho=h("input",{class:"inp",id:"novoNicho",maxlength:"120",placeholder:"Ex.: moda fitness (opcional)"});
  const st=h("select",{class:"sel",id:"novoStatus"},STATUS_O.map(([k,l])=>h("option",{value:k},l)));
  const criar=h("button",{class:"btn y",type:"submit"},icon("plus"),"Criar oferta");
  const form=h("form",{class:"md"},h("h3",{text:"Nova oferta"}),h("label",null,"Nome da oferta",nome),h("label",null,"Nicho ou produto",nicho),h("label",null,"Status",st),
    h("div",{class:"bt"},h("button",{class:"btn ghost",type:"button",onclick:()=>ov.remove()},"Cancelar"),criar));
  const ov=h("div",{class:"ov",role:"dialog","aria-label":"Nova oferta"},form);ov.addEventListener("click",e=>{if(e.target===ov)ov.remove()});
  form.addEventListener("submit",async e=>{e.preventDefault();const n=clip(nome.value.trim(),80);if(!n){nome.focus();return}criar.disabled=true;
    try{const d=await rest("POST","ofertas",{nome:n,nicho:clip(nicho.value.trim(),120),status:okStatus(st.value,STATUS_O,"testando")});
      const o=Array.isArray(d)&&d[0];if(!o||!UUID_RE.test(o.id))throw new Error("x");S.ofertas.unshift(o);ov.remove();toast("Oferta criada");S.sel=o.id;S.aba="paginas";render()}
    catch(err){criar.disabled=false;if(err.message!=="401")toast("Não foi possível criar a oferta.",true)}});
  document.body.appendChild(ov);setTimeout(()=>nome.focus(),50);
}
function excluirOferta(o){const cs=criativosDe(o.id);
  confirmar("Excluir a oferta “"+clip(o.nome,60)+"”?","Serão apagados para sempre: "+cs.length+" criativo(s), as páginas e as anotações desta oferta.","Excluir tudo",async()=>{
    try{await storageDelete(cs.map(c=>c.caminho));await rest("DELETE","ofertas?id=eq."+o.id);
      S.ofertas=S.ofertas.filter(x=>x.id!==o.id);S.criativos=S.criativos.filter(c=>c.oferta_id!==o.id);S.sel=null;toast("Oferta excluída");render();atualizarUso()}
    catch(e){if(e.message!=="401")toast("Não foi possível excluir tudo. Tente de novo.",true)}})}
function confirmar(titulo,texto,acao,fn){
  const ok=h("button",{class:"btn danger",type:"button"},icon("trash"),acao);
  const ov=h("div",{class:"ov",role:"alertdialog","aria-label":titulo},h("div",{class:"md"},h("h3",{text:titulo}),h("p",{text:texto}),h("div",{class:"bt"},h("button",{class:"btn ghost",type:"button",onclick:()=>ov.remove()},"Cancelar"),ok)));
  ok.addEventListener("click",async()=>{ok.disabled=true;await fn();ov.remove()});ov.addEventListener("click",e=>{if(e.target===ov)ov.remove()});
  document.body.appendChild(ov);ok.focus();
}

/* ---------- páginas de venda ---------- */
function drawPaginas(o,body){
  const pags=(Array.isArray(o.paginas)?o.paginas:[]).filter(p=>p&&safeHttps(p.url));
  const t=h("input",{class:"inp",id:"pgTitulo",placeholder:"Nome (ex.: Página A)",maxlength:"60"});
  const u=h("input",{class:"inp",id:"pgUrl",type:"url",inputmode:"url",placeholder:"Link da página de vendas (https://…)",maxlength:"2000"});
  const add=h("button",{class:"btn y",type:"button"},icon("plus"),"Adicionar página");
  const go=async()=>{const url=safeHttps(u.value);if(!url){toast("Cole um link válido que comece com https://",true);u.focus();return}
    if(pags.length>=50){toast("Limite de 50 páginas por oferta.",true);return}
    add.disabled=true;const nova={id:uuid(),titulo:clip(t.value.trim(),60)||"Página "+(pags.length+1),url};
    if(await salvarOferta(o.id,{paginas:pags.concat([nova])}))toast("Página salva");add.disabled=false};
  add.addEventListener("click",go);u.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
  body.appendChild(h("div",{class:"addrow"},t,u,add));
  if(!pags.length){body.appendChild(h("div",{class:"empty"},h("div",{class:"ic"},icon("link")),h("h3",{text:"Nenhuma página de venda"}),h("p",{text:"Adicione o link da página (landing page) que você vai rodar nesta oferta. Pode adicionar quantas quiser."})));return}
  body.appendChild(h("div",{class:"plist"},pags.map(p=>{const url=safeHttps(p.url);
    return h("div",{class:"prow"},h("div",{class:"ic"},icon("link")),h("div",{class:"tx"},h("b",{text:clip(p.titulo,60)}),h("span",{class:"u mono",text:url})),
      h("div",{class:"ac"},h("button",{class:"btn sm",type:"button",onclick:e=>copiar(url,e.currentTarget)},icon("copy"),"Copiar"),
        h("a",{class:"btn sm ghost",href:url,target:"_blank",rel:"noopener noreferrer"},icon("open"),"Abrir"),
        h("button",{class:"btn icon danger",type:"button","aria-label":"Excluir página",onclick:()=>confirmar("Excluir esta página?","O link será removido desta oferta.","Excluir",async()=>{
          if(await salvarOferta(o.id,{paginas:pags.filter(x=>x.id!==p.id)}))toast("Página excluída")})},icon("trash"))))})));
}
async function copiar(text,btn){try{await navigator.clipboard.writeText(text);toast("Link copiado")}catch(e){const i=h("input",{class:"inp",value:text,readonly:true});btn.replaceWith(i);i.focus();i.select();toast("Toque e segure para copiar")}}

/* ---------- criativos ---------- */
function criativosShell(o){
  const file=h("input",{type:"file",id:"fileIn",accept:"image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov",multiple:true,hidden:true});
  file.addEventListener("change",()=>{enviar(o,[...file.files]);file.value=""});
  const drop=h("div",{class:"drop",id:"drop"},h("div",{class:"tx"},h("b",{text:"Adicionar criativos"}),h("span",{text:"Fotos (JPG, PNG, WEBP, GIF) e vídeos (MP4, MOV, WEBM) de até 50 MB. O arquivo é guardado do jeito que você enviou, sem perder qualidade."})),
    h("button",{class:"btn y",type:"button",onclick:()=>file.click()},icon("up"),"Escolher arquivos"),file);
  drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("over")});drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
  drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("over");enviar(o,[...(e.dataTransfer?e.dataTransfer.files:[])])});
  return h("div",null,drop,h("div",{class:"up",id:"upl"}),h("div",{id:"cwrap"}));
}
function drawUploads(){const u=$("#upl");if(u)u.replaceChildren(...S.uploads.map(x=>h("div",null,h("span",{text:x.nome}),h("span",{class:x.er?"er":"",text:x.st}))))}
function tipoDe(f){if(TYPES[f.type])return f.type;if(/\.mov$/i.test(f.name))return "video/quicktime";return null}
async function enviar(o,files){
  if(!files.length||!session)return;if(files.length>30){toast("Envie no máximo 30 arquivos por vez.",true);files=files.slice(0,30)}
  for(const f of files){const item={nome:clip(f.name,60),st:"Enviando…",er:false};S.uploads.push(item);drawUploads();
    const ct=tipoDe(f);
    if(!ct){item.st="Formato não aceito";item.er=true;drawUploads();continue}
    if(f.size>MAX){item.st="Maior que 50 MB";item.er=true;drawUploads();continue}
    if(!f.size){item.st="Arquivo vazio";item.er=true;drawUploads();continue}
    const caminho=session.user.id+"/"+o.id+"/"+uuid()+"."+TYPES[ct];
    try{const blob=f.type===ct?f:new Blob([f],{type:ct});
      await storageUpload(caminho,blob);
      const d=await rest("POST","criativos",{oferta_id:o.id,nome:clip(f.name.replace(/\.[^.]+$/,""),60)||"Criativo",caminho,tipo:ct.startsWith("video/")?"video":"imagem",content_type:ct,bytes:f.size});
      const c=Array.isArray(d)&&d[0];if(c){S.criativos.unshift(c);await signPaths([c.caminho])}
      item.st="Salvo";
    }catch(e){item.er=true;item.st=e.status===413?"Maior que o limite":e.status===415?"Formato não aceito":e.status===429?"Muitos envios: tente em instantes":"Falha no envio";try{await storageDelete([caminho])}catch(x){}}
    drawUploads();render();
  }
  atualizarUso();setTimeout(()=>{S.uploads=S.uploads.filter(x=>x.er);drawUploads()},3500);
}
function drawCriativos(o){
  const w=$("#cwrap");if(!w)return;const cs=criativosDe(o.id);
  if(!cs.length){w.replaceChildren(h("div",{class:"empty"},h("div",{class:"ic"},icon("img")),h("h3",{text:"Nenhum criativo nesta oferta"}),h("p",{text:"Envie as fotos e vídeos dos anúncios. Eles ficam guardados aqui, não no seu celular, e você baixa quando precisar."})));return}
  const vids=cs.filter(c=>c.tipo==="video"),imgs=cs.filter(c=>c.tipo!=="video");const f=S.ctipo;const lista=f==="video"?vids:f==="imagem"?imgs:cs;
  const chips=h("div",{class:"filters mt16",role:"tablist","aria-label":"Tipo de criativo"},[["todos","Todos",cs.length],["video","Vídeos",vids.length],["imagem","Imagens",imgs.length]].map(([k,l,n])=>
    h("button",{class:"chip"+(f===k?" on":""),type:"button",role:"tab","aria-selected":f===k?"true":"false",onclick:()=>{S.ctipo=k;drawCriativos(o)}},l+" ("+n+")")));
  const grid=lista.length?h("div",{class:"cgrid"},lista.map(cardCriativo)):h("div",{class:"empty"},h("div",{class:"ic"},icon("img")),h("h3",{text:f==="video"?"Nenhum vídeo nesta oferta":"Nenhuma imagem nesta oferta"}),h("p",{text:"Use o botão Escolher arquivos acima para enviar."}));
  w.replaceChildren(chips,grid);
}
function cardCriativo(c){
  const u=urlOf(c.caminho);const vid=c.tipo==="video";const st=okStatus(c.status,STATUS_C,"novo");
  const pv=h("button",{class:"pv",type:"button","aria-label":"Ver "+clip(c.nome,60),onclick:()=>u&&lightbox(c)},
    u?(vid?h("video",{src:u+"#t=0.1",muted:true,playsinline:true,preload:"metadata"}):h("img",{src:u,alt:clip(c.nome,60),loading:"lazy",decoding:"async"})):h("span",{class:"miss",text:"Carregando…"}),
    h("span",{class:"tp",text:vid?"VÍDEO":"IMAGEM"}));
  const im=pv.querySelector("img");if(im)im.addEventListener("error",()=>im.replaceWith(h("span",{class:"miss",text:"Arquivo indisponível"})));
  const nm=h("input",{class:"nmi",value:clip(c.nome,60),maxlength:"60","aria-label":"Nome do criativo","data-keep":c.oferta_id});
  nm.addEventListener("change",()=>salvarCriativo(c.id,{nome:clip(nm.value.trim(),60)||"Criativo"}));
  const sel=h("select",{class:"sel","aria-label":"Status do criativo"},STATUS_C.map(([k,l])=>h("option",{value:k,selected:k===st},l)));
  sel.addEventListener("change",()=>salvarCriativo(c.id,{status:okStatus(sel.value,STATUS_C,"novo")}));
  return h("div",{class:"cc"},pv,h("div",{class:"bd"},nm,h("div",{class:"meta mono"},h("span",{text:fmtBytes(c.bytes)}),h("span",{text:fmtDate(c.criado_em)})),
    h("div",{class:"row"},sel,h("button",{class:"btn icon danger",type:"button","aria-label":"Excluir criativo",onclick:()=>excluirCriativo(c)},icon("trash"))),
    h("div",{class:"row2"},h("button",{class:"btn y sm",type:"button",onclick:e=>baixar(c,e.currentTarget,false)},icon("down"),"Baixar"),
      podeCompartilhar()?h("button",{class:"btn sm",type:"button",onclick:e=>baixar(c,e.currentTarget,true)},icon("share"),"Galeria"):null)));
}
function podeCompartilhar(){try{return !!(navigator.canShare&&navigator.share&&navigator.canShare({files:[new File(["x"],"x.png",{type:"image/png"})]}))}catch(e){return false}}
async function baixar(c,btn,share){
  await signPaths([c.caminho]);const u=urlOf(c.caminho);if(!u)return toast("Arquivo indisponível.",true);
  const ext=TYPES[c.content_type]||(c.tipo==="video"?"mp4":"jpg");
  const nome=(String(c.nome||"criativo").replace(/[^\p{L}\p{N} _-]+/gu,"").trim().slice(0,60)||"criativo")+"."+ext;
  if(btn)btn.disabled=true;
  try{const r=await fetch(u,{credentials:"omit",cache:"no-store"});if(!r.ok)throw new Error("fetch");const b=await r.blob();
    const file=new File([b],nome,{type:c.content_type});
    if(share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:nome})}catch(e){if(e&&e.name!=="AbortError")throw e}return}
    const ou=URL.createObjectURL(file);const a=h("a",{href:ou,download:nome});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(ou),60000);toast("Download iniciado")}
  catch(e){toast("Não foi possível baixar. Tente de novo.",true)}finally{if(btn)btn.disabled=false}
}
function lightbox(c){const u=urlOf(c.caminho);if(!u)return;
  const close=()=>{ov.remove();document.removeEventListener("keydown",esc)};const esc=e=>{if(e.key==="Escape")close()};
  const media=c.tipo==="video"?h("video",{src:u,controls:true,playsinline:true,autoplay:true}):h("img",{src:u,alt:clip(c.nome,60)});
  const ov=h("div",{class:"lb",role:"dialog","aria-label":"Criativo"},h("div",{class:"hd"},h("b",{text:clip(c.nome,60)}),
      h("button",{class:"btn y sm",type:"button",onclick:e=>baixar(c,e.currentTarget,false)},icon("down"),"Baixar"),
      podeCompartilhar()?h("button",{class:"btn sm",type:"button",onclick:e=>baixar(c,e.currentTarget,true)},icon("share"),"Galeria"):null,
      h("button",{class:"btn icon",type:"button","aria-label":"Fechar",onclick:close},icon("x"))),h("div",{class:"st"},media));
  ov.addEventListener("click",e=>{if(e.target===ov||e.target.classList.contains("st"))close()});document.addEventListener("keydown",esc);document.body.appendChild(ov);
}
async function salvarCriativo(id,data){if(!UUID_RE.test(id))return;try{const d=await rest("PATCH","criativos?id=eq."+id,data);const c=S.criativos.find(x=>x.id===id);if(c)Object.assign(c,Array.isArray(d)&&d[0]?d[0]:data)}catch(e){if(e.message!=="401")toast("Não foi possível salvar.",true)}}
function excluirCriativo(c){confirmar("Excluir este criativo?","O arquivo será apagado para sempre. Se quiser guardar, baixe antes.","Excluir",async()=>{
  try{await storageDelete([c.caminho]);await rest("DELETE","criativos?id=eq."+c.id);S.criativos=S.criativos.filter(x=>x.id!==c.id);toast("Criativo excluído");render();atualizarUso()}
  catch(e){if(e.message!=="401")toast("Não foi possível excluir.",true)}})}

/* ---------- anotações ---------- */
function drawNotas(o,body){
  const ta=h("textarea",{class:"notes",id:"notas",maxlength:"20000",placeholder:"Público, orçamento, ganchos, resultados dos testes… tudo sobre esta oferta.","data-keep":o.id});ta.value=clip(o.notas,20000);
  const info=h("div",{class:"saved",text:o.notas?"Salvo":""});
  const save=async()=>{if(notesBusy){clearTimeout(notesTimer);notesTimer=setTimeout(save,600);return}notesBusy=true;info.textContent="Salvando…";
    try{await rest("PATCH","ofertas?id=eq."+o.id,{notas:clip(ta.value,20000),atualizado_em:new Date().toISOString()},{"Prefer":"return=minimal"});patchLocal(o.id,{notas:clip(ta.value,20000)});info.textContent="Salvo"}
    catch(e){info.textContent="Não foi possível salvar"}finally{notesBusy=false}};
  ta.addEventListener("input",()=>{info.textContent="Digitando…";clearTimeout(notesTimer);notesTimer=setTimeout(save,900)});
  body.append(ta,info);
}

/* ---------- instalar como app ---------- */
let installEvt=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;$("#btnInstalar").hidden=false});
function setupInstall(){const b=$("#btnInstalar");
  const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(!standalone&&ios)b.hidden=false;
  b.addEventListener("click",async()=>{if(installEvt){installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;b.hidden=true;return}
    if(ios){const ov=h("div",{class:"ov",role:"dialog"},h("div",{class:"md"},h("h3",{text:"Instalar no iPhone"}),h("p",{text:"No Safari, toque no botão Compartilhar (quadrado com seta) e depois em “Adicionar à Tela de Início”."}),h("div",{class:"bt"},h("button",{class:"btn y",type:"button",onclick:()=>ov.remove()},"Entendi"))));document.body.appendChild(ov)}});
}
if("serviceWorker" in navigator){addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{})})}

/* ---------- início ---------- */
function start(){
  $("#btnNova").hidden=false;$("#btnSair").hidden=false;$("#side").hidden=false;S.loaded=false;render();carregar();
}
document.addEventListener("DOMContentLoaded",()=>{
  $("#btnNova").addEventListener("click",novaOferta);$("#btnSair").addEventListener("click",sair);setupInstall();
  loadSession();if(session)start();else showAuth("");
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&session&&S.loaded)carregar()});
});
})();
