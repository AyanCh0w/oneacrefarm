import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function PendingApproval() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Pending Approval
          </h1>
          <p className="text-lg text-muted-foreground">
            Your account is awaiting approval. You&apos;ll be notified once an
            admin grants you access.
          </p>
        </div>

        <div className="pt-4">
          <SignOutButton>
            <Button variant="outline" size="lg">
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
