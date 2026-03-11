# the-api langs


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

`curl http://localhost:7788/testNews?_lang=de