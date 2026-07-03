import React from "react";
import { render } from "@testing-library/react-native";
import { UsageBar } from "../../components/UsageBar";
import type { UsageStats } from "@hermit-org/acp-hooks";

describe("<UsageBar />", () => {
  it("renders null when usage is undefined", () => {
    const { toJSON } = render(<UsageBar usage={undefined} />);
    expect(toJSON()).toBeNull();
  });

  it("renders token counts", () => {
    const usage: UsageStats = { used: 1500, size: 128000 };
    const { getByText } = render(<UsageBar usage={usage} />);
    expect(getByText(/1\.5k/)).toBeTruthy();
    expect(getByText(/128\.0k/)).toBeTruthy();
  });

  it("renders cost when present", () => {
    const usage: UsageStats = {
      used: 500,
      size: 100000,
      cost: { amount: 0.05, currency: "USD" },
    };
    const { getByText } = render(<UsageBar usage={usage} />);
    expect(getByText(/\$0\.05/)).toBeTruthy();
  });

  it("does not render cost when absent", () => {
    const usage: UsageStats = { used: 100, size: 50000 };
    const { queryByText } = render(<UsageBar usage={usage} />);
    expect(queryByText(/\$/)).toBeNull();
  });

  it("formats large numbers with M suffix", () => {
    const usage: UsageStats = { used: 1500000, size: 2000000 };
    const { getByText } = render(<UsageBar usage={usage} />);
    expect(getByText(/1\.5M/)).toBeTruthy();
  });
});
