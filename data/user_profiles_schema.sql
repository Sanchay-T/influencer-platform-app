--
-- PostgreSQL database dump
--

\restrict BQA6zyAIkbYbjLcdnbdRatnjJ3MxoMKI7dXMsRPluHYrkCwN1JdEuvDQfZdhwVA

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    name text,
    company_name text,
    industry text,
    email text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    signup_timestamp timestamp without time zone DEFAULT now() NOT NULL,
    onboarding_step character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    full_name text,
    business_name text,
    brand_description text,
    email_schedule_status jsonb DEFAULT '{}'::jsonb,
    trial_start_date timestamp without time zone,
    trial_end_date timestamp without time zone,
    trial_status character varying(20) DEFAULT 'pending'::character varying,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status character varying(20) DEFAULT 'none'::character varying,
    current_plan character varying(50) DEFAULT 'free'::character varying,
    is_admin boolean DEFAULT false,
    payment_method_id text,
    card_last_4 character varying(4),
    card_brand character varying(20),
    card_exp_month integer,
    card_exp_year integer,
    billing_address_city text,
    billing_address_country character varying(2),
    billing_address_postal_code character varying(20),
    plan_campaigns_limit integer,
    plan_creators_limit integer,
    plan_features jsonb,
    usage_campaigns_current integer DEFAULT 0,
    usage_creators_current_month integer DEFAULT 0,
    usage_reset_date timestamp without time zone DEFAULT now(),
    last_webhook_event character varying(100),
    last_webhook_timestamp timestamp without time zone,
    billing_sync_status character varying(20) DEFAULT 'pending'::character varying,
    trial_conversion_date timestamp without time zone,
    subscription_cancel_date timestamp without time zone,
    subscription_renewal_date timestamp without time zone,
    intended_plan character varying(50)
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict BQA6zyAIkbYbjLcdnbdRatnjJ3MxoMKI7dXMsRPluHYrkCwN1JdEuvDQfZdhwVA

