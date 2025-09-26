export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50/50">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
} 