import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function expectThat(condition: unknown, message: string) {
  try {
    assert.ok(condition, message);
  } catch (error) {
    console.error('\u274c', message);
    throw error;
  }
}

(async () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(
    currentDir,
    '../../app/(marketing)/marketing-landing.tsx',
  );

  const content = readFileSync(filePath, 'utf8');

  expectThat(
    content.includes('id="pricing"'),
    'Marketing landing should expose #pricing anchor for scroll links',
  );

  expectThat(
    content.includes('<SignUpButton'),
    'Sign up CTA should use Clerk SignUpButton',
  );

  expectThat(
    content.includes('<SignInButton'),
    'Sign in CTA should use Clerk SignInButton',
  );

  console.log('\u2705 landing-nav tests passed');
})();
