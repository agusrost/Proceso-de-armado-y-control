import React from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/hooks/use-auth";

type MainLayoutProps = {
  children: React.ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();

  // For armadores, we use a simpler layout without the sidebar
  if (user?.role === 'armador') {
    return (
      <div className="min-h-screen flex flex-col bg-neutral-800">
        <Header />
        <main className="flex-1 bg-neutral-800">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-800">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-neutral-800">
          {children}
        </main>
      </div>
    </div>
  );
}
