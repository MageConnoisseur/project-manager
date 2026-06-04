/**
 * Shared TypeScript types for the frontend.
 *
 * These shapes mirror the Pydantic response models in the FastAPI backend
 * (app/schemas/*) so components and stores stay aligned with the API.
 */

/** How often a recurring task repeats — matches app.models.enums.RecurrenceUnit */
export type RecurrenceUnit = 'day' | 'week' | 'month';

/**
 * A workspace returned from GET /lists.
 * The UI label is "list" or "workspace"; the API path is /lists.
 */
export interface WorkspaceList {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/** A project returned from GET /projects */
export interface Project {
  id: number;
  workspace_id: number;
  title: string;
  description: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

/** A task returned from GET /tasks */
export interface Task {
  id: number;
  project_id: number;
  workspace_id: number;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  priority_index: number;
  is_recurring: boolean;
  recurrence_interval: number | null;
  recurrence_unit: RecurrenceUnit | null;
  created_at: string;
  updated_at: string;
}

/** Public user fields from POST /auth/signup or GET /auth/me */
export interface UserPublic {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
}

/** Body from POST /auth/token */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}
