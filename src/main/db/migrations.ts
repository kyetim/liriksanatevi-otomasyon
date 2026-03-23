import Database from 'better-sqlite3'

// ─────────────────────────────────────────────────────────────────────────────
// Versiyon tabanlı migration sistemi
// Her migrasyon bir kez çalışır; migrations tablosuna kaydedilir.
// ─────────────────────────────────────────────────────────────────────────────

interface Migration {
  name: string
  sql: string
}

const ALL_MIGRATIONS: Migration[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 001 — Tüm tablolar
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '001_create_all_tables',
    sql: `
      -- ── ÖĞRENCILER ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS students (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name        TEXT    NOT NULL,
        last_name         TEXT    NOT NULL,
        birth_date        TEXT,
        gender            TEXT    CHECK(gender IN ('male','female','other')),
        phone             TEXT,
        email             TEXT,
        address           TEXT,
        city              TEXT,
        parent_name       TEXT,
        parent_phone      TEXT,
        parent_email      TEXT,
        photo_path        TEXT,
        registration_date TEXT    NOT NULL DEFAULT (date('now')),
        status            TEXT    NOT NULL DEFAULT 'active'
                          CHECK(status IN ('active','passive','frozen')),
        notes             TEXT,
        discount_rate     REAL    NOT NULL DEFAULT 0
                          CHECK(discount_rate >= 0 AND discount_rate <= 100),
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── ÖĞRETMENler / ÇALIŞANLAR ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teachers (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name        TEXT    NOT NULL,
        last_name         TEXT    NOT NULL,
        birth_date        TEXT,
        phone             TEXT,
        email             TEXT,
        address           TEXT,
        specialization    TEXT,   -- JSON: ["piano","violin"]
        employment_type   TEXT    NOT NULL DEFAULT 'full_time'
                          CHECK(employment_type IN ('full_time','part_time','freelance')),
        salary_type       TEXT    NOT NULL DEFAULT 'fixed'
                          CHECK(salary_type IN ('fixed','per_lesson')),
        salary_amount     REAL    NOT NULL DEFAULT 0,
        iban              TEXT,
        hire_date         TEXT    NOT NULL DEFAULT (date('now')),
        status            TEXT    NOT NULL DEFAULT 'active'
                          CHECK(status IN ('active','passive')),
        photo_path        TEXT,
        notes             TEXT,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── ENSTRÜMANlar / DERS TÜRLERİ ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS instruments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        category    TEXT,
        description TEXT,
        color_code  TEXT    NOT NULL DEFAULT '#1B3A6B',
        is_active   INTEGER NOT NULL DEFAULT 1
      );

      -- ── KAYITLAR (öğrenci + öğretmen + enstrüman) ─────────────────────────
      CREATE TABLE IF NOT EXISTS enrollments (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id       INTEGER NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
        teacher_id       INTEGER          REFERENCES teachers(id)    ON DELETE SET NULL,
        instrument_id    INTEGER          REFERENCES instruments(id) ON DELETE SET NULL,
        lesson_type      TEXT    NOT NULL DEFAULT 'individual'
                         CHECK(lesson_type IN ('individual','group')),
        lesson_duration  INTEGER NOT NULL DEFAULT 45
                         CHECK(lesson_duration IN (30,45,60)),
        lessons_per_week INTEGER NOT NULL DEFAULT 1,
        lesson_days      TEXT    NOT NULL DEFAULT '[]',  -- JSON: ["monday","wednesday"]
        lesson_time      TEXT,
        monthly_fee      REAL    NOT NULL DEFAULT 0,
        start_date       TEXT    NOT NULL DEFAULT (date('now')),
        end_date         TEXT,
        status           TEXT    NOT NULL DEFAULT 'active'
                         CHECK(status IN ('active','paused','cancelled')),
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── GERÇEKLEŞen DERSLER ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS lessons (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id    INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
        student_id       INTEGER NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
        teacher_id       INTEGER          REFERENCES teachers(id)    ON DELETE SET NULL,
        lesson_date      TEXT    NOT NULL,
        start_time       TEXT,
        end_time         TEXT,
        status           TEXT    NOT NULL DEFAULT 'completed'
                         CHECK(status IN (
                           'completed','cancelled','makeup',
                           'student_absent','teacher_absent'
                         )),
        topic_covered    TEXT,
        homework         TEXT,
        teacher_notes    TEXT,
        makeup_lesson_id INTEGER          REFERENCES lessons(id)     ON DELETE SET NULL,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── ÖDEMELER ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS payments (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id       INTEGER NOT NULL  REFERENCES students(id)    ON DELETE CASCADE,
        enrollment_id    INTEGER           REFERENCES enrollments(id) ON DELETE SET NULL,
        payment_type     TEXT    NOT NULL  DEFAULT 'monthly_fee'
                         CHECK(payment_type IN (
                           'monthly_fee','registration_fee','material_fee','other'
                         )),
        amount           REAL    NOT NULL,
        discount_amount  REAL    NOT NULL  DEFAULT 0,
        total_amount     REAL    NOT NULL,
        payment_method   TEXT    NOT NULL  DEFAULT 'cash'
                         CHECK(payment_method IN (
                           'cash','credit_card','bank_transfer','eft'
                         )),
        payment_date     TEXT    NOT NULL  DEFAULT (date('now')),
        due_date         TEXT,
        period_month     INTEGER           CHECK(period_month BETWEEN 1 AND 12),
        period_year      INTEGER,
        status           TEXT    NOT NULL  DEFAULT 'paid'
                         CHECK(status IN ('paid','pending','overdue','partial')),
        receipt_number   TEXT    UNIQUE,
        notes            TEXT,
        created_by       TEXT,
        created_at       TEXT    NOT NULL  DEFAULT (datetime('now'))
      );

      -- ── GİDERLER ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS expenses (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        category       TEXT    NOT NULL DEFAULT 'other'
                       CHECK(category IN (
                         'rent','salary','utility','material','maintenance','other'
                       )),
        description    TEXT    NOT NULL,
        amount         REAL    NOT NULL,
        payment_date   TEXT    NOT NULL DEFAULT (date('now')),
        vendor         TEXT,
        receipt_number TEXT,
        notes          TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── TELAFİ DERSLERİ ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS makeup_lessons (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        original_lesson_id INTEGER          REFERENCES lessons(id)   ON DELETE SET NULL,
        student_id         INTEGER NOT NULL  REFERENCES students(id)  ON DELETE CASCADE,
        teacher_id         INTEGER           REFERENCES teachers(id)  ON DELETE SET NULL,
        scheduled_date     TEXT    NOT NULL,
        scheduled_time     TEXT,
        reason             TEXT,
        status             TEXT    NOT NULL DEFAULT 'scheduled'
                           CHECK(status IN ('scheduled','completed','cancelled')),
        notes              TEXT,
        created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── ÖĞRENCİ GELİŞİM NOTLARI ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS student_progress (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id        INTEGER NOT NULL  REFERENCES students(id)    ON DELETE CASCADE,
        teacher_id        INTEGER           REFERENCES teachers(id)    ON DELETE SET NULL,
        instrument_id     INTEGER           REFERENCES instruments(id) ON DELETE SET NULL,
        assessment_date   TEXT    NOT NULL  DEFAULT (date('now')),
        technical_score   INTEGER           CHECK(technical_score   BETWEEN 1 AND 10),
        theory_score      INTEGER           CHECK(theory_score      BETWEEN 1 AND 10),
        practice_score    INTEGER           CHECK(practice_score    BETWEEN 1 AND 10),
        performance_score INTEGER           CHECK(performance_score BETWEEN 1 AND 10),
        current_level     TEXT
                          CHECK(current_level IN (
                            'beginner','elementary','intermediate','advanced','professional'
                          )),
        current_piece     TEXT,
        notes             TEXT,
        goals             TEXT,
        created_at        TEXT    NOT NULL  DEFAULT (datetime('now'))
      );

      -- ── ENVANTER ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS inventory (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name                TEXT    NOT NULL,
        category                 TEXT    NOT NULL DEFAULT 'instrument'
                                 CHECK(category IN (
                                   'instrument','book','material','equipment'
                                 )),
        brand                    TEXT,
        model                    TEXT,
        serial_number            TEXT,
        purchase_date            TEXT,
        purchase_price           REAL,
        condition                TEXT    NOT NULL DEFAULT 'good'
                                 CHECK(condition IN ('new','good','fair','poor')),
        assigned_to_student_id   INTEGER REFERENCES students(id) ON DELETE SET NULL,
        assigned_to_teacher_id   INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        location                 TEXT,
        notes                    TEXT,
        status                   TEXT    NOT NULL DEFAULT 'available'
                                 CHECK(status IN (
                                   'available','in_use','maintenance','retired'
                                 )),
        created_at               TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── BİLDİRİMLER ───────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS notifications (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        type                TEXT    NOT NULL
                            CHECK(type IN (
                              'payment_due','lesson_reminder','birthday','other'
                            )),
        title               TEXT    NOT NULL,
        message             TEXT    NOT NULL,
        related_student_id  INTEGER REFERENCES students(id)  ON DELETE CASCADE,
        related_payment_id  INTEGER REFERENCES payments(id)  ON DELETE CASCADE,
        due_date            TEXT,
        is_read             INTEGER NOT NULL DEFAULT 0,
        is_sent             INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- ── SİSTEM AYARLARI ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,   -- JSON değer
        description TEXT,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 002 — İndeksler
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '002_create_indexes',
    sql: `
      -- students
      CREATE INDEX IF NOT EXISTS idx_students_status       ON students(status);
      CREATE INDEX IF NOT EXISTS idx_students_name         ON students(last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_students_phone        ON students(phone);
      CREATE INDEX IF NOT EXISTS idx_students_reg_date     ON students(registration_date);

      -- teachers
      CREATE INDEX IF NOT EXISTS idx_teachers_status       ON teachers(status);
      CREATE INDEX IF NOT EXISTS idx_teachers_name         ON teachers(last_name, first_name);

      -- instruments
      CREATE INDEX IF NOT EXISTS idx_instruments_active    ON instruments(is_active);

      -- enrollments
      CREATE INDEX IF NOT EXISTS idx_enrollments_student   ON enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_teacher   ON enrollments(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_status    ON enrollments(status);
      CREATE INDEX IF NOT EXISTS idx_enrollments_instrument ON enrollments(instrument_id);

      -- lessons
      CREATE INDEX IF NOT EXISTS idx_lessons_enrollment    ON lessons(enrollment_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_student       ON lessons(student_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_teacher       ON lessons(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_date          ON lessons(lesson_date);
      CREATE INDEX IF NOT EXISTS idx_lessons_status        ON lessons(status);

      -- payments
      CREATE INDEX IF NOT EXISTS idx_payments_student      ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_payments_enrollment   ON payments(enrollment_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date         ON payments(payment_date);
      CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_period       ON payments(period_year, period_month);

      -- expenses
      CREATE INDEX IF NOT EXISTS idx_expenses_date         ON expenses(payment_date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category     ON expenses(category);

      -- makeup_lessons
      CREATE INDEX IF NOT EXISTS idx_makeup_student        ON makeup_lessons(student_id);
      CREATE INDEX IF NOT EXISTS idx_makeup_status         ON makeup_lessons(status);

      -- student_progress
      CREATE INDEX IF NOT EXISTS idx_progress_student      ON student_progress(student_id);
      CREATE INDEX IF NOT EXISTS idx_progress_date         ON student_progress(assessment_date);

      -- inventory
      CREATE INDEX IF NOT EXISTS idx_inventory_status      ON inventory(status);
      CREATE INDEX IF NOT EXISTS idx_inventory_category    ON inventory(category);

      -- notifications
      CREATE INDEX IF NOT EXISTS idx_notif_student         ON notifications(related_student_id);
      CREATE INDEX IF NOT EXISTS idx_notif_is_read         ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notif_due_date        ON notifications(due_date);
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 003 — Trigger'lar (updated_at otomasyonu)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '003_create_triggers',
    sql: `
      -- students updated_at
      DROP TRIGGER IF EXISTS trg_students_updated_at;
      CREATE TRIGGER trg_students_updated_at
        AFTER UPDATE ON students
        FOR EACH ROW WHEN OLD.updated_at = NEW.updated_at
      BEGIN
        UPDATE students SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      -- teachers updated_at
      DROP TRIGGER IF EXISTS trg_teachers_updated_at;
      CREATE TRIGGER trg_teachers_updated_at
        AFTER UPDATE ON teachers
        FOR EACH ROW WHEN OLD.updated_at = NEW.updated_at
      BEGIN
        UPDATE teachers SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      -- enrollments updated_at
      DROP TRIGGER IF EXISTS trg_enrollments_updated_at;
      CREATE TRIGGER trg_enrollments_updated_at
        AFTER UPDATE ON enrollments
        FOR EACH ROW WHEN OLD.updated_at = NEW.updated_at
      BEGIN
        UPDATE enrollments SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      -- payments: receipt_number otomatik üret (LSE-YYYY-NNNNNN)
      DROP TRIGGER IF EXISTS trg_payments_receipt_number;
      CREATE TRIGGER trg_payments_receipt_number
        AFTER INSERT ON payments
        WHEN NEW.receipt_number IS NULL
      BEGIN
        UPDATE payments
          SET receipt_number = 'LSE-' ||
            strftime('%Y', 'now') || '-' ||
            printf('%05d', NEW.id)
        WHERE id = NEW.id;
      END;

      -- settings updated_at
      DROP TRIGGER IF EXISTS trg_settings_updated_at;
      CREATE TRIGGER trg_settings_updated_at
        AFTER UPDATE ON settings
        FOR EACH ROW
      BEGIN
        UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
      END;
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 004 — Seed verisi
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '004_seed_data',
    sql: `
      -- ── Enstrümanlar ─────────────────────────────────────────────────────
      INSERT OR IGNORE INTO instruments (name, category, color_code) VALUES
        ('Piyano',        'keyboard',   '#1B3A6B'),
        ('Keman',         'string',     '#C9A84C'),
        ('Viyola',        'string',     '#8B6914'),
        ('Viyolonsel',    'string',     '#5C4A1E'),
        ('Kontrbas',      'string',     '#3D3010'),
        ('Gitar',         'string',     '#2E7D32'),
        ('Bağlama',       'string',     '#558B2F'),
        ('Ud',            'string',     '#827717'),
        ('Keman (Türk)',  'string',     '#E65100'),
        ('Flüt',          'wind',       '#0277BD'),
        ('Klarnet',       'wind',       '#01579B'),
        ('Oboe',          'wind',       '#006064'),
        ('Fagot',         'wind',       '#004D40'),
        ('Saksofon',      'wind',       '#BF360C'),
        ('Trompet',       'brass',      '#F57F17'),
        ('Trombon',       'brass',      '#E65100'),
        ('Davul/Vurmalı', 'percussion', '#4A148C'),
        ('Şan (Vokal)',   'vocal',      '#880E4F'),
        ('Müzik Teorisi', 'theory',     '#37474F'),
        ('Solfej',        'theory',     '#455A64');

      -- ── Sistem ayarları ───────────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('academy_name',     '"Lirik Sanat Evi"',         'Akademi adı'),
        ('academy_phone',    '""',                         'İletişim telefonu'),
        ('academy_email',    '""',                         'E-posta adresi'),
        ('academy_address',  '""',                         'Adres'),
        ('academy_city',     '"İstanbul"',                 'Şehir'),
        ('academy_logo',     '""',                         'Logo dosya yolu'),
        ('currency',         '"₺"',                        'Para birimi sembolü'),
        ('currency_code',    '"TRY"',                      'Para birimi kodu'),
        ('tax_rate',         '0',                          'KDV oranı (%)'),
        ('late_fee_rate',    '0',                          'Gecikme zammı (%)'),
        ('payment_due_day',  '5',                          'Ödeme son gün (ayın kaçı)'),
        ('working_days',     '["monday","tuesday","wednesday","thursday","friday","saturday"]',
                                                           'Çalışma günleri'),
        ('working_hours',    '{"start":"09:00","end":"21:00"}',
                                                           'Çalışma saatleri'),
        ('lesson_room_count','1',                          'Ders odası sayısı'),
        ('notification_days_before_payment', '3',          'Ödeme hatırlatma (gün öncesi)'),
        ('auto_generate_notifications', 'true',            'Otomatik bildirim oluştur'),
        ('theme',            '"light"',                    'Tema'),
        ('language',         '"tr"',                       'Dil');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 005 — Profesyonel Ödeme Modülü tabloları
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '005_payment_module',
    sql: `
      -- ── TAKSİT PLANLARI ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS payment_plans (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        enrollment_id    INTEGER          REFERENCES enrollments(id) ON DELETE SET NULL,
        title            TEXT    NOT NULL,
        total_amount     REAL    NOT NULL,
        installment_count INTEGER NOT NULL DEFAULT 1,
        start_date       TEXT    NOT NULL,
        discount_type    TEXT    NOT NULL DEFAULT 'none'
                         CHECK(discount_type IN ('none','pesin','percentage','fixed')),
        discount_value   REAL    NOT NULL DEFAULT 0,
        notes            TEXT,
        status           TEXT    NOT NULL DEFAULT 'active'
                         CHECK(status IN ('active','completed','cancelled')),
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── TAKSİT KALEMLERİ ──────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS payment_plan_items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id         INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
        installment_no  INTEGER NOT NULL,
        due_date        TEXT    NOT NULL,
        amount          REAL    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','paid','overdue','partial')),
        payment_id      INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        paid_at         TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── KASALAR ───────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS cash_registers (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        type            TEXT    NOT NULL
                        CHECK(type IN ('cash','pos','bank','check','note')),
        current_balance REAL    NOT NULL DEFAULT 0,
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── KASA OTURUMLARI (günlük açma/kapama) ──────────────────────────────
      CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        register_id      INTEGER NOT NULL REFERENCES cash_registers(id),
        session_date     TEXT    NOT NULL,
        opening_balance  REAL    NOT NULL,
        closing_balance  REAL,
        status           TEXT    NOT NULL DEFAULT 'open'
                         CHECK(status IN ('open','closed')),
        opened_by        TEXT,
        closed_by        TEXT,
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── KASA HAREKETLERİ ──────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS cash_register_movements (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        register_id    INTEGER NOT NULL REFERENCES cash_registers(id),
        session_id     INTEGER REFERENCES cash_register_sessions(id),
        movement_type  TEXT    NOT NULL
                       CHECK(movement_type IN ('income','expense','virman_in','virman_out','opening','closing')),
        amount         REAL    NOT NULL,
        description    TEXT    NOT NULL,
        payment_id     INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        expense_id     INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
        virman_id      INTEGER,
        movement_date  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── ÇEKLER ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS checks (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        check_number    TEXT    NOT NULL,
        bank_name       TEXT    NOT NULL,
        branch          TEXT,
        account_holder  TEXT    NOT NULL,
        amount          REAL    NOT NULL,
        issue_date      TEXT    NOT NULL,
        due_date        TEXT    NOT NULL,
        student_id      INTEGER REFERENCES students(id) ON DELETE SET NULL,
        payment_id      INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        status          TEXT    NOT NULL DEFAULT 'portfolio'
                        CHECK(status IN ('portfolio','deposited','cleared','bounced','returned')),
        notes           TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── SENETLER ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS promissory_notes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        note_number  TEXT    NOT NULL,
        debtor_name  TEXT    NOT NULL,
        amount       REAL    NOT NULL,
        issue_date   TEXT    NOT NULL,
        due_date     TEXT    NOT NULL,
        student_id   INTEGER REFERENCES students(id) ON DELETE SET NULL,
        payment_id   INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        status       TEXT    NOT NULL DEFAULT 'active'
                     CHECK(status IN ('active','paid','protested','cancelled')),
        notes        TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İADE İŞLEMLERİ ────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS refunds (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        original_payment_id  INTEGER NOT NULL REFERENCES payments(id),
        student_id           INTEGER NOT NULL REFERENCES students(id),
        refund_amount        REAL    NOT NULL,
        reason               TEXT    NOT NULL,
        refund_method        TEXT    NOT NULL
                             CHECK(refund_method IN ('cash','bank_transfer','credit_card')),
        refund_date          TEXT    NOT NULL,
        receipt_number       TEXT,
        notes                TEXT,
        created_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── VİRMAN TRANSFERLERİ ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS virman_transfers (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        from_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
        to_register_id   INTEGER NOT NULL REFERENCES cash_registers(id),
        amount           REAL    NOT NULL,
        description      TEXT    NOT NULL,
        transfer_date    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── DENETİM KAYDI ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS audit_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        action      TEXT    NOT NULL CHECK(action IN ('create','update','delete')),
        table_name  TEXT    NOT NULL,
        record_id   INTEGER,
        old_values  TEXT,
        new_values  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İNDEKSLER ─────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_payment_plans_student   ON payment_plans(student_id);
      CREATE INDEX IF NOT EXISTS idx_payment_plans_status    ON payment_plans(status);
      CREATE INDEX IF NOT EXISTS idx_plan_items_plan         ON payment_plan_items(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plan_items_status       ON payment_plan_items(status);
      CREATE INDEX IF NOT EXISTS idx_plan_items_due          ON payment_plan_items(due_date);
      CREATE INDEX IF NOT EXISTS idx_register_movements_reg  ON cash_register_movements(register_id);
      CREATE INDEX IF NOT EXISTS idx_checks_due              ON checks(due_date);
      CREATE INDEX IF NOT EXISTS idx_checks_status           ON checks(status);
      CREATE INDEX IF NOT EXISTS idx_notes_due               ON promissory_notes(due_date);
      CREATE INDEX IF NOT EXISTS idx_notes_status            ON promissory_notes(status);
      CREATE INDEX IF NOT EXISTS idx_refunds_student         ON refunds(student_id);
      CREATE INDEX IF NOT EXISTS idx_audit_table             ON audit_log(table_name, record_id);

      -- ── KASA SEED DATA ─────────────────────────────────────────────────────
      INSERT INTO cash_registers (name, type) SELECT 'Nakit Kasası','cash'
        WHERE NOT EXISTS (SELECT 1 FROM cash_registers WHERE type='cash');
      INSERT INTO cash_registers (name, type) SELECT 'POS / Kredi Kartı','pos'
        WHERE NOT EXISTS (SELECT 1 FROM cash_registers WHERE type='pos');
      INSERT INTO cash_registers (name, type) SELECT 'Banka / Havale','bank'
        WHERE NOT EXISTS (SELECT 1 FROM cash_registers WHERE type='bank');
      INSERT INTO cash_registers (name, type) SELECT 'Çek Kasası','check'
        WHERE NOT EXISTS (SELECT 1 FROM cash_registers WHERE type='check');
      INSERT INTO cash_registers (name, type) SELECT 'Senet Kasası','note'
        WHERE NOT EXISTS (SELECT 1 FROM cash_registers WHERE type='note');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 008 — Personel & Maaş Yönetimi (HR/Payroll Modülü)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '008_hr_payroll_module',
    sql: `
      -- ── GELİŞMİŞ MAAŞ YAPILANDIRMASI (4 tür) ────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_salary_configs (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id       INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        salary_type      TEXT    NOT NULL DEFAULT 'fixed'
                         CHECK(salary_type IN ('fixed','per_lesson','hybrid','percentage')),
        base_salary      REAL    NOT NULL DEFAULT 0,
        per_lesson_rate  REAL    NOT NULL DEFAULT 0,
        percentage_rate  REAL    NOT NULL DEFAULT 0,
        effective_from   TEXT    NOT NULL DEFAULT (date('now')),
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── AYLIK BORDRO ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS monthly_payrolls (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id        INTEGER NOT NULL REFERENCES teachers(id),
        year              INTEGER NOT NULL,
        month             INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
        salary_type       TEXT    NOT NULL,
        lesson_count      INTEGER NOT NULL DEFAULT 0,
        lesson_minutes    INTEGER NOT NULL DEFAULT 0,
        base_amount       REAL    NOT NULL DEFAULT 0,
        bonus_total       REAL    NOT NULL DEFAULT 0,
        advance_deduction REAL    NOT NULL DEFAULT 0,
        gross_amount      REAL    NOT NULL DEFAULT 0,
        net_amount        REAL    NOT NULL DEFAULT 0,
        status            TEXT    NOT NULL DEFAULT 'draft'
                          CHECK(status IN ('draft','approved','paid')),
        payment_date      TEXT,
        payment_method    TEXT    CHECK(payment_method IN ('cash','bank_transfer','eft')),
        notes             TEXT,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE(teacher_id, year, month)
      );

      -- ── AVANSLAR ──────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_advances (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        amount       REAL    NOT NULL,
        advance_date TEXT    NOT NULL DEFAULT (date('now')),
        description  TEXT,
        payroll_id   INTEGER REFERENCES monthly_payrolls(id),
        status       TEXT    NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','deducted','cancelled')),
        created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── PRİMLER ───────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_bonuses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        payroll_id  INTEGER REFERENCES monthly_payrolls(id),
        bonus_type  TEXT    NOT NULL DEFAULT 'manual'
                    CHECK(bonus_type IN ('manual','performance')),
        amount      REAL    NOT NULL,
        reason      TEXT,
        year        INTEGER,
        month       INTEGER,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İZİN TALEPLERİ ───────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS leave_requests (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        leave_type   TEXT    NOT NULL
                     CHECK(leave_type IN ('annual','sick','excuse','unpaid')),
        start_date   TEXT    NOT NULL,
        end_date     TEXT    NOT NULL,
        days_count   INTEGER NOT NULL DEFAULT 1,
        reason       TEXT,
        status       TEXT    NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','approved','rejected')),
        approved_by  TEXT,
        approved_at  TEXT,
        notes        TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── YILLIK İZİN BAKİYESİ ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS leave_balances (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        year       INTEGER NOT NULL,
        total_days INTEGER NOT NULL DEFAULT 14,
        used_days  INTEGER NOT NULL DEFAULT 0,
        UNIQUE(teacher_id, year)
      );

      -- ── ÖZLÜK DOSYASI (belge arşivi) ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_documents (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        doc_type    TEXT    NOT NULL
                    CHECK(doc_type IN ('contract','diploma','certificate','id_copy','sgk','other')),
        title       TEXT    NOT NULL,
        file_path   TEXT    NOT NULL,
        file_name   TEXT    NOT NULL,
        upload_date TEXT    NOT NULL DEFAULT (date('now')),
        notes       TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── MEMNUNİYET ANKETLERİ ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_surveys (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        year       INTEGER NOT NULL,
        month      INTEGER NOT NULL,
        score      INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
        feedback   TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İNDEKSLER ────────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_salary_cfg_teacher ON teacher_salary_configs(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_payrolls_teacher   ON monthly_payrolls(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_payrolls_period    ON monthly_payrolls(year, month);
      CREATE INDEX IF NOT EXISTS idx_payrolls_status    ON monthly_payrolls(status);
      CREATE INDEX IF NOT EXISTS idx_advances_teacher   ON teacher_advances(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_advances_status    ON teacher_advances(status);
      CREATE INDEX IF NOT EXISTS idx_bonuses_teacher    ON teacher_bonuses(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_bonuses_period     ON teacher_bonuses(year, month);
      CREATE INDEX IF NOT EXISTS idx_leaves_teacher     ON leave_requests(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_leaves_status      ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_leave_bal_teacher  ON leave_balances(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_docs       ON teacher_documents(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_teacher    ON teacher_surveys(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_period     ON teacher_surveys(year, month);

      -- ── HR AYARLARI ───────────────────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('hr_annual_leave_days',             '14',    'Yıllık izin günü (varsayılan)'),
        ('hr_performance_bonus_enabled',     'false', 'Performans primi aktif mi'),
        ('hr_performance_bonus_min_students','10',    'Minimum aktif öğrenci sayısı (performans primi için)'),
        ('hr_performance_bonus_amount',      '500',   'Performans primi tutarı (TL)');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 007 — Gelişmiş Öğrenci CRM Modülü
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '007_crm_module',
    sql: `
      -- ── ÖN KAYITLAR ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS pre_registrations (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name           TEXT    NOT NULL,
        last_name            TEXT    NOT NULL,
        birth_date           TEXT,
        phone                TEXT,
        email                TEXT,
        parent_name          TEXT,
        parent_phone         TEXT,
        instrument_interest  TEXT,
        availability         TEXT,
        how_heard            TEXT,
        notes                TEXT,
        status               TEXT    NOT NULL DEFAULT 'pending'
                             CHECK(status IN ('pending','contacted','converted','cancelled')),
        converted_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        contacted_at         TEXT,
        created_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── VELİ PROFİLLERİ ──────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS parent_profiles (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name            TEXT    NOT NULL,
        last_name             TEXT    NOT NULL,
        phone                 TEXT,
        phone2                TEXT,
        email                 TEXT,
        address               TEXT,
        occupation            TEXT,
        sibling_discount_rate REAL    NOT NULL DEFAULT 0,
        notes                 TEXT,
        created_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── KAYIT DONDURMA GEÇMİŞİ ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS student_freezes (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id           INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        freeze_start         TEXT    NOT NULL,
        freeze_end           TEXT,
        reason               TEXT    NOT NULL,
        extend_payment_plans INTEGER NOT NULL DEFAULT 1,
        notes                TEXT,
        status               TEXT    NOT NULL DEFAULT 'active'
                             CHECK(status IN ('active','ended')),
        created_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── ÖĞRENCİ DURUM TARİHÇESİ ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS student_status_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        old_status  TEXT,
        new_status  TEXT    NOT NULL,
        reason      TEXT,
        changed_by  TEXT,
        changed_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── AYILIŞ FORMLARI ───────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS departure_records (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id         INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        departure_date     TEXT    NOT NULL,
        reason_category    TEXT    NOT NULL
                           CHECK(reason_category IN (
                             'financial','relocation','schedule',
                             'dissatisfied','graduation','health','other'
                           )),
        reason_detail      TEXT,
        would_return       INTEGER NOT NULL DEFAULT 0,
        net_promoter_score INTEGER CHECK(net_promoter_score BETWEEN 0 AND 10),
        last_lesson_date   TEXT,
        notes              TEXT,
        created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İNDEKSLER ────────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_pre_reg_status    ON pre_registrations(status);
      CREATE INDEX IF NOT EXISTS idx_pre_reg_created   ON pre_registrations(created_at);
      CREATE INDEX IF NOT EXISTS idx_freezes_student   ON student_freezes(student_id);
      CREATE INDEX IF NOT EXISTS idx_freezes_status    ON student_freezes(status);
      CREATE INDEX IF NOT EXISTS idx_status_hist_std   ON student_status_history(student_id);
      CREATE INDEX IF NOT EXISTS idx_departure_student ON departure_records(student_id);
      CREATE INDEX IF NOT EXISTS idx_parent_profiles   ON parent_profiles(last_name, first_name);
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 006 — SMS / Veli İletişim Modülü
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '006_sms_module',
    sql: `
      -- ── SMS GEÇMİŞ LOGU ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS sms_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id     INTEGER REFERENCES students(id) ON DELETE SET NULL,
        recipient_name TEXT    NOT NULL,
        phone          TEXT    NOT NULL,
        message        TEXT    NOT NULL,
        template_key   TEXT,
        status         TEXT    NOT NULL DEFAULT 'pending'
                       CHECK(status IN ('sent','failed','skipped')),
        error_message  TEXT,
        sent_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── SMS ŞABLONLARI ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS sms_templates (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        template_key TEXT    NOT NULL UNIQUE,
        name         TEXT    NOT NULL,
        content      TEXT    NOT NULL,
        is_active    INTEGER NOT NULL DEFAULT 1,
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İNDEKSLER ─────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_sms_log_student ON sms_log(student_id);
      CREATE INDEX IF NOT EXISTS idx_sms_log_sent    ON sms_log(sent_at);
      CREATE INDEX IF NOT EXISTS idx_sms_log_status  ON sms_log(status);

      -- ── ŞABLON SEED DATA ───────────────────────────────────────────────────
      INSERT OR IGNORE INTO sms_templates (template_key, name, content) VALUES
        ('payment_reminder', 'Ödeme Hatırlatma',
         'Sayın [VELİ_ADI], [ÖĞRENCİ_ADI]''nın [AY] ayı ders ücreti [TUTAR] TL, son ödeme tarihi [TARİH]. Lirik Sanat Evi'),
        ('overdue', 'Gecikmiş Ödeme',
         'Sayın [VELİ_ADI], [TUTAR] TL tutarındaki ödemeniz [GÜN] gün gecikmiştir. İletişim: [TELEFON]'),
        ('absence', 'Devamsızlık Bildirimi',
         'Sayın [VELİ_ADI], [ÖĞRENCİ_ADI] bugün [SAAT] dersine katılmadı. Bilgi için: [TELEFON]'),
        ('lesson_reminder', 'Ders Hatırlatma',
         'Sayın [VELİ_ADI], [ÖĞRENCİ_ADI]''nın yarın [SAAT] dersi bulunmaktadır. Lirik Sanat Evi'),
        ('birthday', 'Doğum Günü',
         'Lirik Sanat Evi olarak [ÖĞRENCİ_ADI]''nın doğum gününü kutlarız! Sağlık ve mutluluk dileriz.'),
        ('custom', 'Genel Duyuru', '');

      -- ── AYARLARA SMS ALANLARI ──────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('netgsm_usercode',           '""',    'Netgsm kullanıcı kodu'),
        ('netgsm_password',           '""',    'Netgsm şifre'),
        ('netgsm_msgheader',          '"LirikSanat"', 'SMS başlığı (max 11 karakter)'),
        ('sms_auto_payment_reminder', 'true',  'Otomatik ödeme hatırlatma SMS (3 gün önce)'),
        ('sms_auto_overdue',          'true',  'Otomatik gecikme SMS (1 gün sonra)'),
        ('sms_auto_birthday',         'true',  'Otomatik doğum günü SMS'),
        ('sms_auto_absence',          'true',  'Devamsızlık sonrası otomatik SMS');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 009 — Etkinlik & Konser Yönetimi
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '009_events_module',
    sql: `
      -- ── ETKİNLİKLER ────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        event_type   TEXT    NOT NULL DEFAULT 'concert'
                     CHECK(event_type IN ('concert','recital','workshop','gala','summer_school','other')),
        event_date   TEXT    NOT NULL,
        start_time   TEXT,
        end_time     TEXT,
        venue        TEXT,
        capacity     INTEGER,
        ticket_price REAL    NOT NULL DEFAULT 0,
        is_free      INTEGER NOT NULL DEFAULT 1,
        description  TEXT,
        poster_path  TEXT,
        status       TEXT    NOT NULL DEFAULT 'planning'
                     CHECK(status IN ('planning','rehearsal','ready','completed','cancelled')),
        notes        TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── ETKİNLİK KATILIMCILARI ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS event_participants (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id             INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        student_id           INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        piece_title          TEXT,
        piece_composer       TEXT,
        instrument_id        INTEGER REFERENCES instruments(id) ON DELETE SET NULL,
        stage_order          INTEGER NOT NULL DEFAULT 0,
        performance_duration INTEGER,
        is_attended          INTEGER,
        notes                TEXT,
        created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE(event_id, student_id)
      );

      -- ── PROVA TAKVİMİ ──────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS event_rehearsals (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        rehearsal_date TEXT    NOT NULL,
        start_time     TEXT,
        end_time       TEXT,
        venue          TEXT,
        notes          TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── ETKİNLİK YAPILACAKLAR LİSTESİ ─────────────────────────────────────
      CREATE TABLE IF NOT EXISTS event_checklist (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL,
        is_done     INTEGER NOT NULL DEFAULT 0,
        due_date    TEXT,
        assigned_to TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── ETKİNLİK FOTOĞRAF ARŞİVİ ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS event_photos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        file_path   TEXT    NOT NULL,
        file_name   TEXT    NOT NULL,
        caption     TEXT,
        uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── updated_at TRİGGER ─────────────────────────────────────────────────
      CREATE TRIGGER IF NOT EXISTS trg_events_updated_at
        AFTER UPDATE ON events
        FOR EACH ROW
        BEGIN
          UPDATE events SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
        END;

      -- ── İNDEKSLER ─────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_events_date        ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_events_status      ON events(status);
      CREATE INDEX IF NOT EXISTS idx_ep_event           ON event_participants(event_id);
      CREATE INDEX IF NOT EXISTS idx_ep_student         ON event_participants(student_id);
      CREATE INDEX IF NOT EXISTS idx_rehearsals_event   ON event_rehearsals(event_id);
      CREATE INDEX IF NOT EXISTS idx_checklist_event    ON event_checklist(event_id);
      CREATE INDEX IF NOT EXISTS idx_photos_event       ON event_photos(event_id);

      -- ── ETKİNLİK AYARLARI ─────────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('event_invitation_header', '"Sayın Velimiz,"',    'Davetiye üst yazısı'),
        ('event_invitation_footer', '"Saygılarımızla, Lirik Sanat Evi"', 'Davetiye alt yazısı');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 010 — Kullanıcı Yönetimi & Güvenlik
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '010_users_auth',
    sql: `
      -- ── KULLANICILAR ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL,
        email         TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'secretary'
                      CHECK(role IN ('admin','secretary','teacher','accountant')),
        is_active     INTEGER NOT NULL DEFAULT 1,
        teacher_id    INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        last_login    TEXT,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── OTURUM TOKENLARI ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS user_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       TEXT    NOT NULL UNIQUE,
        expires_at  TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── VARSAYILAN ADMİN (şifre: admin123) ───────────────────────────────
      INSERT OR IGNORE INTO users (name, email, password_hash, role)
      VALUES ('Yönetici', 'admin@lirik.com',
              '$2b$10$X1xEdYleUTMTQAfsKTyRZeTQ7sOc1muI99My7Qb0A5maB/TUw68py',
              'admin');

      -- ── İNDEKSLER ────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user  ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_exp   ON user_sessions(expires_at);

      -- ── updated_at TRİGGER ────────────────────────────────────────────────
      CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
        AFTER UPDATE ON users
        FOR EACH ROW
        BEGIN
          UPDATE users SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
        END;

      -- ── AYARLAR ──────────────────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('auto_backup_enabled', 'true', 'Otomatik günlük yedekleme'),
        ('auto_backup_keep',    '7',    'Saklanacak yedek sayısı'),
        ('screen_lock_minutes', '30',   'Ekran kilidi süre (dakika)');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 011 — Cari Hesap (Öğrenci Muhasebe Defteri)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '011_student_ledger',
    sql: `
      -- ── CARİ HESAP TABLOSU ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS student_ledger (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        transaction_type TEXT    NOT NULL CHECK(transaction_type IN (
                           'lesson_debt','payment','manual_debt',
                           'discount','refund','correction'
                         )),
        debt_amount      REAL    NOT NULL DEFAULT 0,
        credit_amount    REAL    NOT NULL DEFAULT 0,
        lesson_id        INTEGER REFERENCES lessons(id)     ON DELETE SET NULL,
        enrollment_id    INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
        payment_id       INTEGER REFERENCES payments(id)    ON DELETE SET NULL,
        description      TEXT    NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'open'
                         CHECK(status IN ('open','paid','cancelled')),
        transaction_date TEXT    NOT NULL DEFAULT (date('now')),
        created_by       TEXT,
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ── İNDEKSLER ────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_ledger_student ON student_ledger(student_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_type    ON student_ledger(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_ledger_status  ON student_ledger(status);
      CREATE INDEX IF NOT EXISTS idx_ledger_date    ON student_ledger(transaction_date);

      -- ── BAKIYE GÖRÜNÜMÜ ───────────────────────────────────────────────────
      CREATE VIEW IF NOT EXISTS student_balance AS
      SELECT
        student_id,
        SUM(debt_amount)                                                          AS total_debt,
        SUM(credit_amount)                                                        AS total_credit,
        SUM(debt_amount) - SUM(credit_amount)                                     AS balance,
        COUNT(CASE WHEN transaction_type='lesson_debt' AND status='open' THEN 1 END) AS unpaid_lessons,
        SUM(CASE WHEN transaction_type='lesson_debt' AND status='open'
                 THEN debt_amount ELSE 0 END)                                     AS unpaid_amount
      FROM student_ledger
      GROUP BY student_id;

      -- ── VERİ MİGRASYONU: tamamlanan dersler → cari borç (geçmiş = ödendi) ─
      INSERT INTO student_ledger
        (student_id, transaction_type, debt_amount, credit_amount,
         lesson_id, enrollment_id, description, status, transaction_date)
      SELECT
        l.student_id,
        'lesson_debt',
        COALESCE(ROUND(e.monthly_fee / NULLIF(e.lessons_per_week * 4, 0), 2), 0),
        0,
        l.id,
        l.enrollment_id,
        COALESCE(i.name, 'Ders') || ' dersi — ' || l.lesson_date,
        'paid',
        l.lesson_date
      FROM lessons l
      LEFT JOIN enrollments e ON l.enrollment_id = e.id
      LEFT JOIN instruments i ON e.instrument_id = i.id
      WHERE l.status = 'completed';

      -- ── VERİ MİGRASYONU: ödenen ödemeler → cari alacak ──────────────────
      INSERT INTO student_ledger
        (student_id, transaction_type, debt_amount, credit_amount,
         payment_id, description, status, transaction_date)
      SELECT
        p.student_id,
        'payment',
        0,
        p.total_amount,
        p.id,
        COALESCE(p.receipt_number, 'Ödeme') || ' — ' ||
          CASE p.payment_method
            WHEN 'cash'          THEN 'Nakit'
            WHEN 'credit_card'   THEN 'Kredi Kartı'
            WHEN 'bank_transfer' THEN 'Havale/EFT'
            WHEN 'eft'           THEN 'EFT'
            ELSE p.payment_method
          END,
        'paid',
        p.payment_date
      FROM payments p
      WHERE p.status = 'paid';

      -- ── AYARLAR ───────────────────────────────────────────────────────────
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('ledger_lesson_weeks', '4', 'Aylık ders haftası (ücret hesabı için)');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 012 — Cari Hesap: Ders Fiyatlandırma Tipleri & Ayarlar
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '012_ledger_pricing',
    sql: `
      INSERT OR IGNORE INTO settings (key, value, description) VALUES
        ('charge_absent_student', 'true',  'Öğrenci gelmediğinde ücret kesilsin'),
        ('charge_late_cancel',    'false', 'Son dakika iptalde ücret kesilsin');
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 013 — Öğretmen Cari Hesabı
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '013_teacher_ledger',
    sql: `
      -- ── ÖĞRETMEN CARİ HESAP TABLOSU ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS teacher_ledger (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id       INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        transaction_type TEXT    NOT NULL CHECK(transaction_type IN (
                           'lesson_earned', 'payment_made', 'manual_adjustment'
                         )),
        earned_amount    REAL    NOT NULL DEFAULT 0,  -- öğretmen bu dersten kazandı
        paid_amount      REAL    NOT NULL DEFAULT 0,  -- öğretmene ödenen
        lesson_id        INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
        student_id       INTEGER REFERENCES students(id) ON DELETE SET NULL,
        description      TEXT    NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'active'
                         CHECK(status IN ('active','cancelled')),
        transaction_date TEXT    NOT NULL DEFAULT (date('now','localtime')),
        created_by       TEXT,
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_teacher_ledger_teacher ON teacher_ledger(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_ledger_date    ON teacher_ledger(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_teacher_ledger_lesson  ON teacher_ledger(lesson_id);

      -- ── BAKIYE GÖRÜNÜMÜ ───────────────────────────────────────────────────
      CREATE VIEW IF NOT EXISTS teacher_balance AS
      SELECT
        teacher_id,
        SUM(earned_amount)                   AS total_earned,
        SUM(paid_amount)                     AS total_paid,
        SUM(earned_amount) - SUM(paid_amount) AS balance
      FROM teacher_ledger
      WHERE status != 'cancelled'
      GROUP BY teacher_id;
    `
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 014 — lessons.enrollment_id nullable (cari hesaptan manuel ders girişi)
  // Gerçek DDL işi applyLessonsEnrollmentNullable() helper'ında yapılır
  // çünkü PRAGMA foreign_keys transaction içinde çalışmaz.
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '014_lessons_enrollment_nullable',
    sql: `SELECT 1;` // DDL işi migration runner'daki helper fonksiyonunda yapılır
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 015 — lessons tablosuna ders onay kolonları (confirmation_status, note)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '015_lesson_schedule_confirmation',
    sql: `SELECT 1;` // DDL işi applyLessonConfirmationColumns() helper'ında yapılır
  },
  // ──────────────────────────────────────────────────────────────────────────
  // 016 — teachers tablosuna renk kodu kolonu
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '016_teacher_color_code',
    sql: `SELECT 1;` // DDL işi applyTeacherColorColumn() helper'ında yapılır
  },
  // ──────────────────────────────────────────────────────────────────────────
  // 017 — Öğretmen–Enstrüman bağlantı tablosu
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: '017_teacher_instruments',
    sql: `
      CREATE TABLE IF NOT EXISTS teacher_instruments (
        teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        PRIMARY KEY (teacher_id, instrument_id)
      );
      CREATE INDEX IF NOT EXISTS idx_teacher_instruments_teacher     ON teacher_instruments(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_instruments_instrument  ON teacher_instruments(instrument_id);
    `
  },
  // Placeholder: ders geçmişi artık confirmation_status ile filtreleniyor
  {
    name: '018_fix_future_lesson_status',
    sql: `SELECT 1;`
  },
  {
    name: '019_departure_ratings',
    sql: `SELECT 1;`
  }
]

// ─────────────────────────────────────────────────────────────────────────────
// Migration runner
// ─────────────────────────────────────────────────────────────────────────────

/** teachers tablosuna HR sütunları ekler (idempotent) */
function applyTeacherHrColumns(db: Database.Database): void {
  const cols = (db.pragma('table_info(teachers)') as { name: string }[]).map(c => c.name)
  if (!cols.includes('tc_kimlik_no'))   db.exec(`ALTER TABLE teachers ADD COLUMN tc_kimlik_no TEXT`)
  if (!cols.includes('sgk_no'))         db.exec(`ALTER TABLE teachers ADD COLUMN sgk_no TEXT`)
  if (!cols.includes('contract_type'))  db.exec(`ALTER TABLE teachers ADD COLUMN contract_type TEXT`)
  if (!cols.includes('contract_start')) db.exec(`ALTER TABLE teachers ADD COLUMN contract_start TEXT`)
  if (!cols.includes('contract_end'))   db.exec(`ALTER TABLE teachers ADD COLUMN contract_end TEXT`)
}

/** students tablosuna yeni sütunlar ekler (idempotent) */
function applyStudentCrmColumns(db: Database.Database): void {
  const cols = (db.pragma('table_info(students)') as { name: string }[]).map(c => c.name)
  if (!cols.includes('referral_source')) {
    db.exec(`ALTER TABLE students ADD COLUMN referral_source TEXT`)
  }
  if (!cols.includes('referred_by_student_id')) {
    db.exec(`ALTER TABLE students ADD COLUMN referred_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL`)
  }
  if (!cols.includes('parent_profile_id')) {
    // FK referansı: parent_profiles tablosu migration SQL içinde oluşturulur
    // SQLite ALTER TABLE ADD COLUMN FK desteği için tablodan bağımsız INTEGER olarak ekliyoruz
    db.exec(`ALTER TABLE students ADD COLUMN parent_profile_id INTEGER`)
  }
}

/** enrollments tablosuna fiyatlandırma sütunları ekler (idempotent) */
function applyEnrollmentPricingColumn(db: Database.Database): void {
  const cols = (db.pragma('table_info(enrollments)') as { name: string }[]).map(c => c.name)
  if (!cols.includes('lesson_pricing_type'))
    db.exec(`ALTER TABLE enrollments ADD COLUMN lesson_pricing_type TEXT DEFAULT 'monthly'`)
  if (!cols.includes('per_lesson_fee'))
    db.exec(`ALTER TABLE enrollments ADD COLUMN per_lesson_fee REAL DEFAULT 0`)
}

/**
 * lessons.enrollment_id sütununu nullable yapar (idempotent).
 * PRAGMA foreign_keys transaction içinde çalışmadığından bu helper
 * doğrudan db.exec() ile transaction dışında çalıştırılır.
 * Mevcut tablo şeması sqlite_master'dan okunur — kolon uyuşmazlığı olmaz.
 */
function applyLessonsEnrollmentNullable(db: Database.Database): void {
  const cols = db.pragma('table_info(lessons)') as { name: string; notnull: number }[]
  const enrollmentCol = cols.find(c => c.name === 'enrollment_id')
  if (!enrollmentCol || enrollmentCol.notnull === 0) return // zaten nullable

  // Mevcut CREATE TABLE SQL'ini al ve enrollment_id'yi nullable yap
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='lessons'`).get() as { sql: string } | undefined
  if (!row) return

  // "enrollment_id    INTEGER NOT NULL" → "enrollment_id    INTEGER" (REFERENCES kısmını koru)
  const newSql = row.sql
    .replace(/lessons/, 'lessons_new')
    .replace(/(enrollment_id\s+INTEGER)\s+NOT NULL/i, '$1')

  const colNames = cols.map(c => `"${c.name}"`).join(', ')

  db.pragma('foreign_keys = OFF')
  db.exec(`DROP TABLE IF EXISTS lessons_new;`)
  db.exec(newSql)
  db.exec(`INSERT INTO lessons_new (${colNames}) SELECT ${colNames} FROM lessons;`)
  db.exec(`DROP TABLE lessons;`)
  db.exec(`ALTER TABLE lessons_new RENAME TO lessons;`)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lessons_enrollment ON lessons(enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_student    ON lessons(student_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_teacher    ON lessons(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_date       ON lessons(lesson_date);
    CREATE INDEX IF NOT EXISTS idx_lessons_status     ON lessons(status);
  `)
  db.pragma('foreign_keys = ON')
}

/** lessons tablosuna ders onay sütunları ekler (idempotent) */
function applyLessonConfirmationColumns(db: Database.Database): void {
  const cols = (db.pragma('table_info(lessons)') as { name: string }[]).map(c => c.name)
  if (!cols.includes('confirmation_status')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT 'pending'`)
  }
  if (!cols.includes('confirmation_note')) {
    db.exec(`ALTER TABLE lessons ADD COLUMN confirmation_note TEXT`)
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_lessons_confirmation ON lessons(confirmation_status)`)
}

/** teachers tablosuna renk kodu sütunu ekler ve mevcut öğretmenlere varsayılan renkler atar (idempotent) */
function applyTeacherColorColumn(db: Database.Database): void {
  const cols = (db.pragma('table_info(teachers)') as { name: string }[]).map(c => c.name)
  if (!cols.includes('color_code')) {
    db.exec(`ALTER TABLE teachers ADD COLUMN color_code TEXT NOT NULL DEFAULT '#1B3A6B'`)
  }
  const defaultColors = [
    '#7C3AED','#0369A1','#047857','#B45309','#BE123C',
    '#0F766E','#6D28D9','#0E7490','#15803D','#C2410C',
    '#4338CA','#9D174D'
  ]
  const teachers = db.prepare('SELECT id FROM teachers ORDER BY id').all() as { id: number }[]
  const updateColor = db.prepare(
    "UPDATE teachers SET color_code = ? WHERE id = ? AND color_code = '#1B3A6B'"
  )
  teachers.forEach((t, i) => {
    updateColor.run(defaultColors[i % defaultColors.length], t.id)
  })
}

/** lessons ve payments tablolarına cari hesap sütunları ekler (idempotent) */
function applyLedgerColumns(db: Database.Database): void {
  const lessonCols = (db.pragma('table_info(lessons)') as { name: string }[]).map(c => c.name)
  if (!lessonCols.includes('lesson_fee'))
    db.exec(`ALTER TABLE lessons ADD COLUMN lesson_fee REAL DEFAULT 0`)
  if (!lessonCols.includes('ledger_entry_id'))
    db.exec(`ALTER TABLE lessons ADD COLUMN ledger_entry_id INTEGER`)

  const paymentCols = (db.pragma('table_info(payments)') as { name: string }[]).map(c => c.name)
  if (!paymentCols.includes('ledger_entry_id'))
    db.exec(`ALTER TABLE payments ADD COLUMN ledger_entry_id INTEGER`)
}

export function runMigrations(db: Database.Database): void {
  // Migration takip tablosunu oluştur
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[])
      .map(r => r.name)
  )

  const applyMigration = db.transaction((migration: Migration) => {
    db.exec(migration.sql)
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name)
    console.log(`✓ Migrasyon uygulandı: ${migration.name}`)
  })

  let count = 0
  for (const migration of ALL_MIGRATIONS) {
    if (!applied.has(migration.name)) {
      // HR modülü öncesi ALTER TABLE kolonlarını idempotent ekle
      if (migration.name === '008_hr_payroll_module') {
        applyTeacherHrColumns(db)
      }
      // CRM modülü öncesi ALTER TABLE kolonlarını idempotent ekle
      if (migration.name === '007_crm_module') {
        applyStudentCrmColumns(db)
      }
      // Cari hesap modülü öncesi ALTER TABLE kolonlarını idempotent ekle
      if (migration.name === '011_student_ledger') {
        applyLedgerColumns(db)
      }
      // Cari fiyatlandırma modülü öncesi enrollment sütunlarını idempotent ekle
      if (migration.name === '012_ledger_pricing') {
        applyEnrollmentPricingColumn(db)
      }
      // lessons.enrollment_id → nullable (PRAGMA transaction dışında çalışmalı)
      if (migration.name === '014_lessons_enrollment_nullable') {
        applyLessonsEnrollmentNullable(db)
      }
      // lessons onay sütunları (idempotent ALTER TABLE)
      if (migration.name === '015_lesson_schedule_confirmation') {
        applyLessonConfirmationColumns(db)
      }
      // teachers renk kodu sütunu (idempotent ALTER TABLE)
      if (migration.name === '016_teacher_color_code') {
        applyTeacherColorColumn(db)
      }
      // departure_records değerlendirme sütunları
      if (migration.name === '019_departure_ratings') {
        const depCols = (db.pragma('table_info(departure_records)') as { name: string }[]).map(c => c.name)
        if (!depCols.includes('student_rating'))
          db.exec(`ALTER TABLE departure_records ADD COLUMN student_rating INTEGER CHECK(student_rating BETWEEN 1 AND 5)`)
        if (!depCols.includes('school_rating'))
          db.exec(`ALTER TABLE departure_records ADD COLUMN school_rating INTEGER CHECK(school_rating BETWEEN 1 AND 5)`)
      }
      applyMigration(migration)
      count++
    }
  }

  if (count === 0) {
    console.log('Veritabanı güncel, yeni migrasyon yok.')
  } else {
    console.log(`${count} migrasyon başarıyla uygulandı.`)
  }
}
