import { redirect } from "next/navigation";

export default function LiveRedirectPage() {
  redirect("/dashboard/performance#live-status");
}
