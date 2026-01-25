import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Crop Logger
          </h1>
          <p className="text-lg text-muted-foreground">
            Track crop quality and reduce overplanting at One Acre Farm
          </p>
        </div>

        <div className="pt-4">
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg" className="w-full sm:w-auto px-8">
                Sign In
              </Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto px-8">
                Go to Dashboard
              </Button>
            </Link>
          </SignedIn>
        </div>
      </div>
    </div>
  );
}
