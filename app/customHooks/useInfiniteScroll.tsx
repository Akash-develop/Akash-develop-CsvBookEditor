import { useEffect, useRef, useState, useCallback } from "react";

export function useInfiniteScroll({
  hasMore,
  isLoading,
  loadMore,
  root = null,
  rootMargin = "100px",
  threshold = 0.1,
}: {
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
}) {
  const [isObserving, setIsObserving] = useState(false);
  const loadTriggerRef = useRef<HTMLDivElement | null>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    },
    [hasMore, isLoading, loadMore]
  );

  useEffect(() => {
    const node = loadTriggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin,
      threshold,
    });

    observer.observe(node);
    setIsObserving(true);

    return () => {
      observer.disconnect();
      setIsObserving(false);
    };
  }, [handleIntersect, root, rootMargin, threshold]);

  return { loadTriggerRef, isObserving };
}
