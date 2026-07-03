const React = require("react");

const Markdown = (props) =>
  React.createElement("Text", null, props.children);

module.exports = Markdown;
module.exports.default = Markdown;
