exports.up = (knex) => knex.schema
  .renameTable('langs', 'dict')
  .then(() => knex.raw(`
    ALTER INDEX IF EXISTS langs_text_idx RENAME TO dict_text_idx;
    ALTER INDEX IF EXISTS langs_text_key_idx RENAME TO dict_text_key_idx;
    ALTER INDEX IF EXISTS langs_lang_text_idx RENAME TO dict_lang_text_idx;
    ALTER INDEX IF EXISTS langs_lang_text_key_idx RENAME TO dict_lang_text_key_idx;
  `));

exports.down = (knex) => knex.schema
  .renameTable('dict', 'langs')
  .then(() => knex.raw(`
    ALTER INDEX IF EXISTS dict_text_idx RENAME TO langs_text_idx;
    ALTER INDEX IF EXISTS dict_text_key_idx RENAME TO langs_text_key_idx;
    ALTER INDEX IF EXISTS dict_lang_text_idx RENAME TO langs_lang_text_idx;
    ALTER INDEX IF EXISTS dict_lang_text_key_idx RENAME TO langs_lang_text_key_idx;
  `));
