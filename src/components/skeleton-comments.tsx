// Skeleton loading components for comment section

export function SkeletonComment() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar skeleton */}
        <div className="w-11 h-11 rounded-full bg-white/5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
          <div className="h-3 w-32 rounded bg-white/5" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-3/4 rounded bg-white/5" />
      </div>
      {/* Actions skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-7 w-16 rounded-lg bg-white/5" />
        <div className="h-7 w-14 rounded-lg bg-white/5" />
      </div>
    </div>
  );
}

export function SkeletonCommentList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonComment key={i} />
      ))}
    </div>
  );
}
