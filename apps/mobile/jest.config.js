module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(js|ts|tsx)$": [
      "babel-jest",
      {
        // Explicitly point to our babel.config.js so Babel transforms ALL
        // files — including RN in Bun's isolated .bun/ layout, which lives
        // outside apps/mobile/ and thus can't be found by normal babelrc
        // upward search.
        configFile: require.resolve("./babel.config.js"),
      },
    ],
  },
  // In Bun's isolated .bun/ layout, RN packages live at paths like
  // node_modules/.bun/react-native@0.76.0+hash/node_modules/react-native/
  // Transform any node_modules file whose path contains "react-native".
  transformIgnorePatterns: ["node_modules/(?!.*react-native)"],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/__mocks__/react-native.js",
    "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/__mocks__/fileMock.js",
    "^react-native-mmkv$": "<rootDir>/__mocks__/react-native-mmkv.js",
    "^react-native-sse$": "<rootDir>/__mocks__/react-native-sse.js",
    "^react-native-localize$": "<rootDir>/__mocks__/react-native-localize.js",
    "^react-native-camera-kit$": "<rootDir>/__mocks__/react-native-camera-kit.js",
    "^react-native-safe-area-context$":
      "<rootDir>/__mocks__/react-native-safe-area-context.js",
    "^react-native-screens$": "<rootDir>/__mocks__/react-native-screens.js",
    "^react-native-markdown-display$":
      "<rootDir>/__mocks__/react-native-markdown-display.js",
  },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
