module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod v4 ships `export * as ns from '...'`, which the RN preset does not transform.
    '@babel/plugin-transform-export-namespace-from',
  ],
};
