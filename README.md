# Minishop LIFF (Production-Ready)


## หมายเหตุความปลอดภัย
- Frontend จะดึง config จาก GAS ด้วย `getPublicConfig()`
- ทุก API ต้องผ่านการยืนยันตัวตนด้วย LINE ID Token
- การจัดการข้อมูล (Orders/Settings) ต้องผ่านรหัสผู้ดูแล
