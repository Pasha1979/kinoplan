import { Button } from '@/components/ui/button'

export default function ButtonDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <h1 className="text-2xl font-semibold text-foreground">shadcn/ui — Button</h1>
      <div className="flex gap-4">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  )
}
