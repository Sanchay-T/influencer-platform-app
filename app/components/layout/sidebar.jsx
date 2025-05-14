'use client'

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LayoutDashboard, Search, PlusCircle, LogOut, UserRoundCog } from "lucide-react";
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase'

export default function Sidebar() {
  const router = useRouter()
  
  const handleLogout = async () => {
    try {
      // Usar el endpoint del servidor para el logout
      const response = await fetch('/auth/signout', {
        method: 'POST',
        credentials: 'include', // Importante para enviar cookies
      })
      
      if (!response.ok) {
        // Si hay un error con el endpoint del servidor, intentar logout desde el cliente como fallback
        console.error('Error con el endpoint de logout, probando logout desde cliente')
        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'global' })
      }
      
      // Redirigir al usuario a la página de login con una redirección completa
      window.location.href = '/auth/login'
    } catch (err) {
      console.error('Error inesperado al cerrar sesión:', err)
    }
  }

  return (
    <div className="h-full w-64 border-r border-zinc-200 bg-zinc-50/50 p-6 flex flex-col">
      <div className="flex flex-col space-y-8 flex-grow">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-zinc-800">Influencer Hub</h2>
        </div>

        <nav className="flex flex-col space-y-1">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          
          {/* <Link href="/">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </Link> */}

          <Link href="/profile">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <UserRoundCog className="mr-2 h-4 w-4" />
              Profile Settings
            </Button>
          </Link>
        </nav>
      </div>

      <div>
        <Button 
          variant="ghost" 
          className="w-full border border-zinc-200 justify-center text-zinc-600 hover:text-destructive hover:bg-destructive/10 hover:border-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
} 