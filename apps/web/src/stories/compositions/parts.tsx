import type { MemberCard } from '@pitchorium/contracts';
import { Avatar, Button, Card, Heading, Progress, Skeleton, Text } from '@/components/ui';

/**
 * Pieces of the reference compositions (Storybook only): the cards the business pages will build
 * from the design system, on the data the contracts describe. Not components of the app.
 */

export function PostSkeleton() {
  return (
    <Card padding="none" className="grid gap-3 p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-9 w-full" />
    </Card>
  );
}

export function ProfileCard({ member, strength }: { member: MemberCard; strength: number }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div
        aria-hidden
        className="h-16 bg-accent-subtle bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center"
      />
      <div className="-mt-8 grid justify-items-center gap-2 px-5 pb-5 text-center">
        <Avatar
          name={member.displayName}
          src={member.avatarUrl}
          size="lg"
          className="ring-4 ring-surface"
        />
        <div className="grid gap-0.5">
          <Heading level={2} size="label">
            {member.displayName}
          </Heading>
          <Text size="sm" tone="muted">
            {member.headline}
          </Text>
        </div>
        <div className="mt-2 grid w-full gap-1.5 text-left">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Force du profil</span>
            <span className="font-medium tabular-nums">{strength} %</span>
          </div>
          <Progress
            value={strength}
            label="Force du profil"
            valueText={`${strength} %`}
            size="sm"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full">
          Compléter mon profil
        </Button>
      </div>
    </Card>
  );
}
