import { createClient }
from "@supabase/supabase-js";

const supabaseUrl =
  "https://ebvjpduwgjeuixtfvaiq.supabase.co";

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidmpwZHV3Z2pldWl4dGZ2YWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDAxNTcsImV4cCI6MjEwNTgxNjE1N30.aEja2DvwM4qV_zId9glZCfjAeOcgCDwc1cW7wqRIDhc";

export const supabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey
  );