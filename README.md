# Wallet Address Exporter

واجهة Frontend ثابتة لاستخراج الحسابات التي تكشفها المحفظة عبر Reown AppKit/WalletConnect وتصديرها إلى Excel.

## الحقول

- Currency
- Network
- Address
- Memo

لا يتم وضع Chain ID في ملف Excel.

## الأمان

- لا تطلب Seed Phrase.
- لا تطلب Private Key.
- لا توجد قاعدة بيانات أو Backend.
- ملف Excel يُنشأ محليًا داخل المتصفح.
- لا يحاول التطبيق اشتقاق حسابات من Seed Phrase.

## الشبكات/المحولات

المشروع مهيأ لـ:

- EVM عبر Wagmi
- Solana
- Bitcoin
- TON
- TRON

Reown AppKit يدعم هذه الأنظمة عبر adapters مختلفة. راجع توثيق Reown قبل تحديث الإصدارات.

## 1. Project ID

أنشئ مشروعًا في Reown Dashboard ثم ضع الـProject ID في:

`src/config.js`

```js
export const PROJECT_ID = 'YOUR_REOWN_PROJECT_ID'
```

## 2. GitHub Pages

إذا كان المستودع:

`https://github.com/USERNAME/wallet-address-exporter`

فالرابط سيكون:

`https://USERNAME.github.io/wallet-address-exporter/`

وتأكد أن:

`vite.config.js`

يحتوي:

```js
base: '/wallet-address-exporter/'
```

إذا غيرت اسم المستودع، غيّر قيمة `base` إلى اسم المستودع الجديد.

إذا كنت تستخدم مستودع المستخدم الرئيسي:

`USERNAME.github.io`

اجعل:

```js
base: '/'
```

## 3. Reown Metadata URL

يجب أن يطابق `metadata.url` عنوان موقعك المنشور.

المشروع يحسبه من:

```js
window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')
```

لذلك، مع GitHub Pages الخاص بالمستودع سيصبح مثل:

`https://USERNAME.github.io/wallet-address-exporter`

## 4. التشغيل محليًا

```bash
npm install
npm run dev
```

ثم افتح عنوان Vite الذي يظهر في الطرفية.

## 5. Build

```bash
npm run build
npm run preview
```

## 6. النشر

ارفع المشروع إلى GitHub في الفرع `main`.

بعدها:

GitHub → Settings → Pages → Source → GitHub Actions

الـworkflow الموجود في:

`.github/workflows/deploy.yml`

سيبني المشروع وينشر `dist` تلقائيًا عند كل push إلى `main`.

## ملاحظة مهمة عن "كل العناوين"

WalletConnect/Reown لا يمنح الموقع صلاحية قراءة Seed Phrase أو كل الحسابات المخفية داخل المحفظة.

التطبيق يقرأ فقط الحسابات التي تكشفها المحفظة/جلسة الاتصال. إذا كانت المحفظة تكشف عدة CAIP-10 accounts، يحاول التطبيق جمعها من session namespaces. أما إذا كشفت عنوانًا نشطًا فقط، فلن يستطيع الموقع اختراع أو اشتقاق الحسابات الأخرى.

## Memo / Tag

Memo أو Destination Tag ليس جزءًا عامًا من كل عنوان. لذلك:

- إذا لم توفره المحفظة/البروتوكول، يبقى الحقل فارغًا.
- لا يتم توليد Memo عشوائي.
- يمكن لاحقًا إضافة طبقة خاصة بالشبكات التي تستخدم destination tags أو memo مع مصدر موثوق.

## Disclaimer

هذا المشروع أداة تنظيم وتصدير للعناوين التي يشاركها المستخدم مع التطبيق. لا ينفذ معاملات ولا يطلب توقيعات ولا يطلب أسرار المحفظة.
