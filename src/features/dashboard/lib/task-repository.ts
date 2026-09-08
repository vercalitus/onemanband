"use client"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { TodoItem } from "@/types/domain"

/**
 * The practitioner's own tasks.
 *
 * Only the ones a person typed. The "needs attention" rows beside them are
 * derived from clinic records every time the board is built and are never
 * written down — storing a computed fact is how a board starts telling you to
 * chase an invoice that was paid last week.
 */

interface TaskRow {
  id: string
  title: string
  due_label: string
  completed_at: string | null
}

const COLUMNS = "id, title, due_label, completed_at"

function toTodo(row: TaskRow): TodoItem {
  return {
    id: `task-${row.id}`,
    title: row.title,
    due: row.due_label,
    priority: "medium",
    kind: "active",
    completed: !!row.completed_at,
  }
}

/** Board ids carry a prefix so the provider can tell a saved task from a signal. */
export const isTaskRow = (id: string) => id.startsWith("task-")
const rowId = (todoId: string) => todoId.replace(/^task-/, "")

/** Null when there is no database to ask — the board then keeps its own state. */
export async function fetchTasks(): Promise<TodoItem[] | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null

  const { data, error } = await db
    .from("tasks")
    .select(COLUMNS)
    .order("created_at", { ascending: true })

  if (error) return null
  return (data as TaskRow[]).map(toTodo)
}

async function currentClinicId(): Promise<string | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data } = await db
    .from("profiles")
    .select("clinic_id")
    .eq("id", auth.user.id)
    .maybeSingle()
  return data?.clinic_id ?? null
}

export async function createTask(input: {
  title: string
  due: string
}): Promise<TodoItem | null> {
  const db = createSupabaseBrowserClient()
  if (!db) return null
  const clinicId = await currentClinicId()
  if (!clinicId) return null

  const { data: auth } = await db.auth.getUser()
  const { data, error } = await db
    .from("tasks")
    .insert({
      clinic_id: clinicId,
      title: input.title,
      due_label: input.due,
      created_by: auth.user?.id ?? null,
    })
    .select(COLUMNS)
    .single()

  if (error) return null
  return toTodo(data as TaskRow)
}

/**
 * Ticking a task off is a timestamp rather than a flag, so the completed list
 * can be ordered and, later, cleared by age. Unticking clears it.
 */
export async function setTaskCompleted(
  todoId: string,
  completed: boolean,
): Promise<boolean> {
  const db = createSupabaseBrowserClient()
  if (!db) return false
  const { error } = await db
    .from("tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", rowId(todoId))
  return !error
}

export async function deleteTask(todoId: string): Promise<boolean> {
  const db = createSupabaseBrowserClient()
  if (!db) return false
  const { error } = await db.from("tasks").delete().eq("id", rowId(todoId))
  return !error
}
