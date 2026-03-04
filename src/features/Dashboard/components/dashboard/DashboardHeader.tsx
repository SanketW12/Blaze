import { Bell, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogPanel,
  DialogTrigger
} from '@/components/ui/dialog';

interface DashboardHeaderProps {
  profileName: string;
  profileInfoRows: Array<{ label: string; value: string }>;
  canInstallApp: boolean;
  onInstallClick: () => void;
}

export const DashboardHeader = ({
  profileName,
  profileInfoRows,
  canInstallApp,
  onInstallClick
}: DashboardHeaderProps) => (
  <div className="flex items-center justify-between ">
    <div>
      <p className="text-sm text-muted-foreground">Hi,</p>
      <h1 className="text-2xl font-semibold">Sanket</h1>
    </div>
    <div className="flex items-center gap-2">
      <Button
        aria-label="Install app"
        disabled={!canInstallApp}
        onClick={onInstallClick}
        size="icon"
        variant="ghost"
      >
        <Download />
      </Button>

      <Button size="icon" variant="ghost">
        <Bell />
      </Button>
      <Dialog>
        <DialogTrigger aria-label="Open profile details">
          <Avatar size="lg">
            <AvatarImage
              alt="Profile avatar"
              src="https://sanketw.netlify.app/assets/sanket5-CUpPUPkP.jpg"
            />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
        </DialogTrigger>
        <DialogContent className="before:hidden sm:max-w-md border-none shadow-lg">
          <DialogPanel className="space-y-4 p-0">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="h-12 bg-linear-to-r from-slate-300/20 via-slate-200/10 to-slate-300/20" />
              <div className="px-4 pb-4">
                <div className="-mt-6 flex items-end justify-center">
                  <Avatar className="size-[80px] border-4 border-card">
                    <AvatarImage
                      alt="Profile avatar"
                      src="https://sanketw.netlify.app/assets/sanket5-CUpPUPkP.jpg"
                    />
                    <AvatarFallback>AS</AvatarFallback>
                  </Avatar>
                </div>

                <div className="mt-3 flex justify-center">
                  <p className="text-2xl font-semibold">{profileName}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {profileInfoRows.map(row => (
                    <div
                      className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                      key={row.label}
                    >
                      <p className="text-muted-foreground text-xs">{row.label}</p>
                      <p className="mt-1 text-sm font-semibold">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogPanel>
        </DialogContent>
      </Dialog>
    </div>
  </div>
);
