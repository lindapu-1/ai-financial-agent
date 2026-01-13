'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { ProjectList } from '@/components/project-list';
import { useViewMode } from '@/hooks/use-view-mode';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useQueryLoading } from '@/hooks/use-query-loading';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { setQueryLoading } = useQueryLoading();
  const { mode } = useViewMode();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 bg-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center px-2 py-2">
            <span className="font-bold text-sm text-sidebar-foreground truncate">
              {mode === 'chat' ? 'Chat History' : 'Project Workspace'}
            </span>
            {mode === 'chat' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-fit hover:bg-sidebar-accent"
                    onClick={() => {
                      setOpenMobile(false);
                      setQueryLoading(false, []);
                      router.push('/');
                      router.refresh();
                    }}
                  >
                    <PlusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end">New Chat</TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {mode === 'chat' ? (
          <SidebarHistory user={user} />
        ) : (
          <ProjectList />
        )}
      </SidebarContent>
      <SidebarFooter>
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
    </Sidebar>
  );
}
