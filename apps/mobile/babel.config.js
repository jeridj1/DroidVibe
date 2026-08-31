module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': '.' },
        },
      ],
      // Strip .js extensions from relative imports (TypeScript ESM convention).
      // Metro doesn't understand './types.js' -> './types.ts' natively.
      function stripJsExtensions() {
        return {
          visitor: {
            ImportDeclaration(path) {
              const src = path.node.source.value;
              if ((src.startsWith('.') || src.startsWith('/')) && src.endsWith('.js')) {
                path.node.source.value = src.slice(0, -3);
              }
            },
            ExportNamedDeclaration(path) {
              if (path.node.source) {
                const src = path.node.source.value;
                if ((src.startsWith('.') || src.startsWith('/')) && src.endsWith('.js')) {
                  path.node.source.value = src.slice(0, -3);
                }
              }
            },
            ExportAllDeclaration(path) {
              if (path.node.source) {
                const src = path.node.source.value;
                if ((src.startsWith('.') || src.startsWith('/')) && src.endsWith('.js')) {
                  path.node.source.value = src.slice(0, -3);
                }
              }
            },
          },
        };
      },
    ],
  };
};
