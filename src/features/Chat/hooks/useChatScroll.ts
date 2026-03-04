import { useEffect, useRef, useState } from 'react';

export const useChatScroll = ({
  isLoading,
  messageCount
}: {
  isLoading: boolean;
  messageCount: number;
}) => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesScrollRootRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = () => {
    const viewport = messagesScrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;

    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const viewport = messagesScrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;

    if (!viewport) return;

    const updateBottomState = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setIsAtBottom(distanceFromBottom <= 8);
    };

    updateBottomState();
    viewport.addEventListener('scroll', updateBottomState);

    return () => {
      viewport.removeEventListener('scroll', updateBottomState);
    };
  }, [messageCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      scrollToEnd();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [messageCount]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      const viewport = messagesScrollRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLDivElement | null;
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoading, messageCount]);

  return {
    isAtBottom,
    messagesScrollRootRef,
    scrollToEnd
  };
};
