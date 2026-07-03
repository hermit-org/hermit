import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PermissionPanel } from "../../components/PermissionPanel";
import type { PendingPermission, AnsweredPermissionView } from "@hermit-org/acp-hooks";

function makeRequest(overrides?: Partial<PendingPermission>): PendingPermission {
  return {
    id: "req-1",
    sessionId: "session-1",
    toolCall: {
      toolCallId: "tc-1",
      title: "Allow file read?",
    },
    options: [
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      { optionId: "deny", name: "Deny", kind: "reject_once" },
    ],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("<PermissionPanel />", () => {
  it("renders null when no requests and no history", () => {
    const { toJSON } = render(
      <PermissionPanel requests={[]} history={[]} onResolve={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders question title and option buttons when there are pending requests", () => {
    const { getByText } = render(
      <PermissionPanel
        requests={[makeRequest()]}
        history={[]}
        onResolve={jest.fn()}
      />,
    );
    expect(getByText("Allow file read?")).toBeTruthy();
    expect(getByText("Allow")).toBeTruthy();
    expect(getByText("Deny")).toBeTruthy();
  });

  it("calls onResolve when an option is tapped", () => {
    const onResolve = jest.fn();
    const req = makeRequest();
    const { getByText } = render(
      <PermissionPanel requests={[req]} history={[]} onResolve={onResolve} />,
    );
    fireEvent.press(getByText("Allow"));
    expect(onResolve).toHaveBeenCalledWith(req, "allow", undefined);
  });

  it("shows question badge when multiple pending requests", () => {
    const { getByText } = render(
      <PermissionPanel
        requests={[makeRequest(), makeRequest({ id: "req-2" })]}
        history={[]}
        onResolve={jest.fn()}
      />,
    );
    expect(getByText("Question 1")).toBeTruthy();
    expect(getByText("Question 2")).toBeTruthy();
  });

  it("renders answered history section when history is non-empty", () => {
    const history: AnsweredPermissionView[] = [
      {
        id: "h-1",
        question: "Allow write?",
        answer: "Allow",
        at: Date.now(),
      },
    ];
    const { getByText } = render(
      <PermissionPanel
        requests={[]}
        history={history}
        onResolve={jest.fn()}
      />,
    );
    expect(getByText(/Answered/)).toBeTruthy();
  });
});
