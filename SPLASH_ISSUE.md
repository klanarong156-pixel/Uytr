# Splash Screen ยังค้างอยู่ - ต้องรอสักครู่

## สถานะ
- Sidebar ด้านซ้ายหายไปเรียบร้อยแล้ว (ไม่มี sidebar-toggle button แล้ว)
- Splash screen ยังค้างอยู่ (หน้าโหลด)
- แต่ bottom nav, header ปุ่ม settings/dark mode ยังโผล่มาหลัง splash แล้ว

## หมายเหตุ
- Splash screen ควรมี safety timeout 6-10 วินาทีตามโค้ดที่แก้
- อาจต้องรออีกสักครู่ หรือเป็นเพราะ Service Worker ยัง cache เวอร์ชันเก่า
- ถ้า splash ไม่หายภายใน 10 วินาที แสดงว่าเป็นปัญหาอื่น
