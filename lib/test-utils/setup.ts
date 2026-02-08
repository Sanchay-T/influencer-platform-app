import dotenv from 'dotenv';

// Load env vars for test runs — same DB as dev
const envFiles = ['.env.local', '.env.development', '.env'];
for (const envFile of envFiles) {
	const result = dotenv.config({ path: envFile });
	if (result.parsed) {
		break;
	}
}

if (!process.env.DATABASE_URL) {
	throw new Error(
		'DATABASE_URL is not set. Tests require a real database connection.\n' +
			'Ensure .env.local or .env.development has DATABASE_URL defined.'
	);
}
