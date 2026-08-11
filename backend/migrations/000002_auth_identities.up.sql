-- AuthIdentity: generic provider identity (google now, apple later).
-- Email unique index is a separate migration (000003) so duplicate
-- non-empty emails cannot block creating this table.

CREATE TABLE IF NOT EXISTS auth_identities (
    id BIGSERIAL PRIMARY KEY,
    korisnik_id BIGINT NOT NULL REFERENCES korisnici(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    provider VARCHAR(32) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_auth_provider_sub
    ON auth_identities (provider, provider_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_auth_user_provider
    ON auth_identities (korisnik_id, provider);
