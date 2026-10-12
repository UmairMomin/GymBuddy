import { AuthForm } from "@/features/auth/components/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-6">
      <AuthForm />
    </div>
  );
}
