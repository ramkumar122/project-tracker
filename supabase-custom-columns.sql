-- ============================================================
-- Project Tracker — Custom Columns
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Run AFTER supabase-schema.sql and supabase-collaboration.sql
-- ============================================================

-- 1. Drop the hardcoded CHECK constraint on tasks.status
--    so custom column slugs are valid status values
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 2. Create project_columns table
CREATE TABLE IF NOT EXISTS public.project_columns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, slug)
);

ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "columns_select" ON public.project_columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (
        p.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "columns_insert" ON public.project_columns
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

CREATE POLICY "columns_update" ON public.project_columns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- Only non-default columns can be deleted (also enforced by app logic)
CREATE POLICY "columns_delete" ON public.project_columns
  FOR DELETE USING (
    is_default = false AND
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- 4. Trigger: auto-create default columns when a new project is created
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_columns (project_id, name, slug, color, position, is_default)
  VALUES
    (NEW.id, 'To Do',       'todo',       '#f43f5e', 0, true),
    (NEW.id, 'In Progress', 'inprogress', '#f59e0b', 1, true),
    (NEW.id, 'On Hold',     'onhold',     '#8b5cf6', 2, true),
    (NEW.id, 'Done',        'done',       '#10b981', 3, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- 5. Seed default columns for all EXISTING projects that don't have any
INSERT INTO public.project_columns (project_id, name, slug, color, position, is_default)
SELECT p.id, v.name, v.slug, v.color, v.position, true
FROM public.projects p
CROSS JOIN (VALUES
  ('To Do',       'todo',       '#f43f5e', 0),
  ('In Progress', 'inprogress', '#f59e0b', 1),
  ('On Hold',     'onhold',     '#8b5cf6', 2),
  ('Done',        'done',       '#10b981', 3)
) AS v(name, slug, color, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc
  WHERE pc.project_id = p.id AND pc.slug = v.slug
)
ON CONFLICT (project_id, slug) DO NOTHING;

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_columns;
