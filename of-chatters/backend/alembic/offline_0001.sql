BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE teams (
    id SERIAL NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE chatters (
    id SERIAL NOT NULL, 
    external_id VARCHAR(255), 
    name VARCHAR(255) NOT NULL, 
    handle VARCHAR(255), 
    email VARCHAR(255), 
    phone VARCHAR(50), 
    team_id INTEGER, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    hired_at TIMESTAMP WITH TIME ZONE, 
    left_at TIMESTAMP WITH TIME ZONE, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(team_id) REFERENCES teams (id) ON DELETE SET NULL
);

CREATE TABLE shifts (
    id SERIAL NOT NULL, 
    chatter_id INTEGER NOT NULL, 
    team_id INTEGER, 
    shift_date DATE NOT NULL, 
    shift_day VARCHAR(20), 
    scheduled_start TIMESTAMP WITH TIME ZONE, 
    scheduled_end TIMESTAMP WITH TIME ZONE, 
    actual_start TIMESTAMP WITH TIME ZONE, 
    actual_end TIMESTAMP WITH TIME ZONE, 
    scheduled_hours NUMERIC(6, 2), 
    actual_hours NUMERIC(6, 2), 
    remarks TEXT, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(chatter_id) REFERENCES chatters (id), 
    FOREIGN KEY(team_id) REFERENCES teams (id)
);

CREATE INDEX ix_shifts_chatter_date ON shifts (chatter_id, shift_date);

CREATE TABLE performance_daily (
    id SERIAL NOT NULL, 
    chatter_id INTEGER NOT NULL, 
    team_id INTEGER, 
    shift_date DATE NOT NULL, 
    sales_amount NUMERIC(12, 2), 
    sold_count INTEGER, 
    retention_count INTEGER, 
    unlock_count INTEGER, 
    total_sales NUMERIC(12, 2), 
    sph NUMERIC(10, 2), 
    art_interval INTERVAL, 
    golden_ratio NUMERIC(10, 4), 
    hinge_top_up NUMERIC(12, 2), 
    tricks_tsf NUMERIC(12, 2), 
    conversion_rate NUMERIC(10, 4), 
    unlock_ratio NUMERIC(10, 4), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_perf_chatter_date UNIQUE (chatter_id, shift_date), 
    FOREIGN KEY(chatter_id) REFERENCES chatters (id), 
    FOREIGN KEY(team_id) REFERENCES teams (id)
);

CREATE INDEX ix_perf_shift_date ON performance_daily (shift_date);

CREATE INDEX ix_perf_chatter_date ON performance_daily (chatter_id, shift_date);

CREATE TABLE offenses (
    id SERIAL NOT NULL, 
    chatter_id INTEGER NOT NULL, 
    offense_type VARCHAR(100), 
    offense TEXT, 
    offense_date DATE, 
    details TEXT, 
    sanction TEXT, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(chatter_id) REFERENCES chatters (id)
);

CREATE TABLE rankings_daily (
    id SERIAL NOT NULL, 
    shift_date DATE NOT NULL, 
    metric VARCHAR(50) NOT NULL, 
    chatter_id INTEGER NOT NULL, 
    rank INTEGER NOT NULL, 
    metric_value NUMERIC(14, 4) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    CONSTRAINT uq_ranking_date_metric_chatter UNIQUE (shift_date, metric, chatter_id), 
    FOREIGN KEY(chatter_id) REFERENCES chatters (id)
);

CREATE TABLE users (
    id SERIAL NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    full_name VARCHAR(255), 
    password_hash VARCHAR(255) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    UNIQUE (email)
);

CREATE TABLE roles (
    id SERIAL NOT NULL, 
    name VARCHAR(50) NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE user_roles (
    user_id INTEGER NOT NULL, 
    role_id INTEGER NOT NULL, 
    PRIMARY KEY (user_id, role_id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    FOREIGN KEY(role_id) REFERENCES roles (id)
);

CREATE TABLE permissions (
    id SERIAL NOT NULL, 
    code VARCHAR(100), 
    description TEXT, 
    PRIMARY KEY (id), 
    UNIQUE (code)
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL, 
    permission_id INTEGER NOT NULL, 
    PRIMARY KEY (role_id, permission_id), 
    FOREIGN KEY(role_id) REFERENCES roles (id), 
    FOREIGN KEY(permission_id) REFERENCES permissions (id)
);

CREATE TABLE audit_logs (
    id BIGSERIAL NOT NULL, 
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    user_id INTEGER, 
    action TEXT NOT NULL, 
    entity TEXT NOT NULL, 
    entity_id TEXT, 
    before_json JSONB, 
    after_json JSONB, 
    ip VARCHAR(100), 
    user_agent TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE attachments (
    id SERIAL NOT NULL, 
    entity TEXT NOT NULL, 
    entity_id INTEGER NOT NULL, 
    filename TEXT NOT NULL, 
    mime_type TEXT, 
    storage_url TEXT NOT NULL, 
    uploaded_by INTEGER, 
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(uploaded_by) REFERENCES users (id)
);

CREATE TABLE saved_reports (
    id SERIAL NOT NULL, 
    owner_user_id INTEGER, 
    name TEXT NOT NULL, 
    description TEXT, 
    config_json JSONB NOT NULL, 
    is_public BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(owner_user_id) REFERENCES users (id)
);

CREATE OR REPLACE VIEW v_chatter_daily AS
        SELECT
            p.shift_date,
            c.id AS chatter_id,
            c.name AS chatter_name,
            t.name AS team_name,
            p.sales_amount,
            p.sold_count,
            p.retention_count,
            p.unlock_count,
            p.total_sales,
            p.sph,
            p.art_interval,
            p.golden_ratio,
            p.hinge_top_up,
            p.tricks_tsf,
            p.conversion_rate,
            p.unlock_ratio
        FROM performance_daily p
        LEFT JOIN chatters c ON c.id = p.chatter_id
        LEFT JOIN teams t ON t.id = p.team_id;;

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

COMMIT;

