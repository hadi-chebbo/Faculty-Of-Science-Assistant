import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Coming soon
          </Badge>
          <CardTitle>
            <h1 className="text-3xl font-semibold tracking-tight">University Assistant</h1>
          </CardTitle>
          <CardDescription>
            Study resources and previous exams for Computer Science, Faculty of Science, Lebanese
            University.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button disabled>Browse courses</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
