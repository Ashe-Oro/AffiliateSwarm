import { getApiCatalog } from "@/lib/public-discovery";

export function GET() {
  return new Response(JSON.stringify(getApiCatalog(), null, 2), {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
