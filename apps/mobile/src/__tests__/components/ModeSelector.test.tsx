import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ModeSelector } from "../../components/ModeSelector";
import type { SessionMode } from "@hermit-org/acp-hooks";

const modes: SessionMode[] = [
  { id: "ask", name: "Ask" },
  { id: "code", name: "Code" },
  { id: "architect", name: "Architect", description: "Design mode" },
];

describe("<ModeSelector />", () => {
  it("renders null when modes is empty", () => {
    const { toJSON } = render(
      <ModeSelector modes={[]} currentModeId={undefined} onModeChange={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders current mode name in trigger", () => {
    const { getByText } = render(
      <ModeSelector modes={modes} currentModeId="code" onModeChange={jest.fn()} />,
    );
    expect(getByText("Code")).toBeTruthy();
  });

  it("falls back to first mode when currentModeId is not found", () => {
    const { getByText } = render(
      <ModeSelector modes={modes} currentModeId="unknown" onModeChange={jest.fn()} />,
    );
    expect(getByText("Ask")).toBeTruthy();
  });

  it("opens dropdown and shows all options on press", () => {
    const { getByText } = render(
      <ModeSelector modes={modes} currentModeId="ask" onModeChange={jest.fn()} />,
    );
    fireEvent.press(getByText("Ask"));
    // Dropdown should show all modes
    expect(getByText("Code")).toBeTruthy();
    expect(getByText("Architect")).toBeTruthy();
  });

  it("calls onModeChange when an option is selected", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ModeSelector modes={modes} currentModeId="ask" onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("Ask"));
    fireEvent.press(getByText("Code"));
    expect(onModeChange).toHaveBeenCalledWith("code");
  });
});
