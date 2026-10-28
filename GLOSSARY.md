# UniversityAssistant

A study platform for Computer Science students at the Faculty of Science, Lebanese University
(Hadath). Students find course material and previous exams, keep what they want to come back to,
and plan their own study.

## Study tools (signed-in students)

**Saved resource**:
A resource a student has kept to come back to later. Private to that student.
_Avoid_: Bookmark (in the interface), favourite, pin

**To-do board**:
A student's own private board of cards, laid out in three fixed columns by status.
_Avoid_: Kanban, Jira, task list, planner

**Card**:
One thing a student plans to do, on their to-do board: a note, a note with a linked resource, or
just a linked resource.
_Avoid_: Task, ticket, todo item

**Card status**:
Which column a card is in: To do, In progress or Done.
_Avoid_: State, stage, progress

**Completion**:
A student's explicit statement that a resource is done, made by marking it done or by moving a
card linked to it into Done. Opening or downloading a resource never makes one, and moving a card
out of Done never removes one.
_Avoid_: Finished, read, seen

## Progress (signed-in students)

**Counted resource**:
A published lecture, notes or exercise. Only these make up chapter and course progress; exams are
counted apart, and solutions and other resources are not counted at all.
_Avoid_: Required material

**Chapter progress**:
How many of a chapter's counted resources a student has completed, out of how many there are.
_Avoid_: Chapter score

**Course progress**:
How many of a course's counted resources a student has completed, out of how many there are,
whether or not they sit in a chapter.
_Avoid_: Grade, score, course completion

**Exam practice**:
How many of a course's published exams a student has completed, out of how many there are. Never
merged into course progress.
_Avoid_: Exam score, exam progress

**Finished** (chapter or course):
A chapter or course whose progress is complete. It stops being finished if a new counted resource
is published in it.
_Avoid_: Completed, mastered

**My courses**:
The courses in which a student has at least one completion. There is no enrolment.
_Avoid_: Enrolled courses, subscriptions

**Active day**:
A day (Beirut time) on which a student made at least one completion. Once earned it is never lost.
_Avoid_: Streak, login day

**Milestone**:
One of a small fixed set of achievements a student earns once and keeps, such as finishing a first
chapter.
_Avoid_: Badge, trophy, achievement, reward
