-- ============================================
-- TASKS TABLE (Tasks from Copper)
-- ============================================
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'copper',
  
  -- Core fields
  name TEXT NOT NULL,
  details TEXT,
  status TEXT,
  priority TEXT,
  
  -- Relationships
  parent_task_id TEXT, -- For subtasks: references the parent task
  related_to_type TEXT, -- 'account', 'person', 'opportunity', 'lead'
  related_to_id TEXT,
  account_id TEXT,
  person_id TEXT,
  opportunity_id TEXT,
  
  -- Ownership
  owner TEXT,
  owner_id INTEGER,
  assignee_id INTEGER,
  
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reminder_date TIMESTAMPTZ,
  
  -- Copper metadata
  copper_id INTEGER,
  tags TEXT,
  
  -- Custom fields
  account_number TEXT,
  account_order_id TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_company_id ON tasks(company_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_account_id ON tasks(account_id);
CREATE INDEX idx_tasks_person_id ON tasks(person_id);
CREATE INDEX idx_tasks_opportunity_id ON tasks(opportunity_id);
CREATE INDEX idx_tasks_related_to ON tasks(related_to_type, related_to_id);
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_copper_id ON tasks(copper_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Full-text search
CREATE INDEX idx_tasks_search ON tasks USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(details, '') || ' ' ||
    COALESCE(owner, '')
  )
);
