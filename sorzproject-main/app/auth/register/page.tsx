import React, { Suspense } from 'react';
// El componente viene de app, no de components directamente
import { RegisterForm } from 'app/components/auth/RegisterForm';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <Suspense fallback={
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Loading...</CardTitle>
          </CardHeader>
        </Card>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
} 