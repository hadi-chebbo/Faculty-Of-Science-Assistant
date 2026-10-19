import { CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ReaderResource } from "@/services/resources/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LINK = `inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`;

// Below the file on phones, beside it from md up. Only what exists is shown.
export function ReaderDetails({ resource }: { resource: ReaderResource }) {
  const rows: [label: string, value: React.ReactNode][] = [
    [
      "Course",
      <>
        <span className="font-mono text-link">{resource.courseCode}</span> {resource.courseTitle}
      </>,
    ],
    ["Type", RESOURCE_TYPE_SINGULAR_LABELS[resource.type]],
    ...(resource.academicYearStart !== null
      ? [["Academic year", formatAcademicYear(resource.academicYearStart)] as [string, string]]
      : []),
    ...(resource.examSession ? [["Session", EXAM_SESSION_LABELS[resource.examSession]] as [string, string]] : []),
    ["Language", LANGUAGE_LABELS[resource.language]],
  ];
  const related = [
    ...(resource.solutionOf ? [{ ref: resource.solutionOf, label: `Solution of: ${resource.solutionOf.title}` }] : []),
    ...resource.solutions.map((ref, i) => ({
      ref,
      label: resource.solutions.length > 1 ? `Solution ${i + 1}: ${ref.title}` : `Solution: ${ref.title}`,
    })),
  ];

  return (
    <aside aria-label="About this file" className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {resource.description && <p className="mb-3 text-sm">{resource.description}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 text-heading">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{resource.solutionOf ? "Related" : "Solutions"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {related.map(({ ref, label }) => (
                <li key={ref.id}>
                  <Link href={`/resources/${ref.id}`} className={LINK}>
                    <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {resource.backupUrl && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Backup link</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={resource.backupUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
              Open the backup link
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </CardContent>
        </Card>
      )}
    </aside>
  );
}
