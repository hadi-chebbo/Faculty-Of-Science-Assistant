import { ResourceRow } from "@/components/site/resource-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import type { ResourceGroup } from "@/services/courses/types";

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
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
