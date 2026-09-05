import { Card, CardBody, Skeleton } from '@rift/ui';
import { Screen } from '@/components/shell/ScreenHeader';

/** Matches the real layout — same grid, same heights — so nothing shifts. */
export default function Loading() {
  return (
    <>
      <div className="sticky top-0 z-30 flex min-h-16 items-center border-b border-md-outline-variant bg-md-surface-container px-5 md:px-8">
        <Skeleton className="h-[18px] w-[104px]" />
        <Skeleton className="ml-auto h-9 w-[132px] rounded-sm" />
      </div>
      <Screen>
        <div className="flex flex-col gap-5">
          <Card>
            <CardBody className="grid grid-cols-2 gap-6 p-5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={i ? 'lg:border-l lg:border-md-outline-variant lg:pl-6' : ''}>
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="mt-3 h-[30px] w-28" />
                  <Skeleton className="mt-2.5 h-2.5 w-36" />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <div className="border-b border-md-outline-variant p-5 md:px-6">
              <Skeleton className="h-4 w-[132px]" />
              <Skeleton className="mt-2 h-2.5 w-[210px]" />
            </div>
            <div className="px-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-md-outline-variant/40 py-[13px] last:border-0">
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="h-3 w-[142px]" />
                  <Skeleton className="ml-auto h-5 w-[82px] rounded-full" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Screen>
    </>
  );
}
