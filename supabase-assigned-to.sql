-- Add assigned_to column to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks(assigned_to);

-- RLS: allow project owner and members to update assigned_to (already covered by existing UPDATE policy)
-- No new RLS needed since tasks UPDATE is already open to owner + members.
