import { redirect } from "next/navigation";

function performanceRedirect(
  params: Record<string, string | string[] | undefined>,
  hash: string
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }

  const queryString = query.toString();
  return `/dashboard/performance${queryString ? `?${queryString}` : ""}${hash}`;
}

export default async function ConversionsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(performanceRedirect(await searchParams, "#conversions"));
}
