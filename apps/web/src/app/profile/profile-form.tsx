"use client";

import { useState } from "react";
import { updateProfile } from "./actions";
import { SKILL_LEVELS } from "@/lib/constants";

interface Profile {
  name: string | null;
  skill_level: string | null;
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(formData: FormData) {
    setStatus("saving");
    await updateProfile(formData);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="mb-1 block t-body text-gray-700"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={profile?.name ?? ""}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label
          htmlFor="skill_level"
          className="mb-1 block t-body text-gray-700"
        >
          Skill Level
        </label>
        <select
          id="skill_level"
          name="skill_level"
          defaultValue={profile?.skill_level ?? ""}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">Select your level</option>
          {SKILL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-xl bg-green-600 px-4 py-2 t-body font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        {status === "saving"
          ? "Saving..."
          : status === "saved"
            ? "Saved"
            : "Save"}
      </button>
    </form>
  );
}
