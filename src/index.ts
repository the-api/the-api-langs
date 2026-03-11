import { resolve } from 'path';
import { Routings } from 'the-api-routings';

const langs = new Routings({ migrationDirs: [resolve(`${import.meta.dir}/../src/migrations`)] });

export { langs };
