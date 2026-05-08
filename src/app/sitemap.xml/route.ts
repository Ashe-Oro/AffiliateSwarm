import { getAllPostMeta } from "@/lib/blog/posts";
import { buildSitemapXml, getPublicSitemapEntries } from "@/lib/public-discovery";

export async function GET() {
  const posts = await getAllPostMeta();
  const xml = buildSitemapXml(getPublicSitemapEntries(posts));

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
