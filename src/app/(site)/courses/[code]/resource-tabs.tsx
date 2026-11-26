import { ResourceRow } from "@/components/site/resource-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YEAR_STYLES } from "@/lib/design-language";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import type { Year } from "@/lib/years";
import type { ResourceGroup } from "@/services/courses/types";

// One tab per type of file, for a course without chapters. The selected tab takes the course's year colour, like the
// area tabs of a course with chapters.
export function ResourceTabs({ year, groups }: { year: Year; groups: ResourceGroup[] }) {
  return (
    <Tabs defaultValue={groups[0].type}>
      {/* End padding the width of the fade, so the fade only ever covers empty space when the tabs fit or are scrolled to the end. */}
      <div className="scroll-fade max-w-full overflow-x-auto pe-6 pb-1">
        <TabsList className="h-auto! w-max gap-1 rounded-2xl border bg-card p-1">
          {groups.map((group) => (
            <TabsTrigger
              key={group.type}
              value={group.type}
              className={`min-h-11 rounded-xl px-3.5 text-foreground data-active:shadow-none md:min-h-9 ${YEAR_STYLES[year].tab}`}
            >
              {RESOURCE_TYPE_LABELS[group.type]}
              <span className="text-xs">{group.resources.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {groups.map((group) => (
        <TabsContent key={group.type} value={group.type} className="mt-3">
          <ul className="space-y-2">
            {group.resources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
