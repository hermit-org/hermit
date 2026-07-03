import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PlanBar } from "../../components/PlanBar";
import type { PlanEntry } from "@hermit-org/acp-hooks";

const entries: PlanEntry[] = [
  { content: "Task A", status: "completed" },
  { content: "Task B", status: "in_progress" },
  { content: "Task C", status: "pending" },
];

describe("<PlanBar />", () => {
  it("renders null when entries is empty", () => {
    const { toJSON } = render(<PlanBar entries={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders progress count", () => {
    const { getByText } = render(<PlanBar entries={entries} />);
    expect(getByText("1/3")).toBeTruthy();
  });

  it("expands to show task items when tapped", () => {
    const { getByText, queryByText } = render(
      <PlanBar entries={entries} />,
    );
    // Collapsed by default: content is not visible
    expect(queryByText("Task C")).toBeNull();

    // Tap to expand
    fireEvent.press(getByText("1/3"));
    expect(getByText("Task A")).toBeTruthy();
    expect(getByText("Task B")).toBeTruthy();
    expect(getByText("Task C")).toBeTruthy();
  });

  it("shows 100% when all completed", () => {
    const all: PlanEntry[] = [
      { content: "Done 1", status: "completed" },
      { content: "Done 2", status: "completed" },
    ];
    const { getByText } = render(<PlanBar entries={all} />);
    expect(getByText("2/2")).toBeTruthy();
  });
});
