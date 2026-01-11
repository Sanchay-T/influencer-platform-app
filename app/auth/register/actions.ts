'use server';

import { redirect } from 'next/navigation';

export async function signUp(_formData: FormData) {
	redirect('/sign-up');
}
