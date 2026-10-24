--
-- PostgreSQL database dump
--
SET statement_timeout = 0;
SET client_encoding = 'UTF8';
CREATE SCHEMA loyalty;
CREATE TABLE loyalty.member (
    member_id integer NOT NULL,
    card_no character varying(16) NOT NULL,
    cust_no character varying(20),
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    tier text DEFAULT 'basic'::text,
    points_balance numeric(12,0) DEFAULT 0
);
ALTER TABLE loyalty.member OWNER TO app;
COMMENT ON TABLE loyalty.member IS 'Loyalty programme members';
COMMENT ON COLUMN loyalty.member.card_no IS 'Number printed on the card';
CREATE SEQUENCE loyalty.member_member_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1;
ALTER TABLE ONLY loyalty.member ALTER COLUMN member_id SET DEFAULT nextval('loyalty.member_member_id_seq'::regclass);
CREATE TABLE loyalty.points_txn (
    txn_id bigint NOT NULL,
    member_id integer NOT NULL,
    booked_at timestamp(3) without time zone NOT NULL,
    points integer NOT NULL,
    reason character(4),
    tags text[]
);
CREATE VIEW loyalty.v_balances AS
 SELECT member_id, sum(points) AS points FROM loyalty.points_txn GROUP BY member_id;
ALTER TABLE ONLY loyalty.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (member_id);
ALTER TABLE ONLY loyalty.points_txn
    ADD CONSTRAINT points_txn_pkey PRIMARY KEY (txn_id);
CREATE INDEX points_txn_member_idx ON loyalty.points_txn USING btree (member_id);
ALTER TABLE ONLY loyalty.points_txn
    ADD CONSTRAINT points_txn_member_fk FOREIGN KEY (member_id) REFERENCES loyalty.member(member_id);
GRANT SELECT ON TABLE loyalty.member TO reporting;
