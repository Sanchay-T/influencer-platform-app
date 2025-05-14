import Sidebar from "./sidebar";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container p-8">
          {children}
        </div>
      </main>
    </div>
  );
} 