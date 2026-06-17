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
import { formatRecurrenceSummary } from '../../utils/recurrence';
import {
  getVisiblePriorityTasks,
  mergeVisibleReorderIntoWorkspace,
  reorderArray,
  sortTasksByPriority,
} from '../../utils/priorityReorder';
import { isTaskActiveInPriorityList } from '../../utils/taskVisibility';
import { PriorityListFilterBar } from './PriorityListFilterBar';
import { TaskEditPanel } from './TaskEditPanel';

function getProjectTitle(projects: { id: number; title: string }[], projectId: number): string {
  const project = projects.find((item) => item.id === projectId);
  return project?.title ?? `Project #${projectId}`;
}

export function PriorityListView() {
  const tasks = useTaskStore((state) => state.tasks);
  const projects = useTaskStore((state) => state.projects);
  const selectedListId = useTaskStore((state) => state.selectedListId);
  const priorityListFilterByWorkspace = useTaskStore((state) => state.priorityListFilterByWorkspace);
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

  const fullWorkspaceTasks = useMemo(() => sortTasksByPriority(tasks), [tasks]);

  const activeWorkspaceTasks = useMemo(
    () => fullWorkspaceTasks.filter((task) => isTaskActiveInPriorityList(task)),
    [fullWorkspaceTasks],
  );

  const displayedTasks = useMemo(
    () => getVisiblePriorityTasks(activeWorkspaceTasks, projectFilterId),
    [activeWorkspaceTasks, projectFilterId],
  );

  const scheduledTaskCount = fullWorkspaceTasks.length - activeWorkspaceTasks.length;

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

  if (selectedListId === null) {
    return <p className="priority-list__hint">Select a workspace to view its priority list.</p>;
  }

  if (isLoading && fullWorkspaceTasks.length === 0) {
    return <p className="priority-list__hint">Loading tasks…</p>;
  }

  const isFiltered = projectFilterId !== null;

  return (
    <section className="priority-list">
      <h3>Priority list</h3>
      <PriorityListFilterBar />

      <p className="priority-list__hint">
        {isFiltered
          ? 'Drag tasks to reorder this project within the workspace priority line.'
          : 'Drag tasks to reorder the full workspace list. Changes save automatically.'}
      </p>

      {scheduledTaskCount > 0 && (
        <p className="priority-list__hint">
          {scheduledTaskCount} recurring {scheduledTaskCount === 1 ? 'task is' : 'tasks are'} scheduled
          for a future date and hidden until due.
        </p>
      )}

      {storeError && <p className="text-red-500">{storeError}</p>}

      {displayedTasks.length === 0 ? (
        <p className="priority-list__hint">
          {isFiltered
            ? 'No active tasks in this project. Create one using the sidebar project and the form below.'
            : 'No active tasks in this workspace yet. Create one below.'}
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="priority-tasks">
            {(droppableProvided) => (
              <ul
                className="priority-list__items"
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
              >
                {displayedTasks.map((task, index) => {
                  const recurrenceSummary = formatRecurrenceSummary(task);
                  const isEditing = editingTaskId === task.id;

                  return (
                    <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                      {(draggableProvided, snapshot) => (
                        <li
                          className={
                            snapshot.isDragging
                              ? 'priority-list__item priority-list__item--dragging'
                              : 'priority-list__item'
                          }
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                        >
                          <span
                            className="priority-list__handle"
                            {...draggableProvided.dragHandleProps}
                            aria-label="Drag to reorder"
                          >
                            ⋮⋮
                          </span>

                          <input
                            className="priority-list__checkbox"
                            type="checkbox"
                            checked={task.is_completed}
                            disabled={completingTaskId === task.id}
                            aria-label={`Mark "${task.title}" complete`}
                            onChange={(event) =>
                              void handleCompleteToggle(task.id, event.target.checked)
                            }
                          />

                          <div className="priority-list__content">
                            <div className="priority-list__label">
                              {!isFiltered && (
                                <>{getProjectTitle(projects, task.project_id)} — </>
                              )}
                              <span>{task.title}</span>
                            </div>

                            {!isEditing && task.description.trim() !== '' && (
                              <p className="priority-list__notes">{task.description}</p>
                            )}

                            {recurrenceSummary && (
                              <p className="priority-list__meta">{recurrenceSummary}</p>
                            )}

                            {isEditing && (
                              <TaskEditPanel
                                key={task.id}
                                task={task}
                                onClose={() => setEditingTaskId(null)}
                              />
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() =>
                              setEditingTaskId((current) => (current === task.id ? null : task.id))
                            }
                          >
                            {isEditing ? 'Close' : 'Edit'}
                          </button>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {droppableProvided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </section>
  );
}
