// One guard for every server-side fetch of a user-supplied URL. The source lives with the Edge
// Functions (which cannot import from packages); the web app and the tests use it from here.
export * from "../../../supabase/functions/_shared/ssrf";
