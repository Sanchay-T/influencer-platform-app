import { useUser } from '@clerk/nextjs';

export function useAdmin() {
  const { user, isLoaded } = useUser();
  
  // Get admin emails from environment variable
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
  
  // Check if current user is an admin
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const isAdmin = adminEmails.includes(userEmail);
  
  return {
    isAdmin,
    isLoaded,
    user,
    userEmail,
    adminEmails
  };
}