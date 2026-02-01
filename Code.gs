// ==========================================
// MINI SHOP - COMPLETE PRODUCTION VERSION
// FULLY COMPATIBLE WITH INDEX.HTML
// ==========================================

// ===== CONFIGURATION =====
const CONFIG = {
  LIFF_ID: '2008933274-cQhoTxw9',
  DOMAIN: 'https://aod3826.github.io',
  DEFAULT_ADMIN: 'U8d09ae220042d8e4638247158c759d7f',
  GOOGLE_SHEET_ID: '1t4KFuaxWGr_BtsD3pjXU9PimDdfAOGp89n4jS-YgTNA'
};

// ===== SCRIPT PROPERTIES =====
const PROP = PropertiesService.getScriptProperties();

// สร้าง default properties ถ้ายังไม่มี
function setupProperties() {
  if (!PROP.getProperty('DRIVE_FOLDER_ID')) {
    // สร้างโฟลเดอร์ใหม่ใน Google Drive
    const folder = DriveApp.createFolder('MiniShop_Slips_' + new Date().getTime());
    PROP.setProperty('DRIVE_FOLDER_ID', folder.getId());
    console.log('Created new folder:', folder.getId());
  }
  
  if (!PROP.getProperty('MAPS_API_KEY')) {
    PROP.setProperty('MAPS_API_KEY', 'AIzaSyB9dZ4K42q5Q9Yv7W4Q8q3L6k7M8J9N0P1'); // Placeholder key
  }
  
  if (!PROP.getProperty('LINE_ACCESS_TOKEN')) {
    PROP.setProperty('LINE_ACCESS_TOKEN', 'YOUR_LINE_ACCESS_TOKEN');
  }
  
  // STAFF UIDs
  const staffUids = [CONFIG.DEFAULT_ADMIN];
  PROP.setProperty('STAFF_UIDS', staffUids.join(','));
}

// ===== INITIAL SETUP =====
function doSetup() {
  setupProperties();
  console.log('Setup completed');
  return {
    success: true,
    message: 'Setup completed successfully',
    folderId: PROP.getProperty('DRIVE_FOLDER_ID')
  };
}

// ===== SPREADSHEET FUNCTIONS =====
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(CONFIG.GOOGLE_SHEET_ID);
  } catch (error) {
    console.error('Error opening spreadsheet:', error);
    // สร้าง spreadsheet ใหม่ถ้าไม่มี
    return createNewSpreadsheet();
  }
}

function createNewSpreadsheet() {
  console.log('Creating new spreadsheet...');
  
  const ss = SpreadsheetApp.create('MiniShop_Data_' + new Date().getTime());
  
  // สร้าง sheet เมนู
  const menuSheet = ss.insertSheet('Menu');
  menuSheet.getRange('A1:E1').setValues([['ชื่อเมนู', 'ราคา', 'หมวดหมู่', 'รูปภาพ', 'มีสต็อก']]);
  menuSheet.getRange('A2:E7').setValues([
    ['ข้าวผัดกระเพรา', 50, 'อาหารจานเดียว', 'https://img.wongnai.com/p/1920x0/2021/08/17/d47d0571d98b4e6eb5935ef3cfac5e1d.jpg', 'TRUE'],
    ['ผัดไทย', 60, 'อาหารจานเดียว', 'https://img.wongnai.com/p/1920x0/2019/01/30/1484fec4a4264e319b8809a6b98d9c18.jpg', 'TRUE'],
    ['ต้มยำกุ้ง', 120, 'อาหารตามสั่ง', 'https://img.wongnai.com/p/1920x0/2017/11/08/2e823850f6414ca4bd2caece2ecdd3e7.jpg', 'TRUE'],
    ['ส้มตำไทย', 40, 'อาหารว่าง', 'https://img.wongnai.com/p/1920x0/2018/02/13/8d4e648b4323433b916a5d56e4ec85bd.jpg', 'TRUE'],
    ['น้ำมะพร้าว', 25, 'เครื่องดื่ม', 'https://img.wongnai.com/p/1920x0/2022/04/13/1ce702b23f81452f88b119e4a2d6e9c6.jpg', 'TRUE'],
    ['โค้ก', 20, 'เครื่องดื่ม', 'https://img.wongnai.com/p/1920x0/2018/10/03/ff7cd04a57c94f228d5f5c74f701a7e7.jpg', 'FALSE']
  ]);
  menuSheet.setFrozenRows(1);
  
  // สร้าง sheet ออเดอร์
  const ordersSheet = ss.insertSheet('Orders');
  ordersSheet.getRange('A1:N1').setValues([[
    'Timestamp', 'ชื่อ', 'โทรศัพท์', 'ที่อยู่', 'รายการ', 
    'ยอดรวม', 'สลิป', 'User ID', 'Order ID', 'สถานะ',
    'คิว', 'วิธีการชำระ', 'สถานะชำระ', 'หมายเหตุ'
  ]]);
  ordersSheet.setFrozenRows(1);
  
  // สร้าง sheet สมาชิก
  const membersSheet = ss.insertSheet('Members');
  membersSheet.getRange('A1:D1').setValues([['User ID', 'ชื่อ', 'คะแนน', 'อัปเดตล่าสุด']]);
  membersSheet.setFrozenRows(1);
  
  // ลบ sheet เริ่มต้น
  ss.deleteSheet(ss.getSheetByName('Sheet1'));
  
  // Share the spreadsheet (optional)
  ss.addEditor(Session.getEffectiveUser().getEmail());
  
  console.log('New spreadsheet created:', ss.getId());
  return ss;
}

// ===== CORS HEADERS =====
function setCorsHeaders(response, origin) {
  const allowedOrigins = [
    'https://aod3826.github.io',
    'http://localhost',
    'http://127.0.0.1'
  ];
  
  const responseOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  response.setHeader('Access-Control-Allow-Origin', responseOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin');
  response.setHeader('Access-Control-Max-Age', '3600');
  
  return response;
}

function createJsonResponse(data, origin) {
  const response = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  return setCorsHeaders(response, origin);
}

// ===== ROUTER =====
function doGet(e) {
  console.log('GET Request:', e);
  
  const origin = e.headers && e.headers.Origin ? e.headers.Origin : 
                 e.headers && e.headers.origin ? e.headers.origin : '*';
  
  const action = e.parameter.action;
  console.log('Action:', action);
  
  try {
    switch(action) {
      case 'getProducts':
        return createJsonResponse(getProducts(), origin);
      
      case 'getMember':
        const uid = e.parameter.uid;
        const name = e.parameter.name;
        return createJsonResponse(getMember(uid, name), origin);
      
      case 'checkStaff':
        return createJsonResponse({ 
          isStaff: isStaffUser(e.parameter.uid) 
        }, origin);
      
      case 'getOrders':
        return createJsonResponse(getOrders(), origin);
      
      case 'getAdminOrders':
        return createJsonResponse(getAdminOrders(), origin);
      
      case 'getOwnerStats':
        return createJsonResponse(getOwnerStats(), origin);
      
      case 'getMapsKey':
        return createJsonResponse({ 
          key: PROP.getProperty('MAPS_API_KEY') || '' 
        }, origin);
      
      case 'setup':
        return createJsonResponse(doSetup(), origin);
      
      default:
        return createJsonResponse({ 
          status: 'ok', 
          message: 'MiniShop API is running',
          version: '2.0',
          timestamp: new Date().toISOString(),
          endpoints: [
            'getProducts',
            'getMember',
            'checkStaff',
            'getOrders',
            'getAdminOrders',
            'getOwnerStats',
            'getMapsKey',
            'setup'
          ]
        }, origin);
    }
  } catch (error) {
    console.error('GET Error:', error);
    return createJsonResponse({
      error: true,
      message: error.toString(),
      stack: error.stack
    }, origin);
  }
}

function doPost(e) {
  console.log('POST Request received');
  
  const origin = e.headers && e.headers.Origin ? e.headers.Origin : 
                 e.headers && e.headers.origin ? e.headers.origin : '*';
  
  try {
    const data = JSON.parse(e.postData.contents);
    console.log('POST Data:', data);
    
    const action = data.action;
    
    switch(action) {
      case 'submitOrder':
        return createJsonResponse(submitOrder(data), origin);
      
      case 'updateStatus':
        return createJsonResponse(updateOrderStatus(data), origin);
      
      case 'addProduct':
        return createJsonResponse(addProduct(data), origin);
      
      default:
        return createJsonResponse({
          error: 'Unknown action',
          received: action
        }, origin);
    }
    
  } catch (error) {
    console.error('POST Error:', error);
    return createJsonResponse({
      error: true,
      message: error.toString()
    }, origin);
  }
}

// สำหรับ CORS preflight
function doOptions(e) {
  const origin = e.headers && e.headers.Origin ? e.headers.Origin : 
                 e.headers && e.headers.origin ? e.headers.origin : '*';
  
  const response = ContentService.createTextOutput('');
  return setCorsHeaders(response, origin);
}

// ===== PRODUCT FUNCTIONS =====
function getProducts() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Menu');
    
    if (!sheet) {
      console.log('Menu sheet not found, creating default data');
      return getDefaultProducts();
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return getDefaultProducts();
    }
    
    const products = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // มีชื่อเมนู
        products.push({
          name: String(row[0] || ''),
          price: parseFloat(row[1]) || 0,
          category: String(row[2] || 'อื่นๆ'),
          img: String(row[3] || 'https://via.placeholder.com/300x200?text=No+Image'),
          inStock: String(row[4] || 'true').toLowerCase() === 'true'
        });
      }
    }
    
    console.log(`Returning ${products.length} products`);
    return products;
    
  } catch (error) {
    console.error('Error getting products:', error);
    return getDefaultProducts();
  }
}

function getDefaultProducts() {
  return [
    {
      name: "ข้าวผัดกระเพรา",
      price: 50,
      category: "อาหารจานเดียว",
      img: "https://img.wongnai.com/p/1920x0/2021/08/17/d47d0571d98b4e6eb5935ef3cfac5e1d.jpg",
      inStock: true
    },
    {
      name: "ผัดไทย",
      price: 60,
      category: "อาหารจานเดียว",
      img: "https://img.wongnai.com/p/1920x0/2019/01/30/1484fec4a4264e319b8809a6b98d9c18.jpg",
      inStock: true
    },
    {
      name: "ต้มยำกุ้ง",
      price: 120,
      category: "อาหารตามสั่ง",
      img: "https://img.wongnai.com/p/1920x0/2017/11/08/2e823850f6414ca4bd2caece2ecdd3e7.jpg",
      inStock: true
    },
    {
      name: "ส้มตำไทย",
      price: 40,
      category: "อาหารว่าง",
      img: "https://img.wongnai.com/p/1920x0/2018/02/13/8d4e648b4323433b916a5d56e4ec85bd.jpg",
      inStock: true
    },
    {
      name: "น้ำมะพร้าว",
      price: 25,
      category: "เครื่องดื่ม",
      img: "https://img.wongnai.com/p/1920x0/2022/04/13/1ce702b23f81452f88b119e4a2d6e9c6.jpg",
      inStock: true
    },
    {
      name: "โค้ก",
      price: 20,
      category: "เครื่องดื่ม",
      img: "https://img.wongnai.com/p/1920x0/2018/10/03/ff7cd04a57c94f228d5f5c74f701a7e7.jpg",
      inStock: false
    }
  ];
}

function addProduct(data) {
  if (!isStaffUser(data.uid)) {
    throw new Error('Unauthorized');
  }
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Menu');
  
  sheet.appendRow([
    data.name,
    parseFloat(data.price),
    data.category || 'อื่นๆ',
    data.img || 'https://via.placeholder.com/300x200?text=No+Image',
    data.inStock ? 'TRUE' : 'FALSE'
  ]);
  
  return { success: true, message: 'Product added' };
}

// ===== MEMBER FUNCTIONS =====
function getMember(uid, name) {
  if (!uid) {
    return {
      points: 0,
      rank: 'Guest',
      name: 'Guest'
    };
  }
  
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Members');
    
    if (!sheet) {
      // สร้างสมาชิกใหม่
      return createNewMember(uid, name);
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === uid) {
        return {
          points: parseInt(row[2]) || 0,
          rank: getRankFromPoints(parseInt(row[2]) || 0),
          name: String(row[1] || name || 'สมาชิก')
        };
      }
    }
    
    // ไม่พบสมาชิก สร้างใหม่
    return createNewMember(uid, name);
    
  } catch (error) {
    console.error('Error getting member:', error);
    return {
      points: 0,
      rank: 'New',
      name: name || 'สมาชิกใหม่'
    };
  }
}

function createNewMember(uid, name) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Members');
    
    if (!sheet) {
      // สร้าง sheet Members ถ้าไม่มี
      const newSheet = ss.insertSheet('Members');
      newSheet.getRange('A1:D1').setValues([['User ID', 'ชื่อ', 'คะแนน', 'อัปเดตล่าสุด']]);
    }
    
    const memberSheet = ss.getSheetByName('Members');
    memberSheet.appendRow([
      uid,
      name || 'ลูกค้าใหม่',
      0,
      new Date()
    ]);
    
    return {
      points: 0,
      rank: 'New',
      name: name || 'ลูกค้าใหม่'
    };
    
  } catch (error) {
    console.error('Error creating new member:', error);
    return {
      points: 0,
      rank: 'New',
      name: name || 'ลูกค้าใหม่'
    };
  }
}

function getRankFromPoints(points) {
  if (points >= 1000) return 'Super VIP 👑';
  if (points >= 500) return 'VIP ⭐';
  if (points >= 100) return 'Regular 🎯';
  return 'New 🆕';
}

function updateMemberPoints(uid, name, amount) {
  const pointsEarned = Math.floor(amount / 10); // ได้ 1 คะแนนทุก 10 บาท
  
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Members');
    
    if (!sheet) {
      createNewMember(uid, name);
      return pointsEarned;
    }
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === uid) {
        const currentPoints = parseInt(row[2]) || 0;
        const newPoints = currentPoints + pointsEarned;
        
        sheet.getRange(i + 1, 3).setValue(newPoints); // คอลัมน์คะแนน
        sheet.getRange(i + 1, 4).setValue(new Date()); // คอลัมน์อัปเดตล่าสุด
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow([
        uid,
        name || 'ลูกค้าใหม่',
        pointsEarned,
        new Date()
      ]);
    }
    
    return pointsEarned;
    
  } catch (error) {
    console.error('Error updating member points:', error);
    return pointsEarned;
  }
}

// ===== ORDER FUNCTIONS =====
function submitOrder(data) {
  console.log('Submitting order:', data);
  
  // Validation
  if (!data.name || !data.phone || !data.items || !data.total) {
    throw new Error('ข้อมูลไม่ครบถ้วน');
  }
  
  // Generate Order ID
  const orderId = 'MS-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  
  // Upload slip image
  let slipUrl = '';
  if (data.image && data.mimeType) {
    slipUrl = uploadSlipImage(data.image, data.mimeType, orderId);
  }
  
  // Prepare items string
  let itemsString = '';
  if (Array.isArray(data.items)) {
    itemsString = data.items.map(item => {
      if (typeof item === 'string') return item;
      return `${item.name} x${item.quantity}`;
    }).join(', ');
  } else {
    itemsString = String(data.items);
  }
  
  // Save to Google Sheets
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  
  if (!sheet) {
    // สร้าง sheet Orders ถ้าไม่มี
    const newSheet = ss.insertSheet('Orders');
    newSheet.getRange('A1:N1').setValues([[
      'Timestamp', 'ชื่อ', 'โทรศัพท์', 'ที่อยู่', 'รายการ', 
      'ยอดรวม', 'สลิป', 'User ID', 'Order ID', 'สถานะ',
      'คิว', 'วิธีการชำระ', 'สถานะชำระ', 'หมายเหตุ'
    ]]);
  }
  
  const ordersSheet = ss.getSheetByName('Orders');
  ordersSheet.appendRow([
    new Date(),
    data.name,
    `'${data.phone}`, // เพิ่ม ' เพื่อป้องกันไม่ให้ Google Sheets แปลงเป็นตัวเลข
    data.address || '',
    itemsString,
    parseFloat(data.total),
    slipUrl,
    data.uid || 'guest',
    orderId,
    'รอดำเนินการ', // สถานะเริ่มต้น
    '', // คิว
    data.paymentMethod || 'โอนเงิน',
    'รอตรวจสอบ', // สถานะชำระเงิน
    data.note || ''
  ]);
  
  // Update member points
  const pointsEarned = updateMemberPoints(data.uid, data.name, parseFloat(data.total));
  
  // Send notification (optional)
  try {
    sendOrderNotification(orderId, data.name, data.total);
  } catch (notifError) {
    console.log('Notification error (not critical):', notifError);
  }
  
  return {
    result: 'success',
    orderId: orderId,
    points: pointsEarned,
    message: 'Order submitted successfully'
  };
}

function uploadSlipImage(base64Data, mimeType, orderId) {
  try {
    const folderId = PROP.getProperty('DRIVE_FOLDER_ID');
    if (!folderId) {
      console.log('No folder ID set, skipping slip upload');
      return '';
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType,
      `slip_${orderId}.${mimeType.split('/')[1] || 'jpg'}`
    );
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    console.log('Slip uploaded:', file.getUrl());
    return file.getUrl();
    
  } catch (error) {
    console.error('Error uploading slip:', error);
    return 'Error Uploading';
  }
}

function getOrders() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Orders');
    
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }
    
    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[8]) { // มี Order ID
        orders.push({
          id: String(row[8]),
          name: String(row[1]),
          total: parseFloat(row[5]) || 0,
          status: String(row[9] || 'รอดำเนินการ'),
          timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
          items: String(row[4]),
          phone: String(row[2]),
          address: String(row[3]),
          slip: String(row[6])
        });
      }
    }
    
    // เรียงลำดับจากล่าสุดไปเก่าสุด
    return orders.reverse();
    
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
}

function getAdminOrders() {
  const orders = getOrders();
  
  // เพิ่มข้อมูลสำหรับ admin dashboard
  return orders.map(order => ({
    'Order ID': order.id,
    'Name': order.name,
    'Total': order.total,
    'Status': order.status,
    'Timestamp': order.timestamp,
    'Items': order.items,
    'SlipURL': order.slip
  }));
}

function updateOrderStatus(data) {
  if (!isStaffUser(data.uid)) {
    throw new Error('Unauthorized: Staff access required');
  }
  
  if (!data.orderId || !data.newStatus) {
    throw new Error('Missing orderId or newStatus');
  }
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  
  if (!sheet) {
    throw new Error('Orders sheet not found');
  }
  
  const dataRange = sheet.getDataRange().getValues();
  let updated = false;
  
  for (let i = 1; i < dataRange.length; i++) {
    const row = dataRange[i];
    if (String(row[8]) === data.orderId) { // คอลัมน์ Order ID
      sheet.getRange(i + 1, 10).setValue(data.newStatus); // คอลัมน์สถานะ (column J)
      updated = true;
      
      // อัปเดตเวลาอัตโนมัติเมื่อเปลี่ยนสถานะเป็น "เสร็จสิ้น"
      if (data.newStatus === 'เสร็จสิ้น') {
        sheet.getRange(i + 1, 1).setValue(new Date());
      }
      
      break;
    }
  }
  
  if (!updated) {
    throw new Error('Order not found');
  }
  
  return { success: true, message: 'Order status updated' };
}

// ===== STATISTICS FUNCTIONS =====
function getOwnerStats() {
  try {
    const orders = getOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ยอดขายวันนี้
    const todaySales = orders
      .filter(order => {
        const orderDate = new Date(order.timestamp);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      })
      .reduce((sum, order) => sum + order.total, 0);
    
    // ออเดอร์ทั้งหมด
    const totalOrders = orders.length;
    
    // ยอดขายที่รับแล้ว (สถานะเสร็จสิ้น)
    const realizedRevenue = orders
      .filter(order => order.status === 'เสร็จสิ้น')
      .reduce((sum, order) => sum + order.total, 0);
    
    // ยอดขายรอดำเนินการ
    const pendingRevenue = orders
      .filter(order => order.status === 'รอดำเนินการ' || order.status === 'กำลังทำอาหาร')
      .reduce((sum, order) => sum + order.total, 0);
    
    // เมนูขายดี
    const menuStats = {};
    orders.forEach(order => {
      // แยกรายการสินค้า
      const items = order.items.split(', ');
      items.forEach(item => {
        const match = item.match(/^(.*?)\s*x?(\d+)?$/);
        if (match) {
          const menuName = match[1].trim();
          const count = parseInt(match[2]) || 1;
          
          if (menuStats[menuName]) {
            menuStats[menuName] += count;
          } else {
            menuStats[menuName] = count;
          }
        }
      });
    });
    
    // เรียงลำดับเมนูขายดี
    const topMenus = Object.entries(menuStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      todaySales: todaySales,
      totalOrders: totalOrders,
      realizedRevenue: realizedRevenue,
      pendingRevenue: pendingRevenue,
      topMenus: topMenus,
      currency: 'THB'
    };
    
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      todaySales: 0,
      totalOrders: 0,
      realizedRevenue: 0,
      pendingRevenue: 0,
      topMenus: [],
      currency: 'THB'
    };
  }
}

// ===== HELPER FUNCTIONS =====
function isStaffUser(uid) {
  const staffUids = PROP.getProperty('STAFF_UIDS');
  if (!staffUids) {
    return uid === CONFIG.DEFAULT_ADMIN;
  }
  
  const staffList = staffUids.split(',').map(id => id.trim());
  return staffList.includes(uid);
}

function sendOrderNotification(orderId, customerName, total) {
  try {
    const lineToken = PROP.getProperty('LINE_ACCESS_TOKEN');
    if (!lineToken || lineToken === 'YOUR_LINE_ACCESS_TOKEN') {
      return; // ไม่ส่งถ้าไม่มี token
    }
    
    const message = `🛒 มีออเดอร์ใหม่!\n\n` +
                   `เลขที่: ${orderId}\n` +
                   `ลูกค้า: ${customerName}\n` +
                   `ยอดรวม: ${total} บาท\n` +
                   `เวลา: ${new Date().toLocaleString('th-TH')}`;
    
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + lineToken
      },
      payload: JSON.stringify({
        to: CONFIG.DEFAULT_ADMIN,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    };
    
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    
  } catch (error) {
    console.error('Line notification error:', error);
  }
}

// ===== TEST FUNCTIONS =====
function testAllFunctions() {
  console.log('=== Testing MiniShop Functions ===');
  
  try {
    // Test 1: Setup
    console.log('Test 1: Setup');
    const setupResult = doSetup();
    console.log('Setup:', setupResult);
    
    // Test 2: Get Products
    console.log('Test 2: Get Products');
    const products = getProducts();
    console.log('Products found:', products.length);
    
    // Test 3: Get Member
    console.log('Test 3: Get Member');
    const member = getMember('test_user_123', 'Test User');
    console.log('Member:', member);
    
    // Test 4: Get Orders
    console.log('Test 4: Get Orders');
    const orders = getOrders();
    console.log('Orders found:', orders.length);
    
    // Test 5: Get Stats
    console.log('Test 5: Get Stats');
    const stats = getOwnerStats();
    console.log('Stats:', stats);
    
    // Test 6: Staff Check
    console.log('Test 6: Staff Check');
    const isStaff = isStaffUser(CONFIG.DEFAULT_ADMIN);
    console.log('Is staff:', isStaff);
    
    console.log('=== All Tests Completed ===');
    return {
      success: true,
      tests: ['setup', 'products', 'member', 'orders', 'stats', 'staff'],
      results: {
        products: products.length,
        orders: orders.length,
        member: member,
        stats: stats,
        isStaff: isStaff
      }
    };
    
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ===== DEPLOYMENT HELPERS =====
function getDeploymentUrl() {
  const webAppUrl = ScriptApp.getService().getUrl();
  console.log('Web App URL:', webAppUrl);
  return webAppUrl;
}

function updateWebApp() {
  console.log('Creating new deployment...');
  return {
    url: getDeploymentUrl(),
    timestamp: new Date().toISOString()
  };
}
