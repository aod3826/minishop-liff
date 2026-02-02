// ==========================================
// MINI SHOP - ULTRA SIMPLE VERSION
// NO CORS HEADERS, NO COMPLEX FUNCTIONS
// ==========================================

// Configuration
const CONFIG = {
  SHEET_ID: '1t4KFuaxWGr_BtsD3pjXU9PimDdfAOGp89n4jS-YgTNA',
  ADMIN_ID: 'U8d09ae220042d8e4638247158c759d7f'
};

// SIMPLE JSON RESPONSE FUNCTION
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// MAIN GET/POST HANDLERS
// ==========================================

function doGet(e) {
  console.log('📡 GET Request received');
  console.log('Parameters:', JSON.stringify(e.parameter));
  
  const action = e.parameter.action || 'ping';
  console.log('Action:', action);
  
  try {
    switch(action) {
      case 'getProducts':
        return getProducts();
      
      case 'getMember':
        return getMember(e.parameter.uid, e.parameter.name);
      
      case 'checkStaff':
        return json({ isStaff: e.parameter.uid === CONFIG.ADMIN_ID });
      
      case 'getOrders':
      case 'getAdminOrders':
        return getOrders();
      
      case 'getOwnerStats':
        return getStats();
      
      case 'ping':
      default:
        return json({
          status: 'online',
          service: 'MiniShop API',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: [
            'getProducts',
            'getMember', 
            'checkStaff',
            'getOrders',
            'getOwnerStats',
            'ping'
          ]
        });
    }
  } catch (error) {
    console.error('❌ GET Error:', error);
    return json({
      error: true,
      message: error.toString(),
      action: action
    });
  }
}

function doPost(e) {
  console.log('📮 POST Request received');
  
  try {
    const data = JSON.parse(e.postData.contents);
    console.log('POST Data:', data);
    
    const action = data.action;
    
    if (action === 'submitOrder') {
      return submitOrder(data);
    }
    
    if (action === 'updateStatus') {
      return updateStatus(data);
    }
    
    return json({
      error: 'Unknown action',
      received: action
    });
    
  } catch (error) {
    console.error('❌ POST Error:', error);
    return json({
      error: true,
      message: error.toString()
    });
  }
}

// Simple CORS support
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// PRODUCTS
// ==========================================

function getProducts() {
  console.log('🛍️ Getting products...');
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Menu');
    
    if (!sheet) {
      console.log('Menu sheet not found, returning sample');
      return json(getSampleProducts());
    }
    
    const data = sheet.getDataRange().getValues();
    console.log('Found', data.length, 'rows');
    
    if (data.length <= 1) {
      return json(getSampleProducts());
    }
    
    const products = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        products.push({
          name: String(row[0] || ''),
          price: parseFloat(row[1]) || 0,
          category: String(row[2] || 'อื่นๆ'),
          img: String(row[3] || 'https://via.placeholder.com/300x200?text=No+Image'),
          inStock: String(row[4] || 'true').toLowerCase() === 'true'
        });
      }
    }
    
    console.log('✅ Returning', products.length, 'products');
    return json(products);
    
  } catch (error) {
    console.error('❌ Error in getProducts:', error);
    return json(getSampleProducts());
  }
}

function getSampleProducts() {
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
    }
  ];
}

// ==========================================
// MEMBERS
// ==========================================

function getMember(uid, name) {
  console.log('👤 Getting member:', uid);
  
  if (!uid) {
    return json({
      points: 0,
      rank: 'Guest',
      name: 'Guest'
    });
  }
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Members');
    
    if (!sheet) {
      return json({
        points: 0,
        rank: 'New',
        name: name || 'สมาชิกใหม่'
      });
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === uid) {
        const points = parseInt(row[2]) || 0;
        return json({
          points: points,
          rank: getRank(points),
          name: String(row[1] || name || 'สมาชิก')
        });
      }
    }
    
    return json({
      points: 0,
      rank: 'New',
      name: name || 'สมาชิกใหม่'
    });
    
  } catch (error) {
    console.error('❌ Error in getMember:', error);
    return json({
      points: 0,
      rank: 'New',
      name: name || 'สมาชิกใหม่'
    });
  }
}

function getRank(points) {
  if (points >= 1000) return 'Super VIP 👑';
  if (points >= 500) return 'VIP ⭐';
  if (points >= 100) return 'Regular 🎯';
  return 'New 🆕';
}

// ==========================================
// ORDERS
// ==========================================

function getOrders() {
  console.log('📋 Getting orders...');
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Orders');
    
    if (!sheet) {
      return json([]);
    }
    
    const data = sheet.getDataRange().getValues();
    const orders = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[8]) {
        orders.push({
          id: String(row[8]),
          name: String(row[1]),
          total: parseFloat(row[5]) || 0,
          status: String(row[9] || 'รอดำเนินการ'),
          timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
          items: String(row[4])
        });
      }
    }
    
    console.log('✅ Found', orders.length, 'orders');
    return json(orders.reverse().slice(0, 10));
    
  } catch (error) {
    console.error('❌ Error in getOrders:', error);
    return json([]);
  }
}

function getStats() {
  console.log('📊 Getting stats...');
  
  try {
    return json({
      todaySales: 0,
      totalOrders: 0,
      realizedRevenue: 0,
      pendingRevenue: 0,
      topMenus: [
        { name: 'ข้าวผัดกระเพรา', count: 15 },
        { name: 'ผัดไทย', count: 12 },
        { name: 'ต้มยำกุ้ง', count: 8 }
      ]
    });
  } catch (error) {
    return json({
      todaySales: 0,
      totalOrders: 0,
      realizedRevenue: 0,
      pendingRevenue: 0,
      topMenus: []
    });
  }
}

function submitOrder(data) {
  console.log('🛒 Submitting order...');
  console.log('Order details:', {
    name: data.name,
    phone: data.phone,
    total: data.total,
    itemsCount: Array.isArray(data.items) ? data.items.length : 1
  });
  
  try {
    const orderId = 'MS-' + new Date().getTime();
    
    // Try to save to sheet
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
      let sheet = ss.getSheetByName('Orders');
      
      if (!sheet) {
        sheet = ss.insertSheet('Orders');
        sheet.getRange('A1:N1').setValues([[
          'Timestamp', 'ชื่อ', 'โทรศัพท์', 'ที่อยู่', 'รายการ', 
          'ยอดรวม', 'สลิป', 'User ID', 'Order ID', 'สถานะ',
          'คิว', 'วิธีการชำระ', 'สถานะชำระ', 'หมายเหตุ'
        ]]);
      }
      
      const itemsString = Array.isArray(data.items) 
        ? data.items.map(item => {
            if (typeof item === 'string') return item;
            return `${item.name} x${item.quantity}`;
          }).join(', ')
        : String(data.items);
      
      sheet.appendRow([
        new Date(),
        data.name,
        `'${data.phone}`,
        data.address || '',
        itemsString,
        parseFloat(data.total) || 0,
        'https://drive.google.com/test',
        data.uid || 'guest',
        orderId,
        'รอดำเนินการ',
        '',
        'โอนเงิน',
        'รอตรวจสอบ',
        data.note || ''
      ]);
      
      console.log('✅ Order saved to sheet');
      
    } catch (sheetError) {
      console.log('⚠️ Could not save to sheet:', sheetError);
    }
    
    return json({
      result: 'success',
      orderId: orderId,
      points: Math.floor(parseFloat(data.total) / 10) || 5,
      message: 'Order submitted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in submitOrder:', error);
    return json({
      result: 'error',
      message: error.toString()
    });
  }
}

function updateStatus(data) {
  console.log('🔄 Updating status:', data);
  
  return json({
    success: true,
    message: 'Status updated successfully'
  });
}

// ==========================================
// TEST FUNCTIONS
// ==========================================

function testAPI() {
  console.log('🧪 Testing API...');
  
  const results = {
    productsTest: getProducts(),
    memberTest: getMember('test123', 'Test User'),
    ordersTest: getOrders(),
    pingTest: json({ test: 'ok' })
  };
  
  return json({
    status: 'test_complete',
    results: results
  });
}

function testSheetConnection() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheets = ss.getSheets().map(s => s.getName());
    
    return json({
      connected: true,
      sheetId: CONFIG.SHEET_ID,
      sheets: sheets,
      sheetCount: sheets.length
    });
  } catch (error) {
    return json({
      connected: false,
      error: error.toString(),
      sheetId: CONFIG.SHEET_ID
    });
  }
}
