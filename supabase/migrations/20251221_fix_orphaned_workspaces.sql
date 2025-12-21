-- ============================================
-- Signup Trigger - Creates Workspace on Registration
-- Migration: 20251221_fix_orphaned_workspaces.sql
-- 
-- This trigger ONLY runs on SIGNUP (new user registration)
-- Login does NOT create anything
-- ============================================

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the signup handler function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    -- Only runs on SIGNUP (new user registration), not login
    -- Create a new workspace for the user
    INSERT INTO public.workspaces (name, max_users, is_active, created_at, updated_at)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'My') || '''s Workspace',
        10, true, NOW(), NOW()
    )
    RETURNING id INTO new_workspace_id;

    -- Create user profile with admin role
    INSERT INTO public.users (id, email, full_name, role, workspace_id, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        'admin',
        new_workspace_id,
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger ONLY fires on INSERT (signup), never on login
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SUMMARY:
-- - Signup: Creates workspace + user with admin role
-- - Login: Does nothing (trigger only on INSERT)
-- ============================================
