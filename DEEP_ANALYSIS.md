# Deep Analysis: Splash Screen ค้างบน GitHub Pages

## สถานะปัจจุบัน
- โค้ดแก้ไขถูก push ไป main แล้ว
- GitHub Pages serve ไฟล์ใหม่แล้ว (ตรวจสอบจาก inline scripts ใน HTML)
- splash-screen element มี style `display: none` + class `fade-out` → **ถูกซ่อนแล้ว**
- หน้าเว็บโหลดได้ปกติ แสดงข้อมูล MQTT ได้ (อุณหภูมิ 26.4, ความชื้น 95.0)

## สรุป: แก้ไขทำงานได้แล้ว!
ในครั้งที่ 2 ที่รีโหลด, splash หายไปแล้ว แสดงว่า inline safety timeout ทำงาน

## สาเหตุเดิมที่ splash ค้าง (ก่อนแก้ไข)
1. **window.load event** รอทุก resource โหลดเสร็จก่อน แล้วค่อยซ่อน splash
2. ถ้า CDN ช้า/ล้มเหลว → splash ค้างตลอดไป
3. **ไม่มี safety timeout**

## ปัญหา Service Worker (sw.js)
Service Worker ใช้ `CACHE_NAME = 'suan-lung-na-v1'` ซึ่ง cache เวอร์ชันเก่า
อาจทำให้ผู้ใช้ที่เคยมารีวิวแล้ว cache ไว้ ได้เห็นเวอร์ชันเก่า

## แนะนำ
- เปลี่ยน CACHE_VERSION เป็น suan-lung-na-v2 เพื่อ invalidate cache เก่า
- หรือเพิ่ม version number ใน sw.js ทุกครั้งที่ deploy
