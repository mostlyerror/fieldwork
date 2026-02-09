import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubmitTournamentBody {
  name?: string;
  dateStart?: string;
  dateEnd?: string;
  locationName?: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  skillLevels?: string[];
  format?: string;
  entryFee?: number;
  registrationUrl?: string;
  description?: string;
  website?: string; // honeypot field — should always be empty
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: SubmitTournamentBody): string | null {
  for (const field of [
    "name",
    "dateStart",
    "locationName",
    "registrationUrl",
  ] as const) {
    if (!body[field] || (typeof body[field] === "string" && !body[field].trim())) {
      return `Missing required field: ${field}`;
    }
  }

  if (!DATE_RE.test(body.dateStart!)) {
    return "dateStart must be YYYY-MM-DD";
  }
  if (isNaN(Date.parse(body.dateStart!))) {
    return "dateStart is not a valid date";
  }

  if (body.dateEnd !== undefined) {
    if (!DATE_RE.test(body.dateEnd)) {
      return "dateEnd must be YYYY-MM-DD";
    }
    if (isNaN(Date.parse(body.dateEnd))) {
      return "dateEnd is not a valid date";
    }
    if (body.dateEnd < body.dateStart!) {
      return "dateEnd must not be before dateStart";
    }
  }

  if (body.entryFee !== undefined) {
    if (typeof body.entryFee !== "number" || body.entryFee <= 0) {
      return "entryFee must be a positive number";
    }
  }

  return null;
}

function getUserId(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  // Decode the JWT payload (middle segment) to extract the user id.
  // Full signature verification is not needed here because the insert
  // uses the service role key — the user id is informational only.
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SubmitTournamentBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const validationError = validate(body);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Honeypot: if the hidden "website" field is filled, it's a bot.
  // Silently accept but don't actually insert.
  if (body.website) {
    return new Response(
      JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        name: body.name,
        message: "Your tournament has been submitted and is pending review.",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const submittedBy = getUserId(req);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limiting: max 3 submissions per IP per hour
  const clientIP =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  if (clientIP !== "unknown") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rateRow } = await supabase
      .from("submission_rate_limits")
      .select("submission_count, window_start")
      .eq("ip_address", clientIP)
      .single();

    if (rateRow && rateRow.window_start > oneHourAgo) {
      if (rateRow.submission_count >= 3) {
        return new Response(
          JSON.stringify({
            error: "Too many submissions. Please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      await supabase
        .from("submission_rate_limits")
        .update({ submission_count: rateRow.submission_count + 1 })
        .eq("ip_address", clientIP);
    } else {
      await supabase.from("submission_rate_limits").upsert(
        {
          ip_address: clientIP,
          submission_count: 1,
          window_start: new Date().toISOString(),
        },
        { onConflict: "ip_address" },
      );
    }
  }

  // Cross-platform dedup: check if a matching tournament already exists
  let canonicalId: string | null = null;
  let isDuplicate = false;

  if (body.latitude != null && body.longitude != null) {
    const { data: matches } = await supabase.rpc("find_nearby_tournament", {
      p_date_start: body.dateStart!,
      p_lat: body.latitude,
      p_lng: body.longitude,
      p_max_distance_meters: 100,
    });

    if (matches && matches.length > 0) {
      canonicalId = matches[0].id;
      isDuplicate = true;
    }
  }

  const insertRow = {
    name: body.name!.trim(),
    date_start: body.dateStart!,
    date_end: body.dateEnd ?? null,
    location_name: body.locationName!.trim(),
    location_address: body.locationAddress?.trim() ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    skill_levels: body.skillLevels ?? null,
    format: body.format ?? null,
    entry_fee: body.entryFee ?? null,
    registration_url: body.registrationUrl!.trim(),
    description: body.description?.trim() ?? null,
    source_platform: "manual",
    source_url: body.registrationUrl!.trim(),
    source_hash: null,
    is_manually_submitted: true,
    submitted_by: submittedBy,
    status: isDuplicate ? "duplicate" : "pending_review",
    canonical_id: canonicalId,
  };

  const { data, error } = await supabase
    .from("tournaments")
    .insert(insertRow)
    .select("id, name")
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to create tournament" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Record source for the canonical tournament (or self if new)
  const sourceTargetId = canonicalId ?? data.id;
  await supabase.from("tournament_sources").upsert(
    {
      tournament_id: sourceTargetId,
      source_platform: "manual",
      source_url: body.registrationUrl!.trim(),
      registration_url: body.registrationUrl!.trim(),
    },
    { onConflict: "tournament_id,source_platform,source_url" },
  );

  return new Response(
    JSON.stringify({
      id: data.id,
      name: data.name,
      message: "Your tournament has been submitted and is pending review.",
      ...(isDuplicate && { duplicateOf: canonicalId }),
    }),
    {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
