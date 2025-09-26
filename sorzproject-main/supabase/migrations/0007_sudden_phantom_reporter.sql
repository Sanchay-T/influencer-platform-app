-- Agregar el campo email faltante a la tabla user_profiles existente
ALTER TABLE "user_profiles" ADD COLUMN "email" text;

-- Agregar la restricción UNIQUE al campo user_id
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id");
