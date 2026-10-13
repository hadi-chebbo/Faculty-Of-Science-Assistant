// The consequences the delete confirmation lists, from the stored resource.
export function deleteNotes(isPublished: boolean, solutionCount: number): string[] {
  const notes: string[] = [];
  if (isPublished) notes.push("It is published: students will no longer see it.");
  if (solutionCount > 0) {
    notes.push(
      `Its ${solutionCount} ${solutionCount === 1 ? "solution is" : "solutions are"} kept but will no longer be linked to it.`,
    );
  }
  return notes;
}
