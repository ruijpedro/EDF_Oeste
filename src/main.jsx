
import React,{useState}from'react'
import{createRoot}from'react-dom/client'
import jsPDF from'jspdf'
import * as XLSX from'xlsx'
import'./style.css'

const ICON='/ip-logo.png'
const SCOPES='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.events'
const DISCOVERY=[
 'https://sheets.googleapis.com/$discovery/rest?version=v4',
 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
]
const LS_CFG='edf_v3_google_cfg'
const APP_FOLDER='EDF_Oeste'
const EXCEL_FOLDER='Edificios Oeste'
const DB_NAME='EDF_Oeste_DB'
const DB_SHEETS=['Edificios','Estacoes','Classificacao','Inspecoes','Fotos','PDF','Intervencoes','Custos','Documentos']
const EXCEL_FILES=[
 {key:'estacoes',name:'Estações e Apeadeiros.xlsx',sheet:'Estacoes'},
 {key:'lista',name:'Lista de edificios.xlsx',sheet:'Edificios'},
 {key:'classificacao',name:'Folha_Classificacao_Edificios_Linha_Oeste_RJP.xlsx',sheet:'Classificacao'}
]
function load(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function today(){return new Date().toISOString().slice(0,10)}
function rowsToObjects(values){if(!values||values.length<2)return[];const h=values[0].map(x=>String(x||'').trim());return values.slice(1).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))}
function valuesFromObjects(arr){if(!arr.length)return[['sem_dados']];const keys=Array.from(arr.reduce((s,o)=>{Object.keys(o).forEach(k=>s.add(k));return s},new Set()));return [keys,...arr.map(o=>keys.map(k=>o[k]??''))]}
function val(o,ks){for(const k of ks){if(o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return String(o[k]).trim()}return''}
function badge(e){return ['Crítico','Mau','Alta','Urgente'].includes(e)?'danger':['Razoável','Média'].includes(e)?'warn':'ok'}

function App(){
 const[tab,setTab]=useState('dashboard')
 const[cfg,setCfg]=useState(load(LS_CFG,{apiKey:'',clientId:'',spreadsheetId:'',rootFolderId:'',excelFolderId:'',calendarId:'primary'}))
 const[token,setToken]=useState(null)
 const[status,setStatus]=useState('Desligado')
 const[edificios,setEdificios]=useState([])
 const[estacoes,setEstacoes]=useState([])
 const[classificacao,setClassificacao]=useState([])
 const[inspecoes,setInspecoes]=useState([])
 const[fotos,setFotos]=useState([])
 const[pdfs,setPdfs]=useState([])
 const[excelFound,setExcelFound]=useState([])
 const[sel,setSel]=useState('')
 const[insp,setInsp]=useState({data:today(),categoria:'Cobertura',estado:'Razoável',gravidade:'Média',prazo:'',responsavel:'RJP',descricao:'',acao:'',custo:'',fotos:[]})
 const ed=edificios.find(e=>String(e.ID)===String(sel)) || classificacao.find(e=>String(e.ID)===String(sel))
 const nav=[['dashboard','Dashboard'],['setup','Google'],['excel','Importar Excel'],['linha','Linha do Oeste'],['edificios','Edifícios'],['inspecoes','Inspeções'],['drive','Drive'],['calendar','Calendar'],['relatorios','PDF']]

 async function initGoogle(){
  if(!cfg.apiKey||!cfg.clientId){alert('Preenche API Key e Client ID');return}
  setStatus('A ligar ao Google...')
  await new Promise(res=>{const wait=()=>window.gapi&&window.google?res():setTimeout(wait,200);wait()})
  await new Promise(res=>window.gapi.load('client',res))
  await window.gapi.client.init({apiKey:cfg.apiKey,discoveryDocs:DISCOVERY})
  window.google.accounts.oauth2.initTokenClient({
   client_id:cfg.clientId,scope:SCOPES,
   callback:r=>{setToken(r.access_token);window.gapi.client.setToken(r);setStatus('Ligado à conta Google')}
  }).requestAccessToken()
 }

 async function searchFolder(name,parentId='root'){
  const safe=name.replaceAll("'","\\'")
  const q=`name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
  const res=await window.gapi.client.drive.files.list({q,fields:'files(id,name,modifiedTime)'})
  return res.result.files?.[0]||null
 }
 async function createFolder(name,parentId='root'){
  const res=await window.gapi.client.drive.files.create({resource:{name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]},fields:'id,name'})
  return res.result
 }
 async function ensureFolder(name,parentId='root'){
  return await searchFolder(name,parentId)||await createFolder(name,parentId)
 }

 async function ensureStructure(){
  if(!token){alert('Liga primeiro ao Google');return}
  setStatus('A criar estrutura no Drive...')
  const root=cfg.rootFolderId?{id:cfg.rootFolderId,name:APP_FOLDER}:await ensureFolder(APP_FOLDER,'root')
  const baseDados=await ensureFolder('Base_Dados',root.id)
  await ensureFolder('Fotografias',root.id)
  await ensureFolder('PDF',root.id)
  await ensureFolder('Documentos',root.id)
  const sheetsFolder=await ensureFolder('Sheets',baseDados.id)
  let spreadsheetId=cfg.spreadsheetId
  if(!spreadsheetId){
   const s=await window.gapi.client.drive.files.create({resource:{name:DB_NAME,mimeType:'application/vnd.google-apps.spreadsheet',parents:[sheetsFolder.id]},fields:'id,name'})
   spreadsheetId=s.result.id
  }
  const excelFolder=cfg.excelFolderId?{id:cfg.excelFolderId,name:EXCEL_FOLDER}:await searchFolder(EXCEL_FOLDER,'root')
  const newCfg={...cfg,rootFolderId:root.id,spreadsheetId,excelFolderId:excelFolder?.id||cfg.excelFolderId}
  setCfg(newCfg);save(LS_CFG,newCfg)
  await ensureSheets(spreadsheetId)
  setStatus('Estrutura Google criada/confirmada')
 }

 async function ensureSheets(spreadsheetId){
  const meta=await window.gapi.client.sheets.spreadsheets.get({spreadsheetId})
  const existing=meta.result.sheets.map(s=>s.properties.title)
  const requests=DB_SHEETS.filter(s=>!existing.includes(s)).map(title=>({addSheet:{properties:{title}}}))
  if(requests.length)await window.gapi.client.sheets.spreadsheets.batchUpdate({spreadsheetId,resource:{requests}})
  const init={
   Edificios:['ID','Pk','Localização','Utilização Principal'],
   Estacoes:['Pk','Localização','Utilização Principal'],
   Classificacao:['ID','Linha','Estação/Local','PK','Tipo de edifício','Uso atual','Estado global','Risco','Urgência','Intervenção recomendada','Data inspeção','Próxima inspeção','Fotos/Drive','Técnico'],
   Inspecoes:['ID','EdificioID','Estação','Data','Categoria','Estado','Gravidade','Prazo','Responsável','Descrição','Ação','Custo','Fotos','Autor'],
   Fotos:['ID','InspecaoID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],
   PDF:['ID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],
   Intervencoes:['ID','EdificioID','Estação','Data','Tipo','Prioridade','Descrição','Estado','Custo','Autor'],
   Custos:['ID','EdificioID','Estação','Data','Categoria','Valor','Observações','Autor'],
   Documentos:['ID','EdificioID','Estação','Data','Tipo','Nome','DriveID','Link','Autor']
  }
  for(const [sheet,headers] of Object.entries(init)){
   const r=await window.gapi.client.sheets.spreadsheets.values.get({spreadsheetId,range:`${sheet}!A1:Z1`}).catch(()=>null)
   if(!r?.result?.values?.length)await window.gapi.client.sheets.spreadsheets.values.update({spreadsheetId,range:`${sheet}!A1`,valueInputOption:'USER_ENTERED',resource:{values:[headers]}})
  }
 }

 async function findExcelFolder(){
  if(!token){alert('Liga primeiro ao Google');return null}
  let folder=null
  if(cfg.excelFolderId) folder={id:cfg.excelFolderId,name:EXCEL_FOLDER}
  if(!folder) folder=await searchFolder(EXCEL_FOLDER,'root')
  if(!folder){alert(`Não encontrei a pasta "${EXCEL_FOLDER}" no teu Drive.`);return null}
  const newCfg={...cfg,excelFolderId:folder.id};setCfg(newCfg);save(LS_CFG,newCfg)
  return folder
 }

 async function procurarExcel(){
  const folder=await findExcelFolder()
  if(!folder)return
  setStatus('A procurar ficheiros Excel...')
  const q=`'${folder.id}' in parents and trashed=false and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel')`
  const res=await window.gapi.client.drive.files.list({q,fields:'files(id,name,mimeType,modifiedTime,size,webViewLink)'})
  const files=res.result.files||[]
  setExcelFound(files)
  setStatus(`Encontrados ${files.length} ficheiros Excel`)
 }

 async function downloadExcel(fileId){
  const res=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:{Authorization:`Bearer ${token}`}})
  const buf=await res.arrayBuffer()
  const wb=XLSX.read(buf,{type:'array'})
  const ws=wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws,{defval:''})
 }

 async function updateSheet(sheet,arr){
  if(!cfg.spreadsheetId)throw new Error('Falta Spreadsheet ID.')
  const values=valuesFromObjects(arr)
  await window.gapi.client.sheets.spreadsheets.values.clear({spreadsheetId:cfg.spreadsheetId,range:`${sheet}!A:Z`})
  await window.gapi.client.sheets.spreadsheets.values.update({spreadsheetId:cfg.spreadsheetId,range:`${sheet}!A1`,valueInputOption:'USER_ENTERED',resource:{values}})
 }

 function normalizeLista(rows){
  return rows.map((r,i)=>({ID:val(r,['ID','Id','id'])||`LO-${i+1}`,Pk:val(r,['Pk','PK','pk']),Localização:val(r,['Localização','Localizacao','Estação','Estacao']),"Utilização Principal":val(r,['Utilização Principal','Utilizacao Principal','Tipo'])})).filter(r=>r.Localização||r.Pk||r.ID)
 }
 function normalizeEstacoes(rows){
  return rows.map(r=>({Pk:val(r,['Pk','PK','pk']),Localização:val(r,['Localização','Localizacao','Estação','Estacao']),"Utilização Principal":val(r,['Utilização Principal','Utilizacao Principal','Tipo'])})).filter(r=>r.Localização||r.Pk)
 }
 function normalizeClassificacao(rows){
  return rows.map((r,i)=>({
   ID:val(r,['ID','Id','id'])||`CLASS-${i+1}`,
   Linha:val(r,['Linha'])||'Linha do Oeste',
   'Estação/Local':val(r,['Estação/Local','Estação','Localização','Localizacao']),
   PK:val(r,['PK','Pk','pk']),
   'Tipo de edifício':val(r,['Tipo de edifício','Tipo','Utilização Principal']),
   'Uso atual':val(r,['Uso atual','Utilização Principal']),
   'Estado global':val(r,['Estado global','Estado Global'])||'A avaliar',
   Risco:val(r,['Risco']),
   Urgência:val(r,['Urgência','Urgencia']),
   'Intervenção recomendada':val(r,['Intervenção recomendada','Intervencao recomendada']),
   'Data inspeção':val(r,['Data inspeção','Data inspecao']),
   'Próxima inspeção':val(r,['Próxima inspeção','Proxima inspeção','Proxima inspecao']),
   'Fotos/Drive':val(r,['Fotos/Drive','Fotos Drive']),
   Técnico:val(r,['Técnico','Tecnico'])||'RJP'
  })).filter(r=>r['Estação/Local']||r.PK||r.ID)
 }

 async function atualizarTudo(){
  if(!token){alert('Liga primeiro ao Google');return}
  if(!cfg.spreadsheetId) await ensureStructure()
  const folder=await findExcelFolder()
  if(!folder)return
  await procurarExcel()
  const q=`'${folder.id}' in parents and trashed=false and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel')`
  const res=await window.gapi.client.drive.files.list({q,fields:'files(id,name,mimeType,modifiedTime,size,webViewLink)'})
  const files=res.result.files||[]
  let est=[], lis=[], cls=[]
  for(const f of files){
   setStatus(`A importar ${f.name}...`)
   const rows=await downloadExcel(f.id)
   const name=f.name.toLowerCase()
   if(name.includes('estações')||name.includes('estacoes')) est=normalizeEstacoes(rows)
   else if(name.includes('lista')) lis=normalizeLista(rows)
   else if(name.includes('classificacao')||name.includes('classificação')) cls=normalizeClassificacao(rows)
  }
  if(est.length) await updateSheet('Estacoes',est)
  if(lis.length) await updateSheet('Edificios',lis)
  if(cls.length) await updateSheet('Classificacao',cls)
  setEstacoes(est);setEdificios(lis);setClassificacao(cls)
  setExcelFound(files)
  setStatus(`Atualização concluída: ${est.length} estações, ${lis.length} edifícios, ${cls.length} classificações`)
 }

 async function readAll(){
  if(!token||!cfg.spreadsheetId){alert('Liga ao Google e cria/seleciona a estrutura');return}
  setStatus('A ler base Google...')
  const ranges=DB_SHEETS.map(s=>`${s}!A:Z`)
  const res=await window.gapi.client.sheets.spreadsheets.values.batchGet({spreadsheetId:cfg.spreadsheetId,ranges})
  const map={}
  DB_SHEETS.forEach((s,i)=>map[s]=rowsToObjects(res.result.valueRanges[i].values||[]))
  setEdificios(map.Edificios||[]);setEstacoes(map.Estacoes||[]);setClassificacao(map.Classificacao||[]);setInspecoes(map.Inspecoes||[]);setFotos(map.Fotos||[]);setPdfs(map.PDF||[])
  setStatus('Dados carregados da base Google')
 }

 async function appendSheet(sheet,headers,row){
  await window.gapi.client.sheets.spreadsheets.values.append({spreadsheetId:cfg.spreadsheetId,range:`${sheet}!A:Z`,valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',resource:{values:[headers.map(h=>row[h]??'')]}})
 }
 async function ensureStationFolders(estacao){
  const est=await ensureFolder(estacao||'Sem_Estacao',cfg.rootFolderId)
  return {fotos:await ensureFolder('Fotos',est.id),pdf:await ensureFolder('PDF',est.id),docs:await ensureFolder('Documentos',est.id)}
 }
 async function uploadDrive(file,parentId){
  const meta={name:file.name,mimeType:file.type||'application/octet-stream',parents:[parentId]}
  const fd=new FormData()
  fd.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}))
  fd.append('file',file)
  const res=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd})
  return await res.json()
 }
 async function addFotos(e){
  if(!token||!ed){alert('Liga ao Google e seleciona edifício');return}
  const station=ed.Localização||ed['Estação/Local']||ed.Estação
  const folders=await ensureStationFolders(station)
  const added=[]
  for(const file of [...e.target.files]){
   setStatus('A guardar foto no Drive...')
   const up=await uploadDrive(file,folders.fotos.id)
   const row={ID:crypto.randomUUID(),InspecaoID:'',EdificioID:ed.ID,Estação:station,Data:today(),Nome:file.name,DriveID:up.id,Link:up.webViewLink,Autor:'RJP'}
   await appendSheet('Fotos',['ID','InspecaoID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],row)
   added.push(row)
  }
  setFotos([...added,...fotos]);setInsp({...insp,fotos:[...insp.fotos,...added]})
  setStatus('Fotos guardadas no Drive')
 }
 async function guardarInspecao(){
  if(!token||!ed){alert('Liga ao Google e seleciona edifício');return}
  const station=ed.Localização||ed['Estação/Local']||ed.Estação
  const row={ID:crypto.randomUUID(),EdificioID:ed.ID,Estação:station,Data:insp.data,Categoria:insp.categoria,Estado:insp.estado,Gravidade:insp.gravidade,Prazo:insp.prazo,Responsável:insp.responsavel,Descrição:insp.descricao,Ação:insp.acao,Custo:insp.custo,Fotos:(insp.fotos||[]).map(f=>f.Link).join(' | '),Autor:'RJP'}
  await appendSheet('Inspecoes',['ID','EdificioID','Estação','Data','Categoria','Estado','Gravidade','Prazo','Responsável','Descrição','Ação','Custo','Fotos','Autor'],row)
  setInspecoes([row,...inspecoes]);setInsp({...insp,descricao:'',acao:'',custo:'',fotos:[]});setStatus('Inspeção guardada')
 }
 async function gerarPdfDrive(){
  if(!token||!ed){alert('Liga ao Google e seleciona edifício');return}
  const station=ed.Localização||ed['Estação/Local']||ed.Estação
  const pdf=new jsPDF();let y=13
  pdf.setFillColor(23,181,164);pdf.rect(0,0,210,28,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(17);pdf.text('EDF_Oeste',12,y);pdf.setFontSize(10);pdf.text('Gestão de Edifícios e Manutenção · Autor: RJP',12,20)
  pdf.setTextColor(0,0,0);pdf.setFontSize(13);pdf.text(`${station} | ${ed.ID} | PK ${ed.Pk||ed.PK||'-'}`,12,40);pdf.setFontSize(10);pdf.text(`Tipo: ${ed['Utilização Principal']||ed['Tipo de edifício']||'-'}`,12,48)
  y=62
  inspecoes.filter(i=>String(i.EdificioID)===String(ed.ID)).forEach((i,n)=>{if(y>270){pdf.addPage();y=20}pdf.text(`${n+1}. ${i.Data} - ${i.Categoria} - ${i.Estado}`,12,y);y+=7;pdf.text(pdf.splitTextToSize(i.Descrição||'-',180),12,y);y+=14})
  const folders=await ensureStationFolders(station)
  const file=new File([pdf.output('blob')],`EDF_Oeste_${ed.ID}_${today()}.pdf`,{type:'application/pdf'})
  const up=await uploadDrive(file,folders.pdf.id)
  const row={ID:crypto.randomUUID(),EdificioID:ed.ID,Estação:station,Data:today(),Nome:file.name,DriveID:up.id,Link:up.webViewLink,Autor:'RJP'}
  await appendSheet('PDF',['ID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],row)
  setPdfs([row,...pdfs]);setStatus('PDF guardado no Drive');alert('PDF guardado no Drive.')
 }
 async function criarEvento(){
  if(!token||!ed||!insp.prazo){alert('Seleciona edifício e prazo');return}
  const station=ed.Localização||ed['Estação/Local']||ed.Estação
  const s=new Date(insp.prazo+'T09:00:00'), e=new Date(insp.prazo+'T10:00:00')
  await window.gapi.client.calendar.events.insert({calendarId:cfg.calendarId||'primary',resource:{summary:`EDF_Oeste - ${station} - ${insp.categoria}`,description:insp.acao||insp.descricao,start:{dateTime:s.toISOString()},end:{dateTime:e.toISOString()}}})
  setStatus('Evento criado')
 }
 const allEd=[...classificacao,...edificios].filter((v,i,a)=>a.findIndex(x=>String(x.ID)===String(v.ID))===i)
 return <div><header className="top"><div className="brand"><img className="brand-logo" src={ICON}/><div><h1>EDF_Oeste</h1><p>Gestão de Edifícios e Manutenção</p><div className="author">Autor: RJP · Excel Drive + Conta Google</div></div></div></header><nav className="tabs">{nav.map(([id,n])=><button key={id} onClick={()=>setTab(id)} className={'tab '+(tab===id?'active':'')}>{n}</button>)}</nav><main className="container">
 {tab==='dashboard'&&<section className="grid"><div className="card"><h3>Estações</h3><div className="kpi">{estacoes.length}</div></div><div className="card"><h3>Edifícios</h3><div className="kpi">{allEd.length}</div></div><div className="card"><h3>Classificação</h3><div className="kpi">{classificacao.length}</div></div><div className="card"><h3>Inspeções</h3><div className="kpi">{inspecoes.length}</div></div><div className="card"><h3>Estado</h3><p>{status}</p></div></section>}
 {tab==='setup'&&<section className="grid"><div className="card"><h2>Conta Google</h2><label>API Key</label><input value={cfg.apiKey} onChange={e=>setCfg({...cfg,apiKey:e.target.value})}/><label>Client ID</label><input value={cfg.clientId} onChange={e=>setCfg({...cfg,clientId:e.target.value})}/><label>Spreadsheet ID opcional</label><input value={cfg.spreadsheetId} onChange={e=>setCfg({...cfg,spreadsheetId:e.target.value})}/><label>Root Folder ID opcional</label><input value={cfg.rootFolderId} onChange={e=>setCfg({...cfg,rootFolderId:e.target.value})}/><label>Excel Folder ID opcional</label><input value={cfg.excelFolderId} onChange={e=>setCfg({...cfg,excelFolderId:e.target.value})}/><label>Calendar ID</label><input value={cfg.calendarId} onChange={e=>setCfg({...cfg,calendarId:e.target.value})}/><button className="btn" onClick={()=>{save(LS_CFG,cfg);alert('Guardado')}}>Guardar</button><button className="btn secondary" onClick={initGoogle}>Ligar Google</button><button className="btn secondary" onClick={ensureStructure}>Criar estrutura Google</button><button className="btn secondary" onClick={readAll}>Ler base</button></div><div className="card"><h3>Pasta Excel</h3><p>A app procura automaticamente a pasta <b>Edificios Oeste</b> no Drive.</p></div></section>}
 {tab==='excel'&&<section className="grid"><div className="card"><h2>Importar Excel do Drive</h2><p>Procura os 3 ficheiros Excel na pasta <b>Edificios Oeste</b>.</p><button className="btn" onClick={procurarExcel}>Procurar Excel</button><button className="btn secondary" onClick={atualizarTudo}>Atualizar Tudo</button><p className="small">{status}</p></div><div className="card"><h3>Ficheiros encontrados</h3>{excelFound.map(f=><div className="item" key={f.id}><div className="thumb">📊</div><div><b>{f.name}</b><div className="small">{f.modifiedTime}</div><a href={f.webViewLink} target="_blank">Abrir no Drive</a></div></div>)}</div></section>}
 {tab==='linha'&&<section className="card"><h2>Linha do Oeste</h2>{estacoes.map(e=><div className="item" key={(e.Pk||'')+(e.Localização||'')}><div className="thumb">🚉</div><div><b>{e.Localização}</b><div className="small">PK {e.Pk||'-'} · {e['Utilização Principal']||''}</div></div></div>)}</section>}
 {tab==='edificios'&&<section className="card"><h2>Edifícios</h2>{allEd.map(e=><div className="item" key={e.ID}><div className="thumb">🏢</div><div><b>{e.Localização||e['Estação/Local']||e.Estação}</b><div className="small">{e.ID} · PK {e.Pk||e.PK||'-'} · {e['Utilização Principal']||e['Tipo de edifício']||e.Tipo||''}</div><span className={'badge '+badge(e['Estado global'])}>{e['Estado global']||'A avaliar'}</span><br/><button className="btn secondary" onClick={()=>{setSel(e.ID);setTab('inspecoes')}}>Selecionar</button></div></div>)}</section>}
 {tab==='inspecoes'&&<section className="grid"><div className="card"><h2>Nova inspeção</h2><label>Edifício</label><select value={sel} onChange={e=>setSel(e.target.value)}><option value="">Selecionar</option>{allEd.map(e=><option key={e.ID} value={e.ID}>{e.Localização||e['Estação/Local']} - {e.ID}</option>)}</select><div className="row"><div><label>Data</label><input type="date" value={insp.data} onChange={e=>setInsp({...insp,data:e.target.value})}/></div><div><label>Categoria</label><input value={insp.categoria} onChange={e=>setInsp({...insp,categoria:e.target.value})}/></div></div><div className="row3"><div><label>Estado</label><select value={insp.estado} onChange={e=>setInsp({...insp,estado:e.target.value})}>{['Bom','Razoável','Mau','Crítico'].map(x=><option key={x}>{x}</option>)}</select></div><div><label>Gravidade</label><select value={insp.gravidade} onChange={e=>setInsp({...insp,gravidade:e.target.value})}>{['Baixa','Média','Alta','Urgente'].map(x=><option key={x}>{x}</option>)}</select></div><div><label>Prazo</label><input type="date" value={insp.prazo} onChange={e=>setInsp({...insp,prazo:e.target.value})}/></div></div><label>Descrição</label><textarea value={insp.descricao} onChange={e=>setInsp({...insp,descricao:e.target.value})}/><label>Ação</label><textarea value={insp.acao} onChange={e=>setInsp({...insp,acao:e.target.value})}/><label>Custo</label><input value={insp.custo} onChange={e=>setInsp({...insp,custo:e.target.value})}/><label>Fotos</label><input type="file" multiple accept="image/*" capture="environment" onChange={addFotos}/><button className="btn" onClick={guardarInspecao}>Guardar no Google Sheets</button><button className="btn secondary" onClick={criarEvento}>Criar evento Calendar</button></div><div className="card"><h2>Histórico</h2>{inspecoes.filter(i=>!sel||String(i.EdificioID)===String(sel)).map(i=><div className="item" key={i.ID}><div className="thumb">📋</div><div><b>{i.Data} - {i.Categoria}</b><br/><span className={'badge '+badge(i.Estado)}>{i.Estado}</span><p>{i.Descrição}</p></div></div>)}</div></section>}
 {tab==='drive'&&<section className="grid"><div className="card"><h2>Fotografias no Drive</h2>{fotos.map(f=><div className="item" key={f.ID}><div className="thumb">📷</div><div><b>{f.Estação}</b><div className="small">{f.Nome}</div><a href={f.Link} target="_blank">Abrir</a></div></div>)}</div><div className="card"><h2>PDF no Drive</h2>{pdfs.map(p=><div className="item" key={p.ID}><div className="thumb">📄</div><div><b>{p.Estação}</b><div className="small">{p.Nome}</div><a href={p.Link} target="_blank">Abrir</a></div></div>)}</div></section>}
 {tab==='calendar'&&<section className="card"><h2>Google Calendar</h2><button className="btn" onClick={criarEvento}>Criar evento</button></section>}
 {tab==='relatorios'&&<section className="card"><h2>Relatório PDF</h2><select value={sel} onChange={e=>setSel(e.target.value)}><option value="">Selecionar edifício</option>{allEd.map(e=><option key={e.ID} value={e.ID}>{e.Localização||e['Estação/Local']} - {e.ID}</option>)}</select><button className="btn" onClick={gerarPdfDrive}>Gerar PDF e guardar no Drive</button></section>}
 </main><p className="footer-note">EDF_Oeste · Autor RJP · Importa Excel do Drive e guarda tudo na conta Google</p></div>
}

createRoot(document.getElementById('root')).render(<App/>)
