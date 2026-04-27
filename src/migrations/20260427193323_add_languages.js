exports.up = (knex) => knex.schema
  .createTable('languages', (table) => {
    table.increments('id');
    table.timestamp('timeCreated', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('timeUpdated', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('code', 2).notNullable();
    table.string('nativeName', 128).notNullable();
    table.string('englishName', 128).notNullable();
    table.string('textDirection', 3).notNullable().defaultTo('ltr');
    table.boolean('isActive').notNullable().defaultTo(true);
  })
  .then(() => knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS languages_code_idx ON languages (code);
    CREATE INDEX IF NOT EXISTS languages_native_name_idx ON languages ("nativeName");
    CREATE INDEX IF NOT EXISTS languages_english_name_idx ON languages ("englishName");
    CREATE INDEX IF NOT EXISTS languages_is_active_idx ON languages ("isActive");
  `));

exports.down = (knex) => knex.schema.dropTable('languages');
