"use client";

import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface VenueSelection {
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface VenueSearchProps {
  defaultName?: string;
  defaultAddress?: string;
  onSelect: (venue: VenueSelection) => void;
  onClear: () => void;
}

export function VenueSearch({
  defaultName = "",
  defaultAddress = "",
  onSelect,
  onClear,
}: VenueSearchProps) {
  const initialQuery = [defaultName, defaultAddress].filter(Boolean).join(", ");

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<VenueSelection | null>(null);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync when extraction defaults change
  const prevName = useRef(defaultName);
  const prevAddr = useRef(defaultAddress);
  useEffect(() => {
    if (defaultName !== prevName.current || defaultAddress !== prevAddr.current) {
      prevName.current = defaultName;
      prevAddr.current = defaultAddress;
      const q = [defaultName, defaultAddress].filter(Boolean).join(", ");
      setQuery(q);
      setSelection(null);
    }
  }, [defaultName, defaultAddress]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (selection || debouncedQuery.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/places/autocomplete?input=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { suggestions: Suggestion[] }) => {
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [debouncedQuery, selection]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSelect(suggestion: Suggestion) {
    setOpen(false);
    setLoading(true);
    setQuery(suggestion.mainText);

    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`
      );
      const data = await res.json();

      if (data.lat != null && data.lng != null) {
        const venue: VenueSelection = {
          locationName: data.name || suggestion.mainText,
          locationAddress: data.address || suggestion.secondaryText,
          latitude: data.lat,
          longitude: data.lng,
          placeId: data.placeId ?? suggestion.placeId,
        };
        setSelection(venue);
        onSelect(venue);
      } else {
        // Details fetch failed — use what we have from the suggestion
        const venue: VenueSelection = {
          locationName: suggestion.mainText,
          locationAddress: suggestion.secondaryText,
          latitude: 0,
          longitude: 0,
          placeId: suggestion.placeId,
        };
        setSelection(venue);
        onSelect(venue);
      }
    } catch {
      // Network error — still show the selection with suggestion text
      const venue: VenueSelection = {
        locationName: suggestion.mainText,
        locationAddress: suggestion.secondaryText,
        latitude: 0,
        longitude: 0,
        placeId: suggestion.placeId,
      };
      setSelection(venue);
      onSelect(venue);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelection(null);
    setQuery("");
    onClear();
  }

  function handleChange(value: string) {
    setQuery(value);
    if (selection) {
      setSelection(null);
      onClear();
    }
  }

  // Selected state — show a card
  if (selection) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="t-body text-gray-800">
            {selection.locationName}
          </p>
          {selection.locationName !== selection.locationAddress && (
            <p className="mt-0.5 t-caption text-gray-500">
              {selection.locationAddress}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 t-caption text-green-700 hover:text-green-900"
        >
          Change
        </button>
        <input type="hidden" name="locationName" value={selection.locationName} />
        <input type="hidden" name="locationAddress" value={selection.locationAddress} />
        <input type="hidden" name="placeId" value={selection.placeId} />
      </div>
    );
  }

  // Loading state — fetching place details after selection
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
        <span className="t-body text-gray-500">Loading venue details...</span>
        <input type="hidden" name="locationName" value={query} />
        <input type="hidden" name="locationAddress" value="" />
        <input type="hidden" name="placeId" value="" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        placeholder="Search for a venue or address..."
        autoComplete="off"
      />
      <input type="hidden" name="locationName" value={query} />
      <input type="hidden" name="locationAddress" value="" />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full px-4 py-2.5 text-left hover:bg-green-50"
              >
                <span className="block t-body text-gray-800">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="block t-caption text-gray-500">
                    {s.secondaryText}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
