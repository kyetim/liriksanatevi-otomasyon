# 🎵 Lirik Sanat Evi — Otomasyon Sistemi

> Müzik okulları için geliştirilmiş masaüstü yönetim uygulaması.
> A desktop management application built for music schools.

---

## 🇹🇷 Türkçe

### Proje Hakkında

Lirik Sanat Evi Otomasyon Sistemi; öğrenci kayıtları, ders programları, ödemeler, öğretmen yönetimi ve raporlama gibi müzik okulu operasyonlarını tek bir arayüzde birleştiren masaüstü bir uygulamadır.

### Özellikler

- **Öğrenci Yönetimi** — Kayıt, takip, gelişim raporları, ayrılış kaydı ve eski öğrenci arşivi
- **Öğretmen Yönetimi** — Profil, enstrüman branşı, maaş yapılandırması (sabit / ders başı / yüzde sistemi)
- **Ders Programı** — Günlük, haftalık ve aylık görünüm; otomatik ders oluşturma, yoklama
- **Ödeme Sistemi** — Tahsilat takibi, cari hesap, ödeme planları, borç/alacak yönetimi
- **Raporlar** — Gelir/gider analizi, öğrenci devam raporu, öğretmen performansı, enstrüman doluluk oranı
- **Bildirimler & İletişim** — SMS entegrasyonu (Netgsm), WhatsApp yönlendirme
- **Etkinlik Yönetimi** — Konser/etkinlik planlama, katılımcı takibi, prova takvimi
- **Kullanıcı & Yetki** — Rol tabanlı erişim (yönetici, sekreter, öğretmen, muhasebe)
- **Yedekleme** — Otomatik ve manuel SQLite veritabanı yedekleme/geri yükleme

### Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Masaüstü | Electron 29 |
| Arayüz | React 18 + TypeScript |
| Stil | Tailwind CSS |
| Veritabanı | SQLite (better-sqlite3, WAL modu) |
| Validasyon | Zod |
| Build | electron-vite |
| Grafikler | Recharts |

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modunda çalıştır
npm run dev

# Üretim build'i al
npm run build
```

### Gereksinimler

- Node.js 18+
- npm 9+

---

## 🇬🇧 English

### About

Lirik Sanat Evi Automation System is a desktop application that consolidates music school operations — student enrollment, lesson scheduling, payments, teacher management, and reporting — into a single interface.

### Features

- **Student Management** — Registration, tracking, progress reports, departure records, and alumni archive
- **Teacher Management** — Profile, instrument specialization, salary configuration (fixed / per-lesson / percentage-based)
- **Class Schedule** — Daily, weekly, and monthly views; automatic lesson generation, attendance tracking
- **Payment System** — Collection tracking, current accounts, payment plans, debt/credit management
- **Reports** — Revenue/expense analysis, student attendance, teacher performance, instrument occupancy
- **Notifications & Communication** — SMS integration (Netgsm), WhatsApp forwarding
- **Event Management** — Concert/event planning, participant tracking, rehearsal scheduling
- **Users & Permissions** — Role-based access control (admin, secretary, teacher, accountant)
- **Backup** — Automatic and manual SQLite database backup and restore

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 29 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (better-sqlite3, WAL mode) |
| Validation | Zod |
| Build | electron-vite |
| Charts | Recharts |

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Requirements

- Node.js 18+
- npm 9+

---

## License

MIT © [kyetim](https://github.com/kyetim)
