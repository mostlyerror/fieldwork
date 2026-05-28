import { supabase } from "./utils/supabase.js";

async function main() {
  console.log("Using URL:", (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").slice(0, 40));
  console.log("Service key set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("email_subscribers")
    .select("email, name, status, link_status, player_id");
  console.log("error:", error?.message ?? "none");
  console.log("rows:", data?.length);
  for (const s of data ?? []) {
    console.log(" ", s.email, "·", s.status, "·", s.link_status, s.player_id ? `linked → ${s.player_id}` : "");
  }
}

main();
