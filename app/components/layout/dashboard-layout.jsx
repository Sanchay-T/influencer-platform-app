import Sidebar from "./sidebar";
import DashboardHeader from "./dashboard-header";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <DashboardHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 md:px-8 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
} 
