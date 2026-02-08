const SHEETS = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  SETTINGS: 'store_settings'
};

const HEADERS = {
  products: ['id', 'name', 'price', 'stock', 'is_available', 'image', 'category'],
  orders: ['order_id', 'timestamp', 'customer_name', 'items', 'total_price', 'shipping_fee', 'address', 'slip_url', 'trans_ref', 'status'],
  settings: ['shop_lat', 'shop_lng', 'flat_rate', 'distance_rate', 'admin_password']
};

const CONFIG = {
  thunderApiUrl: 'https://api.thundersolution.com/verify-slip',
  thunderApiKey: 'YOUR_THUNDER_API_KEY',
  lineNotifyUrl: 'https://notify-api.line.me/api/notify',
  lineNotifyToken: 'YOUR_LINE_NOTIFY_TOKEN'
};

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Minishop-v3')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function initialSetup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  setupSheet(spreadsheet, SHEETS.PRODUCTS, HEADERS.products);
  setupSheet(spreadsheet, SHEETS.ORDERS, HEADERS.orders);
  setupSheet(spreadsheet, SHEETS.SETTINGS, HEADERS.settings);
  const settingsSheet = spreadsheet.getSheetByName(SHEETS.SETTINGS);
  if (settingsSheet.getLastRow() === 1) {
    settingsSheet.appendRow([13.7563, 100.5018, 30, 10, 'admin123']);
  }
  return 'Setup complete';
}

function setupSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function getProducts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PRODUCTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row) => mapRow(headers, row));
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return {
      shop_lat: 0,
      shop_lng: 0,
      flat_rate: 0,
      distance_rate: 0,
      admin_password: ''
    };
  }
  const headers = values[0];
  const row = values[1];
  return mapRow(headers, row);
}

function submitOrder(payload) {
  const validation = validateOrderPayload(payload);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }

  const slipCheck = verifySlip(payload.slip_base64, payload.slip_mime);
  if (!slipCheck.success) {
    return { success: false, message: slipCheck.message };
  }

  const ordersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ORDERS);
  if (isDuplicateTransaction(ordersSheet, slipCheck.transRef)) {
    return { success: false, message: 'สลิปนี้ถูกใช้งานแล้ว' };
  }

  const orderId = `ORD-${new Date().getTime()}`;
  const timestamp = new Date();
  const items = JSON.stringify(payload.items);
  const slipUrl = slipCheck.slipUrl || '';
  const orderRow = [
    orderId,
    timestamp,
    payload.customer_name,
    items,
    payload.total_price,
    payload.shipping_fee,
    payload.address,
    slipUrl,
    slipCheck.transRef,
    'Pending'
  ];
  ordersSheet.appendRow(orderRow);

  sendLineNotify(orderId, payload, slipCheck);

  return { success: true, order_id: orderId };
}

function validateOrderPayload(payload) {
  if (!payload) return { valid: false, message: 'ข้อมูลไม่ถูกต้อง' };
  if (!payload.customer_name) return { valid: false, message: 'กรุณากรอกชื่อผู้รับ' };
  if (!payload.phone) return { valid: false, message: 'กรุณากรอกเบอร์โทรศัพท์' };
  if (!payload.address) return { valid: false, message: 'กรุณากรอกที่อยู่' };
  if (!payload.items || !payload.items.length) return { valid: false, message: 'ไม่มีสินค้าในคำสั่งซื้อ' };
  if (!payload.slip_base64) return { valid: false, message: 'ไม่พบสลิปโอนเงิน' };
  return { valid: true };
}

function verifySlip(base64, mimeType) {
  try {
    const response = UrlFetchApp.fetch(CONFIG.thunderApiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        image: base64,
        mimeType,
        apiKey: CONFIG.thunderApiKey
      }),
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (!result.success) {
      return { success: false, message: result.message || 'สลิปไม่ผ่านการตรวจสอบ' };
    }
    if (result.amount <= 0) {
      return { success: false, message: 'ยอดเงินไม่ถูกต้อง' };
    }
    return {
      success: true,
      amount: result.amount,
      transRef: result.trans_ref,
      slipUrl: result.slip_url
    };
  } catch (error) {
    return { success: false, message: 'ตรวจสอบสลิปไม่สำเร็จ' };
  }
}

function isDuplicateTransaction(sheet, transRef) {
  if (!transRef) return false;
  const values = sheet.getDataRange().getValues();
  const headerIndex = values[0].indexOf('trans_ref');
  if (headerIndex === -1) return false;
  return values.slice(1).some((row) => row[headerIndex] === transRef);
}

function sendLineNotify(orderId, payload, slipCheck) {
  if (!CONFIG.lineNotifyToken || CONFIG.lineNotifyToken === 'YOUR_LINE_NOTIFY_TOKEN') {
    return;
  }
  const message = [
    `ออเดอร์ใหม่ ${orderId}`,
    `ลูกค้า: ${payload.customer_name}`,
    `ยอดรวม: ${payload.total_price} บาท`,
    `ค่าส่ง: ${payload.shipping_fee} บาท`,
    `อ้างอิงสลิป: ${slipCheck.transRef}`
  ].join('\n');

  UrlFetchApp.fetch(CONFIG.lineNotifyUrl, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${CONFIG.lineNotifyToken}`
    },
    payload: {
      message
    }
  });
}

function updateOrderStatus(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ORDERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const orderIdIndex = headers.indexOf('order_id');
  const statusIndex = headers.indexOf('status');
  const rowIndex = values.findIndex((row, index) => index > 0 && row[orderIdIndex] === payload.order_id);
  if (rowIndex === -1) return { success: false, message: 'ไม่พบออเดอร์' };
  sheet.getRange(rowIndex + 1, statusIndex + 1).setValue(payload.status);
  return { success: true };
}

function updateProductAvailability(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PRODUCTS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('id');
  const availIndex = headers.indexOf('is_available');
  const rowIndex = values.findIndex((row, index) => index > 0 && row[idIndex] === payload.id);
  if (rowIndex === -1) return { success: false, message: 'ไม่พบสินค้า' };
  sheet.getRange(rowIndex + 1, availIndex + 1).setValue(payload.is_available ? 'TRUE' : 'FALSE');
  return { success: true };
}

function updateSettings(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  sheet.getRange(2, 1, 1, HEADERS.settings.length).setValues([[
    payload.shop_lat,
    payload.shop_lng,
    payload.flat_rate,
    payload.distance_rate,
    payload.admin_password
  ]]);
  return { success: true };
}

function getOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ORDERS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row) => mapRow(headers, row)).reverse();
}

function mapRow(headers, row) {
  const data = {};
  headers.forEach((header, index) => {
    data[header] = row[index];
  });
  return data;
}
