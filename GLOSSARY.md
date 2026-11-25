# UniversityAssistant

A study platform for Computer Science students at the Faculty of Science, Lebanese University
(Hadath). Students find course material and previous exams, keep what they want to come back to,
and plan their own study.

## Course material

**Year**:
One of the years of the Computer Science programme, written "First year", "Second year",
"Third year" and "Master 1". Always derived from a course's semester (1–2 first, 3–4 second, 5–6 third,
7–8 Master 1), never
stored. Students browse by year; a course still belongs to one semester, shown to students as
"Semester 1" or "Semester 2" of its year (stored 3 is "Second year · Semester 1"). Master 1 is the fourth
year (URL `/years/m1`, circle text "M1"; students never see a 4).
_Avoid_: Level, L1/L2/L3, Year 2, S3, Semester 3 (in student-facing text), academic year (that is the 2024-2025 year of an exam)

**Year colour** and **Type colour**:
The colour that always stands for a year (first sky, second violet, third emerald, Master 1 amber) or for a
resource type (lecture blue, notes teal, exercise orange, exam rose; solutions and other neutral). Defined once in
the design language and always accompanied by the year's name or the type's name, never used alone.
_Avoid_: Theme colour, category colour

**Recently added**:
The home page's short list of the newest published files, by the time they were uploaded (not by exam year or
course). A visitor's view: a draft is never in it. Not "new since your last visit" and not progress.
_Avoid_: Latest, updates, what's new

**Course browser**:
The "Jump straight to a course" section of Home: tabs by year, and under the chosen tab that year's courses as cards
(code, title, "Semester 1" or "Semester 2", file count). A shortcut to a course page, not a new way to organise courses.
_Avoid_: Course picker, course finder (the Search page finds)

**Lecturer**:
The person who taught or wrote a resource, named as written (e.g. "Dr. Ali Ghorayeb"). A resource
has at most one lecturer, or none when unknown; a course's lecturers are those of its resources.
_Avoid_: Doctor, teacher, instructor, professor, author

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
card linked to it into Done from another column. Opening or downloading a resource never makes one, and moving a card
out of Done (or within Done) never makes or removes one.
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
