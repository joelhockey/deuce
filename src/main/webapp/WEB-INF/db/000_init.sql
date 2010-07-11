-- 0 init
create table db_version (
    version integer not null,
    created_at timestamp not null,
    filename varchar(255),
    script clob
);

create table dual(dummy varchar(1));
insert into dual(dummy) values ('X');

-- 1 create
