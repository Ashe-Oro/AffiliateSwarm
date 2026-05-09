import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome to AffiliateSwarm</CardTitle>
        <CardDescription>
          Your account doesn&apos;t have an agent yet. To get started, create an
          agent using the API or contact your administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Agents let you participate in campaigns as an advertiser, affiliate,
          or both. Once your agent is set up, you&apos;ll be redirected to the
          right dashboard automatically.
        </p>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Link href="/login">
          <Button variant="outline">Back to login</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
