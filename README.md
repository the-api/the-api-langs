# the-api langs

Migrations and routings for multilingual text dictionaries in `the-api`.

### Installation

```bash
npm i -S the-api-langs
```

### Usage

`cat index.ts`

```typescript
import { langs } from 'the-api-langs';

const router = new Routings();

router.crud({ table: 'testNews' });

const theAPI = new TheAPI({ routings: [langs, router] });

export default theAPI.up();
```

`bun index.ts`

```bash
curl 'http://localhost:7788/testNews?_lang=de'
```

### Migrations

The package registers migrations from `src/migrations`.

#### `dict`

The `dict` table stores translated text values. It replaces the previous
`langs` table name.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `textKey` | integer | Translation key |
| `lang` | string(2) | Language code |
| `text` | string(4096) | Translated text |

Indexes:

- `dict_text_idx` on `text`
- `dict_text_key_idx` on `textKey`
- `dict_lang_text_idx` on `lang, text`
- `dict_lang_text_key_idx` unique on `lang, textKey`

#### `languages`

The `languages` table stores metadata for available languages.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `timeCreated` | timestamp with timezone | Defaults to current timestamp |
| `timeUpdated` | timestamp with timezone | Defaults to current timestamp |
| `code` | string(2) | Unique language code |
| `nativeName` | string(128) | Language name in the language itself |
| `englishName` | string(128) | Language name in English |
| `textDirection` | string(3) | Defaults to `ltr`; for example `rtl` for right-to-left languages |
| `isActive` | boolean | Defaults to `true` |

Indexes:

- `languages_code_idx` unique on `code`
- `languages_native_name_idx` on `nativeName`
- `languages_english_name_idx` on `englishName`
- `languages_is_active_idx` on `isActive`
