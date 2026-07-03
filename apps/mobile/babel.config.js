module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  plugins: [
    // Required by @babel/core 7.29+ which removed automatic support for
    // class private methods (# syntax). RN 0.76 source uses this syntax.
    // Must match metro preset's loose mode for class-properties.
    ["@babel/plugin-transform-private-methods", { loose: true }],
  ],
};
