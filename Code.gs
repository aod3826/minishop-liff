// ==========================================
// MINI SHOP - STABLE PRODUCTION VERSION
// FIXED FOR REAL GOOGLE SHEET STRUCTURE
// ==========================================

// ===== CONFIG (แก้เฉพาะ 3 ค่านี้) =====
const MY_CONFIG = {
  LIFF_ID: '2008933274-cQhoTxw9',
  DOMAIN: 'aod3826.github.io',
  DEFAULT_ADMIN: 'U8d09ae220042d8e4638247158c759d7f'
};

// ===== SPREADSHEET ID =====
const SS_ID = '1t4KFuaxWGr_BtsD3pjXU9PimDdfAOGp89n4jS-YgTNA';

// ==========================================

const PROP = PropertiesService.getScriptProperties();
const TOKEN = PROP.getProperty('LINE_ACCESS_TOKEN') || '';
const FOLDER_ID = PROP.getProperty('DRIVE_FOLDER_ID') || '';
const MAPS_KEY = PROP.getProperty('MAPS_API_KEY') || '';

// ===== STAFF UID =====
let STAFF_UIDS = [];
try{
  const s = PROP.getProperty('STAFF_UIDS');
  STAFF_UIDS = s ? s.split(',').map(x=>x.trim()) : [MY_CONFIG.DEFAULT_ADMIN];
}catch(e){
  STAFF_UIDS=[MY_CONFIG.DEFAULT_ADMIN];
}

// ===== DB SCHEMA (MATCH YOUR SHEET) =====
const DB = {
  MENU:{NAME:0,PRICE:1,CATEGORY:2,IMAGE:3,INSTOCK:4},
  ORDERS:{
    TIME:0,NAME:1,PHONE:2,ADDR:3,ITEMS:4,
    TOTAL:5,SLIP:6,UID:7,OID:8,STATUS:9,
    QUEUE:10,PAYMETHOD:11,PAYSTATUS:12,NOTE:13
  },
  MEMBERS:{UID:0,NAME:1,POINTS:2,LAST:3}
};

// ==========================================
// CORE
// ==========================================

function ss(){
  return SpreadsheetApp.openById(SS_ID);
}

// ---------- RESPONSE ----------
function json(data,origin){
  const o = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  if(origin){
    o.setHeader("Access-Control-Allow-Origin",origin);
    o.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
    o.setHeader("Access-Control-Allow-Headers","Content-Type");
  }
  return o;
}

function doOptions(e){
  return json({ok:true},e.headers?.Origin);
}

// ---------- ROUTER ----------
function doGet(e){
  const o=e.headers?.Origin||'';
  const a=e.parameter?.action||'products';

  try{
    if(a==='getMember') return getMember(e.parameter.uid,e.parameter.name,o);
    if(a==='getOrders') return getOrders(o);
    if(a==='checkStaff') return json({isStaff:STAFF_UIDS.includes(e.parameter.uid)},o);
    return getProducts(o);
  }catch(err){
    return json({error:err.message},o);
  }
}

function doPost(e){
  const o=e.headers?.Origin||'';
  const d=JSON.parse(e.postData.contents||'{}');

  try{
    if(d.action==='submitOrder') return json(submitOrder(d),o);
    if(d.action==='updateStatus') return json(updateStatus(d),o);
    return json({error:'Unknown action'},o);
  }catch(err){
    return json({error:err.message},o);
  }
}

// ==========================================
// PRODUCTS
// ==========================================

function getProducts(origin){
  const sh=ss().getSheetByName('Menu');
  if(!sh) return json([],origin);

  const rows=sh.getDataRange().getValues();
  const res=[];
  for(let i=1;i<rows.length;i++){
    if(!rows[i][0]) continue;
    res.push({
      name:rows[i][0],
      price:Number(rows[i][1]),
      category:rows[i][2],
      img:rows[i][3],
      inStock:String(rows[i][4]).toLowerCase()==='true'
    });
  }
  return json(res,origin);
}

// ==========================================
// MEMBER
// ==========================================

function getMember(uid,name,origin){
  if(!uid) return json({points:0,rank:'Guest'},origin);

  const sh=ss().getSheetByName('Members');
  const rows=sh.getDataRange().getValues();

  for(let i=1;i<rows.length;i++){
    if(rows[i][0]===uid){
      return json({
        points:rows[i][2]||0,
        rank:getRank(rows[i][2]||0),
        name:rows[i][1]
      },origin);
    }
  }

  sh.appendRow([uid,name||'ลูกค้าใหม่',0,new Date()]);
  return json({points:0,rank:'New'},origin);
}

// ==========================================
// ORDER
// ==========================================

function submitOrder(d){
  if(!d.name||!d.phone||!Array.isArray(d.items))
    throw new Error('ข้อมูลไม่ครบ');

  const sh=ss().getSheetByName('Orders');
  const id='MS-'+Date.now();

  let slip='';
  if(d.image&&FOLDER_ID){
    const blob=Utilities.newBlob(
      Utilities.base64Decode(d.image),
      d.mimeType||'image/jpeg',
      id+'.jpg'
    );
    slip=DriveApp.getFolderById(FOLDER_ID).createFile(blob).getUrl();
  }

  sh.appendRow([
    new Date(),
    d.name,
    `'${d.phone}`,
    d.address||'',
    JSON.stringify(d.items),
    Number(d.total)||0,
    slip,
    d.uid||'guest',
    id,
    'รอดำเนินการ',
    '',
    d.paymentMethod||'',
    'UNPAID',
    d.note||''
  ]);

  const pts=d.uid?updatePoints(d.uid,d.name,d.total):0;

  return {result:'success',orderId:id,points:pts};
}

// ==========================================
// UPDATE STATUS
// ==========================================

function updateStatus(d){
  if(!STAFF_UIDS.includes(d.uid))
    throw new Error('No permission');

  const sh=ss().getSheetByName('Orders');
  const rows=sh.getDataRange().getValues();

  for(let i=1;i<rows.length;i++){
    if(rows[i][8]===d.orderId){
      sh.getRange(i+1,10).setValue(d.newStatus);
      return {result:'success'};
    }
  }
  throw new Error('Order not found');
}

// ==========================================
// HELPERS
// ==========================================

function updatePoints(uid,name,amount){
  const sh=ss().getSheetByName('Members');
  const rows=sh.getDataRange().getValues();
  const pts=Math.floor(amount/10);

  for(let i=1;i<rows.length;i++){
    if(rows[i][0]===uid){
      sh.getRange(i+1,3).setValue((rows[i][2]||0)+pts);
      sh.getRange(i+1,4).setValue(new Date());
      return pts;
    }
  }
  sh.appendRow([uid,name,pts,new Date()]);
  return pts;
}

function getOrders(origin){
  const sh=ss().getSheetByName('Orders');
  const rows=sh.getDataRange().getValues();
  const out=[];

  for(let i=rows.length-1;i>0;i--){
    out.push({
      id:rows[i][8],
      name:rows[i][1],
      total:rows[i][5],
      status:rows[i][9]
    });
  }
  return json(out,origin);
}

function getRank(p){
  if(p>=1000) return 'VIP';
  if(p>=100) return 'Member';
  return 'New';
}
