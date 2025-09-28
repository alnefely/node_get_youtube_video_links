# Node YouTube Video API

API بسيط لاستخراج روابط جودات YouTube المختلفة مع منع التحذيرات وملفات debug.

## 🚀 التثبيت على السيرفر

### المتطلبات
- Node.js 14+ 
- npm
- systemd (للسيرفرات Linux)

### خطوات التثبيت

1. **رفع الملفات للسيرفر:**
```bash
# رفع المجلد كاملاً للسيرفر
scp -r node-youtube user@server:/path/to/your/
```

2. **تثبيت dependencies:**
```bash
cd /path/to/your/node-youtube
npm install
```

3. **تثبيت Service:**
```bash
# إعطاء صلاحيات للسكريبت
chmod +x manage.sh

# تثبيت Service
./manage.sh install
```

4. **بدء الخدمة:**
```bash
./manage.sh start
```

## 📋 إدارة الخدمة

### استخدام السكريبت:
```bash
./manage.sh install    # تثبيت الخدمة
./manage.sh start       # بدء الخدمة
./manage.sh stop        # إيقاف الخدمة
./manage.sh restart     # إعادة تشغيل
./manage.sh status      # حالة الخدمة
./manage.sh logs        # عرض السجلات المباشرة
./manage.sh uninstall   # إلغاء تثبيت الخدمة
```

### استخدام systemctl مباشرة:
```bash
sudo systemctl start node_youtube_video
sudo systemctl status node_youtube_video
sudo journalctl -u node_youtube_video -f
```

## 🔧 تحديث ملف Service القديم

إذا كان لديك service قديم يُظهر تحذيرات syslog:

```bash
# إيقاف الخدمة القديمة
sudo systemctl stop node_youtube_video
sudo systemctl disable node_youtube_video

# تثبيت النسخة المحدثة
./manage.sh install
./manage.sh start
```

## 📡 استخدام API

### Endpoint الرئيسي:
```
GET /api/video/:videoId
```

### مثال:
```bash
curl "http://localhost:3300/api/video/dQw4w9WgXcQ"
```

### استجابة نموذجية:
```json
{
  "success": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "author": "Rick Astley",
    "duration": "212",
    "thumbnail": "https://...",
    "videoQualities": [
      {
        "quality": "1080p",
        "directUrl": "https://...",
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "bitrate": 2500000,
        "mimeType": "video/mp4",
        "codecs": "avc1.640028",
        "hasAudio": false
      }
    ],
    "strongestAudio": {
      "quality": "160kbps",
      "directUrl": "https://...",
      "bitrate": 160,
      "mimeType": "audio/mp4",
      "codecs": "mp4a.40.2"
    }
  }
}
```

## 🛡️ المميزات

- ✅ **منع التحذيرات:** لا توجد رسائل WARNING
- ✅ **منع ملفات debug:** لا يتم إنشاء ملفات مؤقتة
- ✅ **تنظيف تلقائي:** حذف أي ملفات debug قد تظهر
- ✅ **إدارة متقدمة:** systemd service محدث
- ✅ **أمان عالي:** معالجة الأخطاء بدون كشف التفاصيل

## 🔧 استكشاف الأخطاء

### مشاهدة السجلات:
```bash
./manage.sh logs
# أو
sudo journalctl -u node_youtube_video -f
```

### التحقق من حالة الخدمة:
```bash
./manage.sh status
```

### إعادة تشغيل عند المشاكل:
```bash
./manage.sh restart
```