const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function migrateAdminRoles() {
  console.log('\n🔐 ADDING ADMIN ROLE SYSTEM TO DATABASE\n');
  console.log('='.repeat(60));

  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('📋 Step 1: Adding isAdmin column to user_profiles...');
    
    // Check if column already exists
    const columnExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'is_admin'
      );
    `;

    if (columnExists[0].exists) {
      console.log('✅ Column is_admin already exists, skipping creation');
    } else {
      await sql`ALTER TABLE "user_profiles" ADD COLUMN "is_admin" boolean DEFAULT false;`;
      console.log('✅ Added is_admin column to user_profiles');
    }

    console.log('\n📊 Step 2: Creating admin indexes...');
    
    // Create admin index (if not exists)
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_user_profiles_is_admin" 
      ON "user_profiles" ("is_admin") WHERE is_admin = true;
    `;
    console.log('✅ Created admin status index');

    await sql`
      CREATE INDEX IF NOT EXISTS "idx_user_profiles_admin_details" 
      ON "user_profiles" ("is_admin", "full_name", "email", "updated_at");
    `;
    console.log('✅ Created admin details index');

    console.log('\n⚡ Step 3: Creating admin timestamp trigger...');
    
    // Create trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_admin_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
              NEW.updated_at = NOW();
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    console.log('✅ Created admin timestamp function');

    // Create trigger
    await sql`
      DROP TRIGGER IF EXISTS trigger_update_admin_timestamp ON user_profiles;
    `;
    await sql`
      CREATE TRIGGER trigger_update_admin_timestamp
          BEFORE UPDATE OF is_admin ON user_profiles
          FOR EACH ROW
          EXECUTE FUNCTION update_admin_timestamp();
    `;
    console.log('✅ Created admin timestamp trigger');

    console.log('\n💬 Step 4: Adding documentation...');
    await sql`
      COMMENT ON COLUMN user_profiles.is_admin IS 'Database-based admin role. Used alongside NEXT_PUBLIC_ADMIN_EMAILS environment variable.';
    `;
    console.log('✅ Added column documentation');

    console.log('\n📈 Step 5: Analyzing table for better performance...');
    await sql`ANALYZE user_profiles;`;
    console.log('✅ Table analysis completed');

    console.log('\n📊 Step 6: Verifying admin system...');
    const adminCount = await sql`
      SELECT COUNT(*) as count FROM user_profiles WHERE is_admin = true;
    `;
    console.log(`✅ Current database admins: ${adminCount[0].count}`);

    const totalUsers = await sql`
      SELECT COUNT(*) as count FROM user_profiles;
    `;
    console.log(`📊 Total users in database: ${totalUsers[0].count}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ADMIN ROLE SYSTEM SUCCESSFULLY ADDED!');
    console.log('='.repeat(60));
    console.log('\n✨ Features now available:');
    console.log('   • Database-based admin role management');
    console.log('   • Environment variable admin fallback');
    console.log('   • Admin promotion/demotion from UI');
    console.log('   • Automatic timestamp updates');
    console.log('   • Optimized admin queries');
    console.log('\n🔐 Security improvements:');
    console.log('   • Proper admin authentication');
    console.log('   • Unified admin checking system');
    console.log('   • Audit trail with timestamps');

  } catch (error) {
    console.error('❌ Error migrating admin roles:', error);
  } finally {
    await sql.end();
  }
}

migrateAdminRoles();