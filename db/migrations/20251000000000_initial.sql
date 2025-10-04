-- migrate:up
CREATE TABLE initial();

-- migrate:down
DROP TABLE initial();
