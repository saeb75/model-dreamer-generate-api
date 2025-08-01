# Basit Socket.IO Bildirim Sistemi

Bu dokümantasyon, tek sunucuda çalışan basit Socket.IO bildirim sistemini açıklar.

## 🎯 Özellikler

### 1. **Gerçek Zamanlı Bildirimler**

- İşlem başladığında anında bildirim
- Her aşamada durum güncellemesi
- İşlem tamamlandığında sonuç bildirimi
- Hata durumunda hata bildirimi

### 2. **Basit ve Hızlı**

- Sadece Socket.IO kullanır
- Memory-based (hızlı)
- Karmaşık persistence yok
- Minimal kod

### 3. **Çoklu Cihaz Desteği**

- Aynı kullanıcının tüm cihazlarına gönderir
- Otomatik room sistemi

## Socket.IO Events

### Frontend'den Backend'e Gönderilen Events

#### 1. Kullanıcı Kimlik Doğrulama

```javascript
socket.emit("authenticate", { userId: 123 });
```

#### 2. Belirli İşlemi Dinleme

```javascript
socket.emit("subscribe_to_generation", {
  generationId: "edit_1234567890_abc123",
});
```

### Backend'den Frontend'e Gönderilen Events

#### 1. İşlem Başladı

```javascript
socket.on("generation_started", (data) => {
  console.log("İşlem başladı:", data);
  // data: {
  //   generationId: "edit_1234567890_abc123",
  //   status: "started",
  //   message: "Image editing started..."
  // }
});
```

#### 2. İşlem Devam Ediyor

```javascript
socket.on("continue", (data) => {
  console.log("İşlem devam ediyor:", data);
  // data: {
  //   generationId: "edit_1234567890_abc123",
  //   status: "composition",
  //   message: "Composing images...",
  //   progress: 20
  // }
});
```

#### 3. İşlem Tamamlandı

```javascript
socket.on("generation_completed", (data) => {
  console.log("İşlem tamamlandı:", data);
  // data: {
  //   generationId: "edit_1234567890_abc123",
  //   status: "completed",
  //   editedImageUrl: "https://...",
  //   faceSwapUrl: "https://...", // Sadece face swap yapıldıysa
  //   credit: 4,
  //   message: "Image editing completed successfully!"
  // }
});
```

#### 4. İşlem Başarısız

```javascript
socket.on("generation_failed", (data) => {
  console.log("İşlem başarısız:", data);
  // data: {
  //   generationId: "edit_1234567890_abc123",
  //   status: "failed",
  //   error: "Error message",
  //   message: "Image editing failed!"
  // }
});
```

## Frontend Implementasyonu

### 1. Socket.IO Bağlantısı

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3000");

// Kullanıcı kimlik doğrulama
socket.emit("authenticate", { userId: user.id });

// İşlem başladığında
socket.on("generation_started", (data) => {
  showProgressBar(data);
});

// İşlem devam ediyor
socket.on("continue", (data) => {
  updateProgressBar(data);
});

// İşlem tamamlandığında
socket.on("generation_completed", (data) => {
  showCompletionMessage(data);
  hideProgressBar(data.generationId);
});

// Hata durumunda
socket.on("generation_failed", (data) => {
  showErrorMessage(data);
  hideProgressBar(data.generationId);
});
```

### 2. İlerleme Çubuğu Gösterimi

```javascript
const showProgressBar = (data) => {
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressBar.setAttribute("data-generation-id", data.generationId);
  progressBar.innerHTML = `
    <div class="progress" style="width: 0%"></div>
    <span class="message">${data.message}</span>
    <span class="status">${data.status}</span>
  `;

  document.getElementById("active-generations").appendChild(progressBar);
};

const updateProgressBar = (data) => {
  const progressBar = document.querySelector(
    `[data-generation-id="${data.generationId}"]`
  );
  if (progressBar) {
    const progress = progressBar.querySelector(".progress");
    const message = progressBar.querySelector(".message");
    const status = progressBar.querySelector(".status");

    progress.style.width = `${data.progress}%`;
    message.textContent = data.message;
    status.textContent = data.status;
  }
};

const hideProgressBar = (generationId) => {
  const progressBar = document.querySelector(
    `[data-generation-id="${generationId}"]`
  );
  if (progressBar) {
    progressBar.remove();
  }
};
```

## İşlem Durumları

### Edit İşlemleri (editImageWithOpenAI)

1. `started` - İşlem başladı
2. `composition` - Görüntüler birleştiriliyor (progress: 20%)
3. `composition_completed` - Birleştirme tamamlandı (progress: 40%)
4. `openai_editing` - OpenAI düzenleme başladı (progress: 60%)
5. `openai_editing_completed` - OpenAI düzenleme tamamlandı (progress: 80%)
6. `face_swap` - Face swap uygulanıyor (progress: 85%) - _Sadece image URL varsa_
7. `face_swap_completed` - Face swap tamamlandı (progress: 95%) - _Sadece image URL varsa_
8. `completed` - İşlem tamamlandı (progress: 100%)
9. `failed` - İşlem başarısız

### Generate İşlemleri (generateWithMultipleImages)

1. `started` - İşlem başladı
2. `composition` - Görüntüler birleştiriliyor (progress: 20%)
3. `composition_completed` - Birleştirme tamamlandı (progress: 40%)
4. `ai_generation` - AI üretimi başladı (progress: 60%)
5. `completed` - İşlem tamamlandı (progress: 100%)
6. `failed` - İşlem başarısız

## Avantajları

### ✅ Basit ve Hızlı

- Minimal kod
- Hızlı implementasyon
- Kolay debug

### ✅ Gerçek Zamanlı

- Anında bildirimler
- Çoklu cihaz desteği
- Otomatik room sistemi

### ✅ Hafif

- Sadece Socket.IO
- Ekstra dependency yok
- Memory efficient

## Dezavantajları

### ❌ Server Restart Problemi

- Server restart'ta aktif işlemler kaybolur
- Kullanıcı yeniden bağlandığında eski işlemleri göremez

### ❌ Tek Sunucu Sınırı

- Multiple server instance'ları desteklemez
- Load balancer arkasında çalışamaz

## Kullanım Senaryoları

### ✅ İdeal Kullanım

- Tek sunucu deployment
- Kısa süreli işlemler (5-10 dakika)
- Basit kullanıcı deneyimi
- Prototip/MVP projeler

### ❌ Uygun Olmayan Kullanım

- Production scale deployment
- Uzun süreli işlemler
- Kritik veri kaybı toleransı düşük
- Multiple server instance'ları

## Güvenlik

- Her kullanıcı sadece kendi işlemlerini görebilir
- Socket.IO room sistemi ile izolasyon
- Authentication middleware ile koruma
