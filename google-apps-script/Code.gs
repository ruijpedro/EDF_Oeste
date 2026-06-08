/**
 * EDF_Oeste - Google Apps Script base
 * Autor: RJP
 */
const SHEET_EDIFICIOS = 'Edificios';
const SHEET_INSPECOES = 'Inspecoes';

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shEd = getSheet_(ss, SHEET_EDIFICIOS);
  const shIn = getSheet_(ss, SHEET_INSPECOES);
  shEd.clear();
  shIn.clear();
  writeObjects_(shEd, data.edificios || []);
  writeObjects_(shIn, data.inspecoes || []);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {
    app: 'EDF_Oeste',
    autor: 'RJP',
    edificios: readObjects_(getSheet_(ss, SHEET_EDIFICIOS)),
    inspecoes: readObjects_(getSheet_(ss, SHEET_INSPECOES))
  };
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeObjects_(sheet, arr) {
  if (!arr.length) {
    sheet.getRange(1, 1).setValue('sem_dados');
    return;
  }
  const keys = Array.from(arr.reduce((set, obj) => {
    Object.keys(obj).forEach(k => { if (k !== 'fotos') set.add(k); });
    return set;
  }, new Set()));
  sheet.getRange(1, 1, 1, keys.length).setValues([keys]);
  sheet.getRange(2, 1, arr.length, keys.length).setValues(arr.map(obj => keys.map(k => obj[k] ?? '')));
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2 || values[0][0] === 'sem_dados') return [];
  const keys = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    keys.forEach((k, i) => obj[k] = row[i]);
    return obj;
  });
}
