const React = require("react");

module.exports = {
  SafeAreaView: (props) => React.createElement("SafeAreaView", props, props.children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
};
