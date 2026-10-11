module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise` is the idiom for intentional fire-and-forget calls.
    'no-void': 'off',
  },
  overrides: [
    {
      // Pure layers: the game engine, protocol and session logic must stay free of UI and
      // native imports so they run under plain Node tests and on every transport.
      files: [
        'src/game/**/*.ts',
        'src/networking/protocol/**/*.ts',
        'src/networking/host/**/*.ts',
        'src/networking/client/**/*.ts',
        'src/networking/poc/**/*.ts',
        'src/networking/transport/types.ts',
        'src/networking/transport/AdvertisementCodec.ts',
        'src/networking/transport/MemoryTransport.ts',
        'src/utils/**/*.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  'react',
                  'react-native',
                  'react-native/*',
                  '**/native/**',
                  '**/screens/**',
                  '**/components/**',
                  '**/hooks/**',
                  '**/app/**',
                  '**/platform/**',
                ],
                message:
                  'This layer must not depend on UI, React Native or native modules.',
              },
            ],
          },
        ],
      },
    },
  ],
};
