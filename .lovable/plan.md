# Warta Keuangan — Format Identik Contoh

Menyesuaikan halaman Warta Keuangan agar tata letaknya persis seperti file contoh, plus halaman baru untuk Dana Diakonia Duka.

## 1. Header & tabel utama (sesuai contoh)

- Judul "WARTA KEUANGAN" dan sub-judul "Laporan Penerimaan & Pengeluaran Kas Jemaat Tanggal … s/d …".
- Kolom: Tgl | Uraian | Masuk (Rp) | Keluar (Rp) | Saldo (Rp).
- Baris "Saldo Awal" di atas, nama mata anggaran tebal sebagai judul kelompok, rincian transaksi menjorok di bawahnya.
- Tanggal hanya ditulis sekali pada baris pertama hari tersebut (tebal, format "10 Agust").
- Semua penerimaan lebih dulu, blok pengeluaran (termasuk "Kas Keluar" setoran bank) di akhir hari — sudah berjalan, dipertahankan.
- Baris TOTAL tebal di akhir: total masuk, total keluar, saldo akhir.

## 2. Rekapitulasi 3 kolom

Tabel rekap mengikuti contoh: kolom **Dana Rutin**, **Simpanan Bank**, **Jumlah**, dengan baris:

```text
1. Saldo Minggu Lalu        [rutin] [bank] [jumlah]
2. Penerimaan Minggu ini    [rutin] [bank] [jumlah]
3. Pengeluaran Minggu ini   [rutin] [bank] [jumlah]
4.                          [rutin] [bank] [jumlah]
```

- Kolom Dana Rutin: otomatis dari kas (saldo awal, total masuk, total keluar, saldo akhir).
- Kolom Simpanan Bank: otomatis dari transaksi setor/tarik bank (kode 1.1.11.11 dan 2.2.22.22, mengecualikan voucher reklas) — kas keluar = bank masuk, kas masuk = bank keluar, sama seperti halaman Laporan Bank.
- Ada isian **Saldo Awal Bank** (tersimpan di perangkat) sebagai dasar saldo bank minggu lalu.
- Kolom Jumlah = Dana Rutin + Simpanan Bank.

## 3. Catatan penutup & tanda tangan

- Paragraf ucapan terima kasih dan "Tuhan Yesus Memberkati." seperti contoh.
- Baris tempat & tanggal ("Tikala Baru, 14 Agustus 2026") — nama tempat bisa diubah.
- Dua penandatangan berdampingan: **Ketua** (kiri) dan **Bendahara** (kanan), keduanya bisa diisi namanya.
- Catatan kaki klarifikasi persembahan di kantor jemaat.

## 4. Bagian Dana Diakonia Duka

- Halaman baru **Dana Duka** di sidebar: tabel kolom 1–29 dengan status tunggakan per kolom ("Lunas" atau "x duka"), bisa diisi/diubah manual dan disimpan.
- Di bawah warta ditampilkan blok "DANA DIAKONIA DUKA JEMAAT" dengan susunan 3 pasang kolom berdampingan (1–10, 11–20, 21–29), mengambil data terakhir dari halaman Dana Duka sehingga ikut tercetak.

## 5. Cetak

- Tetap F4 landscape (330×215 mm), 2 rangkap, setiap rangkap satu halaman.
- Ukuran font, lebar kolom, dan garis tabel disetel menyerupai contoh; rekap, tanda tangan, dan tabel duka ikut tercetak dan tidak terpotong.

## Catatan teknis

- Ubah `src/routes/_authenticated/warta.tsx` (tata letak, rekap 3 kolom, tanda tangan ganda, blok duka).
- Halaman baru `src/routes/_authenticated/dana-duka.tsx` + entri menu di `src/components/AppShell.tsx`.
- Data duka & saldo awal bank disimpan lokal di perangkat (localStorage), pola sama seperti halaman Rincian Uang; tidak ada perubahan skema database.
- Mutasi bank memakai helper `INTERNAL_CASH_CODES` dan `isReklas` yang sudah ada di `src/lib/queries.ts`.
- Penyesuaian aturan cetak di `src/styles.css`.

## 6. Tambahan (permintaan lanjutan)

### Export ke Excel
- Tombol **Export Excel** di halaman Warta Keuangan (di samping tombol Cetak).
- File .xlsx berisi tabel utama (Tgl, Uraian, Masuk, Keluar, Saldo), Rekapitulasi 3 kolom, dan blok Dana Duka — mengikuti susunan yang sama dengan versi cetak.
- Nama file otomatis: `Warta-Keuangan-<tanggal mulai>-sd-<tanggal selesai>.xlsx`.

### Kolom keterangan koreksi
- Tambahan kolom/keterangan **"Koreksi"** pada warta: transaksi yang merupakan hasil koreksi dari transaksi sebelumnya diberi catatan singkat (mis. "koreksi dari KM-2026-0184") agar jemaat/pemeriksa tahu asal perubahannya.
- Data koreksi disimpan di transaksi (catatan koreksi + nomor bukti asal) dan ikut tampil di Buku Pembantu serta laporan cetak.

### Menu Koreksi Transaksi
- Halaman baru **Koreksi Transaksi** di sidebar: mencari transaksi berdasarkan nomor bukti/tanggal/keterangan, lalu memperbaiki **keterangan** dan/atau **mata anggaran** (selain nominal yang sudah bisa dikoreksi lewat tombol yang ada).
- Setiap koreksi wajib mengisi alasan; sistem mencatat siapa yang mengoreksi, kapan, serta nilai lama dan nilai baru sebagai riwayat koreksi yang bisa dilihat kembali.
- Hak akses: Admin Keuangan dan Super Administrator.

### Catatan teknis tambahan
- Perlu perubahan database: kolom catatan koreksi pada tabel transaksi + tabel riwayat koreksi (transaksi, kolom yang diubah, nilai lama/baru, alasan, pengoreksi, waktu) beserta aturan aksesnya.
- Export Excel memakai pustaka spreadsheet di sisi klien (tanpa server tambahan).
- Halaman baru `src/routes/_authenticated/koreksi.tsx` + entri menu di `src/components/AppShell.tsx`.
