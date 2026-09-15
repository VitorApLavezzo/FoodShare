-- AlterTable
CREATE SEQUENCE sync_events_sequence_seq;
ALTER TABLE "sync_events" ALTER COLUMN "sequence" SET DEFAULT nextval('sync_events_sequence_seq');
ALTER SEQUENCE sync_events_sequence_seq OWNED BY "sync_events"."sequence";

