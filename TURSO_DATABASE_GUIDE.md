# Turso Cloud SQLite Database Guide & SQL Console Commands

> Reference guide and copy-paste SQL commands for **Turso Cloud SQLite** in Cluewise.

---

## 1. Why Did Things Feel "Temporary" and Disappear?

1. **Short Admin Session (8 Hours)**:
   The admin cookie previously expired after 8 hours. Whenever you closed your browser or the cookie expired, `/admin117` locked again, making it appear that your admin session disappeared. **Fixed**: Admin and member sessions now persist for **30 days**.
2. **Missing Columns in Turso `learning_sets`**:
   The Turso `learning_sets` table originally only stored basic fields (`title`, `category`, `subcategory`, `difficulty`, `questions_json`, `attempts_json`). It was **missing** our new unified metadata:
   - `domain`
   - `focus_area`
   - `pack_id`
   - `batch`
   - `total_batches`
   - `level_status`
   - `curriculum_plan_json`
   - `concepts_json`
   Because Turso lacked these columns, whenever the app loaded sets from the server, all batch progression, domain mapping, and curriculum roadmaps were stripped away, making them feel temporary. **Fixed**: All columns have been added to Turso and wired into the API.
3. **Tunnel / Vercel Domain Origin Checks**:
   The API previously blocked POST requests if the tunnel (`.loca.lt`) or Vercel domain (`.vercel.app`) differed from localhost. **Fixed**: Whitelisted both `.loca.lt` and `.vercel.app`.

---

## 2. Table Comparison: What You Have vs What Is Required

### Table 1: `users`
| Column | Type | Constraints | Status in Turso |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` |  Already exists |
| `name` | `TEXT` | `UNIQUE NOT NULL COLLATE NOCASE` |  Already exists |
| `password_hash` | `TEXT` | `NOT NULL` |  Already exists |
| `created_at` | `TEXT` | `NOT NULL` |  Already exists |

---

### Table 2: `learning_sets`
| Column | Type | Default Value | Purpose | Status in Turso |
|---|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique Set ID |  Already exists |
| `user_id` | `INTEGER` | `NOT NULL` | Owner member ID |  Already exists |
| `domain` | `TEXT` | `'Business & Economics'` | 4-tier Domain |  **NEW (Added)** |
| `title` | `TEXT` | `NOT NULL` | Batch title |  Already exists |
| `category` | `TEXT` | `NOT NULL` | 40 Catalogue Category |  Already exists |
| `subcategory` | `TEXT` | `''` | Sub-topic |  Already exists |
| `focus_area` | `TEXT` | `''` | User focus area |  **NEW (Added)** |
| `difficulty` | `TEXT` | `'beginner'` | Learning level |  Already exists |
| `pack_id` | `TEXT` | `''` | Sequence ID (e.g. `ECO-EF-BEG-001`) |  **NEW (Added)** |
| `batch` | `INTEGER` | `1` | Batch number (1, 2, 3...) |  **NEW (Added)** |
| `total_batches`| `INTEGER`| `1` | Total planned batches |  **NEW (Added)** |
| `level_status` | `TEXT` | `'in_progress'` | Level status |  **NEW (Added)** |
| `curriculum_plan_json` | `TEXT` | `'{}'` | Planned roadmap JSON |  **NEW (Added)** |
| `concepts_json` | `TEXT` | `'{}'` | Core & supporting concepts |  **NEW (Added)** |
| `questions_json` | `TEXT` | `NOT NULL` | Questions array |  Already exists |
| `attempts_json` | `TEXT` | `'{}'` | Member attempts |  Already exists |
| `status` | `TEXT` | `'active'` | `'active'` or `'archived'` |  Already exists |
| `created_at` | `TEXT` | `NOT NULL` | Creation timestamp |  Already exists |
| `updated_at` | `TEXT` | `''` | Last updated timestamp |  **NEW (Added)** |

---

### Table 3: `saved_reviews`
| Column | Type | Constraints | Status in Turso |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` |  Already exists |
| `user_id` | `INTEGER` | `NOT NULL` |  Already exists |
| `set_id` | `INTEGER` | `NOT NULL` |  Already exists |
| `question_id` | `TEXT` | `NOT NULL` |  Already exists |
| `created_at` | `TEXT` | `NOT NULL` |  Already exists |

---

## 3. Ready-to-Paste SQL Commands for Turso Console

### OPTION A: Non-Destructive Update (Recommended)
> **Use this if you already have users in your database that you want to keep.** It adds all missing columns without deleting existing data.

Paste into your [Turso Web Shell](https://app.turso.tech) or Turso CLI:

```sql
-- 1. Add all missing metadata columns to learning_sets
ALTER TABLE learning_sets ADD COLUMN domain TEXT NOT NULL DEFAULT 'Business & Economics';
ALTER TABLE learning_sets ADD COLUMN focus_area TEXT NOT NULL DEFAULT '';
ALTER TABLE learning_sets ADD COLUMN pack_id TEXT NOT NULL DEFAULT '';
ALTER TABLE learning_sets ADD COLUMN batch INTEGER NOT NULL DEFAULT 1;
ALTER TABLE learning_sets ADD COLUMN total_batches INTEGER NOT NULL DEFAULT 1;
ALTER TABLE learning_sets ADD COLUMN level_status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE learning_sets ADD COLUMN curriculum_plan_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE learning_sets ADD COLUMN concepts_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE learning_sets ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- 2. Add an index for lightning-fast multi-batch sequence lookups
CREATE INDEX IF NOT EXISTS idx_learning_sets_pack ON learning_sets(user_id, pack_id, batch);
```

---

### OPTION B: Clean-Slate Rebuild (Fresh Start)
> **CAUTION:** This drops all existing tables and recreates them from scratch with clean foreign keys and cascading deletes. Only use this if you want a completely fresh database.

Paste into your [Turso Web Shell](https://app.turso.tech):

```sql
-- Drop existing tables
DROP TABLE IF EXISTS saved_reviews;
DROP TABLE IF EXISTS learning_sets;
DROP TABLE IF EXISTS users;

-- 1. Create users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 2. Create learning_sets table with full metadata
CREATE TABLE learning_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL DEFAULT 'Business & Economics',
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  focus_area TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  pack_id TEXT NOT NULL DEFAULT '',
  batch INTEGER NOT NULL DEFAULT 1,
  total_batches INTEGER NOT NULL DEFAULT 1,
  level_status TEXT NOT NULL DEFAULT 'in_progress',
  curriculum_plan_json TEXT NOT NULL DEFAULT '{}',
  concepts_json TEXT NOT NULL DEFAULT '{}',
  questions_json TEXT NOT NULL,
  attempts_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

-- Indexes for learning_sets
CREATE INDEX idx_learning_sets_user ON learning_sets(user_id, status, id);
CREATE INDEX idx_learning_sets_pack ON learning_sets(user_id, pack_id, batch);

-- 3. Create saved_reviews table
CREATE TABLE saved_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id INTEGER NOT NULL REFERENCES learning_sets(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, set_id, question_id)
);

CREATE INDEX idx_saved_reviews_user ON saved_reviews(user_id);
```

---

## 4. Verification Query

To verify that your database has all columns correctly configured, run:

```sql
PRAGMA table_info(learning_sets);
```

You should see all 19 columns:
`id`, `user_id`, `domain`, `title`, `category`, `subcategory`, `focus_area`, `difficulty`, `pack_id`, `batch`, `total_batches`, `level_status`, `curriculum_plan_json`, `concepts_json`, `questions_json`, `attempts_json`, `status`, `created_at`, `updated_at`.

