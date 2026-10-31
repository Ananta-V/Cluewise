# Cluewise database schema

The API initializes this schema automatically through `CREATE TABLE IF NOT EXISTS` statements. This file is provided for inspection; do not run a separate manual setup unless you want to inspect the schema independently.

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE learning_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  questions_json TEXT NOT NULL,
  attempts_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE saved_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  set_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, set_id, question_id)
);
```
