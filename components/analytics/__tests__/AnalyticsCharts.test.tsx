import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BarList, SegmentBar, StackedDailyChart } from "../AnalyticsCharts";

afterEach(() => cleanup());

describe("SegmentBar", () => {
  it("renders each segment's value and computed percentage in its legend", () => {
    render(
      <SegmentBar
        segments={[
          { label: "Safe", value: 3, color: "red" },
          { label: "Caution", value: 1, color: "blue" },
        ]}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("(75%)")).toBeInTheDocument();
    expect(screen.getByText("(25%)")).toBeInTheDocument();
  });

  it("shows 0% for every segment rather than dividing by zero when the total is empty", () => {
    render(<SegmentBar segments={[{ label: "Safe", value: 0, color: "red" }]} />);
    expect(screen.getByText("(0%)")).toBeInTheDocument();
  });
});

describe("BarList", () => {
  it("shows the empty-state message instead of an empty list", () => {
    render(<BarList items={[]} emptyLabel="Nothing here yet." />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("renders a labeled bar per item with its count", () => {
    render(
      <BarList
        items={[
          { key: "a", label: "Amoxicillin", count: 5 },
          { key: "b", label: "Warfarin", count: 2 },
        ]}
      />
    );
    expect(screen.getByText("Amoxicillin")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Warfarin")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("StackedDailyChart", () => {
  it("shows a no-data message instead of an empty chart when there are no days at all", () => {
    render(<StackedDailyChart data={[]} />);
    expect(screen.getByText("No screenings recorded yet.")).toBeInTheDocument();
  });

  it("renders one bar column per day and a legend for all three verdict tones", () => {
    render(
      <StackedDailyChart
        data={[
          { date: "2026-01-01", safe: 2, caution: 1, blocked: 0 },
          { date: "2026-01-02", safe: 1, caution: 0, blocked: 1 },
        ]}
      />
    );
    expect(screen.getByRole("img", { name: /daily screening volume/i })).toBeInTheDocument();
    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(screen.getByText("Caution")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});
