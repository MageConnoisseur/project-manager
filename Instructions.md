# Project Instructions: Multi-User Cross-Project Priority Task Manager

## 1. Project Overview
[cite_start]This application is a multi-user task manager designed to help individuals isolate and balance tasks across multiple personal projects simultaneously[cite: 1, 2, 5]. [cite_start]It provides a way to separate tasks by project category while also allowing them to be consolidated into a unified, drag-and-drop priority sequence unique to each user[cite: 2, 4, 6].

## 2. Core Tech Stack
* [cite_start]**Backend Framework:** FastAPI (Python)[cite: 9, 14].
* [cite_start]**Database ORM:** SQLModel or SQLAlchemy with PostgreSQL[cite: 14, 19].
* [cite_start]**Frontend Framework:** React with TypeScript (built using Vite)[cite: 9, 14, 32].
* [cite_start]**State Management:** Zustand[cite: 20].
* [cite_start]**Drag and Drop Engine:** `@hello-pangea/dnd`[cite: 21, 22].

## 3. Database Schema & Data Models
The database must support individual user accounts and enforce strict relational constraints so users can only access their own data:

* **Users:** Represents the account holder. It must contain fields for `id`, `email` (unique), `hashed_password`, and creation timestamps.
* [cite_start]**Lists / Workspaces:** Represents top-level categories (e.g., "At Home Projects", "Work Projects")[cite: 6]. Each List must belong to a specific User via a `user_id` foreign key.
* [cite_start]**Projects:** Belongs to a specific List[cite: 2]. Each Project must also explicitly be tied to a specific User via a `user_id` foreign key constraint to ensure data isolation. [cite_start]It contains a title, description, and creation/update timestamps[cite: 2].
* [cite_start]**Tasks:** Belongs to a specific Project and inherits user ownership through it[cite: 2]. [cite_start]To optimize performance for the priority view, each task must track its parent List and Project[cite: 2, 4].
  * [cite_start]Fields required: `id`, `title`, `description`, `is_completed`, `priority_index` (integer/float for sorting), `is_recurring` (boolean), and `recurrence_frequency` (Daily, Weekly, Monthly, or Null)[cite: 7, 23].

## 4. Application Views & UI Requirements
[cite_start]The user interface consists of a secured layout with two toggleable primary views[cite: 2, 4]:

### A. Project Task View
* [cite_start]**Purpose:** Structure tasks strictly by the project they belong to for the logged-in user[cite: 2].
* [cite_start]**Functionality:** * Display the authenticated user's current projects[cite: 2].
  * [cite_start]Allow the user to create new projects and immediately add multiple tasks inside each specific project[cite: 2, 3].
  * Visual Example:
    ```text
    Project A:
      - Task 1
      - Task 2
    Project B:
      - Task 1
      - Task 2
    ```

### B. Priority List View
* [cite_start]**Purpose:** Provide a single, consolidated list to mix and tackle tasks from different projects simultaneously[cite: 4, 5].
* **Functionality:**
  * [cite_start]Pull all tasks belonging to the currently selected List (e.g., "Work Projects"), ignoring their project groupings, and sort them strictly by their `priority_index`[cite: 4, 6, 23].
  * [cite_start]Must support full drag-and-drop reordering that is highly intuitive and smooth[cite: 6].
  * Visual Example:
    ```text
    [Drag Handle] Project A - Task 1
    [Drag Handle] Project B - Task 1
    [Drag Handle] Project B - Task 2
    [Drag Handle] Project A - Task 2
    ```

## 5. Core Feature Specifications

### Authentication & User Context
* **Backend:** Implement a basic user registration and login flow using FastAPI's OAuth2 utilities and JWT (JSON Web Tokens). All project and task endpoints must require a valid user token and filter database queries strictly by the authenticated `user_id`.
* **Frontend:** Create an authentication state in the Zustand store to save the user's login token and attach it to the headers of all Axios outgoing requests.

### Drag and Drop Reordering Logic
* [cite_start]**Frontend:** Moving an item in the Priority List View should immediately update the local Zustand store for instantaneous UI responsiveness[cite: 6, 20, 24]. [cite_start]Once dropped, the frontend will fire an API call to save the new order[cite: 24].
* [cite_start]**Backend Endpoint:** Provide a `PUT /tasks/reorder` endpoint that accepts an ordered array of task IDs alongside their updated sequential `priority_index` values, updating them cleanly within a database transaction restricted to the current user's tasks[cite: 23, 24].

### Recurring Tasks
* [cite_start]**Configuration:** When creating or editing a task, users can check "Is Recurring" and select a frequency: Daily, Weekly, or Monthly[cite: 7].
* [cite_start]**Completion Logic:** When a recurring task is checked as completed, instead of permanently archiving or closing it, the system must automatically reset its completion status and calculate its next recurrence date based on the frequency[cite: 7].

## 6. Implementation & Development Guidelines
* [cite_start]**Modular Code:** Build functionality incrementally phase-by-phase rather than writing everything at once to prevent context mixing or incomplete code blocks[cite: 16, 17].
* [cite_start]**Type Safety:** Maintain strict TypeScript types across the frontend components and state to match the Pydantic/SQLModel definitions on the backend[cite: 15, 19].
* [cite_start]**API Documentation:** Ensure all CRUD endpoints for users, lists, projects, and tasks are properly integrated into FastAPI so they can be interactively tested using the automatic `/docs` Swagger page[cite: 31, 36].

## 7. Deployment Environment (For Context Only)
* [cite_start]**Database:** Neon (Serverless Postgres)[cite: 73, 78].
* [cite_start]**Backend Hosting:** Render[cite: 73, 78].
* [cite_start]**Frontend Hosting:** Vercel[cite: 73, 78].
* [cite_start]Note: Ensure configuration uses environment variables (.env) for database connection strings and base API URLs, and properly configure FastAPI CORS middleware to allow communication between the Render backend and Vercel frontend[cite: 91, 92, 93, 94].