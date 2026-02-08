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

const APP = {
  thunderApiUrl: 'https://api.thundersolution.com/verify-slip',
  lineNotifyUrl: 'https://notify-api.line.me/api/notify',
  lineVerifyUrl: 'https://api.line.me/oauth2/v2.1/verify'
};

const ENV_KEYS = {
  LIFF_ID: 'LIFF_ID',
  GOOGLE_MAPS_KEY: 'GOOGLE_MAPS_KEY',
  LINE_CHANNEL_ID: 'LINE_CHANNEL_ID',
  THUNDER_API_KEY: 'THUNDER_API_KEY',
  LINE_NOTIFY_TOKEN: 'LINE_NOTIFY_TOKEN'
};

function getEnv() {
  return (PropertiesService.getScriptProperties().getProperty('APP_ENV') || 'dev').toLowerCase();
}

function getEnvProperty(baseKey) {
  const envSuffix = getEnv().toUpperCase();
  return PropertiesService.getScriptProperties().getProperty(`${baseKey}_${envSuffix}`) || '';
}

function getPublicConfig() {
  return {
    liffId: getEnvProperty(ENV_KEYS.LIFF_ID),
    googleMapsKey: getEnvProperty(ENV_KEYS.GOOGLE_MAPS_KEY),
    env: getEnv()
  };
}

function assertAuth(payload) {
  if (!payload || !payload.auth || !payload.auth.idToken || !payload.auth.userId) {
    return { ok: false, message: 'ต้องยืนยันตัวตนผ่าน LINE LIFF' };
  }
  return verifyLiffToken(payload.auth.idToken, payload.auth.userId);
}

function assertAdmin(payload) {
  const auth = assertAuth(payload);
  if (!auth.ok) return auth;
  const settings = getSettingsInternal();
  if (!payload.admin_password || payload.admin_password !== settings.admin_password) {
    return { ok: false, message: 'รหัสผ่านผู้ดูแลไม่ถูกต้อง' };
  }
  return { ok: true };
}

function verifyLiffToken(idToken, userId) {
  const channelId = getEnvProperty(ENV_KEYS.LINE_CHANNEL_ID);
  if (!channelId) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า LINE Channel ID' };
  }
  try {
    const response = UrlFetchApp.fetch(APP.lineVerifyUrl, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: `id_token=${encodeURIComponent(idToken)}&client_id=${encodeURIComponent(channelId)}`,
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200 || !result.sub) {
      return { ok: false, message: 'ไม่สามารถยืนยันตัวตน LINE ได้' };
    }
    if (result.sub !== userId) {
      return { ok: false, message: 'ข้อมูลผู้ใช้ไม่ตรงกัน' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: 'ตรวจสอบตัวตนล้มเหลว' };
  }
}

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

function getProducts(payload) {
  const auth = assertAuth(payload);
  if (!auth.ok) throw new Error(auth.message);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PRODUCTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row) => mapRow(headers, row));
}

function getSettings(payload) {
  const auth = assertAuth(payload);
  if (!auth.ok) throw new Error(auth.message);
  const settings = getSettingsInternal();
  return {
    shop_lat: settings.shop_lat,
    shop_lng: settings.shop_lng,
    flat_rate: settings.flat_rate,
    distance_rate: settings.distance_rate
  };
}

function getSettingsInternal() {
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

function verifyAdminLogin(payload) {
  const auth = assertAuth(payload);
  if (!auth.ok) throw new Error(auth.message);
  if (!payload || !payload.password) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' };
  }
  const settings = getSettingsInternal();
  if (payload.password !== settings.admin_password) {
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  }
  return { success: true };
}

function submitOrder(payload) {
  const auth = assertAuth(payload);
  if (!auth.ok) throw new Error(auth.message);
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
  const thunderApiKey = getEnvProperty(ENV_KEYS.THUNDER_API_KEY);
  if (!thunderApiKey) {
    return { success: false, message: 'ยังไม่ได้ตั้งค่า Thunder API Key' };
  }
  try {
    const response = UrlFetchApp.fetch(APP.thunderApiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        image: base64,
        mimeType,
        apiKey: thunderApiKey
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
  const lineNotifyToken = getEnvProperty(ENV_KEYS.LINE_NOTIFY_TOKEN);
  if (!lineNotifyToken) {
    return;
  }
  const message = [
    `ออเดอร์ใหม่ ${orderId}`,
    `ลูกค้า: ${payload.customer_name}`,
    `ยอดรวม: ${payload.total_price} บาท`,
    `ค่าส่ง: ${payload.shipping_fee} บาท`,
    `อ้างอิงสลิป: ${slipCheck.transRef}`
  ].join('\n');

  UrlFetchApp.fetch(APP.lineNotifyUrl, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${lineNotifyToken}`
    },
    payload: {
      message
    }
  });
}

function updateOrderStatus(payload) {
  const admin = assertAdmin(payload);
  if (!admin.ok) throw new Error(admin.message);
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
  const admin = assertAdmin(payload);
  if (!admin.ok) throw new Error(admin.message);
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
  const admin = assertAdmin(payload);
  if (!admin.ok) throw new Error(admin.message);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  const current = getSettingsInternal();
  const adminPassword = payload.new_admin_password || current.admin_password;
  sheet.getRange(2, 1, 1, HEADERS.settings.length).setValues([[
    payload.shop_lat,
    payload.shop_lng,
    payload.flat_rate,
    payload.distance_rate,
    adminPassword
  ]]);
  return { success: true };
}

function getOrders(payload) {
  const admin = assertAdmin(payload);
  if (!admin.ok) throw new Error(admin.message);
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
