/**
 * Priority list view with drag-and-drop reordering and optional project filter.
 *
 * The store always holds the full workspace task list. The filter bar shows
 * a subset. Reorder uses Option A: filtered drags merge back into the full
 * workspace line without moving other projects' tasks from their slots.
 */

import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useEffect, useMemo, useState } from 'react';

import { useTaskStore } from '../../store/taskStore';
import type { Task } from '../../types';
import { formatRecurrenceSummary } from '../../utils/recurrence';
import {
  getVisiblePriorityTasks,
  mergeVisibleReorderIntoWorkspace,
  reorderArray,
  sortTasksByPriority,
} from '../../utils/priorityReorder';
import {
  isRecurringTaskScheduledForFuture,
  isTaskCompletedInPriorityList,
  isTaskVisibleByStatusFilter,
  type PriorityListStatusFilter,
} from '../../utils/taskVisibility';
import { PriorityListFilterBar } from './PriorityListFilterBar';
import { TaskEditPanel } from './TaskEditPanel';

function getProjectTitle(projects: { id: number; title: string }[], projectId: number): string {
  const project = projects.find((item) => item.id === projectId);
  return project?.title ?? `Project #${projectId}`;
}

interface PriorityTaskItemProps {
  task: Task;
  projects: { id: number; title: string }[];
  showProjectName: boolean;
  variant: PriorityListStatusFilter;
  completingTaskId: number | null;
  editingTaskId: number | null;
  itemRef?: React.Ref<HTMLLIElement>;
  itemProps?: React.HTMLAttributes<HTMLLIElement>;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  isDragging?: boolean;
  onCompleteToggle: (taskId: number, isCompleted: boolean) => void;
  onToggleEdit: (taskId: number) => void;
  onCloseEdit: () => void;
}

function PriorityTaskItem({
  task,
  projects,
  showProjectName,
  variant,
  completingTaskId,
  editingTaskId,
  itemRef,
  itemProps,
  dragHandleProps,
  isDragging = false,
  onCompleteToggle,
  onToggleEdit,
  onCloseEdit,
}: PriorityTaskItemProps) {
  const recurrenceSummary = formatRecurrenceSummary(task);
  const isEditing = editingTaskId === task.id;
  const className = [
    'priority-list__item',
    variant === 'completed' ? 'priority-list__item--completed' : '',
    variant === 'scheduled' ? 'priority-list__item--scheduled' : '',
    isDragging ? 'priority-list__item--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li ref={itemRef} className={className} {...itemProps}>
      {variant === 'active' && dragHandleProps && (
        <span className="priority-list__handle" {...dragHandleProps} aria-label="Drag to reorder">
          ⋮⋮
        </span>
      )}

      <input
        className="priority-list__checkbox"
        type="checkbox"
        checked={task.is_completed}
        disabled={completingTaskId === task.id}
        aria-label={`Mark "${task.title}" complete`}
        onChange={(event) => onCompleteToggle(task.id, event.target.checked)}
      />

      <div className="priority-list__content">
        <div className="priority-list__label">
          {showProjectName && <>{getProjectTitle(projects, task.project_id)} — </>}
          <span>{task.title}</span>
        </div>

        {!isEditing && task.description.trim() !== '' && (
          <p className="priority-list__notes">{task.description}</p>
        )}

        {recurrenceSummary && <p className="priority-list__meta">{recurrenceSummary}</p>}

        {isEditing && (
          <TaskEditPanel key={task.id} task={task} onClose={onCloseEdit} />
        )}
      </div>

      <button type="button" className="btn btn--small" onClick={() => onToggleEdit(task.id)}>
        {isEditing ? 'Close' : 'Edit'}
      </button>
    </li>
  );
}

export function PriorityListView() {
  const tasks = useTaskStore((state) => state.tasks);
  const projects = useTaskStore((state) => state.projects);
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const priorityListFilterByWorkspace = useTaskStore((state) => state.priorityListFilterByWorkspace);
  const priorityListStatusFilterByWorkspace = useTaskStore(
    (state) => state.priorityListStatusFilterByWorkspace,
  );
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const reorderTasks = useTaskStore((state) => state.reorderTasks);
  const updateTask = useTaskStore((state) => state.updateTask);
  const storeError = useTaskStore((state) => state.error);
  const isLoading = useTaskStore((state) => state.isLoading);

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const projectFilterId =
    selectedListId !== null
      ? (priorityListFilterByWorkspace[selectedListId] ?? null)
      : null;

  const statusFilter: PriorityListStatusFilter =
    selectedListId !== null
      ? (priorityListStatusFilterByWorkspace[selectedListId] ?? 'active')
      : 'active';

  const isActiveView = statusFilter === 'active';

  const fullWorkspaceTasks = useMemo(() => sortTasksByPriority(tasks), [tasks]);

  const statusFilteredTasks = useMemo(
    () => fullWorkspaceTasks.filter((task) => isTaskVisibleByStatusFilter(task, statusFilter)),
    [fullWorkspaceTasks, statusFilter],
  );

  const displayedTasks = useMemo(
    () => getVisiblePriorityTasks(statusFilteredTasks, projectFilterId),
    [statusFilteredTasks, projectFilterId],
  );

  const scheduledRecurringCount = useMemo(
    () => fullWorkspaceTasks.filter((task) => isRecurringTaskScheduledForFuture(task)).length,
    [fullWorkspaceTasks],
  );

  const completedCount = useMemo(
    () => fullWorkspaceTasks.filter((task) => isTaskCompletedInPriorityList(task)).length,
    [fullWorkspaceTasks],
  );

  useEffect(() => {
    if (selectedListId !== null) {
      void fetchTasks(selectedListId);
    }
  }, [selectedListId, fetchTasks]);

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) {
      return;
    }

    if (result.destination.index === result.source.index) {
      return;
    }

    const reorderedVisible = reorderArray(
      displayedTasks,
      result.source.index,
      result.destination.index,
    );

    const visibleIds = new Set(displayedTasks.map((task) => task.id));
    const mergedFullList = mergeVisibleReorderIntoWorkspace(
      fullWorkspaceTasks,
      visibleIds,
      reorderedVisible,
    );

    await reorderTasks(mergedFullList);
  }

  async function handleCompleteToggle(taskId: number, isCompleted: boolean) {
    setCompletingTaskId(taskId);
    try {
      await updateTask(taskId, { is_completed: isCompleted });
    } finally {
      setCompletingTaskId(null);
    }
  }

  function handleToggleEdit(taskId: number) {
    setEditingTaskId((current) => (current === taskId ? null : taskId));
  }

  if (selectedListId === null) {
    return <p className="priority-list__hint">Select a workspace to view its priority list.</p>;
  }

  if (isLoading && fullWorkspaceTasks.length === 0) {
    return <p className="priority-list__hint">Loading tasks…</p>;
  }

  const isProjectFiltered = projectFilterId !== null;

  const emptyMessage =
    statusFilter === 'completed'
      ? isProjectFiltered
        ? 'No completed tasks in this project yet.'
        : 'No completed tasks in this workspace yet.'
      : statusFilter === 'scheduled'
        ? isProjectFiltered
          ? 'No scheduled recurring tasks in this project.'
          : 'No scheduled recurring tasks in this workspace.'
        : isProjectFiltered
          ? 'No active tasks in this project. Create one using the sidebar project and the form below.'
          : 'No active tasks in this workspace yet. Create one below.';

  return (
    <section className="priority-list">
      <h3>Priority list</h3>
      <PriorityListFilterBar />

      {isActiveView && (
        <p className="priority-list__hint">
          {isProjectFiltered
            ? 'Drag tasks to reorder this project within the workspace priority line.'
            : 'Drag tasks to reorder the full workspace list. Changes save automatically.'}
        </p>
      )}

      {statusFilter === 'completed' && (
        <p className="priority-list__hint">
          Completed tasks are read-only in the list order. Uncheck a task to return it to the active
          priority list.
        </p>
      )}

      {statusFilter === 'scheduled' && (
        <p className="priority-list__hint">
          These recurring tasks are waiting for their next due date. Edit a task to change its
          schedule.
        </p>
      )}

      {isActiveView && scheduledRecurringCount > 0 && (
        <p className="priority-list__hint">
          {scheduledRecurringCount} recurring{' '}
          {scheduledRecurringCount === 1 ? 'task is' : 'tasks are'} scheduled for a future date.
          Use the &ldquo;Scheduled recurring&rdquo; filter above to view them.
        </p>
      )}

      {isActiveView && completedCount > 0 && (
        <p className="priority-list__hint">
          {completedCount} completed {completedCount === 1 ? 'task' : 'tasks'} hidden. Use the
          &ldquo;Completed tasks&rdquo; filter above to view them.
        </p>
      )}

      {storeError && <p className="text-red-500">{storeError}</p>}

      {displayedTasks.length === 0 ? (
        <p className="priority-list__hint">{emptyMessage}</p>
      ) : isActiveView ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="priority-tasks">
            {(droppableProvided) => (
              <ul
                className="priority-list__items"
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
              >
                {displayedTasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                    {(draggableProvided, snapshot) => (
                      <PriorityTaskItem
                        task={task}
                        projects={projects}
                        showProjectName={!isProjectFiltered}
                        variant="active"
                        completingTaskId={completingTaskId}
                        editingTaskId={editingTaskId}
                        itemRef={draggableProvided.innerRef}
                        itemProps={draggableProvided.draggableProps}
                        dragHandleProps={draggableProvided.dragHandleProps ?? undefined}
                        isDragging={snapshot.isDragging}
                        onCompleteToggle={(taskId, isCompleted) =>
                          void handleCompleteToggle(taskId, isCompleted)
                        }
                        onToggleEdit={handleToggleEdit}
                        onCloseEdit={() => setEditingTaskId(null)}
                      />
                    )}
                  </Draggable>
                ))}
                {droppableProvided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <ul className="priority-list__items">
          {displayedTasks.map((task) => (
            <PriorityTaskItem
              key={task.id}
              task={task}
              projects={projects}
              showProjectName={!isProjectFiltered}
              variant={statusFilter}
              completingTaskId={completingTaskId}
              editingTaskId={editingTaskId}
              onCompleteToggle={(taskId, isCompleted) => void handleCompleteToggle(taskId, isCompleted)}
              onToggleEdit={handleToggleEdit}
              onCloseEdit={() => setEditingTaskId(null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
