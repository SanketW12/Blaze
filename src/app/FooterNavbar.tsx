import { History, Home, MessageCircle, Settings } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type FooterTab = 'home' | 'chat' | 'history' | 'settings';

const TabItems = [
  {
    label: 'Home',
    icon: Home,
    value: 'home'
  },
  {
    label: 'Chat',
    icon: MessageCircle,
    value: 'chat'
  },
  {
    label: 'History',
    icon: History,
    value: 'history'
  },
  {
    label: 'Settings',
    icon: Settings,
    value: 'settings'
  }
] as const satisfies ReadonlyArray<{
  label: string;
  icon: typeof Home;
  value: FooterTab;
}>;

interface FooterNavbarProps {
  value: FooterTab;
  onValueChange: (value: FooterTab) => void;
}

const FooterNavbar = ({ value, onValueChange }: FooterNavbarProps) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-3">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card  shadow-sm">
        <Tabs
          className="flex h-12 w-full items-center"
          onValueChange={next => onValueChange(next as FooterTab)}
          value={value}
        >
          <TabsList className="grid   w-full grid-cols-4 gap-1 bg-transparent " variant="default">
            {TabItems.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-muted flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl p-1 text-xs leading-none"
                  key={tab.value}
                  value={tab.value}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="w-full truncate text-center font-medium">
                    {tab.label}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};

export default FooterNavbar;
