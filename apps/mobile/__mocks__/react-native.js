/**
 * Complete react-native mock for Jest component tests.
 *
 * Bun's isolated .bun/ layout puts RN's source outside babel.config.js's
 * root, so its Flow syntax can't be transformed. We redirect the RN entry
 * import to this mock instead.
 *
 * RN's preset setup.js still runs (via setupFiles) and calls
 * jest.requireActual on some internal files — those are handled by
 * transformIgnorePatterns + configFile in jest.config.js.
 */
const React = require("react");

const makeComponent = (name, defaultProps = {}) => {
  const Comp = React.forwardRef((props, ref) => {
    const { children, testID, ...rest } = props;
    return React.createElement(name, { ...defaultProps, ...rest, testID, ref }, children);
  });
  Comp.displayName = name;
  return Comp;
};

const View = makeComponent("View");
const Text = makeComponent("Text");
const TextInput = makeComponent("TextInput", { value: "" });
const TouchableOpacity = makeComponent("TouchableOpacity");
const TouchableHighlight = makeComponent("TouchableHighlight");
const TouchableWithoutFeedback = makeComponent("TouchableWithoutFeedback");
const Pressable = makeComponent("Pressable");
const ScrollView = makeComponent("ScrollView");
const SafeAreaView = makeComponent("SafeAreaView");
// Modal must respect the `visible` prop — when false, render nothing.
const Modal = React.forwardRef((props, ref) => {
  const { children, visible = true, testID, ...rest } = props;
  if (!visible) return null;
  return React.createElement("Modal", { ...rest, testID, ref }, children);
});
Modal.displayName = "Modal";
const Image = makeComponent("Image");
const Switch = makeComponent("Switch", { value: false });
const ActivityIndicator = makeComponent("ActivityIndicator");
const KeyboardAvoidingView = makeComponent("KeyboardAvoidingView");
const StatusBar = makeComponent("StatusBar");

// FlatList must render items from data + renderItem so RNTL can find them.
const FlatList = React.forwardRef((props, ref) => {
  const { data, renderItem, keyExtractor, testID, ...rest } = props;
  const children = (data || []).map((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : String(index);
    return React.cloneElement(renderItem({ item, index }), { key });
  });
  return React.createElement("FlatList", { ...rest, testID, ref }, children);
});
FlatList.displayName = "FlatList";

const SectionList = React.forwardRef((props, ref) => {
  const { sections, renderItem, renderSectionHeader, keyExtractor, testID, ...rest } = props;
  const children = [];
  (sections || []).forEach((section, sIndex) => {
    if (renderSectionHeader) {
      children.push(
        React.cloneElement(renderSectionHeader({ section: section }), {
          key: `s-${sIndex}`,
        }),
      );
    }
    (section.data || []).forEach((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : `${sIndex}-${index}`;
      children.push(React.cloneElement(renderItem({ item, index, section }), { key }));
    });
  });
  return React.createElement("SectionList", { ...rest, testID, ref }, children);
});
SectionList.displayName = "SectionList";

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => {
    if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
    return style;
  },
  hairlineWidth: 1,
  absoluteFillObject: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
};

const Platform = {
  OS: "ios",
  Version: 44,
  select: (obj) => obj[Platform.OS] || obj.default,
  isTV: false,
  isTesting: true,
};

const Alert = { alert: jest.fn() };

const LayoutAnimation = {
  configureNext: jest.fn(),
  create: jest.fn(),
  Types: { spring: "spring", linear: "linear", easeInEaseOut: "easeInEaseOut", easeIn: "easeIn" },
  Properties: { opacity: "opacity", scaleXY: "scaleXY" },
  Presets: {
    easeInEaseOut: { duration: 300, create: { type: "easeInEaseOut", property: "opacity" }, update: { type: "easeInEaseOut" }, delete: { type: "easeInEaseOut", property: "opacity" } },
    linear: { duration: 300, create: { type: "linear", property: "opacity" }, update: { type: "linear" }, delete: { type: "linear", property: "opacity" } },
    spring: { duration: 700, create: { type: "linear", property: "opacity" }, update: { type: "spring", springDamping: 0.4 }, delete: { type: "linear", property: "opacity" } },
  },
};

const UIManager = {
  measure: jest.fn(),
  measureLayout: jest.fn(),
  measureInWindow: jest.fn(),
  setNativeProps: jest.fn(),
  configureNextLayoutAnimation: jest.fn(),
};

const Animated = {
  Value: class {
    constructor(val) { this._value = val; }
    setValue(val) { this._value = val; }
    addListener() {}
    removeListener() {}
    interpolate() { return this; }
  },
  ValueXY: class {
    constructor() { this.x = new Animated.Value(0); this.y = new Animated.Value(0); }
  },
  View: makeComponent("AnimatedView"),
  Text: makeComponent("AnimatedText"),
  ScrollView: makeComponent("AnimatedScrollView"),
  timing: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
  spring: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
  decay: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
  sequence: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
  parallel: jest.fn(() => ({ start: jest.fn((cb) => cb && cb({ finished: true })) })),
  loop: jest.fn(() => ({ start: jest.fn() })),
};

const Easing = {
  linear: jest.fn(),
  ease: jest.fn(),
  inOut: jest.fn(),
  out: jest.fn(),
  bezier: jest.fn(),
};

const PanResponder = { create: jest.fn(() => ({ panHandlers: {} })) };

const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812, scale: 1, fontScale: 1 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const PixelRatio = {
  get: jest.fn(() => 2),
  getFontScale: jest.fn(() => 1),
  getPixelSizeForLayoutSize: jest.fn((n) => n * 2),
  roundToNearestPixel: jest.fn((n) => Math.round(n)),
};

const Linking = {
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
};

const AppState = {
  currentState: "active",
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const Keyboard = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
  dismiss: jest.fn(),
};

const AccessibilityInfo = {
  isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const I18nManager = {
  isRTL: false,
  getConstants: jest.fn(() => ({ isRTL: false })),
  forceRTL: jest.fn(),
  swapLeftAndRightInJS: jest.fn(),
};

const NativeModules = {
  StatusBarManager: { getHeight: jest.fn(), setColor: jest.fn() },
  KeyboardObserver: {},
};

module.exports = {
  // Components
  View, Text, TextInput, TouchableOpacity, TouchableHighlight,
  TouchableWithoutFeedback, Pressable, ScrollView, FlatList, SectionList,
  SafeAreaView, Modal, Image, Switch, ActivityIndicator,
  KeyboardAvoidingView, StatusBar,
  // APIs
  StyleSheet, Platform, Alert, LayoutAnimation, UIManager,
  Animated, Easing, PanResponder, Dimensions, PixelRatio,
  Linking, AppState, Keyboard, AccessibilityInfo, I18nManager, NativeModules,
  // Utilities
  requireNativeComponent: makeComponent,
  findNodeHandle: jest.fn(),
};
