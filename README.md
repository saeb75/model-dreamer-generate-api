# Model Generator API

Bu proje, Replicate API kullanarak GPT Image 1 modeli ile görsel üretimi yapan ve çoklu görsel kompozisyonu destekleyen bir Express.js API'sidir.

## 🏗️ Mimari

Proje **Component-Based Architecture** kullanarak modüler ve sürdürülebilir bir yapıya sahiptir:

```
services/
├── ImageProcessor.js      # Görsel işleme operasyonları
├── CloudinaryService.js   # Cloudinary entegrasyonu
├── ImageValidator.js      # Giriş doğrulama
└── ImageComposer.js       # Ana kompozisyon orkestrasyonu
```

## 🚀 Kurulum

1. Bağımlılıkları yükleyin:

```bash
npm install
# veya
yarn install
```

2. Environment değişkenlerini ayarlayın:

```bash
cp env.example .env
```

3. `.env` dosyasını düzenleyin:

```env
REPLICATE_API_TOKEN=your_replicate_api_token_here
OPENAI_API_KEY=your_openai_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
PORT=3000
NODE_ENV=development
```

4. Sunucuyu başlatın:

```bash
npm run dev
# veya
yarn dev
```

## 📚 API Dokümantasyonu

**Swagger UI**: http://localhost:3000/docs

Tüm API endpoint'leri, parametreler ve response'lar için detaylı dokümantasyon.

## 📋 API Endpoints

### 1. Metin ile Görsel Üretimi

**POST** `/api/v1/generate`

Sadece metin prompt'u ile görsel üretir.

**Request Body:**

```json
{
  "prompt": "Add the floral pattern to the vase",
  "quality": "auto",
  "background": "auto",
  "aspect_ratio": "1:1",
  "number_of_images": 1
}
```

### 2. Çoklu Görsel Kompozisyonu ⭐ YENİ

**POST** `/api/v1/generate-with-multiple-images`

2-3 görsel ile A4 kompozisyonu oluşturur ve Cloudinary'ye yükler.

**Gereksinimler:**

- **2 görsel**: 1 URL + 1 yüklenen dosya
- **3 görsel**: 1 URL + 2 yüklenen dosya

**Request:** `multipart/form-data`

- `images`: Görsel dosyaları (max 2 dosya, her biri max 10MB)
- `imageUrls`: JSON array olarak URL'ler
- `prompt`: Metin açıklaması (opsiyonel)
- `quality`: Kalite ayarı (opsiyonel)
- `background`: Arka plan ayarı (opsiyonel)
- `aspect_ratio`: En-boy oranı (opsiyonel)

**Response:**

```json
{
  "success": true,
  "composition": {
    "success": true,
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "publicId": "a4_composition_1234567890",
    "composition": {
      "totalImages": 3,
      "uploadedCount": 2,
      "urlCount": 1,
      "canvasSize": {
        "width": 2480,
        "height": 3508
      }
    }
  },
  "replicateGeneration": {
    "success": true,
    "model": "openai/gpt-image-1:...",
    "output": "..."
  },
  "summary": {
    "totalInputImages": 3,
    "urlCount": 1,
    "uploadedCount": 2,
    "hasPrompt": true,
    "cloudinaryUrl": "https://res.cloudinary.com/..."
  }
}
```

### 3. Yardımcı Endpoints

**GET** `/api/v1/validation-rules` - Doğrulama kurallarını getirir
**GET** `/api/v1/test-cloudinary` - Cloudinary bağlantısını test eder

## 🎯 Kullanım Örnekleri

### cURL ile Test

**Çoklu görsel kompozisyonu:**

```bash
curl -X POST http://localhost:3000/api/v1/generate-with-multiple-images \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png" \
  -F "imageUrls=[\"https://example.com/image3.jpg\"]" \
  -F "prompt=Create a beautiful composition"
```

### JavaScript/Fetch ile Test

```javascript
// Çoklu görsel kompozisyonu
const formData = new FormData();
formData.append("images", imageFile1);
formData.append("images", imageFile2);
formData.append(
  "imageUrls",
  JSON.stringify(["https://example.com/image3.jpg"])
);
formData.append("prompt", "Create a beautiful composition");

const response = await fetch(
  "http://localhost:3000/api/v1/generate-with-multiple-images",
  {
    method: "POST",
    body: formData,
  }
);

const result = await response.json();
console.log("Cloudinary URL:", result.composition.cloudinaryUrl);
```

## 🔧 Servisler

### ImageProcessor

- Görsel indirme ve yeniden boyutlandırma
- A4 canvas oluşturma (2480x3508px @ 300 DPI)
- Yatay düzenleme (1/2 veya 1/3 bölümler)

### CloudinaryService

- Görsel yükleme ve yönetimi
- Buffer ve dosya yükleme desteği
- Güvenli URL'ler

### ImageValidator

- Dosya boyutu ve türü doğrulama
- URL format kontrolü
- Görsel sayısı validasyonu (2-3 arası)

### ImageComposer

- Tüm servisleri orkestrasyon
- Hata yönetimi ve temizlik
- Workflow koordinasyonu

## 📁 Dosya Yapısı

```
model-generator/
├── services/
│   ├── ImageProcessor.js      # Görsel işleme
│   ├── CloudinaryService.js   # Cloudinary entegrasyonu
│   ├── ImageValidator.js      # Doğrulama
│   └── ImageComposer.js       # Ana orkestrasyon
├── controller/
│   └── generate.routes.js     # Controller
├── routes/
│   └── generate.route.js      # Route tanımları
├── swagger/
│   ├── swagger.yaml          # API dokümantasyonu
│   └── index.html            # Swagger UI
├── uploads/                   # Yüklenen görseller
├── temp/                      # Geçici dosyalar (otomatik)
├── index.js                   # Ana sunucu
├── package.json
├── env.example               # Environment örneği
└── README.md
```

## ✨ Özellikler

- ✅ **Component-Based Architecture**
- ✅ **Çoklu görsel kompozisyonu** (2-3 görsel)
- ✅ **A4 boyutunda PNG çıktı** (2480x3508px)
- ✅ **Cloudinary entegrasyonu**
- ✅ **Otomatik görsel düzenleme** (1/2 veya 1/3)
- ✅ **Kapsamlı doğrulama**
- ✅ **Hata yönetimi ve temizlik**
- ✅ **Otomatik dosya temizliği** (uploads klasöründen)
- ✅ **CORS desteği**
- ✅ **Dosya yükleme limitleri**
- ✅ **Statik dosya sunumu**
- ✅ **Swagger API Dokümantasyonu**

## 🔒 Doğrulama Kuralları

- **Minimum**: 2 görsel (1 URL + 1 dosya)
- **Maksimum**: 3 görsel (1 URL + 2 dosya)
- **Dosya boyutu**: Max 10MB
- **Dosya türleri**: JPG, PNG, WebP, GIF
- **URL formatı**: HTTP/HTTPS

## 🧹 Otomatik Dosya Temizliği

API, kullanılan dosyaları otomatik olarak temizler:

### Temizlenen Dosyalar:

- **Yüklenen dosyalar**: `uploads/` klasöründeki kullanıcı dosyaları
- **Oluşturulan dosyalar**: AI tarafından oluşturulan geçici dosyalar
- **Düzenlenen dosyalar**: OpenAI ile düzenlenen görseller

### Temizlik Zamanı:

- Dosyalar işlendikten ve Cloudinary'ye yüklendikten hemen sonra
- Hata durumlarında bile temizlik işlemi gerçekleştirilir
- Log kayıtları ile temizlik işlemleri takip edilir

### Güvenlik:

- Sadece API tarafından oluşturulan dosyalar temizlenir
- Sistem dosyalarına dokunulmaz
- Hata durumlarında güvenli temizlik

## 🛠️ Gereksinimler

- Node.js 16+
- Replicate API Token
- OpenAI API Key
- Cloudinary hesabı ve API anahtarları

## 📝 Lisans

ISC

# model-dreamer-generate-api
