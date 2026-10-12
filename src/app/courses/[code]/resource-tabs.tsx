import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, RESOURCE_TYPE_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ResourceGroup } from "@/services/courses/types";

// Rows are plain text for now; opening files comes in a later step.
export function ResourceTabs({ groups }: { groups: ResourceGroup[] }) {
  return (
    <Tabs defaultValue={groups[0].type}>
      <div className="max-w-full overflow-x-auto pb-1">
        <TabsList className="w-max">
          {groups.map((group) => (
            <TabsTrigger key={group.type} value={group.type} className="px-3">
              {RESOURCE_TYPE_LABELS[group.type]}
              <span className="text-xs text-muted-foreground">{group.resources.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {groups.map((group) => (
        <TabsContent key={group.type} value={group.type}>
          <ul className="space-y-2">
            {group.resources.map((resource) => (
              <li key={resource.id} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium text-heading">{resource.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{LANGUAGE_LABELS[resource.language]}</Badge>
                  {resource.academicYearStart !== null && (
                    <Badge variant="secondary">{formatAcademicYear(resource.academicYearStart)}</Badge>
                  )}
                  {resource.examSession && (
                    <Badge variant="secondary">{EXAM_SESSION_LABELS[resource.examSession]}</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
