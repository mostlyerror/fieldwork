"use client";

import { SegmentedControl } from "./ui/segmented-control";
import { ListIcon, MapIcon } from "./icons";

export type ViewMode = "list" | "map";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <SegmentedControl<ViewMode>
      ariaLabel="View mode"
      value={view}
      onChange={onChange}
      options={[
        { value: "list", label: "List", icon: <ListIcon className="h-4 w-4" /> },
        { value: "map", label: "Map", icon: <MapIcon className="h-4 w-4" /> },
      ]}
    />
  );
}
