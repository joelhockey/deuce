create table action (
    id identity,
    iin varchar(32),
    cin varchar(32),
    created_at timestamp default current_timestamp,
    version integer default 1 not null,
    csn varchar(16),
    aid varchar(32) not null,
    name varchar(255) not null,
    status varchar(255),
    updated_at timestamp,
    executed_at timestamp,
    completed_at timestamp,
    sw varchar(4),
    error varchar
);
alter table action add constraint chk_action_status check (status in ('01_ready', '02_executing', '03_complete', '04_timeout'));

create table gp_session (
    session_id varchar(255) not null,
    created_at timestamp default current_timestamp,
    last_accessed_at timestamp,
    iin varchar(32),
    cin varchar(32),
    csn varchar(16) not null,
    status varchar(255),
    host_challenge varchar(16),
    enc integer default 0 not null,
    mac integer default 0 not null,
    seq_counter integer,
    mac_iv varchar(16),
    p11_slot_id integer,
    p11_session_id integer,
    p11_static_enc integer,
    p11_static_mac integer,
    p11_static_dek integer,
    p11_session_cmac_des1 integer,
    p11_session_cmac_des3 integer,
    p11_session_senc integer,
    p11_session_dek integer
);
alter table gp_session add constraint unq_gp_session_id unique (session_id);
alter table gp_session add constraint chk_gp_session_status check (status in ('01_none', '02_initupdate', '03_established', '04_error'));

