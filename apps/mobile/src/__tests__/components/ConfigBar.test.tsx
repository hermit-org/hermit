import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ConfigBar } from "../../components/ConfigBar";
import type { ConfigOption } from "@hermit-org/acp";

const options: ConfigOption[] = [
  {
    type: "select",
    id: "model",
    name: "Model",
    currentValue: "gpt-4",
    options: [
      { value: "gpt-4", name: "GPT-4" },
      { value: "gpt-3.5", name: "GPT-3.5" },
    ],
  },
  {
    type: "toggle",
    id: "thinking",
    name: "Thinking",
    currentValue: "true",
  },
];

describe("<ConfigBar />", () => {
  it("renders null when options is empty", () => {
    const { toJSON } = render(
      <ConfigBar options={[]} onConfigChange={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders option names and current values", () => {
    const { getByText } = render(
      <ConfigBar options={options} onConfigChange={jest.fn()} />,
    );
    expect(getByText("Model")).toBeTruthy();
    expect(getByText("GPT-4")).toBeTruthy();
    expect(getByText("Thinking")).toBeTruthy();
    expect(getByText("✓")).toBeTruthy();
  });

  it("calls onConfigChange with next value for toggle", () => {
    const onConfigChange = jest.fn();
    const { getByText } = render(
      <ConfigBar options={options} onConfigChange={onConfigChange} />,
    );
    // Tap "Thinking" toggle (currently true -> next false)
    fireEvent.press(getByText("Thinking"));
    expect(onConfigChange).toHaveBeenCalledWith("thinking", "false");
  });

  it("calls onConfigChange with next value for select (cycles)", () => {
    const onConfigChange = jest.fn();
    const { getByText } = render(
      <ConfigBar options={options} onConfigChange={onConfigChange} />,
    );
    // Tap "Model" (currently gpt-4 -> next gpt-3.5)
    fireEvent.press(getByText("GPT-4"));
    expect(onConfigChange).toHaveBeenCalledWith("model", "gpt-3.5");
  });

  it("shows ✓ for toggle true and ✗ for toggle false", () => {
    const toggleOff: ConfigOption[] = [
      { type: "toggle", id: "x", name: "X", currentValue: "false" },
    ];
    const { getByText } = render(
      <ConfigBar options={toggleOff} onConfigChange={jest.fn()} />,
    );
    expect(getByText("✗")).toBeTruthy();
  });
});
