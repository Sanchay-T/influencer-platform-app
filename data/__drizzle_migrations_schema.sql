--
-- PostgreSQL database dump
--

\restrict YiDcghZwYz0cKt42gnQ7X6swDvlsYOu0AM1iB687Ze3uLv6F1v8uNuCpZgdxxdV

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
-- Name: __drizzle_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE public.__drizzle_migrations OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.__drizzle_migrations_id_seq OWNED BY public.__drizzle_migrations.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('public.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: TABLE __drizzle_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.__drizzle_migrations TO anon;
GRANT ALL ON TABLE public.__drizzle_migrations TO authenticated;
GRANT ALL ON TABLE public.__drizzle_migrations TO service_role;


--
-- Name: SEQUENCE __drizzle_migrations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.__drizzle_migrations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.__drizzle_migrations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.__drizzle_migrations_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict YiDcghZwYz0cKt42gnQ7X6swDvlsYOu0AM1iB687Ze3uLv6F1v8uNuCpZgdxxdV

