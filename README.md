# Minishop LIFF (Production-Ready)

โปรเจกต์นี้เป็นร้านค้าออนไลน์ผ่าน LINE LIFF ที่เชื่อมกับ Google Apps Script และ Google Sheets
โดยแยก config/secret ออกจากฝั่ง frontend เพื่อความปลอดภัยและรองรับหลาย environment

## โครงสร้างระบบ
- **Frontend (LIFF)**: `index.html`, `app.js`, `style.css`
- **Backend (GAS)**: `Code.gs`
- **Database**: Google Sheets (ชีต `products`, `orders`, `store_settings`)

## การตั้งค่า Environment (ผ่าน Script Properties)
ตั้งค่าใน Google Apps Script > Project Settings > Script Properties

**ค่าหลัก**
- `APP_ENV` = `dev` หรือ `prod`

**ค่าตาม environment (เพิ่ม suffix _DEV / _PROD)**
- `LIFF_ID_DEV`, `LIFF_ID_PROD`
- `GOOGLE_MAPS_KEY_DEV`, `GOOGLE_MAPS_KEY_PROD`
- `LINE_CHANNEL_ID_DEV`, `LINE_CHANNEL_ID_PROD`
- `THUNDER_API_KEY_DEV`, `THUNDER_API_KEY_PROD`
- `LINE_NOTIFY_TOKEN_DEV`, `LINE_NOTIFY_TOKEN_PROD`

> ตัวอย่าง: หากใช้ production ให้ตั้ง `APP_ENV=prod` และใส่ค่าใน `_PROD`

## การตั้งค่าเริ่มต้น
1. Deploy Google Apps Script เป็น Web App (Execute as: Me, Access: Anyone)
2. เปิด URL แล้วเรียก `initialSetup()` เพื่อสร้างชีต
3. ตั้งค่ารหัสผ่านผู้ดูแลในชีต `store_settings` แถวที่ 2
4. เปิดผ่าน LINE LIFF เท่านั้น

## หมายเหตุความปลอดภัย
- Frontend จะดึง config จาก GAS ด้วย `getPublicConfig()`
- ทุก API ต้องผ่านการยืนยันตัวตนด้วย LINE ID Token
- การจัดการข้อมูล (Orders/Settings) ต้องผ่านรหัสผู้ดูแล
