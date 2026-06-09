
const APP_FOLDER = 'EDF_Oeste';
const EXCEL_FOLDER = 'Edificios Oeste';
const DB_NAME = 'EDF_Oeste_DB';

const SHEETS = {
  Edificios: ['ID','Pk','Localização','Utilização Principal'],
  Estacoes: ['Pk','Localização','Utilização Principal'],
  Classificacao: ['ID','Linha','Estação/Local','PK','Tipo de edifício','Uso atual','Estado global','Risco','Urgência','Intervenção recomendada','Data inspeção','Próxima inspeção','Fotos/Drive','Técnico'],
  Inspecoes: ['ID','EdificioID','Estação','Data','Categoria','Estado','Gravidade','Prazo','Responsável','Descrição','Ação','Custo','Fotos','Autor'],
  Fotos: ['ID','InspecaoID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],
  PDF: ['ID','EdificioID','Estação','Data','Nome','DriveID','Link','Autor'],
  Intervencoes: ['ID','EdificioID','Estação','Data','Tipo','Prioridade','Descrição','Estado','Custo','Autor'],
  Custos: ['ID','EdificioID','Estação','Data','Categoria','Valor','Observações','Autor'],
  Documentos: ['ID','EdificioID','Estação','Data','Tipo','Nome','DriveID','Link','Autor']
};

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const a = req.action || '';
    let result = { ok:false, error:'Ação desconhecida: '+a };
    if (a === 'ping') result = { ok:true, message:'EDF_Oeste Bridge OK' };
    if (a === 'ensureStructure') result = ensureStructure_();
    if (a === 'findExcelFiles') result = findExcelFiles_();
    if (a === 'importExcel') result = importExcel_();
    if (a === 'readDb') result = readDb_();
    if (a === 'append') result = append_(req);
    if (a === 'uploadFile') result = uploadFile_(req);
    if (a === 'createCalendarEvent') result = createCalendarEvent_(req);
    return json_(result);
  } catch (err) {
    return json_({ ok:false, error:String(err && err.stack ? err.stack : err) });
  }
}

function doGet() {
  return json_({ ok:true, app:'EDF_Oeste Bridge', message:'Use POST' });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder_(name, parent) {
  const it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function getMainDb_() {
  const root = getOrCreateFolder_(APP_FOLDER);
  const base = getOrCreateFolder_('Base_Dados', root);
  const sheetsFolder = getOrCreateFolder_('Sheets', base);
  const files = sheetsFolder.getFilesByName(DB_NAME);
  if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());
  const ss = SpreadsheetApp.create(DB_NAME);
  const file = DriveApp.getFileById(ss.getId());
  sheetsFolder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch(e) {}
  return ss;
}

function ensureStructure_() {
  const root = getOrCreateFolder_(APP_FOLDER);
  getOrCreateFolder_('Base_Dados', root);
  getOrCreateFolder_('Fotografias', root);
  getOrCreateFolder_('PDF', root);
  getOrCreateFolder_('Documentos', root);
  const ss = getMainDb_();
  ensureSheets_(ss);
  return { ok:true, rootFolderId:root.getId(), spreadsheetId:ss.getId(), spreadsheetUrl:ss.getUrl() };
}

function ensureSheets_(ss) {
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0 || !sh.getRange(1,1).getValue()) {
      sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    }
  });
}

function findExcelFiles_() {
  const folders = DriveApp.getFoldersByName(EXCEL_FOLDER);
  if (!folders.hasNext()) return { ok:false, error:'Pasta não encontrada: '+EXCEL_FOLDER };
  const folder = folders.next();
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const n = f.getName();
    if (n.toLowerCase().endsWith('.xlsx') || n.toLowerCase().endsWith('.xls')) {
      files.push({ id:f.getId(), name:n, modifiedTime:String(f.getLastUpdated()), webViewLink:f.getUrl() });
    }
  }
  return { ok:true, folderId:folder.getId(), files };
}

function importExcel_() {
  const found = findExcelFiles_();
  if (!found.ok) return found;
  const ss = getMainDb_();
  ensureSheets_(ss);
  let estacoes = [], edificios = [], classificacao = [];
  found.files.forEach(file => {
    const rows = readExcel_(file.id);
    const name = file.name.toLowerCase();
    if (name.indexOf('estações') >= 0 || name.indexOf('estacoes') >= 0) estacoes = normalizeEstacoes_(rows);
    else if (name.indexOf('lista') >= 0) edificios = normalizeLista_(rows);
    else if (name.indexOf('classificacao') >= 0 || name.indexOf('classificação') >= 0) classificacao = normalizeClassificacao_(rows);
  });
  if (estacoes.length) writeObjects_(ss.getSheetByName('Estacoes'), estacoes);
  if (edificios.length) writeObjects_(ss.getSheetByName('Edificios'), edificios);
  if (classificacao.length) writeObjects_(ss.getSheetByName('Classificacao'), classificacao);
  return { ok:true, files:found.files, estacoes, edificios, classificacao };
}

function readExcel_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const temp = Drive.Files.insert({ title:'tmp_'+file.getName(), mimeType:MimeType.GOOGLE_SHEETS }, blob);
  const ss = SpreadsheetApp.openById(temp.id);
  const values = ss.getSheets()[0].getDataRange().getValues();
  DriveApp.getFileById(temp.id).setTrashed(true);
  return valuesToObjects_(values);
}

function valuesToObjects_(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => String(h || '').trim());
  return values.slice(1).filter(r => r.some(Boolean)).map(row => {
    const o = {};
    headers.forEach((h,i) => o[h] = row[i] == null ? '' : row[i]);
    return o;
  });
}

function val_(o, keys) {
  for (let i=0; i<keys.length; i++) {
    const k = keys[i];
    if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return String(o[k]).trim();
  }
  return '';
}

function normalizeEstacoes_(rows) {
  return rows.map(r => ({ Pk:val_(r,['Pk','PK','pk']), 'Localização':val_(r,['Localização','Localizacao','Estação','Estacao']), 'Utilização Principal':val_(r,['Utilização Principal','Utilizacao Principal','Tipo']) })).filter(r => r.Pk || r['Localização']);
}

function normalizeLista_(rows) {
  return rows.map((r,i) => ({ ID:val_(r,['ID','Id','id']) || ('LO-'+(i+1)), Pk:val_(r,['Pk','PK','pk']), 'Localização':val_(r,['Localização','Localizacao','Estação','Estacao']), 'Utilização Principal':val_(r,['Utilização Principal','Utilizacao Principal','Tipo']) })).filter(r => r.ID || r.Pk || r['Localização']);
}

function normalizeClassificacao_(rows) {
  return rows.map((r,i) => ({ ID:val_(r,['ID','Id','id']) || ('CLASS-'+(i+1)), Linha:val_(r,['Linha']) || 'Linha do Oeste', 'Estação/Local':val_(r,['Estação/Local','Estação','Localização','Localizacao']), PK:val_(r,['PK','Pk','pk']), 'Tipo de edifício':val_(r,['Tipo de edifício','Tipo','Utilização Principal']), 'Uso atual':val_(r,['Uso atual','Utilização Principal']), 'Estado global':val_(r,['Estado global','Estado Global']) || 'A avaliar', Risco:val_(r,['Risco']), 'Urgência':val_(r,['Urgência','Urgencia']), 'Intervenção recomendada':val_(r,['Intervenção recomendada','Intervencao recomendada']), 'Data inspeção':val_(r,['Data inspeção','Data inspecao']), 'Próxima inspeção':val_(r,['Próxima inspeção','Proxima inspeção','Proxima inspecao']), 'Fotos/Drive':val_(r,['Fotos/Drive','Fotos Drive']), Técnico:val_(r,['Técnico','Tecnico']) || 'RJP' })).filter(r => r.ID || r['Estação/Local'] || r.PK);
}

function writeObjects_(sh, arr) {
  sh.clear();
  if (!arr.length) { sh.getRange(1,1).setValue('sem_dados'); return; }
  const keys = Object.keys(arr[0]);
  sh.getRange(1,1,1,keys.length).setValues([keys]);
  sh.getRange(2,1,arr.length,keys.length).setValues(arr.map(o => keys.map(k => o[k] || '')));
}

function readDb_() {
  const ss = getMainDb_();
  ensureSheets_(ss);
  return { ok:true, estacoes:valuesToObjects_(ss.getSheetByName('Estacoes').getDataRange().getValues()), edificios:valuesToObjects_(ss.getSheetByName('Edificios').getDataRange().getValues()), classificacao:valuesToObjects_(ss.getSheetByName('Classificacao').getDataRange().getValues()), inspecoes:valuesToObjects_(ss.getSheetByName('Inspecoes').getDataRange().getValues()), fotos:valuesToObjects_(ss.getSheetByName('Fotos').getDataRange().getValues()), pdfs:valuesToObjects_(ss.getSheetByName('PDF').getDataRange().getValues()) };
}

function append_(req) {
  const ss = getMainDb_();
  ensureSheets_(ss);
  const sh = ss.getSheetByName(req.sheet);
  appendObject_(sh, req.record || {});
  return { ok:true };
}

function appendObject_(sh, obj) {
  let headers = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].filter(String);
  if (!headers.length) { headers = Object.keys(obj); sh.getRange(1,1,1,headers.length).setValues([headers]); }
  sh.appendRow(headers.map(h => obj[h] || ''));
}

function uploadFile_(req) {
  const root = getOrCreateFolder_(APP_FOLDER);
  const station = getOrCreateFolder_(req.folderStation || 'Sem_Estacao', root);
  const sub = getOrCreateFolder_(req.subfolder || 'Documentos', station);
  const bytes = Utilities.base64Decode(req.base64);
  const blob = Utilities.newBlob(bytes, req.mimeType || 'application/octet-stream', req.fileName || 'ficheiro');
  const file = sub.createFile(blob);
  const record = Object.assign({ ID:Utilities.getUuid(), Data:new Date(), Nome:file.getName(), DriveID:file.getId(), Link:file.getUrl(), Autor:'RJP' }, req.meta || {});
  const ss = getMainDb_();
  ensureSheets_(ss);
  appendObject_(ss.getSheetByName((req.subfolder || '').toLowerCase() === 'pdf' ? 'PDF' : (req.subfolder || '').toLowerCase() === 'fotos' ? 'Fotos' : 'Documentos'), record);
  return { ok:true, fileId:file.getId(), link:file.getUrl(), record };
}

function createCalendarEvent_(req) {
  const ev = req.event || {};
  const date = ev.date ? new Date(ev.date + 'T09:00:00') : new Date();
  const end = new Date(date.getTime() + 60*60*1000);
  const event = CalendarApp.getDefaultCalendar().createEvent(ev.summary || 'EDF_Oeste', date, end, { description:ev.description || '' });
  return { ok:true, eventId:event.getId() };
}
