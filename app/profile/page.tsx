'use client';

// Siempre añadir ComponentProps cuando se importa react con card
import React, { useState, useEffect, ComponentProps } from 'react';
import { useUser } from '@clerk/nextjs';
import DashboardLayout from '../components/layout/dashboard-layout';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import {
  Pencil,
  Lock,
  User,
  Building2,
  Factory,
  Mail
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

type CardProps = ComponentProps<typeof Card>;
type CardHeaderProps = ComponentProps<typeof CardHeader>;
type CardContentProps = ComponentProps<typeof CardContent>;
type CardTitleProps = ComponentProps<typeof CardTitle>;
type CardDescriptionProps = ComponentProps<typeof CardDescription>;
type CardFooterProps = ComponentProps<typeof CardFooter>;

export default function ProfileSettingsPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: '',
    company_name: '',
    industry: '',
    email: ''
  });

  const supabase = createClient();

  useEffect(() => {
    async function getUserProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('Error al obtener usuario:', authError);
          setError('Error al obtener información del usuario');
          return;
        }

        if (!user) {
          console.error('No hay usuario autenticado');
          setError('No hay usuario autenticado');
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (profileError) {
          console.error('Error al obtener perfil:', profileError);
          setError('Error al obtener el perfil de usuario');
          return;
        }

        // Siempre establecer el email del usuario
        const baseProfile = {
          name: '',
          company_name: '',
          industry: '',
          email: user.email || ''
        };

        // Si hay un perfil, actualizar con sus datos
        if (profiles && profiles.length > 0) {
          const profile = profiles[0];
          setUserProfile({
            ...baseProfile,
            name: profile.name || '',
            company_name: profile.company_name || '',
            industry: profile.industry || ''
          });
        } else {
          // Si no hay perfil, usar el perfil base
          setUserProfile(baseProfile);
        }
      } catch (error) {
        console.error('Error inesperado:', error);
        setError('Ocurrió un error inesperado');
      }
    }

    getUserProfile();
  }, []);

  const handleEmailChange = async () => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setError('Error al cambiar el email.');
    } else {
      setMessage('Email updated successfully.');
      setUserProfile(prev => ({ ...prev, email }));
      setIsEditingEmail(false);
      setEmail('');
    }
  };

  const handlePasswordChange = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError('Error al cambiar la contraseña.');
    } else {
      setMessage('Password updated successfully.');
      setPassword('');
      setIsEditingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground">
            Manage your personal information and credentials
          </p>
        </div>
        
        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Your account and company details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && error !== 'No se encontró un perfil para este usuario' ? (
              <div className="text-sm text-red-500 p-4 bg-red-50 rounded-md">
                {error}
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center space-x-4">
                  <User className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Name</Label>
                    <p className="text-sm text-muted-foreground">{userProfile.name || 'Not available'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Building2 className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Company</Label>
                    <p className="text-sm text-muted-foreground">{userProfile.company_name || 'Not available'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <Factory className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Industry</Label>
                    <p className="text-sm text-muted-foreground">{userProfile.industry || 'Not available'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
            <CardDescription>
              Update your email and password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Mail className="text-gray-500" size={20} />
                    <div className="space-y-0.5">
                      <Label>Current Email</Label>
                      <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => setIsEditingEmail(!isEditingEmail)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                </div>
                {isEditingEmail && (
                  <div className="space-y-2">
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="New Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button onClick={handleEmailChange} variant="secondary">
                      Save new email
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Lock className="text-gray-500" size={20} />
                    <div className="space-y-0.5">
                      <Label>Password</Label>
                      <p className="text-sm text-muted-foreground">••••••••</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => setIsEditingPassword(!isEditingPassword)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                </div>
                {isEditingPassword && (
                  <div className="space-y-2">
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="New Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button onClick={handlePasswordChange} variant="secondary">
                      Save new password
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {message && <p className="text-sm text-green-500">{message}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
} 