const fs = require('fs');
const path = require('path');

module.exports = {
  input: [
    'src/**/*.{js,jsx}',
    // Underscore '_', double underscore '__'
    '!src/**/*.spec.js',
    '!src/**/*.test.js',
    '!**/node_modules/**',
  ],
  output: './',
  options: {
    debug: true,
    removeUnusedKeys: false,
    sort: true,
    func: {
      list: ['t'],
      extensions: ['.js', '.jsx']
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: ['.js', '.jsx'],
      fallbackKey: (ns, value) => {
        return value;
      },
    },
    lngs: ['en', 'ar'],
    ns: ['translation'],
    defaultLng: 'en',
    defaultNs: 'translation',
    defaultValue: '__STRING_NOT_TRANSLATED__',
    resource: {
      loadPath: 'src/i18n/{{lng}}.json',
      savePath: 'src/i18n/{{lng}}.json',
      jsonIndent: 2,
      lineEnding: '\n'
    },
    nsSeparator: false,
    keySeparator: '.',
    interpolation: {
      prefix: '{{',
      suffix: '}}'
    }
  }
};
