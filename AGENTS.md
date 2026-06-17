# the-api-langs Agent Guide

## What the user must have first

Before using any example in this guide, the user must have:

- Node.js 18+ or Bun 1+.
- PostgreSQL running and reachable from the application.
- `the-api` installed in the application.
- `the-api-langs` installed in the application.
- Database tables created before the API handles real traffic.

Install the packages:

```bash
bun add the-api the-api-langs
```

```bash
npm install the-api the-api-langs
```

Minimum PostgreSQL environment:

```env
PORT=7788

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
```

`the-api-langs` ships migrations for `dict` and `languages`. Those migrations
run automatically when the exported `langs` routing is passed into `TheAPI` and
database environment variables are present.

The examples below also use an application table named `testNews`. Create it in
your own migration:

```js
// migrations/20260616000100_create_test_news.js
exports.up = async (knex) => {
  if (!(await knex.schema.hasTable('testNews'))) {
    await knex.schema.createTable('testNews', (table) => {
      table.increments('id');
      table.timestamp('timeCreated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('timeUpdated').nullable();
      table.timestamp('timeDeleted').nullable();
      table.boolean('isDeleted').notNullable().defaultTo(false);
      table.string('name', 4096).notNullable();
      table.string('slug', 256).nullable();
      table.text('body').nullable();
    });
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('testNews');
};
```

If you need to create the example schema manually instead of using migrations,
use equivalent SQL:

```sql
CREATE TABLE IF NOT EXISTS "dict" (
  "id" SERIAL PRIMARY KEY,
  "textKey" INTEGER NOT NULL,
  "lang" VARCHAR(2) NOT NULL,
  "text" VARCHAR(4096) NOT NULL
);

CREATE INDEX IF NOT EXISTS dict_text_idx ON "dict" ("text");
CREATE INDEX IF NOT EXISTS dict_text_key_idx ON "dict" ("textKey");
CREATE INDEX IF NOT EXISTS dict_lang_text_idx ON "dict" ("lang", "text");
CREATE UNIQUE INDEX IF NOT EXISTS dict_lang_text_key_idx
  ON "dict" ("lang", "textKey");

CREATE TABLE IF NOT EXISTS "languages" (
  "id" SERIAL PRIMARY KEY,
  "timeCreated" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "timeUpdated" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "code" VARCHAR(2) NOT NULL,
  "nativeName" VARCHAR(128) NOT NULL,
  "englishName" VARCHAR(128) NOT NULL,
  "textDirection" VARCHAR(3) NOT NULL DEFAULT 'ltr',
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS languages_code_idx ON "languages" ("code");
CREATE INDEX IF NOT EXISTS languages_native_name_idx ON "languages" ("nativeName");
CREATE INDEX IF NOT EXISTS languages_english_name_idx ON "languages" ("englishName");
CREATE INDEX IF NOT EXISTS languages_is_active_idx ON "languages" ("isActive");

CREATE TABLE IF NOT EXISTS "testNews" (
  "id" SERIAL PRIMARY KEY,
  "timeCreated" TIMESTAMP NOT NULL DEFAULT now(),
  "timeUpdated" TIMESTAMP NULL,
  "timeDeleted" TIMESTAMP NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "name" VARCHAR(4096) NOT NULL,
  "slug" VARCHAR(256) NULL,
  "body" TEXT NULL
);
```

Seed data used by the examples:

```sql
INSERT INTO "languages" ("code", "nativeName", "englishName")
VALUES
  ('en', 'English', 'English'),
  ('de', 'Deutsch', 'German'),
  ('es', 'Espanol', 'Spanish')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "dict" ("textKey", "lang", "text")
VALUES
  (1001, 'en', 'Hello world'),
  (1001, 'de', 'Hallo Welt'),
  (1001, 'es', 'Hola mundo'),
  (1002, 'en', 'Public API'),
  (1002, 'de', 'Oeffentliche API'),
  (1002, 'es', 'API publica')
ON CONFLICT ("lang", "textKey") DO UPDATE
SET "text" = EXCLUDED."text";

INSERT INTO "testNews" ("name", "slug", "body")
VALUES
  ('Hello world', 'hello-world', 'Source text is stored in English.'),
  ('Public API', 'public-api', 'The response can be localized.');
```

## Purpose

`the-api-langs` is a small module for applications built with `the-api`. It
exports a ready-to-use `Routings` instance named `langs`.

Use it when an application needs multilingual text dictionaries and localized
CRUD responses through the `the-api` `_lang` query parameter.

This package does three things:

- Registers migrations for the dictionary table.
- Registers migrations for language metadata.
- Provides a shared module that can be included in many application APIs.

This package does not create HTTP endpoints by itself. If an application needs
CRUD endpoints for translation management, define them explicitly with
`router.crud({ table: 'dict', prefix: 'langs' })` or with custom routes.

## Package API

The public API is intentionally small:

```ts
import { langs } from 'the-api-langs';
```

`langs` is an instance of `Routings` from `the-api-routings`. Its configured
migration directory points to this package's `src/migrations`.

The source is:

```ts
import { resolve } from 'path';
import { Routings } from 'the-api-routings';

const langs = new Routings({
  migrationDirs: [resolve(`${import.meta.dir}/../src/migrations`)],
});

export { langs };
```

Application code should import from `the-api-langs`, not from this package's
internal migration files.

## Quickstart

Create an API module that includes `langs`, exposes dictionary CRUD routes, and
enables translation on an application table.

```ts
// index.ts
import { Routings, TheAPI, middlewares } from 'the-api';
import { langs } from 'the-api-langs';

const router = new Routings({ migrationDirs: ['./migrations'] });

router.crud({
  table: 'dict',
  prefix: 'langs',
});

router.crud({
  table: 'testNews',
  translate: ['name'],
  searchFields: ['name'],
});

const theAPI = new TheAPI({
  routings: [middlewares.common, langs, router],
});

await theAPI.up();
```

Run with Bun:

```bash
bun --env-file=.env index.ts
```

Run with Node after compiling your TypeScript, or use a TypeScript runner that
matches your application conventions:

```bash
node dist/index.js
```

Request:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=de'
```

Answer:

```json
{
  "result": [
    { "id": 1, "name": "Hallo Welt" },
    { "id": 2, "name": "Oeffentliche API" }
  ],
  "meta": {
    "total": 2,
    "limit": 20,
    "skip": 0,
    "page": 1,
    "pages": 1,
    "isFirstPage": true,
    "isLastPage": true
  },
  "error": false
}
```

The exact `meta.limit` depends on the `the-api` default limit and environment.

## How translation works

`the-api` performs translation for fields listed in a CRUD definition's
`translate` option.

For each translated field:

1. The application table stores the canonical English text.
2. The `dict` table stores one `textKey` group per phrase.
3. The English row in `dict` maps the source text to the `textKey`.
4. Other language rows with the same `textKey` contain localized text.
5. A request with `_lang=<code>` replaces the selected translated field in the
   response.

Example dictionary group:

| textKey | lang | text |
| --- | --- | --- |
| 1001 | en | Hello world |
| 1001 | de | Hallo Welt |
| 1001 | es | Hola mundo |

Example source row:

| id | name | slug |
| --- | --- | --- |
| 1 | Hello world | hello-world |

Example request:

```bash
curl 'http://localhost:7788/testNews/1?_fields=id,name,slug&_lang=es'
```

Answer:

```json
{
  "result": {
    "id": 1,
    "name": "Hola mundo",
    "slug": "hello-world"
  },
  "error": false
}
```

## Tables

### `dict`

`dict` stores translated text values.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | integer | yes | Primary key. |
| `textKey` | integer | yes | Shared key for all translations of one phrase. |
| `lang` | string(2) | yes | Language code such as `en`, `de`, or `es`. |
| `text` | string(4096) | yes | Source or translated text. |

Indexes:

- `dict_text_idx` on `text`.
- `dict_text_key_idx` on `textKey`.
- `dict_lang_text_idx` on `lang, text`.
- `dict_lang_text_key_idx` unique on `lang, textKey`.

Rules:

- Use exactly one English source row per `textKey`.
- Keep `lang` to two characters because the schema is `string(2)`.
- Do not duplicate `(lang, textKey)`.
- The application table should store the same text as the English `dict` row
  for translated fields.

### `languages`

`languages` stores metadata for available languages.

| Column | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | integer | yes | Primary key. |
| `timeCreated` | timestamptz | yes | Creation time. |
| `timeUpdated` | timestamptz | yes | Update time. |
| `code` | string(2) | yes | Unique language code. |
| `nativeName` | string(128) | yes | Name written in that language. |
| `englishName` | string(128) | yes | Name written in English. |
| `textDirection` | string(3) | yes | `ltr` or `rtl`; defaults to `ltr`. |
| `isActive` | boolean | yes | Metadata flag; defaults to `true`. |

Indexes:

- `languages_code_idx` unique on `code`.
- `languages_native_name_idx` on `nativeName`.
- `languages_english_name_idx` on `englishName`.
- `languages_is_active_idx` on `isActive`.

The `languages` table is metadata. Current `_lang` translation reads from
`dict`; it does not automatically reject inactive language codes.

## CRUD configuration

Minimum translated CRUD:

```ts
router.crud({
  table: 'testNews',
  translate: ['name'],
});
```

Translated CRUD with search:

```ts
router.crud({
  table: 'testNews',
  translate: ['name'],
  searchFields: ['name'],
});
```

Dictionary admin CRUD:

```ts
router.crud({
  table: 'dict',
  prefix: 'langs',
});
```

Language metadata CRUD:

```ts
router.crud({
  table: 'languages',
});
```

Production APIs should usually protect dictionary and language metadata writes:

```ts
router.crud({
  table: 'dict',
  prefix: 'langs',
  permissions: {
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});
```

## Common requests

Create a dictionary row:

```bash
curl -X POST 'http://localhost:7788/langs' \
  -H 'Content-Type: application/json' \
  -d '{"textKey":1003,"lang":"en","text":"Settings"}'
```

Answer:

```json
{
  "result": {
    "id": 7,
    "textKey": 1003,
    "lang": "en",
    "text": "Settings"
  },
  "error": false
}
```

Create a localized dictionary row:

```bash
curl -X POST 'http://localhost:7788/langs' \
  -H 'Content-Type: application/json' \
  -d '{"textKey":1003,"lang":"de","text":"Einstellungen"}'
```

Answer:

```json
{
  "result": {
    "id": 8,
    "textKey": 1003,
    "lang": "de",
    "text": "Einstellungen"
  },
  "error": false
}
```

Create source application content:

```bash
curl -X POST 'http://localhost:7788/testNews' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Settings","slug":"settings","body":"Application settings."}'
```

Answer:

```json
{
  "result": {
    "id": 3,
    "name": "Settings",
    "slug": "settings",
    "body": "Application settings.",
    "isDeleted": false
  },
  "error": false
}
```

Read in German:

```bash
curl 'http://localhost:7788/testNews/3?_fields=id,name,slug&_lang=de'
```

Answer:

```json
{
  "result": {
    "id": 3,
    "name": "Einstellungen",
    "slug": "settings"
  },
  "error": false
}
```

Filter by translated text:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=de&name=Hallo%20Welt'
```

Answer:

```json
{
  "result": [
    { "id": 1, "name": "Hallo Welt" }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "skip": 0,
    "page": 1,
    "pages": 1,
    "isFirstPage": true,
    "isLastPage": true
  },
  "error": false
}
```

Search translated text:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=es&_search=Hola'
```

Answer:

```json
{
  "result": [
    { "id": 1, "name": "Hola mundo" }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "skip": 0,
    "page": 1,
    "pages": 1,
    "isFirstPage": true,
    "isLastPage": true
  },
  "error": false
}
```

List dictionary rows for one phrase:

```bash
curl 'http://localhost:7788/langs?textKey=1001&_sort=lang'
```

Answer:

```json
{
  "result": [
    { "id": 2, "textKey": 1001, "lang": "de", "text": "Hallo Welt" },
    { "id": 1, "textKey": 1001, "lang": "en", "text": "Hello world" },
    { "id": 3, "textKey": 1001, "lang": "es", "text": "Hola mundo" }
  ],
  "error": false
}
```

## Recommended application structure

Use one application module for language setup and keep route definitions close
to the owning feature.

```text
src/
  index.ts
  migrations/
    20260616000100_create_test_news.js
  modules/
    news/
      routes.ts
```

Example:

```ts
// src/modules/news/routes.ts
import { Routings } from 'the-api';

export const newsRoutes = new Routings();

newsRoutes.crud({
  table: 'testNews',
  translate: ['name'],
  searchFields: ['name'],
});
```

```ts
// src/index.ts
import { Routings, TheAPI, middlewares } from 'the-api';
import { langs } from 'the-api-langs';
import { newsRoutes } from './modules/news/routes.js';

const adminRoutes = new Routings({ migrationDirs: ['./migrations'] });

adminRoutes.crud({ table: 'dict', prefix: 'langs' });
adminRoutes.crud({ table: 'languages' });

const theAPI = new TheAPI({
  routings: [middlewares.common, langs, adminRoutes, newsRoutes],
});

await theAPI.up();
```

## Migration behavior

`TheAPI` collects `migrationDirs` from every `Routings` instance passed in
`routings`. When database environment variables are present, it creates a Knex
connection, runs all migrations, introspects the schema, and then registers
routes.

That means:

- Include `langs` in `routings` before startup to install or update language
  tables.
- Keep application migrations in your application repository.
- Do not copy this package's migration files into every app unless you have a
  deliberate reason.
- Do not edit `dist/` migration output by hand. Change `src/migrations` in this
  package and rebuild.

Migration history in this package:

- `20240525132746_init_langs.js` creates the old `langs` table.
- `20260427193323_add_languages.js` creates `languages`.
- `20260427211407_rename_langs_to_dict.js` renames `langs` to `dict` and
  renames indexes.

Existing installations that already have `langs` are migrated to `dict`.

## Working with dictionary data

Prefer stable `textKey` values. A common pattern is:

- Reserve numeric ranges per feature, such as `1000-1999` for news and
  `2000-2999` for catalog text.
- Store English source strings in application tables.
- Store every translation in `dict`.
- Upsert translations by `(lang, textKey)`.

SQL upsert:

```sql
INSERT INTO "dict" ("textKey", "lang", "text")
VALUES (1001, 'de', 'Hallo Welt')
ON CONFLICT ("lang", "textKey") DO UPDATE
SET "text" = EXCLUDED."text";
```

Avoid using the translated text itself as a durable identifier in client code.
Use `textKey`, application row IDs, or stable slugs for identifiers.

## Query behavior

`_lang` is a regular `the-api` query parameter:

```bash
curl 'http://localhost:7788/testNews?_lang=de'
```

For translated fields:

- `_lang=en` returns the source values stored in the application table.
- `_lang` with a non-English code attempts to return `dict.text` for that
  language.
- Filters such as `name=...` use translated values when `name` is listed in
  `translate` and `_lang` is non-English.
- `_search` uses translated values when the translated field is also listed in
  `searchFields`.
- Fields not listed in `translate` are returned unchanged.

Other `the-api` query parameters still apply:

| Parameter | Meaning | Example |
| --- | --- | --- |
| `_fields` | Select response fields. | `?_fields=id,name` |
| `_sort` | Sort fields; `-field` means descending. | `?_sort=-id` |
| `_limit` | Limit result count. | `?_limit=10` |
| `_page` | Page number. | `?_page=2&_limit=10` |
| `_skip` | Offset. | `?_skip=20` |
| `_search` | Search by configured `searchFields`. | `?_search=Hallo` |
| `_lang` | Translate configured fields. | `?_lang=de` |

## Response shape

Responses use the normal `the-api` envelope:

```json
{
  "result": [],
  "meta": {
    "total": 0,
    "limit": 20,
    "skip": 0,
    "page": 1,
    "pages": 1,
    "isFirstPage": true,
    "isLastPage": true
  },
  "error": false
}
```

Single-record responses usually omit `meta`:

```json
{
  "result": {
    "id": 1,
    "name": "Hallo Welt"
  },
  "error": false
}
```

## Testing

For this package:

```bash
bun run build
```

For behavior tests, use the `the-api` repository tests that import this package,
especially the language tests.

Typical checks:

```bash
cd ../the-api
bun test tests/langs.spec.ts
```

If dependencies are not installed, install them in the owning repository first.

## Maintenance rules for agents

- Keep `AGENTS.md`, `README.md`, and `docs/` consistent when public behavior
  changes.
- Treat `src/index.ts` as the public API surface.
- Treat `src/migrations` as database contract.
- Do not hand-edit `dist/`; rebuild it from `src`.
- Use existing table names: `dict` for translations and `languages` for
  metadata.
- Preserve backward migration behavior from `langs` to `dict`.
- Keep examples compatible with both Bun and Node ESM.
- Keep language codes to two characters unless the schema is changed.

## FAQ

### Do I need Node or Bun?

You need Node.js 18+ or Bun 1+.

Request:

```bash
node --version
bun --version
```

Answer:

```text
Use either runtime for the application. Bun is convenient for the examples
because this repository already builds with Bun.
```

### What do I install?

Request:

```bash
bun add the-api the-api-langs
```

Answer:

```text
Install both packages in the application. `the-api` runs the API. `the-api-langs`
adds shared language migrations.
```

### Does `langs` create routes?

Request:

```ts
import { langs } from 'the-api-langs';

const theAPI = new TheAPI({ routings: [langs] });
```

Answer:

```text
No. This registers migrations only. Add `router.crud({ table: 'dict',
prefix: 'langs' })` if the application needs HTTP endpoints for dictionary
records.
```

### How do I expose `/langs` endpoints?

Request:

```ts
const router = new Routings();

router.crud({
  table: 'dict',
  prefix: 'langs',
});
```

Answer:

```text
The API exposes CRUD routes at `/langs` while the database table remains `dict`.
```

### How do I translate an application field?

Request:

```ts
router.crud({
  table: 'testNews',
  translate: ['name'],
  searchFields: ['name'],
});
```

Answer:

```text
Requests with `_lang=de` return translated `name` values when matching rows
exist in `dict`.
```

### What should the application table store?

Request:

```sql
INSERT INTO "testNews" ("name") VALUES ('Hello world');
```

Answer:

```text
Store the canonical English source text in translated columns. The English
`dict` row must contain the same text so `the-api` can find the shared
`textKey`.
```

### How do I add German for a phrase?

Request:

```sql
INSERT INTO "dict" ("textKey", "lang", "text")
VALUES
  (1001, 'en', 'Hello world'),
  (1001, 'de', 'Hallo Welt')
ON CONFLICT ("lang", "textKey") DO UPDATE
SET "text" = EXCLUDED."text";
```

Answer:

```json
{
  "textKey": 1001,
  "en": "Hello world",
  "de": "Hallo Welt"
}
```

### How do I read translated data?

Request:

```bash
curl 'http://localhost:7788/testNews/1?_fields=id,name&_lang=de'
```

Answer:

```json
{
  "result": {
    "id": 1,
    "name": "Hallo Welt"
  },
  "error": false
}
```

### How do I read the original English data?

Request:

```bash
curl 'http://localhost:7788/testNews/1?_fields=id,name&_lang=en'
```

Answer:

```json
{
  "result": {
    "id": 1,
    "name": "Hello world"
  },
  "error": false
}
```

### Why does filtering by English fail when `_lang=de`?

Request:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=de&name=Hello%20world'
```

Answer:

```json
{
  "result": [],
  "error": false
}
```

When `_lang=de` is used, filters for translated fields compare against the
translated value. Filter with `name=Hallo%20Welt` or omit `_lang`.

### How do I filter by translated text?

Request:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=de&name=Hallo%20Welt'
```

Answer:

```json
{
  "result": [
    { "id": 1, "name": "Hallo Welt" }
  ],
  "error": false
}
```

### How do I search translated text?

Request:

```bash
curl 'http://localhost:7788/testNews?_fields=id,name&_lang=es&_search=Hola'
```

Answer:

```json
{
  "result": [
    { "id": 1, "name": "Hola mundo" }
  ],
  "error": false
}
```

### How do I add a new language to metadata?

Request:

```bash
curl -X POST 'http://localhost:7788/languages' \
  -H 'Content-Type: application/json' \
  -d '{"code":"fr","nativeName":"Francais","englishName":"French","textDirection":"ltr","isActive":true}'
```

Answer:

```json
{
  "result": {
    "id": 4,
    "code": "fr",
    "nativeName": "Francais",
    "englishName": "French",
    "textDirection": "ltr",
    "isActive": true
  },
  "error": false
}
```

### Does `isActive=false` block `_lang`?

Request:

```bash
curl 'http://localhost:7788/testNews?_lang=de'
```

Answer:

```text
No. `languages.isActive` is metadata. Add application middleware or custom
validation if inactive languages must be blocked.
```

### Can I use `en-US`?

Request:

```sql
INSERT INTO "dict" ("textKey", "lang", "text")
VALUES (1001, 'en-US', 'Hello world');
```

Answer:

```text
No with the current schema. `dict.lang` and `languages.code` are `VARCHAR(2)`.
Use two-character codes such as `en`, `de`, `es`, or change the schema in a new
migration.
```

### How do migrations run?

Request:

```ts
const theAPI = new TheAPI({
  routings: [langs, router],
});
```

Answer:

```text
`TheAPI` collects migration directories from `langs` and `router`, runs Knex
migrations, introspects tables, and then registers routes.
```

### Why do I get table not found?

Request:

```text
relation "dict" does not exist
```

Answer:

```text
Check that database environment variables are set and that `langs` is included
in `TheAPI({ routings: [...] })`. Without a database connection, migrations do
not run.
```

### How do I protect translation writes?

Request:

```ts
router.crud({
  table: 'dict',
  prefix: 'langs',
  permissions: {
    methods: ['POST', 'PATCH', 'DELETE'],
  },
});
```

Answer:

```text
Only callers with the matching `the-api` permissions can write translations.
Keep public reads open or protect `GET` too, depending on the app.
```

### Should I use `dict` or `langs` as the table name?

Request:

```ts
router.crud({ table: 'dict', prefix: 'langs' });
```

Answer:

```text
Use `dict` as the database table. Use `prefix: 'langs'` only if you want the
public HTTP path to remain `/langs`.
```

### What happens if a translation is missing?

Request:

```bash
curl 'http://localhost:7788/testNews/1?_fields=id,name&_lang=fr'
```

Answer:

```json
{
  "result": {
    "id": 1,
    "name": "Hello world"
  },
  "error": false
}
```

The translated field falls back to the source text from the application row.

### Can I translate multiple fields?

Request:

```ts
router.crud({
  table: 'testNews',
  translate: ['name', 'body'],
  searchFields: ['name', 'body'],
});
```

Answer:

```text
The CRUD option accepts multiple field names. Make sure each source value has an
English `dict` row and translated rows for every target language.
```

### Can this module be reused across many applications?

Request:

```ts
import { langs } from 'the-api-langs';
```

Answer:

```text
Yes. Add the module to every `the-api` application that needs the shared
dictionary schema. Keep app-specific routes, permissions, and seed data in the
application.
```
