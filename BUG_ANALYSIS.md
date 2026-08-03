# Bug Analysis: หน้า Splash Screen ค้างอยู่ (ดูเหมือนล็อกอินค้าง)

## สาเหตุหลัก

หน้า splash screen (ที่ผู้ใช้อาจมองว่าเป็นหน้าล็อกอิน) ค้างอยู่ไม่หาย เพราะมีสาเหตุที่เป็นไปได้ 2 ประการ:

### 1. Splash screen ขึ้นอยู่กับ `window.load` event
- Splash screen จะซ่อนก็ต่อเมื่อ `window.addEventListener('load', ...)` ทำงาน
- `window.load` event จะเกิดหลังจากทุก resource (รูปภาพ, ฟอนต์, CDN scripts) โหลดเสร็จทั้งหมด
- หาก CDN อย่าง `tailwindcss.com`, `lucide`, `chart.js` หรือฟอนต์ Google ล้มเหลว/ช้า → splash จะค้างอยู่ตลอดไป
- ไม่มี fallback timer (safety timeout) เลย

### 2. ไม่มี inline splash handler ใน HTML
- Splash screen logic อยู่ที่ `script.js` เท่านั้น (บรรทัด 523-534)
- หาก `script.js` โหลดไม่สำเร็จ (เช่น script tag อยู่นอก body หรือ network error) → splash จะไม่ถูกซ่อน
- inline `<script>` ใน `<head>` ไม่มี splash handler

## วิธีแก้ไข

### Fix 1: เพิ่ม inline splash timeout ใน HTML (safety net)
ใส่ splash timeout ตรงใน `<head>` ของ HTML เพื่อให้ทำงานได้แม้ script.js ล้มเหลว

### Fix 2: ลด reliance บน window.load → ใช้ DOMContentLoaded + setTimeout fallback
เปลี่ยนจาก `window.addEventListener('load')` เป็น `setTimeout` ภายใน `DOMContentLoaded` พร้อม fallback timeout

### Fix 3: เพิ่ม inline script ใต้ splash element ใน body
ใส่ setTimeout ตรงใน HTML หลัง splash element เพื่อให้ซ่อน splash ได้ทันทีแม้ script ภายนอกมีปัญหา
